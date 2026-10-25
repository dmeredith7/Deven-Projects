'use strict';

// Customer messaging over SMS and email. Each message is recorded in the
// messages table with its outcome. When a channel has no provider
// configured, messages are recorded as "logged" so a shop can try the
// workflow before connecting Twilio or an email service.

const crypto = require('node:crypto');
const { getSettings, secret } = require('./db');
const { normalizePhone, isEmail } = require('./channels');

const SMS_STOP_FOOTER = ' Reply STOP to opt out.';

function money(cents) {
  return '$' + (Number(cents || 0) / 100).toFixed(2);
}

function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function unsubscribeToken(db, customerId) {
  return crypto.createHmac('sha256', secret(db)).update(`unsub:${customerId}`).digest('base64url').slice(0, 32);
}

function verifyUnsubscribe(db, customerId, token) {
  const expected = Buffer.from(unsubscribeToken(db, customerId));
  const got = Buffer.from(String(token || ''));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

function emailHtml(settings, text, unsubscribeUrl) {
  const paras = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  const footer = [settings.business_name, settings.business_address, settings.business_phone]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1d2330">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:10px;border:1px solid #e3e6eb">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e3e6eb;font-size:18px;font-weight:bold">${escapeHtml(settings.business_name)}</td></tr>
<tr><td style="padding:20px 24px;font-size:15px;line-height:1.5">${paras}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e3e6eb;font-size:12px;color:#6b7280">${footer}${
    unsubscribeUrl ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280">Unsubscribe from email updates</a>` : ''
  }</td></tr>
</table></td></tr></table></body></html>`;
}

function createNotifier(db, { transports = {}, publicUrl = process.env.PUBLIC_URL || '' } = {}) {
  const sms = transports.sms || null;
  const email = transports.email || null;
  const base = publicUrl.replace(/\/+$/, '');

  const insert = db.prepare(`INSERT INTO messages
    (shop_id, customer_id, order_id, kind, channel, to_addr, subject, body, status, error, provider_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  function record(m) {
    const r = insert.run(
      m.shopId, m.customerId ?? null, m.orderId ?? null, m.kind, m.channel,
      m.to ?? null, m.subject ?? null, m.body, m.status, m.error ?? null, m.providerId ?? null
    );
    return {
      id: Number(r.lastInsertRowid),
      channel: m.channel,
      to: m.to ?? null,
      subject: m.subject ?? null,
      body: m.body,
      status: m.status,
      error: m.error ?? null,
    };
  }

  async function deliver(transport, payload) {
    if (!transport) return { status: 'logged' };
    try {
      const r = await transport(payload);
      return { status: 'sent', providerId: r?.id ?? null };
    } catch (e) {
      return { status: 'failed', error: e.message };
    }
  }

  async function sendSms({ shopId, customer, orderId, kind, body, settings }) {
    settings = settings || getSettings(db, shopId);
    const to = normalizePhone(customer?.phone);
    const base_ = { shopId, customerId: customer?.id, orderId, kind, channel: 'sms', to, body };
    if (!to) return record({ ...base_, status: 'skipped', error: 'No phone number' });
    if (customer && !customer.sms_opt_in) return record({ ...base_, status: 'skipped', error: 'Customer opted out of texts' });
    if (settings.notify_sms !== '1' && kind !== 'test') return record({ ...base_, status: 'skipped', error: 'Texts are turned off in Settings' });
    const text = body.includes('STOP') ? body : body + SMS_STOP_FOOTER;
    const r = await deliver(sms, { to, body: text });
    return record({ ...base_, body: text, ...r });
  }

  async function sendEmail({ shopId, customer, orderId, kind, subject, body, settings }) {
    settings = settings || getSettings(db, shopId);
    const to = customer?.email ? String(customer.email).trim() : null;
    const base_ = { shopId, customerId: customer?.id, orderId, kind, channel: 'email', to, subject, body };
    if (!to || !isEmail(to)) return record({ ...base_, status: 'skipped', error: 'No valid email address' });
    if (customer && customer.id && !customer.email_opt_in) return record({ ...base_, status: 'skipped', error: 'Customer unsubscribed from email' });
    if (settings.notify_email !== '1' && kind !== 'test') return record({ ...base_, status: 'skipped', error: 'Email is turned off in Settings' });

    const unsub = customer?.id && base ? `${base}/unsubscribe?c=${customer.id}&t=${unsubscribeToken(db, customer.id)}` : null;
    const headers = {};
    if (unsub) {
      headers['List-Unsubscribe'] = `<${unsub}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    const r = await deliver(email, {
      to,
      fromName: settings.business_name,
      replyTo: isEmail(settings.business_email) ? settings.business_email : undefined,
      subject,
      text: body + (unsub ? `\n\n--\nUnsubscribe: ${unsub}` : ''),
      html: emailHtml(settings, body, unsub),
      headers,
    });
    return record({ ...base_, ...r });
  }

  // One-off message from staff, on the requested channel(s).
  async function sendManual({ shopId, customer, orderId = null, channels, subject, body }) {
    const settings = getSettings(db, shopId);
    const out = [];
    if (channels.includes('sms')) out.push(await sendSms({ shopId, customer, orderId, kind: 'manual', body, settings }));
    if (channels.includes('email')) {
      out.push(await sendEmail({ shopId, customer, orderId, kind: 'manual', subject: subject || `A message from ${settings.business_name}`, body, settings }));
    }
    return out;
  }

  // Templated "ready" or "reminder" notice on every channel the customer can receive.
  async function notifyOrder(order, kind) {
    const shopId = order.shop_id;
    const settings = getSettings(db, shopId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND shop_id = ?').get(order.customer_id, shopId);
    const vars = {
      name: customer.name.split(' ')[0],
      full_name: customer.name,
      ticket: order.ticket,
      business: settings.business_name,
      phone: settings.business_phone,
      address: settings.business_address,
      total: money(order.total_cents),
      balance: money(order.balance_cents),
      pieces: order.piece_count,
      due_date: order.due_date || '',
      ready_date: order.ready_at ? order.ready_at.slice(0, 10) : '',
    };
    const k = kind === 'ready' ? 'ready' : 'reminder';
    const results = [];
    if (customer.phone) {
      results.push(await sendSms({ shopId, customer, orderId: order.id, kind: k, body: renderTemplate(settings[`sms_template_${k}`], vars), settings }));
    }
    if (customer.email) {
      results.push(
        await sendEmail({
          shopId, customer, orderId: order.id, kind: k, settings,
          subject: renderTemplate(settings[`email_subject_${k}`], vars),
          body: renderTemplate(settings[`email_body_${k}`], vars),
        })
      );
    }
    if (!results.length) {
      results.push(record({ shopId, customerId: customer.id, orderId: order.id, kind: k, channel: 'sms', body: '(no contact details)', status: 'skipped', error: 'Customer has no phone or email' }));
    }
    return results;
  }

  // Platform emails (password reset). Not tied to a shop's message log.
  async function sendSystemEmail({ to, subject, text }) {
    if (!email) {
      console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
      return { status: 'logged' };
    }
    return deliver(email, {
      to,
      fromName: process.env.EMAIL_FROM_NAME || 'Dry Cleaner CRM',
      subject,
      text,
      html: emailHtml({ business_name: process.env.EMAIL_FROM_NAME || 'Dry Cleaner CRM' }, text, null),
    });
  }

  return {
    sendSms,
    sendEmail,
    sendManual,
    notifyOrder,
    sendSystemEmail,
    modes: { sms: sms ? sms.provider || 'custom' : 'log', email: email ? email.provider || 'custom' : 'log' },
  };
}

module.exports = { createNotifier, renderTemplate, money, unsubscribeToken, verifyUnsubscribe, escapeHtml };
