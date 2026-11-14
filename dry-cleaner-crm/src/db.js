'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// Every business table carries shop_id: each dry cleaner (shop) only ever
// sees its own rows.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS shops (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  next_ticket   INTEGER NOT NULL DEFAULT 1001,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id       INTEGER NOT NULL REFERENCES shops(id),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',   -- owner | staff
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash    TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id       INTEGER NOT NULL REFERENCES shops(id),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  preferences   TEXT,             -- e.g. "light starch, boxed shirts"
  notes         TEXT,
  sms_opt_in    INTEGER NOT NULL DEFAULT 1,
  email_opt_in  INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id       INTEGER NOT NULL REFERENCES shops(id),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Dry Clean',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id          INTEGER NOT NULL REFERENCES shops(id),
  ticket           TEXT NOT NULL,
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  status           TEXT NOT NULL DEFAULT 'received',
  rack             TEXT,
  due_date         TEXT,
  notes            TEXT,
  discount_cents   INTEGER NOT NULL DEFAULT 0,
  tax_rate         REAL NOT NULL DEFAULT 0,
  paid_cents       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  ready_at         TEXT,
  picked_up_at     TEXT,
  last_reminder_at TEXT,
  reminder_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id    INTEGER REFERENCES services(id),
  description   TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id       INTEGER NOT NULL REFERENCES shops(id),
  customer_id   INTEGER REFERENCES customers(id),
  order_id      INTEGER REFERENCES orders(id),
  kind          TEXT NOT NULL,     -- ready | reminder | manual | test | reply
  channel       TEXT NOT NULL,     -- sms | email
  direction     TEXT NOT NULL DEFAULT 'out',  -- out | in
  to_addr       TEXT,
  subject       TEXT,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL,     -- sent | logged | failed | skipped | received
  error         TEXT,
  provider_id   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  key     TEXT NOT NULL,
  value   TEXT,
  PRIMARY KEY (shop_id, key)
);

CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_services_shop ON services(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_ticket ON orders(shop_id, ticket);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_shop ON messages(shop_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_addr, id);
`;

const DEFAULT_SETTINGS = {
  business_name: 'My Dry Cleaners',
  business_phone: '',
  business_email: '',
  business_address: '',
  tax_rate: '0',
  default_turnaround_days: '3',
  ticket_mode: 'auto', // auto | manual (shop types the number from its paper tickets)
  notify_sms: '1',
  notify_email: '1',
  auto_notify_ready: '1',
  reminder_after_days: '3',
  reminder_interval_days: '4',
  max_reminders: '3',
  sms_template_ready:
    'Hi {name}, your order #{ticket} at {business} is ready for pickup. Balance due: {balance}.',
  sms_template_reminder:
    'Hi {name}, friendly reminder: order #{ticket} has been ready at {business} since {ready_date}. Balance due: {balance}.',
  email_subject_ready: 'Your order #{ticket} is ready for pickup',
  email_body_ready:
    'Hi {name},\n\nGood news: your order #{ticket} ({pieces} pieces) is ready for pickup at {business}.\n\nBalance due: {balance}\n\nSee you soon!\n{business}\n{phone}',
  email_subject_reminder: 'Reminder: order #{ticket} is waiting for you',
  email_body_reminder:
    'Hi {name},\n\nJust a friendly reminder that your order #{ticket} has been ready at {business} since {ready_date}.\n\nBalance due: {balance}\n\nThank you!\n{business}\n{phone}',
};

const DEFAULT_SERVICES = [
  ['Shirt - Launder & Press', 'Laundry', 350],
  ['Pants / Slacks', 'Dry Clean', 750],
  ['Suit (2 pc)', 'Dry Clean', 1600],
  ['Blazer / Jacket', 'Dry Clean', 900],
  ['Dress', 'Dry Clean', 1400],
  ['Skirt', 'Dry Clean', 750],
  ['Sweater', 'Dry Clean', 800],
  ['Coat / Overcoat', 'Dry Clean', 2200],
  ['Comforter', 'Household', 3500],
  ['Hem Pants', 'Alterations', 1200],
  ['Wash & Fold (per lb)', 'Laundry', 200],
];

function open(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const cols = db.prepare("SELECT name FROM pragma_table_info('customers')").all();
  if (cols.length && !cols.some((c) => c.name === 'shop_id')) {
    throw new Error(
      `${dbPath} was created by the single-shop version. Move it aside (or delete it) and restart to create a new multi-shop database.`
    );
  }
  dropTicketUniqueness(db);
  db.exec(SCHEMA);
  return db;
}

// Early databases made ticket numbers unique per shop forever. Paper ticket
// books repeat, so uniqueness is now only enforced among unfinished orders
// (in orders.js). SQLite can't drop a table constraint, so rebuild the table.
function dropTicketUniqueness(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'").get();
  const unique = /,\s*UNIQUE\s*\(\s*shop_id\s*,\s*ticket\s*\)/i;
  if (!row || !unique.test(row.sql)) return;
  // Foreign keys must be off, or dropping the old table would cascade-delete order items.
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(row.sql.replace(unique, '').replace(/CREATE TABLE\s+"?orders"?/i, 'CREATE TABLE orders_new'));
    db.exec('INSERT INTO orders_new SELECT * FROM orders');
    db.exec('DROP TABLE orders');
    db.exec('ALTER TABLE orders_new RENAME TO orders');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

// A per-install secret used to sign unsubscribe links. Generated once.
function secret(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'secret'").get();
  if (row) return row.value;
  const value = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO meta (key, value) VALUES ('secret', ?)").run(value);
  return value;
}

function createShop(db, name, overrides = {}) {
  const r = db.prepare('INSERT INTO shops (name) VALUES (?)').run(name);
  const shopId = Number(r.lastInsertRowid);
  const insSetting = db.prepare('INSERT INTO settings (shop_id, key, value) VALUES (?, ?, ?)');
  for (const [k, v] of Object.entries({ ...DEFAULT_SETTINGS, ...overrides, business_name: name })) insSetting.run(shopId, k, v);
  const ins = db.prepare('INSERT INTO services (shop_id, name, category, price_cents) VALUES (?, ?, ?, ?)');
  for (const s of DEFAULT_SERVICES) ins.run(shopId, ...s);
  return shopId;
}

function getSettings(db, shopId) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key, value FROM settings WHERE shop_id = ?').all(shopId)) out[r.key] = r.value;
  return out;
}

module.exports = { open, secret, createShop, getSettings, DEFAULT_SETTINGS, DEFAULT_SERVICES };
