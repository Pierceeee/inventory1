# Device Handout Tracker

**Who has which company device, and since when.**

At Adspark, every employee is issued a laptop (MacBook or Windows) and a mobile
phone, and keeps them until they leave. This app is where the IT team records
each of those handouts - the moment a device goes to someone, and the moment it
comes back - so two questions always take a couple of clicks:

- *Who has laptop `ASP-0042`, and since when?*
- *What devices does Maria Santos currently hold?*

It also keeps a permanent history of every device, and makes sure nothing is
forgotten when someone resigns.

> **How is this different from AKM?** AKM does periodic *scan audits* - walking
> the floor to confirm 200 items exist. This app does *custody tracking* - this
> laptop went to this person on this date. Different jobs. A device's asset tag
> here is the same code as its AKM `itemCode`.

---

## Contents

1. [The ideas behind it](#1-the-ideas-behind-it)
2. [Using the app](#2-using-the-app)
3. [Everyday tasks](#3-everyday-tasks)
4. [What the app will refuse, and why](#4-what-the-app-will-refuse-and-why)
5. [Setting it up (first time)](#5-setting-it-up-first-time)
6. [Commands](#6-commands)
7. [Troubleshooting](#7-troubleshooting)
8. [For developers](#8-for-developers)
9. [Current limits](#9-current-limits)

---

## 1. The ideas behind it

| Term | Meaning |
|---|---|
| **Device** | A laptop or mobile phone, identified by its **asset tag** (e.g. `ASP-0042`). |
| **Employee** | A member of staff who can be given devices. *Active* or *Resigned*. |
| **Handout** | One record of a device going to an employee: when it went out, what condition it was in, what came with it (charger, case...), and - once it comes back - when, why, and in what condition. |
| **IT staff** | The people who sign in and record handouts. Every handout remembers who recorded it. |

A few rules shape everything else:

- **A device is "Issued" only because someone holds it.** You never set a device
  to *Issued* yourself. It becomes issued when you record a handout and available
  again when you record its return. A device's own status only describes its
  lifecycle: *Available*, *In repair*, or *Retired*.
- **A device can never be with two people at once.** The database itself refuses
  it, even if two people click *Issue* at the same moment.
- **History is permanent.** Devices are *retired* and employees *marked
  resigned* - never deleted. A laptop's full history survives everyone who has
  ever held it.
- **Condition is recorded both ways.** Each handout stores the condition it went
  out in *and* the condition it came back in, plus which accessories left and
  which returned. That pair is what settles "was it already scratched?" at
  offboarding.

---

## 2. Using the app

Sign in with the email and password your admin created for you. The sidebar has
five pages.

### Dashboard

"Where every device is right now."

- **Counts** - total devices, how many are issued, available, in repair, and
  retired, split by laptops and mobiles.
- **Needs attention** - things someone should act on:
  - resigned employees who **still hold devices**, with each asset tag
  - devices **in repair** (they can't be issued until they're back)
- **Who has what** - every device currently out, and who has it.

### Devices

The full register. Search by asset tag, serial number, model or brand - search
ignores capitals and extra spaces, so `asp-42` finds `ASP-0042`. Filter with
the chips: **All / Laptops / Mobiles** and **Available / Issued / Repair /
Retired**. The *Held by* column shows the current holder.

Open a device to see its **current holder**, its complete **handout history**
(newest first, with conditions and who recorded each one), and the buttons to
**Issue device**, **Return device**, **Edit**, or **Retire**.

### Employees

Everyone on staff, with how many devices each person holds. Search by name,
email or department; filter **Active / Resigned**.

Open a person to see the devices they **currently hold** (with the date each was
handed over) and their full history. This is also where you **Mark resigned**.

### Handouts

Every issue and return, newest first - the "when did I give this out?" view.
Filter by **Still out / Returned** and by date range. **Export CSV** downloads
exactly what is on screen, ready for Excel.

### Import

Loads your existing spreadsheets so you don't have to type everything in. See
[Importing spreadsheets](#importing-spreadsheets) below.

---

## 3. Everyday tasks

### Hand a device to someone

1. Open the device (or the employee) and click **Issue device**.
2. Choose who it's going to (or which device).
3. **Handed out on** defaults to now. Change it if you're recording a handout
   that happened earlier.
4. Confirm the **condition** going out and tick the **accessories** handed over.
5. Click **Issue device**.

If the person already holds a device of the same type - say, a second laptop
during a swap - the app asks you to tick **Issue it anyway**. It's a check, not
a block: overlaps during a handover are normal.

### Take a device back

1. Open the device and click **Return device**.
2. Choose a **reason**: resignation, swap, repair, lost, or other.
3. Choose the **condition** it came back in - this is required. The dialog shows
   the condition it went out in, and warns you if it came back worse.
4. Untick any accessory that **didn't** come back. The dialog names what's missing.
5. Click **Return device**.

Coming back damaged or without its charger is allowed and recorded - that's
exactly what these fields are for.

### Offboard someone who is leaving

1. Open the employee and click **Mark resigned**. The dialog lists every device
   they still hold.
2. Marking them resigned does **not** return those devices automatically - that
   would quietly erase what actually happened. Return each one explicitly,
   recording its real condition.
3. Until every device is back, the person appears under **Needs attention** on
   the dashboard.

### Add a new device or employee

**Devices → Add device** or **Employees → Add employee**. Asset tags, serial
numbers and emails must be unique; the form tells you if one is already taken.

### Send a device for repair, or retire it

Return it first if someone has it, then **Edit** it and set its status to
**In repair**. When it's fixed, set it back to **Available**. For a device
that's leaving service for good, use **Retire** - its history stays.

### Importing spreadsheets

Save your spreadsheet from Excel as **CSV** (File → Save As → CSV), then on the
**Import** page:

1. Choose **Devices** or **Employees**.
2. Choose the file.
3. Match your columns to the app's fields. Required: *Asset tag* and *Type*
   (`laptop` or `mobile`) for devices; *Full name* for employees.
4. Click **Preview import**. Nothing is saved yet - you'll see how many rows
   will be added and every problem row by its **spreadsheet line number**.
5. Click **Import** (e.g. *Import 38 devices*) to save. Rows whose asset tag or
   email already exists are skipped and listed, never overwritten.

> **Import doesn't know who holds what.** After importing devices and employees,
> record each current holder with **Issue device**, setting **Handed out on** to
> the real date they received it. Until you do, every device shows as available.

---

## 4. What the app will refuse, and why

| You try to... | Result |
|---|---|
| Issue a device someone already has | Refused - and it tells you who has it |
| Issue a retired device | Refused |
| Issue a device that's in repair | Refused - set it back to Available first |
| Issue to a resigned employee | Refused |
| Date a handout or return in the future | Refused |
| Date a return before its handout | Refused |
| Return something already returned | Refused |
| Return without a condition | Refused - the condition is the evidence |
| Retire, or send to repair, a device someone holds | Refused - return it first |
| Issue a second laptop (or phone) to the same person | **Allowed**, after you tick *Issue it anyway* |

---

## 5. Setting it up (first time)

You need:

- [Node.js](https://nodejs.org) **22.12** or newer (the current LTS is fine)
- A free [Supabase](https://supabase.com) account (it hosts the database and the sign-in)

### Step by step

1. **Get the code and install**

   ```
   npm install
   ```

2. **Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard).
   Write down the database password you choose - use only letters and numbers.

3. **Create your `.env` file.** Copy `.env.example` to `.env` in the project
   folder and fill in three values:

   | Setting | Where to find it in Supabase |
   |---|---|
   | `DATABASE_URL` | **Connect** button (top of project) → Method: **Session pooler** → copy, and put your password in place of `[YOUR-PASSWORD]` |
   | `SUPABASE_URL` | Project Settings → **Data API** → Project URL. Just `https://<something>.supabase.co` - nothing after it |
   | `SUPABASE_ANON_KEY` | Project Settings → **API Keys** → the *publishable* (or legacy *anon*) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → **API Keys** → the *secret* / *service_role* key. Optional - without it the server still runs, but the **Register** page can't create accounts until it's set |

   `.env` holds your database password. Never share it or commit it to git.

4. **Create the tables**

   ```
   npm run db:migrate
   ```

   You should see `Applied 2 migration(s)`. The database starts completely empty.

5. **Turn off public sign-ups.** Supabase → Authentication → Sign In / Providers
   → switch off **Allow new users to sign up**. Anyone with an account can see
   and change everything, so only accounts you create should exist.

6. **Create the first admin account.** Supabase → Authentication → Users →
   **Add user** → *Create new user*, tick **Auto Confirm User**. Then sign in to
   the app once with that account (so its profile row exists) and run:

   ```
   npm run user:role -- you@adspark.ph admin
   ```

   From then on, create everyone else from inside the app: **Users → Register**
   (needs `SUPABASE_SERVICE_ROLE_KEY`, step 3). Only admins can register new
   accounts, and roles/departments live in the app, not in Supabase.

   To show a person's name in the app instead of their email, run this in
   Supabase's **SQL Editor**:

   ```sql
   update auth.users
      set raw_user_meta_data = raw_user_meta_data || '{"full_name": "Rina Delgado"}'
    where email = 'rina@adspark.ph';
   ```

7. **Start it**

   ```
   npm run dev
   ```

   Open **http://localhost:5173** and sign in.

### Want to try it before entering real data?

```
npm run db:seed          # adds 40 example devices, 30 employees, 37 handouts
npm run db:seed:remove   # takes them all out again
```

The example rows are marked, so removing them never touches anything you added
yourself. Remove them before you start entering real data.

---

## 6. Commands

Run these from the project's main folder (the one containing this file).

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app: the server on port 3001 and the pages on http://localhost:5173 |
| `npm run db:migrate` | Creates or updates the database tables. Safe to run again - it only applies what's new and never touches your data |
| `npm run db:seed` | Loads example data to try the app with |
| `npm run db:seed:remove` | Removes the example data; real data is left alone |
| `npm run user:role -- <email> <admin\|head\|scanner>` | Sets an existing account's role directly in the database - for bootstrapping the first admin, or fixing one by hand |
| `npm test` | Runs all the automated tests (no database or internet needed) |
| `npm run build` | Builds the pages for production into `client/dist/` |

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `getaddrinfo ENOTFOUND db.<something>.supabase.co` | `DATABASE_URL` is using the *Direct connection*, which needs IPv6. Use the **Session pooler** string instead - its address ends in `pooler.supabase.com` and its username is `postgres.<project-ref>`. |
| `password authentication failed` | Wrong database password in `DATABASE_URL`. Reset it under Project Settings → Database and use letters and numbers only - symbols like `@` break the connection string. |
| `The tables do not exist yet` | Run `npm run db:migrate`. |
| Sign-in says *That email and password do not match*, even with the right password | First check `SUPABASE_URL` is exactly `https://<ref>.supabase.co` - anything after it, such as `/rest/v1/`, sends sign-in to the wrong place. Then check the user exists under Supabase → Authentication → Users and is confirmed. Reset the password there if needed - the app has no "forgot password" screen. |
| Sign-in says *Could not reach the sign-in service* | No internet connection, Supabase is down, or the address in `SUPABASE_URL` has a typo. |
| Sent back to the sign-in page unexpectedly | Your session expired or was revoked. Sign in again. |
| Everything shows as "available" after importing | Import doesn't record who holds what - issue each held device with its real handout date. See [Importing spreadsheets](#importing-spreadsheets). |
| `Missing environment variables` | `.env` is missing or incomplete - see step 3 of setup. |

---

## 8. For developers

```
client/                React 19 + Vite + TanStack Query + Tailwind - the pages
server/                Express 5 + Zod - the API and every business rule
  src/services/        the rules, testable without HTTP
  src/routes/          thin HTTP layer
  src/db/              connection, migration runner, example data
  test/                API and database tests
supabase/migrations/   the database schema (SQL)
docs/superpowers/      design spec and plans
```

- The browser only ever talks to the Express API (`/api/...`); it never touches
  the database directly and holds no database credentials.
- The one guarantee that must hold under concurrency - a device has at most one
  open handout - is a unique index in the database, not application code.
- Every JSON response is `{ "data": ... }` or
  `{ "error": { "code", "message", "details" } }` (the CSV export is the one
  non-JSON endpoint).
- **Tests need no database or Supabase account.** Each test file starts its own
  in-memory Postgres ([PGlite](https://pglite.dev)) with the real migrations
  applied. The client's screen tests run against the real API, not a mock.

The full design, data model and API contract are in
[docs/superpowers/specs/2026-09-23-device-handout-tracker-design.md](docs/superpowers/specs/2026-09-23-device-handout-tracker-design.md).

---

## 9. Current limits

Things this version deliberately doesn't do yet:

- **It runs on one computer.** `npm run dev` serves the app on that machine only.
  Making it reachable by the rest of the office - or online - needs a production
  setup that hasn't been built yet.
- **No office-network restriction.** Unlike AKM, access isn't limited to the
  office network; sign-in is the only protection. Worth adding before putting
  it online.
- **No password reset screen.** Admins reset passwords in Supabase.
- **Laptops and mobiles only**, with core details - no specs, warranty, purchase
  cost, or QR codes (AKM already handles QR scanning).
