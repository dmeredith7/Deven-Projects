'use strict';

// Every piece of interface text must have a Korean translation, so switching
// language never leaves a page half in English.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { KO, ERROR_PATTERNS } = require('../public/i18n');

const pub = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function uiKeys() {
  const keys = new Set();
  const js = pub('app.js') + pub('login.js');
  const str = String.raw`'((?:[^'\\]|\\.)*)'`;
  for (const m of js.matchAll(new RegExp(String.raw`\b(?:t|N_|I18N\.t)\(\s*` + str, 'g'))) keys.add(m[1]);
  for (const m of js.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*` + str + String.raw`,\s*` + str, 'g'))) {
    keys.add(m[1]);
    keys.add(m[2]);
  }
  for (const f of ['index.html', 'login.html']) {
    for (const m of pub(f).matchAll(/data-i18n(?:-placeholder|-title|-aria)?="([^"]*)"/g)) keys.add(m[1]);
  }
  return [...keys];
}

test('every interface string has a Korean translation with the same placeholders', () => {
  const keys = uiKeys();
  assert.ok(keys.length > 300, `found only ${keys.length} strings; extraction is broken`);
  const missing = keys.filter((k) => KO[k] == null);
  assert.deepEqual(missing, [], 'missing Korean for these strings');
  for (const k of keys) assert.deepEqual(placeholders(KO[k]), placeholders(k), `placeholders differ for "${k}"`);
});

test('every message the server can send has a Korean translation', () => {
  const src = path.join(__dirname, '..', 'src');
  const messages = new Set();
  for (const f of fs.readdirSync(src)) {
    const code = fs.readFileSync(path.join(src, f), 'utf8');
    for (const m of code.matchAll(/HttpError\(\d+,\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)) messages.add(m[2]);
    // Reasons a message was skipped, shown in the message log.
    for (const m of code.matchAll(/error: '([^']+)'/g)) messages.add(m[1]);
  }
  const translated = (msg) => {
    // Template literals: try with sample values filled in.
    const sample = msg.replace(/\$\{label\}/, 'Order').replace(/\$\{ticket\}/, '1042').replace(/\$\{clash\.name\}/, 'Maria').replace(/\$\{[^}]+\}/g, 'x');
    return KO[sample] != null || ERROR_PATTERNS.some(([re]) => re.test(sample));
  };
  const missing = [...messages].filter((m) => !translated(m));
  assert.ok(messages.size > 30, `found only ${messages.size} server messages; extraction is broken`);
  assert.deepEqual(missing, [], 'server messages without Korean');
});

test('the language switch appears on every page', () => {
  assert.match(pub('index.html'), /data-lang-toggle="dark"/); // sidebar (desktop)
  assert.match(pub('index.html'), /data-lang-toggle="compact"/); // top bar (phones)
  assert.match(pub('login.html'), /data-lang-toggle/); // login, sign-up, password reset
  for (const f of ['index.html', 'login.html']) assert.match(pub(f), /<script src="\/i18n\.js"><\/script>/);
});
