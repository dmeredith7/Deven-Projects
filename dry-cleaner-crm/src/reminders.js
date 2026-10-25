'use strict';

// Pickup reminders: an order that has been "ready" for reminder_after_days
// gets a reminder, then another every reminder_interval_days, up to
// max_reminders total. Each shop has its own settings.

const { getSettings } = require('./db');
const { getOrder } = require('./orders');

function sqlNow(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function dueReminders(db, shopId, now = new Date()) {
  const s = getSettings(db, shopId);
  const after = Number(s.reminder_after_days) || 0;
  const interval = Number(s.reminder_interval_days) || 1;
  const max = Number(s.max_reminders) || 0;
  if (max <= 0) return [];
  const n = sqlNow(now);
  return db
    .prepare(
      `SELECT id FROM orders
        WHERE shop_id = ?
          AND status = 'ready'
          AND ready_at IS NOT NULL
          AND reminder_count < ?
          AND julianday(?) - julianday(ready_at) >= ?
          AND (last_reminder_at IS NULL OR julianday(?) - julianday(last_reminder_at) >= ?)
        ORDER BY id`
    )
    .all(shopId, max, n, after, n, interval)
    .map((r) => getOrder(db, shopId, r.id));
}

async function runReminders(db, notifier, { shopId, now = new Date() } = {}) {
  const shopIds = shopId
    ? [shopId]
    : db.prepare("SELECT DISTINCT shop_id FROM orders WHERE status = 'ready'").all().map((r) => r.shop_id);
  const mark = db.prepare(
    'UPDATE orders SET reminder_count = reminder_count + 1, last_reminder_at = ? WHERE id = ?'
  );
  const results = [];
  for (const id of shopIds) {
    for (const order of dueReminders(db, id, now)) {
      const msgs = await notifier.notifyOrder(order, 'reminder');
      mark.run(sqlNow(now), order.id);
      results.push({ shop_id: id, order_id: order.id, ticket: order.ticket, messages: msgs.map((m) => ({ channel: m.channel, status: m.status })) });
    }
  }
  return results;
}

function startScheduler(db, notifier, { intervalMs = 15 * 60 * 1000, log = console.log } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runReminders(db, notifier);
      if (r.length) log(`[reminders] sent reminders for ${r.length} order(s)`);
    } catch (e) {
      log('[reminders] error:', e.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  setTimeout(tick, 5000).unref();
  return () => clearInterval(timer);
}

module.exports = { dueReminders, runReminders, startScheduler, sqlNow };
