'use strict';

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (c) => (Number(c) < 0 ? '-$' : '$') + (Math.abs(Number(c || 0)) / 100).toFixed(2);
const toCents = (v) => Math.round(parseFloat(String(v).replace(/[^0-9.\-]/g, '')) * 100) || 0;
const dollars = (c) => (Number(c || 0) / 100).toFixed(2);
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD
const parseUtc = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
const dateTime = (s) => (s ? parseUtc(s).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const shortDate = (s) => (s ? parseUtc(s).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cleanTicket = (v) => String(v || '').trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();

function dueLabel(d) {
  if (!d) return '';
  const t = localDate();
  const tomorrow = localDate(new Date(Date.now() + 864e5));
  if (d === t) return 'Due today';
  if (d === tomorrow) return 'Due tomorrow';
  const nice = new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return d < t ? `Overdue · ${nice}` : `Due ${nice}`;
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
  wand: '<path d="m15 4 5 5M3 21l12-12M14 3l1 1M20 9l1 1M17 2v2M22 7h-2"/>',
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

const STATUS_LABEL = { received: 'Received', cleaning: 'Cleaning', ready: 'Ready', picked_up: 'Picked up', cancelled: 'Cancelled' };
const NEXT = { received: ['cleaning', 'Start cleaning'], cleaning: ['ready', 'Mark ready'], ready: ['picked_up', 'Picked up'] };
const MSG_STATUS = { sent: 'Sent', logged: 'Not sent (not connected)', failed: 'Failed', skipped: 'Skipped', received: 'Reply' };
const pill = (s) => `<span class="pill ${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;
const msgPill = (m) => `<span class="pill ${m.direction === 'in' ? 'reply' : esc(m.status)}">${esc(m.direction === 'in' ? 'Reply' : MSG_STATUS[m.status] || m.status)}</span>`;

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('Please log in');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let me = null;
const isOwner = () => me && me.user.role === 'owner';

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

const CHANNEL_LABEL = { sms: 'Text', email: 'Email' };
function messageToast(list, prefix = '') {
  list = [].concat(list || []);
  if (!list.length) return prefix && toast(prefix);
  const parts = list.map((m) => {
    const ch = CHANNEL_LABEL[m.channel] || m.channel;
    if (m.status === 'sent') return `${ch} sent`;
    if (m.status === 'logged') return `${ch} saved (not connected yet)`;
    return `${ch} ${m.status}${m.error ? ': ' + m.error : ''}`;
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
    <div class="card-head"><h2>${esc(title)}</h2><span class="spacer"></span><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
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

function setTitle(t) {
  $('#topbar-title').textContent = t;
  document.title = `${t} · ${me ? me.shop.name : 'Dry Cleaner CRM'}`;
}

const pageHead = (title, sub = '', actions = '') => `
  <div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
  ${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;

const emptyState = (ic, title, text = '', action = '') =>
  `<div class="empty-state">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;

// ---------- shared renderers ----------
function orderList(list, { empty = emptyState('receipt', 'No orders here', 'New orders will show up in this list.') } = {}) {
  if (!list.length) return empty;
  return `<div class="list">
    <div class="list-row order-row list-head hide-md"><div>Ticket</div><div>Customer</div><div>Status</div><div>Due</div><div class="num">Total</div><div></div></div>
    ${list
      .map((o) => {
        const next = NEXT[o.status];
        const overdue = o.due_date && o.due_date < localDate() && ['received', 'cleaning'].includes(o.status);
        return `<div class="list-row order-row click" data-href="#/orders/${o.id}">
          <div><div class="ticket-no">#${esc(o.ticket)}</div><div class="sub-line">${plural(o.piece_count, 'pc')}</div></div>
          <div class="who-cell">${avatar(o.customer_name)}<div><div class="name-line">${esc(o.customer_name)}</div>
            <div class="sub-line">${esc(o.customer_phone || o.customer_email || '')}</div></div></div>
          <div class="hide-md">${pill(o.status)}</div>
          <div class="hide-md"><div class="small ${overdue ? 'danger-text strong' : ''}">${o.status === 'picked_up' ? 'Picked up ' + shortDate(o.picked_up_at) : esc(dueLabel(o.due_date))}</div>
            <div class="sub-line">${o.rack ? 'Rack ' + esc(o.rack) : ''}</div></div>
          <div class="num hide-md"><div class="strong">${money(o.total_cents)}</div>
            <div class="sub-line ${o.balance_cents > 0 ? 'danger-text' : ''}">${o.balance_cents > 0 ? money(o.balance_cents) + ' due' : 'Paid'}</div></div>
          <div class="row-action">${
            next
              ? `<button class="btn btn-sm ${next[0] === 'ready' ? 'btn-primary' : ''}" data-advance="${o.id}" data-status="${next[0]}">${next[0] === 'picked_up' ? icon('check', 'sm') : ''}${next[1]}</button>`
              : `<span class="md-only">${pill(o.status)}</span>`
          }</div>
        </div>`;
      })
      .join('')}</div>`;
}

function timeline(list, { showCustomer = false, empty = emptyState('message', 'No messages yet', 'Texts and emails to this customer will appear here.') } = {}) {
  if (!list.length) return empty;
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
        <div><div class="msg-meta">${who}<span>${esc(CHANNEL_LABEL[m.channel] || m.channel)} · ${esc(m.kind === 'reply' ? 'customer reply' : m.kind)}</span>
          ${m.order_id && m.ticket ? `<a href="#/orders/${m.order_id}">#${esc(m.ticket)}</a>` : ''}
          <span>${dateTime(m.created_at)}</span>${msgPill(m)}</div>
          <div class="msg-body">${m.subject ? `<strong>${esc(m.subject)}</strong>` : ''}${esc(m.body)}</div>
          ${m.error ? `<div class="tiny muted" style="margin-top:4px">${esc(m.error)}</div>` : ''}</div>
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
      messageToast(r.messages, `#${r.order.ticket} marked ${STATUS_LABEL[status].toLowerCase()}`);
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
  setTitle('Dashboard');
  const d = await api('GET', '/dashboard');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const stat = (href, tone, ic, label, value) =>
    `<a class="stat" href="${href}"><div class="stat-icon tone-${tone}">${icon(ic)}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div></a>`;

  app.innerHTML = `
    ${pageHead(`${greet}, ${esc(me.user.name.split(' ')[0])}`, new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
      `<a class="btn btn-primary btn-lg" href="#/orders/new">${icon('plus')}New order</a>`)}
    <form class="search lg" id="quick" style="margin-bottom:20px">${icon('search')}
      <input id="quick-q" placeholder="Find an order: ticket number, customer name or phone" autocomplete="off"></form>
    <div class="stats">
      ${stat('#/orders?status=received', 'received', 'receipt', 'Waiting to clean', d.by_status.received)}
      ${stat('#/orders?status=cleaning', 'cleaning', 'sparkle', 'Cleaning', d.by_status.cleaning)}
      ${stat('#/orders?status=ready', 'ready', 'check', 'Ready for pickup', d.by_status.ready)}
      ${stat('#/orders?status=open', 'primary', 'dollar', 'Sales today', money(d.sales_today_cents))}
    </div>
    <div class="grid two">
      <div class="card">
        <div class="card-head">${icon('clock')}<h2>Due today &amp; overdue</h2><span class="spacer"></span><span class="hint">${plural(d.due_or_overdue.length, 'order')}</span></div>
        ${orderList(d.due_or_overdue, { empty: emptyState('check', "You're all caught up", 'No orders are due today.') })}
      </div>
      <div class="card">
        <div class="card-head">${icon('bell')}<h2>Waiting for pickup</h2><span class="spacer"></span>
          ${d.reminders_due ? `<button class="btn btn-sm" id="run-rem">${icon('send', 'sm')}Send ${plural(d.reminders_due, 'reminder')}</button>` : `<span class="hint">Reminders go out automatically</span>`}</div>
        ${orderList(d.awaiting_pickup, { empty: emptyState('shirt', 'Nothing on the rack', 'Orders marked ready will show up here.') })}
      </div>
    </div>
    <p class="small muted" style="margin-top:16px">${plural(d.orders_today, 'order')} today · ${money(d.outstanding_balance_cents)} in unpaid balances · ${plural(d.customers, 'customer')}</p>`;

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
      toast(`Reminders sent for ${plural(r.sent.length, 'order')}`);
      route();
    });
  }
};

