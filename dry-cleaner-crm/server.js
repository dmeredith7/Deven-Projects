'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const db_ = require('./src/db');
const { createNotifier } = require('./src/notify');
const { createApi } = require('./src/api');
const { startScheduler } = require('./src/reminders');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// Optional shared password (HTTP Basic auth, any username) via APP_PASSWORD.
function authorized(req, password) {
  if (!password) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const pass = Buffer.from(m[1], 'base64').toString('utf8').split(':').slice(1).join(':');
  const a = Buffer.from(pass);
  const b = Buffer.from(password);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) {
      // Unknown non-asset paths fall back to the single-page app.
      if (!path.extname(rel)) return serveStatic(res, '/');
      return send(res, 404, { error: 'Not found' });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

function createServer({ dbPath = ':memory:', db, notifier, password = process.env.APP_PASSWORD } = {}) {
  db = db || db_.open(dbPath);
  notifier = notifier || createNotifier(db);
  const api = createApi(db, notifier);

  const server = http.createServer(async (req, res) => {
    if (!authorized(req, password)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Dry Cleaner CRM"' });
      return res.end('Authentication required');
    }
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);
    try {
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const data = await api(req.method, url.pathname, url.searchParams, body);
      send(res, 200, data);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      send(res, status, { error: status === 500 ? 'Internal server error' : e.message });
    }
  });
  return { server, db, notifier };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'crm.db');
  const { server, db, notifier } = createServer({ dbPath });
  startScheduler(db, notifier, {
    intervalMs: (Number(process.env.REMINDER_CHECK_MINUTES) || 15) * 60 * 1000,
  });
  server.listen(port, () => {
    console.log(`Dry Cleaner CRM running at http://localhost:${port}`);
    console.log(`Database: ${dbPath}`);
    console.log(
      notifier.mode === 'sms'
        ? 'SMS: Twilio enabled'
        : 'SMS: not configured — messages are logged only (set TWILIO_* env vars to send texts)'
    );
  });
}
