'use strict';

// Pickup reminders: an order that has been "ready" for reminder_after_days
// gets a reminder, then another every reminder_interval_days, up to
// max_reminders total.

const { getSettings } = require('./db');
const { getOrder } = require('./orders');

function sqlNow(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function dueReminders(db, now = new Date()) {
  const s = getSettings(db);
  const after = Number(s.reminder_after_days) || 0;
  const interval = Number(s.reminder_interval_days) || 1;
  const max = Number(s.max_reminders) || 0;
  if (max <= 0) return [];
  const n = sqlNow(now);
  return db
    .prepare(
      `SELECT id FROM orders
        WHERE status = 'ready'
          AND ready_at IS NOT NULL
          AND reminder_count < ?
          AND julianday(?) - julianday(ready_at) >= ?
          AND (last_reminder_at IS NULL OR julianday(?) - julianday(last_reminder_at) >= ?)
        ORDER BY id`
    )
    .all(max, n, after, n, interval)
    .map((r) => getOrder(db, r.id));
}

async function runReminders(db, notifier, now = new Date()) {
  const results = [];
  const mark = db.prepare(
    'UPDATE orders SET reminder_count = reminder_count + 1, last_reminder_at = ? WHERE id = ?'
  );
  for (const order of dueReminders(db, now)) {
    const msg = await notifier.notifyOrder(order, 'reminder');
    mark.run(sqlNow(now), order.id);
    results.push({ order_id: order.id, ticket: order.ticket, status: msg.status });
  }
  return results;
}

function startScheduler(db, notifier, { intervalMs = 15 * 60 * 1000, log = console.log } = {}) {
  const tick = () =>
    runReminders(db, notifier)
      .then((r) => r.length && log(`[reminders] sent ${r.length} pickup reminder(s)`))
      .catch((e) => log('[reminders] error:', e.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  setTimeout(tick, 5000).unref();
  return () => clearInterval(timer);
}

module.exports = { dueReminders, runReminders, startScheduler, sqlNow };