views.orders = async (_, query) => {
  setTitle('Orders');
  const status = query.has('status') ? query.get('status') : 'open';
  const q = query.get('q') || '';
  const [d, list] = await Promise.all([
    api('GET', '/dashboard'),
    api('GET', '/orders?' + new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })),
  ]);
  const c = d.by_status;
  const tabs = [
    ['open', 'Active', c.received + c.cleaning + c.ready],
    ['received', 'Waiting', c.received],
    ['cleaning', 'Cleaning', c.cleaning],
    ['ready', 'Ready', c.ready],
    ['picked_up', 'Picked up', c.picked_up],
    ['', 'All', null],
  ];
  app.innerHTML = `
    ${pageHead('Orders', 'Tap an order to see details, or move it along with one click.', `<a class="btn btn-primary" href="#/orders/new">${icon('plus')}New order</a>`)}
    <div class="row" style="margin-bottom:16px">
      <div class="tabs">${tabs.map(([k, l, n]) => `<button data-tab="${k}" class="${k === status ? 'active' : ''}">${l}${n != null ? `<span class="count">${n}</span>` : ''}</button>`).join('')}</div>
      <span class="spacer"></span>
      <form class="search" id="sf" style="width:min(320px,100%)">${icon('search')}<input id="q" value="${esc(q)}" placeholder="Ticket, name, phone or rack"></form>
    </div>
    <div class="card">${orderList(list, {
      empty: q
        ? emptyState('search', 'No matching orders', `Nothing matches “${esc(q)}”. Try a ticket number or phone number.`)
        : emptyState('receipt', 'No orders here', 'New orders will show up in this list.', `<a class="btn btn-primary" href="#/orders/new">${icon('plus')}New order</a>`),
    })}</div>`;

  const go = (s, text) => (location.hash = '#/orders?' + new URLSearchParams({ status: s, ...(text ? { q: text } : {}) }));
  $$('[data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab, $('#q').value.trim())));
  let t;
  $('#q').oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => go(status, $('#q').value.trim()), 350);
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

