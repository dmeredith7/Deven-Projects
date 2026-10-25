'use strict';

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (c) => '$' + (Number(c || 0) / 100).toFixed(2);
const toCents = (v) => Math.round(parseFloat(String(v).replace(/[^0-9.\-]/g, '')) * 100) || 0;
const dollars = (c) => (Number(c || 0) / 100).toFixed(2);
const date = (s) => (s ? String(s).slice(0, 10) : '');
const dateTime = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString() : '');
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_LABEL = { received: 'Received', cleaning: 'Cleaning', ready: 'Ready', picked_up: 'Picked up', cancelled: 'Cancelled' };
const badge = (s) => `<span class="badge ${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;

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
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

const CHANNEL_LABEL = { sms: 'Text', email: 'Email' };
function messageToast(list) {
  list = [].concat(list || []);
  if (!list.length) return;
  toast(
    list
      .map((m) => {
        const ch = CHANNEL_LABEL[m.channel] || m.channel;
        if (m.status === 'sent') return `${ch} sent`;
        if (m.status === 'logged') return `${ch} logged (not configured yet)`;
        return `${ch} ${m.status}${m.error ? ': ' + m.error : ''}`;
      })
      .join(' · ')
  );
}

function messageTable(list, { showCustomer = false } = {}) {
  if (!list.length) return '<div class="empty">No messages yet</div>';
  return `<div class="table-wrap"><table><tbody>${list
    .map(
      (m) => `<tr class="${m.direction === 'in' ? 'inbound' : ''}">
      <td class="small muted">${dateTime(m.created_at)}</td>
      <td><span class="channel">${m.direction === 'in' ? '↩ ' : ''}${esc(CHANNEL_LABEL[m.channel] || m.channel)}</span><div class="small muted">${esc(m.kind)}</div></td>
      ${showCustomer ? `<td>${m.customer_id ? `<a href="#/customers/${m.customer_id}">${esc(m.customer_name)}</a>` : esc(m.to_addr)}${m.order_id ? `<div class="small"><a href="#/orders/${m.order_id}">#${esc(m.ticket)}</a></div>` : ''}</td>` : ''}
      <td class="small">${m.subject ? `<strong>${esc(m.subject)}</strong><br>` : ''}${esc(m.body).replace(/\n/g, '<br>')}</td>
      <td>${badge(m.status)}${m.error ? `<div class="small muted">${esc(m.error)}</div>` : ''}</td></tr>`
    )
    .join('')}</tbody></table></div>`;
}

function orderRows(list, { showCustomer = true } = {}) {
  if (!list.length) return '<div class="empty">No orders</div>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>Ticket</th>${showCustomer ? '<th>Customer</th>' : ''}<th>Status</th><th>Pieces</th>
      <th>Due</th><th>Rack</th><th class="num">Total</th><th class="num">Balance</th></tr></thead>
    <tbody>${list
      .map(
        (o) => `<tr class="click" data-href="#/orders/${o.id}">
        <td><strong>#${esc(o.ticket)}</strong></td>
        ${showCustomer ? `<td>${esc(o.customer_name)}<div class="muted small">${esc(o.customer_phone)}</div></td>` : ''}
        <td>${badge(o.status)}</td><td>${o.piece_count}</td>
        <td>${o.due_date && o.due_date < today() && ['received', 'cleaning'].includes(o.status) ? `<span class="danger">${esc(o.due_date)}</span>` : esc(o.due_date)}</td>
        <td>${esc(o.rack)}</td>
        <td class="num">${money(o.total_cents)}</td>
        <td class="num ${o.balance_cents > 0 ? 'danger' : ''}">${money(o.balance_cents)}</td></tr>`
      )
      .join('')}</tbody></table></div>`;
}

document.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-href]');
  if (tr && !e.target.closest('button, input, select, a')) location.hash = tr.dataset.href;
});

// ---------- views ----------
const views = {};

