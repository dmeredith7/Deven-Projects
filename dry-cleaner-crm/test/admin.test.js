'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

const ADMIN = { ADMIN_EMAIL: 'Deven@Example.com', ADMIN_PASSWORD: 'correct-horse-battery' };
const creds = { email: 'deven@example.com', password: ADMIN.ADMIN_PASSWORD };

async function adminClient(s) {
  const c = s.client();
  const r = await c.call('POST', '/api/admin/login', creds);
  assert.equal(r.status, 200);
  return c;
}

test('admin is off until ADMIN_EMAIL and a long-enough ADMIN_PASSWORD are set', async (t) => {
  for (const env of [{}, { ADMIN_EMAIL: 'a@example.com', ADMIN_PASSWORD: 'short' }]) {
    const s = await start({ env });
    t.after(s.close);
    const r = await s.client().call('POST', '/api/admin/login', { email: 'a@example.com', password: 'short' });
    assert.equal(r.status, 503);
    assert.match(r.data.error, /ADMIN_EMAIL/);
  }
});

test('admin login: wrong password refused, right one works, logout ends it', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const c = s.client();
  assert.equal((await c.call('GET', '/api/admin/overview')).status, 401);
  assert.equal((await c.call('POST', '/api/admin/login', { ...creds, password: 'nope-nope-nope' })).status, 401);
  const ok = await c.call('POST', '/api/admin/login', creds);
  assert.equal(ok.status, 200);
  const cookie = ok.headers.getSetCookie()[0];
  assert.match(cookie, /^asid=.+HttpOnly; SameSite=Strict/);
  assert.equal((await c.call('GET', '/api/admin/me')).data.email, 'deven@example.com');
  await c.call('POST', '/api/admin/logout');
  assert.equal((await c.call('GET', '/api/admin/me')).status, 401);
});

test('admin login is rate limited', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const c = s.client();
  let last;
  for (let i = 0; i < 11; i++) last = await c.call('POST', '/api/admin/login', { ...creds, password: 'wrong-' + i });
  assert.equal(last.status, 429);
});

test('the normal login form accepts the admin login and opens admin', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const c = s.client();
  const r = await c.call('POST', '/api/auth/login', creds);
  assert.deepEqual(r.data, { admin: true });
  assert.ok(c.jar.has('asid'));
  assert.ok(!c.jar.has('sid'));
  assert.equal((await c.call('GET', '/api/admin/me')).status, 200);
});

test('shop logins and admin logins are kept apart', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const shop = await s.shop();
  for (const p of ['/api/admin/me', '/api/admin/overview', '/api/admin/shops/1']) {
    assert.equal((await shop.call('GET', p)).status, 401, p);
  }
  assert.equal((await shop.call('POST', '/api/admin/shops/1/view')).status, 401);
  const a = await adminClient(s);
  assert.equal((await a.call('GET', '/api/orders')).status, 401); // admin isn't a shop user
  // Another site can't use an admin's browser to act.
  const x = await a.call('POST', '/api/admin/shops/1/view', null, { Origin: 'https://evil.example' });
  assert.equal(x.status, 403);
});

