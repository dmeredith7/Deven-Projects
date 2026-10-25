'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { start } = require('./helpers');
const db_ = require('../src/db');

async function paperShop(s) {
  const a = await s.shop();
  await a.call('PUT', '/api/settings', { ticket_mode: 'manual', auto_notify_ready: '0' });
  const { data: c } = await a.call('POST', '/api/customers', { name: 'Maria Lopez' });
  const { data: c2 } = await a.call('POST', '/api/customers', { name: 'James Carter' });
  const order = (ticket, customer = c) =>
    a.call('POST', '/api/orders', { customer_id: customer.id, ticket, items: [{ description: 'Shirt', price_cents: 350 }] });
  return { a, c, c2, order };
}

test('signup can choose paper tickets', async (t) => {
  const s = await start();
  t.after(s.close);
  const c = s.client();
  await c.call('POST', '/api/auth/signup', { shop_name: 'Paper Co', name: 'P', email: 'p@example.com', password: 'longenough', ticket_mode: 'manual' });
  assert.equal((await c.call('GET', '/api/settings')).data.ticket_mode, 'manual');
  const d = s.client();
  await d.call('POST', '/api/auth/signup', { shop_name: 'Auto Co', name: 'A', email: 'a@example.com', password: 'longenough' });
  assert.equal((await d.call('GET', '/api/settings')).data.ticket_mode, 'auto');
  assert.equal((await d.call('PUT', '/api/settings', { ticket_mode: 'sometimes' })).status, 400);
});

test('paper ticket mode requires a number and cleans up what staff type', async (t) => {
  const s = await start();
  t.after(s.close);
  const { order } = await paperShop(s);
  assert.equal((await order('')).status, 400);
  assert.equal((await order('12 34!')).status, 400);
  assert.equal((await order('x'.repeat(21))).status, 400);
  const r = await order(' #a 1042 ');
  assert.equal(r.status, 200);
  assert.equal(r.data.ticket, 'A1042');
});

test('a ticket number can only be on one unfinished order at a time', async (t) => {
  const s = await start();
  t.after(s.close);
  const { a, c2, order } = await paperShop(s);
  const first = (await order('500')).data;
  const dup = await order('500', c2);
  assert.equal(dup.status, 409);
  assert.match(dup.data.error, /#500 is already on an active order for Maria Lopez/);

  // Once picked up, the paper ticket can be reused.
  await a.call('POST', `/api/orders/${first.id}/status`, { status: 'picked_up' });
  const reused = await order('500', c2);
  assert.equal(reused.status, 200);

  // Reopening the old order would put two active orders on #500.
  const reopen = await a.call('POST', `/api/orders/${first.id}/status`, { status: 'ready' });
  assert.equal(reopen.status, 409);
  // Search finds both, newest first.
  const found = (await a.call('GET', '/api/orders?q=500')).data;
  assert.deepEqual(found.map((o) => o.id), [reused.data.id, first.id]);
});

test('ticket numbers can be corrected on an order', async (t) => {
  const s = await start();
  t.after(s.close);
  const { a, order } = await paperShop(s);
  const o1 = (await order('700')).data;
  const o2 = (await order('701')).data;
  assert.equal((await a.call('PUT', `/api/orders/${o2.id}`, { ticket: '700' })).status, 409);
  const fixed = await a.call('PUT', `/api/orders/${o2.id}`, { ticket: '710' });
  assert.equal(fixed.data.ticket, '710');
  assert.equal((await a.call('PUT', `/api/orders/${o1.id}`, { ticket: '' })).status, 400);
});

test('automatic numbering skips numbers typed by hand that are still active', async (t) => {
  const s = await start();
  t.after(s.close);
  const a = await s.shop();
  const { data: c } = await a.call('POST', '/api/customers', { name: 'Al' });
  const mk = (ticket) => a.call('POST', '/api/orders', { customer_id: c.id, ticket, items: [{ description: 'Tie', price_cents: 500 }] });
  assert.equal((await mk()).data.ticket, '1001');
  assert.equal((await mk('1002')).data.ticket, '1002'); // typed in an auto-numbered shop
  assert.equal((await mk()).data.ticket, '1003');
});

test('upgrading an old database removes the forever-unique ticket rule and keeps data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-'));
  const file = path.join(dir, 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id INTEGER NOT NULL, ticket TEXT NOT NULL,
      customer_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'received', rack TEXT, due_date TEXT, notes TEXT,
      discount_cents INTEGER NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0, paid_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), ready_at TEXT, picked_up_at TEXT, last_reminder_at TEXT,
      reminder_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE (shop_id, ticket)
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      service_id INTEGER, description TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, price_cents INTEGER NOT NULL DEFAULT 0, notes TEXT
    );
    INSERT INTO orders (shop_id, ticket, customer_id, status) VALUES (1, '1001', 1, 'picked_up');
    INSERT INTO order_items (order_id, description, qty, price_cents) VALUES (1, 'Suit', 1, 1600);
  `);
  old.close();

  const db = db_.open(file);
  assert.doesNotMatch(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'orders'").get().sql, /UNIQUE/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n, 1); // items survived the rebuild
  db.prepare("INSERT INTO orders (shop_id, ticket, customer_id) VALUES (1, '1001', 1)").run(); // reuse now allowed
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders WHERE ticket = '1001'").get().n, 2);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  db.close();
  db_.open(file).close(); // second open is a no-op
  fs.rmSync(dir, { recursive: true });
});
