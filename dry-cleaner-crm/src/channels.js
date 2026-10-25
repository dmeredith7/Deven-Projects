'use strict';

// Delivery providers. The platform operator configures one SMS provider
// (Twilio) and one email provider (Resend, SendGrid or Postmark) through
// environment variables; every shop sends through them. A transport is an
// async function that throws on failure and returns { id } on success.

const crypto = require('node:crypto');

// Twilio needs E.164 numbers. Assumes North America when no country code
// is given (DEFAULT_COUNTRY_CODE overrides).
function normalizePhone(raw, defaultCc = process.env.DEFAULT_COUNTRY_CODE || '1') {
  if (!raw) return null;
  const s = String(raw).trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  if (s.startsWith('+')) return '+' + digits;
  if (defaultCc === '1') {
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  }
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  return '+' + defaultCc + digits.replace(/^0+/, '');
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const isEmail = (s) => EMAIL_RE.test(String(s || '').trim());

async function check(res, label) {
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function twilio(env) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  const service = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !(from || service)) return null;
  const send = async ({ to, body }) => {
    const params = { To: to, Body: body };
    if (service) params.MessagingServiceSid = service;
    else params.From = from;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });
    const data = await check(res, 'Twilio');
    return { id: data.sid };
  };
  send.provider = 'twilio';
  return send;
}

function emailFrom(msg) {
  return msg.fromName ? `"${msg.fromName.replace(/["\r\n]/g, '')}" <${msg.from}>` : msg.from;
}

const EMAIL_PROVIDERS = {
  resend: (key) => async (msg) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom(msg),
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        reply_to: msg.replyTo || undefined,
        headers: msg.headers,
      }),
    });
    return { id: (await check(res, 'Resend')).id };
  },
  sendgrid: (key) => async (msg) => {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: { email: msg.from, name: msg.fromName || undefined },
        reply_to: msg.replyTo ? { email: msg.replyTo } : undefined,
        subject: msg.subject,
        content: [
          { type: 'text/plain', value: msg.text },
          { type: 'text/html', value: msg.html },
        ],
        headers: msg.headers,
      }),
    });
    await check(res, 'SendGrid');
    return { id: res.headers.get('x-message-id') };
  },
  postmark: (key) => async (msg) => {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'X-Postmark-Server-Token': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        From: emailFrom(msg),
        To: msg.to,
        Subject: msg.subject,
        TextBody: msg.text,
        HtmlBody: msg.html,
        ReplyTo: msg.replyTo || undefined,
        Headers: Object.entries(msg.headers || {}).map(([Name, Value]) => ({ Name, Value })),
        MessageStream: 'outbound',
      }),
    });
    return { id: (await check(res, 'Postmark')).MessageID };
  },
};

function email(env) {
  const provider = (env.EMAIL_PROVIDER || '').toLowerCase();
  const key = env.EMAIL_API_KEY;
  if (!provider || !key || !env.EMAIL_FROM) return null;
  const make = EMAIL_PROVIDERS[provider];
  if (!make) throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (use resend, sendgrid or postmark)`);
  const inner = make(key);
  const send = (msg) => inner({ from: env.EMAIL_FROM, ...msg });
  send.provider = provider;
  return send;
}

function transportsFromEnv(env = process.env) {
  return { sms: twilio(env), email: email(env) };
}

// https://www.twilio.com/docs/usage/security#validating-requests
function validTwilioSignature(authToken, url, params, signature) {
  if (!authToken || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { normalizePhone, isEmail, transportsFromEnv, validTwilioSignature, EMAIL_PROVIDERS };
