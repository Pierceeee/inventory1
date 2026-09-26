# Device Handout Tracker + AKM

**Device custody and periodic inventory audits in one app.**

This is the **Device Handout Tracker** (Adspark-branded in the UI). It combines two complementary modules:

1. **Custody Module** (device handout tracking) — *Who has which company device, and since when?*
   - Records each device handout and return, building permanent history
   - Tracks custody through employee resignations, swaps, repairs
   - At Adspark, every employee is issued a laptop (MacBook or Windows) and mobile phone and keeps them until they leave

2. **AKM Module** (scan audits) — *Is every item on this spreadsheet physically here?*
   - Periodic audits: upload an inventory list as Excel, scan QR codes to account for items, mark complete
   - Sessions are created per department each quarter; items can have free-form columns
   - Read-only archive after 7 days; history preserved when items are cleared and re-scanned

The two modules share sign-in (Supabase email/password), roles (Admin / Head / Scanner), and department access control. They can be used independently or together.

> A device's custody **asset tag** (`ASP-0042`) is the same code as an AKM session **item code**, so you can cross-reference "currently held by" data later if needed.

---

## Contents

1. [Core concepts](#1-core-concepts)
2. [Using the app](#2-using-the-app)
3. [Everyday tasks](#3-everyday-tasks)
4. [What the app will refuse, and why](#4-what-the-app-will-refuse-and-why)
5. [Setting it up (first time)](#5-setting-it-up-first-time)
6. [Commands](#6-commands)
7. [Troubleshooting](#7-troubleshooting)
8. [For developers](#8-for-developers)
9. [Current limits](#9-current-limits)
10. [Upgrading an existing install](#10-upgrading-an-existing-install)
11. [Running it for the office](#11-running-it-for-the-office)
12. [Running it with Docker](#12-running-it-with-docker)
13. [Deploying to AWS from GitLab](#13-deploying-to-aws-from-gitlab)

---

## 1. Core concepts

**Custody Module** (device handout tracking):

| Term | Meaning |
|---|---|
| **Device** | A laptop or mobile phone, identified by its **asset tag** (e.g. `ASP-0042`). Catalogued once, kept forever. |
| **Employee** | A member of staff who can be given devices. *Active* or *Resigned*. |
| **Handout** | One record of a device going to an employee: when, condition, accessories (charger, case...), and - once back - when, why, condition, and what returned. |
| **IT staff** | The people who sign in and record handouts. Every handout remembers who recorded it. |

**AKM Module** (scan audits):

| Term | Meaning |
|---|---|
| **Session** | A named audit exercise — e.g., "Laptop Inventory Q3 2026". Belongs to one department. Items uploaded, scanned, then archived 7 days after completion. |
| **Item** | One line from an uploaded inventory spreadsheet. Identified by **item code** (e.g., `IT-LAP-001`). Item codes are unique within a session but repeat across sessions each quarter. Any columns from the spreadsheet are stored as data fields. |
| **Scan event** | A record of someone scanning an item code (success, already scanned, or not found). The audit log is permanent and survives item clearing. |

**Shared across both modules:**

| Term | Meaning |
|---|---|
| **Role** | Permission level: **Admin** (full access), **Head** (own department only), **Scanner** (scan-only in own department). |
| **Department** | A team or division — IT, Creative, Finance, etc. Users and sessions are scoped by department. |

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

Sign in with the email and password your admin created for you. The sidebar shows different pages depending on your role.

### Dashboard (Admin and Head only)

Shows the **Audit Progress** for the current inventory:
- Total number of departments
- Number of active sessions
- Total items and how many are scanned
- Overall progress bar
- Per-department breakdown with progress and item counts

Below the audit section are **Custody widgets** (device management):
- Device counts: Issued, Available, In Repair, Retired
- Handout alerts: resigned employees still holding devices, devices in repair
- "Who has what" — all devices currently out and their holders

### Sessions (all roles)

Browse sessions by status (Active, Completed, Archived) and filter by department. Each session shows:
- Name and status badge
- Scanned/total items progress
- Upload, Export, and other action buttons

Scanners see the Sessions page on login. Admins and heads can also upload Excel files and manage sessions.

**Uploading a spreadsheet:** you view it, then approve it. The dialog shows the file's rows and what the import will do (N added, rows skipped and why), and **Import N items** saves them. You never match columns. The scan-code column is chosen automatically:
1. A column named *Item Code* (or `itemCode`, `item-code`, etc.).
2. Otherwise, a filled-in, unique label-like column, such as `NEW ASSET TAG` (preferred over `OLD ASSET TAG`), `Barcode` or `Serial Number`.
3. Otherwise, the first filled-in, unique column.

The dialog says which column it chose. Every other column is kept as data.

### Inventory (Admin and Head only)

Master view of all items across all sessions in one searchable, filterable table. Filter by:
- Session (All sessions or one named session)
- Scan status (Total / Scanned / Pending)
- Item code search

Each item row shows the item code, all imported columns, scan status, scan timestamp, and who scanned it. Click the pencil icon to edit, or the trash icon to delete (admin only).

### Devices, Employees, Handouts, Import

Custody management (device handout tracking). Available to admins and heads only:
- **Devices** - the full register of laptops and mobiles
- **Employees** - all staff with device counts
- **Handouts** - every issue and return log
- **Import** - load existing spreadsheets (CSV format)

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

You view the spreadsheet, then approve it. There are no columns to match and
nothing to rename. On the **Import** page:

1. Choose **Devices** or **Employees**.
2. Choose the file (`.xlsx`, `.xls` or `.csv`; first sheet only).
3. Check what the page shows straight away. Nothing is saved yet. You'll see:
   - which column fills each field, for example *Asset tag from NEW ASSET TAG*;
   - the rows exactly as they will be saved;
   - how many will be added;
   - every problem row, by its **spreadsheet line number**.
4. Click **Import** (e.g. *Import 38 devices*) to save. Rows whose asset tag,
   serial number or email already exists are skipped and listed, never
   overwritten.

How the columns are read:

- **Devices.**
  - *Asset tag*: the column that identifies each device. That's an asset-tag-like column that is filled in and unique; *NEW ASSET TAG* wins over *OLD ASSET TAG*. In a phone sheet, it's the *Mobile Number* or *IMEI*.
  - *Model*: a Model, Handset Model or Description column.
  - *Serial number* and *Operating system*: columns with those names. OS values like "Windows 11" are saved as `windows`, and the original text also goes into Notes.
  - *Type*: a Type column if the sheet has one. Otherwise it's worked out per row: `laptop` for laptop lines (MacBook, ThinkPad, Latitude...), `mobile` when the OS or model says phone or tablet (iPhone, Samsung A13, OPPO...). Any other row gets the sheet's default: `mobile` in a phone sheet (one with Handset, IMEI or SIM columns, or keyed by Mobile Number), else `laptop`.
  - *Brand*: a Brand or Make column. Otherwise it's read from the model when the maker is clear, e.g. "Dell Latitude", "MacBook", "MSI Modern", "OPPO A94".
  - *Notes*: the sheet's Notes column, then **every other column** as a "column: value" line (location, supplier, invoice, assignee, plan...). Nothing in the file is lost.
  - **N/A, TBD, none and "-" count as empty.** So two phones with "N/A" as their serial number aren't treated as the same serial.
  - A row whose asset tag or serial number is repeated **within the file** is listed as *appears earlier in this file*, so you know to fix the sheet. One that's already saved is listed as *already exists*.
- **Employees.** A Name or Full Name column (or First Name + Last Name), plus Email and Department (or Dept / Business Unit). Columns an employee has no field for are listed as *not saved*.

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
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → **API Keys** → the *secret* / *service_role* key. **Optional** — without it the server still runs, but the **Register** page answers 503 REGISTRATION_UNAVAILABLE |

   **Optional environment variables** (add to `.env` only if needed):

   | Setting | Purpose |
   |---|---|
   | `PORT` | Server port (default `3001`) |
   | `HOST` | Server address (default `127.0.0.1`; see "Running it for the office") |
   | `OFFICE_TIME_ZONE` | Time zone for session export timestamps (default `Asia/Manila`; must be a valid IANA zone like `US/Eastern`) |
   | `DATABASE_SSL` | Use SSL for the database connection (default `true` for Supabase; set to `false` for a local unencrypted Postgres) |
   | `DATABASE_SSL_CA` | Path to CA certificate for database TLS verification (Supabase: download from Project → Database → SSL) |
   | `VITE_API_BASE_URL` | API base URL for the client (leave empty in development; Vite forwards `/api` to the server) |
   | `ADMIN_EMAILS` | Comma-separated emails that are always admins (for recovery; see "Locked out / first admin") |
   | `ALLOWED_IPS` | Comma-separated IPs/CIDR ranges (office network allowlist; see "Running it for the office") |
   | `TRUST_PROXY` | Reverse proxy configuration (see "Running it for the office") |

   `.env` holds your database password. Never share it or commit it to git.

4. **Create the tables**

   ```
   npm run db:migrate
   ```

   You should see `Applied N migration(s)`, naming each one. The database starts completely empty.

5. **Turn off public sign-ups.** Supabase → Authentication → Sign In / Providers
   → switch off **Allow new users to sign up**. Accounts created outside this app
   default to **Scanner with no department** (they can sign in but see no data
   until an admin assigns them). Only accounts you create should exist.

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
| `npm run db:migrate` | Creates or updates the database tables. Safe to run again — it only applies what's new and never touches your data |
| `npm run db:seed` | Loads example data (40 devices, 30 employees, 37 handouts, 4 audit sessions with ~31 items and 18 scanned) to try the app with |
| `npm run db:seed:remove` | Removes the example data; real data is left alone |
| `npm run user:role -- <email> <admin\|head\|scanner>` | Sets an existing account's role directly in the database — for bootstrapping the first admin, or fixing one by hand |
| `npm test` / `npm run test:e2e` | Run the automated tests. The tests are kept on the developer's machine and aren't part of this repository - see [Testing](#testing) |
| `npm run lint` | Checks the client and server code with ESLint (unused code, React hook rules, `===`). Rules are in `eslint.config.js` |
| `npm run build` | Builds the pages for production into `client/dist/` |
| `npm start` | Starts the server only. Serves `client/dist/` if it exists (run `npm run build` first). See [10. Running it for the office](#10-running-it-for-the-office) |

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `getaddrinfo ENOTFOUND db.<something>.supabase.co` | `DATABASE_URL` is using the *Direct connection*, which needs IPv6. Use the **Session pooler** string instead — its address ends in `pooler.supabase.com` and its username is `postgres.<project-ref>`. |
| `password authentication failed` | Wrong database password in `DATABASE_URL`. Reset it under Project Settings → Database and use letters and numbers only — symbols like `@` break the connection string. |
| `The tables do not exist yet` | Run `npm run db:migrate`. |
| `The database is out of date` | Run `npm run db:migrate`. The server also logs which migrations are missing at startup. |
| Sign-in says *That email and password do not match*, even with the right password | First check `SUPABASE_URL` is exactly `https://<ref>.supabase.co` — anything after it, such as `/rest/v1/`, sends sign-in to the wrong place. Then check the user exists under Supabase → Authentication → Users and is confirmed. Reset the password there if needed. |
| Sign-in says *Could not reach the sign-in service* | No internet connection, Supabase is down, or the address in `SUPABASE_URL` has a typo. |
| Sign-in shows *Account disabled* | Your user account has been deactivated by an admin. Contact them to reactivate you. |
| Sent back to the sign-in page unexpectedly | Your session expired or was revoked. Sign in again. |
| Everything shows as "available" after importing devices | Import doesn't record who holds what — issue each held device with its real handout date. See [Importing spreadsheets](#importing-spreadsheets). |
| Startup warning: `SUPABASE_SERVICE_ROLE_KEY is not set` | The **Register** page will answer 503 REGISTRATION_UNAVAILABLE. Add it to `.env` (from Supabase → Project Settings → API Keys → service_role) and restart if you need to create accounts from the app. Without it, create accounts in Supabase and assign roles/departments on the Users page. |
| `ALLOWED_IPS is empty. AKM refuses to start exposed...` | You're trying to start the app with a non-loopback `HOST` or `TRUST_PROXY` set, but no `ALLOWED_IPS`. Set `ALLOWED_IPS` in `.env` before exposing the app, or run locally with `HOST=127.0.0.1` (the default). |
| Network access blocked; browser shows "Access Restricted" | Your IP is not in `ALLOWED_IPS`. This is intentional — only office IPs are allowed. If you're in the office, ask your admin to check the allowlist. See [Running it for the office](#10-running-it-for-the-office). |
| `Missing environment variables` | `.env` is missing or incomplete — see step 3 of setup. |
| Nobody can sign in as an admin | See [Locked out / first admin](#locked-out--first-admin) below. |
| Session deletion fails with "Too many attempts" | You've entered the wrong password 5 times in 15 minutes. Wait 15 minutes and try again. |
| Session export is very slow for large sessions | Exporting 10,000+ items takes a few seconds (CPU-bound xlsx generation). This is normal. Rate limit: 10 exports per 60 seconds per user. |

### Locked out / first admin

**When does this happen?** Re-creating a user in Supabase (Authentication → Users → delete, then add back) gives it a **new** id. The app signs that id in as a department-less scanner — it has no way to know this is "the same person" as before. Their old profile (still admin) is orphaned, belonging to an id nobody can sign in as any more. If that was the only admin, nobody can reach the Users page to fix it.

**Two ways out:**

#### 1. `ADMIN_EMAILS` (recommended, fastest)

Add the locked-out address to `ADMIN_EMAILS` in `.env` (comma-separated for multiple):
```env
ADMIN_EMAILS=you@adspark.ph, backup@adspark.ph
```
Restart the server. That email is promoted to admin automatically the next time it signs in — no database access needed.

**Security check:** This only works while Supabase has email confirmation enabled (it usually does by default). The server checks this at startup and logs what it found:
- **"Confirm email" must be ON** in Supabase → Authentication → Providers → Email
- If it's off, the server refuses to honour `ADMIN_EMAILS` at all and logs a warning
- **Public sign-ups should be OFF** (though not strictly required if email confirmation is on)

The server makes one Supabase API call at startup to verify email confirmation is enabled, not a database read. A misconfigured project will be visible in the startup log immediately, not a silent security hole.

#### 2. `npm run user:role` (if no database access via ADMIN_EMAILS)

1. Have the locked-out user sign in at least once (so their profile row exists in the database)
2. Run from the project root:
   ```
   npm run user:role -- you@adspark.ph admin
   ```
3. Restart the app or sign in again — the user is now admin

**After either method:**

The user is now admin and can use the Users page to fix things:
- **Deactivate the orphaned old profile** (it belongs to an id that can't sign in, so it's dead weight, not a security risk)
- If you were trying out the app, run `npm run db:seed:remove` to remove example staff
- Once you're back in and the orphaned profile is dealt with, you can remove `ADMIN_EMAILS` from `.env` if you want (the admin role is saved in the database, not something `ADMIN_EMAILS` keeps granting)

---

## 8. For developers

```
client/                React 19 + Vite + TanStack Query + Tailwind - the pages
server/                Express 5 + Zod - the API and every business rule
  src/services/        the rules, testable without HTTP
  src/routes/          thin HTTP layer
  src/db/              connection, migration runner, example data
  src/lib/             access control, errors, rate limits, IP allowlist, utilities
  src/middleware/      auth, role loading, network restriction, error handler
supabase/migrations/   the database schema (SQL). Four applied migrations:
                       20260923000000 (custody), 20260924000100 (roles/depts),
                       20260925000100 (sessions/items), 20260926000100 (scans)
```

### Architecture

Two modules share login, roles, and departments:

1. **Custody Module** (Device Handout Tracker): Devices, Employees, Handouts, Import
   - Tracks who holds which device and since when
   - Existing module; Admin + Head roles

2. **Audit Module** (AKM): Sessions, Items, Scans, Inventory, Archive, Export
   - Periodic scan audits — is every item on this spreadsheet physically here?
   - Eight phases, all implemented: sessions → Excel import → scanning → archive

Both modules:
- Use the same `profiles` table for roles (Admin, Head, Scanner)
- Use `departments` to scope access
- Share the same login, session handling, and API error envelope

### Key Patterns

- The browser only ever talks to the Express API (`/api/...`); it never touches
  the database directly and holds no credentials.
- Business rules enforced on the SERVER and in database constraints. Hiding a
  button is not enough.
- Concurrency invariants: unique indexes and atomic conditional UPDATEs (e.g. a
  device can never be with two people at once, a scan can only claim pending
  items).
- Every JSON response is `{ "data": ... }` or `{ "error": { "code", "message", "details" } }`,
  except two file downloads: `/api/export/assignments` (CSV) and
  `/api/sessions/:id/export` (`.xlsx`).
- Role and department are read from `profiles` table on **every request** (never
  from token `user_metadata`), via `loadProfile` middleware.
- Session writeability: every write to a session or its items goes through
  `assertSessionWritable()` — requires active status and department access.

### Testing

The automated tests, their fixtures and configs are kept locally and are
git-ignored, so they aren't in this repository. On a machine that has them:

- **Server tests**: `npm test --workspace server` (vitest + in-process PGlite + fake auth)
- **Client tests**: `npm test --workspace client` (vitest + jsdom + real API from startTestServer)
- **E2E tests**: `npm run test:e2e` (Playwright, Chromium, isolated PGlite + fake auth)
- **What tests can't prove**: PGlite serialises all calls onto one connection, so
  `Promise.all` concurrency tests ("two scans of the same code at once") run
  sequentially. They prove logic is idempotent, not that it survives real row-lock
  contention. That guarantee rests on Postgres READ COMMITTED semantics in
  production (e.g., `FOR UPDATE` locks, `ADMIN_EMAILS` atomic check-and-set).

---

## 9. Current limits

Things this version deliberately doesn't do:

- **No password reset screen.** Admins reset passwords in Supabase → Authentication → Users → reset password
- **Laptops and mobiles only** (custody module) — no specs, warranty, purchase cost (AKM session items are flexible)
- **Cannot reopen a completed session** — create a new session if needed
- **Revoking Supabase sessions after destructive operations** — user's token stays valid after session delete (consider server-side revocation if needed)

For running it beyond your own machine (office-network restriction, HTTPS,
`npm run build`), see [11. Running it for the office](#11-running-it-for-the-office).

---

## 10. Upgrading an existing install

If you already have the app running with real data:

1. **Back up your database** — save a copy from Supabase (Project → Backups)
2. **Pull the latest code** and install
   ```
   git pull origin main
   npm install
   ```
3. **Run migrations** (safe to run again — applies only new migrations)
   ```
   npm run db:migrate
   ```
4. **Set `ADMIN_EMAILS` if needed** to recover if admins are locked out (requires server restart)
   ```
   # In .env:
   ADMIN_EMAILS=admin@adspark.ph
   ```
5. **Rebuild and restart**
   ```
   npm run build
   npm start
   ```
   Open **http://127.0.0.1:3001** (or your reverse proxy's hostname)

6. **After recovery, clean up**
   - Run `npm run db:seed:remove` to remove example devices, employees, and profiles
   - Deactivate the orphaned old admin profile on the **Users** page if you recovered with `ADMIN_EMAILS`
   - Create departments BEFORE creating AKM sessions (the New Session dialog requires at least one)
   - Optionally set `SUPABASE_SERVICE_ROLE_KEY` for the Register page; otherwise create accounts in Supabase and assign roles/departments on the **Users** page
   - Once stable, remove `ADMIN_EMAILS` from `.env` if you added it (the role is saved in the database now)
   - If you set `ADMIN_EMAILS` while already signed in, sign out and back in (the role is cached for ~60 seconds)
   - Scanners and phones on the office network can't reach a loopback-only server (`HOST=127.0.0.1`); see [11. Running it for the office](#11-running-it-for-the-office)

---

## 11. Running it for the office

By default (`npm run dev`, or `npm start` with no extra settings) this app only
answers on `127.0.0.1` - the machine it runs on. Making it reachable by the
rest of the office (or the internet) needs two more things: an **office-network
allowlist** (so only office connections get in) and **HTTPS** (the phone
camera scanner refuses to work over plain HTTP).

### The office-network allowlist (`ALLOWED_IPS`)

Every request - including sign-in - goes through one middleware that checks
the caller's address against `ALLOWED_IPS` in `.env`: a comma-separated list
of single IPs and/or CIDR ranges (IPv4 and IPv6). Anyone outside it gets a
plain **Access Restricted** page (no login form, no app bundle) on every page,
and a JSON 403 on every `/api/*` call. `GET /api/health` is the one exception,
so an uptime check or load balancer can always confirm the server is up.

**AKM refuses to start** with `ALLOWED_IPS` empty whenever EITHER of these is
true, rather than silently listening with no restriction at all:
- `HOST` is set to anything other than a loopback address (`127.0.0.1`, `::1`,
  `localhost` - the default), or
- `TRUST_PROXY` is set at all (a reverse proxy in front is exactly what makes
  a loopback `HOST` reachable from outside this machine in the first place -
  see "Cloud hosting" below).

Which addresses to list depends on where this runs (decide this first):

- **Cloud hosting** (a VPS/cloud VM, reached over the internet): list the
  office's **public** IP(s) - both the primary and backup ISP if there are
  two, so a failover doesn't lock everyone out.
  ```
  ALLOWED_IPS=203.0.113.10, 198.51.100.20
  ```
  Most office internet connections have a **dynamic** IPv4 address that can
  change (a router reboot, the ISP reassigning leases) - when it does, nobody
  can reach the app until someone updates `ALLOWED_IPS` and restarts the
  server. Ask the ISP for a **static IP** if this needs to stay up
  unattended. If the office instead has a stable IPv6 prefix, listing that
  CIDR is one more option.
- **Office server** (a machine on the office LAN, reached only from inside
  it): list the LAN subnet instead.
  ```
  ALLOWED_IPS=192.168.1.0/24
  ```

### `TRUST_PROXY` (only if there is a reverse proxy in front)

If Caddy/nginx/a load balancer sits in front of this app, set `TRUST_PROXY` so
`ALLOWED_IPS` checks the real visitor, not the proxy. **Prefer `loopback` or
the proxy's exact IP/CIDR over a bare hop count** - they only trust
`X-Forwarded-For` from that specific address, whereas a hop count trusts it
from whoever connects directly, with no check on who that is:

```
TRUST_PROXY=loopback           # preferred: the proxy runs on the SAME machine (127.0.0.1)
TRUST_PROXY=10.0.0.5           # preferred: the proxy's exact IP (a separate load balancer)
TRUST_PROXY=1                  # a bare hop count - only as safe as whatever can connect directly
```

A bare hop count (`TRUST_PROXY=1`, `2`, ...) is fine when `HOST` is loopback
(only a same-machine process can connect directly at all), but on a
non-loopback `HOST` it lets anyone on the network claim any address via
`X-Forwarded-For` and walk straight past `ALLOWED_IPS` - the server logs a
warning at startup if it sees that combination.

**Never set `TRUST_PROXY=true`** - the server refuses to start with that
value. `true` trusts the `X-Forwarded-For` header from anyone, which means
anyone could type in a fake office IP and walk straight past `ALLOWED_IPS`.
Leave `TRUST_PROXY` unset entirely when there is no reverse proxy - every
request then uses its real TCP connection address, and any `X-Forwarded-For`
header a caller sends is ignored. Setting `TRUST_PROXY` at all requires
`ALLOWED_IPS` too (see above) - a proxy in front is one more way this app
becomes reachable from outside this machine.

### HTTPS

The phone camera (QR scanning, Phase 4) only works over HTTPS - browsers
refuse camera access on a plain `http://` origin except on `localhost`. Put a
reverse proxy in front that terminates TLS:

- **Cloud hosting:** Caddy or nginx with a normal certificate (e.g. Let's
  Encrypt's HTTP-01), reverse-proxying to this app on `127.0.0.1:3001`. Use
  `TRUST_PROXY=loopback` (Caddy/nginx run on the same machine) or
  `TRUST_PROXY=1` (a separate load balancer).
- **Office server (LAN):** a public CA can't issue a certificate for a bare
  LAN IP, so give the machine a real hostname (e.g. `akm.adspark.internal`)
  and use a proxy that can get a certificate for it without exposing the
  server to the internet - Caddy with DNS-01 validation is the simplest way
  (it proves ownership of the domain via a DNS record, not an inbound HTTP
  request). `TRUST_PROXY=loopback` again, since Caddy runs on the same box.

### Single process requirement

**Run exactly ONE server process.** The rate limiters (scans, export guard, delete password attempts) and the export guard are in-memory,
so don't use cluster mode or multiple instances — they wouldn't share state and would allow budget overruns.

Keep the server running with a supervisor:
- **Linux:** `systemd` service or `pm2 start --no-autorestart --attach`
- **Windows:** `NSSM` (Non-Sucking Service Manager) in fork mode
- **Any system:** `pm2 in fork mode, not cluster mode

On a crash or restart, the supervisor restarts the process. In-memory state (rate limit buckets, export single-flight guard) resets, which is fine: previous limits are forgiven once the server comes back.

### Supabase authentication rate limits

Every sign-in, refresh, and delete-session password check goes through the server's one IP (the Supabase `signIn()` API call).
Supabase enforces a rate limit per IP. If the office hits 429s at login, raise the limit in Supabase → Authentication → Rate Limits.

### npm install needs internet (SheetJS)

`npm install` downloads SheetJS from `cdn.sheetjs.com`. Ensure your build environment can reach it; it's not mirrored on npm.

### Publishing the address

Publish only what people need to type: an **A record** (`akm.adspark.ph` →
the office's public IP) for cloud hosting, or the internal hostname for an
office server. Don't publish more than that - the allowlist is the actual
protection, not secrecy of the address.

### Putting it together

```
npm run db:migrate       # ALWAYS run this BEFORE starting the new code -
                          # migrations are additive and safe to run ahead of
                          # a deploy, but the new code may expect columns an
                          # old database doesn't have yet.
npm run build             # builds client/dist
npm start                 # NODE serves both the API and client/dist together
```

Open **http://127.0.0.1:3001** (or your reverse proxy's hostname if using Caddy/nginx).

`npm start` (`server/src/index.js`) serves the built client itself once
`client/dist` exists (`npm run build` first) - one process, one middleware
order protects both the pages and the API. If `client/dist` is missing, it
logs a reminder and keeps serving the API only, exactly like `npm run dev`
today.

Example `.env` additions for each scenario:

```
# Cloud hosting, behind Caddy/nginx on the same machine, primary + backup ISP
HOST=127.0.0.1
ALLOWED_IPS=203.0.113.10, 198.51.100.20
TRUST_PROXY=loopback

# Office server: Caddy on the same machine is the ONLY thing the LAN can reach
# (it listens on 443 with the DNS-01 certificate and forwards to
# 127.0.0.1:3001). Node itself stays on loopback, exactly like the cloud recipe.
HOST=127.0.0.1
ALLOWED_IPS=192.168.1.0/24
TRUST_PROXY=loopback
```

Don't set `HOST=0.0.0.0` on an office server that has Caddy in front: it opens
Node's own plain-HTTP port to every device on the LAN alongside Caddy, so
sign-ins and data would cross the network unencrypted, and phone cameras
refuse to work over plain `http://`.

---

## 12. Running it with Docker

For a **Linux server on the office LAN**. The repo includes a `Dockerfile`, `docker-compose.yml` and `Caddyfile` that run two containers:

- **`app`**: the Node server. It serves the API and the built pages as one process. Its port is **never published** to the host; only Caddy can reach it, over a private Docker network.
- **`caddy`**: HTTPS on ports 80 and 443, forwarding to `app`. This is the only thing the LAN sees.

The database stays on Supabase, so no database runs in Docker.

Inside the container, `HOST=0.0.0.0` is safe. It's the setting section 11 warns against on a bare server, but here the app port isn't published. The same safety rules still apply: `ALLOWED_IPS` is required, and `TRUST_PROXY` trusts only the Caddy container (`172.30.0.2`), so the allowlist checks each visitor's real address.

**You need:**
- Docker Engine with the Compose plugin, on Linux.
- Internet access while building, because `npm` downloads SheetJS from `cdn.sheetjs.com`.

Docker Desktop on Windows or Mac is not supported for this setup: there, every visitor appears to come from Docker's gateway, so `ALLOWED_IPS` can't tell office devices apart.

**1. Set up `.env`** (copy `.env.example`). Alongside the usual Supabase settings:

```
ALLOWED_IPS=192.168.1.0/24        # the office LAN subnet
AKM_HOSTNAME=akm.adspark.lan      # the name people open, or the server's LAN IP
```

Point `akm.adspark.lan` at the server's LAN IP in the office router's DNS, or use the IP itself. `docker-compose.yml` sets `HOST`, `PORT` and `TRUST_PROXY` for the containers and overrides any values in `.env`.

**2. Build, migrate, start:**

```
docker compose build
docker compose run --rm app node server/scripts/migrate.js
docker compose up -d
```

**3. Trust Caddy's certificate on each computer and phone, once.** A public certificate authority can't vouch for a LAN-only name, so Caddy runs its own. Copy its root certificate out:

```
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./akm-root.crt
```

Install `akm-root.crt` as a trusted root:
- **Windows:** double-click it and put it in *Trusted Root Certification Authorities*.
- **macOS:** add it in Keychain Access and set it to *Always Trust*.
- **iPhone:** install the profile, then turn it on under *Settings › General › About › Certificate Trust Settings*.
- **Android:** *Settings › Security › Encryption & credentials › Install a certificate › CA certificate*.

Until a device trusts it, the browser shows a warning and the phone camera scanner won't start. The root certificate lives in the `caddy_data` volume. Keep that volume, or every device has to trust a new one.

**Updating:**

```
git pull
docker compose build
docker compose run --rm app node server/scripts/migrate.js   # before starting the new code
docker compose up -d
```

**Everyday commands:**
- `docker compose logs -f app` shows the server's log.
- `docker compose ps` shows health (the `app` container checks `/api/health`).
- `docker compose run --rm app node server/scripts/userRole.js <email> admin` sets a role (see "Locked out / first admin").

**Keep it to one `app` container.** Don't scale it: rate limits and the export guard are in memory (section 11, "Single process requirement").

If people reach the server over **IPv6**, Docker may show the gateway instead of the visitor. Open it by its IPv4 address or name, or enable IPv6 in Docker, so `ALLOWED_IPS` sees real addresses.

---

## 13. Deploying to AWS from GitLab

`.gitlab-ci.yml` builds the Docker image and deploys it to one **EC2 server** running the Docker setup from section 12. People reach it by a **public name**, such as `akm.adspark.ph`, that only the office's public IPs can open.

```
every branch / merge request   lint · build · npm audit
main                           + build the image, push it to Amazon ECR
                               + deploy (click Run on the deploy job)
```

**How it stays safe:**
- **No AWS keys in GitLab.** Jobs sign in with a short-lived GitLab OIDC token, which only this project's `main` branch can exchange for the deploy role.
- **App secrets never touch GitLab.** They live in AWS Parameter Store, and the server writes its own `.env` from them at deploy time.
- **No SSH.** The deploy goes through AWS Systems Manager, so port 22 stays closed.

The automated tests aren't in this repository (they're kept locally), so the pipeline checks lint, build and dependencies. Run `npm test` and `npm run test:e2e` locally before merging to `main`.

### One-time AWS setup

The example region is `ap-southeast-1` (Singapore). The files mentioned are in `deploy/aws/`; replace `ACCOUNT_ID`, `REGION`, `GITLAB_GROUP` and `GITLAB_PROJECT` in them.

1. **ECR repository:** create `adspark-it-inventory`. Turn on *Scan on push*, and add a lifecycle rule that keeps the last 20 images.
2. **Settings in Parameter Store**, one parameter per setting under `/akm/prod/`:

   | Parameter | Type | Value |
   |---|---|---|
   | `/akm/prod/DATABASE_URL` | SecureString | the Supabase *Session pooler* string |
   | `/akm/prod/SUPABASE_URL` | String | `https://<project-ref>.supabase.co` |
   | `/akm/prod/SUPABASE_ANON_KEY` | SecureString | the anon / publishable key |
   | `/akm/prod/SUPABASE_SERVICE_ROLE_KEY` | SecureString | the service-role key (for Register) |
   | `/akm/prod/ALLOWED_IPS` | String | the office's **public** IP(s), e.g. `203.0.113.10, 198.51.100.20` |
   | `/akm/prod/AKM_HOSTNAME` | String | `akm.adspark.ph` |
   | `/akm/prod/AKM_TLS` | String | an email for Let's Encrypt notices, e.g. `it@adspark.ph` |
   | `/akm/prod/ADMIN_EMAILS` | String | optional, see "Locked out / first admin" |

   Use the default `aws/ssm` key. If you use your own KMS key, also give the server role `kms:Decrypt` on it.
3. **Server role:** create an EC2 role with the AWS-managed policy `AmazonSSMManagedInstanceCore`, plus `iam/ec2-instance-permissions.json` (pull the image, read `/akm/prod`).
4. **Security group:**
   - Allow **443 only from the office's public IP(s)**.
   - Allow **80 from anywhere**. Let's Encrypt must reach it to issue and renew the certificate, and Caddy only redirects port 80 to HTTPS, so no app page is served there.
   - Open **no port 22**.
5. **EC2 instance:**
   - Amazon Linux 2023, `t3.small`, 20 GB disk.
   - The role and security group from steps 3–4.
   - Tag `app=adspark-it-inventory`; the deploy role may only run commands on instances with that tag.
   - `deploy/aws/ec2-user-data.sh` as its *User data*. It installs Docker and Compose; the SSM agent comes with Amazon Linux.
   - An **Elastic IP**, with the DNS `A` record `akm.adspark.ph` pointing at it.
6. **GitLab sign-in to AWS:**
   - In IAM, add an *Identity provider*: OpenID Connect, URL `https://gitlab.com`, audience `https://gitlab.com`.
   - Create the role `gitlab-akm-deploy`, with `iam/gitlab-deploy-trust-policy.json` as its trust policy and `iam/gitlab-deploy-permissions.json` as its permissions.

### GitLab setup

1. **Push the repository** to a new GitLab project; GitHub can stay as a second remote:
   ```
   git remote add gitlab git@gitlab.com:GITLAB_GROUP/GITLAB_PROJECT.git
   git push gitlab main testing
   ```
2. **CI/CD variables** (*Settings › CI/CD › Variables*; none of them are secrets):
   - `AWS_ACCOUNT_ID`
   - `AWS_ROLE_ARN`, e.g. `arn:aws:iam::123456789012:role/gitlab-akm-deploy`
   - `EC2_INSTANCE_ID`

   `AWS_REGION` defaults to `ap-southeast-1` in `.gitlab-ci.yml`.
3. **Protect `main`** (*Settings › Repository › Protected branches*), so only maintainers can push to the branch that can deploy.

### Deploying, updating and rolling back

- **Deploy:** merge to `main`. After *push-image* finishes, click **Run** on the `deploy` job. It pulls the image, runs the database migrations **before** starting the new version, starts it, and waits until `/api/health` reports healthy. If the app doesn't come up, the job fails and prints the last log lines.
- **Roll back:** open an earlier pipeline and re-run its `deploy` job; each pipeline deploys its own image. Migrations only ever add to the database, so older code still runs against it.
- **Logs:** use *Systems Manager › Session Manager* to open a shell on the server, then run `cd /opt/adspark-it-inventory && docker compose logs -f app`.
- **One server, one app container.** The in-memory rate limits need a single process (section 11). `resource_group: production` also stops two deploys running at once.
