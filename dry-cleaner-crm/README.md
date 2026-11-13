# Dry Cleaner CRM

Order management with text and email reminders for dry cleaners. One
installation serves many shops: each dry cleaner signs up for its own
account and only ever sees its own customers, orders and messages.

It needs **no dependencies**: just Node.js.

## Features

**Accounts**
- Sign up (creates a shop and its owner login), log in, log out
- Forgot-password emails with single-use, 1-hour reset links
- Team: owners add staff logins. Staff handle orders and customers; only
  owners change settings, prices and the team.
- Passwords hashed with scrypt, HttpOnly session cookies, login rate
  limiting, cross-site request protection

**Text and email notifications**
- "Your order is ready" notice, sent automatically when an order is marked Ready
- Automatic pickup reminders: first after N days, repeating every N days, up to a maximum
- One-off messages to a customer by text, email or both
- Each shop edits its own wording for texts and emails, using placeholders
  like `{name}`, `{ticket}` and `{balance}`
- Emails are branded with the shop's name, and replies go to the shop's own email address
- Opt-outs:
  - Each customer has separate text and email opt-ins.
  - Replying **STOP** to a text opts the customer out, and **START** opts them back in.
  - Every email has an unsubscribe link (including one-click unsubscribe in Gmail and Apple Mail).
- Customer text replies show up in the shop's Messages page
- The message log shows every text and email with its result: sent, failed (with the reason), skipped or logged
- "Send a test" buttons in Settings to confirm texts and emails really arrive

**Languages**
- English and Korean. A switch in the sidebar (top bar on phones, and on the
  login page) changes every page at once; the choice is remembered in that
  browser. Translations live in `public/i18n.js`, and a test fails if any
  interface text is missing its Korean.

**Shop operations**
- Works with the shop's own pre-numbered paper tickets: staff type the
  ticket number when writing up an order (chosen at sign-up, changeable in
  Settings → Business). Numbers only need to be unique among unfinished
  orders, since ticket books repeat. Or let the app number orders automatically.
- Search or type a ticket number on the dashboard to jump straight to the order
- Tickets with line items from an editable price list, discounts, sales tax,
  deposits/payments, due dates, rack location and printable receipts
- Order workflow: Received → Cleaning → Ready → Picked up / Cancelled
- Customer profiles with preferences, notes, order history and lifetime value
- Dashboard: in process, ready for pickup, due/overdue, sales today, unpaid balances

## Running it

Requires **Node.js 22.13 or newer**.

```bash
cd dry-cleaner-crm
npm start
```

Open http://localhost:3000 and click **Create an account**.

To try it with sample data instead, run `npm run demo` and log in with:

| Login | Email | Password |
|---|---|---|
| Owner | `demo@example.com` | `demo1234` |
| Staff | `staff@example.com` | `demo1234` |

Remove the demo shop before going live. Anyone who knows these logins can use it. Data is stored in
`data/crm.db` (SQLite).

Without a texting or email service connected, messages are **logged only**:
they appear on the Messages page marked "logged" but aren't sent. That's
handy for trying things out.

## Connecting texts (Twilio)

1. Create a [Twilio](https://www.twilio.com) account and buy a phone number.
   For US numbers, complete A2P 10DLC registration in the Twilio console.
   US carriers block unregistered business texting.
2. Set:
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_FROM=+15551234567          # or TWILIO_MESSAGING_SERVICE_SID=MGxxxx
   ```
3. To receive STOP/START and customer replies, set the Twilio number's
   "A message comes in" webhook to `https://YOUR-DOMAIN/webhooks/twilio/sms`
   (HTTP POST) and set `PUBLIC_URL=https://YOUR-DOMAIN`. Requests are verified
   with Twilio's signature.

## Connecting email

Pick one provider, verify your sending domain with them, and set:

```bash
EMAIL_PROVIDER=resend                 # resend | sendgrid | postmark
EMAIL_API_KEY=xxxxxxxx
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME="Dry Cleaner CRM"     # sender name for password-reset emails
PUBLIC_URL=https://yourdomain.com     # needed for unsubscribe & reset links
```

Customer emails are sent from `EMAIL_FROM` with the shop's name as the sender
name, and replies go to the shop's business email (set in Settings).

## All configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Web server port |
| `DB_PATH` | `data/crm.db` | SQLite database file |
| `PUBLIC_URL` | _(none)_ | Public address, e.g. `https://crm.example.com`. Used in email links and Twilio verification. Starting with `https://` also makes cookies secure. |
| `ALLOW_SIGNUP` | `1` | Set `0` to stop new shops signing up |
| `TRUST_PROXY` | `0` | Set `1` behind a reverse proxy so rate limiting sees real client IPs |
| `COOKIE_SECURE` | `0` | Force secure cookies if `PUBLIC_URL` isn't https |
| `REMINDER_CHECK_MINUTES` | `15` | How often to look for reminders that are due |
| `DEFAULT_COUNTRY_CODE` | `1` | Country code added to phone numbers typed without one |
| `SECRET_KEY` | _(generated)_ | Signs unsubscribe links. Generated and stored on first run if unset. |
| `TWILIO_*`, `EMAIL_*` | _(none)_ | See above |

## Development

```bash
npm test
```

```
server.js          HTTP server: sessions, CSRF check, webhooks, unsubscribe page, static files
src/db.js          SQLite schema, new-shop defaults (settings, price list)
src/auth.js        Sign up, log in, sessions, password reset, team
src/api.js         REST API routes with per-route access (public / user / owner)
src/orders.js      Orders, totals, status changes, payments
src/notify.js      Text and email composition, opt-outs, message log
src/channels.js    Twilio, Resend, SendGrid, Postmark; phone formatting
src/reminders.js   Pickup reminder rules and background scheduler
public/            Browser UI (login page and app; plain HTML/CSS/JS)
test/              API, isolation, notification and provider tests
```

The database from the earlier single-shop version isn't compatible. If
you have one, move `data/crm.db` aside before starting.

## Ideas for next steps

- Hosting (e.g. Fly.io or Render with a persistent disk) and a custom domain
- Subscription billing per shop (Stripe)
- Delivery-status updates from Twilio and email providers (delivered, bounced)
- Two-way texting inbox with replies from the app
- Card payments and end-of-day reports
- Marketing messages (promotions to opted-in customers)