views.dashboard = async () => {
  const d = await api('GET', '/dashboard');
  app.innerHTML = `
    <h1>Dashboard</h1>
    <div class="stats">
      <div class="stat"><div class="label">In process</div><div class="value">${d.by_status.received + d.by_status.cleaning}</div></div>
      <div class="stat"><div class="label">Ready for pickup</div><div class="value">${d.by_status.ready}</div></div>
      <div class="stat"><div class="label">Orders today</div><div class="value">${d.orders_today}</div></div>
      <div class="stat"><div class="label">Sales today</div><div class="value">${money(d.sales_today_cents)}</div></div>
      <div class="stat"><div class="label">Unpaid balances</div><div class="value">${money(d.outstanding_balance_cents)}</div></div>
      <div class="stat"><div class="label">Customers</div><div class="value">${d.customers}</div></div>
    </div>
    <div class="panel">
      <div class="row"><h2>Due today / overdue</h2></div>
      ${orderRows(d.due_or_overdue)}
    </div>
    <div class="panel">
      <div class="row"><h2>Awaiting pickup</h2><span class="spacer"></span>
        <span class="muted small">${d.reminders_due} reminder(s) due</span>
        <button id="run-rem">Send due reminders now</button></div>
      ${orderRows(d.awaiting_pickup)}
    </div>`;
  $('#run-rem').onclick = async () => {
    const r = await api('POST', '/reminders/run');
    toast(`${r.sent.length} reminder(s) processed`);
    route();
  };
};

let orderTab = 'open';
views.orders = async () => {
  const tabs = [['open', 'Open'], ['received', 'Received'], ['cleaning', 'Cleaning'], ['ready', 'Ready'], ['picked_up', 'Picked up'], ['', 'All']];
  app.innerHTML = `
    <div class="row"><h1>Orders</h1><span class="spacer"></span>
      <input id="q" placeholder="Search ticket, name, phone, rack" size="30"></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === orderTab ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="panel" id="list"></div>`;
  const load = async () => {
    const p = new URLSearchParams();
    if (orderTab) p.set('status', orderTab);
    if ($('#q').value) p.set('q', $('#q').value);
    $('#list').innerHTML = orderRows(await api('GET', '/orders?' + p));
  };
  $$('[data-tab]').forEach((b) => (b.onclick = () => { orderTab = b.dataset.tab; $$('[data-tab]').forEach((x) => x.classList.toggle('active', x === b)); load(); }));
  let t;
  $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 200); };
  await load();
};

