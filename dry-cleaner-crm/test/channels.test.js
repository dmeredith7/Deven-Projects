'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, transportsFromEnv } = require('../src/channels');

// Replace global fetch to capture the outgoing provider request.
function captureFetch(t, response = { status: 200, body: '{}', headers: {} }) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
  t.after(() => (global.fetch = original));
  return calls;
}

const msg = {
  to: 'jane@example.com', fromName: 'Sparkle "Cleaners"', replyTo: 'front@sparkle.example',
  subject: 'Ready', text: 'Hello', html: '<p>Hello</p>', headers: { 'List-Unsubscribe': '<https://x/u>' },
};

test('normalizePhone', () => {
  assert.equal(normalizePhone('(555) 123-4567'), '+15551234567');
  assert.equal(normalizePhone('1-555-123-4567'), '+15551234567');
  assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('abc'), null);
});

test('no env vars means no transports', () => {
  assert.deepEqual(transportsFromEnv({}), { sms: null, email: null });
  assert.throws(() => transportsFromEnv({ EMAIL_PROVIDER: 'pigeon', EMAIL_API_KEY: 'k', EMAIL_FROM: 'a@b.co' }), /Unknown EMAIL_PROVIDER/);
});

test('Twilio request', async (t) => {
  const calls = captureFetch(t, { status: 201, body: '{"sid":"SM123"}' });
  const { sms } = transportsFromEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+15550000000' });
  assert.deepEqual(await sms({ to: '+15551234567', body: 'Hi' }), { id: 'SM123' });
  assert.equal(calls[0].url, 'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
  assert.equal(calls[0].init.headers.Authorization, 'Basic ' + Buffer.from('AC1:tok').toString('base64'));
  assert.deepEqual(Object.fromEntries(calls[0].init.body), { To: '+15551234567', From: '+15550000000', Body: 'Hi' });
});

test('Twilio error surfaces the response', async (t) => {
  captureFetch(t, { status: 400, body: '{"message":"The To number is not a valid phone number."}' });
  const { sms } = transportsFromEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_MESSAGING_SERVICE_SID: 'MG1' });
  await assert.rejects(sms({ to: '+1', body: 'x' }), /Twilio 400: .*not a valid phone/);
});

test('Resend request', async (t) => {
  const calls = captureFetch(t, { status: 200, body: '{"id":"re_1"}' });
  const { email } = transportsFromEnv({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'rk', EMAIL_FROM: 'notify@crm.example' });
  assert.deepEqual(await email(msg), { id: 're_1' });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer rk');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.from, '"Sparkle Cleaners" <notify@crm.example>');
  assert.deepEqual(body.to, ['jane@example.com']);
  assert.equal(body.reply_to, 'front@sparkle.example');
  assert.equal(body.headers['List-Unsubscribe'], '<https://x/u>');
});

test('SendGrid request', async (t) => {
  const calls = captureFetch(t, { status: 202, body: '', headers: { 'x-message-id': 'sg1' } });
  const { email } = transportsFromEnv({ EMAIL_PROVIDER: 'sendgrid', EMAIL_API_KEY: 'sk', EMAIL_FROM: 'notify@crm.example' });
  assert.deepEqual(await email(msg), { id: 'sg1' });
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.personalizations, [{ to: [{ email: 'jane@example.com' }] }]);
  assert.deepEqual(body.from, { email: 'notify@crm.example', name: 'Sparkle "Cleaners"' });
  assert.equal(body.content[1].type, 'text/html');
});

test('Postmark request', async (t) => {
  const calls = captureFetch(t, { status: 200, body: '{"MessageID":"pm1"}' });
  const { email } = transportsFromEnv({ EMAIL_PROVIDER: 'postmark', EMAIL_API_KEY: 'pk', EMAIL_FROM: 'notify@crm.example' });
  assert.deepEqual(await email(msg), { id: 'pm1' });
  assert.equal(calls[0].init.headers['X-Postmark-Server-Token'], 'pk');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.To, 'jane@example.com');
  assert.deepEqual(body.Headers, [{ Name: 'List-Unsubscribe', Value: '<https://x/u>' }]);
});
