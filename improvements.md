# Improvements — AKM Gap Analysis & Implementation Plan

This file checks every feature in [AKM_User_Documentation.md](AKM_User_Documentation.md)
against what this codebase actually implements (as of 2026-09-23), then lays out
phases to build what's missing.

---

## Summary

| Status | Count |
|---|---|
| ✅ Implemented | 5 |
| ⚠️ Partial (something similar exists, needs rework) | 6 |
| ❌ Missing | 45 |
| **Total features checked** | **56** |

**The short version:** this repo is the **Device Handout Tracker**, a *custody*
tool (who holds which laptop, since when). AKM is a *scan-audit* tool (is every
item on this spreadsheet physically here?). The design spec kept the two apart
on purpose ([design spec §1–2](docs/superpowers/specs/2026-09-23-device-handout-tracker-design.md)).
So AKM's whole core loop is missing: **sessions → Excel upload → QR scanning → archive**.

Several things carry over and should be reused:

- Email/password sign-in through the API (Supabase Auth)
- The dry-run import pipeline: preview first, duplicates skipped and never overwritten, errors reported by spreadsheet line number ([imports.js](server/src/services/imports.js))
- The safe CSV export pattern, including formula neutralising ([exports.js](server/src/services/exports.js))
- The rule that "the database enforces the invariant", e.g. `one_open_assignment_per_device`
- UI building blocks: `DataTable` (sortable), `FilterChips`, `SearchInput`, `Modal`, `StatCard`

**Legend:** ✅ implemented · ⚠️ partial · ❌ missing · **P*n*** = the phase that closes it

---

## 1. Feature checklist

### §2 Network access

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| A1 | Access only from the Adspark office network (IP allowlist) | ❌ | No IP check at all. The server binds to `127.0.0.1` ([config.js](server/src/config.js)), so today it is only reachable from the machine it runs on | P8 |
| A2 | Blocked visitors see an **Access Restricted** screen and no login prompt | ❌ | — | P8 |
| A3 | Allowlist covers primary and backup ISP IPs and IT can edit it | ❌ | The AKM doc points to `middleware.ts`, which doesn't exist in this Express app | P8 |

### §3 User roles

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| R1 | Three roles: Admin, Head, Scanner | ❌ | One role. Every signed-in account can do everything (README §9) | P1 |
| R2 | Head and Scanner limited to their own department | ❌ | There are no departments to scope by | P1 |
| R3 | Scanners land on **Sessions** after login; Admin/Head land on **Dashboard** | ❌ | Everyone lands on the Dashboard | P1 |
| R4 | Admin-only actions are enforced by the server | ❌ | The server checks who you are ([auth.js](server/src/middleware/auth.js)) but never what you're allowed to do | P1 |

### §4 Sign-in & dashboard

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| S1 | Sign in with email + password | ✅ | [LoginPage.jsx](client/src/pages/LoginPage.jsx) → `POST /api/auth/login` | — |
| S2 | Dashboard for Admin and Head | ⚠️ | The Dashboard exists but shows device custody (issued / available / in repair), not audit progress | P7 |
| S3 | Dashboard: total number of departments | ❌ | — | P7 |
| S4 | Dashboard: number of active sessions | ❌ | — | P7 |
| S5 | Dashboard: total items, number scanned, overall progress bar | ❌ | Has "issued of total" bars per device type, which is a different metric | P7 |
| S6 | Dashboard: per-department breakdown with progress bars | ❌ | — | P7 |

### §5 Sessions

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| SE1 | A session is a named bucket of items that belongs to one department | ❌ | No such entity. "Session" in the client code today means the *login* session ([useSession.jsx](client/src/hooks/useSession.jsx)) | P2 |
| SE2 | Sessions page with **New Session** (admin picks the department; heads get their own) | ❌ | — | P2 |
| SE3 | Statuses: Active / Completed / Archived | ❌ | — | P2 |
| SE4 | **Mark Complete** (admin) blocks further scanning and uploads | ❌ | — | P2 |

