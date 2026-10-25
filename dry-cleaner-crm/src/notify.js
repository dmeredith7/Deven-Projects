'use strict';

// Sends customer messages. Uses Twilio SMS when credentials are configured,
// otherwise records the message as "logged" so the shop can test the flow
// (and copy/paste or call the customer) without an SMS account.

const { getSettings } = require('./db');

function money(cents) {
  return '$' + (Number(cents || 0) / 100).toFixed(2);
}

function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function twilioSender(env = process.env) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  if (!sid || !token || !from) return null;
  return async (to, body) => {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
  };
}

function createNotifier(db, { sendSms = twilioSender() } = {}) {
  const insert = db.prepare(`INSERT INTO messages
    (customer_id, order_id, kind, channel, to_addr, body, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  async function send({ customer, orderId = null, kind, body }) {
    const channel = sendSms ? 'sms' : 'log';
    let status = sendSms ? 'sent' : 'logged';
    let error = null;
    if (!customer.phone) {
      status = 'skipped';
      error = 'Customer has no phone number';
    } else if (!customer.sms_opt_in) {
      status = 'skipped';
      error = 'Customer opted out of SMS';
    } else if (sendSms) {
      try {
        await sendSms(customer.phone, body);
      } catch (e) {
        status = 'failed';
        error = e.message;
      }
    }
    const r = insert.run(customer.id, orderId, kind, channel, customer.phone || null, body, status, error);
    return { id: Number(r.lastInsertRowid), status, error, channel, body };
  }

  // Build and send the templated message for an order ("ready" or "reminder").
  async function notifyOrder(order, kind) {
    const settings = getSettings(db);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id);
    const tpl = kind === 'ready' ? settings.template_ready : settings.template_reminder;
    const body = renderTemplate(tpl, {
      name: customer.name.split(' ')[0],
      ticket: order.ticket,
      business: settings.business_name,
      total: money(order.total_cents),
      balance: money(order.balance_cents),
      ready_date: order.ready_at ? order.ready_at.slice(0, 10) : '',
      phone: settings.business_phone,
    });
    return send({ customer, orderId: order.id, kind, body });
  }

  return { send, notifyOrder, mode: sendSms ? 'sms' : 'log' };
}

module.exports = { createNotifier, renderTemplate, money, twilioSender };
