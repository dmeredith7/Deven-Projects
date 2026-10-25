'use strict';

// Creates a demo shop with sample customers and orders so the app can be
// tried right away. Safe to run more than once.
//   Log in with demo@example.com / demo1234

const path = require('node:path');
const db_ = require('../src/db');
const { hashPassword } = require('../src/auth');
const orders = require('../src/orders');

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo1234';

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'crm.db');
const db = db_.open(dbPath);

if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(DEMO_EMAIL)) {
  console.log(`Demo shop already exists. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

const shopId = db_.createShop(db, 'Sparkle Dry Cleaners (Demo)');
db.prepare("INSERT INTO users (shop_id, name, email, password_hash, role) VALUES (?, 'Demo Owner', ?, ?, 'owner')").run(
  shopId, DEMO_EMAIL, hashPassword(DEMO_PASSWORD)
);
db.prepare("INSERT INTO users (shop_id, name, email, password_hash, role) VALUES (?, 'Demo Staff', 'staff@example.com', ?, 'staff')").run(
  shopId, hashPassword(DEMO_PASSWORD)
);
const set = db.prepare('UPDATE settings SET value = ? WHERE shop_id = ? AND key = ?');
set.run('(555) 010-2000', shopId, 'business_phone');
set.run('hello@sparkle.example', shopId, 'business_email');
set.run('123 Main St', shopId, 'business_address');
set.run('8.25', shopId, 'tax_rate');

const svc = Object.fromEntries(
  db.prepare('SELECT id, name FROM services WHERE shop_id = ?').all(shopId).map((s) => [s.name, s.id])
);
const addCustomer = db.prepare(
  'INSERT INTO customers (shop_id, name, phone, email, preferences, notes) VALUES (?, ?, ?, ?, ?, ?)'
);
const customer = (...a) => Number(addCustomer.run(shopId, ...a).lastInsertRowid);

const maria = customer('Maria Lopez', '+15550001111', 'maria@example.com', 'Light starch, shirts on hangers', null);
const james = customer('James Carter', '+15550002222', null, 'Boxed shirts', 'Prefers texts');
const priya = customer('Priya Shah', null, 'priya@example.com', null, null);
const tom = customer('Tom Nguyen', '+15550003333', 'tom@example.com', 'No starch', 'VIP — wedding party in June');

const make = (customerId, items, extra = {}) =>
  orders.createOrder(db, shopId, { customer_id: customerId, items, ...extra });
const setStatus = (o, status, daysAgo = 0) => {
  const at = `datetime('now', '-${daysAgo} days')`;
  const extra = status === 'ready' ? `, ready_at = ${at}` : status === 'picked_up' ? `, ready_at = ${at}, picked_up_at = ${at}` : '';
  db.prepare(`UPDATE orders SET status = ?${extra} WHERE id = ?`).run(status, o.id);
};

make(maria, [{ service_id: svc['Shirt - Launder & Press'], qty: 6 }, { service_id: svc['Pants / Slacks'], qty: 2 }], { rack: 'A-12' });
setStatus(make(james, [{ service_id: svc['Suit (2 pc)'], qty: 1 }], { notes: 'Small stain on left lapel' }), 'cleaning');
setStatus(make(priya, [{ service_id: svc['Dress'], qty: 2 }, { service_id: svc['Hem Pants'], qty: 1 }], { rack: 'B-03', paid_cents: 1000 }), 'ready', 5);
setStatus(make(tom, [{ service_id: svc['Coat / Overcoat'], qty: 1 }], { rack: 'C-07' }), 'ready', 0);
setStatus(make(maria, [{ service_id: svc['Comforter'], qty: 1 }], { paid_cents: 3789 }), 'picked_up', 10);

console.log('Demo shop created.');
console.log(`  Owner login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
console.log(`  Staff login: staff@example.com / ${DEMO_PASSWORD}`);
