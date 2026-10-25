'use strict';

const { getSettings, DEFAULT_SETTINGS } = require('./db');
const orders = require('./orders');
const { runReminders, dueReminders } = require('./reminders');

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
  if ('sms_opt_in' in body) out.sms_opt_in = body.sms_opt_in ? 1 : 0;
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

function update(db, table, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
    ...keys.map((k) => fields[k]),
    id
  );
}

function insert(db, table, fields) {
  const keys = Object.keys(fields);
  const r = db
    .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .run(...keys.map((k) => fields[k]));
  return Number(r.lastInsertRowid);
}

function dashboard(db) {
  const count = (sql, ...p) => db.prepare(sql).get(...p).n;
  const today = new Date().toISOString().slice(0, 10);
  const byStatus = {};
  for (const s of orders.STATUSES) byStatus[s] = 0;
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all()) byStatus[r.status] = r.n;

  const open = orders.listOrders(db, { status: 'open', limit: 1000 });
  const dueToday = open.filter((o) => o.status !== 'ready' && o.due_date && o.due_date <= today);
  const readyOrders = open.filter((o) => o.status === 'ready');
  const created = db
    .prepare("SELECT id FROM orders WHERE date(created_at) = date('now') AND status != 'cancelled'")
    .all()
    .map((r) => orders.getOrder(db, r.id));

  return {
    by_status: byStatus,
    customers: count('SELECT COUNT(*) AS n FROM customers'),
    orders_today: created.length,
    sales_today_cents: created.reduce((s, o) => s + o.total_cents, 0),
    outstanding_balance_cents: open.reduce((s, o) => s + Math.max(0, o.balance_cents), 0),
    due_or_overdue: dueToday,
    awaiting_pickup: readyOrders,
    reminders_due: dueReminders(db).length,
  };
}

// Returns an async handler (method, path, query, body) -> data, or throws HttpError.
function createApi(db, notifier) {
  const routes = [];
  const route = (method, pattern, fn) => {
    const keys = [];
    const re = new RegExp(
      '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '(\\d+)')) + '$'
    );
    routes.push({ method, re, keys, fn });
  };

  const mustGet = (table, id, label) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) throw new HttpError(404, `${label} not found`);
    return row;
  };

  route('GET', '/api/dashboard', () => dashboard(db));

  // Customers
  route('GET', '/api/customers', ({ query }) => {
    const q = query.get('q');
    const sql = `SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('received','cleaning','ready')) AS open_orders,
        (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
      FROM customers c
      ${q ? 'WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?' : ''}
      ORDER BY c.name COLLATE NOCASE LIMIT 500`;
    return q ? db.prepare(sql).all(`%${q}%`, `%${q}%`, `%${q}%`) : db.prepare(sql).all();
  });
  route('POST', '/api/customers', ({ body }) => {
    const id = insert(db, 'customers', cleanCustomer(body));
    return mustGet('customers', id, 'Customer');
  });
  route('GET', '/api/customers/:id', ({ params }) => {
    const c = mustGet('customers', params.id, 'Customer');
    const list = orders.listOrders(db, { customerId: c.id });
    const messages = db
      .prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY id DESC LIMIT 50')
      .all(c.id);
    const lifetime = list.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_cents, 0);
    return { ...c, orders: list, messages, lifetime_value_cents: lifetime };
  });
  route('PUT', '/api/customers/:id', ({ params, body }) => {
    mustGet('customers', params.id, 'Customer');
    update(db, 'customers', params.id, cleanCustomer(body, true));
    return mustGet('customers', params.id, 'Customer');
  });
  route('DELETE', '/api/customers/:id', ({ params }) => {
    mustGet('customers', params.id, 'Customer');
    if (db.prepare('SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?').get(params.id).n > 0) {
      throw new HttpError(409, 'Customer has orders and cannot be deleted');
    }
    db.prepare('DELETE FROM messages WHERE customer_id = ?').run(params.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(params.id);
    return { ok: true };
  });
  route('POST', '/api/customers/:id/message', async ({ params, body }) => {
    const c = mustGet('customers', params.id, 'Customer');
    const text = String(body.body || '').trim();
    if (!text) throw new HttpError(400, 'Message body is required');
    return notifier.send({ customer: c, orderId: body.order_id || null, kind: 'manual', body: text });
  });

  // Services / price list
  route('GET', '/api/services', () =>
    db.prepare('SELECT * FROM services ORDER BY category, name COLLATE NOCASE').all()
  );
  route('POST', '/api/services', ({ body }) => {
    const id = insert(db, 'services', cleanService(body));
    return mustGet('services', id, 'Service');
  });
  route('PUT', '/api/services/:id', ({ params, body }) => {
    mustGet('services', params.id, 'Service');
    update(db, 'services', params.id, cleanService(body, true));
    return mustGet('services', params.id, 'Service');
  });
  route('DELETE', '/api/services/:id', ({ params }) => {
    mustGet('services', params.id, 'Service');
    // Keep history intact: services used on orders are deactivated, not deleted.
    const used = db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE service_id = ?').get(params.id).n;
    if (used) update(db, 'services', params.id, { active: 0 });
    else db.prepare('DELETE FROM services WHERE id = ?').run(params.id);
    return { ok: true, deactivated: !!used };
  });

  // Orders
  route('GET', '/api/orders', ({ query }) =>
    orders.listOrders(db, { status: query.get('status'), q: query.get('q'), customerId: query.get('customer_id') })
  );
  route('POST', '/api/orders', ({ body }) => orders.createOrder(db, body));
  route('GET', '/api/orders/:id', ({ params }) => {
    const o = orders.getOrder(db, params.id);
    if (!o) throw new HttpError(404, 'Order not found');
    o.messages = db.prepare('SELECT * FROM messages WHERE order_id = ? ORDER BY id DESC').all(o.id);
    return o;
  });
  route('PUT', '/api/orders/:id', ({ params, body }) => orders.updateOrder(db, params.id, body));
  route('POST', '/api/orders/:id/status', ({ params, body }) =>
    orders.setStatus(db, notifier, params.id, body.status)
  );
  route('POST', '/api/orders/:id/payment', ({ params, body }) =>
    orders.addPayment(db, params.id, body.amount_cents)
  );
  route('POST', '/api/orders/:id/notify', async ({ params, body }) => {
    const o = orders.getOrder(db, params.id);
    if (!o) throw new HttpError(404, 'Order not found');
    return notifier.notifyOrder(o, body.kind === 'reminder' ? 'reminder' : 'ready');
  });

  // Messages & reminders
  route('GET', '/api/messages', () =>
    db
      .prepare(
        `SELECT m.*, c.name AS customer_name, o.ticket FROM messages m
           LEFT JOIN customers c ON c.id = m.customer_id
           LEFT JOIN orders o ON o.id = m.order_id
          ORDER BY m.id DESC LIMIT 300`
      )
      .all()
  );
  route('POST', '/api/reminders/run', async () => ({ sent: await runReminders(db, notifier) }));

  // Settings
  route('GET', '/api/settings', () => ({ ...getSettings(db), sms_mode: notifier.mode }));
  route('PUT', '/api/settings', ({ body }) => {
    const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in body) up.run(k, String(body[k] ?? ''));
    return { ...getSettings(db), sms_mode: notifier.mode };
  });

  return async function handle(method, pathname, query, body) {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.re);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = Number(m[i + 1])));
      return r.fn({ params, query, body: body || {} });
    }
    throw new HttpError(404, 'Not found');
  };
}

module.exports = { createApi };
