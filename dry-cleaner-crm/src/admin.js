'use strict';

// The platform admin: the person running this service, who can see every
// dry cleaner (shop) using it. There is one admin login, set on the server
// with ADMIN_EMAIL and ADMIN_PASSWORD; it can't be created from the app.

const crypto = require('node:crypto');
const { getSettings } = require('./db');
const orders = require('./orders');
const { createLimiter } = require('./auth');

const { HttpError } = orders;
const ADMIN_SESSION_HOURS = 12;
const VIEW_AS_HOURS = 2; // "Open their app" sessions expire quickly
const MIN_PASSWORD = 10;

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();
const future = (ms) => new Date(Date.now() + ms).toISOString();
const sameSecret = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

function createAdmin(db, auth, { env = process.env } = {}) {
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(env.ADMIN_PASSWORD || '');
  const enabled = Boolean(adminEmail) && adminPassword.length >= MIN_PASSWORD;
  const limiter = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

  // Both comparisons always run so timing doesn't reveal which one failed.
  function matches({ email, password } = {}) {
    if (!enabled) return false;
    const emailOk = sameSecret(String(email || '').trim().toLowerCase(), adminEmail);
    const passwordOk = sameSecret(String(password || ''), adminPassword);
    return emailOk && passwordOk;
  }

  function createSession() {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').run(
      sha256(token).toString('hex'), future(ADMIN_SESSION_HOURS * 36e5)
    );
    return token;
  }

  function fromToken(token) {
    if (!token || !enabled) return null;
    const hash = sha256(token).toString('hex');
    const row = db.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(hash);
    if (!row) return null;
    if (row.expires_at < new Date().toISOString()) {
      db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hash);
      return null;
    }
    return { email: adminEmail };
  }

  function destroySession(token) {
    if (token) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token).toString('hex'));
  }

  function login(body, ip = '') {
    if (!enabled) {
      throw new HttpError(503, 'Admin access isn’t set up. Set ADMIN_EMAIL and ADMIN_PASSWORD on the server.');
    }
    const key = `admin|${ip}`;
    limiter.check(key);
    if (!matches(body)) {
      limiter.fail(key);
      throw new HttpError(401, 'Incorrect email or password');
    }
    limiter.reset(key);
    return createSession();
  }

  // ---- numbers ----
  // Order totals, computed the same way as everywhere else (orders.computeTotals).
  function orderTotals(where = '', ...params) {
    return db
      .prepare(
        `SELECT o.id, o.shop_id, o.created_at, o.discount_cents, o.tax_rate,
                COALESCE(SUM(i.qty * i.price_cents), 0) AS subtotal
           FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
          WHERE o.status != 'cancelled' ${where}
          GROUP BY o.id`
      )
      .all(...params)
      .map((r) => {
        const taxable = Math.max(0, r.subtotal - r.discount_cents);
        return { shop_id: r.shop_id, created_at: r.created_at, total: taxable + Math.round((taxable * r.tax_rate) / 100) };
      });
  }

  function statsByShop() {
    const since = db.prepare("SELECT datetime('now', '-30 days') AS d").get().d;
    const by = new Map();
    const get = (id) => {
      if (!by.has(id)) {
        by.set(id, {
          customers: 0, orders: 0, orders_30d: 0, active_orders: 0, last_order_at: null,
          sales_cents: 0, sales_30d_cents: 0, texts_30d: 0, emails_30d: 0, team: 0,
        });
      }
      return by.get(id);
    };
    for (const r of db.prepare('SELECT shop_id, COUNT(*) AS n FROM customers GROUP BY shop_id').all()) get(r.shop_id).customers = r.n;
    for (const r of db.prepare('SELECT shop_id, COUNT(*) AS n FROM users GROUP BY shop_id').all()) get(r.shop_id).team = r.n;
    for (const r of db
      .prepare(
        `SELECT shop_id, COUNT(*) AS n, SUM(created_at >= ?) AS recent,
                SUM(status IN ('received','cleaning','ready')) AS active, MAX(created_at) AS last
           FROM orders GROUP BY shop_id`
      )
      .all(since)) {
      Object.assign(get(r.shop_id), { orders: r.n, orders_30d: r.recent || 0, active_orders: r.active || 0, last_order_at: r.last });
    }
    for (const o of orderTotals()) {
      const s = get(o.shop_id);
      s.sales_cents += o.total;
      if (o.created_at >= since) s.sales_30d_cents += o.total;
    }
    for (const r of db
      .prepare(
        `SELECT shop_id, SUM(channel = 'sms') AS sms, SUM(channel = 'email') AS email FROM messages
          WHERE direction = 'out' AND status = 'sent' AND created_at >= ? GROUP BY shop_id`
      )
      .all(since)) {
      Object.assign(get(r.shop_id), { texts_30d: r.sms || 0, emails_30d: r.email || 0 });
    }
    return { by, get, since };
  }

  // active: an order in the last 30 days; new: joined in the last 14 days, no orders yet; quiet: neither.
  function activity(shop, s) {
    if (s.last_order_at && s.orders_30d > 0) return 'active';
    const newSince = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    if (!s.orders && shop.created_at >= newSince) return 'new';
    return 'quiet';
  }

  function owners() {
    const map = new Map();
    for (const u of db.prepare("SELECT shop_id, name, email FROM users WHERE role = 'owner' ORDER BY id").all()) {
      if (!map.has(u.shop_id)) map.set(u.shop_id, { name: u.name, email: u.email });
    }
    return map;
  }

  function overview() {
    const { get, since } = statsByShop();
    const ownerOf = owners();
    const shops = db.prepare('SELECT * FROM shops ORDER BY id DESC').all().map((shop) => {
      const s = get(shop.id);
      const settings = getSettings(db, shop.id);
      return {
        id: shop.id,
        name: settings.business_name || shop.name,
        created_at: shop.created_at,
        owner: ownerOf.get(shop.id) || null,
        ticket_mode: settings.ticket_mode,
        status: activity(shop, s),
        ...s,
      };
    });
    const sum = (k) => shops.reduce((a, s) => a + (s[k] || 0), 0);
    return {
      totals: {
        shops: shops.length,
        new_shops_30d: shops.filter((s) => s.created_at >= since).length,
        active_shops: shops.filter((s) => s.status === 'active').length,
        customers: sum('customers'),
        orders: sum('orders'),
        orders_30d: sum('orders_30d'),
        active_orders: sum('active_orders'),
        sales_cents: sum('sales_cents'),
        sales_30d_cents: sum('sales_30d_cents'),
        texts_30d: sum('texts_30d'),
        emails_30d: sum('emails_30d'),
      },
      shops,
    };
  }

  function shopDetail(id) {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
    if (!shop) throw new HttpError(404, 'Shop not found');
    const s = statsByShop().get(shop.id);
    const settings = getSettings(db, shop.id);
    return {
      id: shop.id,
      name: settings.business_name || shop.name,
      created_at: shop.created_at,
      status: activity(shop, s),
      stats: s,
      settings: Object.fromEntries(
        ['business_phone', 'business_email', 'business_address', 'tax_rate', 'default_turnaround_days', 'ticket_mode',
          'auto_notify_ready', 'notify_sms', 'notify_email', 'reminder_after_days', 'reminder_interval_days', 'max_reminders']
          .map((k) => [k, settings[k]])
      ),
      team: auth.listTeam(shop.id),
      recent_orders: orders.listOrders(db, shop.id, { limit: 15 }),
      recent_messages: db
        .prepare(
          `SELECT m.*, c.name AS customer_name, o.ticket FROM messages m
             LEFT JOIN customers c ON c.id = m.customer_id LEFT JOIN orders o ON o.id = m.order_id
            WHERE m.shop_id = ? ORDER BY m.id DESC LIMIT 15`
        )
        .all(shop.id),
    };
  }

  // "Open their app": a short shop session as the shop's owner, marked so the
  // app shows a banner and a way back to admin.
  function viewAs(id) {
    const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(id);
    if (!shop) throw new HttpError(404, 'Shop not found');
    const owner = db.prepare("SELECT id FROM users WHERE shop_id = ? AND role = 'owner' ORDER BY id LIMIT 1").get(id);
    if (!owner) throw new HttpError(409, 'This shop has no owner account');
    return auth.createSession(owner.id, { hours: VIEW_AS_HOURS, impersonated: true });
  }

  return { enabled, matches, login, createSession, fromToken, destroySession, overview, shopDetail, viewAs, ADMIN_SESSION_HOURS, VIEW_AS_HOURS };
}

module.exports = { createAdmin, MIN_PASSWORD };
