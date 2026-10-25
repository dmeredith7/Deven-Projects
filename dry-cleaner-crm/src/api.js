'use strict';

const { getSettings, DEFAULT_SETTINGS } = require('./db');
const orders = require('./orders');
const { runReminders, dueReminders } = require('./reminders');
const { normalizePhone, isEmail } = require('./channels');

const { HttpError } = orders;

function cleanCustomer(body, partial = false) {
  const out = {};
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'Customer name is required');
    out.name = name;
  }
  for (const k of ['phone', 'email', 'preferences', 'notes']) {
    if (k in body) out[k] = body[k] ? String(body[k]).trim() : null;
  }
  if (out.phone) out.phone = normalizePhone(out.phone) || out.phone;
  if (out.email && !isEmail(out.email)) throw new HttpError(400, 'Email address looks invalid');
  if ('sms_opt_in' in body) out.sms_opt_in = body.sms_opt_in ? 1 : 0;
  if ('email_opt_in' in body) out.email_opt_in = body.email_opt_in ? 1 : 0;
  return out;
}

function cleanService(body, partial = false) {
  const out = {};
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'Service name is required');
    out.name = name;
  }
  if ('category' in body) out.category = String(body.category || 'Dry Clean').trim();
  if ('price_cents' in body) {
    const p = Math.round(Number(body.price_cents));
    if (!Number.isFinite(p) || p < 0) throw new HttpError(400, 'Invalid price');
    out.price_cents = p;
  }
  if ('active' in body) out.active = body.active ? 1 : 0;
  return out;
}