views.newOrder = async (_, query) => {
  const [services, settings] = await Promise.all([api('GET', '/services'), api('GET', '/settings')]);
  const active = services.filter((s) => s.active);
  let customer = null;
  const due = new Date(Date.now() + (Number(settings.default_turnaround_days) || 3) * 864e5).toISOString().slice(0, 10);
  const taxRate = Number(settings.tax_rate) || 0;

  app.innerHTML = `
    <h1>New Order</h1>
    <div class="panel">
      <h2>Customer</h2>
      <div id="cust-picked" class="row" style="display:none"></div>
      <div id="cust-search">
        <input id="cust-q" placeholder="Search by name or phone…" style="width:100%">
        <div id="cust-suggest" class="suggest" style="display:none"></div>
        <details style="margin-top:10px"><summary>+ Add new customer</summary>
          <div class="form" style="margin-top:10px">
            <label>Name<input id="nc-name"></label>
            <label>Phone<input id="nc-phone" type="tel"></label>
            <label>Email<input id="nc-email" type="email"></label>
            <label>Preferences<input id="nc-pref" placeholder="e.g. light starch, on hangers"></label>
            <div><button id="nc-save" class="primary">Save customer</button></div>
          </div>
        </details>
      </div>
    </div>
    <div class="panel">
      <h2>Items</h2>
      <div class="table-wrap"><table class="items">
        <thead><tr><th style="width:38%">Service</th><th>Description / notes</th><th>Qty</th><th>Price</th><th class="num">Line</th><th></th></tr></thead>
        <tbody id="lines"></tbody></table></div>
      <div class="row" style="margin-top:10px"><button id="add-line">+ Add item</button></div>
    </div>
    <div class="panel">
      <div class="form">
        <label>Due date<input id="due" type="date" value="${due}"></label>
        <label>Rack / bin<input id="rack" placeholder="optional"></label>
        <label>Discount ($)<input id="discount" value="0.00" inputmode="decimal"></label>
        <label>Paid now ($)<input id="paid" value="0.00" inputmode="decimal"></label>
        <label class="full">Order notes<textarea id="notes" placeholder="Stains, damage, special instructions"></textarea></label>
      </div>
      <div class="totals" id="totals"></div>
      <div class="row" style="margin-top:12px"><span class="spacer"></span><button id="save" class="primary">Create order</button></div>
    </div>`;

  const options = active.map((s) => `<option value="${s.id}" data-price="${s.price_cents}">${esc(s.category)} — ${esc(s.name)} (${money(s.price_cents)})</option>`).join('');
  const addLine = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select class="svc"><option value="">Custom item…</option>${options}</select></td>
      <td><input class="desc" placeholder="Color, brand, stain…"></td>
      <td class="qty"><input class="qty-in" type="number" min="1" value="1"></td>
      <td class="price"><input class="price-in" inputmode="decimal" value="0.00"></td>
      <td class="num line">$0.00</td><td><button class="danger rm" title="Remove">✕</button></td>`;
    $('#lines').append(tr);
    $('.svc', tr).onchange = (e) => { const o = e.target.selectedOptions[0]; if (o.dataset.price) $('.price-in', tr).value = dollars(o.dataset.price); recalc(); };
    $('.rm', tr).onclick = () => { tr.remove(); recalc(); };
    $$('input', tr).forEach((i) => (i.oninput = recalc));
  };
  const lines = () =>
    $$('#lines tr').map((tr) => {
      const sel = $('.svc', tr);
      const svcName = sel.value ? active.find((s) => s.id == sel.value).name : '';
      const extra = $('.desc', tr).value.trim();
      return {
        service_id: sel.value ? Number(sel.value) : null,
        description: svcName ? (extra ? `${svcName} — ${extra}` : svcName) : extra,
        qty: Number($('.qty-in', tr).value) || 1,
        price_cents: toCents($('.price-in', tr).value),
      };
    });
  const recalc = () => {
    const ls = lines();
    $$('#lines tr').forEach((tr, i) => ($('.line', tr).textContent = money(ls[i].qty * ls[i].price_cents)));
    const sub = ls.reduce((s, l) => s + l.qty * l.price_cents, 0);
    const taxable = Math.max(0, sub - toCents($('#discount').value));
    const tax = Math.round((taxable * taxRate) / 100);
    $('#totals').innerHTML = `<div><span>Subtotal</span><span>${money(sub)}</span></div>
      <div><span>Discount</span><span>-${money(toCents($('#discount').value))}</span></div>
      <div><span>Tax (${taxRate}%)</span><span>${money(tax)}</span></div>
      <div class="grand"><span>Total</span><span>${money(taxable + tax)}</span></div>
      <div><span>Balance due</span><span>${money(taxable + tax - toCents($('#paid').value))}</span></div>`;
  };
  ['#discount', '#paid'].forEach((s) => ($(s).oninput = recalc));

  const pick = (c) => {
    customer = c;
    $('#cust-search').style.display = 'none';
    const box = $('#cust-picked');
    box.style.display = 'flex';
    box.innerHTML = `<div><strong>${esc(c.name)}</strong> <span class="muted">${esc(c.phone)} ${esc(c.email)}</span>
      ${c.preferences ? `<div class="small">Preferences: ${esc(c.preferences)}</div>` : ''}</div>
      <span class="spacer"></span><button id="change-cust">Change</button>`;
    $('#change-cust').onclick = () => { customer = null; box.style.display = 'none'; $('#cust-search').style.display = ''; };
  };
  let st;
  $('#cust-q').oninput = () => {
    clearTimeout(st);
    st = setTimeout(async () => {
      const q = $('#cust-q').value.trim();
      const box = $('#cust-suggest');
      if (!q) return (box.style.display = 'none');
      const list = await api('GET', '/customers?q=' + encodeURIComponent(q));
      box.style.display = '';
      box.innerHTML = list.length ? list.map((c, i) => `<div data-i="${i}">${esc(c.name)} <span class="muted">${esc(c.phone)}</span></div>`).join('') : '<div class="muted">No match — add a new customer below</div>';
      $$('[data-i]', box).forEach((d) => (d.onclick = () => pick(list[d.dataset.i])));
    }, 150);
  };
  $('#nc-save').onclick = async () => {
    try {
      pick(await api('POST', '/customers', { name: $('#nc-name').value, phone: $('#nc-phone').value, email: $('#nc-email').value, preferences: $('#nc-pref').value }));
    } catch (e) { toast(e.message); }
  };
  $('#add-line').onclick = addLine;
  $('#save').onclick = async () => {
    if (!customer) return toast('Pick or add a customer first');
    try {
      const o = await api('POST', '/orders', {
        customer_id: customer.id,
        items: lines().filter((l) => l.description),
        due_date: $('#due').value,
        rack: $('#rack').value,
        notes: $('#notes').value,
        discount_cents: toCents($('#discount').value),
        paid_cents: toCents($('#paid').value),
      });
      toast(`Order #${o.ticket} created`);
      location.hash = `#/orders/${o.id}`;
    } catch (e) { toast(e.message); }
  };

  addLine();
  recalc();
  if (query.get('customer')) pick(await api('GET', '/customers/' + query.get('customer')));
};

