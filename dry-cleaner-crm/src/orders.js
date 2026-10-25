'use strict';

const { getSettings } = require('./db');

const STATUSES = ['received', 'cleaning', 'ready', 'picked_up', 'cancelled'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function computeTotals(order, items) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price_cents, 0);
  const taxable = Math.max(0, subtotal - order.discount_cents);
  const tax = Math.round((taxable * order.tax_rate) / 100);
  const total = taxable + tax;
  return {
    subtotal_cents: subtotal,
    tax_cents: tax,
    total_cents: total,
    balance_cents: total - order.paid_cents,
    piece_count: items.reduce((s, i) => s + i.qty, 0),
  };
}

function getOrder(db, shopId, id) {
  const order = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              c.preferences AS customer_preferences
         FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.id = ? AND o.shop_id = ?`
    )
    .get(id, shopId);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  return { ...order, items, ...computeTotals(order, items) };
}

function listOrders(db, shopId, { status, q, customerId, limit = 200 } = {}) {
  const where = ['o.shop_id = ?'];
  const params = [shopId];
  if (status === 'open') where.push("o.status IN ('received','cleaning','ready')");
  else if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (customerId) {
    where.push('o.customer_id = ?');
    params.push(Number(customerId));
  }
  if (q) {
    where.push('(o.ticket LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR o.rack LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const rows = db
    .prepare(
      `SELECT o.id FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE ${where.join(' AND ')}
       ORDER BY o.id DESC LIMIT ?`
    )
    .all(...params, Number(limit));
  return rows.map((r) => getOrder(db, shopId, r.id));
}

function normalizeItems(db, shopId, items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'An order needs at least one item');
  const svc = db.prepare('SELECT * FROM services WHERE id = ? AND shop_id = ?');
  return items.map((it) => {
    const service = it.service_id ? svc.get(Number(it.service_id), shopId) : null;
    if (it.service_id && !service) throw new HttpError(400, 'Unknown service');
    const description = (it.description || service?.name || '').trim();
    if (!description) throw new HttpError(400, 'Each item needs a description or service');
    const qty = Math.max(1, parseInt(it.qty ?? 1, 10) || 1);
    const price = it.price_cents != null ? Math.round(Number(it.price_cents)) : service?.price_cents ?? 0;
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Invalid item price');
    return { service_id: service?.id ?? null, description, qty, price_cents: price, notes: it.notes || null };
  });
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function replaceItems(db, orderId, items) {
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
  const ins = db.prepare(
    'INSERT INTO order_items (order_id, service_id, description, qty, price_cents, notes) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const i of items) ins.run(orderId, i.service_id, i.description, i.qty, i.price_cents, i.notes);
}

function createOrder(db, shopId, body) {
  const customer = db
    .prepare('SELECT id FROM customers WHERE id = ? AND shop_id = ?')
    .get(Number(body.customer_id), shopId);
  if (!customer) throw new HttpError(400, 'Valid customer_id is required');
  const items = normalizeItems(db, shopId, body.items);
  const settings = getSettings(db, shopId);

  db.exec('BEGIN');
  try {
    const { next_ticket: ticket } = db.prepare('SELECT next_ticket FROM shops WHERE id = ?').get(shopId);
    db.prepare('UPDATE shops SET next_ticket = next_ticket + 1 WHERE id = ?').run(shopId);
    const r = db
      .prepare(
        `INSERT INTO orders (shop_id, ticket, customer_id, rack, due_date, notes, discount_cents, tax_rate, paid_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        shopId,
        String(ticket),
        customer.id,
        body.rack || null,
        body.due_date || addDays(Number(settings.default_turnaround_days) || 3),
        body.notes || null,
        Math.max(0, Math.round(Number(body.discount_cents) || 0)),
        Number(settings.tax_rate) || 0,
        Math.max(0, Math.round(Number(body.paid_cents) || 0))
      );
    const id = Number(r.lastInsertRowid);
    replaceItems(db, id, items);
    db.exec('COMMIT');
    return getOrder(db, shopId, id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function updateOrder(db, shopId, id, body) {
  const existing = getOrder(db, shopId, id);
  if (!existing) throw new HttpError(404, 'Order not found');
  const fields = {};
  for (const k of ['rack', 'due_date', 'notes']) if (k in body) fields[k] = body[k] || null;
  if ('discount_cents' in body) fields.discount_cents = Math.max(0, Math.round(Number(body.discount_cents) || 0));
  const items = 'items' in body ? normalizeItems(db, shopId, body.items) : null;

  db.exec('BEGIN');
  try {
    const keys = Object.keys(fields);
    if (keys.length) {
      db.prepare(`UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
        ...keys.map((k) => fields[k]),
        id
      );
    }
    if (items) replaceItems(db, id, items);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return getOrder(db, shopId, id);
}

async function setStatus(db, notifier, shopId, id, status) {
  if (!STATUSES.includes(status)) throw new HttpError(400, `Status must be one of: ${STATUSES.join(', ')}`);
  const order = getOrder(db, shopId, id);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status === status) return { order, messages: [] };

  const now = "datetime('now')";
  const extra =
    status === 'ready'
      ? `, ready_at = ${now}, picked_up_at = NULL, reminder_count = 0, last_reminder_at = NULL`
      : status === 'picked_up'
        ? `, picked_up_at = ${now}`
        : status === 'received' || status === 'cleaning'
          ? ', ready_at = NULL, picked_up_at = NULL'
          : '';
  db.prepare(`UPDATE orders SET status = ?${extra} WHERE id = ?`).run(status, id);

  const updated = getOrder(db, shopId, id);
  let messages = [];
  if (status === 'ready' && getSettings(db, shopId).auto_notify_ready === '1') {
    messages = await notifier.notifyOrder(updated, 'ready');
  }
  return { order: updated, messages };
}

function addPayment(db, shopId, id, amountCents) {
  const order = getOrder(db, shopId, id);
  if (!order) throw new HttpError(404, 'Order not found');
  const amt = Math.round(Number(amountCents));
  if (!Number.isFinite(amt) || amt === 0) throw new HttpError(400, 'amount_cents must be a non-zero number');
  db.prepare('UPDATE orders SET paid_cents = MAX(0, paid_cents + ?) WHERE id = ?').run(amt, id);
  return getOrder(db, shopId, id);
}

module.exports = {
  STATUSES,
  HttpError,
  computeTotals,
  getOrder,
  listOrders,
  createOrder,
  updateOrder,
  setStatus,
  addPayment,
};
