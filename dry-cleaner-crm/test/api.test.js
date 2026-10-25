'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { createNotifier } = require('../src/notify');
const { runReminders } = require('../src/reminders');
const db_ = require('../src/db');

async function start({ sms } = {}) {
  const sent = [];
  const sendSms = sms === false ? null : async (to, body) => sent.push({ to, body });
  const db = db_.open(':memory:');
  const notifier = createNotifier(db, { sendSms });
  const { server: srv } = createServer({ db, notifier, password: '' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  return { call, sent, db, notifier, close: () => srv.close() };
}

test('order lifecycle: create, ready notification, payment, pickup', async (t) => {
  const s = await start();
  t.after(s.close);

  const { data: cust } = await s.call('POST', '/customers', { name: 'Jane Doe', phone: '+15551234567' });
  const { data: services } = await s.call('GET', '/services');
  const shirt = services.find((x) => x.name.startsWith('Shirt'));

  await s.call('PUT', '/settings', { tax_rate: '10' });
  const { status, data: order } = await s.call('POST', '/orders', {
    customer_id: cust.id,
    items: [{ service_id: shirt.id, qty: 4 }, { description: 'Silk scarf', price_cents: 1000 }],
    discount_cents: 400,
  });
  assert.equal(status, 200);
  assert.equal(order.ticket, String(1000 + order.id));
  assert.equal(order.subtotal_cents, 4 * shirt.price_cents + 1000);
  const taxable = order.subtotal_cents - 400;
  assert.equal(order.total_cents, taxable + Math.round(taxable * 0.1));
  assert.equal(order.piece_count, 5);

  const ready = await s.call('POST', `/orders/${order.id}/status`, { status: 'ready' });
  assert.equal(ready.data.order.status, 'ready');
  assert.equal(ready.data.message.status, 'sent');
  assert.equal(s.sent.length, 1);
  assert.match(s.sent[0].body, new RegExp(`#${order.ticket}`));
  assert.match(s.sent[0].body, /Hi Jane/);

  const paid = await s.call('POST', `/orders/${order.id}/payment`, { amount_cents: order.total_cents });
  assert.equal(paid.data.balance_cents, 0);

  const done = await s.call('POST', `/orders/${order.id}/status`, { status: 'picked_up' });
  assert.ok(done.data.order.picked_up_at);

  const { data: dash } = await s.call('GET', '/dashboard');
  assert.equal(dash.by_status.picked_up, 1);
  assert.equal(dash.orders_today, 1);
});

test('validation errors', async (t) => {
  const s = await start();
  t.after(s.close);
  assert.equal((await s.call('POST', '/customers', { name: '' })).status, 400);
  assert.equal((await s.call('POST', '/orders', { customer_id: 999, items: [{ description: 'x' }] })).status, 400);
  const { data: c } = await s.call('POST', '/customers', { name: 'Bob' });
  assert.equal((await s.call('POST', '/orders', { customer_id: c.id, items: [] })).status, 400);
  assert.equal((await s.call('POST', '/orders/1/status', { status: 'bogus' })).status, 400);
  assert.equal((await s.call('GET', '/orders/12345')).status, 404);
});

test('messages are skipped without a phone or when opted out', async (t) => {
  const s = await start();
  t.after(s.close);
  const { data: c } = await s.call('POST', '/customers', { name: 'No Phone' });
  const { data: o } = await s.call('POST', '/orders', { customer_id: c.id, items: [{ description: 'Coat', price_cents: 2000 }] });
  const r = await s.call('POST', `/orders/${o.id}/status`, { status: 'ready' });
  assert.equal(r.data.message.status, 'skipped');

  const { data: c2 } = await s.call('POST', '/customers', { name: 'Opted Out', phone: '+1555', sms_opt_in: false });
  const m = await s.call('POST', `/customers/${c2.id}/message`, { body: 'hello' });
  assert.equal(m.data.status, 'skipped');
  assert.equal(s.sent.length, 0);
});

test('log mode records messages without sending', async (t) => {
  const s = await start({ sms: false });
  t.after(s.close);
  const { data: c } = await s.call('POST', '/customers', { name: 'Al', phone: '+1555' });
  const m = await s.call('POST', `/customers/${c.id}/message`, { body: 'hi' });
  assert.equal(m.data.status, 'logged');
  assert.equal((await s.call('GET', '/messages')).data.length, 1);
});

test('pickup reminders follow after/interval/max settings', async (t) => {
  const s = await start();
  t.after(s.close);
  await s.call('PUT', '/settings', { reminder_after_days: '3', reminder_interval_days: '2', max_reminders: '2', auto_notify_ready: '0' });
  const { data: c } = await s.call('POST', '/customers', { name: 'Rita', phone: '+1555' });
  const { data: o } = await s.call('POST', '/orders', { customer_id: c.id, items: [{ description: 'Dress', price_cents: 1400 }] });
  await s.call('POST', `/orders/${o.id}/status`, { status: 'ready' });
  s.db.prepare("UPDATE orders SET ready_at = '2026-01-01 09:00:00' WHERE id = ?").run(o.id);

  const at = (d) => new Date(`2026-01-${d}T10:00:00Z`);
  assert.equal((await runReminders(s.db, s.notifier, at('02'))).length, 0); // too early
  assert.equal((await runReminders(s.db, s.notifier, at('04'))).length, 1); // first
  assert.equal((await runReminders(s.db, s.notifier, at('05'))).length, 0); // within interval
  assert.equal((await runReminders(s.db, s.notifier, at('06'))).length, 1); // second
  assert.equal((await runReminders(s.db, s.notifier, at('20'))).length, 0); // max reached
  assert.equal(s.sent.length, 2);
  assert.match(s.sent[0].body, /reminder/);

  // Picked-up orders never get reminders.
  await s.call('POST', `/orders/${o.id}/status`, { status: 'picked_up' });
  s.db.prepare('UPDATE orders SET reminder_count = 0 WHERE id = ?').run(o.id);
  assert.equal((await runReminders(s.db, s.notifier, at('25'))).length, 0);
});

test('services used on orders are deactivated instead of deleted', async (t) => {
  const s = await start();
  t.after(s.close);
  const { data: svc } = await s.call('POST', '/services', { name: 'Tie', category: 'Dry Clean', price_cents: 500 });
  const { data: c } = await s.call('POST', '/customers', { name: 'Tom' });
  await s.call('POST', '/orders', { customer_id: c.id, items: [{ service_id: svc.id }] });
  const r = await s.call('DELETE', `/services/${svc.id}`);
  assert.equal(r.data.deactivated, true);
  assert.equal((await s.call('DELETE', `/customers/${c.id}`)).status, 409);
});

test('full server serves the UI and enforces APP_PASSWORD', async (t) => {
  const { server } = createServer({ password: 'secret' });
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/')).status, 401);
  const auth = { Authorization: 'Basic ' + Buffer.from('shop:secret').toString('base64') };
  const page = await fetch(base + '/', { headers: auth });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Dry Cleaner CRM/);
  const svc = await fetch(base + '/api/services', { headers: auth });
  assert.ok((await svc.json()).length > 0);
  // Path traversal must never expose files outside public/.
  const raw = await new Promise((resolve) => {
    require('node:http').get(
      { port: server.address().port, path: '/%2e%2e/server.js', headers: auth },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve(b)); }
    );
  });
  assert.doesNotMatch(raw, /createServer/);
});
