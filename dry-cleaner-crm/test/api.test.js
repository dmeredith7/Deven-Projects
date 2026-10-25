'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');
const { runReminders } = require('../src/reminders');

test('order lifecycle: create, ready notice by text and email, payment, pickup', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop('Sparkle');

  const { data: cust } = await a.call('POST', '/api/customers', { name: 'Jane Doe', phone: '(555) 123-4567', email: 'jane@example.com' });
  assert.equal(cust.phone, '+15551234567');
  const { data: services } = await a.call('GET', '/api/services');
  const shirt = services.find((x) => x.name.startsWith('Shirt'));

  await a.call('PUT', '/api/settings', { tax_rate: '10', business_email: 'front@sparkle.example' });
  const { status, data: order } = await a.call('POST', '/api/orders', {
    customer_id: cust.id,
    items: [{ service_id: shirt.id, qty: 4 }, { description: 'Silk scarf', price_cents: 1000 }],
    discount_cents: 400,
  });
  assert.equal(status, 200);
  assert.equal(order.ticket, '1001');
  const taxable = 4 * shirt.price_cents + 1000 - 400;
  assert.equal(order.total_cents, taxable + Math.round(taxable * 0.1));

  const ready = await a.call('POST', `/api/orders/${order.id}/status`, { status: 'ready' });
  assert.deepEqual(ready.data.messages.map((m) => [m.channel, m.status]), [['sms', 'sent'], ['email', 'sent']]);
  assert.equal(s.sent.sms[0].to, '+15551234567');
  assert.match(s.sent.sms[0].body, /Hi Jane, your order #1001 .* is ready/);
  assert.match(s.sent.sms[0].body, /Reply STOP to opt out\.$/);
  const mail = s.sent.email[0];
  assert.equal(mail.to, 'jane@example.com');
  assert.equal(mail.subject, 'Your order #1001 is ready for pickup');
  assert.equal(mail.replyTo, 'front@sparkle.example');
  assert.match(mail.fromName, /Sparkle/);
  assert.match(mail.html, /Unsubscribe from email updates/);
  assert.match(mail.headers['List-Unsubscribe'], /^<https:\/\/crm\.example\.com\/unsubscribe\?c=\d+&t=/);

  const paid = await a.call('POST', `/api/orders/${order.id}/payment`, { amount_cents: order.total_cents });
  assert.equal(paid.data.balance_cents, 0);
  const done = await a.call('POST', `/api/orders/${order.id}/status`, { status: 'picked_up' });
  assert.ok(done.data.order.picked_up_at);

  const { data: dash } = await a.call('GET', '/api/dashboard');
  assert.equal(dash.by_status.picked_up, 1);
  assert.equal(dash.orders_today, 1);
});

test('every API route requires login', async (t) => {
  const s = await start();
  t.after(s.close);
  const anon = s.client();
  for (const [m, p] of [['GET', '/api/me'], ['GET', '/api/orders'], ['GET', '/api/customers'], ['POST', '/api/orders'], ['GET', '/api/settings'], ['POST', '/api/reminders/run']]) {
    assert.equal((await anon.call(m, p, m === 'GET' ? undefined : {})).status, 401, `${m} ${p}`);
  }
});

test('signup, logout, login, wrong password, duplicate email', async (t) => {
  const s = await start();
  t.after(s.close);
  const c = s.client();
  const signup = await c.call('POST', '/api/auth/signup', { shop_name: 'Fresh Press', name: 'Ana', email: 'Ana@Example.com', password: 'longenough' });
  assert.equal(signup.status, 200);
  assert.match(signup.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.match(signup.headers.get('set-cookie'), /Secure/);
  assert.equal((await c.call('GET', '/api/me')).data.shop.name, 'Fresh Press');

  await c.call('POST', '/api/auth/logout');
  assert.equal((await c.call('GET', '/api/me')).status, 401);

  assert.equal((await c.call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'wrong-password' })).status, 401);
  assert.equal((await c.call('POST', '/api/auth/login', { email: 'ana@example.com', password: 'longenough' })).status, 200);
  assert.equal((await c.call('GET', '/api/me')).data.user.role, 'owner');

  const dup = await s.client().call('POST', '/api/auth/signup', { shop_name: 'X', name: 'Y', email: 'ana@example.com', password: 'longenough' });
  assert.equal(dup.status, 409);
  const short = await s.client().call('POST', '/api/auth/signup', { shop_name: 'X', name: 'Y', email: 'b@example.com', password: 'short' });
  assert.equal(short.status, 400);
});

