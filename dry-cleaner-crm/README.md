# Dry Cleaner CRM

A simple order-management and customer-reminder system for dry cleaners.
It runs on one computer at the counter, in a web browser, with **no
dependencies to install**: just Node.js.

## Features

- **Orders / tickets**: create a ticket with line items from your price list
  (or custom items), quantity, discount, deposit, due date, rack/bin location
  and notes (stains, damage). Ticket numbers are assigned automatically.
- **Order workflow**: Received → Cleaning → Ready → Picked up (or Cancelled),
  with timestamps for each step.
- **Automatic "ready" texts**: when an order is marked Ready, the customer gets
  a text message (can be turned off).
- **Pickup reminders**: orders left on the rack get reminders automatically.
  You choose how many days to wait before the first one, how often to repeat,
  and the maximum number of reminders.
- **Customers**: contact info, preferences (starch, hangers vs. boxed),
  notes, SMS opt-out, order history, lifetime value, and one-off messages.
- **Payments**: record payments or deposits and track unpaid balances.
- **Price list**: edit your services and prices. Services used on past
  orders are deactivated instead of deleted, so order history stays intact.
- **Dashboard**: orders in process, ready for pickup, due or overdue, today's
  sales and unpaid balances.
- **Printable tickets** sized for receipt printers (80mm).
- **Message log**: every text the system sends, with its delivery status.
- Editable message templates, sales tax, and turnaround time.
- Optional password protection.

## Running it

Requires **Node.js 22.13 or newer**.

```bash
cd dry-cleaner-crm
npm start
```

Then open http://localhost:3000. Data is stored in `data/crm.db` (SQLite).
Back up that file to back up the business.

## Sending real text messages

Out of the box, messages are **logged only**: they appear in the Messages page
but are not sent. To send real SMS through [Twilio](https://www.twilio.com),
set these environment variables before starting:

```bash
export TWILIO_ACCOUNT_SID=ACxxxxxxxx
export TWILIO_AUTH_TOKEN=xxxxxxxx
export TWILIO_FROM=+15551234567   # your Twilio number
npm start
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Web server port |
| `DB_PATH` | `data/crm.db` | SQLite database file |
| `APP_PASSWORD` | _(none)_ | If set, the browser asks for this password (any username) |
| `REMINDER_CHECK_MINUTES` | `15` | How often to check for pickup reminders that are due |
| `TWILIO_*` | _(none)_ | See above |

Business name, tax rate, reminder timing and message wording are set in the
**Settings** page.

## Development

```bash
npm test
```

Project layout:

```
server.js          HTTP server, static files, auth
src/db.js          SQLite schema, default settings and price list
src/orders.js      Order creation, totals, status changes, payments
src/reminders.js   Pickup reminder rules and background scheduler
src/notify.js      SMS sending (Twilio) and message templates
src/api.js         REST API routes
public/            Browser UI (plain HTML/CSS/JS)
test/              API and reminder tests (node:test)
```

## Ideas for next steps

- Email notifications and two-way SMS (customer replies)
- Card payments (Stripe/Square) and end-of-day cash reports
- Garment barcode/tag printing and scanning
- Pickup and delivery routes
- Loyalty points and coupons
- Multiple staff logins and multiple store locations
- Hosting in the cloud so several counters can share one database