views.order = async ([id]) => {
  const [o, settings] = await Promise.all([api('GET', '/orders/' + id), api('GET', '/settings')]);
  const next = { received: 'cleaning', cleaning: 'ready', ready: 'picked_up' }[o.status];
  app.innerHTML = `
    <div class="row"><h1>Order #${esc(o.ticket)} ${badge(o.status)}</h1><span class="spacer"></span>
      <button id="print">Print ticket</button></div>
    <div class="grid two">
      <div class="panel">
        <h2>Customer</h2>
        <div><a href="#/customers/${o.customer_id}"><strong>${esc(o.customer_name)}</strong></a></div>
        <div class="muted">${esc(o.customer_phone)} ${esc(o.customer_email)}</div>
        ${o.customer_preferences ? `<div class="small">Preferences: ${esc(o.customer_preferences)}</div>` : ''}
        <h2 style="margin-top:16px">Status</h2>
        <div class="row">
          ${next ? `<button class="primary" data-status="${next}">Mark ${STATUS_LABEL[next]}</button>` : ''}
          <select id="status-sel">${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button id="set-status">Set</button>
        </div>
        <div class="small muted" style="margin-top:8px">
          Dropped off ${dateTime(o.created_at)}<br>
          ${o.ready_at ? `Ready ${dateTime(o.ready_at)}<br>` : ''}
          ${o.picked_up_at ? `Picked up ${dateTime(o.picked_up_at)}<br>` : ''}
          ${o.reminder_count ? `${o.reminder_count} pickup reminder(s) sent, last ${dateTime(o.last_reminder_at)}` : ''}
        </div>
      </div>
      <div class="panel">
        <h2>Details</h2>
        <div class="form">
          <label>Due date<input id="due" type="date" value="${esc(o.due_date)}"></label>
          <label>Rack / bin<input id="rack" value="${esc(o.rack)}"></label>
          <label class="full">Notes<textarea id="notes">${esc(o.notes)}</textarea></label>
        </div>
        <div class="row" style="margin-top:10px"><span class="spacer"></span><button id="save-details">Save details</button></div>
      </div>
    </div>
    <div class="panel">
      <h2>Items (${o.piece_count} pieces)</h2>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th class="num">Price</th><th class="num">Line</th></tr></thead>
      <tbody>${o.items.map((i) => `<tr><td>${esc(i.description)}</td><td>${i.qty}</td><td class="num">${money(i.price_cents)}</td><td class="num">${money(i.qty * i.price_cents)}</td></tr>`).join('')}</tbody></table></div>
      <div class="totals" style="margin-top:10px">
        <div><span>Subtotal</span><span>${money(o.subtotal_cents)}</span></div>
        ${o.discount_cents ? `<div><span>Discount</span><span>-${money(o.discount_cents)}</span></div>` : ''}
        <div><span>Tax (${o.tax_rate}%)</span><span>${money(o.tax_cents)}</span></div>
        <div class="grand"><span>Total</span><span>${money(o.total_cents)}</span></div>
        <div><span>Paid</span><span>${money(o.paid_cents)}</span></div>
        <div><strong>Balance</strong><strong class="${o.balance_cents > 0 ? 'danger' : ''}">${money(o.balance_cents)}</strong></div>
      </div>
      <div class="row" style="margin-top:12px"><span class="spacer"></span>
        <input id="pay-amt" inputmode="decimal" size="8" value="${dollars(Math.max(0, o.balance_cents))}">
        <button id="pay" class="primary">Record payment</button>
      </div>
    </div>
    <div class="panel">
      <div class="row"><h2>Messages</h2><span class="spacer"></span>
        <button data-notify="ready">Send "ready" notice</button>
        <button data-notify="reminder">Send pickup reminder</button></div>
      <p class="small muted">Sent by text and/or email, depending on the customer's contact details and preferences.</p>
      ${messageTable(o.messages)}
    </div>
    <div class="ticket">
      <h3>${esc(settings.business_name)}</h3>
      <div style="text-align:center">${esc(settings.business_phone)}</div>
      <div class="big">#${esc(o.ticket)}</div>
      <div>${esc(o.customer_name)} ${esc(o.customer_phone)}</div>
      <div>In: ${date(o.created_at)} &nbsp; Due: ${esc(o.due_date)}</div>
      ${o.rack ? `<div>Rack: ${esc(o.rack)}</div>` : ''}
      <hr><table>${o.items.map((i) => `<tr><td>${i.qty} × ${esc(i.description)}</td><td style="text-align:right">${money(i.qty * i.price_cents)}</td></tr>`).join('')}</table><hr>
      <table><tr><td>Total</td><td style="text-align:right">${money(o.total_cents)}</td></tr>
      <tr><td>Paid</td><td style="text-align:right">${money(o.paid_cents)}</td></tr>
      <tr><td><strong>Balance</strong></td><td style="text-align:right"><strong>${money(o.balance_cents)}</strong></td></tr></table>
      ${o.notes ? `<p>${esc(o.notes)}</p>` : ''}
    </div>`;

  const setStatus = async (status) => {
    try {
      const r = await api('POST', `/orders/${id}/status`, { status });
      if (r.messages.length) messageToast(r.messages);
      else toast(`Marked ${STATUS_LABEL[status]}`);
      route();
    } catch (e) { toast(e.message); }
  };
  $$('[data-status]').forEach((b) => (b.onclick = () => setStatus(b.dataset.status)));
  $('#set-status').onclick = () => setStatus($('#status-sel').value);
  $('#print').onclick = () => window.print();
  $('#save-details').onclick = async () => {
    await api('PUT', '/orders/' + id, { due_date: $('#due').value, rack: $('#rack').value, notes: $('#notes').value });
    toast('Saved');
    route();
  };
  $('#pay').onclick = async () => {
    try {
      await api('POST', `/orders/${id}/payment`, { amount_cents: toCents($('#pay-amt').value) });
      toast('Payment recorded');
      route();
    } catch (e) { toast(e.message); }
  };
  $$('[data-notify]').forEach((b) => (b.onclick = async () => { messageToast(await api('POST', `/orders/${id}/notify`, { kind: b.dataset.notify })); route(); }));
};