### §6 Importing from Excel

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| I1 | Upload `.xlsx` / `.xls` | ⚠️ | [ImportPage.jsx](client/src/pages/ImportPage.jsx) accepts CSV only, so users have to "Save As CSV" | P3 |
| I2 | `itemCode` column required, matched ignoring case, spaces and dashes | ⚠️ | `guessMapping()` already matches headers loosely, but the key column is `asset_tag` and mapping is manual | P3 |
| I3 | Every other column is imported as a data field (no fixed schema) | ❌ | Fixed fields only. The spec chose this on purpose ("core identity fields were chosen deliberately") | P3 |
| I4 | Rows without an item code are skipped and reported | ✅ | Rows missing an asset tag are reported by line number and not imported | — |
| I5 | Duplicate codes are rejected with a warning and the existing item is unchanged | ✅ | Duplicates are skipped and listed, never overwritten | — |
| I6 | Item codes are unique **within a session** but can repeat across sessions | ❌ | `asset_tag` is unique across the whole database (`devices_asset_tag_key`) | P3 |
| I7 | Drag-and-drop file picker | ❌ | Plain file input | P3 |
| I8 | Choose which columns the session's item table shows | ❌ | — | P3 |
| I9 | Result shows how many items were added and which rows were skipped | ✅ | Dry-run preview plus a final result with line numbers, which goes beyond the AKM spec | — |
| I10 | Uploading again adds new items and never overwrites | ✅ | Same behaviour | — |
| I11 | Upload goes into a chosen **Active** session | ❌ | Imports go into one global register | P3 |
| I12 | **Clear Items** (eraser icon, type `CLEAR`), which keeps the session and its scan history | ❌ | — | P3 |

### §7 Scanning

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| Q1 | Collapsible **QR Scanner** panel on an Active session | ❌ | No scanning anywhere. The spec deferred it because "AKM already does this" | P4 |
| Q2 | Camera mode detects QR codes automatically, with no button press | ❌ | — | P4 |
| Q3 | Manual mode: type, paste or use a handheld barcode scanner, then Enter | ❌ | — | P4 |
| Q4 | Colour-coded result: green success / yellow already scanned / red not found | ❌ | — | P4 |
| Q5 | The 10 most recent scans are listed under the scanner | ❌ | — | P4 |
| Q6 | Records who scanned each item and when | ❌ | Handouts already record `issued_by`. Reuse the same pattern | P4 |
| Q7 | **Undo scan** (admin only) resets the item to Pending | ❌ | — | P4 |
| Q8 | Print QR codes (admin) | ❌ | — | P4 |

### §8 Inventory page

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| V1 | Inventory page listing all items from all sessions in one table | ❌ | The Devices page lists the fixed-field device register, not session items | P5 |
| V2 | One column per imported field, all-empty columns hidden, horizontal scroll | ❌ | — | P5 |
| V3 | Session filter (All / one session). The Session column hides when a session is selected | ❌ | — | P5 |
| V4 | Heads see only their own department's items | ❌ | — | P5 |
| V5 | Clickable **Total / Scanned / Pending** stat cards filter the table | ❌ | The Devices page has similar status chips to reuse | P5 |
| V6 | Search by item code | ⚠️ | Devices can be searched by asset tag, serial or model | P5 |
| V7 | Edit an item in a slide-in panel (code plus any imported field) without changing scan status | ⚠️ | Device editing is a full page with fixed fields | P5 |
| V8 | Delete an item (admin, with confirmation) | ❌ | Devices can only be *retired*, never deleted (on purpose) | P5 |

### §9 Departments · §10 Users

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| D1 | Departments page with **Add Department** (admin) | ❌ | `department` is a free-text column on `employees` | P1 |
| U1 | Users page listing accounts, roles and departments (admin) | ❌ | Accounts are managed in the Supabase dashboard | P1 |
| U2 | **Register** page where an admin creates a user with email, password, role and department | ❌ | Users are created by hand in Supabase (README §5 step 6) | P1 |

### §11 Archive · §12 Export · §13 Deleting a session

| ID | Feature | Status | What exists today | Phase |
|---|---|---|---|---|
| AR1 | Sessions are archived automatically 7 days after completion | ❌ | — | P6 |
| AR2 | Archive page (admin). Archived sessions are fully read-only | ❌ | — | P6 |
| AR3 | Export from the Archive page | ❌ | — | P6 |
| E1 | Export a session to **Excel** from the session page | ⚠️ | The only export is a CSV of the handout log, on the Handouts page | P6 |
| E2 | Export includes item codes, all imported columns, scan status, scan date/time and who scanned | ❌ | — | P6 |
| X1 | Admin-only delete of a session and all its items | ❌ | Nothing in the app can be deleted | P6 |
| X2 | Step 1 of deleting: **Download Excel Backup** (button turns green, file can be re-imported) | ❌ | — | P6 |
| X3 | Step 2 of deleting: re-enter the admin password (with a show/hide eye). A wrong password shows an inline error and nothing is deleted | ❌ | The auth layer already has `signIn(email, password)` to reuse | P6 |