test('overview totals and per-partner numbers', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const a1 = await s.shop('Busy');
  await a1.call('PUT', '/api/settings', { tax_rate: '10', auto_notify_ready: '1' });
  const { data: c1 } = await a1.call('POST', '/api/customers', { name: 'Ann', phone: '5550001111' });
  const { data: o1 } = await a1.call('POST', '/api/orders', { customer_id: c1.id, items: [{ description: 'Suit', price_cents: 2000 }] });
  await a1.call('POST', '/api/orders', { customer_id: c1.id, items: [{ description: 'Shirt', price_cents: 500, qty: 2 }] });
  const { data: cancelled } = await a1.call('POST', '/api/orders', { customer_id: c1.id, items: [{ description: 'Coat', price_cents: 9900 }] });
  await a1.call('POST', `/api/orders/${cancelled.id}/status`, { status: 'cancelled' });
  await a1.call('POST', `/api/orders/${o1.id}/status`, { status: 'ready' }); // sends a text
  await s.shop('Quiet');

  const a = await adminClient(s);
  const { data } = await a.call('GET', '/api/admin/overview');
  assert.equal(data.totals.shops, 2);
  assert.equal(data.totals.new_shops_30d, 2);
  assert.equal(data.totals.active_shops, 1);
  assert.equal(data.totals.orders, 3);
  assert.equal(data.totals.customers, 1);
  assert.equal(data.totals.active_orders, 2);
  assert.equal(data.totals.sales_cents, 2200 + 1100); // cancelled order excluded; 10% tax included
  assert.equal(data.totals.texts_30d, 1);
  const busy = data.shops.find((p) => p.name.startsWith('Busy'));
  const quiet = data.shops.find((p) => p.name.startsWith('Quiet'));
  assert.equal(busy.status, 'active');
  assert.equal(quiet.status, 'new');
  assert.equal(busy.orders_30d, 3);
  assert.equal(busy.sales_30d_cents, 3300);
  assert.equal(busy.owner.name, 'Owner');
  assert.equal(quiet.orders, 0);

  // An older shop with no recent orders shows as quiet.
  s.db.prepare("UPDATE shops SET created_at = datetime('now', '-60 days') WHERE id = ?").run(quiet.id);
  const again = (await a.call('GET', '/api/admin/overview')).data.shops.find((p) => p.id === quiet.id);
  assert.equal(again.status, 'quiet');
});

test('one partner in detail', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const shop = await s.shop('Detail');
  await shop.call('PUT', '/api/settings', { business_phone: '555-1000', ticket_mode: 'manual' });
  await shop.call('POST', '/api/team', { name: 'Sam', email: 'sam@example.com', password: 'temp-pass-1' });
  const { data: c } = await shop.call('POST', '/api/customers', { name: 'Bo' });
  await shop.call('POST', '/api/orders', { customer_id: c.id, ticket: 'A1', items: [{ description: 'Dress', price_cents: 1400 }] });

  const a = await adminClient(s);
  const { data } = await a.call('GET', `/api/admin/shops/${shop.user.shop_id}`);
  assert.match(data.name, /^Detail/);
  assert.equal(data.settings.business_phone, '555-1000');
  assert.equal(data.settings.ticket_mode, 'manual');
  assert.deepEqual(data.team.map((u) => u.role).sort(), ['owner', 'staff']);
  assert.equal(data.recent_orders[0].ticket, 'A1');
  assert.equal(data.stats.customers, 1);
  assert.equal((await a.call('GET', '/api/admin/shops/999')).status, 404);
});

test('"Open their app" signs the admin in as the shop owner for 2 hours', async (t) => {
  const s = await start({ env: ADMIN });
  t.after(s.close);
  const shop = await s.shop('Support');
  const a = await adminClient(s);
  const r = await a.call('POST', `/api/admin/shops/${shop.user.shop_id}/view`);
  assert.equal(r.status, 200);
  assert.match(r.headers.getSetCookie()[0], /^sid=.+Max-Age=7200/);
  const me = (await a.call('GET', '/api/me')).data;
  assert.equal(me.impersonating, true);
  assert.equal(me.shop.id, shop.user.shop_id);
  assert.equal(me.user.role, 'owner');
  // The owner's own session isn't marked.
  assert.equal((await shop.call('GET', '/api/me')).data.impersonating, false);
  const row = s.db.prepare('SELECT expires_at FROM sessions WHERE impersonated = 1').get();
  const hours = (new Date(row.expires_at) - Date.now()) / 36e5;
  assert.ok(hours > 1.9 && hours <= 2, `expires in ${hours}h`);
  // Leaving the shop app keeps the admin login.
  await a.call('POST', '/api/auth/logout');
  assert.equal((await a.call('GET', '/api/me')).status, 401);
  assert.equal((await a.call('GET', '/api/admin/me')).status, 200);
});

test('existing databases get the new session column', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { DatabaseSync } = require('node:sqlite');
  const db_ = require('../src/db');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-'));
  const file = path.join(dir, 'old.db');
  const old = new DatabaseSync(file);
  old.exec('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL)');
  old.exec("INSERT INTO sessions VALUES ('h', 1, '2099-01-01')");
  old.close();
  const db = db_.open(file);
  assert.equal(db.prepare('SELECT impersonated FROM sessions').get().impersonated, 0);
  db.close();
  fs.rmSync(dir, { recursive: true });
});