test('login is rate limited after repeated failures', async (t) => {
  const s = await start();
  t.after(s.close);
  const c = s.client();
  let last;
  for (let i = 0; i < 11; i++) last = await c.call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'nope-nope' });
  assert.equal(last.status, 429);
});

test("shops cannot see or touch each other's data", async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop('A');
  const b = await s.shop('B');
  const { data: cust } = await a.call('POST', '/api/customers', { name: 'Private Person', phone: '5550001111' });
  const { data: svc } = await a.call('POST', '/api/services', { name: 'Gown', price_cents: 9900 });
  const { data: order } = await a.call('POST', '/api/orders', { customer_id: cust.id, items: [{ description: 'Coat', price_cents: 100 }] });

  assert.equal((await b.call('GET', '/api/customers')).data.length, 0);
  assert.equal((await b.call('GET', '/api/orders')).data.length, 0);
  assert.equal((await b.call('GET', `/api/customers/${cust.id}`)).status, 404);
  assert.equal((await b.call('PUT', `/api/customers/${cust.id}`, { name: 'Hacked' })).status, 404);
  assert.equal((await b.call('GET', `/api/orders/${order.id}`)).status, 404);
  assert.equal((await b.call('POST', `/api/orders/${order.id}/status`, { status: 'ready' })).status, 404);
  assert.equal((await b.call('POST', `/api/orders/${order.id}/payment`, { amount_cents: 100 })).status, 404);
  assert.equal((await b.call('POST', `/api/customers/${cust.id}/message`, { body: 'hi' })).status, 404);
  assert.equal((await b.call('PUT', `/api/services/${svc.id}`, { price_cents: 1 })).status, 404);
  // Can't attach another shop's customer or service to an order.
  assert.equal((await b.call('POST', '/api/orders', { customer_id: cust.id, items: [{ description: 'x' }] })).status, 400);
  const { data: bc } = await b.call('POST', '/api/customers', { name: 'B customer' });
  assert.equal((await b.call('POST', '/api/orders', { customer_id: bc.id, items: [{ service_id: svc.id }] })).status, 400);
  // Ticket numbers are per shop.
  const { data: bo } = await b.call('POST', '/api/orders', { customer_id: bc.id, items: [{ description: 'Tie', price_cents: 500 }] });
  assert.equal(bo.ticket, '1001');
  assert.equal((await a.call('GET', `/api/customers/${cust.id}`)).data.name, 'Private Person');
});

test('staff can work orders but only owners change settings, prices and team', async (t) => {
  const s = await start();
  t.after(s.close);
  const owner = await s.shop();
  const add = await owner.call('POST', '/api/team', { name: 'Sam', email: 'sam@example.com', password: 'temp-pass-1', role: 'staff' });
  assert.equal(add.status, 200);
  const staff = s.client();
  assert.equal((await staff.call('POST', '/api/auth/login', { email: 'sam@example.com', password: 'temp-pass-1' })).status, 200);

  const { data: c } = await staff.call('POST', '/api/customers', { name: 'Walk In' });
  assert.equal((await staff.call('POST', '/api/orders', { customer_id: c.id, items: [{ description: 'Suit', price_cents: 1600 }] })).status, 200);
  assert.equal((await staff.call('PUT', '/api/settings', { tax_rate: '50' })).status, 403);
  assert.equal((await staff.call('POST', '/api/services', { name: 'x' })).status, 403);
  assert.equal((await staff.call('POST', '/api/team', { name: 'x', email: 'x@example.com', password: 'whatever12' })).status, 403);

  assert.equal((await owner.call('DELETE', `/api/team/${owner.user.id}`)).status, 400);
  assert.equal((await owner.call('DELETE', `/api/team/${add.data.id}`)).status, 200);
  assert.equal((await staff.call('GET', '/api/me')).status, 401); // removed user is logged out
});

