'use strict';

const db_ = require('../src/db');
const { createServer } = require('../server');

// Starts a server on a random port with fake SMS/email transports that
// record what would have been sent.
async function start({ sms = true, email = true, env = {}, publicUrl = 'https://crm.example.com' } = {}) {
  const sent = { sms: [], email: [] };
  const fail = { sms: false, email: false };
  const transports = {
    sms: sms
      ? async (m) => {
          if (fail.sms) throw new Error('carrier rejected');
          sent.sms.push(m);
          return { id: 'SM' + sent.sms.length };
        }
      : null,
    email: email
      ? async (m) => {
          if (fail.email) throw new Error('mailbox unavailable');
          sent.email.push(m);
          return { id: 'em' + sent.email.length };
        }
      : null,
  };
  const db = db_.open(':memory:');
  const { server, notifier } = createServer({ db, transports, publicUrl, env });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // A tiny cookie-keeping client, one per simulated browser.
  function client() {
    const jar = new Map();
    const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const call = async (method, path, body, headers = {}) => {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(jar.size ? { Cookie: cookieHeader() } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
        if (v) jar.set(k, v);
        else jar.delete(k);
      }
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data, headers: res.headers };
    };
    return { call, jar, get cookie() { return cookieHeader(); } };
  }

  let n = 0;
  async function shop(name = 'Shop') {
    const c = client();
    n++;
    const r = await c.call('POST', '/api/auth/signup', {
      shop_name: `${name} ${n}`, name: 'Owner', email: `owner${n}-${Date.now()}@example.com`, password: 'password123',
    });
    if (r.status !== 200) throw new Error(JSON.stringify(r.data));
    return { ...c, user: r.data.user };
  }

  return { base, db, notifier, sent, fail, client, shop, close: () => server.close() };
}

module.exports = { start };