---

## 2. Decisions to make before Phase 1

These are either gaps in the AKM doc or conflicts with how this codebase was
designed. Each has a recommended answer. Confirm or change them before coding
starts.

| # | Question | Recommendation |
|---|---|---|
| D1 | Do AKM session items replace the device register or sit next to it? | **Sit next to it.** Session items have free-form columns and the same code repeats every quarter. Devices have fixed fields, unique tags and permanent history. Merging them would break both. The two modules share login, roles and departments. Later, `item_code ↔ devices.asset_tag` can show "currently held by" on the Inventory page |
| D2 | Which roles can use the existing custody pages (Devices, Employees, Handouts, Import)? | Admin and Head. Scanner gets none |
| D3 | Where will the app be hosted: in the cloud or on an office server? | Must be decided before P8. Cloud → `ALLOWED_IPS` holds the office's **public** IPs, as the AKM doc describes. Office server → it holds the **LAN subnet** |
| D4 | Can items in a *Completed* session still be edited on the Inventory page? The AKM doc contradicts itself (§5 says read-only, §8 says "at any time") | Read-only once completed |
| D5 | Can Heads scan? Can Heads mark a session complete? (The doc says an admin closes sessions and says nothing about Heads scanning) | Heads can scan in their own department. Only admins mark complete, as documented |
| D6 | Do dashboard item totals cover active sessions only, or all time? | Active sessions only, so the totals don't grow forever with archived history |

---

## 3. Implementation phases

```
Phase 1  Roles, departments & users
  └─ Phase 2  Sessions
       └─ Phase 3  Excel import into sessions
            └─ Phase 4  Scanning & QR labels
                 ├─ Phase 5  Inventory page
                 ├─ Phase 6  Export, archive & session deletion
                 └─ Phase 7  Dashboard (audit progress)

Phase 8  Office-network restriction & deployment
         (no dependencies, but it must ship before anyone other than the
          host machine can reach the app)
```

**Rules for every phase**

- Each phase adds a **new** migration in [supabase/migrations/](supabase/migrations/). Never edit `20260923000000_init.sql`, because it has already been applied.
- Permissions and business rules are enforced in the server services and in database constraints. Hiding a button is not enough.
- Tests follow the existing pattern: PGlite server tests in [server/test/](server/test/) and client flow tests against the real API.
- Update [README.md](README.md) and [AKM_User_Documentation.md](AKM_User_Documentation.md) wherever behaviour differs from what they say.

---

### Phase 1 — Roles, departments & user management

**Closes:** R1, R2, R3, R4, D1, U1, U2

**Permission matrix** (this is the source of truth for every later phase):

| Action | Admin | Head | Scanner |
|---|---|---|---|
| Dashboard | all depts | own dept | — |
| View sessions | all | own dept | own dept |
| Create session | any dept | own dept | — |
| Upload Excel / Clear Items | ✅ | own dept | — |
| Scan | ✅ | own dept (D5) | own dept |
| Undo scan | ✅ | — | — |
| Mark complete | ✅ | — | — |
| Inventory page: view / edit | all | own dept | — |
| Delete item | ✅ | — | — |
| Export | ✅ | own dept | — |
| Archive page | ✅ | — | — |
| Delete session (password) | ✅ | — | — |
| Departments / Users / Register / Print QR | ✅ | — | — |
| Custody pages (Devices, Employees, Handouts, Import) | ✅ | ✅ (D2) | — |

**Database**
- `departments (id, name, created_at, updated_at)` with a case-insensitive unique name.
- `profiles` gets `role text not null default 'scanner' check (role in ('admin','head','scanner'))` and `department_id uuid references departments`.
- Backfill: set every existing profile to `admin`, because they have full access today. Without this, current IT staff are locked out when the migration runs.
- Accounts created outside the Register page start as `scanner` with no department. They can sign in but see nothing until an admin assigns them.