test('respects opt-outs, missing contact details and shop channel switches', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const order = async (customer) => {
    const { data: c } = await a.call('POST', '/api/customers', customer);
    const { data: o } = await a.call('POST', '/api/orders', { customer_id: c.id, items: [{ description: 'Coat', price_cents: 2000 }] });
    return (await a.call('POST', `/api/orders/${o.id}/status`, { status: 'ready' })).data.messages;
  };

  assert.deepEqual((await order({ name: 'Nobody' })).map((m) => m.status), ['skipped']);
  assert.deepEqual((await order({ name: 'Email only', email: 'e@example.com' })).map((m) => [m.channel, m.status]), [['email', 'sent']]);
  assert.deepEqual(
    (await order({ name: 'Opted out', phone: '5551112222', email: 'o@example.com', sms_opt_in: false, email_opt_in: false })).map((m) => m.status),
    ['skipped', 'skipped']
  );
  await a.call('PUT', '/api/settings', { notify_email: '0' });
  const m = await order({ name: 'Both', phone: '5553334444', email: 'b@example.com' });
  assert.deepEqual(m.map((x) => [x.channel, x.status]), [['sms', 'sent'], ['email', 'skipped']]);
  assert.equal(s.sent.email.length, 1);
  assert.equal(s.sent.sms.length, 1);
});

test('without providers, messages are logged; provider errors are recorded as failed', async (t) => {
  const s = await start({ sms: false, email: false });
  t.after(s.close);
  const a = await s.shop();
  const { data: c } = await a.call('POST', '/api/customers', { name: 'Al', phone: '5550001234', email: 'al@example.com' });
  const r = await a.call('POST', `/api/customers/${c.id}/message`, { body: 'hi', channels: ['sms', 'email'] });
  assert.deepEqual(r.data.map((m) => m.status), ['logged', 'logged']);
  assert.deepEqual((await a.call('GET', '/api/settings')).data.channels, { sms: 'log', email: 'log' });

  const s2 = await start();
  t.after(s2.close);
  const b = await s2.shop();
  s2.fail.sms = true;
  const { data: c2 } = await b.call('POST', '/api/customers', { name: 'Bo', phone: '5550001234' });
  const r2 = await b.call('POST', `/api/customers/${c2.id}/message`, { body: 'hi', channels: ['sms'] });
  assert.equal(r2.data[0].status, 'failed');
  assert.match(r2.data[0].error, /carrier rejected/);
  const log = (await b.call('GET', '/api/messages?channel=sms')).data;
  assert.equal(log[0].status, 'failed');
});

test('pickup reminders follow after/interval/max settings for each shop', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const b = await s.shop();
  await a.call('PUT', '/api/settings', { reminder_after_days: '3', reminder_interval_days: '2', max_reminders: '2', auto_notify_ready: '0' });
  await b.call('PUT', '/api/settings', { max_reminders: '0', auto_notify_ready: '0' });
  const mk = async (shop) => {
    const { data: c } = await shop.call('POST', '/api/customers', { name: 'Rita', phone: '5551230000', email: 'rita@example.com' });
    const { data: o } = await shop.call('POST', '/api/orders', { customer_id: c.id, items: [{ description: 'Dress', price_cents: 1400 }] });
    await shop.call('POST', `/api/orders/${o.id}/status`, { status: 'ready' });
    s.db.prepare("UPDATE orders SET ready_at = '2026-01-01 09:00:00' WHERE id = ?").run(o.id);
    return o;
  };
  const oa = await mk(a);
  await mk(b); // reminders off for shop b

  const run = async (d) => (await runReminders(s.db, s.notifier, { now: new Date(`2026-01-${d}T10:00:00Z`) })).length;
  assert.equal(await run('02'), 0); // too early
  assert.equal(await run('04'), 1); // first
  assert.equal(await run('05'), 0); // within interval
  assert.equal(await run('06'), 1); // second
  assert.equal(await run('20'), 0); // max reached
  assert.equal(s.sent.sms.length, 2);
  assert.equal(s.sent.email.length, 2);
  assert.match(s.sent.sms[0].body, /reminder/);
  assert.match(s.sent.email[0].subject, /^Reminder: order #1001/);

  await a.call('POST', `/api/orders/${oa.id}/status`, { status: 'picked_up' });
  s.db.prepare('UPDATE orders SET reminder_count = 0 WHERE id = ?').run(oa.id);
  assert.equal(await run('25'), 0); // picked-up orders never get reminders
});

test('test-message endpoint sends to the given phone/email', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const sms = await a.call('POST', '/api/settings/test-message', { channel: 'sms', to: '555-867-5309' });
  assert.equal(sms.data.status, 'sent');
  assert.equal(s.sent.sms[0].to, '+15558675309');
  const em = await a.call('POST', '/api/settings/test-message', { channel: 'email', to: 'me@example.com' });
  assert.equal(em.data.status, 'sent');
  assert.equal((await a.call('POST', '/api/settings/test-message', { channel: 'email', to: 'nope' })).status, 400);
});

