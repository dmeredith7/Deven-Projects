'use strict';

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');

// Translation helpers (see i18n.js). t(english, vars) returns the text in the
// chosen language; tn picks singular/plural; N_ marks text translated later.
const { t, tn, N_ } = I18N;
const L = () => I18N.locale();

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (c) => (Number(c) < 0 ? '-$' : '$') + (Math.abs(Number(c || 0)) / 100).toFixed(2);
const toCents = (v) => Math.round(parseFloat(String(v).replace(/[^0-9.\-]/g, '')) * 100) || 0;
const dollars = (c) => (Number(c || 0) / 100).toFixed(2);
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD
const parseUtc = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
const dateTime = (s) => (s ? parseUtc(s).toLocaleString(L(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const shortDate = (s) => (s ? parseUtc(s).toLocaleDateString(L(), { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const cleanTicket = (v) => String(v || '').trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();

function dueLabel(d) {
  if (!d) return '';
  const today = localDate();
  const tomorrow = localDate(new Date(Date.now() + 864e5));
  if (d === today) return t('Due today');
  if (d === tomorrow) return t('Due tomorrow');
  const nice = new Date(d + 'T12:00:00').toLocaleDateString(L(), { weekday: 'short', month: 'short', day: 'numeric' });
  return d < today ? t('Overdue · {date}', { date: nice }) : t('Due {date}', { date: nice });
}

// Icons (Lucide-style, MIT).
const ICONS = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-9 5.7a2 2 0 0 1-2 0L2 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  hanger: '<path d="M12 7.5a2.2 2.2 0 1 1 2.2-2.2"/><path d="M12 7.5v1.3l-8.3 6.1A1.6 1.6 0 0 0 4.6 18h14.8a1.6 1.6 0 0 0 .9-3.1L12 8.8"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  store: '<path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const hydrateIcons = (root = document) => $$('[data-icon]', root).forEach((el) => (el.outerHTML = icon(el.dataset.icon)));

const AVATAR_COLORS = ['#0e7490', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#2563eb', '#ca8a04', '#0891b2', '#9333ea', '#dc2626'];
function avatar(name, cls = '') {
  const n = String(name || '?').trim();
  const initials = n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<div class="avatar ${cls}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${esc(initials)}</div>`;
}

const STATUS_LABEL = { received: N_('Received'), cleaning: N_('Cleaning'), ready: N_('Ready'), picked_up: N_('Picked up'), cancelled: N_('Cancelled') };
// "#1042 marked ready" etc. as whole sentences so word order works in every language.
const MARKED = { received: N_('#{ticket} marked received'), cleaning: N_('#{ticket} marked cleaning'), ready: N_('#{ticket} marked ready'), picked_up: N_('#{ticket} marked picked up'), cancelled: N_('#{ticket} marked cancelled') };
const NEXT = { received: ['cleaning', N_('Start cleaning')], cleaning: ['ready', N_('Mark ready')], ready: ['picked_up', N_('Picked up')] };
const MSG_STATUS = { sent: N_('Sent'), logged: N_('Not sent (not connected)'), failed: N_('Failed'), skipped: N_('Skipped'), received: N_('Reply') };
const MSG_KIND = { ready: N_('ready notice'), reminder: N_('reminder'), manual: N_('message'), test: N_('test'), reply: N_('customer reply') };
const CHANNEL_LABEL = { sms: N_('Text'), email: N_('Email') };
const statusLabel = (s) => (STATUS_LABEL[s] ? t(STATUS_LABEL[s]) : s);
const channelLabel = (c) => (CHANNEL_LABEL[c] ? t(CHANNEL_LABEL[c]) : c);
const pill = (s) => `<span class="pill ${esc(s)}">${esc(statusLabel(s))}</span>`;
const msgPill = (m) =>
  `<span class="pill ${m.direction === 'in' ? 'reply' : esc(m.status)}">${esc(m.direction === 'in' ? t('Reply') : MSG_STATUS[m.status] ? t(MSG_STATUS[m.status]) : m.status)}</span>`;

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error(t('Please log in'));
  }
  if (!res.ok) throw new Error(data.error ? I18N.tErr(data.error) : t('Request failed ({status})', { status: res.status }));
  return data;
}

let me = null;
const isOwner = () => me && me.user.role === 'owner';

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function messageToast(list, prefix = '') {
  list = [].concat(list || []);
  if (!list.length) return prefix && toast(prefix);
  const parts = list.map((m) => {
    const ch = channelLabel(m.channel);
    if (m.status === 'sent') return t('{channel} sent', { channel: ch });
    if (m.status === 'logged') return t('{channel} saved (not connected yet)', { channel: ch });
    if (m.status === 'failed') return t('{channel} failed', { channel: ch }) + (m.error ? ': ' + I18N.tErr(m.error) : '');
    return t('{channel} skipped', { channel: ch }) + (m.error ? ': ' + I18N.tErr(m.error) : '');
  });
  toast((prefix ? prefix + ' · ' : '') + parts.join(' · '));
}

async function busy(btn, fn) {
  btn.disabled = true;
  try {
    return await fn();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

function modal(title, body, { width } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${width ? `style="width:min(${width}px,100%)"` : ''}>
    <div class="card-head"><h2>${esc(title)}</h2><span class="spacer"></span><button class="icon-btn" data-close aria-label="${esc(t('Close'))}">${icon('x')}</button></div>
    ${body}</div>`;
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  back.addEventListener('click', (e) => (e.target === back || e.target.closest('[data-close]')) && close());
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  const first = $('input, textarea, select', back);
  if (first) first.focus();
  return { el: back, close };
}

function setTitle(title) {
  $('#topbar-title').textContent = title;
  document.title = `${title} · ${me ? me.shop.name : 'Dry Cleaner CRM'}`;
}

const pageHead = (title, sub = '', actions = '') => `
  <div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
  ${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;

const emptyState = (ic, title, text = '', action = '') =>
  `<div class="empty-state">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;

// ---------- shared renderers ----------
function orderList(list, { empty } = {}) {
  if (!list.length) return empty || emptyState('receipt', t('No orders here'), t('New orders will show up in this list.'));
  return `<div class="list">
    <div class="list-row order-row list-head hide-md"><div>${t('Ticket')}</div><div>${t('Customer')}</div><div>${t('Status')}</div><div>${t('Due')}</div><div class="num">${t('Total')}</div><div></div></div>
    ${list
      .map((o) => {
        const next = NEXT[o.status];
        const overdue = o.due_date && o.due_date < localDate() && ['received', 'cleaning'].includes(o.status);
        return `<div class="list-row order-row click" data-href="#/orders/${o.id}">
          <div><div class="ticket-no">#${esc(o.ticket)}</div><div class="sub-line">${tn(o.piece_count, '{n} pc', '{n} pcs')}</div></div>
          <div class="who-cell">${avatar(o.customer_name)}<div><div class="name-line">${esc(o.customer_name)}</div>
            <div class="sub-line">${esc(o.customer_phone || o.customer_email || '')}</div></div></div>
          <div class="hide-md">${pill(o.status)}</div>
          <div class="hide-md"><div class="small ${overdue ? 'danger-text strong' : ''}">${o.status === 'picked_up' ? t('Picked up {date}', { date: shortDate(o.picked_up_at) }) : esc(dueLabel(o.due_date))}</div>
            <div class="sub-line">${o.rack ? t('Rack {rack}', { rack: esc(o.rack) }) : ''}</div></div>
          <div class="num hide-md"><div class="strong">${money(o.total_cents)}</div>
            <div class="sub-line ${o.balance_cents > 0 ? 'danger-text' : ''}">${o.balance_cents > 0 ? t('{amount} due', { amount: money(o.balance_cents) }) : t('Paid')}</div></div>
          <div class="row-action">${
            next
              ? `<button class="btn btn-sm ${next[0] === 'ready' ? 'btn-primary' : ''}" data-advance="${o.id}" data-status="${next[0]}">${next[0] === 'picked_up' ? icon('check', 'sm') : ''}${t(next[1])}</button>`
              : `<span class="md-only">${pill(o.status)}</span>`
          }</div>
        </div>`;
      })
      .join('')}</div>`;
}

function timeline(list, { showCustomer = false, empty } = {}) {
  if (!list.length) return empty || emptyState('message', t('No messages yet'), t('Texts and emails to this customer will appear here.'));
  return `<div class="timeline">${list
    .map((m) => {
      const ic = m.direction === 'in' ? 'reply' : m.channel === 'email' ? 'mail' : 'phone';
      const who = showCustomer
        ? m.customer_id
          ? `<a class="who" href="#/customers/${m.customer_id}">${esc(m.customer_name)}</a>`
          : `<span class="who">${esc(m.to_addr || '')}</span>`
        : '';
      return `<div class="msg ${m.direction === 'in' ? 'in' : ''}">
        <div class="msg-icon">${icon(ic, 'sm')}</div>
        <div><div class="msg-meta">${who}<span>${esc(channelLabel(m.channel))} · ${esc(MSG_KIND[m.kind] ? t(MSG_KIND[m.kind]) : m.kind)}</span>
          ${m.order_id && m.ticket ? `<a href="#/orders/${m.order_id}">#${esc(m.ticket)}</a>` : ''}
          <span>${dateTime(m.created_at)}</span>${msgPill(m)}</div>
          <div class="msg-body">${m.subject ? `<strong>${esc(m.subject)}</strong>` : ''}${esc(m.body)}</div>
          ${m.error ? `<div class="tiny muted" style="margin-top:4px">${esc(I18N.tErr(m.error))}</div>` : ''}</div>
      </div>`;
    })
    .join('')}</div>`;
}

document.addEventListener('click', async (e) => {
  const adv = e.target.closest('[data-advance]');
  if (adv) {
    e.preventDefault();
    e.stopPropagation();
    await busy(adv, async () => {
      const status = adv.dataset.status;
      const r = await api('POST', `/orders/${adv.dataset.advance}/status`, { status });
      messageToast(r.messages, t(MARKED[status], { ticket: r.order.ticket }));
      route();
    });
    return;
  }
  const row = e.target.closest('[data-href]');
  if (row && !e.target.closest('button, input, select, textarea, a')) location.hash = row.dataset.href;
});

// ---------- views ----------
const views = {};

views.dashboard = async () => {
  setTitle(t('Dashboard'));
  const d = await api('GET', '/dashboard');
  const hour = new Date().getHours();
  const name = esc(me.user.name.split(' ')[0]);
  const greet = hour < 12 ? t('Good morning, {name}', { name }) : hour < 18 ? t('Good afternoon, {name}', { name }) : t('Good evening, {name}', { name });
  const stat = (href, tone, ic, label, value) =>
    `<a class="stat" href="${href}"><div class="stat-icon tone-${tone}">${icon(ic)}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div></a>`;

  app.innerHTML = `
    ${pageHead(greet, new Date().toLocaleDateString(L(), { weekday: 'long', month: 'long', day: 'numeric' }),
      `<a class="btn btn-primary btn-lg" href="#/orders/new">${icon('plus')}${t('New order')}</a>`)}
    <form class="search lg" id="quick" style="margin-bottom:20px">${icon('search')}
      <input id="quick-q" placeholder="${esc(t('Find an order: ticket number, customer name or phone'))}" autocomplete="off"></form>
    <div class="stats">
      ${stat('#/orders?status=received', 'received', 'receipt', t('Waiting to clean'), d.by_status.received)}
      ${stat('#/orders?status=cleaning', 'cleaning', 'sparkle', t('Cleaning'), d.by_status.cleaning)}
      ${stat('#/orders?status=ready', 'ready', 'check', t('Ready for pickup'), d.by_status.ready)}
      ${stat('#/orders?status=open', 'primary', 'dollar', t('Sales today'), money(d.sales_today_cents))}
    </div>
    <div class="grid two">
      <div class="card">
        <div class="card-head">${icon('clock')}<h2>${t('Due today & overdue')}</h2><span class="spacer"></span><span class="hint">${tn(d.due_or_overdue.length, '{n} order', '{n} orders')}</span></div>
        ${orderList(d.due_or_overdue, { empty: emptyState('check', t('You’re all caught up'), t('No orders are due today.')) })}
      </div>
      <div class="card">
        <div class="card-head">${icon('bell')}<h2>${t('Waiting for pickup')}</h2><span class="spacer"></span>
          ${d.reminders_due ? `<button class="btn btn-sm" id="run-rem">${icon('send', 'sm')}${tn(d.reminders_due, 'Send {n} reminder', 'Send {n} reminders')}</button>` : `<span class="hint">${t('Reminders go out automatically')}</span>`}</div>
        ${orderList(d.awaiting_pickup, { empty: emptyState('shirt', t('Nothing on the rack'), t('Orders marked ready will show up here.')) })}
      </div>
    </div>
    <p class="small muted" style="margin-top:16px">${[
      tn(d.orders_today, '{n} order today', '{n} orders today'),
      t('{amount} in unpaid balances', { amount: money(d.outstanding_balance_cents) }),
      tn(d.customers, '{n} customer', '{n} customers'),
    ].join(' · ')}</p>`;

  $('#quick').onsubmit = async (e) => {
    e.preventDefault();
    const q = $('#quick-q').value.trim();
    if (q) {
      // Typed or scanned a ticket number? Open that order directly (active orders first).
      const matches = (await api('GET', '/orders?q=' + encodeURIComponent(q))).filter((o) => o.ticket === cleanTicket(q));
      const hit = matches.find((o) => NEXT[o.status]) || (matches.length === 1 && matches[0]);
      if (hit) return (location.hash = '#/orders/' + hit.id);
    }
    location.hash = `#/orders?status=${q ? '' : 'open'}${q ? '&q=' + encodeURIComponent(q) : ''}`;
  };
  if ($('#run-rem')) {
    $('#run-rem').onclick = (e) => busy(e.currentTarget, async () => {
      const r = await api('POST', '/reminders/run');
      toast(tn(r.sent.length, 'Reminders sent for {n} order', 'Reminders sent for {n} orders'));
      route();
    });
  }
};

views.orders = async (_, query) => {
  setTitle(t('Orders'));
  const status = query.has('status') ? query.get('status') : 'open';
  const q = query.get('q') || '';
  const [d, list] = await Promise.all([
    api('GET', '/dashboard'),
    api('GET', '/orders?' + new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })),
  ]);
  const c = d.by_status;
  const tabs = [
    ['open', t('Active'), c.received + c.cleaning + c.ready],
    ['received', t('Waiting'), c.received],
    ['cleaning', t('Cleaning'), c.cleaning],
    ['ready', t('Ready'), c.ready],
    ['picked_up', t('Picked up'), c.picked_up],
    ['', t('All'), null],
  ];
  const newBtn = `<a class="btn btn-primary" href="#/orders/new">${icon('plus')}${t('New order')}</a>`;
  app.innerHTML = `
    ${pageHead(t('Orders'), t('Tap an order to see details, or move it along with one click.'), newBtn)}
    <div class="row" style="margin-bottom:16px">
      <div class="tabs">${tabs.map(([k, l, n]) => `<button data-tab="${k}" class="${k === status ? 'active' : ''}">${l}${n != null ? `<span class="count">${n}</span>` : ''}</button>`).join('')}</div>
      <span class="spacer"></span>
      <form class="search" id="sf" style="width:min(320px,100%)">${icon('search')}<input id="q" value="${esc(q)}" placeholder="${esc(t('Ticket, name, phone or rack'))}"></form>
    </div>
    <div class="card">${orderList(list, {
      empty: q
        ? emptyState('search', t('No matching orders'), t('Nothing matches “{q}”. Try a ticket number or phone number.', { q: esc(q) }))
        : emptyState('receipt', t('No orders here'), t('New orders will show up in this list.'), newBtn),
    })}</div>`;

  const go = (s, text) => (location.hash = '#/orders?' + new URLSearchParams({ status: s, ...(text ? { q: text } : {}) }));
  $$('[data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab, $('#q').value.trim())));
  let timer;
  $('#q').oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => go(status, $('#q').value.trim()), 350);
  };
  $('#sf').onsubmit = (e) => {
    e.preventDefault();
    go(status, $('#q').value.trim());
  };
  if (q) {
    const inp = $('#q');
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
};

views.newOrder = async (_, query, restore) => {
  setTitle(t('New order'));
  const [services, settings] = await Promise.all([api('GET', '/services'), api('GET', '/settings')]);
  const active = services.filter((s) => s.active);
  const categories = [...new Set(active.map((s) => s.category))];
  const taxRate = Number(settings.tax_rate) || 0;
  const paperTickets = settings.ticket_mode === 'manual';
  const due = localDate(new Date(Date.now() + (Number(settings.default_turnaround_days) || 3) * 864e5));
  // After a language switch the page is redrawn; carry the order in progress over.
  let { customer = null, cart = [], category = '', seq = 0 } = restore || {};
  viewState = () => ({ customer, cart, category, seq });

  app.innerHTML = `
    <a class="back" href="#/orders">${icon('back', 'sm')}${t('Orders')}</a>
    ${pageHead(t('New order'), t('Pick the customer, tap what they dropped off, and create the ticket.'))}
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card"><div class="card-head">${icon('user')}<h2>${t('Customer')}</h2></div><div class="card-body" id="cust-box"></div></div>
        <div class="card">
          <div class="card-head">${icon('shirt')}<h2>${t('Items')}</h2><span class="spacer"></span><span class="hint">${t('Tap to add · tap again for more')}</span></div>
          <div class="card-body stack">
            <div class="chips" id="cats"></div>
            <div class="service-grid" id="tiles"></div>
            <form class="row" id="custom" style="border-top:1px solid var(--border);padding-top:16px">
              <input id="c-desc" placeholder="${esc(t('Something else? e.g. Wedding gown'))}" style="flex:1;min-width:180px">
              <div class="money-input" style="width:110px"><input id="c-price" inputmode="decimal" placeholder="0.00"></div>
              <button class="btn">${icon('plus', 'sm')}${t('Add')}</button>
            </form>
          </div>
        </div>
      </div>
      <div class="cart-bar" id="cart-bar" hidden><div><div class="strong" id="bar-total"></div><div class="tiny muted" id="bar-pcs"></div></div>
        <button class="btn btn-primary" id="bar-go">${t('Review ticket')}</button></div>
      <div class="card cart" id="cart-card">
        <div class="card-head">${icon('receipt')}<h2>${t('Ticket')}</h2><span class="spacer"></span><span class="hint" id="pcs"></span></div>
        <div class="card-body stack">
          ${paperTickets ? `<label class="field">${t('Ticket number')}<input id="ticket" class="ticket-input" placeholder="${esc(t('From the paper ticket'))}" autocomplete="off" maxlength="21">
            <span class="warn" id="ticket-warn" hidden></span></label>` : ''}
          <div class="cart-items" id="cart"></div>
          <div class="form" style="grid-template-columns:1fr 1fr">
            <label class="field">${t('Due date')}<input id="due" type="date" value="${due}"></label>
            <label class="field">${t('Rack / bin')}<input id="rack" placeholder="${esc(t('Optional'))}"></label>
            <label class="field">${t('Discount')}<div class="money-input"><input id="discount" inputmode="decimal" placeholder="0.00"></div></label>
            <label class="field">${t('Paid now')}<div class="money-input"><input id="paid" inputmode="decimal" placeholder="0.00"></div></label>
            <label class="field full">${t('Notes')}<textarea id="notes" rows="2" style="min-height:60px" placeholder="${esc(t('Stains, damage, special instructions'))}"></textarea></label>
          </div>
          <div class="totals" id="totals"></div>
          <button class="btn btn-primary btn-lg btn-block" id="save">${icon('check')}${t('Create order')}</button>
        </div>
      </div>
    </div>`;

  // --- customer picker ---
  const renderCustomer = () => {
    const box = $('#cust-box');
    if (customer) {
      box.innerHTML = `<div class="picked-customer">${avatar(customer.name)}
        <div style="flex:1;min-width:0"><div class="name-line">${esc(customer.name)}</div>
          <div class="sub-line">${esc([customer.phone, customer.email].filter(Boolean).join(' · ') || t('No contact details'))}</div></div>
        <button class="btn btn-sm btn-ghost" id="change">${t('Change')}</button></div>
        ${customer.preferences ? `<div class="callout info" style="margin-top:12px">${icon('sparkle', 'sm')}<span><b>${t('Preferences:')}</b> ${esc(customer.preferences)}</span></div>` : ''}`;
      $('#change').onclick = () => {
        customer = null;
        renderCustomer();
        update();
      };
      return;
    }
    box.innerHTML = `<div class="row">
      <div class="search" style="flex:1;min-width:200px">${icon('search')}<input id="cust-q" placeholder="${esc(t('Search by name or phone'))}" autocomplete="off">
        <div class="suggest" id="suggest" hidden></div></div>
      <button class="btn" id="new-cust">${icon('plus', 'sm')}${t('New customer')}</button></div>`;
    let timer;
    $('#cust-q').oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = $('#cust-q').value.trim();
        const sug = $('#suggest');
        if (!q) return (sug.hidden = true);
        const list = await api('GET', '/customers?q=' + encodeURIComponent(q));
        sug.hidden = false;
        sug.innerHTML = list.length
          ? list.slice(0, 8).map((c, i) => `<button type="button" data-i="${i}">${avatar(c.name)}<div style="min-width:0"><div class="name-line">${esc(c.name)}</div><div class="sub-line">${esc(c.phone || c.email || '')}</div></div></button>`).join('')
          : `<button type="button" data-new>${icon('plus', 'sm')}${t('Add “{name}” as a new customer', { name: esc(q) })}</button>`;
        $$('[data-i]', sug).forEach((b) => (b.onclick = () => pick(list[b.dataset.i])));
        const nb = $('[data-new]', sug);
        if (nb) nb.onclick = () => newCustomer(q);
      }, 150);
    };
    $('#new-cust').onclick = () => newCustomer('');
    if (!restore) $('#cust-q').focus();
  };
  const pick = (c) => {
    customer = c;
    renderCustomer();
    update();
    if (paperTickets && !$('#ticket').value) $('#ticket').focus();
  };
  const newCustomer = (prefill) => {
    const looksLikePhone = /^[\d\s()+-]{7,}$/.test(prefill);
    const m = modal(t('New customer'), `<form class="card-body stack" id="nc">
      <label class="field">${t('Name')}<input name="name" value="${looksLikePhone ? '' : esc(prefill)}" required></label>
      <div class="form" style="grid-template-columns:1fr 1fr">
        <label class="field">${t('Mobile phone')}<input name="phone" type="tel" value="${looksLikePhone ? esc(prefill) : ''}"></label>
        <label class="field">${t('Email')}<input name="email" type="email"></label>
      </div>
      <label class="field">${t('Preferences')}<input name="preferences" placeholder="${esc(t('e.g. light starch, shirts on hangers'))}"></label>
      <p class="small muted">${t('We’ll text and/or email them when their order is ready.')}</p>
      <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>${t('Cancel')}</button><button class="btn btn-primary">${t('Save customer')}</button></div>
    </form>`);
    $('#nc', m.el).onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        pick(await api('POST', '/customers', Object.fromEntries(new FormData(e.target))));
        m.close();
      });
    };
  };

  // --- items ---
  const renderTiles = () => {
    $('#cats').innerHTML = ['', ...categories].map((c) => `<button class="chip ${c === category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c || t('All'))}</button>`).join('');
    $$('[data-cat]').forEach((b) => (b.onclick = () => { category = b.dataset.cat; renderTiles(); }));
    const shown = active.filter((s) => !category || s.category === category);
    $('#tiles').innerHTML = shown.length
      ? shown.map((s) => {
          const n = cart.filter((l) => l.service_id === s.id).reduce((a, l) => a + l.qty, 0);
          return `<button class="service-tile ${n ? 'in-cart' : ''}" data-svc="${s.id}">${n ? `<span class="qty-badge">${n}</span>` : ''}
            <span class="name">${esc(s.name)}</span><span class="price">${money(s.price_cents)}</span></button>`;
        }).join('')
      : `<p class="muted small">${t('No services yet.')} ${isOwner() ? `<a href="#/services">${t('Add some to your price list.')}</a>` : ''}</p>`;
    $$('[data-svc]').forEach((b) => (b.onclick = () => {
      const s = active.find((x) => x.id == b.dataset.svc);
      const line = cart.find((l) => l.service_id === s.id && !l.note);
      if (line) line.qty++;
      else cart.push({ key: ++seq, service_id: s.id, name: s.name, qty: 1, price_cents: s.price_cents, note: '' });
      update();
    }));
  };
  const pieces = () => tn(cart.reduce((a, l) => a + l.qty, 0), '{n} piece', '{n} pieces');
  const renderCart = () => {
    const box = $('#cart');
    $('#pcs').textContent = pieces();
    if (!cart.length) {
      box.innerHTML = `<div class="empty-state" style="padding:20px 10px">${icon('shirt')}<h3>${t('No items yet')}</h3><p class="small">${t('Tap a service to add it.')}</p></div>`;
      return;
    }
    box.innerHTML = cart.map((l) => `<div class="cart-item" data-key="${l.key}">
      <div class="name-line">${esc(l.name)}</div><div class="strong num">${money(l.qty * l.price_cents)}</div>
      <div class="controls">
        <div class="stepper"><button type="button" data-dec aria-label="${esc(t('Fewer'))}">${icon('minus', 'sm')}</button><span>${l.qty}</span><button type="button" data-inc aria-label="${esc(t('More'))}">${icon('plus', 'sm')}</button></div>
        <input class="note" placeholder="${esc(t('Color, brand, stain…'))}" value="${esc(l.note)}">
        <div class="money-input"><input class="price" inputmode="decimal" value="${dollars(l.price_cents)}" aria-label="${esc(t('Price each'))}"></div>
      </div></div>`).join('');
    $$('.cart-item', box).forEach((row) => {
      const l = cart.find((x) => x.key == row.dataset.key);
      $('[data-inc]', row).onclick = () => { l.qty++; update(); };
      $('[data-dec]', row).onclick = () => { l.qty--; if (l.qty < 1) cart = cart.filter((x) => x !== l); update(); };
      $('.note', row).oninput = (e) => (l.note = e.target.value);
      $('.price', row).onchange = (e) => { l.price_cents = toCents(e.target.value); update(); };
    });
  };
  const renderTotals = () => {
    const sub = cart.reduce((s, l) => s + l.qty * l.price_cents, 0);
    const disc = toCents($('#discount').value);
    const taxable = Math.max(0, sub - disc);
    const tax = Math.round((taxable * taxRate) / 100);
    const total = taxable + tax;
    const paid = toCents($('#paid').value);
    $('#totals').innerHTML = `<div><span>${t('Subtotal')}</span><span>${money(sub)}</span></div>
      ${disc ? `<div><span>${t('Discount')}</span><span>-${money(disc)}</span></div>` : ''}
      ${taxRate ? `<div><span>${t('Tax ({rate}%)', { rate: taxRate })}</span><span>${money(tax)}</span></div>` : ''}
      <div class="grand"><span>${t('Total')}</span><span>${money(total)}</span></div>
      ${paid ? `<div><span>${t('Balance due')}</span><span>${money(total - paid)}</span></div>` : ''}`;
    $('#cart-bar').hidden = !cart.length;
    $('#bar-total').textContent = money(total);
    $('#bar-pcs').textContent = pieces();
    const needTicket = paperTickets && !cleanTicket($('#ticket').value);
    $('#save').disabled = !customer || !cart.length || needTicket;
    $('#save').title = !customer ? t('Choose a customer first') : !cart.length ? t('Add at least one item') : needTicket ? t('Enter the ticket number') : '';
  };
  const update = () => { renderTiles(); renderCart(); renderTotals(); };

  $('#custom').onsubmit = (e) => {
    e.preventDefault();
    const name = $('#c-desc').value.trim();
    if (!name) return $('#c-desc').focus();
    cart.push({ key: ++seq, service_id: null, name, qty: 1, price_cents: toCents($('#c-price').value), note: '' });
    $('#c-desc').value = $('#c-price').value = '';
    update();
  };
  ['#discount', '#paid'].forEach((s) => ($(s).oninput = renderTotals));
  if (paperTickets) {
    $('#ticket').oninput = () => { $('#ticket-warn').hidden = true; renderTotals(); };
    // Warn early if this number is still on an unfinished order (ticket books repeat).
    $('#ticket').onchange = async () => {
      const tk = cleanTicket($('#ticket').value);
      if (!tk) return;
      const clash = (await api('GET', '/orders?status=open&q=' + encodeURIComponent(tk))).find((o) => o.ticket === tk);
      $('#ticket-warn').hidden = !clash;
      if (clash) $('#ticket-warn').textContent = t('#{ticket} is already on an active order for {name}.', { ticket: tk, name: clash.customer_name });
    };
  }
  $('#bar-go').onclick = () => $('#cart-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#save').onclick = (e) => busy(e.currentTarget, async () => {
    const o = await api('POST', '/orders', {
      customer_id: customer.id,
      ...(paperTickets ? { ticket: $('#ticket').value } : {}),
      items: cart.map((l) => ({
        service_id: l.service_id,
        description: l.note.trim() ? `${l.name} — ${l.note.trim()}` : l.name,
        qty: l.qty,
        price_cents: l.price_cents,
      })),
      due_date: $('#due').value,
      rack: $('#rack').value,
      notes: $('#notes').value,
      discount_cents: toCents($('#discount').value),
      paid_cents: toCents($('#paid').value),
    });
    toast(t('Order #{ticket} created', { ticket: o.ticket }));
    location.hash = `#/orders/${o.id}`;
  });

  renderCustomer();
  update();
  if (!restore && query.get('customer')) pick(await api('GET', '/customers/' + query.get('customer')));
};

views.order = async ([id]) => {
  const [o, settings] = await Promise.all([api('GET', '/orders/' + id), api('GET', '/settings')]);
  setTitle(t('Order #{ticket}', { ticket: o.ticket }));
  const next = NEXT[o.status];
  const steps = ['received', 'cleaning', 'ready', 'picked_up'];
  const at = steps.indexOf(o.status);
  const progress = steps
    .map((s, i) => {
      const cls = i < at || o.status === 'picked_up' ? 'done' : i === at ? 'current' : '';
      return `${i ? `<div class="bar ${i <= at ? 'done' : ''}"></div>` : ''}<div class="step ${cls}"><div class="dot">${cls === 'done' ? icon('check', 'sm') : i + 1}</div><span class="label">${statusLabel(s)}</span></div>`;
    })
    .join('');

  app.innerHTML = `
    <a class="back" href="#/orders">${icon('back', 'sm')}${t('Orders')}</a>
    ${pageHead(`${t('Order #{ticket}', { ticket: esc(o.ticket) })} ${pill(o.status)}`,
      t('{name} · dropped off {date}', { name: esc(o.customer_name), date: dateTime(o.created_at) }),
      `<button class="btn" id="print">${icon('printer')}${t('Print ticket')}</button>
       ${next ? `<button class="btn btn-primary btn-lg" data-advance="${o.id}" data-status="${next[0]}">${icon(next[0] === 'picked_up' ? 'check' : next[0] === 'ready' ? 'bell' : 'sparkle')}${t(next[1])}</button>` : ''}`)}
    <div class="card card-body" style="margin-bottom:20px">
      ${o.status === 'cancelled' ? `<div class="callout">${icon('alert', 'sm')}${t('This order was cancelled.')}</div>` : `<div class="progress">${progress}</div>`}
    </div>
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('shirt')}<h2>${t('Items')}</h2><span class="spacer"></span><span class="hint">${tn(o.piece_count, '{n} piece', '{n} pieces')}</span></div>
          <table class="items-table"><thead><tr><th>${t('Item')}</th><th class="num">${t('Qty')}</th><th class="num hide-md">${t('Each')}</th><th class="num">${t('Total')}</th></tr></thead>
            <tbody>${o.items.map((i) => `<tr><td>${esc(i.description)}</td><td class="num">${i.qty}</td><td class="num hide-md">${money(i.price_cents)}</td><td class="num">${money(i.qty * i.price_cents)}</td></tr>`).join('')}</tbody></table>
          <div class="card-body">
            <div class="totals" style="max-width:320px;margin-left:auto">
              <div><span>${t('Subtotal')}</span><span>${money(o.subtotal_cents)}</span></div>
              ${o.discount_cents ? `<div><span>${t('Discount')}</span><span>-${money(o.discount_cents)}</span></div>` : ''}
              ${o.tax_cents ? `<div><span>${t('Tax ({rate}%)', { rate: o.tax_rate })}</span><span>${money(o.tax_cents)}</span></div>` : ''}
              <div class="grand"><span>${t('Total')}</span><span>${money(o.total_cents)}</span></div>
              <div><span>${t('Amount paid')}</span><span>${money(o.paid_cents)}</span></div>
              <div class="strong" style="color:var(--text)"><span>${t('Balance')}</span><span class="${o.balance_cents > 0 ? 'danger-text' : ''}">${money(o.balance_cents)}</span></div>
            </div>
          </div>
          <div class="save-bar" style="justify-content:space-between;align-items:center">
            ${o.balance_cents > 0
              ? `<span class="small muted">${t('Take a payment')}</span><div class="row tight"><div class="money-input" style="width:120px"><input id="pay-amt" inputmode="decimal" value="${dollars(o.balance_cents)}"></div><button class="btn btn-primary" id="pay">${icon('dollar', 'sm')}${t('Record payment')}</button></div>`
              : `<span class="pill ready">${t('Paid in full')}</span><button class="btn btn-sm btn-ghost" id="refund">${t('Adjust payment')}</button>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head">${icon('message')}<h2>${t('Customer updates')}</h2><span class="spacer"></span>
            <button class="btn btn-sm" data-notify="ready">${icon('bell', 'sm')}${t('Send “ready”')}</button>
            <button class="btn btn-sm" data-notify="reminder">${icon('clock', 'sm')}${t('Send reminder')}</button></div>
          ${timeline(o.messages, { empty: emptyState('message', t('No updates sent yet'), settings.auto_notify_ready === '1' ? t('The customer is notified automatically when you mark this order ready.') : t('Use the buttons above to notify the customer.')) })}
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('user')}<h2>${t('Customer')}</h2></div>
          <div class="card-body stack sm">
            <a class="who-cell" href="#/customers/${o.customer_id}" style="color:inherit">${avatar(o.customer_name)}<div><div class="name-line">${esc(o.customer_name)}</div><div class="sub-line">${t('View profile')}</div></div></a>
            ${o.customer_phone ? `<div class="row tight small">${icon('phone', 'sm')}<a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></div>` : ''}
            ${o.customer_email ? `<div class="row tight small">${icon('mail', 'sm')}<span>${esc(o.customer_email)}</span></div>` : ''}
            ${o.customer_preferences ? `<div class="callout info">${icon('sparkle', 'sm')}<span>${esc(o.customer_preferences)}</span></div>` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card-head">${icon('edit')}<h2>${t('Details')}</h2></div>
          <div class="card-body stack">
            <label class="field">${t('Ticket number')}<input id="ticket" value="${esc(o.ticket)}" maxlength="21"></label>
            <label class="field">${t('Due date')}<input id="due" type="date" value="${esc(o.due_date)}"></label>
            <label class="field">${t('Rack / bin')}<input id="rack" value="${esc(o.rack)}" placeholder="${esc(t('e.g. A-12'))}"></label>
            <label class="field">${t('Notes')}<textarea id="notes" placeholder="${esc(t('Stains, damage, special instructions'))}">${esc(o.notes)}</textarea></label>
            ${o.ready_at || o.picked_up_at || o.reminder_count ? `<dl class="kv small">
              ${o.ready_at ? `<dt>${t('Ready')}</dt><dd>${dateTime(o.ready_at)}</dd>` : ''}
              ${o.picked_up_at ? `<dt>${t('Picked up')}</dt><dd>${dateTime(o.picked_up_at)}</dd>` : ''}
              ${o.reminder_count ? `<dt>${t('Reminders')}</dt><dd>${t('{n} sent, last {date}', { n: o.reminder_count, date: dateTime(o.last_reminder_at) })}</dd>` : ''}</dl>` : ''}
          </div>
          <div class="save-bar"><button class="btn" id="save-details">${t('Save details')}</button></div>
        </div>
        <div class="card card-body stack sm">
          <label class="field">${t('Change status')}
            <div class="row tight"><select id="status-sel" style="flex:1">${Object.keys(STATUS_LABEL).map((k) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${esc(statusLabel(k))}</option>`).join('')}</select>
            <button class="btn" id="set-status">${t('Update')}</button></div></label>
        </div>
      </div>
    </div>
    <div class="ticket">
      <h3>${esc(settings.business_name)}</h3>
      <div style="text-align:center">${esc(settings.business_phone)}</div>
      <div class="big">#${esc(o.ticket)}</div>
      <div>${esc(o.customer_name)} ${esc(o.customer_phone)}</div>
      <div>${t('In: {date}', { date: shortDate(o.created_at) })} &nbsp; ${t('Due: {date}', { date: esc(o.due_date) })}</div>
      ${o.rack ? `<div>${t('Rack: {rack}', { rack: esc(o.rack) })}</div>` : ''}
      <hr><table>${o.items.map((i) => `<tr><td>${i.qty} × ${esc(i.description)}</td><td style="text-align:right">${money(i.qty * i.price_cents)}</td></tr>`).join('')}</table><hr>
      <table><tr><td>${t('Total')}</td><td style="text-align:right">${money(o.total_cents)}</td></tr>
      <tr><td>${t('Amount paid')}</td><td style="text-align:right">${money(o.paid_cents)}</td></tr>
      <tr><td><strong>${t('Balance')}</strong></td><td style="text-align:right"><strong>${money(o.balance_cents)}</strong></td></tr></table>
      ${o.notes ? `<p>${esc(o.notes)}</p>` : ''}
    </div>`;

  $('#print').onclick = () => window.print();
  $('#set-status').onclick = (e) => busy(e.currentTarget, async () => {
    const status = $('#status-sel').value;
    if (status === 'cancelled' && !confirm(t('Cancel this order?'))) return;
    const r = await api('POST', `/orders/${id}/status`, { status });
    messageToast(r.messages, t(MARKED[status], { ticket: r.order.ticket }));
    route();
  });
  $('#save-details').onclick = (e) => busy(e.currentTarget, async () => {
    const body = { due_date: $('#due').value, rack: $('#rack').value, notes: $('#notes').value };
    const ticketChanged = cleanTicket($('#ticket').value) !== o.ticket;
    if (ticketChanged) body.ticket = $('#ticket').value;
    await api('PUT', '/orders/' + id, body);
    toast(t('Details saved'));
    if (ticketChanged) route();
  });
  if ($('#pay')) {
    $('#pay').onclick = (e) => busy(e.currentTarget, async () => {
      await api('POST', `/orders/${id}/payment`, { amount_cents: toCents($('#pay-amt').value) });
      toast(t('Payment recorded'));
      route();
    });
  }
  if ($('#refund')) {
    $('#refund').onclick = () => {
      const m = modal(t('Adjust payment'), `<form class="card-body stack" id="adj">
        <p class="small muted">${t('Enter a negative amount to record a refund.')}</p>
        <label class="field">${t('Amount')}<div class="money-input"><input name="amt" inputmode="decimal" placeholder="-5.00" required></div></label>
        <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>${t('Cancel')}</button><button class="btn btn-primary">${t('Save')}</button></div></form>`);
      $('#adj', m.el).onsubmit = (e) => {
        e.preventDefault();
        busy(e.submitter, async () => {
          await api('POST', `/orders/${id}/payment`, { amount_cents: toCents(e.target.amt.value) });
          m.close();
          route();
        });
      };
    };
  }
  $$('[data-notify]').forEach((b) => (b.onclick = () => busy(b, async () => {
    messageToast(await api('POST', `/orders/${id}/notify`, { kind: b.dataset.notify }));
    route();
  })));
};

views.customers = async (_, query) => {
  setTitle(t('Customers'));
  const q = query.get('q') || '';
  const list = await api('GET', '/customers?q=' + encodeURIComponent(q));
  app.innerHTML = `
    ${pageHead(t('Customers'), t('Everyone who has dropped off with you.'), `<button class="btn btn-primary" id="add">${icon('plus')}${t('Add customer')}</button>`)}
    <form class="search" id="sf" style="margin-bottom:16px;max-width:420px">${icon('search')}<input id="q" value="${esc(q)}" placeholder="${esc(t('Search name, phone or email'))}"></form>
    <div class="card">${
      list.length
        ? `<div class="list"><div class="list-row customer-row list-head hide-md"><div>${t('Name')}</div><div>${t('Phone')}</div><div>${t('Email')}</div><div>${t('Orders')}</div><div></div></div>
          ${list.map((c) => `<div class="list-row customer-row click" data-href="#/customers/${c.id}">
            <div class="who-cell">${avatar(c.name)}<div><div class="name-line">${esc(c.name)}</div><div class="sub-line">${esc(c.preferences || (c.last_order_at ? t('Last visit {date}', { date: shortDate(c.last_order_at) }) : t('No orders yet')))}</div></div></div>
            <div class="small hide-md">${esc(c.phone || '—')}</div>
            <div class="small hide-md sub-line">${esc(c.email || '—')}</div>
            <div class="small hide-md">${c.order_count}</div>
            <div class="row-action">${c.open_orders ? `<span class="pill ready plain">${t('{n} active', { n: c.open_orders })}</span>` : ''}</div>
          </div>`).join('')}</div>`
        : q
          ? emptyState('search', t('No matching customers'), t('Nothing matches “{q}”.', { q: esc(q) }))
          : emptyState('users', t('No customers yet'), t('Customers are added when you create their first order, or add one now.'))
    }</div>`;
  let timer;
  const go = () => (location.hash = '#/customers' + ($('#q').value.trim() ? '?q=' + encodeURIComponent($('#q').value.trim()) : ''));
  $('#q').oninput = () => { clearTimeout(timer); timer = setTimeout(go, 350); };
  $('#sf').onsubmit = (e) => { e.preventDefault(); go(); };
  if (q) { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  $('#add').onclick = () => customerModal(null);
};

function customerModal(c) {
  const m = modal(c ? t('Edit customer') : t('Add customer'), `<form class="card-body stack" id="cf">
    <label class="field">${t('Name')}<input name="name" value="${esc(c?.name)}" required></label>
    <div class="form" style="grid-template-columns:1fr 1fr">
      <label class="field">${t('Mobile phone')}<input name="phone" type="tel" value="${esc(c?.phone)}"></label>
      <label class="field">${t('Email')}<input name="email" type="email" value="${esc(c?.email)}"></label>
    </div>
    <label class="field">${t('Preferences')}<input name="preferences" value="${esc(c?.preferences)}" placeholder="${esc(t('e.g. no starch, boxed shirts'))}"></label>
    <label class="field">${t('Notes')}<textarea name="notes" rows="2">${esc(c?.notes)}</textarea></label>
    <div class="stack sm">
      <label class="check"><input type="checkbox" name="sms_opt_in" ${!c || c.sms_opt_in ? 'checked' : ''}><span>${t('Text message updates')}<small>${t('Order ready notices and pickup reminders by text')}</small></span></label>
      <label class="check"><input type="checkbox" name="email_opt_in" ${!c || c.email_opt_in ? 'checked' : ''}><span>${t('Email updates')}<small>${t('The same notices by email')}</small></span></label>
    </div>
    <div class="row">${c ? `<button type="button" class="btn btn-danger" id="del">${icon('trash', 'sm')}${t('Delete')}</button>` : ''}<span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-close>${t('Cancel')}</button><button class="btn btn-primary">${c ? t('Save changes') : t('Add customer')}</button></div>
  </form>`);
  const form = $('#cf', m.el);
  form.onsubmit = (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.sms_opt_in = form.sms_opt_in.checked;
    body.email_opt_in = form.email_opt_in.checked;
    busy(e.submitter, async () => {
      const saved = c ? await api('PUT', '/customers/' + c.id, body) : await api('POST', '/customers', body);
      m.close();
      toast(c ? t('Customer saved') : t('Customer added'));
      if (c) route();
      else location.hash = '#/customers/' + saved.id;
    });
  };
  if (c) {
    $('#del', m.el).onclick = (e) => {
      if (!confirm(t('Delete {name}? This can’t be undone.', { name: c.name }))) return;
      busy(e.currentTarget, async () => {
        await api('DELETE', '/customers/' + c.id);
        m.close();
        toast(t('Customer deleted'));
        location.hash = '#/customers';
      });
    };
  }
}

views.customer = async ([id]) => {
  const c = await api('GET', '/customers/' + id);
  setTitle(c.name);
  const open = c.orders.filter((o) => ['received', 'cleaning', 'ready'].includes(o.status)).length;
  const stat = (tone, ic, label, value) => `<div class="stat"><div class="stat-icon tone-${tone}">${icon(ic)}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div></div>`;
  const on = (v) => (v ? `<span class="pill ready plain">${t('On')}</span>` : `<span class="pill cancelled plain">${t('Off')}</span>`);
  const first = esc(c.name.split(' ')[0]);

  app.innerHTML = `
    <a class="back" href="#/customers">${icon('back', 'sm')}${t('Customers')}</a>
    <div class="page-head"><div class="who-cell">${avatar(c.name, 'lg')}<div><h1>${esc(c.name)}</h1>
      <p class="sub">${esc([c.phone, c.email].filter(Boolean).join(' · ') || t('No contact details'))}</p></div></div>
      <div class="actions"><button class="btn" id="edit">${icon('edit', 'sm')}${t('Edit')}</button>
        <a class="btn btn-primary" href="#/orders/new?customer=${c.id}">${icon('plus')}${t('New order')}</a></div></div>
    <div class="stats">
      ${stat('primary', 'receipt', t('Orders'), c.orders.length)}
      ${stat('ready', 'shirt', t('Active orders'), open)}
      ${stat('cleaning', 'dollar', t('Lifetime spend'), money(c.lifetime_value_cents))}
      ${stat('received', 'clock', t('Customer since'), shortDate(c.created_at))}
    </div>
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card"><div class="card-head">${icon('receipt')}<h2>${t('Orders')}</h2></div>
          ${orderList(c.orders, { empty: emptyState('receipt', t('No orders yet'), '', `<a class="btn btn-primary" href="#/orders/new?customer=${c.id}">${icon('plus')}${t('Create their first order')}</a>`) })}</div>
        <div class="card"><div class="card-head">${icon('message')}<h2>${t('Messages')}</h2></div>${timeline(c.messages)}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-head">${icon('user')}<h2>${t('Profile')}</h2></div>
          <div class="card-body stack">
            <dl class="kv">
              <dt>${t('Phone')}</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd>
              <dt>${t('Email')}</dt><dd>${esc(c.email || '—')}</dd>
              <dt>${t('Texts')}</dt><dd>${c.phone ? on(c.sms_opt_in) : `<span class="muted small">${t('No phone number')}</span>`}</dd>
              <dt>${t('Emails')}</dt><dd>${c.email ? on(c.email_opt_in) : `<span class="muted small">${t('No email address')}</span>`}</dd>
            </dl>
            ${c.preferences ? `<div class="callout info">${icon('sparkle', 'sm')}<span>${esc(c.preferences)}</span></div>` : ''}
            ${c.notes ? `<p class="small" style="white-space:pre-line">${esc(c.notes)}</p>` : ''}
          </div></div>
        <div class="card"><div class="card-head">${icon('send')}<h2>${t('Send a message')}</h2></div>
          <div class="card-body stack sm">
            <div class="chips">
              <button type="button" class="chip ${c.phone ? 'active' : ''}" data-ch="sms" ${c.phone ? '' : `disabled title="${esc(t('No phone number'))}"`}>${icon('phone', 'sm')} ${t('Text')}</button>
              <button type="button" class="chip ${!c.phone && c.email ? 'active' : ''}" data-ch="email" ${c.email ? '' : `disabled title="${esc(t('No email address'))}"`}>${icon('mail', 'sm')} ${t('Email')}</button>
            </div>
            <input id="subj" placeholder="${esc(t('Email subject'))}">
            <textarea id="msg" placeholder="${esc(t('Write a message to {name}…', { name: first }))}"></textarea>
            <button class="btn btn-primary" id="send">${icon('send', 'sm')}${t('Send')}</button>
          </div></div>
      </div>
    </div>`;

  const chans = () => $$('[data-ch].active').map((b) => b.dataset.ch);
  const syncSubject = () => ($('#subj').hidden = !chans().includes('email'));
  $$('[data-ch]').forEach((b) => (b.onclick = () => { b.classList.toggle('active'); syncSubject(); }));
  syncSubject();
  $('#edit').onclick = () => customerModal(c);
  $('#send').onclick = (e) => {
    if (!chans().length) return toast(t('Choose text and/or email'));
    if (!$('#msg').value.trim()) return $('#msg').focus();
    busy(e.currentTarget, async () => {
      messageToast(await api('POST', `/customers/${id}/message`, { body: $('#msg').value, subject: $('#subj').value, channels: chans() }));
      route();
    });
  };
};

views.services = async () => {
  setTitle(t('Price list'));
  const list = await api('GET', '/services');
  const owner = isOwner();
  const cats = [...new Set(list.map((s) => s.category))];
  app.innerHTML = `
    ${pageHead(t('Price list'), owner ? t('Changes save automatically. These appear as buttons when you create an order.') : t('Only the shop owner can change prices.'),
      owner ? `<button class="btn btn-primary" id="add">${icon('plus')}${t('Add service')}</button>` : '')}
    <div class="stack">${
      cats.length
        ? cats.map((cat) => `<div class="card"><div class="card-head"><h2>${esc(cat)}</h2><span class="spacer"></span><span class="hint">${tn(list.filter((s) => s.category === cat).length, '{n} service', '{n} services')}</span></div>
          ${list.filter((s) => s.category === cat).map((s) => `<div class="price-row ${s.active ? '' : 'inactive'}" data-id="${s.id}">
            <input class="name-input" value="${esc(s.name)}" ${owner ? '' : 'disabled'} aria-label="${esc(t('Service name'))}">
            <div class="money-input"><input class="price" inputmode="decimal" value="${dollars(s.price_cents)}" ${owner ? '' : 'disabled'} aria-label="${esc(t('Price'))}"></div>
            <div class="row tight">${owner ? `
              <label class="check small" title="${esc(t('Show when creating orders'))}"><input type="checkbox" class="active" ${s.active ? 'checked' : ''}><span class="hide-md">${t('Active')}</span></label>
              <button class="btn btn-ghost btn-icon del" title="${esc(t('Remove'))}" aria-label="${esc(t('Remove'))}">${icon('trash', 'sm')}</button>` : s.active ? '' : `<span class="pill cancelled plain">${t('Hidden')}</span>`}</div>
          </div>`).join('')}</div>`).join('')
        : `<div class="card">${emptyState('tag', t('Your price list is empty'), t('Add the services you offer and their prices.'))}</div>`
    }</div>`;

  if (!owner) return;
  const save = async (row, body) => {
    try {
      await api('PUT', '/services/' + row.dataset.id, body);
      toast(t('Saved'));
    } catch (e) { toast(e.message); }
  };
  $$('.price-row').forEach((row) => {
    $('.name-input', row).onchange = (e) => save(row, { name: e.target.value });
    $('.price', row).onchange = (e) => { e.target.value = dollars(toCents(e.target.value)); save(row, { price_cents: toCents(e.target.value) }); };
    $('.active', row).onchange = (e) => { row.classList.toggle('inactive', !e.target.checked); save(row, { active: e.target.checked }); };
    $('.del', row).onclick = async () => {
      if (!confirm(t('Remove this service?'))) return;
      const r = await api('DELETE', '/services/' + row.dataset.id);
      toast(r.deactivated ? t('Used on past orders, so it was hidden instead') : t('Removed'));
      route();
    };
  });
  $('#add').onclick = () => {
    const m = modal(t('Add service'), `<form class="card-body stack" id="sf">
      <label class="field">${t('Service name')}<input name="name" required placeholder="${esc(t('e.g. Silk blouse'))}"></label>
      <div class="form" style="grid-template-columns:1fr 1fr">
        <label class="field">${t('Category')}<input name="category" list="cat-list" value="${esc(cats[0] || 'Dry Clean')}" required>
          <datalist id="cat-list">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field">${t('Price')}<div class="money-input"><input name="price" inputmode="decimal" placeholder="0.00" required></div></label>
      </div>
      <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>${t('Cancel')}</button><button class="btn btn-primary">${t('Add service')}</button></div></form>`);
    $('#sf', m.el).onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      busy(e.submitter, async () => {
        await api('POST', '/services', { name: f.name.value, category: f.category.value, price_cents: toCents(f.price.value) });
        m.close();
        toast(t('Service added'));
        route();
      });
    };
  };
};

views.messages = async (_, query) => {
  setTitle(t('Messages'));
  const filter = query.get('show') || '';
  const [list, settings] = await Promise.all([
    api('GET', '/messages' + (filter === 'sms' || filter === 'email' ? '?channel=' + filter : '')),
    api('GET', '/settings'),
  ]);
  const shown = filter === 'replies' ? list.filter((m) => m.direction === 'in') : list;
  const smsOff = settings.channels.sms === 'log';
  const emailOff = settings.channels.email === 'log';
  const what = smsOff && emailOff ? t('texts and emails') : smsOff ? t('texts') : t('emails');
  app.innerHTML = `
    ${pageHead(t('Messages'), t('Every text and email sent to customers, and their replies.'))}
    ${smsOff || emailOff ? `<div class="callout warn" style="margin-bottom:16px">${icon('alert', 'sm')}<span>${t('Sending {what} isn’t connected yet, so those messages are saved here but not delivered.', { what })}${isOwner() ? ` <a href="#/settings?tab=notifications">${t('See notification settings.')}</a>` : ''}</span></div>` : ''}
    <div class="tabs" style="margin-bottom:16px">${[['', t('All')], ['sms', t('Texts')], ['email', t('Emails')], ['replies', t('Replies')]]
      .map(([k, l]) => `<button data-show="${k}" class="${k === filter ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="card">${timeline(shown, { showCustomer: true, empty: emptyState('message', t('No messages yet'), t('Messages appear here when you mark orders ready or send reminders.')) })}</div>`;
  $$('[data-show]').forEach((b) => (b.onclick = () => (location.hash = '#/messages' + (b.dataset.show ? '?show=' + b.dataset.show : ''))));
};

const PROVIDER_LABEL = { twilio: 'Twilio', resend: 'Resend', sendgrid: 'SendGrid', postmark: 'Postmark' };
const SETTINGS_TABS = [
  ['business', 'store', N_('Business')],
  ['notifications', 'bell', N_('Notifications')],
  ['wording', 'edit', N_('Message wording')],
  ['team', 'users', N_('Team')],
  ['account', 'lock', N_('My account')],
];
views.settings = async (_, query) => {
  setTitle(t('Settings'));
  const tab = SETTINGS_TABS.some(([k]) => k === query.get('tab')) ? query.get('tab') : 'business';
  const [s, team] = await Promise.all([api('GET', '/settings'), api('GET', '/team')]);
  const owner = isOwner();
  const ro = owner ? '' : 'disabled';
  const field = (name, label, attrs = '', help = '') =>
    `<label class="field">${label}<input name="${name}" value="${esc(s[name])}" ${attrs} ${ro}>${help ? `<span class="help">${help}</span>` : ''}</label>`;
  const area = (name, label, rows = 3) => `<label class="field full">${label}<textarea name="${name}" rows="${rows}" ${ro}>${esc(s[name])}</textarea></label>`;
  const check = (name, label, help) =>
    `<label class="check"><input name="${name}" type="checkbox" ${s[name] === '1' ? 'checked' : ''} ${ro}><span>${label}<small>${help}</small></span></label>`;
  const saveBar = owner ? `<div class="save-bar"><button class="btn btn-primary" data-save>${t('Save changes')}</button></div>` : '';
  const conn = (mode, label, notConnected) => `<div class="status-line ${mode !== 'log' ? 'on' : ''}"><span class="dot"></span>
    <div style="flex:1"><div class="strong">${label}</div><div class="small muted">${mode !== 'log' ? t('Connected via {provider}', { provider: esc(PROVIDER_LABEL[mode] || mode) }) : notConnected}</div></div></div>`;

  const panes = {
    business: `<div class="card"><div class="card-head"><h2>${t('Business details')}</h2><span class="hint">${t('Shown on tickets, texts and emails')}</span></div>
      <div class="card-body form">
        ${field('business_name', t('Business name'))}
        ${field('business_phone', t('Phone'))}
        ${field('business_email', t('Email'), 'type="email"', t('Customer email replies go here'))}
        ${field('business_address', t('Address'))}
        ${field('tax_rate', t('Sales tax (%)'), 'inputmode="decimal"')}
        ${field('default_turnaround_days', t('Usual turnaround (days)'), 'type="number" min="0"', t('Sets the default due date on new orders'))}
        <label class="field">${t('Ticket numbers')}<select name="ticket_mode" ${ro}>
          <option value="manual" ${s.ticket_mode === 'manual' ? 'selected' : ''}>${t('Use my paper ticket numbers')}</option>
          <option value="auto" ${s.ticket_mode !== 'manual' ? 'selected' : ''}>${t('Number orders automatically')}</option></select>
          <span class="help">${t('With paper tickets, staff type the number when writing up an order')}</span></label>
      </div>${saveBar}</div>`,
    notifications: `<div class="stack">
      <div class="card"><div class="card-head"><h2>${t('Connections')}</h2></div><div class="card-body stack sm">
        ${conn(s.channels.sms, t('Text messages'), t('Not connected yet. Texts are saved in Messages but not delivered.'))}
        ${conn(s.channels.email, t('Email'), t('Not connected yet. Emails are saved in Messages but not delivered.'))}</div></div>
      <div class="card"><div class="card-head"><h2>${t('When to notify customers')}</h2></div>
        <div class="card-body stack">
          ${check('auto_notify_ready', t('Notify customers when their order is ready'), t('Sent the moment you mark an order Ready'))}
          ${check('notify_sms', t('Send text messages'), t('To customers with a mobile number'))}
          ${check('notify_email', t('Send emails'), t('To customers with an email address'))}
          <div class="form" style="border-top:1px solid var(--border);padding-top:16px">
            ${field('reminder_after_days', t('First pickup reminder after'), 'type="number" min="0"', t('Days after the order is ready'))}
            ${field('reminder_interval_days', t('Then remind every'), 'type="number" min="1"', t('Days between reminders'))}
            ${field('max_reminders', t('Stop after'), 'type="number" min="0"', t('Reminders per order (0 turns them off)'))}
          </div>
        </div>${saveBar}</div>
      ${owner ? `<div class="card"><div class="card-head"><h2>${t('Send yourself a test')}</h2></div>
        <div class="card-body stack sm">
          <div class="row"><input id="test-phone" type="tel" placeholder="${esc(t('Your mobile number'))}" style="flex:1;min-width:180px"><button class="btn" data-test="sms">${icon('phone', 'sm')}${t('Send test text')}</button></div>
          <div class="row"><input id="test-email" type="email" placeholder="${esc(t('Your email address'))}" style="flex:1;min-width:180px"><button class="btn" data-test="email">${icon('mail', 'sm')}${t('Send test email')}</button></div>
        </div></div>` : ''}
    </div>`,
    wording: `<div class="card"><div class="card-head"><h2>${t('Message wording')}</h2></div>
      <div class="card-body stack">
        <div class="stack sm"><span class="small muted">${t('Use these to fill in details automatically:')}</span>
          <div class="placeholder-list">${['name', 'ticket', 'business', 'balance', 'total', 'pieces', 'ready_date', 'due_date', 'phone', 'address'].map((p) => `<code>{${p}}</code>`).join('')}</div></div>
        <div class="form">
          ${area('sms_template_ready', t('Text — order ready'), 3)}
          ${area('sms_template_reminder', t('Text — pickup reminder'), 3)}
          <p class="small muted full">${t('Texts end with “Reply STOP to opt out.” automatically.')}</p>
          ${field('email_subject_ready', t('Email subject — order ready'))}
          ${field('email_subject_reminder', t('Email subject — pickup reminder'))}
          ${area('email_body_ready', t('Email — order ready'), 8)}
          ${area('email_body_reminder', t('Email — pickup reminder'), 8)}
        </div>
      </div>${saveBar}</div>`,
    team: `<div class="card"><div class="card-head"><h2>${t('Team')}</h2><span class="spacer"></span>${owner ? `<button class="btn btn-primary btn-sm" id="t-add">${icon('plus', 'sm')}${t('Add person')}</button>` : ''}</div>
      <div class="list">${team.map((u) => `<div class="list-row" style="grid-template-columns:minmax(0,1fr) auto auto">
        <div class="who-cell">${avatar(u.name)}<div><div class="name-line">${esc(u.name)}${u.id === me.user.id ? ` <span class="muted small">${t('(you)')}</span>` : ''}</div><div class="sub-line">${esc(u.email)}</div></div></div>
        <span class="pill plain ${u.role === 'owner' ? 'picked_up' : 'received'}">${u.role === 'owner' ? t('Owner') : t('Staff')}</span>
        <div>${owner && u.id !== me.user.id ? `<button class="btn btn-ghost btn-icon" data-remove="${u.id}" title="${esc(t('Remove'))}" aria-label="${esc(t('Remove {name}', { name: u.name }))}">${icon('trash', 'sm')}</button>` : ''}</div>
      </div>`).join('')}</div>
      <div class="save-bar" style="justify-content:flex-start"><span class="small muted">${t('Staff can manage orders and customers. Owners can also change settings, prices and the team.')}</span></div></div>`,
    account: `<div class="card"><div class="card-head"><h2>${t('Change your password')}</h2></div>
      <form class="card-body form" id="pw">
        <label class="field">${t('Current password')}<input name="current_password" type="password" autocomplete="current-password" required></label>
        <label class="field">${t('New password')}<input name="new_password" type="password" autocomplete="new-password" minlength="8" required><span class="help">${t('At least 8 characters')}</span></label>
        <div class="full"><button class="btn btn-primary">${t('Update password')}</button></div>
      </form></div>`,
  };

  app.innerHTML = `
    ${pageHead(t('Settings'), owner ? '' : t('Only the shop owner can change shop settings.'))}
    <div class="grid sidebar-left">
      <nav class="settings-nav">${SETTINGS_TABS.map(([k, ic, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${icon(ic, 'sm')}${t(l)}</button>`).join('')}</nav>
      <div id="pane">${panes[tab]}</div>
    </div>`;

  $$('[data-tab]').forEach((b) => (b.onclick = () => (location.hash = '#/settings?tab=' + b.dataset.tab)));
  $$('[data-save]').forEach((b) => (b.onclick = () => busy(b, async () => {
    const body = {};
    $$('[name]', b.closest('.card')).forEach((el) => (body[el.name] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value));
    const saved = await api('PUT', '/settings', body);
    me.shop.name = saved.business_name;
    $('#brand').textContent = saved.business_name;
    toast(t('Settings saved'));
  })));
  $$('[data-test]').forEach((b) => (b.onclick = () => busy(b, async () => {
    const channel = b.dataset.test;
    messageToast(await api('POST', '/settings/test-message', { channel, to: $(channel === 'sms' ? '#test-phone' : '#test-email').value }));
  })));
  if ($('#t-add')) {
    $('#t-add').onclick = () => {
      const m = modal(t('Add a team member'), `<form class="card-body stack" id="tf">
        <label class="field">${t('Name')}<input name="name" required></label>
        <label class="field">${t('Email')}<input name="email" type="email" required></label>
        <label class="field">${t('Temporary password')}<input name="password" minlength="8" required><span class="help">${t('Share it with them. They can change it under My account.')}</span></label>
        <label class="field">${t('Role')}<select name="role"><option value="staff">${t('Staff — orders and customers')}</option><option value="owner">${t('Owner — everything')}</option></select></label>
        <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>${t('Cancel')}</button><button class="btn btn-primary">${t('Add')}</button></div></form>`);
      $('#tf', m.el).onsubmit = (e) => {
        e.preventDefault();
        busy(e.submitter, async () => {
          await api('POST', '/team', Object.fromEntries(new FormData(e.target)));
          m.close();
          toast(t('Team member added'));
          route();
        });
      };
    };
  }
  $$('[data-remove]').forEach((b) => (b.onclick = () => {
    if (!confirm(t('Remove this person? They will be logged out.'))) return;
    busy(b, async () => { await api('DELETE', '/team/' + b.dataset.remove); route(); });
  }));
  if ($('#pw')) {
    $('#pw').onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        await api('PUT', '/me/password', Object.fromEntries(new FormData(e.target)));
        e.target.reset();
        toast(t('Password updated'));
      });
    };
  }
};

// ---------- router ----------
const ROUTES = [
  [/^\/?$/, views.dashboard, 'dashboard'],
  [/^\/dashboard$/, views.dashboard, 'dashboard'],
  [/^\/orders$/, views.orders, 'orders'],
  [/^\/orders\/new$/, views.newOrder, 'orders'],
  [/^\/orders\/(\d+)$/, views.order, 'orders'],
  [/^\/customers$/, views.customers, 'customers'],
  [/^\/customers\/(\d+)$/, views.customer, 'customers'],
  [/^\/services$/, views.services, 'services'],
  [/^\/messages$/, views.messages, 'messages'],
  [/^\/settings$/, views.settings, 'settings'],
];

// A view can expose its in-progress state here so a language switch can redraw
// the page without losing it (the new order screen uses this).
let viewState = null;
let lastPath = null;
async function route(restore) {
  const [path, qs] = location.hash.slice(1).split('?');
  const query = new URLSearchParams(qs || '');
  $('#shell').classList.remove('nav-open');
  viewState = null;
  for (const [re, view, nav] of ROUTES) {
    const m = (path || '/').match(re);
    if (!m) continue;
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    // Keep scroll position when re-rendering the same page (e.g. after an action).
    const samePage = lastPath === path;
    const y = window.scrollY;
    try {
      await view(m.slice(1), query, restore);
    } catch (e) {
      app.innerHTML = `<div class="card">${emptyState('alert', t('Something went wrong'), esc(e.message), `<a class="btn" href="#/dashboard">${t('Back to dashboard')}</a>`)}</div>`;
    }
    window.scrollTo(0, samePage ? y : 0);
    lastPath = path;
    return;
  }
  location.hash = '#/dashboard';
}

// Redraw the current page in the new language, keeping anything typed so far.
async function switchLanguage() {
  if (!me) return;
  $('#role').textContent = me.user.role === 'owner' ? t('Owner') : t('Staff');
  const typed = $$('input, textarea, select', app)
    .filter((el) => (el.id || el.name) && el.type !== 'file')
    .map((el) => ({ key: el.id ? '#' + el.id : `[name="${el.name}"]`, value: el.value, checked: el.checked }));
  await route(viewState ? viewState() : undefined);
  for (const { key, value, checked } of typed) {
    const el = $(key, app);
    if (!el) continue;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = checked;
    else if (el.value !== value) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

$('#logout').onclick = async () => {
  await api('POST', '/auth/logout').catch(() => {});
  location.href = '/login.html';
};
$('#menu').onclick = () => $('#shell').classList.add('nav-open');
$('#scrim').onclick = () => $('#shell').classList.remove('nav-open');

hydrateIcons();
I18N.mount();
I18N.onChange(switchLanguage);
window.addEventListener('hashchange', () => route());
api('GET', '/me')
  .then((m) => {
    me = m;
    $('#brand').textContent = m.shop.name;
    $('#who').textContent = m.user.name;
    $('#role').textContent = m.user.role === 'owner' ? t('Owner') : t('Staff');
    $('#me-avatar').outerHTML = avatar(m.user.name);
    route();
  })
  .catch(() => {});