**API**
- A `loadProfile` middleware runs after `requireAuth` and puts `role` and `department_id` onto `req.user`. Read these **from the `profiles` table and never from token `user_metadata`**, because Supabase lets users edit their own metadata.
- Helpers: `requireRole(...roles)` and `departmentScope(req)` (returns `null` for admins, meaning no filter).
- Add `createUser({ email, password, full_name })` to the auth interface. It uses Supabase's admin API with a new server-only `SUPABASE_SERVICE_ROLE_KEY`. Add the key to `readConfig` and `.env.example`, and fix the `.env.example` comment that currently says the service key "is not needed". Add `createUser` to the fake auth in tests too.
- Routes: `GET/POST/PATCH /api/departments`, `GET /api/users`, `POST /api/users` (register), `PATCH /api/users/:id` (role/department). `GET /api/auth/me` also returns role and department.
- Put the existing custody routes behind `requireRole` according to D2.
- Bootstrap the first admin with a script (`npm run user:role -- <email> admin`) or a documented SQL snippet.

**UI**
- `useSession` exposes `role`. The Sidebar filters its links by role and adds an **Admin** section: Users, Register, Departments.
- A `RequireRole` route wrapper. After login, scanners go to `/sessions`.
- New pages: `DepartmentsPage`, `UsersPage`, `RegisterPage`.

**Tests:** a table-driven test that runs every route for every role and checks it returns 403 exactly where the matrix says. A scanner cannot read another department's data. Register creates both the auth user and the profile.

**Done when:** every row of the matrix is enforced by the server, and a scanner signing in sees only Sessions.

---

### Phase 2 — Sessions

**Closes:** SE1, SE2, SE3, SE4

**Database**
- `inventory_sessions (id, name, department_id not null, status 'active'|'completed', completed_at, completed_by, columns text[], display_columns text[], created_by, created_at, updated_at)` with `check ((status = 'completed') = (completed_at is not null))`.
  - Name the table `inventory_sessions` in code so it doesn't collide with the login-session code (`useSession`, `lib/session.js`). The UI still says "Sessions".
- A view `inventory_session_summary` that adds `effective_status` (`archived` when `completed_at <= now() - interval '7 days'`), `item_count` and `scanned_count`.
  - **Archiving is derived, not stored.** This follows the same principle as "issued" in `device_current_holder`: no cron job that can silently fail, and the 7-day rule is always exact.

**API**
- `GET /api/sessions` (scoped by department, `?status=`), `POST /api/sessions`, `GET/PATCH /api/sessions/:id`, `POST /api/sessions/:id/complete` (admin).
- One shared guard, `assertSessionWritable(session, user)`. It requires `effective_status = 'active'` and department access. Every later write (upload, clear, scan, edit item) goes through it.

**UI**
- `SessionsPage`: one card per session showing name, department, status badge and scanned-of-total progress, with **Upload Excel** and **Open** buttons.
- `NewSessionDialog`: admins pick a department; heads get their own automatically.
- `SessionDetailPage` header with **Mark Complete**. Placeholder slots for Export, Clear and Delete, which later phases fill in.

**Tests:** a head cannot create a session in another department. Completing an already-completed session is refused. A session reads as `archived` once `completed_at` is more than 7 days ago (set up in fixtures).

**Done when:** sessions can be created, listed per department and completed, and a completed session refuses writes.

---

### Phase 3 — Excel import into sessions

**Closes:** I1, I2, I3, I6, I7, I8, I11, I12 (and keeps I4, I5, I9, I10 working)

**Database**
- `session_items (id, session_id references inventory_sessions on delete cascade, item_code text not null, data jsonb not null default '{}', scanned_at, scanned_by references profiles, created_at, updated_at)`.
  - `unique (session_id, lower(item_code))`. This gives uniqueness per session only, so a code can repeat across sessions (I6).
  - `check ((scanned_at is null) = (scanned_by is null))`.
  - Index on `(session_id, scanned_at)`.
- `inventory_sessions.columns` stores the headers in spreadsheet order, because **jsonb does not keep key order**. Tables and exports read column order from here.

**Parsing (client)**
- Use **SheetJS** for `.xlsx` and legacy `.xls`, installed from the SheetJS CDN tarball. The npm `xlsx` package is frozen at 0.18.5, which has known advisories such as CVE-2023-30533. Keep papaparse for `.csv`.
- Find the item-code column by normalising headers: lowercase them and strip spaces, dashes and underscores, then look for `itemcode`. `Item Code`, `item-code` and `ITEMCODE` all match.
- Build row objects with `Object.create(null)` so a header named `__proto__` can't cause trouble.
- Add a drag-and-drop zone and a column picker (checkboxes, all ticked by default) that saves `display_columns`.