test('email unsubscribe link requires a valid token and a button press', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const { data: c } = await a.call('POST', '/api/customers', { name: 'Uma', email: 'uma@example.com' });
  await a.call('POST', `/api/customers/${c.id}/message`, { body: 'hello', channels: ['email'] });
  const link = s.sent.email[0].headers['List-Unsubscribe'].slice(1, -1).replace('https://crm.example.com', s.base);

  const bad = await fetch(link.replace(/t=[^&]+/, 't=forged'));
  assert.equal(bad.status, 400);
  const page = await fetch(link);
  assert.match(await page.text(), /<form method="post">/);
  assert.equal((await a.call('GET', `/api/customers/${c.id}`)).data.email_opt_in, 1); // GET alone doesn't unsubscribe
  const post = await fetch(link, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  assert.match(await post.text(), /unsubscribed/);
  assert.equal((await a.call('GET', `/api/customers/${c.id}`)).data.email_opt_in, 0);
});

test('Twilio webhook: STOP/START and replies, with signature check', async (t) => {
  const crypto = require('node:crypto');
  const env = { TWILIO_AUTH_TOKEN: 'tw-secret' };
  const s = await start({ env });
  t.after(s.close);
  const a = await s.shop();
  const { data: c } = await a.call('POST', '/api/customers', { name: 'Tia', phone: '5552223333' });
  await a.call('POST', `/api/customers/${c.id}/message`, { body: 'Your order is ready', channels: ['sms'] });

  const hook = async (params, { sign = true } = {}) => {
    const url = 'https://crm.example.com/webhooks/twilio/sms';
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    const sig = crypto.createHmac('sha1', env.TWILIO_AUTH_TOKEN).update(data).digest('base64');
    return fetch(s.base + '/webhooks/twilio/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sign ? sig : 'bad' },
      body: new URLSearchParams(params),
    });
  };

  assert.equal((await hook({ From: '+15552223333', Body: 'STOP' }, { sign: false })).status, 403);
  assert.equal((await a.call('GET', `/api/customers/${c.id}`)).data.sms_opt_in, 1);

  assert.equal((await hook({ From: '+15552223333', Body: 'Stop' })).status, 200);
  assert.equal((await a.call('GET', `/api/customers/${c.id}`)).data.sms_opt_in, 0);
  await hook({ From: '+15552223333', Body: 'START' });
  assert.equal((await a.call('GET', `/api/customers/${c.id}`)).data.sms_opt_in, 1);

  await hook({ From: '+15552223333', Body: 'Can I pick up at 6?' });
  const msgs = (await a.call('GET', '/api/messages')).data;
  const reply = msgs.find((m) => m.body === 'Can I pick up at 6?');
  assert.equal(reply.direction, 'in');
  assert.equal(reply.customer_id, c.id);
});

test('forgot / reset password flow', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const email = (await a.call('GET', '/api/me')).data.user.email;

  const unknown = await s.client().call('POST', '/api/auth/forgot', { email: 'ghost@example.com' });
  assert.deepEqual(unknown.data, { ok: true });
  assert.equal(s.sent.email.length, 0);

  await s.client().call('POST', '/api/auth/forgot', { email });
  assert.equal(s.sent.email.length, 1);
  const token = s.sent.email[0].text.match(/#reset=([\w-]+)/)[1];

  const c = s.client();
  assert.equal((await c.call('POST', '/api/auth/reset', { token: 'wrong', password: 'brand-new-pw' })).status, 400);
  assert.equal((await c.call('POST', '/api/auth/reset', { token, password: 'brand-new-pw' })).status, 200);
  assert.equal((await c.call('GET', '/api/me')).status, 200);
  assert.equal((await a.call('GET', '/api/me')).status, 401); // old sessions revoked
  assert.equal((await c.call('POST', '/api/auth/reset', { token, password: 'again-again' })).status, 400); // single use
  assert.equal((await s.client().call('POST', '/api/auth/login', { email, password: 'brand-new-pw' })).status, 200);
});

test('cross-site writes are blocked; static files are safe', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const r = await a.call('POST', '/api/customers', { name: 'Evil' }, { Origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  assert.equal((await a.call('GET', '/api/customers')).data.length, 0);

  const login = await fetch(s.base + '/login.html');
  assert.match(await login.text(), /Log in/);
  const raw = await new Promise((resolve) => {
    require('node:http').get(s.base + '/%2e%2e/server.js', (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve(b));
    });
  });
  assert.doesNotMatch(raw, /createServer/);
});
