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
    let cookie = '';
    const call = async (method, path, body, headers = {}) => {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data, headers: res.headers };
    };
    return { call, get cookie() { return cookie; } };
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
