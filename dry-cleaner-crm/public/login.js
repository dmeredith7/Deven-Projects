'use strict';

const views = [...document.querySelectorAll('[data-view]')];
let resetToken = null;

function show() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('reset=')) {
    resetToken = hash.slice(6);
    history.replaceState(null, '', '#reset');
  }
  const id = hash.startsWith('reset') ? (resetToken ? 'reset' : 'forgot') : ['signup', 'forgot'].includes(hash) ? hash : 'login';
  views.forEach((v) => (v.hidden = v.id !== id));
  const first = document.querySelector(`#${id} input`);
  if (first) first.focus();
}

async function post(path, body) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
  return data;
}

const handlers = {
  login: (d) => post('/auth/login', d).then(() => location.replace('/')),
  signup: (d) => post('/auth/signup', d).then(() => location.replace('/#/settings')),
  forgot: (d, form) => post('/auth/forgot', d).then(() => (form.querySelector('.notice').hidden = false)),
  reset: (d) => post('/auth/reset', { ...d, token: resetToken }).then(() => location.replace('/')),
};

for (const form of views) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.error');
    const btn = form.querySelector('button[type=submit]');
    err.textContent = '';
    btn.disabled = true;
    try {
      await handlers[form.id](Object.fromEntries(new FormData(form)), form);
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });
}

window.addEventListener('hashchange', show);
// Already logged in? Go straight to the app.
fetch('/api/me').then((r) => r.ok && !location.hash.startsWith('#reset') && location.replace('/'));
show();