views.newOrder = async (_, query) => {
  setTitle('New order');
  const [services, settings] = await Promise.all([api('GET', '/services'), api('GET', '/settings')]);
  const active = services.filter((s) => s.active);
  const categories = [...new Set(active.map((s) => s.category))];
  const taxRate = Number(settings.tax_rate) || 0;
  const paperTickets = settings.ticket_mode === 'manual';
  const due = localDate(new Date(Date.now() + (Number(settings.default_turnaround_days) || 3) * 864e5));
  let customer = null;
  let cart = [];
  let category = '';
  let seq = 0;

  app.innerHTML = `
    <a class="back" href="#/orders">${icon('back', 'sm')}Orders</a>
    ${pageHead('New order', 'Pick the customer, tap what they dropped off, and create the ticket.')}
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card"><div class="card-head">${icon('user')}<h2>Customer</h2></div><div class="card-body" id="cust-box"></div></div>
        <div class="card">
          <div class="card-head">${icon('shirt')}<h2>Items</h2><span class="spacer"></span><span class="hint">Tap to add · tap again for more</span></div>
          <div class="card-body stack">
            <div class="chips" id="cats"></div>
            <div class="service-grid" id="tiles"></div>
            <form class="row" id="custom" style="border-top:1px solid var(--border);padding-top:16px">
              <input id="c-desc" placeholder="Something else? e.g. Wedding gown" style="flex:1;min-width:180px">
              <div class="money-input" style="width:110px"><input id="c-price" inputmode="decimal" placeholder="0.00"></div>
              <button class="btn">${icon('plus', 'sm')}Add</button>
            </form>
          </div>
        </div>
      </div>
      <div class="cart-bar" id="cart-bar" hidden><div><div class="strong" id="bar-total"></div><div class="tiny muted" id="bar-pcs"></div></div>
        <button class="btn btn-primary" id="bar-go">Review ticket</button></div>
      <div class="card cart" id="cart-card">
        <div class="card-head">${icon('receipt')}<h2>Ticket</h2><span class="spacer"></span><span class="hint" id="pcs"></span></div>
        <div class="card-body stack">
          ${paperTickets ? `<label class="field">Ticket number<input id="ticket" class="ticket-input" placeholder="From the paper ticket" autocomplete="off" maxlength="21">
            <span class="warn" id="ticket-warn" hidden></span></label>` : ''}
          <div class="cart-items" id="cart"></div>
          <div class="form" style="grid-template-columns:1fr 1fr">
            <label class="field">Due date<input id="due" type="date" value="${due}"></label>
            <label class="field">Rack / bin<input id="rack" placeholder="Optional"></label>
            <label class="field">Discount<div class="money-input"><input id="discount" inputmode="decimal" placeholder="0.00"></div></label>
            <label class="field">Paid now<div class="money-input"><input id="paid" inputmode="decimal" placeholder="0.00"></div></label>
            <label class="field full">Notes<textarea id="notes" rows="2" style="min-height:60px" placeholder="Stains, damage, special instructions"></textarea></label>
          </div>
          <div class="totals" id="totals"></div>
          <button class="btn btn-primary btn-lg btn-block" id="save">${icon('check')}Create order</button>
        </div>
      </div>
    </div>`;

  // --- customer picker ---
  const renderCustomer = () => {
    const box = $('#cust-box');
    if (customer) {
      box.innerHTML = `<div class="picked-customer">${avatar(customer.name)}
        <div style="flex:1;min-width:0"><div class="name-line">${esc(customer.name)}</div>
          <div class="sub-line">${esc([customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details')}</div></div>
        <button class="btn btn-sm btn-ghost" id="change">Change</button></div>
        ${customer.preferences ? `<div class="callout info" style="margin-top:12px">${icon('sparkle', 'sm')}<span><b>Preferences:</b> ${esc(customer.preferences)}</span></div>` : ''}`;
      $('#change').onclick = () => {
        customer = null;
        renderCustomer();
        update();
      };
      return;
    }
    box.innerHTML = `<div class="row">
      <div class="search" style="flex:1;min-width:200px">${icon('search')}<input id="cust-q" placeholder="Search by name or phone" autocomplete="off">
        <div class="suggest" id="suggest" hidden></div></div>
      <button class="btn" id="new-cust">${icon('plus', 'sm')}New customer</button></div>`;
    let st;
    $('#cust-q').oninput = () => {
      clearTimeout(st);
      st = setTimeout(async () => {
        const q = $('#cust-q').value.trim();
        const sug = $('#suggest');
        if (!q) return (sug.hidden = true);
        const list = await api('GET', '/customers?q=' + encodeURIComponent(q));
        sug.hidden = false;
        sug.innerHTML = list.length
          ? list.slice(0, 8).map((c, i) => `<button type="button" data-i="${i}">${avatar(c.name)}<div style="min-width:0"><div class="name-line">${esc(c.name)}</div><div class="sub-line">${esc(c.phone || c.email || '')}</div></div></button>`).join('')
          : `<button type="button" data-new>${icon('plus', 'sm')}Add “${esc(q)}” as a new customer</button>`;
        $$('[data-i]', sug).forEach((b) => (b.onclick = () => pick(list[b.dataset.i])));
        const nb = $('[data-new]', sug);
        if (nb) nb.onclick = () => newCustomer(q);
      }, 150);
    };
    $('#new-cust').onclick = () => newCustomer('');
    $('#cust-q').focus();
  };
  const pick = (c) => {
    customer = c;
    renderCustomer();
    update();
    if (paperTickets && !$('#ticket').value) $('#ticket').focus();
  };
  const newCustomer = (prefill) => {
    const looksLikePhone = /^[\d\s()+-]{7,}$/.test(prefill);
    const m = modal('New customer', `<form class="card-body stack" id="nc">
      <label class="field">Name<input name="name" value="${looksLikePhone ? '' : esc(prefill)}" required></label>
      <div class="form" style="grid-template-columns:1fr 1fr">
        <label class="field">Mobile phone<input name="phone" type="tel" value="${looksLikePhone ? esc(prefill) : ''}"></label>
        <label class="field">Email<input name="email" type="email"></label>
      </div>
      <label class="field">Preferences<input name="preferences" placeholder="e.g. light starch, shirts on hangers"></label>
      <p class="small muted">We'll text and/or email them when their order is ready.</p>
      <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save customer</button></div>
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
    $('#cats').innerHTML = ['', ...categories].map((c) => `<button class="chip ${c === category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c || 'All')}</button>`).join('');
    $$('[data-cat]').forEach((b) => (b.onclick = () => { category = b.dataset.cat; renderTiles(); }));
    const shown = active.filter((s) => !category || s.category === category);
    $('#tiles').innerHTML = shown.length
      ? shown.map((s) => {
          const n = cart.filter((l) => l.service_id === s.id).reduce((a, l) => a + l.qty, 0);
          return `<button class="service-tile ${n ? 'in-cart' : ''}" data-svc="${s.id}">${n ? `<span class="qty-badge">${n}</span>` : ''}
            <span class="name">${esc(s.name)}</span><span class="price">${money(s.price_cents)}</span></button>`;
        }).join('')
      : `<p class="muted small">No services yet. ${isOwner() ? '<a href="#/services">Add some to your price list</a>.' : ''}</p>`;
    $$('[data-svc]').forEach((b) => (b.onclick = () => {
      const s = active.find((x) => x.id == b.dataset.svc);
      const line = cart.find((l) => l.service_id === s.id && !l.note);
      if (line) line.qty++;
      else cart.push({ key: ++seq, service_id: s.id, name: s.name, qty: 1, price_cents: s.price_cents, note: '' });
      update();
    }));
  };
  const renderCart = () => {
    const box = $('#cart');
    $('#pcs').textContent = plural(cart.reduce((a, l) => a + l.qty, 0), 'piece');
    if (!cart.length) {
      box.innerHTML = `<div class="empty-state" style="padding:20px 10px">${icon('shirt')}<h3>No items yet</h3><p class="small">Tap a service to add it.</p></div>`;
      return;
    }
    box.innerHTML = cart.map((l) => `<div class="cart-item" data-key="${l.key}">
      <div class="name-line">${esc(l.name)}</div><div class="strong num">${money(l.qty * l.price_cents)}</div>
      <div class="controls">
        <div class="stepper"><button type="button" data-dec aria-label="Fewer">${icon('minus', 'sm')}</button><span>${l.qty}</span><button type="button" data-inc aria-label="More">${icon('plus', 'sm')}</button></div>
        <input class="note" placeholder="Color, brand, stain…" value="${esc(l.note)}">
        <div class="money-input"><input class="price" inputmode="decimal" value="${dollars(l.price_cents)}" aria-label="Price each"></div>
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
    $('#totals').innerHTML = `<div><span>Subtotal</span><span>${money(sub)}</span></div>
      ${disc ? `<div><span>Discount</span><span>-${money(disc)}</span></div>` : ''}
      ${taxRate ? `<div><span>Tax (${taxRate}%)</span><span>${money(tax)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${money(total)}</span></div>
      ${paid ? `<div><span>Balance due</span><span>${money(total - paid)}</span></div>` : ''}`;
    $('#cart-bar').hidden = !cart.length;
    $('#bar-total').textContent = money(total);
    $('#bar-pcs').textContent = plural(cart.reduce((a, l) => a + l.qty, 0), 'piece');
    const needTicket = paperTickets && !cleanTicket($('#ticket').value);
    $('#save').disabled = !customer || !cart.length || needTicket;
    $('#save').title = !customer ? 'Choose a customer first' : !cart.length ? 'Add at least one item' : needTicket ? 'Enter the ticket number' : '';
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
      const t = cleanTicket($('#ticket').value);
      if (!t) return;
      const clash = (await api('GET', '/orders?status=open&q=' + encodeURIComponent(t))).find((o) => o.ticket === t);
      $('#ticket-warn').hidden = !clash;
      if (clash) $('#ticket-warn').textContent = `#${t} is already on an active order for ${clash.customer_name}.`;
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
    toast(`Order #${o.ticket} created`);
    location.hash = `#/orders/${o.id}`;
  });

  renderCustomer();
  update();
  if (query.get('customer')) pick(await api('GET', '/customers/' + query.get('customer')));
};

views.order = async ([id]) => {
  const [o, settings] = await Promise.all([api('GET', '/orders/' + id), api('GET', '/settings')]);
  setTitle(`Order #${o.ticket}`);
  const next = NEXT[o.status];
  const steps = ['received', 'cleaning', 'ready', 'picked_up'];
  const at = steps.indexOf(o.status);
  const progress = steps
    .map((s, i) => {
      const cls = i < at || o.status === 'picked_up' ? 'done' : i === at ? 'current' : '';
      return `${i ? `<div class="bar ${i <= at ? 'done' : ''}"></div>` : ''}<div class="step ${cls}"><div class="dot">${cls === 'done' ? icon('check', 'sm') : i + 1}</div><span class="label">${STATUS_LABEL[s]}</span></div>`;
    })
    .join('');

  app.innerHTML = `
    <a class="back" href="#/orders">${icon('back', 'sm')}Orders</a>
    ${pageHead(`Order #${esc(o.ticket)} ${pill(o.status)}`,
      `${esc(o.customer_name)} · dropped off ${dateTime(o.created_at)}`,
      `<button class="btn" id="print">${icon('printer')}Print ticket</button>
       ${next ? `<button class="btn btn-primary btn-lg" data-advance="${o.id}" data-status="${next[0]}">${icon(next[0] === 'picked_up' ? 'check' : next[0] === 'ready' ? 'bell' : 'sparkle')}${next[1]}</button>` : ''}`)}
    <div class="card card-body" style="margin-bottom:20px">
      ${o.status === 'cancelled' ? `<div class="callout">${icon('alert', 'sm')}This order was cancelled.</div>` : `<div class="progress">${progress}</div>`}
    </div>
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('shirt')}<h2>Items</h2><span class="spacer"></span><span class="hint">${plural(o.piece_count, 'piece')}</span></div>
          <table class="items-table"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num hide-md">Each</th><th class="num">Total</th></tr></thead>
            <tbody>${o.items.map((i) => `<tr><td>${esc(i.description)}</td><td class="num">${i.qty}</td><td class="num hide-md">${money(i.price_cents)}</td><td class="num">${money(i.qty * i.price_cents)}</td></tr>`).join('')}</tbody></table>
          <div class="card-body">
            <div class="totals" style="max-width:320px;margin-left:auto">
              <div><span>Subtotal</span><span>${money(o.subtotal_cents)}</span></div>
              ${o.discount_cents ? `<div><span>Discount</span><span>-${money(o.discount_cents)}</span></div>` : ''}
              ${o.tax_cents ? `<div><span>Tax (${o.tax_rate}%)</span><span>${money(o.tax_cents)}</span></div>` : ''}
              <div class="grand"><span>Total</span><span>${money(o.total_cents)}</span></div>
              <div><span>Paid</span><span>${money(o.paid_cents)}</span></div>
              <div class="strong" style="color:var(--text)"><span>Balance</span><span class="${o.balance_cents > 0 ? 'danger-text' : ''}">${money(o.balance_cents)}</span></div>
            </div>
          </div>
          <div class="save-bar" style="justify-content:space-between;align-items:center">
            ${o.balance_cents > 0
              ? `<span class="small muted">Take a payment</span><div class="row tight"><div class="money-input" style="width:120px"><input id="pay-amt" inputmode="decimal" value="${dollars(o.balance_cents)}"></div><button class="btn btn-primary" id="pay">${icon('dollar', 'sm')}Record payment</button></div>`
              : `<span class="pill ready">Paid in full</span><button class="btn btn-sm btn-ghost" id="refund">Adjust payment</button>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head">${icon('message')}<h2>Customer updates</h2><span class="spacer"></span>
            <button class="btn btn-sm" data-notify="ready">${icon('bell', 'sm')}Send “ready”</button>
            <button class="btn btn-sm" data-notify="reminder">${icon('clock', 'sm')}Send reminder</button></div>
          ${timeline(o.messages, { empty: emptyState('message', 'No updates sent yet', settings.auto_notify_ready === '1' ? 'The customer is notified automatically when you mark this order ready.' : 'Use the buttons above to notify the customer.') })}
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('user')}<h2>Customer</h2></div>
          <div class="card-body stack sm">
            <a class="who-cell" href="#/customers/${o.customer_id}" style="color:inherit">${avatar(o.customer_name)}<div><div class="name-line">${esc(o.customer_name)}</div><div class="sub-line">View profile</div></div></a>
            ${o.customer_phone ? `<div class="row tight small">${icon('phone', 'sm')}<a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></div>` : ''}
            ${o.customer_email ? `<div class="row tight small">${icon('mail', 'sm')}<span>${esc(o.customer_email)}</span></div>` : ''}
            ${o.customer_preferences ? `<div class="callout info">${icon('sparkle', 'sm')}<span>${esc(o.customer_preferences)}</span></div>` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card-head">${icon('edit')}<h2>Details</h2></div>
          <div class="card-body stack">
            <label class="field">Ticket number<input id="ticket" value="${esc(o.ticket)}" maxlength="21"></label>
            <label class="field">Due date<input id="due" type="date" value="${esc(o.due_date)}"></label>
            <label class="field">Rack / bin<input id="rack" value="${esc(o.rack)}" placeholder="e.g. A-12"></label>
            <label class="field">Notes<textarea id="notes" placeholder="Stains, damage, special instructions">${esc(o.notes)}</textarea></label>
            ${o.ready_at || o.picked_up_at || o.reminder_count ? `<dl class="kv small">
              ${o.ready_at ? `<dt>Ready</dt><dd>${dateTime(o.ready_at)}</dd>` : ''}
              ${o.picked_up_at ? `<dt>Picked up</dt><dd>${dateTime(o.picked_up_at)}</dd>` : ''}
              ${o.reminder_count ? `<dt>Reminders</dt><dd>${o.reminder_count} sent, last ${dateTime(o.last_reminder_at)}</dd>` : ''}</dl>` : ''}
          </div>
          <div class="save-bar"><button class="btn" id="save-details">Save details</button></div>
        </div>
        <div class="card card-body stack sm">
          <label class="field">Change status
            <div class="row tight"><select id="status-sel" style="flex:1">${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button class="btn" id="set-status">Update</button></div></label>
        </div>
      </div>
    </div>
    <div class="ticket">
      <h3>${esc(settings.business_name)}</h3>
      <div style="text-align:center">${esc(settings.business_phone)}</div>
      <div class="big">#${esc(o.ticket)}</div>
      <div>${esc(o.customer_name)} ${esc(o.customer_phone)}</div>
      <div>In: ${shortDate(o.created_at)} &nbsp; Due: ${esc(o.due_date)}</div>
      ${o.rack ? `<div>Rack: ${esc(o.rack)}</div>` : ''}
      <hr><table>${o.items.map((i) => `<tr><td>${i.qty} × ${esc(i.description)}</td><td style="text-align:right">${money(i.qty * i.price_cents)}</td></tr>`).join('')}</table><hr>
      <table><tr><td>Total</td><td style="text-align:right">${money(o.total_cents)}</td></tr>
      <tr><td>Paid</td><td style="text-align:right">${money(o.paid_cents)}</td></tr>
      <tr><td><strong>Balance</strong></td><td style="text-align:right"><strong>${money(o.balance_cents)}</strong></td></tr></table>
      ${o.notes ? `<p>${esc(o.notes)}</p>` : ''}
    </div>`;

  $('#print').onclick = () => window.print();
  $('#set-status').onclick = (e) => busy(e.currentTarget, async () => {
    const status = $('#status-sel').value;
    if (status === 'cancelled' && !confirm('Cancel this order?')) return;
    const r = await api('POST', `/orders/${id}/status`, { status });
    messageToast(r.messages, `Marked ${STATUS_LABEL[status].toLowerCase()}`);
    route();
  });
  $('#save-details').onclick = (e) => busy(e.currentTarget, async () => {
    const body = { due_date: $('#due').value, rack: $('#rack').value, notes: $('#notes').value };
    const ticketChanged = cleanTicket($('#ticket').value) !== o.ticket;
    if (ticketChanged) body.ticket = $('#ticket').value;
    await api('PUT', '/orders/' + id, body);
    toast('Details saved');
    if (ticketChanged) route();
  });
  if ($('#pay')) {
    $('#pay').onclick = (e) => busy(e.currentTarget, async () => {
      await api('POST', `/orders/${id}/payment`, { amount_cents: toCents($('#pay-amt').value) });
      toast('Payment recorded');
      route();
    });
  }
  if ($('#refund')) {
    $('#refund').onclick = () => {
      const m = modal('Adjust payment', `<form class="card-body stack" id="adj">
        <p class="small muted">Enter a negative amount to record a refund.</p>
        <label class="field">Amount<div class="money-input"><input name="amt" inputmode="decimal" placeholder="-5.00" required></div></label>
        <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`);
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
  setTitle('Customers');
  const q = query.get('q') || '';
  const list = await api('GET', '/customers?q=' + encodeURIComponent(q));
  app.innerHTML = `
    ${pageHead('Customers', 'Everyone who has dropped off with you.', `<button class="btn btn-primary" id="add">${icon('plus')}Add customer</button>`)}
    <form class="search" id="sf" style="margin-bottom:16px;max-width:420px">${icon('search')}<input id="q" value="${esc(q)}" placeholder="Search name, phone or email"></form>
    <div class="card">${
      list.length
        ? `<div class="list"><div class="list-row customer-row list-head hide-md"><div>Name</div><div>Phone</div><div>Email</div><div>Orders</div><div></div></div>
          ${list.map((c) => `<div class="list-row customer-row click" data-href="#/customers/${c.id}">
            <div class="who-cell">${avatar(c.name)}<div><div class="name-line">${esc(c.name)}</div><div class="sub-line">${esc(c.preferences || (c.last_order_at ? 'Last visit ' + shortDate(c.last_order_at) : 'No orders yet'))}</div></div></div>
            <div class="small hide-md">${esc(c.phone || '—')}</div>
            <div class="small hide-md sub-line">${esc(c.email || '—')}</div>
            <div class="small hide-md">${c.order_count}</div>
            <div class="row-action">${c.open_orders ? `<span class="pill ready plain">${c.open_orders} active</span>` : ''}</div>
          </div>`).join('')}</div>`
        : q
          ? emptyState('search', 'No matching customers', `Nothing matches “${esc(q)}”.`)
          : emptyState('users', 'No customers yet', 'Customers are added when you create their first order, or add one now.')
    }</div>`;
  let t;
  const go = () => (location.hash = '#/customers' + ($('#q').value.trim() ? '?q=' + encodeURIComponent($('#q').value.trim()) : ''));
  $('#q').oninput = () => { clearTimeout(t); t = setTimeout(go, 350); };
  $('#sf').onsubmit = (e) => { e.preventDefault(); go(); };
  if (q) { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  $('#add').onclick = () => customerModal(null);
};

function customerModal(c) {
  const m = modal(c ? 'Edit customer' : 'Add customer', `<form class="card-body stack" id="cf">
    <label class="field">Name<input name="name" value="${esc(c?.name)}" required></label>
    <div class="form" style="grid-template-columns:1fr 1fr">
      <label class="field">Mobile phone<input name="phone" type="tel" value="${esc(c?.phone)}"></label>
      <label class="field">Email<input name="email" type="email" value="${esc(c?.email)}"></label>
    </div>
    <label class="field">Preferences<input name="preferences" value="${esc(c?.preferences)}" placeholder="e.g. no starch, boxed shirts"></label>
    <label class="field">Notes<textarea name="notes" rows="2">${esc(c?.notes)}</textarea></label>
    <div class="stack sm">
      <label class="check"><input type="checkbox" name="sms_opt_in" ${!c || c.sms_opt_in ? 'checked' : ''}><span>Text message updates<small>Order ready notices and pickup reminders by text</small></span></label>
      <label class="check"><input type="checkbox" name="email_opt_in" ${!c || c.email_opt_in ? 'checked' : ''}><span>Email updates<small>The same notices by email</small></span></label>
    </div>
    <div class="row">${c ? `<button type="button" class="btn btn-danger" id="del">${icon('trash', 'sm')}Delete</button>` : ''}<span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">${c ? 'Save changes' : 'Add customer'}</button></div>
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
      toast(c ? 'Customer saved' : 'Customer added');
      if (c) route();
      else location.hash = '#/customers/' + saved.id;
    });
  };
  if (c) {
    $('#del', m.el).onclick = (e) => {
      if (!confirm(`Delete ${c.name}? This can't be undone.`)) return;
      busy(e.currentTarget, async () => {
        await api('DELETE', '/customers/' + c.id);
        m.close();
        toast('Customer deleted');
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
  const on = (v) => (v ? '<span class="pill ready plain">On</span>' : '<span class="pill cancelled plain">Off</span>');

  app.innerHTML = `
    <a class="back" href="#/customers">${icon('back', 'sm')}Customers</a>
    <div class="page-head"><div class="who-cell">${avatar(c.name, 'lg')}<div><h1>${esc(c.name)}</h1>
      <p class="sub">${esc([c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details')}</p></div></div>
      <div class="actions"><button class="btn" id="edit">${icon('edit', 'sm')}Edit</button>
        <a class="btn btn-primary" href="#/orders/new?customer=${c.id}">${icon('plus')}New order</a></div></div>
    <div class="stats">
      ${stat('primary', 'receipt', 'Orders', c.orders.length)}
      ${stat('ready', 'shirt', 'Active orders', open)}
      ${stat('cleaning', 'dollar', 'Lifetime spend', money(c.lifetime_value_cents))}
      ${stat('received', 'clock', 'Customer since', shortDate(c.created_at))}
    </div>
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card"><div class="card-head">${icon('receipt')}<h2>Orders</h2></div>
          ${orderList(c.orders, { empty: emptyState('receipt', 'No orders yet', '', `<a class="btn btn-primary" href="#/orders/new?customer=${c.id}">${icon('plus')}Create their first order</a>`) })}</div>
        <div class="card"><div class="card-head">${icon('message')}<h2>Messages</h2></div>${timeline(c.messages)}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-head">${icon('user')}<h2>Profile</h2></div>
          <div class="card-body stack">
            <dl class="kv">
              <dt>Phone</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd>
              <dt>Email</dt><dd>${esc(c.email || '—')}</dd>
              <dt>Texts</dt><dd>${c.phone ? on(c.sms_opt_in) : '<span class="muted small">No phone number</span>'}</dd>
              <dt>Emails</dt><dd>${c.email ? on(c.email_opt_in) : '<span class="muted small">No email address</span>'}</dd>
            </dl>
            ${c.preferences ? `<div class="callout info">${icon('sparkle', 'sm')}<span>${esc(c.preferences)}</span></div>` : ''}
            ${c.notes ? `<p class="small" style="white-space:pre-line">${esc(c.notes)}</p>` : ''}
          </div></div>
        <div class="card"><div class="card-head">${icon('send')}<h2>Send a message</h2></div>
          <div class="card-body stack sm">
            <div class="chips">
              <button type="button" class="chip ${c.phone ? 'active' : ''}" data-ch="sms" ${c.phone ? '' : 'disabled title="No phone number"'}>${icon('phone', 'sm')} Text</button>
              <button type="button" class="chip ${!c.phone && c.email ? 'active' : ''}" data-ch="email" ${c.email ? '' : 'disabled title="No email address"'}>${icon('mail', 'sm')} Email</button>
            </div>
            <input id="subj" placeholder="Email subject">
            <textarea id="msg" placeholder="Write a message to ${esc(c.name.split(' ')[0])}…"></textarea>
            <button class="btn btn-primary" id="send">${icon('send', 'sm')}Send</button>
          </div></div>
      </div>
    </div>`;

  const chans = () => $$('[data-ch].active').map((b) => b.dataset.ch);
  const syncSubject = () => ($('#subj').hidden = !chans().includes('email'));
  $$('[data-ch]').forEach((b) => (b.onclick = () => { b.classList.toggle('active'); syncSubject(); }));
  syncSubject();
  $('#edit').onclick = () => customerModal(c);
  $('#send').onclick = (e) => {
    if (!chans().length) return toast('Choose text and/or email');
    if (!$('#msg').value.trim()) return $('#msg').focus();
    busy(e.currentTarget, async () => {
      messageToast(await api('POST', `/customers/${id}/message`, { body: $('#msg').value, subject: $('#subj').value, channels: chans() }));
      route();
    });
  };
};

views.services = async () => {
  setTitle('Price list');
  const list = await api('GET', '/services');
  const owner = isOwner();
  const cats = [...new Set(list.map((s) => s.category))];
  app.innerHTML = `
    ${pageHead('Price list', owner ? 'Changes save automatically. These appear as buttons when you create an order.' : 'Only the shop owner can change prices.',
      owner ? `<button class="btn btn-primary" id="add">${icon('plus')}Add service</button>` : '')}
    <div class="stack">${
      cats.length
        ? cats.map((cat) => `<div class="card"><div class="card-head"><h2>${esc(cat)}</h2><span class="spacer"></span><span class="hint">${plural(list.filter((s) => s.category === cat).length, 'service')}</span></div>
          ${list.filter((s) => s.category === cat).map((s) => `<div class="price-row ${s.active ? '' : 'inactive'}" data-id="${s.id}">
            <input class="name-input" value="${esc(s.name)}" ${owner ? '' : 'disabled'} aria-label="Service name">
            <div class="money-input"><input class="price" inputmode="decimal" value="${dollars(s.price_cents)}" ${owner ? '' : 'disabled'} aria-label="Price"></div>
            <div class="row tight">${owner ? `
              <label class="check small" title="Show when creating orders"><input type="checkbox" class="active" ${s.active ? 'checked' : ''}><span class="hide-md">Active</span></label>
              <button class="btn btn-ghost btn-icon del" title="Remove" aria-label="Remove">${icon('trash', 'sm')}</button>` : s.active ? '' : '<span class="pill cancelled plain">Hidden</span>'}</div>
          </div>`).join('')}</div>`).join('')
        : `<div class="card">${emptyState('tag', 'Your price list is empty', 'Add the services you offer and their prices.')}</div>`
    }</div>`;

  if (!owner) return;
  const save = async (row, body) => {
    try {
      await api('PUT', '/services/' + row.dataset.id, body);
      toast('Saved');
    } catch (e) { toast(e.message); }
  };
  $$('.price-row').forEach((row) => {
    $('.name-input', row).onchange = (e) => save(row, { name: e.target.value });
    $('.price', row).onchange = (e) => { e.target.value = dollars(toCents(e.target.value)); save(row, { price_cents: toCents(e.target.value) }); };
    $('.active', row).onchange = (e) => { row.classList.toggle('inactive', !e.target.checked); save(row, { active: e.target.checked }); };
    $('.del', row).onclick = async () => {
      if (!confirm('Remove this service?')) return;
      const r = await api('DELETE', '/services/' + row.dataset.id);
      toast(r.deactivated ? 'Used on past orders, so it was hidden instead' : 'Removed');
      route();
    };
  });
  $('#add').onclick = () => {
    const m = modal('Add service', `<form class="card-body stack" id="sf">
      <label class="field">Service name<input name="name" required placeholder="e.g. Silk blouse"></label>
      <div class="form" style="grid-template-columns:1fr 1fr">
        <label class="field">Category<input name="category" list="cat-list" value="${esc(cats[0] || 'Dry Clean')}" required>
          <datalist id="cat-list">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field">Price<div class="money-input"><input name="price" inputmode="decimal" placeholder="0.00" required></div></label>
      </div>
      <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Add service</button></div></form>`);
    $('#sf', m.el).onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      busy(e.submitter, async () => {
        await api('POST', '/services', { name: f.name.value, category: f.category.value, price_cents: toCents(f.price.value) });
        m.close();
        toast('Service added');
        route();
      });
    };
  };
};

views.messages = async (_, query) => {
  setTitle('Messages');
  const filter = query.get('show') || '';
  const [list, settings] = await Promise.all([
    api('GET', '/messages' + (filter === 'sms' || filter === 'email' ? '?channel=' + filter : '')),
    api('GET', '/settings'),
  ]);
  const shown = filter === 'replies' ? list.filter((m) => m.direction === 'in') : list;
  const notConnected = [settings.channels.sms === 'log' && 'texts', settings.channels.email === 'log' && 'emails'].filter(Boolean);
  app.innerHTML = `
    ${pageHead('Messages', 'Every text and email sent to customers, and their replies.')}
    ${notConnected.length ? `<div class="callout warn" style="margin-bottom:16px">${icon('alert', 'sm')}<span>Sending ${notConnected.join(' and ')} isn't connected yet, so those messages are saved here but not delivered.${isOwner() ? ' <a href="#/settings?tab=notifications">See notification settings</a>.' : ''}</span></div>` : ''}
    <div class="tabs" style="margin-bottom:16px">${[['', 'All'], ['sms', 'Texts'], ['email', 'Emails'], ['replies', 'Replies']]
      .map(([k, l]) => `<button data-show="${k}" class="${k === filter ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="card">${timeline(shown, { showCustomer: true, empty: emptyState('message', 'No messages yet', 'Messages appear here when you mark orders ready or send reminders.') })}</div>`;
  $$('[data-show]').forEach((b) => (b.onclick = () => (location.hash = '#/messages' + (b.dataset.show ? '?show=' + b.dataset.show : ''))));
};

const PROVIDER_LABEL = { twilio: 'Twilio', resend: 'Resend', sendgrid: 'SendGrid', postmark: 'Postmark' };
const SETTINGS_TABS = [
  ['business', 'store', 'Business'],
  ['notifications', 'bell', 'Notifications'],
  ['wording', 'edit', 'Message wording'],
  ['team', 'users', 'Team'],
  ['account', 'lock', 'My account'],
];
views.settings = async (_, query) => {
  setTitle('Settings');
  const tab = SETTINGS_TABS.some(([k]) => k === query.get('tab')) ? query.get('tab') : 'business';
  const [s, team] = await Promise.all([api('GET', '/settings'), api('GET', '/team')]);
  const owner = isOwner();
  const ro = owner ? '' : 'disabled';
  const field = (name, label, attrs = '', help = '') =>
    `<label class="field">${label}<input name="${name}" value="${esc(s[name])}" ${attrs} ${ro}>${help ? `<span class="help">${help}</span>` : ''}</label>`;
  const area = (name, label, rows = 3) => `<label class="field full">${label}<textarea name="${name}" rows="${rows}" ${ro}>${esc(s[name])}</textarea></label>`;
  const check = (name, label, help) =>
    `<label class="check"><input name="${name}" type="checkbox" ${s[name] === '1' ? 'checked' : ''} ${ro}><span>${label}<small>${help}</small></span></label>`;
  const saveBar = owner ? `<div class="save-bar"><button class="btn btn-primary" data-save>Save changes</button></div>` : '';
  const conn = (mode, label, what) => `<div class="status-line ${mode !== 'log' ? 'on' : ''}"><span class="dot"></span>
    <div style="flex:1"><div class="strong">${label}</div><div class="small muted">${mode !== 'log' ? `Connected via ${esc(PROVIDER_LABEL[mode] || mode)}` : `Not connected yet. ${what} are saved in Messages but not delivered.`}</div></div></div>`;

  const panes = {
    business: `<div class="card"><div class="card-head"><h2>Business details</h2><span class="hint">Shown on tickets, texts and emails</span></div>
      <div class="card-body form">
        ${field('business_name', 'Business name')}
        ${field('business_phone', 'Phone')}
        ${field('business_email', 'Email', 'type="email"', 'Customer email replies go here')}
        ${field('business_address', 'Address')}
        ${field('tax_rate', 'Sales tax (%)', 'inputmode="decimal"')}
        ${field('default_turnaround_days', 'Usual turnaround (days)', 'type="number" min="0"', 'Sets the default due date on new orders')}
        <label class="field">Ticket numbers<select name="ticket_mode" ${ro}>
          <option value="manual" ${s.ticket_mode === 'manual' ? 'selected' : ''}>Use my paper ticket numbers</option>
          <option value="auto" ${s.ticket_mode !== 'manual' ? 'selected' : ''}>Number orders automatically</option></select>
          <span class="help">With paper tickets, staff type the number when writing up an order</span></label>
      </div>${saveBar}</div>`,
    notifications: `<div class="stack">
      <div class="card"><div class="card-head"><h2>Connections</h2></div><div class="card-body stack sm">
        ${conn(s.channels.sms, 'Text messages', 'Texts')}${conn(s.channels.email, 'Email', 'Emails')}</div></div>
      <div class="card"><div class="card-head"><h2>When to notify customers</h2></div>
        <div class="card-body stack">
          ${check('auto_notify_ready', 'Notify customers when their order is ready', 'Sent the moment you mark an order Ready')}
          ${check('notify_sms', 'Send text messages', 'To customers with a mobile number')}
          ${check('notify_email', 'Send emails', 'To customers with an email address')}
          <div class="form" style="border-top:1px solid var(--border);padding-top:16px">
            ${field('reminder_after_days', 'First pickup reminder after', 'type="number" min="0"', 'Days after the order is ready')}
            ${field('reminder_interval_days', 'Then remind every', 'type="number" min="1"', 'Days between reminders')}
            ${field('max_reminders', 'Stop after', 'type="number" min="0"', 'Reminders per order (0 turns them off)')}
          </div>
        </div>${saveBar}</div>
      ${owner ? `<div class="card"><div class="card-head"><h2>Send yourself a test</h2></div>
        <div class="card-body stack sm">
          <div class="row"><input id="test-phone" type="tel" placeholder="Your mobile number" style="flex:1;min-width:180px"><button class="btn" data-test="sms">${icon('phone', 'sm')}Send test text</button></div>
          <div class="row"><input id="test-email" type="email" placeholder="Your email address" style="flex:1;min-width:180px"><button class="btn" data-test="email">${icon('mail', 'sm')}Send test email</button></div>
        </div></div>` : ''}
    </div>`,
    wording: `<div class="card"><div class="card-head"><h2>Message wording</h2></div>
      <div class="card-body stack">
        <div class="stack sm"><span class="small muted">Use these to fill in details automatically:</span>
          <div class="placeholder-list">${['name', 'ticket', 'business', 'balance', 'total', 'pieces', 'ready_date', 'due_date', 'phone', 'address'].map((p) => `<code>{${p}}</code>`).join('')}</div></div>
        <div class="form">
          ${area('sms_template_ready', 'Text — order ready', 3)}
          ${area('sms_template_reminder', 'Text — pickup reminder', 3)}
          <p class="small muted full">Texts end with “Reply STOP to opt out.” automatically.</p>
          ${field('email_subject_ready', 'Email subject — order ready')}
          ${field('email_subject_reminder', 'Email subject — pickup reminder')}
          ${area('email_body_ready', 'Email — order ready', 8)}
          ${area('email_body_reminder', 'Email — pickup reminder', 8)}
        </div>
      </div>${saveBar}</div>`,
    team: `<div class="card"><div class="card-head"><h2>Team</h2><span class="spacer"></span>${owner ? `<button class="btn btn-primary btn-sm" id="t-add">${icon('plus', 'sm')}Add person</button>` : ''}</div>
      <div class="list">${team.map((u) => `<div class="list-row" style="grid-template-columns:minmax(0,1fr) auto auto">
        <div class="who-cell">${avatar(u.name)}<div><div class="name-line">${esc(u.name)}${u.id === me.user.id ? ' <span class="muted small">(you)</span>' : ''}</div><div class="sub-line">${esc(u.email)}</div></div></div>
        <span class="pill plain ${u.role === 'owner' ? 'picked_up' : 'received'}">${u.role === 'owner' ? 'Owner' : 'Staff'}</span>
        <div>${owner && u.id !== me.user.id ? `<button class="btn btn-ghost btn-icon" data-remove="${u.id}" title="Remove" aria-label="Remove ${esc(u.name)}">${icon('trash', 'sm')}</button>` : ''}</div>
      </div>`).join('')}</div>
      <div class="save-bar" style="justify-content:flex-start"><span class="small muted">Staff can manage orders and customers. Owners can also change settings, prices and the team.</span></div></div>`,
    account: `<div class="card"><div class="card-head"><h2>Change your password</h2></div>
      <form class="card-body form" id="pw">
        <label class="field">Current password<input name="current_password" type="password" autocomplete="current-password" required></label>
        <label class="field">New password<input name="new_password" type="password" autocomplete="new-password" minlength="8" required><span class="help">At least 8 characters</span></label>
        <div class="full"><button class="btn btn-primary">Update password</button></div>
      </form></div>`,
  };

  app.innerHTML = `
    ${pageHead('Settings', owner ? '' : 'Only the shop owner can change shop settings.')}
    <div class="grid sidebar-left">
      <nav class="settings-nav">${SETTINGS_TABS.map(([k, ic, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${icon(ic, 'sm')}${l}</button>`).join('')}</nav>
      <div id="pane">${panes[tab]}</div>
    </div>`;

  $$('[data-tab]').forEach((b) => (b.onclick = () => (location.hash = '#/settings?tab=' + b.dataset.tab)));
  $$('[data-save]').forEach((b) => (b.onclick = () => busy(b, async () => {
    const body = {};
    $$('[name]', b.closest('.card')).forEach((el) => (body[el.name] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value));
    const saved = await api('PUT', '/settings', body);
    me.shop.name = saved.business_name;
    $('#brand').textContent = saved.business_name;
    toast('Settings saved');
  })));
  $$('[data-test]').forEach((b) => (b.onclick = () => busy(b, async () => {
    const channel = b.dataset.test;
    messageToast(await api('POST', '/settings/test-message', { channel, to: $(channel === 'sms' ? '#test-phone' : '#test-email').value }));
  })));
  if ($('#t-add')) {
    $('#t-add').onclick = () => {
      const m = modal('Add a team member', `<form class="card-body stack" id="tf">
        <label class="field">Name<input name="name" required></label>
        <label class="field">Email<input name="email" type="email" required></label>
        <label class="field">Temporary password<input name="password" minlength="8" required><span class="help">Share it with them. They can change it under My account.</span></label>
        <label class="field">Role<select name="role"><option value="staff">Staff — orders and customers</option><option value="owner">Owner — everything</option></select></label>
        <div class="row"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Add</button></div></form>`);
      $('#tf', m.el).onsubmit = (e) => {
        e.preventDefault();
        busy(e.submitter, async () => {
          await api('POST', '/team', Object.fromEntries(new FormData(e.target)));
          m.close();
          toast('Team member added');
          route();
        });
      };
    };
  }
  $$('[data-remove]').forEach((b) => (b.onclick = () => {
    if (!confirm('Remove this person? They will be logged out.')) return;
    busy(b, async () => { await api('DELETE', '/team/' + b.dataset.remove); route(); });
  }));
  if ($('#pw')) {
    $('#pw').onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        await api('PUT', '/me/password', Object.fromEntries(new FormData(e.target)));
        e.target.reset();
        toast('Password updated');
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

let lastPath = null;
async function route() {
  const [path, qs] = location.hash.slice(1).split('?');
  const query = new URLSearchParams(qs || '');
  $('#shell').classList.remove('nav-open');
  for (const [re, view, nav] of ROUTES) {
    const m = (path || '/').match(re);
    if (!m) continue;
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    // Keep scroll position when re-rendering the same page (e.g. after an action).
    const samePage = lastPath === path;
    const y = window.scrollY;
    try {
      await view(m.slice(1), query);
    } catch (e) {
      app.innerHTML = `<div class="card">${emptyState('alert', 'Something went wrong', esc(e.message), '<a class="btn" href="#/dashboard">Back to dashboard</a>')}</div>`;
    }
    window.scrollTo(0, samePage ? y : 0);
    lastPath = path;
    return;
  }
  location.hash = '#/dashboard';
}

$('#logout').onclick = async () => {
  await api('POST', '/auth/logout').catch(() => {});
  location.href = '/login.html';
};
$('#menu').onclick = () => $('#shell').classList.add('nav-open');
$('#scrim').onclick = () => $('#shell').classList.remove('nav-open');

hydrateIcons();
window.addEventListener('hashchange', route);
api('GET', '/me')
  .then((m) => {
    me = m;
    $('#brand').textContent = m.shop.name;
    $('#who').textContent = m.user.name;
    $('#role').textContent = m.user.role;
    $('#me-avatar').outerHTML = avatar(m.user.name);
    route();
  })
  .catch(() => {});