// Table names below are always literals from this file, never user input.
function update(db, table, shopId, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND shop_id = ?`).run(
    ...keys.map((k) => fields[k]),
    id,
    shopId
  );
}

function insert(db, table, shopId, fields) {
  const keys = ['shop_id', ...Object.keys(fields)];
  const r = db
    .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .run(shopId, ...Object.values(fields));
  return Number(r.lastInsertRowid);
}

function dashboard(db, shopId) {
  const today = new Date().toISOString().slice(0, 10);
  const byStatus = {};
  for (const s of orders.STATUSES) byStatus[s] = 0;
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM orders WHERE shop_id = ? GROUP BY status').all(shopId)) {
    byStatus[r.status] = r.n;
  }
  const open = orders.listOrders(db, shopId, { status: 'open', limit: 1000 });
  const created = db
    .prepare("SELECT id FROM orders WHERE shop_id = ? AND date(created_at) = date('now') AND status != 'cancelled'")
    .all(shopId)
    .map((r) => orders.getOrder(db, shopId, r.id));

  return {
    by_status: byStatus,
    customers: db.prepare('SELECT COUNT(*) AS n FROM customers WHERE shop_id = ?').get(shopId).n,
    orders_today: created.length,
    sales_today_cents: created.reduce((s, o) => s + o.total_cents, 0),
    outstanding_balance_cents: open.reduce((s, o) => s + Math.max(0, o.balance_cents), 0),
    due_or_overdue: open.filter((o) => o.status !== 'ready' && o.due_date && o.due_date <= today),
    awaiting_pickup: open.filter((o) => o.status === 'ready'),
    reminders_due: dueReminders(db, shopId).length,
  };
}

function parseChannels(v) {
  const list = Array.isArray(v) ? v : [v || 'sms'];
  const out = list.filter((c) => c === 'sms' || c === 'email');
  if (!out.length) throw new HttpError(400, 'channels must include "sms" and/or "email"');
  return out;
}

// Returns async handle(ctx) where ctx = { method, pathname, query, body, user,
// ip, setSession, clearSession }. Each route declares who may call it:
// 'public', 'user' (any logged-in user) or 'owner'.
function createApi(db, notifier, auth) {
  const routes = [];
  const route = (method, pattern, access, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '(\\d+)')) + '$');
    routes.push({ method, re, keys, access, fn });
  };

  const mustGet = (table, shopId, id, label) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND shop_id = ?`).get(id, shopId);
    if (!row) throw new HttpError(404, `${label} not found`);
    return row;
  };
  const mustOrder = (shopId, id) => {
    const o = orders.getOrder(db, shopId, id);
    if (!o) throw new HttpError(404, 'Order not found');
    return o;
  };
  const settingsView = (shopId) => ({ ...getSettings(db, shopId), channels: notifier.modes });

  // ---- Auth ----
  route('POST', '/api/auth/signup', 'public', ({ body, setSession }) => {
    if (process.env.ALLOW_SIGNUP === '0') throw new HttpError(403, 'Sign-ups are closed');
    const r = auth.signup(body);
    setSession(r.token);
    return { user: r.user };
  });
  route('POST', '/api/auth/login', 'public', ({ body, ip, setSession }) => {
    const r = auth.login(body, ip);
    setSession(r.token);
    return { user: r.user };
  });
  route('POST', '/api/auth/logout', 'public', ({ clearSession }) => {
    clearSession();
    return { ok: true };
  });
  route('POST', '/api/auth/forgot', 'public', ({ body, ip }) => auth.forgotPassword(body, ip));
  route('POST', '/api/auth/reset', 'public', ({ body, setSession }) => {
    const r = auth.resetPassword(body);
    setSession(r.token);
    return { ok: true };
  });
  route('GET', '/api/me', 'user', ({ user }) => ({
    user: auth.publicUser(user),
    shop: { id: user.shop_id, name: getSettings(db, user.shop_id).business_name },
  }));
  route('PUT', '/api/me/password', 'user', ({ user, body }) => auth.changePassword(user, body));

  // ---- Team ----
  route('GET', '/api/team', 'user', ({ user }) => auth.listTeam(user.shop_id));
  route('POST', '/api/team', 'owner', ({ user, body }) => auth.addTeamMember(user.shop_id, body));
  route('DELETE', '/api/team/:id', 'owner', ({ user, params }) => auth.removeTeamMember(user.shop_id, user.id, params.id));

  route('GET', '/api/dashboard', 'user', ({ user }) => dashboard(db, user.shop_id));

  // ---- Customers ----
  route('GET', '/api/customers', 'user', ({ user, query }) => {
    const q = query.get('q');
    const sql = `SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('received','cleaning','ready')) AS open_orders,
        (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
      FROM customers c
      WHERE c.shop_id = ? ${q ? 'AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)' : ''}
      ORDER BY c.name COLLATE NOCASE LIMIT 500`;
    const like = `%${q}%`;
    // Also match phone searches typed with punctuation, e.g. (555) 123-4567.
    const digits = q ? q.replace(/\D/g, '') : '';
    return q
      ? db.prepare(sql).all(user.shop_id, like, digits.length >= 3 ? `%${digits}%` : like, like)
      : db.prepare(sql).all(user.shop_id);
  });
  route('POST', '/api/customers', 'user', ({ user, body }) => {
    const id = insert(db, 'customers', user.shop_id, cleanCustomer(body));
    return mustGet('customers', user.shop_id, id, 'Customer');
  });
  route('GET', '/api/customers/:id', 'user', ({ user, params }) => {
    const c = mustGet('customers', user.shop_id, params.id, 'Customer');
    const list = orders.listOrders(db, user.shop_id, { customerId: c.id });
    const messages = db
      .prepare('SELECT * FROM messages WHERE customer_id = ? AND shop_id = ? ORDER BY id DESC LIMIT 50')
      .all(c.id, user.shop_id);
    const lifetime = list.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_cents, 0);
    return { ...c, orders: list, messages, lifetime_value_cents: lifetime };
  });
  route('PUT', '/api/customers/:id', 'user', ({ user, params, body }) => {
    mustGet('customers', user.shop_id, params.id, 'Customer');
    update(db, 'customers', user.shop_id, params.id, cleanCustomer(body, true));
    return mustGet('customers', user.shop_id, params.id, 'Customer');
  });
  route('DELETE', '/api/customers/:id', 'user', ({ user, params }) => {
    mustGet('customers', user.shop_id, params.id, 'Customer');
    if (db.prepare('SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?').get(params.id).n > 0) {
      throw new HttpError(409, 'Customer has orders and cannot be deleted');
    }
    db.prepare('DELETE FROM messages WHERE customer_id = ? AND shop_id = ?').run(params.id, user.shop_id);
    db.prepare('DELETE FROM customers WHERE id = ? AND shop_id = ?').run(params.id, user.shop_id);
    return { ok: true };
  });
  route('POST', '/api/customers/:id/message', 'user', ({ user, params, body }) => {
    const c = mustGet('customers', user.shop_id, params.id, 'Customer');
    const text = String(body.body || '').trim();
    if (!text) throw new HttpError(400, 'Message body is required');
    const orderId = body.order_id ? mustOrder(user.shop_id, Number(body.order_id)).id : null;
    return notifier.sendManual({
      shopId: user.shop_id, customer: c, orderId, channels: parseChannels(body.channels), subject: body.subject, body: text,
    });
  });

  // ---- Services / price list ----
  route('GET', '/api/services', 'user', ({ user }) =>
    db.prepare('SELECT * FROM services WHERE shop_id = ? ORDER BY category, name COLLATE NOCASE').all(user.shop_id)
  );
  route('POST', '/api/services', 'owner', ({ user, body }) => {
    const id = insert(db, 'services', user.shop_id, cleanService(body));
    return mustGet('services', user.shop_id, id, 'Service');
  });
  route('PUT', '/api/services/:id', 'owner', ({ user, params, body }) => {
    mustGet('services', user.shop_id, params.id, 'Service');
    update(db, 'services', user.shop_id, params.id, cleanService(body, true));
    return mustGet('services', user.shop_id, params.id, 'Service');
  });
  route('DELETE', '/api/services/:id', 'owner', ({ user, params }) => {
    mustGet('services', user.shop_id, params.id, 'Service');
    // Keep history intact: services used on orders are deactivated, not deleted.
    const used = db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE service_id = ?').get(params.id).n;
    if (used) update(db, 'services', user.shop_id, params.id, { active: 0 });
    else db.prepare('DELETE FROM services WHERE id = ? AND shop_id = ?').run(params.id, user.shop_id);
    return { ok: true, deactivated: !!used };
  });

  // ---- Orders ----
  route('GET', '/api/orders', 'user', ({ user, query }) =>
    orders.listOrders(db, user.shop_id, {
      status: query.get('status'), q: query.get('q'), customerId: query.get('customer_id'),
    })
  );
  route('POST', '/api/orders', 'user', ({ user, body }) => orders.createOrder(db, user.shop_id, body));
  route('GET', '/api/orders/:id', 'user', ({ user, params }) => {
    const o = mustOrder(user.shop_id, params.id);
    o.messages = db.prepare('SELECT * FROM messages WHERE order_id = ? AND shop_id = ? ORDER BY id DESC').all(o.id, user.shop_id);
    return o;
  });
  route('PUT', '/api/orders/:id', 'user', ({ user, params, body }) => orders.updateOrder(db, user.shop_id, params.id, body));
  route('POST', '/api/orders/:id/status', 'user', ({ user, params, body }) =>
    orders.setStatus(db, notifier, user.shop_id, params.id, body.status)
  );
  route('POST', '/api/orders/:id/payment', 'user', ({ user, params, body }) =>
    orders.addPayment(db, user.shop_id, params.id, body.amount_cents)
  );
  route('POST', '/api/orders/:id/notify', 'user', ({ user, params, body }) =>
    notifier.notifyOrder(mustOrder(user.shop_id, params.id), body.kind === 'reminder' ? 'reminder' : 'ready')
  );

  // ---- Messages & reminders ----
  route('GET', '/api/messages', 'user', ({ user, query }) => {
    const channel = query.get('channel');
    return db
      .prepare(
        `SELECT m.*, c.name AS customer_name, o.ticket FROM messages m
           LEFT JOIN customers c ON c.id = m.customer_id
           LEFT JOIN orders o ON o.id = m.order_id
          WHERE m.shop_id = ? ${channel ? 'AND m.channel = ?' : ''}
          ORDER BY m.id DESC LIMIT 300`
      )
      .all(...(channel ? [user.shop_id, channel] : [user.shop_id]));
  });
  route('POST', '/api/reminders/run', 'user', async ({ user }) => ({
    sent: await runReminders(db, notifier, { shopId: user.shop_id }),
  }));

  // ---- Settings ----
  route('GET', '/api/settings', 'user', ({ user }) => settingsView(user.shop_id));
  route('PUT', '/api/settings', 'owner', ({ user, body }) => {
    const up = db.prepare(
      'INSERT INTO settings (shop_id, key, value) VALUES (?, ?, ?) ON CONFLICT(shop_id, key) DO UPDATE SET value = excluded.value'
    );
    if ('business_email' in body && body.business_email && !isEmail(body.business_email)) {
      throw new HttpError(400, 'Business email looks invalid');
    }
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in body) up.run(user.shop_id, k, String(body[k] ?? ''));
    if (body.business_name) db.prepare('UPDATE shops SET name = ? WHERE id = ?').run(String(body.business_name), user.shop_id);
    return settingsView(user.shop_id);
  });
  // Lets an owner confirm texts/emails really arrive, e.g. to their own phone.
  route('POST', '/api/settings/test-message', 'owner', async ({ user, body }) => {
    const settings = getSettings(db, user.shop_id);
    const to = String(body.to || '').trim();
    if (body.channel === 'email') {
      if (!isEmail(to)) throw new HttpError(400, 'Enter a valid email address');
      return notifier.sendEmail({
        shopId: user.shop_id, customer: { email: to }, kind: 'test', settings,
        subject: `Test email from ${settings.business_name}`,
        body: `This is a test email from ${settings.business_name}. If you can read this, email notifications are working.`,
      });
    }
    if (!normalizePhone(to)) throw new HttpError(400, 'Enter a valid phone number');
    return notifier.sendSms({
      shopId: user.shop_id, customer: { phone: to, sms_opt_in: 1 }, kind: 'test', settings,
      body: `Test text from ${settings.business_name}: text notifications are working.`,
    });
  });

  return async function handle(ctx) {
    for (const r of routes) {
      if (r.method !== ctx.method) continue;
      const m = ctx.pathname.match(r.re);
      if (!m) continue;
      if (r.access !== 'public') {
        if (!ctx.user) throw new HttpError(401, 'Please log in');
        if (r.access === 'owner' && ctx.user.role !== 'owner') throw new HttpError(403, 'Only the shop owner can do that');
      }
      const params = {};
      r.keys.forEach((k, i) => (params[k] = Number(m[i + 1])));
      return r.fn({ ...ctx, params, body: ctx.body || {} });
    }
    throw new HttpError(404, 'Not found');
  };
}

module.exports = { createApi };
