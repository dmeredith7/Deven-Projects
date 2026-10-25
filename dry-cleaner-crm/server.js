'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const db_ = require('./src/db');
const { createNotifier, verifyUnsubscribe, escapeHtml } = require('./src/notify');
const { createAuth, SESSION_DAYS } = require('./src/auth');
const { createApi } = require('./src/api');
const { startScheduler } = require('./src/reminders');
const { transportsFromEnv, normalizePhone, validTwilioSignature } = require('./src/channels');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']);
const START_WORDS = new Set(['START', 'YES', 'UNSTOP', 'OPTIN']);

function send(res, status, data, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

function sendHtml(res, status, title, inner) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><link rel="stylesheet" href="/styles.css"></head>
<body><main style="max-width:480px"><div class="panel" style="margin-top:40px">${inner}</div></main></body></html>`);
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
      const raw = Buffer.concat(chunks).toString('utf8');
      const type = req.headers['content-type'] || '';
      if (!raw) return resolve({});
      if (type.includes('application/x-www-form-urlencoded')) {
        return resolve(Object.fromEntries(new URLSearchParams(raw)));
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
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
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

function createServer({
  dbPath = ':memory:',
  db,
  transports = transportsFromEnv(),
  // Render sets RENDER_EXTERNAL_URL automatically (https://<name>.onrender.com).
  publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '',
  env = process.env,
} = {}) {
  db = db || db_.open(dbPath);
  const notifier = createNotifier(db, { transports, publicUrl });
  const auth = createAuth(db, notifier, { publicUrl });
  const api = createApi(db, notifier, auth);
  const secureCookie = publicUrl.startsWith('https://') || env.COOKIE_SECURE === '1';

  const sessionCookie = (token, maxAge) =>
    `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;

  const clientIp = (req) =>
    (env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) ||
    req.socket.remoteAddress ||
    '';

  // Inbound texts from Twilio: honour STOP/START and log replies for the shop
  // that most recently texted that number.
  async function twilioWebhook(req, res, url) {
    const params = await readBody(req);
    const fullUrl = publicUrl.replace(/\/+$/, '') + url.pathname + url.search;
    if (!validTwilioSignature(env.TWILIO_AUTH_TOKEN, fullUrl, params, req.headers['x-twilio-signature'])) {
      return send(res, 403, { error: 'Invalid signature' });
    }
    const from = normalizePhone(params.From);
    const body = String(params.Body || '').trim();
    const word = body.toUpperCase().replace(/[^A-Z]/g, '');
    if (from && STOP_WORDS.has(word)) db.prepare('UPDATE customers SET sms_opt_in = 0 WHERE phone = ?').run(from);
    if (from && START_WORDS.has(word)) db.prepare('UPDATE customers SET sms_opt_in = 1 WHERE phone = ?').run(from);

    const last = from
      ? db.prepare("SELECT shop_id, customer_id FROM messages WHERE to_addr = ? AND channel = 'sms' AND direction = 'out' ORDER BY id DESC LIMIT 1").get(from)
      : null;
    if (last && body) {
      db.prepare(
        `INSERT INTO messages (shop_id, customer_id, kind, channel, direction, to_addr, body, status)
         VALUES (?, ?, 'reply', 'sms', 'in', ?, ?, 'received')`
      ).run(last.shop_id, last.customer_id, from, body);
    }
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  async function unsubscribe(req, res, url) {
    const c = Number(url.searchParams.get('c'));
    const t = url.searchParams.get('t');
    const customer = c && verifyUnsubscribe(db, c, t) ? db.prepare('SELECT * FROM customers WHERE id = ?').get(c) : null;
    if (!customer) return sendHtml(res, 400, 'Invalid link', '<h1>Link not valid</h1><p>This unsubscribe link is invalid or incomplete.</p>');
    const shopName = db_.getSettings(db, customer.shop_id).business_name;
    if (req.method === 'POST') {
      await readBody(req).catch(() => ({}));
      db.prepare('UPDATE customers SET email_opt_in = 0 WHERE id = ?').run(customer.id);
      return sendHtml(res, 200, 'Unsubscribed', `<h1>You're unsubscribed</h1><p>You will no longer receive emails from ${escapeHtml(shopName)}.</p>`);
    }
    // A button (not the link itself) so email scanners that follow links don't unsubscribe people.
    return sendHtml(res, 200, 'Unsubscribe', `<h1>Unsubscribe</h1>
      <p>Stop receiving order emails from ${escapeHtml(shopName)}?</p>
      <form method="post"><button class="primary" type="submit">Unsubscribe</button></form>`);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/healthz') {
        db.prepare('SELECT 1').get();
        return send(res, 200, { ok: true });
      }
      if (url.pathname === '/webhooks/twilio/sms' && req.method === 'POST') return await twilioWebhook(req, res, url);
      if (url.pathname === '/unsubscribe') return await unsubscribe(req, res, url);
      if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);

      // CSRF defence on top of SameSite cookies: reject cross-site writes.
      if (req.method !== 'GET' && req.headers.origin) {
        let originHost = '';
        try {
          originHost = new URL(req.headers.origin).host;
        } catch {}
        if (originHost !== req.headers.host) return send(res, 403, { error: 'Cross-site request blocked' });
      }

      const token = parseCookies(req.headers.cookie).sid;
      const user = auth.userForToken(token);
      const headers = {};
      const ctx = {
        method: req.method,
        pathname: url.pathname,
        query: url.searchParams,
        body: ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {},
        user,
        ip: clientIp(req),
        setSession: (t) => (headers['Set-Cookie'] = sessionCookie(t, SESSION_DAYS * 86400)),
        clearSession: () => {
          auth.destroySession(token);
          headers['Set-Cookie'] = sessionCookie('', 0);
        },
      };
      const data = await api(ctx);
      send(res, 200, data, headers);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      send(res, status, { error: status === 500 ? 'Internal server error' : e.message });
    }
  });
  return { server, db, notifier, auth };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'crm.db');
  const { server, db, notifier } = createServer({ dbPath });
  if (process.env.SEED_DEMO === '1') require('./scripts/seed-demo').seedDemo(db);
  startScheduler(db, notifier, {
    intervalMs: (Number(process.env.REMINDER_CHECK_MINUTES) || 15) * 60 * 1000,
  });
  server.listen(port, () => {
    console.log(`Dry Cleaner CRM running at http://localhost:${port}`);
    console.log(`Database: ${dbPath}`);
    console.log(`Texts:  ${notifier.modes.sms === 'log' ? 'not configured, logged only (set TWILIO_* to send)' : notifier.modes.sms}`);
    console.log(`Emails: ${notifier.modes.email === 'log' ? 'not configured, logged only (set EMAIL_* to send)' : notifier.modes.email}`);
    if (!process.env.PUBLIC_URL && !process.env.RENDER_EXTERNAL_URL) console.log('Tip: set PUBLIC_URL so emails include unsubscribe links and Twilio replies can be verified.');
  });
}