**API**
- `POST /api/sessions/:id/import { columns, rows, commit }`. This reuses the `importDevices` pattern: dry run, line-numbered errors, `ON CONFLICT DO NOTHING` and `reportLostRaces`.
- Ignore the reserved export columns (Scan Status, Scanned At, Scanned By) so that a Phase 6 backup re-imports cleanly as fresh, pending items.
- Large sheets will exceed the current `express.json({ limit: '5mb' })`. Either raise the limit on this route or send rows in chunks, and cap the row count.
- `POST /api/sessions/:id/clear { confirm: 'CLEAR' }`. The server checks the confirmation text too, so a stray API call can't wipe a session. Scan history survives because `scan_events` (Phase 4) references the session, not the items.

**UI:** an **Upload Excel** dialog on the session card, a result summary, and a `ClearItemsDialog` with an eraser icon and the typed `CLEAR` confirmation.

**Tests:** the same code imports into two different sessions. A duplicate, either within the file or against existing items, is skipped and its line reported. A row missing its item code is skipped. All three header variants are detected. Clear Items keeps the session. A completed session refuses import.

**Done when:** an AKM-style spreadsheet with any columns uploads into a session, and those columns appear in the session's item table.

---

### Phase 4 — Scanning & QR labels

**Closes:** Q1–Q8

**Database**
- `scan_events (id, session_id references inventory_sessions on delete cascade, item_code, outcome 'scanned'|'duplicate'|'not_found'|'undone', actor references profiles, created_at)`. This append-only log feeds "10 most recent scans" and survives Clear Items.

**API**
- `POST /api/sessions/:id/scan { code }` runs one atomic statement:
  ```sql
  update session_items set scanned_at = now(), scanned_by = $user
   where session_id = $1 and lower(item_code) = lower(btrim($2)) and scanned_at is null
  returning *
  ```
  If no row comes back, look the code up to tell *already scanned* (return who scanned it and when) from *not found*. When two scanners hit the same code at the same moment, exactly one gets success and the other gets the warning. As with the double-issue index, the database guarantees this. Log every outcome to `scan_events`.
- `POST /api/sessions/:id/items/:itemId/undo` (admin) clears `scanned_at` and `scanned_by` and logs `undone`.
- `GET /api/sessions/:id/scans?limit=10`.

**UI**
- A collapsible `ScannerPanel` on `SessionDetailPage` with **Camera** and **Manual** tabs.
  - **Manual:** an autofocused input. Enter submits, then the input clears and refocuses. Handheld barcode scanners act as keyboards, so this is all they need.
  - **Camera:** use `html5-qrcode` or `@zxing/browser`, because the native `BarcodeDetector` API isn't available in every browser. Ignore a repeat of the same code for about 2 seconds so one sticker doesn't scan in a loop.
- A result banner coloured green, yellow or red, the list of the 10 most recent scans, and the items table with Scanned/Pending status and a ↺ undo button for admins.
- **Print QR codes** (admin): a print-friendly page that generates each item's QR code in the browser with the `qrcode` package (encoding only the item code) and lays out a label grid with `@media print`.

> ⚠️ Browsers allow camera access (`getUserMedia`) only on `https://` or `localhost`.
> Phones on the office Wi-Fi need Phase 8's HTTPS before Camera mode works for them.
> Manual mode works everywhere.

**Tests:** a scan moves an item from pending to scanned and records who did it. Scanning it again returns *duplicate* with the original scanner. An unknown code returns *not found*. Two scans of the same code at once give exactly one success. A scanner from another department gets 403. A head trying to undo gets 403. Scanning a completed session is refused. On the client, the manual input's Enter flow works.

**Done when:** a scanner can work through a whole session using a handheld scanner, and the item table shows every item as scanned.

---

### Phase 5 — Inventory page

**Closes:** V1–V8

**API**
- `GET /api/items?session_id=&status=scanned|pending&q=&page=`, scoped by department. It returns the items, the ordered union of their columns, and total/scanned/pending counts for the stat cards. Paginate on the server, because items pile up with every quarterly session.
- `PATCH /api/items/:id { item_code?, data? }` for admins and for heads in their own department. The session must be active (D4). A code that collides within the session returns 409. It never changes `scanned_at`.
- `DELETE /api/items/:id` (admin).

**UI**
- `InventoryPage` in the sidebar for admins and heads, with:
  - a session filter (All sessions or one named session)
  - **Total / Scanned / Pending** stat cards that filter the table
  - an item-code search box
  - a table with one column per imported field inside `overflow-x-auto`
  - columns that are empty across the current results hidden
  - the Session column hidden when one session is selected
- `EditItemPanel`: a new slide-over drawer component (only `Modal` exists today).
- A trash icon for admins, with a confirmation modal.