views.customers = async () => {
  app.innerHTML = `
    <div class="row"><h1>Customers</h1><span class="spacer"></span>
      <input id="q" placeholder="Search name, phone, email" size="28"></div>
    <details class="panel"><summary><strong>+ Add customer</strong></summary>
      <div class="form" style="margin-top:12px">
        <label>Name<input id="c-name"></label>
        <label>Phone<input id="c-phone" type="tel"></label>
        <label>Email<input id="c-email" type="email"></label>
        <label>Preferences<input id="c-pref" placeholder="e.g. no starch, boxed shirts"></label>
        <div><button id="c-save" class="primary">Save</button></div>
      </div></details>
    <div class="panel" id="list"></div>`;
  const load = async () => {
    const list = await api('GET', '/customers?q=' + encodeURIComponent($('#q').value));
    $('#list').innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Orders</th><th>Open</th><th>Last order</th></tr></thead><tbody>
        ${list.map((c) => `<tr class="click" data-href="#/customers/${c.id}"><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td><td>${c.order_count}</td><td>${c.open_orders}</td><td>${date(c.last_order_at)}</td></tr>`).join('')}
        </tbody></table></div>`
      : '<div class="empty">No customers yet</div>';
  };
  let t;
  $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 200); };
  $('#c-save').onclick = async () => {
    try {
      const c = await api('POST', '/customers', { name: $('#c-name').value, phone: $('#c-phone').value, email: $('#c-email').value, preferences: $('#c-pref').value });
      location.hash = '#/customers/' + c.id;
    } catch (e) { toast(e.message); }
  };
  await load();
};

views.customer = async ([id]) => {
  const c = await api('GET', '/customers/' + id);
  app.innerHTML = `
    <div class="row"><h1>${esc(c.name)}</h1><span class="spacer"></span>
      <a class="btn primary" href="#/orders/new?customer=${c.id}">+ New order</a></div>
    <div class="stats">
      <div class="stat"><div class="label">Orders</div><div class="value">${c.orders.length}</div></div>
      <div class="stat"><div class="label">Lifetime value</div><div class="value">${money(c.lifetime_value_cents)}</div></div>
      <div class="stat"><div class="label">Customer since</div><div class="value" style="font-size:18px">${date(c.created_at)}</div></div>
    </div>
    <div class="grid two">
      <div class="panel"><h2>Profile</h2>
        <div class="form">
          <label>Name<input id="name" value="${esc(c.name)}"></label>
          <label>Phone<input id="phone" type="tel" value="${esc(c.phone)}"></label>
          <label>Email<input id="email" type="email" value="${esc(c.email)}"></label>
          <label>Preferences<input id="pref" value="${esc(c.preferences)}"></label>
          <label class="full">Notes<textarea id="notes">${esc(c.notes)}</textarea></label>
          <label class="check full"><input id="sms" type="checkbox" ${c.sms_opt_in ? 'checked' : ''}> Send text message notifications</label>
          <label class="check full"><input id="emailopt" type="checkbox" ${c.email_opt_in ? 'checked' : ''}> Send email notifications</label>
        </div>
        <div class="row" style="margin-top:10px"><button id="del" class="danger">Delete</button><span class="spacer"></span><button id="save" class="primary">Save</button></div>
      </div>
      <div class="panel"><h2>Send a message</h2>
        <div class="row" style="margin-bottom:8px">
          <label class="check"><input type="checkbox" id="ch-sms" ${c.phone ? 'checked' : 'disabled'}> Text</label>
          <label class="check"><input type="checkbox" id="ch-email" ${c.email ? (c.phone ? '' : 'checked') : 'disabled'}> Email</label>
        </div>
        <input id="subj" placeholder="Email subject" style="width:100%;margin-bottom:8px" ${c.email && !c.phone ? '' : 'hidden'}>
        <textarea id="msg" placeholder="Type a message to ${esc(c.name)}…"></textarea>
        <div class="row" style="margin-top:8px"><span class="spacer"></span><button id="send">Send</button></div>
        <h2 style="margin-top:16px">Recent messages</h2>
        ${messageTable(c.messages)}
      </div>
    </div>
    <div class="panel"><h2>Order history</h2>${orderRows(c.orders, { showCustomer: false })}</div>`;
  $('#save').onclick = async () => {
    try {
      await api('PUT', '/customers/' + id, { name: $('#name').value, phone: $('#phone').value, email: $('#email').value, preferences: $('#pref').value, notes: $('#notes').value, sms_opt_in: $('#sms').checked, email_opt_in: $('#emailopt').checked });
      toast('Saved');
      route();
    } catch (e) { toast(e.message); }
  };
  $('#del').onclick = async () => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try { await api('DELETE', '/customers/' + id); location.hash = '#/customers'; } catch (e) { toast(e.message); }
  };
  $('#ch-email').onchange = () => ($('#subj').hidden = !$('#ch-email').checked);
  $('#send').onclick = async () => {
    const channels = [$('#ch-sms').checked && 'sms', $('#ch-email').checked && 'email'].filter(Boolean);
    if (!channels.length) return toast('Choose text and/or email');
    try { messageToast(await api('POST', `/customers/${id}/message`, { body: $('#msg').value, subject: $('#subj').value, channels })); route(); } catch (e) { toast(e.message); }
  };
};

views.services = async () => {
  const list = await api('GET', '/services');
  app.innerHTML = `
    <h1>Price List</h1>
    <div class="panel">
      <div class="table-wrap"><table><thead><tr><th>Category</th><th>Service</th><th>Price ($)</th><th>Active</th><th></th></tr></thead>
      <tbody>${list.map((s) => `<tr data-id="${s.id}">
        <td><input class="cat" value="${esc(s.category)}"></td><td><input class="name" value="${esc(s.name)}" style="width:100%"></td>
        <td><input class="price" value="${dollars(s.price_cents)}" size="7" inputmode="decimal"></td>
        <td><input class="active" type="checkbox" ${s.active ? 'checked' : ''}></td>
        <td class="row"><button class="save">Save</button><button class="del danger">✕</button></td></tr>`).join('')}
        <tr id="new-row"><td><input class="cat" placeholder="Category" value="Dry Clean"></td><td><input class="name" placeholder="New service" style="width:100%"></td>
        <td><input class="price" placeholder="0.00" size="7" inputmode="decimal"></td><td></td><td><button class="primary add">Add</button></td></tr>
      </tbody></table></div>
    </div>`;
  const read = (tr) => ({ category: $('.cat', tr).value, name: $('.name', tr).value, price_cents: toCents($('.price', tr).value) });
  $$('tr[data-id]').forEach((tr) => {
    $('.save', tr).onclick = async () => { try { await api('PUT', '/services/' + tr.dataset.id, { ...read(tr), active: $('.active', tr).checked }); toast('Saved'); } catch (e) { toast(e.message); } };
    $('.del', tr).onclick = async () => { const r = await api('DELETE', '/services/' + tr.dataset.id); toast(r.deactivated ? 'Used on past orders — deactivated instead' : 'Deleted'); route(); };
  });
  $('#new-row .add').onclick = async () => { try { await api('POST', '/services', read($('#new-row'))); route(); } catch (e) { toast(e.message); } };
};

let messageFilter = '';
views.messages = async () => {
  const list = await api('GET', '/messages' + (messageFilter ? '?channel=' + messageFilter : ''));
  app.innerHTML = `<div class="row"><h1>Messages</h1><span class="spacer"></span>
    <div class="tabs">${[['', 'All'], ['sms', 'Texts'], ['email', 'Emails']].map(([k, l]) => `<button data-ch="${k}" class="${k === messageFilter ? 'active' : ''}">${l}</button>`).join('')}</div></div>
    <p class="small muted">Every text and email sent to customers, plus their text replies (↩).</p>
    <div class="panel">${messageTable(list, { showCustomer: true })}</div>`;
  $$('[data-ch]').forEach((b) => (b.onclick = () => { messageFilter = b.dataset.ch; route(); }));
};

const PROVIDER_LABEL = { twilio: 'Twilio', resend: 'Resend', sendgrid: 'SendGrid', postmark: 'Postmark' };
views.settings = async () => {
  const [s, team] = await Promise.all([api('GET', '/settings'), api('GET', '/team')]);
  const owner = isOwner();
  const ro = owner ? '' : 'disabled';
  const pill = (mode, label) =>
    `<span class="status-pill ${mode !== 'log' ? 'on' : ''}"><span class="dot"></span>${label}: ${mode !== 'log' ? 'connected (' + esc(PROVIDER_LABEL[mode] || mode) + ')' : 'not connected, messages are logged only'}</span>`;
  const field = (name, label, attrs = '') => `<label>${label}<input name="${name}" value="${esc(s[name])}" ${attrs} ${ro}></label>`;
  const area = (name, label, rows = 3) => `<label class="full">${label}<textarea name="${name}" rows="${rows}" ${ro}>${esc(s[name])}</textarea></label>`;
  const check = (name, label) => `<label class="check full"><input name="${name}" type="checkbox" ${s[name] === '1' ? 'checked' : ''} ${ro}> ${label}</label>`;

  app.innerHTML = `
    <h1>Settings</h1>
    ${owner ? '' : '<p class="muted">Only the shop owner can change these settings.</p>'}
    <div class="panel">
      <h2>Business</h2>
      <div class="form">
        ${field('business_name', 'Business name')}
        ${field('business_phone', 'Business phone')}
        ${field('business_email', 'Business email (customers\' email replies go here)', 'type="email"')}
        ${field('business_address', 'Address')}
        ${field('tax_rate', 'Sales tax rate (%)', 'inputmode="decimal"')}
        ${field('default_turnaround_days', 'Default turnaround (days)', 'type="number" min="0"')}
      </div>
    </div>
    <div class="panel">
      <h2>Notifications</h2>
      <div class="row" style="margin-bottom:12px">${pill(s.channels.sms, 'Texts')} ${pill(s.channels.email, 'Email')}</div>
      <div class="form">
        ${check('notify_sms', 'Send text messages to customers who have a phone number')}
        ${check('notify_email', 'Send emails to customers who have an email address')}
        ${check('auto_notify_ready', 'Automatically notify the customer when an order is marked Ready')}
      </div>
      <h2 style="margin-top:18px">Pickup reminders</h2>
      <div class="form">
        ${field('reminder_after_days', 'First reminder after (days ready)', 'type="number" min="0"')}
        ${field('reminder_interval_days', 'Repeat every (days)', 'type="number" min="1"')}
        ${field('max_reminders', 'Max reminders per order (0 = off)', 'type="number" min="0"')}
      </div>
    </div>
    <div class="panel">
      <h2>Message wording</h2>
      <p class="small muted">Placeholders: {name} {full_name} {ticket} {business} {phone} {address} {total} {balance} {pieces} {due_date} {ready_date}.
        Texts automatically end with "Reply STOP to opt out." Emails include an unsubscribe link.</p>
      <div class="form">
        ${area('sms_template_ready', 'Text: order ready', 2)}
        ${area('sms_template_reminder', 'Text: pickup reminder', 2)}
        ${field('email_subject_ready', 'Email subject: order ready')}
        ${field('email_subject_reminder', 'Email subject: pickup reminder')}
        ${area('email_body_ready', 'Email: order ready', 7)}
        ${area('email_body_reminder', 'Email: pickup reminder', 7)}
      </div>
    </div>
    ${owner ? `<div class="row" style="margin-bottom:16px"><span class="spacer"></span><button id="save" class="primary">Save settings</button></div>
    <div class="panel">
      <h2>Send a test</h2>
      <p class="small muted">Check that messages really arrive. Try your own phone or email.</p>
      <div class="row"><input id="test-phone" type="tel" placeholder="Phone number"><button data-test="sms">Send test text</button></div>
      <div class="row" style="margin-top:8px"><input id="test-email" type="email" placeholder="Email address"><button data-test="email">Send test email</button></div>
    </div>` : ''}
    <div class="panel">
      <h2>Team</h2>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>
        ${team.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td>
          <td>${owner && u.id !== me.user.id ? `<button class="danger" data-remove="${u.id}">Remove</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      ${owner ? `<h2 style="margin-top:16px">Add a team member</h2>
      <div class="form">
        <label>Name<input id="t-name"></label>
        <label>Email<input id="t-email" type="email"></label>
        <label>Temporary password<input id="t-pass" type="text" minlength="8"></label>
        <label>Role<select id="t-role"><option value="staff">Staff (orders &amp; customers)</option><option value="owner">Owner (everything)</option></select></label>
        <div><button id="t-add" class="primary">Add</button></div>
      </div>` : ''}
    </div>
    <div class="panel">
      <h2>Your password</h2>
      <div class="form">
        <label>Current password<input id="pw-cur" type="password" autocomplete="current-password"></label>
        <label>New password<input id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
        <div><button id="pw-save">Change password</button></div>
      </div>
    </div>`;

  if (owner) {
    $('#save').onclick = async () => {
      const body = {};
      $$('[name]', app).forEach((el) => (body[el.name] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value));
      try {
        const saved = await api('PUT', '/settings', body);
        $('#brand').textContent = saved.business_name;
        toast('Settings saved');
      } catch (e) { toast(e.message); }
    };
    $$('[data-test]').forEach((b) => (b.onclick = async () => {
      const channel = b.dataset.test;
      try { messageToast(await api('POST', '/settings/test-message', { channel, to: $(channel === 'sms' ? '#test-phone' : '#test-email').value })); } catch (e) { toast(e.message); }
    }));
    $('#t-add').onclick = async () => {
      try {
        await api('POST', '/team', { name: $('#t-name').value, email: $('#t-email').value, password: $('#t-pass').value, role: $('#t-role').value });
        toast('Team member added. Share their email and temporary password with them.');
        route();
      } catch (e) { toast(e.message); }
    };
    $$('[data-remove]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Remove this team member? They will be logged out.')) return;
      try { await api('DELETE', '/team/' + b.dataset.remove); route(); } catch (e) { toast(e.message); }
    }));
  }
  $('#pw-save').onclick = async () => {
    try {
      await api('PUT', '/me/password', { current_password: $('#pw-cur').value, new_password: $('#pw-new').value });
      toast('Password changed');
      $('#pw-cur').value = $('#pw-new').value = '';
    } catch (e) { toast(e.message); }
  };
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

async function route() {
  const [path, qs] = location.hash.slice(1).split('?');
  const query = new URLSearchParams(qs || '');
  for (const [re, view, nav] of ROUTES) {
    const m = (path || '/').match(re);
    if (!m) continue;
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    try {
      await view(m.slice(1), query);
    } catch (e) {
      app.innerHTML = `<div class="panel"><strong>Error:</strong> ${esc(e.message)}</div>`;
    }
    return;
  }
  location.hash = '#/dashboard';
}

$('#logout').onclick = async () => {
  await api('POST', '/auth/logout').catch(() => {});
  location.href = '/login.html';
};

window.addEventListener('hashchange', route);
api('GET', '/me')
  .then((m) => {
    me = m;
    $('#brand').textContent = m.shop.name;
    $('#who').textContent = m.user.name;
    document.title = m.shop.name + ' — CRM';
    route();
  })
  .catch(() => {});
