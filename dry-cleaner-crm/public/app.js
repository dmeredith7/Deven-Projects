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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function messageToast(m) {
  if (!m) return;
  if (m.status === 'sent') toast('Text message sent to customer');
  else if (m.status === 'logged') toast('Message logged (SMS not configured)');
  else toast(`Message ${m.status}: ${m.error || ''}`);
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
        <button data-notify="ready">Send "ready" text</button>
        <button data-notify="reminder">Send pickup reminder</button></div>
      ${o.messages.length ? `<table><tbody>${o.messages.map((m) => `<tr><td class="small muted">${dateTime(m.created_at)}</td><td>${esc(m.kind)}</td><td>${esc(m.body)}</td><td>${badge(m.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No messages yet</div>'}
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
      messageToast(r.message);
      if (!r.message) toast(`Marked ${STATUS_LABEL[status]}`);
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
        </div>
        <div class="row" style="margin-top:10px"><button id="del" class="danger">Delete</button><span class="spacer"></span><button id="save" class="primary">Save</button></div>
      </div>
      <div class="panel"><h2>Send a message</h2>
        <textarea id="msg" placeholder="Type a text message to ${esc(c.name)}…"></textarea>
        <div class="row" style="margin-top:8px"><span class="spacer"></span><button id="send">Send</button></div>
        <h2 style="margin-top:16px">Recent messages</h2>
        ${c.messages.length ? `<table><tbody>${c.messages.map((m) => `<tr><td class="small muted">${dateTime(m.created_at)}</td><td class="small">${esc(m.body)}</td><td>${badge(m.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">None</div>'}
      </div>
    </div>
    <div class="panel"><h2>Order history</h2>${orderRows(c.orders, { showCustomer: false })}</div>`;
  $('#save').onclick = async () => {
    try {
      await api('PUT', '/customers/' + id, { name: $('#name').value, phone: $('#phone').value, email: $('#email').value, preferences: $('#pref').value, notes: $('#notes').value, sms_opt_in: $('#sms').checked });
      toast('Saved');
      route();
    } catch (e) { toast(e.message); }
  };
  $('#del').onclick = async () => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try { await api('DELETE', '/customers/' + id); location.hash = '#/customers'; } catch (e) { toast(e.message); }
  };
  $('#send').onclick = async () => {
    try { messageToast(await api('POST', `/customers/${id}/message`, { body: $('#msg').value })); route(); } catch (e) { toast(e.message); }
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

views.messages = async () => {
  const list = await api('GET', '/messages');
  app.innerHTML = `<h1>Messages</h1><div class="panel">${
    list.length
      ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Order</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>
        ${list.map((m) => `<tr><td class="small muted">${dateTime(m.created_at)}</td><td><a href="#/customers/${m.customer_id}">${esc(m.customer_name)}</a></td>
          <td>${m.order_id ? `<a href="#/orders/${m.order_id}">#${esc(m.ticket)}</a>` : ''}</td><td>${esc(m.kind)}</td><td class="small">${esc(m.body)}</td>
          <td>${badge(m.status)}${m.error ? `<div class="small muted">${esc(m.error)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">No messages sent yet</div>'
  }</div>`;
};

views.settings = async () => {
  const s = await api('GET', '/settings');
  app.innerHTML = `
    <h1>Settings</h1>
    <div class="panel">
      <h2>Business</h2>
      <div class="form">
        <label>Business name<input name="business_name" value="${esc(s.business_name)}"></label>
        <label>Business phone<input name="business_phone" value="${esc(s.business_phone)}"></label>
        <label>Sales tax rate (%)<input name="tax_rate" value="${esc(s.tax_rate)}" inputmode="decimal"></label>
        <label>Default turnaround (days)<input name="default_turnaround_days" type="number" min="0" value="${esc(s.default_turnaround_days)}"></label>
      </div>
    </div>
    <div class="panel">
      <h2>Notifications & reminders</h2>
      <p class="small muted">SMS mode: <strong>${s.sms_mode === 'sms' ? 'Twilio (live texts)' : 'Log only — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM to send real texts'}</strong></p>
      <div class="form">
        <label class="check full"><input name="auto_notify_ready" type="checkbox" ${s.auto_notify_ready === '1' ? 'checked' : ''}> Automatically text the customer when an order is marked Ready</label>
        <label>First pickup reminder after (days ready)<input name="reminder_after_days" type="number" min="0" value="${esc(s.reminder_after_days)}"></label>
        <label>Repeat reminder every (days)<input name="reminder_interval_days" type="number" min="1" value="${esc(s.reminder_interval_days)}"></label>
        <label>Maximum reminders per order (0 = off)<input name="max_reminders" type="number" min="0" value="${esc(s.max_reminders)}"></label>
        <label class="full">"Order ready" message<textarea name="template_ready">${esc(s.template_ready)}</textarea></label>
        <label class="full">Pickup reminder message<textarea name="template_reminder">${esc(s.template_reminder)}</textarea></label>
        <div class="full small muted">Placeholders: {name} {ticket} {business} {phone} {total} {balance} {ready_date}</div>
      </div>
      <div class="row" style="margin-top:12px"><span class="spacer"></span><button id="save" class="primary">Save settings</button></div>
    </div>`;
  $('#save').onclick = async () => {
    const body = {};
    $$('[name]', app).forEach((el) => (body[el.name] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value));
    const saved = await api('PUT', '/settings', body);
    $('#brand').textContent = saved.business_name;
    toast('Settings saved');
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

window.addEventListener('hashchange', route);
api('GET', '/settings').then((s) => { $('#brand').textContent = s.business_name; document.title = s.business_name + ' — CRM'; }).catch(() => {});
route();