**Tests:** a head sees only their own department. Empty columns are hidden. Editing keeps the scan status. A code collision returns 409. A head trying to delete gets 403.

**Done when:** an admin can find, edit and delete any item across all sessions from one page.

---

### Phase 6 — Export, archive & session deletion

**Closes:** E1, E2, AR1, AR2, AR3, X1, X2, X3

**Export**
- `GET /api/sessions/:id/export` generates an `.xlsx` file on the server with SheetJS. Columns: `itemCode`, then every imported column in its original order, then **Scan Status** (Scanned/Pending), **Scanned At** (office local time) and **Scanned By**.
- Keep the formula neutralising from `exports.js`. File name: `<session name> - <date>.xlsx`.
- The file must re-import through Phase 3. Add a round-trip test for this.

**Archive**
- `ArchivePage` (admin) lists sessions whose `effective_status = 'archived'`. The Phase 2 guard already makes them read-only. Each row has **Export** and **Delete** buttons.

**Delete session**
- `DELETE /api/sessions/:id { password }` (admin). The server re-checks the password with the existing `auth.signIn(req.user.email, password)`, then deletes the session. Its items and `scan_events` go with it (cascade).
- A wrong password must return **403 or 422 with code `WRONG_PASSWORD`, never 401**. On any 401, [client.js](client/src/api/client.js) tries to refresh the login, and if that fails it signs the user out. A typo would log the admin out instead of showing an inline error.
- `DeleteSessionDialog`:
  - Step 1: **Download Excel Backup**. The button turns green once the download finishes.
  - Step 2: a password field with an eye toggle.
  - **Delete Session** stays disabled until both steps are done. A wrong password shows an inline error.
  - The dialog opens from the Sessions list, the session page and the Archive.

**Tests:** a wrong password deletes nothing. A head gets 403. Items are gone after a successful delete. The export contains the scan columns. Export → re-import gives the same items, all pending.

**Done when:** a completed session shows up in the Archive after 7 days, and an admin can export it and then delete it.

---

### Phase 7 — Dashboard (audit progress)

**Closes:** S2, S3, S4, S5, S6

**API:** `GET /api/dashboard/audit`, scoped by department. It returns the department count, the number of active sessions, total and scanned items in active sessions (D6), the overall percentage, and one row per department with totals and a percentage.

**UI:** put the audit section at the top of the Dashboard. The existing custody widgets stay below it for roles that can see them (D2). Heads see only their own department.

**Tests:** the numbers match the fixtures, and a head's view excludes other departments.

**Done when:** the dashboard matches AKM §4.

---

### Phase 8 — Office-network restriction & deployment

**Closes:** A1, A2, A3

**Production serving:** Express serves `client/dist` (`express.static` plus a fallback to the single-page app) so that one middleware protects both the pages and the API. `npm start` runs it. In production, bind to `0.0.0.0` or the LAN IP instead of `127.0.0.1`.

**`officeNetworkOnly` middleware**
- It is the **first** middleware, before static files and `/api`.
- It reads `ALLOWED_IPS` from `.env`: a comma-separated list of IPs or CIDR ranges covering the primary and backup ISPs (or the LAN subnet, depending on D3). Match with Node's built-in `net.BlockList`.
- Blocked requests get a 403 with a self-contained **Access Restricted** HTML page, so no app bundle and no login form are sent. `/api/*` requests get a JSON 403.
- **Fail closed:** in production, refuse to start if `ALLOWED_IPS` is empty. This matches how `readConfig` already fails loudly.
- Set `app.set('trust proxy', …)` to the exact proxy hop count or proxy IP. **Never set it to `true`**, because then `X-Forwarded-For` is attacker-controlled and anyone can bypass the allowlist.

**HTTPS:** required so phones can use camera scanning (Phase 4).

**Why the allowlist covers sign-in too:** the browser never talks to Supabase directly, because sign-in goes through `/api/auth`. RLS already closes Supabase's own REST API.

**Docs:** update AKM_User_Documentation.md §2 and the FAQ. The IP list lives in `ALLOWED_IPS` in `.env`, not in `middleware.ts`.

**Tests:** an allowed IP passes. A blocked IP gets 403 on both `/` and `/api/*`. A CIDR range matches. A spoofed `X-Forwarded-For` is ignored when no proxy is trusted. The server refuses to start in production with an empty allowlist.

**Done when:** the app is reachable over HTTPS from office Wi-Fi, and from outside the office it shows only the Access Restricted page.
