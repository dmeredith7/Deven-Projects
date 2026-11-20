'use strict';

// Platform admin: every dry cleaner using the service, at a glance and one by one.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');
const { t, tn, N_ } = I18N;
const L = () => I18N.locale();

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (c) => '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseUtc = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
const shortDate = (s) => (s ? parseUtc(s).toLocaleDateString(L(), { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const dateTime = (s) => (s ? parseUtc(s).toLocaleString(L(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const itemName = (name) => t(String(name ?? ''));

function ago(s) {
  if (!s) return t('No orders yet');
  const days = Math.floor((Date.now() - parseUtc(s)) / 864e5);
  if (days < 1) return t('Today');
  if (days === 1) return t('Yesterday');
  return tn(days, '{n} day ago', '{n} days ago');
}

const ICONS = {
  store: '<path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  open: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-9 5.7a2 2 0 0 1-2 0L2 7"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  lock: '<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const AVATAR_COLORS = ['#0e7490', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#2563eb', '#ca8a04', '#0891b2', '#9333ea', '#dc2626'];
function avatar(name, cls = '') {
  const n = String(name || '?').trim();
  const initials = n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<div class="avatar ${cls}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${esc(initials)}</div>`;
}

const PARTNER_STATUS = {
  active: ['ready', N_('Active this month')],
  new: ['picked_up', N_('Just joined')],
  quiet: ['cancelled', N_('No recent orders')],
};
const partnerPill = (s) => `<span class="pill ${PARTNER_STATUS[s][0]}">${t(PARTNER_STATUS[s][1])}</span>`;
const ORDER_STATUS = { received: N_('Received'), cleaning: N_('Cleaning'), ready: N_('Ready'), picked_up: N_('Picked up'), cancelled: N_('Cancelled') };
const orderPill = (s) => `<span class="pill ${esc(s)}">${esc(ORDER_STATUS[s] ? t(ORDER_STATUS[s]) : s)}</span>`;
const MSG_STATUS = { sent: N_('Sent'), logged: N_('Not sent (not connected)'), failed: N_('Failed'), skipped: N_('Skipped'), received: N_('Reply') };
const CHANNEL = { sms: N_('Text'), email: N_('Email') };

async function api(method, path, body) {
  const res = await fetch('/api/admin' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    showLogin();
    throw Object.assign(new Error(t('Please log in')), { handled: true });
  }
  if (!res.ok) throw new Error(data.error ? I18N.tErr(data.error) : t('Request failed ({status})', { status: res.status }));
  return data;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

const stat = (tone, ic, label, value, sub = '') =>
  `<div class="stat"><div class="stat-icon tone-${tone}">${icon(ic)}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="tiny muted">${sub}</div>` : ''}</div></div>`;

// ---------- login ----------
function showLogin() {
  $('#admin-who').hidden = $('#admin-logout').hidden = true;
  document.title = t('Admin · Dry Cleaner CRM');
  app.innerHTML = `<div class="admin-login">
    <form class="auth-card card card-body" id="admin-login">
      <div><h1>${t('Admin login')}</h1><p class="sub">${t('For the team running Dry Cleaner CRM. Shops log in on the regular login page.')}</p></div>
      <label class="field">${t('Email')}<input name="email" type="email" autocomplete="username" required></label>
      <label class="field">${t('Password')}<input name="password" type="password" autocomplete="current-password" required></label>
      <div class="error" role="alert"></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('lock', 'sm')}${t('Log in')}</button>
      <div class="auth-links"><a href="/login.html">${t('Back to shop login')}</a></div>
    </form></div>`;
  $('#admin-login [name=email]').focus();
  $('#admin-login').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      await api('POST', '/login', Object.fromEntries(new FormData(e.target)));
      await start();
    } catch (ex) {
      $('#admin-login .error').textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  };
}

// ---------- overview ----------
const SORTS = {
  recent: [N_('Newest first'), (a, b) => b.id - a.id],
  activity: [N_('Most recent order'), (a, b) => String(b.last_order_at || '').localeCompare(String(a.last_order_at || ''))],
  orders: [N_('Most orders (30 days)'), (a, b) => b.orders_30d - a.orders_30d],
  sales: [N_('Most sales (30 days)'), (a, b) => b.sales_30d_cents - a.sales_30d_cents],
  name: [N_('Name'), (a, b) => a.name.localeCompare(b.name)],
};
const listState = { q: '', sort: 'recent', show: 'all' };

async function overview() {
  const { totals: s, shops } = await api('GET', '/overview');
  document.title = t('Partners · Admin');
  app.innerHTML = `
    <div class="page-head"><div><h1>${t('Partners')}</h1><p class="sub">${t('Every dry cleaner using the app, and how they’re doing.')}</p></div></div>
    <div class="stats four">
      ${stat('primary', 'store', t('Partners'), s.shops, tn(s.new_shops_30d, '{n} new in the last 30 days', '{n} new in the last 30 days'))}
      ${stat('ready', 'sparkle', t('Active this month'), s.active_shops, t('Took an order in the last 30 days'))}
      ${stat('cleaning', 'receipt', t('Orders (30 days)'), s.orders_30d.toLocaleString(L()), t('{n} all time', { n: s.orders.toLocaleString(L()) }))}
      ${stat('received', 'dollar', t('Sales (30 days)'), money(s.sales_30d_cents), t('{amount} all time', { amount: money(s.sales_cents) }))}
      ${stat('primary', 'users', t('Customers'), s.customers.toLocaleString(L()), t('Across all partners'))}
      ${stat('ready', 'receipt', t('Active orders'), s.active_orders.toLocaleString(L()), t('In the shops right now'))}
      ${stat('cleaning', 'phone', t('Texts sent (30 days)'), s.texts_30d.toLocaleString(L()))}
      ${stat('received', 'mail', t('Emails sent (30 days)'), s.emails_30d.toLocaleString(L()))}
    </div>
    <div class="card">
      <div class="card-head">${icon('store')}<h2>${t('All partners')}</h2><span class="spacer"></span>
        <div class="tabs" id="show">${[['all', t('All')], ['active', t('Active this month')], ['new', t('Just joined')], ['quiet', t('No recent orders')]]
          .map(([k, l]) => `<button data-show="${k}" class="${k === listState.show ? 'active' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="card-body row" style="border-bottom:1px solid var(--border)">
        <form class="search" style="flex:1;min-width:220px" id="sf">${icon('search')}<input id="q" value="${esc(listState.q)}" placeholder="${esc(t('Search shop, owner or email'))}"></form>
        <label class="row tight small muted">${t('Sort by')}
          <select id="sort" style="width:auto">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}" ${k === listState.sort ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>
      </div>
      <div id="partners"></div>
    </div>`;

  const draw = () => {
    const q = listState.q.toLowerCase();
    const rows = shops
      .filter((p) => listState.show === 'all' || p.status === listState.show)
      .filter((p) => !q || [p.name, p.owner?.name, p.owner?.email].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort(SORTS[listState.sort][1]);
    $('#partners').innerHTML = rows.length
      ? `<div class="list">
        <div class="list-row partner-row list-head"><div>${t('Shop')}</div><div>${t('Joined')}</div><div>${t('Last order')}</div><div class="num">${t('Customers')}</div><div class="num">${t('Orders (30 days)')}</div><div class="num">${t('Sales (30 days)')}</div><div>${t('Status')}</div></div>
        ${rows.map((p) => `<a class="list-row partner-row click" href="#/shops/${p.id}">
          <div class="who-cell">${avatar(p.name)}<div><div class="name-line">${esc(p.name)}</div><div class="sub-line">${esc(p.owner ? `${p.owner.name} · ${p.owner.email}` : t('No owner account'))}</div></div></div>
          <div class="small hide-narrow">${shortDate(p.created_at)}</div>
          <div class="small hide-narrow">${esc(ago(p.last_order_at))}</div>
          <div class="num small hide-narrow">${p.customers.toLocaleString(L())}</div>
          <div class="num small hide-narrow">${p.orders_30d.toLocaleString(L())}</div>
          <div class="num small strong">${money(p.sales_30d_cents)}</div>
          <div>${partnerPill(p.status)}</div>
        </a>`).join('')}</div>`
      : `<div class="empty-state">${icon('store')}<h3>${shops.length ? t('No matching partners') : t('No partners yet')}</h3>
          <p>${shops.length ? t('Try a different search or filter.') : t('Shops appear here as soon as they sign up.')}</p></div>`;
  };
  let timer;
  $('#q').oninput = () => { clearTimeout(timer); timer = setTimeout(() => { listState.q = $('#q').value.trim(); draw(); }, 150); };
  $('#sf').onsubmit = (e) => e.preventDefault();
  $('#sort').onchange = () => { listState.sort = $('#sort').value; draw(); };
  $$('[data-show]').forEach((b) => (b.onclick = () => {
    listState.show = b.dataset.show;
    $$('[data-show]').forEach((x) => x.classList.toggle('active', x === b));
    draw();
  }));
  draw();
}

// ---------- one partner ----------
async function shopView(id) {
  const p = await api('GET', '/shops/' + id);
  const s = p.stats;
  const set = p.settings;
  document.title = `${p.name} · ${t('Admin')}`;
  const owner = p.team.find((u) => u.role === 'owner');
  const onOff = (v) => (v === '1' ? `<span class="pill ready plain">${t('On')}</span>` : `<span class="pill cancelled plain">${t('Off')}</span>`);
  const reminders = Number(set.max_reminders) > 0
    ? t('After {after} days, every {every} days, up to {max}', { after: esc(set.reminder_after_days), every: esc(set.reminder_interval_days), max: esc(set.max_reminders) })
    : t('Off');

  app.innerHTML = `
    <a class="back" href="#/">${icon('back', 'sm')}${t('All partners')}</a>
    <div class="page-head"><div class="who-cell">${avatar(p.name, 'lg')}<div>
      <h1>${esc(p.name)} ${partnerPill(p.status)}</h1>
      <p class="sub">${owner ? `${esc(owner.name)} · ${esc(owner.email)} · ` : ''}${t('Joined {date}', { date: shortDate(p.created_at) })}</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="view">${icon('open')}${t('Open their app')}</button></div></div>
    <div class="stats three">
      ${stat('cleaning', 'receipt', t('Orders (30 days)'), s.orders_30d, t('{n} all time', { n: s.orders }))}
      ${stat('received', 'dollar', t('Sales (30 days)'), money(s.sales_30d_cents), t('{amount} all time', { amount: money(s.sales_cents) }))}
      ${stat('primary', 'users', t('Customers'), s.customers)}
      ${stat('ready', 'receipt', t('Active orders'), s.active_orders, t('Last order: {when}', { when: esc(ago(s.last_order_at)) }))}
      ${stat('cleaning', 'phone', t('Texts sent (30 days)'), s.texts_30d)}
      ${stat('received', 'mail', t('Emails sent (30 days)'), s.emails_30d)}
    </div>
    <div class="grid sidebar-right">
      <div class="stack">
        <div class="card"><div class="card-head">${icon('receipt')}<h2>${t('Recent orders')}</h2></div>
          ${p.recent_orders.length
            ? `<div class="table-scroll"><table class="items-table"><thead><tr><th>${t('Ticket')}</th><th>${t('Customer')}</th><th>${t('Status')}</th><th class="num hide-md">${t('Items')}</th><th class="num">${t('Total')}</th><th class="hide-md">${t('Dropped off')}</th></tr></thead>
              <tbody>${p.recent_orders.map((o) => `<tr><td class="strong">#${esc(o.ticket)}</td><td>${esc(o.customer_name)}</td><td>${orderPill(o.status)}</td>
                <td class="num hide-md" title="${esc(o.items.map((i) => `${i.qty} × ${itemName(i.description.split(' — ')[0])}`).join(', '))}">${o.piece_count}</td>
                <td class="num">${money(o.total_cents)}</td><td class="small muted hide-md">${dateTime(o.created_at)}</td></tr>`).join('')}</tbody></table></div>`
            : `<div class="empty-state">${icon('receipt')}<h3>${t('No orders yet')}</h3></div>`}
        </div>
        <div class="card"><div class="card-head">${icon('message')}<h2>${t('Recent messages')}</h2></div>
          ${p.recent_messages.length
            ? `<div class="timeline">${p.recent_messages.map((m) => `<div class="msg ${m.direction === 'in' ? 'in' : ''}">
                <div class="msg-icon">${icon(m.channel === 'email' ? 'mail' : 'phone', 'sm')}</div>
                <div><div class="msg-meta"><span class="who">${esc(m.customer_name || m.to_addr || '')}</span><span>${t(CHANNEL[m.channel] || m.channel)}</span>
                  ${m.ticket ? `<span>#${esc(m.ticket)}</span>` : ''}<span>${dateTime(m.created_at)}</span>
                  <span class="pill ${m.direction === 'in' ? 'reply' : esc(m.status)}">${t(m.direction === 'in' ? 'Reply' : MSG_STATUS[m.status] || m.status)}</span></div>
                  <div class="msg-body">${m.subject ? `<strong>${esc(m.subject)}</strong>` : ''}${esc(m.body)}</div></div></div>`).join('')}</div>`
            : `<div class="empty-state">${icon('message')}<h3>${t('No messages yet')}</h3></div>`}
        </div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-head">${icon('store')}<h2>${t('Business details')}</h2></div>
          <div class="card-body"><dl class="kv">
            <dt>${t('Phone')}</dt><dd>${set.business_phone ? `<a href="tel:${esc(set.business_phone)}">${esc(set.business_phone)}</a>` : '—'}</dd>
            <dt>${t('Email')}</dt><dd>${set.business_email ? `<a href="mailto:${esc(set.business_email)}">${esc(set.business_email)}</a>` : '—'}</dd>
            <dt>${t('Address')}</dt><dd>${esc(set.business_address || '—')}</dd>
            <dt>${t('Sales tax (%)')}</dt><dd>${esc(set.tax_rate)}</dd>
            <dt>${t('Ticket numbers')}</dt><dd>${set.ticket_mode === 'manual' ? t('Use my paper ticket numbers') : t('Number orders automatically')}</dd>
          </dl></div></div>
        <div class="card"><div class="card-head">${icon('bell')}<h2>${t('Notifications')}</h2></div>
          <div class="card-body"><dl class="kv">
            <dt>${t('Ready notices')}</dt><dd>${onOff(set.auto_notify_ready)}</dd>
            <dt>${t('Texts')}</dt><dd>${onOff(set.notify_sms)}</dd>
            <dt>${t('Emails')}</dt><dd>${onOff(set.notify_email)}</dd>
            <dt>${t('Reminders')}</dt><dd>${reminders}</dd>
          </dl></div></div>
        <div class="card"><div class="card-head">${icon('users')}<h2>${t('Team')}</h2><span class="spacer"></span><span class="hint">${tn(p.team.length, '{n} person', '{n} people')}</span></div>
          <div class="list">${p.team.map((u) => `<div class="list-row" style="grid-template-columns:minmax(0,1fr) auto">
            <div class="who-cell">${avatar(u.name)}<div><div class="name-line">${esc(u.name)}</div><div class="sub-line">${esc(u.email)}</div></div></div>
            <span class="pill plain ${u.role === 'owner' ? 'picked_up' : 'received'}">${u.role === 'owner' ? t('Owner') : t('Staff')}</span></div>`).join('')}</div></div>
      </div>
    </div>`;

  $('#view').onclick = async (e) => {
    if (!confirm(t('Open {shop}’s app as its owner? Anything you change there is real. The session ends after 2 hours.', { shop: p.name }))) return;
    e.currentTarget.disabled = true;
    try {
      await api('POST', `/shops/${id}/view`);
      location.href = '/#/dashboard';
    } catch (ex) {
      toast(ex.message);
      e.currentTarget.disabled = false;
    }
  };
}

// ---------- router ----------
let signedIn = false;
async function route() {
  if (!signedIn) return;
  const m = location.hash.match(/^#\/shops\/(\d+)$/);
  try {
    if (m) await shopView(Number(m[1]));
    else await overview();
    window.scrollTo(0, 0);
  } catch (e) {
    if (e.handled) return;
    app.innerHTML = `<div class="card"><div class="empty-state">${icon('alert')}<h3>${t('Something went wrong')}</h3><p>${esc(e.message)}</p>
      <a class="btn" href="#/">${t('All partners')}</a></div></div>`;
  }
}

async function start() {
  try {
    const me = await api('GET', '/me');
    signedIn = true;
    $('#admin-who').textContent = me.email;
    $('#admin-who').hidden = $('#admin-logout').hidden = false;
    await route();
  } catch (e) {
    if (!e.handled) app.innerHTML = `<div class="card"><div class="empty-state">${icon('alert')}<h3>${esc(e.message)}</h3></div></div>`;
  }
}

$('#admin-logout').onclick = async () => {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
  signedIn = false;
  showLogin();
};
I18N.mount();
I18N.onChange(() => (signedIn ? route() : showLogin()));
window.addEventListener('hashchange', route);
start();
