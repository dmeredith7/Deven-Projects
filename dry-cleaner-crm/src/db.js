'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  preferences   TEXT,             -- e.g. "light starch, boxed shirts"
  notes         TEXT,
  sms_opt_in    INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Dry Clean',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket           TEXT UNIQUE,
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
  customer_id   INTEGER REFERENCES customers(id),
  order_id      INTEGER REFERENCES orders(id),
  kind          TEXT NOT NULL,     -- ready | reminder | manual
  channel       TEXT NOT NULL,     -- sms | log
  to_addr       TEXT,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL,     -- sent | logged | failed | skipped
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`;

const DEFAULT_SETTINGS = {
  business_name: 'My Dry Cleaners',
  business_phone: '',
  tax_rate: '0',
  default_turnaround_days: '3',
  auto_notify_ready: '1',
  reminder_after_days: '3',
  reminder_interval_days: '4',
  max_reminders: '3',
  template_ready:
    'Hi {name}, your order #{ticket} at {business} is ready for pickup. Balance due: {balance}.',
  template_reminder:
    'Hi {name}, friendly reminder: order #{ticket} has been ready at {business} since {ready_date}. Balance due: {balance}.',
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
  db.exec(SCHEMA);

  const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

  if (db.prepare('SELECT COUNT(*) AS n FROM services').get().n === 0) {
    const ins = db.prepare('INSERT INTO services (name, category, price_cents) VALUES (?, ?, ?)');
    for (const s of DEFAULT_SERVICES) ins.run(...s);
  }
  return db;
}

function getSettings(db) {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

module.exports = { open, getSettings, DEFAULT_SETTINGS };
