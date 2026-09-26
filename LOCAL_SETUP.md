# Running it on your own computer

A step-by-step guide to getting Adspark IT Inventory running locally, from a
fresh clone to signing in as an admin. Allow about 20 minutes the first time.

When you're done you will have:

- **The API server** on `http://127.0.0.1:3001` (Express, in `server/`)
- **The pages** on `http://localhost:5173` (Vite, in `client/`), which forward
  every `/api/...` request to the server
- **The database and sign-in** hosted on a free Supabase project

Only you, on this computer, can reach it. Nothing is exposed to your network.

---

## What you need

| | Check it with | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) **22.12 or newer** | `node --version` | The current LTS is fine. npm comes with it. |
| [Git](https://git-scm.com) | `git --version` | |
| A [Supabase](https://supabase.com) account | | The free plan is enough. |
| An internet connection | | `npm install` downloads SheetJS from `cdn.sheetjs.com`, and the database and sign-in are on Supabase. |

The commands below work in PowerShell, Command Prompt, macOS Terminal and
Linux shells. Where they differ, both versions are shown.

---

## Step 1: Get the code

```
git clone https://github.com/Pierceeee/inventory1.git
cd inventory1
```

Run every command in this guide from this folder, the one containing
`package.json`.

## Step 2: Install dependencies

```
npm install
```

One install at the top level covers both `client/` and `server/`, because
they are npm workspaces.

## Step 3: Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and choose
   **New project**.
2. Pick a region close to you.
3. Set a **database password** and write it down. **Use only letters and
   numbers.** Symbols like `@`, `#` or `/` break the connection string.
4. Wait for the project to finish setting up. This takes a minute or two.

## Step 4: Create your `.env` file

Copy the template:

```powershell
# PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux / Git Bash
cp .env.example .env
```

Open `.env` and fill in these values from your Supabase project:

| Setting | Where to find it |
|---|---|
| `DATABASE_URL` | **Connect** button at the top of the project → Method: **Session pooler** → copy the string, then put your database password in place of `[YOUR-PASSWORD]`. Its address ends in `pooler.supabase.com`. |
| `SUPABASE_URL` | Project Settings → **Data API** → Project URL. It must be exactly `https://<something>.supabase.co`, with nothing after it. |
| `SUPABASE_ANON_KEY` | Project Settings → **API Keys** → the *publishable* (or legacy *anon*) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → **API Keys** → the *secret* (or legacy *service_role*) key. **Optional.** Without it the app still runs, but the in-app **Register** page is switched off. |

Leave everything else as it is. For local use, `HOST`, `ALLOWED_IPS`,
`TRUST_PROXY` and `VITE_API_BASE_URL` should all stay **empty or unset**.
They are for running the app for the office.

A filled-in `.env` looks roughly like this:

```env
DATABASE_URL=postgresql://postgres.abcdefghijkl:MyPassw0rd123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://abcdefghijkl.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ADMIN_EMAILS=
ALLOWED_IPS=
TRUST_PROXY=
VITE_API_BASE_URL=
```

> `.env` holds your database password and the secret key. It is already
> git-ignored. Never commit it, paste it into chat, or rename the secret key
> with a `VITE_` prefix, because anything starting with `VITE_` is sent to
> the browser.

## Step 5: Create the database tables

```
npm run db:migrate
```

You should see:

```
Applied 4 migration(s):
  20260923000000_init
  20260924000100_roles_departments
  20260925000100_inventory_sessions
  20260926000100_scan_events
```

Running it again is safe. It prints `Database is already up to date.` and
never touches your data.

## Step 6: Lock down sign-in on Supabase

In Supabase, go to **Authentication → Sign In / Providers**:

1. Switch **off** *Allow new users to sign up*. Only accounts you create
   should exist.
2. Under **Email**, leave *Confirm email* **on**.

## Step 7: Create your account

In Supabase, go to **Authentication → Users → Add user → Create new user**.
Enter your email and a password, and tick **Auto Confirm User**.

## Step 8: Start the app

```
npm run dev
```

This starts the server (blue `[server]` lines) and the pages (magenta
`[client]` lines) together. Look for:

```
[server] API listening on http://127.0.0.1:3001 (office-network allowlist: OFF)
[client]   ➜  Local:   http://localhost:5173/
```

These warnings are **normal locally**, and you can ignore them:

- `[network] ALLOWED_IPS is empty - every request is currently accepted.`
  The server only listens on your own computer, so nothing else can reach it.
- `[client] No client/dist found - serving the API only.` In development the
  pages come from Vite on port 5173, not from the server.
- `[auth] SUPABASE_SERVICE_ROLE_KEY is not set` appears only if you skipped
  that optional key in step 4.

Open **http://localhost:5173** and sign in with the account from step 7.

You will see almost nothing yet. Every new account starts as a **Scanner with
no department**, which can sign in but see no data. The next step fixes that.

## Step 9: Make yourself an admin

Leave `npm run dev` running. Open a **second terminal** in the same folder and
run:

```
npm run user:role -- you@example.com admin
```

using the email from step 7. You should see:

```
Set you@example.com to admin (1 profile(s)).
```

**Refresh the browser.** You now have the full sidebar: Dashboard, Sessions,
Inventory, Devices, Employees, Users and the rest.

If it says `No profile for you@example.com yet`, you haven't signed in to the
app with that account. Do step 8 first, then run this again.

From now on, create other people's accounts inside the app under **Users →
Register**. This needs `SUPABASE_SERVICE_ROLE_KEY` from step 4.

> **Alternative:** put your email in `ADMIN_EMAILS=` in `.env` before step 8,
> and you become admin the first time you sign in. It only works while
> *Confirm email* is on (step 6). See README
> [Locked out / first admin](README.md#locked-out--first-admin).

## Step 10 (optional): Load example data

To explore the app before entering anything real:

```
npm run db:seed
```

This adds 40 devices, 30 employees, 37 handouts and 4 audit sessions, all
marked as examples. To take them out again:

```
npm run db:seed:remove
```

This removes only the example rows. Anything you added yourself is left alone.
Remove the examples before you start entering real data.

---

## Check that it works

- **Health check:** open http://localhost:5173/api/health. You should see
  `{"data":{"status":"ok"}}`, which means the server can reach the database.
- **Sign-in:** after step 9 you land on the Dashboard.
- **Scanning:** open a session and type an item code into the scan box. A
  USB handheld barcode scanner works the same way, because it types the code
  for you. The webcam scanner also works at `localhost`.

Phones can't use this local setup for camera scanning. Phone browsers only
allow the camera over HTTPS, and this setup is plain HTTP on your own machine.
To test on phones, use the Docker setup in README
[12. Running it with Docker](README.md#12-running-it-with-docker).

---

## Day-to-day

| To... | Run |
|---|---|
| Start the app | `npm run dev` |
| Stop it | `Ctrl+C` in the terminal running it |
| Update after `git pull` | `npm install`, then `npm run db:migrate` |
| Check code style | `npm run lint` |
| Try the production build | `npm run build`, then `npm start` and open http://localhost:3001 |

The automated tests are kept on the original developer's machine and aren't
in this repository, so `npm test` has nothing to run on a fresh clone.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| `node` is not recognized, or Node is older than 22.12 | Install Node.js 22.12+ from [nodejs.org](https://nodejs.org), then open a **new** terminal. |
| `npm install` fails on `cdn.sheetjs.com` | It needs internet access to that site. Check your connection, VPN or proxy. |
| `Missing environment variable(s): ...` | `.env` is missing, in the wrong folder, or incomplete. It must be named exactly `.env` and sit next to `package.json`. On Windows, make sure it isn't really `.env.txt`: turn on **View → File name extensions** in File Explorer to check. |
| `getaddrinfo ENOTFOUND db.<something>.supabase.co` | You copied the *Direct connection* string. Use the **Session pooler** string (step 4). |
| `password authentication failed` | Wrong password in `DATABASE_URL`. Reset it under Project Settings → Database, using only letters and numbers. |
| `The tables do not exist yet` | Run `npm run db:migrate` (step 5). |
| `The database is out of date` | Run `npm run db:migrate`. This usually happens after a `git pull`. |
| Sign-in says *That email and password do not match* | Check that `SUPABASE_URL` is exactly `https://<ref>.supabase.co`, with nothing after it. Then check the user exists and is confirmed under Supabase → Authentication → Users. |
| Sign-in says *Could not reach the sign-in service* | No internet, or a typo in `SUPABASE_URL`. |
| Signed in but the app is empty | Your account is still a Scanner with no department. Do step 9. |
| `... but ALLOWED_IPS is empty. AKM refuses to start exposed ...` | `HOST` or `TRUST_PROXY` is set in `.env`. Remove both for local use. |
| `EADDRINUSE` on port 3001 | Something else is using that port. Add `PORT=3002` to `.env`. The pages follow it automatically. |
| The pages open on 5174 instead of 5173 | Port 5173 was busy, so Vite picked the next one. Use the address it prints. |
| Register says *Could not create the account right now. Check the server configuration.* | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` and restart `npm run dev`. |

More fixes are in README [7. Troubleshooting](README.md#7-troubleshooting).
