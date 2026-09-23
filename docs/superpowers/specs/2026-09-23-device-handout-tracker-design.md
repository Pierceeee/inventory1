# Device Handout Tracker — Design Spec

**Date:** 2026-09-23
**Status:** Approved — frontend-first build order
**Repo:** `inventory`

---

## 1. Intent

Track which employee has which company device, and **when it was handed to them**.

At Adspark, each employee is issued one laptop (MacBook or Windows) and one mobile
phone. They keep both until they resign. This system records that handout, keeps a
permanent history, and answers two questions in a couple of clicks:

- *Who has laptop `ASP-0042`, and since when?*
- *What devices does Maria Santos currently hold?*

### Success criteria

- Every handout has an accurate `issued_at` timestamp.
- A device can never appear to be held by two people at once.
- Offboarding an employee surfaces every device they still hold.
- The full history of a device survives employees coming and going.

### Relationship to AKM

AKM (Adspark Kollection Manager) does periodic **scan audits** — "walk the floor and
confirm these 200 items exist." This system does **custody tracking** — "this laptop
went to this person on this date." Different jobs.

This first version is standalone. The data model leaves room for AKM integration later
(`devices.asset_tag` is the natural join key against AKM's `itemCode`), but no
integration work is in scope now.

---

## 2. Scope

### In scope

- Device register: laptops and mobiles, core identity fields only.
- Employee register.
- Issue a device to an employee with a timestamp.
- Return a device with a timestamp and a reason.
- Full history per device and per employee.
- Email + password login for a small IT team.
- CSV import for the existing device/employee spreadsheets.
- Manual add/edit forms.
- Dashboard counts and CSV export.

### Explicitly out of scope (deferred, not rejected)

| Deferred | Why not now |
|---|---|
| Office-IP restriction | Runs locally for now; no exposure to protect |
| Cloud deployment | Decide after the tool proves itself |
| Roles beyond single admin | Small IT team, everyone trusted |
| AKM integration / merge | Tackle after the simple system works |
| Specs, warranty, purchase cost | Not needed to answer the core question |
| Condition notes & accessories | Valuable at offboarding — revisit after BE-4 |
| QR code generation / scanning | AKM already does this |
| Signed acknowledgement forms | Paper process stays paper for now |

### Assumptions

- Scale is tens to a few hundred devices and employees — not thousands.
- A handful of IT staff use it, rarely concurrently.
- Runs on a local machine throughout the phases in §10; hosting decided later.

---

## 3. Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────┐   supabase-js  ┌────────────┐
│  React (Vite)   │ ─────────────────> │  Express (Node)  │ ─────────────> │  Supabase  │
│  client/        │ <───────────────── │  server/         │ <───────────── │  Postgres  │
└─────────────────┘                    └──────────────────┘                └────────────┘
     browser                            business rules live here             source of truth
     never touches DB                    plain, testable JavaScript
```

### Why Supabase (Postgres) over MongoDB Atlas

1. **The core invariant is a one-line index.** "A device has at most one open
   assignment" is a Postgres partial unique index. In Mongo it is application-level
   locking you have to get right forever.
2. **The data is relational.** Employees ↔ assignments ↔ devices with real foreign
   keys. History queries are ordinary SQL.
3. **Auth is included.** No password hashing, session handling, or reset flow to write.
4. **Fields are fixed.** Mongo's schema flexibility would matter if devices had
   arbitrary per-import columns like AKM's Excel sheets. They don't — core identity
   fields were chosen deliberately.

### Why a separate Express API

- Matches the stated stack: React frontend, JavaScript backend.
- Business rules sit in plain JavaScript that unit tests can drive directly, rather
  than in SQL row-level-security policies.
- The Supabase service key stays server-side. The browser never holds database
  credentials.
- A future mobile or scanner client becomes another API consumer, not a rewrite.

### Project layout

```
inventory/
├── client/                      React + Vite
│   └── src/
│       ├── pages/               Devices, Employees, Handouts, Dashboard
│       ├── components/
│       ├── api/                 typed fetch wrappers
│       ├── hooks/
│       └── mocks/               MSW handlers — deleted at cutover (§10)
├── server/                      Express (JavaScript)
│   └── src/
│       ├── routes/              devices, employees, assignments, import, export
│       ├── services/            business rules — the testable core
│       ├── db/                  supabase client
│       └── middleware/          validation, auth, error handler
├── supabase/
│   └── migrations/              versioned SQL
├── docs/superpowers/specs/
└── package.json                 npm workspaces
```

### Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, React Router, TanStack Query, Tailwind CSS |
| Backend | Node + Express 5, Zod validation |
| Database | Supabase (Postgres), migrations via Supabase CLI |
| Auth | Supabase Auth (email + password) |
| Testing | Vitest, Supertest, React Testing Library |
| CSV | PapaParse |
| Mock API | MSW (Mock Service Worker) — frontend phases only |

---

## 4. Data model

### `employees`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `full_name` | text | required |
| `email` | text | unique, nullable |
| `department` | text | plain text for now |
| `status` | text | `active` \| `resigned` |
| `resigned_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | |

### `devices`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `asset_tag` | text | **unique**, required — the human-readable ID |
| `type` | text | `laptop` \| `mobile` |
| `brand` | text | e.g. Apple, Dell, Samsung |
| `model` | text | e.g. MacBook Air M2 |
| `serial_number` | text | unique where not null |
| `os` | text | `macos` \| `windows` \| `ios` \| `android` |
| `status` | text | `available` \| `repair` \| `retired` — **lifecycle only** |
| `notes` | text | nullable |
| `created_at` / `updated_at` | timestamptz | |

### `assignments` — the handout log

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `device_id` | uuid | FK → devices, required |
| `employee_id` | uuid | FK → employees, required |
| `issued_at` | timestamptz | required, defaults to now |
| `issued_by` | uuid | FK → auth.users, nullable until BE-5 |
| `returned_at` | timestamptz | **null means still held** |
| `returned_by` | uuid | nullable |
| `return_reason` | text | `resignation` \| `swap` \| `repair` \| `lost` \| `other` |
| `issued_condition` | text | `good` \| `fair` \| `damaged`, defaults to `good` |
| `returned_condition` | text | same values, **null until returned** |
| `issued_accessories` | text[] | what went out with it, e.g. `{charger,case}` |
| `returned_accessories` | text[] | what came back, null until returned |
| `notes` | text | nullable |
| `created_at` | timestamptz | |

One row per handout. `issued_at` is the timestamp the whole system exists to record.

### Condition and accessories

Condition is stored **as a pair on the same row** — the state it left in and the
state it came back in. Storing only the current condition would answer "what shape
is this laptop in" while losing "what shape was it in when we handed it over",
which is the only question an offboarding dispute actually turns on. The pair makes
the change visible without a diff.

Accessories are a set of known tokens rather than free text, so "charger missing"
is reportable instead of buried in prose:

| Device type | Tokens |
|---|---|
| `laptop` | `charger`, `case`, `box` |
| `mobile` | `charger`, `case`, `sim`, `box` |

Free-text `notes` stays for everything the tokens do not cover.

### The no-double-issue guarantee

```sql
CREATE UNIQUE INDEX one_open_assignment_per_device
  ON assignments (device_id)
  WHERE returned_at IS NULL;
```

The database physically refuses to hand the same device to two people. Not a check in
application code that a future bug can bypass — an impossibility.

### "Issued" is derived, never stored

`devices.status` tracks lifecycle only (`available` / `repair` / `retired`). Whether a
device is currently out is computed from the presence of an open assignment:

```sql
CREATE VIEW device_current_holder AS
SELECT
  d.*,
  a.id          AS assignment_id,
  a.issued_at,
  e.id          AS holder_id,
  e.full_name   AS holder_name
FROM devices d
LEFT JOIN assignments a ON a.device_id = d.id AND a.returned_at IS NULL
LEFT JOIN employees  e ON e.id = a.employee_id;
```

If `status = 'issued'` were also stored, the two could drift apart after a crash or a
bug, leaving a device marked available while it sits on someone's desk. Deriving it
means that whole class of bug cannot occur.

### Atomicity

No stored procedures or explicit transactions are needed, because each operation is a
single statement whose safety comes from the schema itself:

- **Issue** is one `INSERT`. If a concurrent request already opened an assignment for
  that device, the partial unique index rejects the second insert with Postgres error
  `23505`, which the service translates into a 409. The race path and the checked path
  return identical responses.
- **Return** is one `UPDATE ... WHERE id = $1 AND returned_at IS NULL`. A concurrent
  second return updates zero rows, which the service translates into a 409.

Every other rule in §5 is a read-then-write check in the JavaScript service layer.
Those are guardrails against user error, not concurrency invariants. The one invariant
that must hold under races is enforced by the index, not by application code.

### Indexes

```sql
CREATE INDEX ON assignments (device_id, issued_at DESC);
CREATE INDEX ON assignments (employee_id, issued_at DESC);
CREATE INDEX ON devices (type, status);
CREATE INDEX ON devices (asset_tag);
```

---

## 5. Business rules

### Issuing a device

| Condition | Result |
|---|---|
| Device already has an open assignment | **409** — rejected, response names the current holder |
| Device status is `retired` | **409** — rejected |
| Device status is `repair` | **409** — rejected, "return from repair first" |
| Employee status is `resigned` | **409** — rejected |
| `issued_at` is in the future | **400** — rejected |
| Employee already holds a device of the same type | **201 with a warning** — allowed, UI shows a confirm step |

That last one is deliberate. The 1-laptop-1-mobile rule is how things normally work,
not a law. Swaps and loaners create legitimate overlap during handover, and a hard
block would make the tool something to fight rather than use.

### Returning a device

| Condition | Result |
|---|---|
| Assignment already returned | **409** — rejected |
| `returned_at` earlier than `issued_at` | **400** — rejected |
| `returned_at` in the future | **400** — rejected |
| `returned_condition` missing | **400** — rejected, it is the point of recording a return |
| Valid | Assignment closed; device becomes available |

Returning with a condition worse than it went out in, or with fewer accessories
than it left with, is **allowed and recorded** — never blocked. That is precisely
the case the fields exist to capture, and refusing it would push people to record a
comfortable fiction. The UI highlights the difference so it is not recorded by
accident.

### Resigning an employee

Sets `status = 'resigned'` and `resigned_at`. Does **not** auto-close assignments —
instead the UI lists every device still held and requires each to be returned
explicitly, so nothing quietly disappears from the record at offboarding.

### Deleting

Devices and employees are never hard-deleted while they have history. Devices are
retired; employees are marked resigned. History is permanent.

---

## 6. API surface

All responses are JSON. Errors use a single shape:

```json
{ "error": { "code": "DEVICE_ALREADY_ISSUED", "message": "...", "details": { } } }
```

```
GET    /api/health

GET    /api/devices              ?type= &status= &held=true|false &q=
POST   /api/devices
GET    /api/devices/:id          → device + current holder + full history
PATCH  /api/devices/:id
POST   /api/devices/:id/retire

GET    /api/employees            ?status= &q=
POST   /api/employees
GET    /api/employees/:id        → employee + devices held + full history
PATCH  /api/employees/:id
POST   /api/employees/:id/resign

GET    /api/assignments          ?device_id= &employee_id= &open= &from= &to=
POST   /api/assignments          issue  { device_id, employee_id, issued_at?,
                                          issued_condition?, issued_accessories?, notes? }
POST   /api/assignments/:id/return      { returned_at?, return_reason,
                                          returned_condition, returned_accessories?, notes? }

POST   /api/import/devices       CSV            (BE-6)
POST   /api/import/employees     CSV            (BE-6)
GET    /api/export/assignments   CSV            (BE-7)
GET    /api/dashboard                           (BE-7)
```

### Authentication

Supabase Auth is a separate service the browser talks to directly, so §6 defines no
auth endpoints. During the frontend phases the mock exposes `POST /api/auth/login`
and `GET /api/auth/me` purely to stand in for it; **both are deleted at cutover**
along with the rest of `client/src/mocks/`. Every other request carries
`Authorization: Bearer <token>`, which is exactly what BE-5 will verify — so the
header plumbing is already correct and only the token's issuer changes.

`issued_by` and `returned_by` are resolved from that token server-side and never
accepted from the request body, or anyone could record a handout as a colleague.

Request bodies are validated with Zod at the route boundary. Route handlers stay thin;
all rules live in `server/src/services/` so they can be tested without HTTP.

---

## 7. Screens

| Route | Purpose |
|---|---|
| `/devices` | Table of all devices. Search by asset tag, serial, model. Filter chips: All / Laptops / Mobiles, and Available / Issued / Repair / Retired. Shows current holder inline. |
| `/devices/:id` | Device detail. Current holder card. **Issue** or **Return** button. Full chronological history. |
| `/employees` | Table of staff. Search by name or email. Filter active / resigned. |
| `/employees/:id` | Employee detail. Devices currently held with issue dates. Full history. **Mark Resigned** flow. |
| `/handouts` | Chronological log of every issue and return, newest first, with a date-range filter. The "when did I give this out" view. |
| `/login` | Email + password. Built in FE-5, wired to real auth in BE-5. |
| `/import` | CSV upload, column mapping, preview before commit. FE-5 / BE-6. |
| `/` | Dashboard. FE-5 / BE-7. |

### Interaction notes

- Issuing from a device page pre-fills the device; issuing from an employee page
  pre-fills the employee. Both reach the same dialog.
- `issued_at` defaults to now but is editable, for recording handouts after the fact.
- The same-type warning appears as an inline confirm inside the issue dialog, never as
  a blocking error.

---

## 8. Error handling

- **Validation** — Zod at the route boundary, 400 with the offending fields.
- **Business rule violations** — 409 with a machine-readable `code` the UI maps to a
  readable message.
- **Unique index violations** — Postgres error 23505 is caught and translated into the
  matching 409, so the race-condition path produces the same response as the checked
  path.
- **Unexpected errors** — a single Express error middleware logs the detail and returns
  a generic 500. Internals never reach the client.
- **Frontend** — TanStack Query surfaces loading and error states per view. Mutations
  show the server's message inline on the form, not as a toast that can be missed.

---

## 9. Testing

Test-driven: each phase writes its failing test first.

| Layer | Tool | Covers |
|---|---|---|
| Services | Vitest | Every business rule in §5, each as a named test |
| API | Vitest + Supertest | Status codes, error shapes, validation |
| Database | Vitest against a real schema | The partial unique index actually rejects a double-issue |
| Components | React Testing Library | Forms, filters, the issue/return dialogs |

The double-issue test is non-negotiable: two concurrent issue calls for the same device
must produce exactly one success and one 409.

Component tests run against the MSW handlers in Node during the frontend phases. Because
those handlers speak the §6 contract, the same tests keep running unchanged once the real
backend replaces them — they become the frontend's regression suite across the cutover.

---

## 10. Build order — frontend first

The frontend is built and reviewed **before** any backend exists. Sections 4, 5 and 6
are the fixed contract; the UI is written against them, and a mock HTTP layer plays the
part of the server until the real one is ready.

The reason is cost of correction. A wrong field on a form is a five-minute fix while it
is only a form. The same mistake, discovered after the migration, the service, the Zod
schema and the tests are written against it, costs a day. Reviewing a clickable UI first
moves every domain mistake into the cheap window.

### The mock layer

Mock Service Worker intercepts `fetch` at the network boundary. Components use real
TanStack Query, real loading and error states, and real HTTP status codes. The frontend
contains no mock-aware branching whatsoever.

```
client/src/mocks/
├── db.js         in-memory store — devices, employees, assignments
├── rules.js      §5 enforced — DISPOSABLE, deleted at cutover
├── handlers.js   every route in §6
└── seed.js       ~40 devices, ~30 employees, realistic history
```

**The mock enforces §5, not merely response shapes.** A mock that cheerfully issues an
already-issued laptop cannot be reviewed, because the flow that matters never runs. So
the handlers reject a double-issue with a genuine 409 and `DEVICE_ALREADY_ISSUED`,
refuse a resigned employee, return 400 for a future `issued_at`, and return 201 with the
warning payload on a same-type handout so the inline confirm can be seen working.

**Accepted cost:** §5 is implemented twice — once in `mocks/rules.js`, once properly in
`server/src/services/` under TDD. Roughly a hundred throwaway lines. That duplication is
the price of reviewing the UI before the backend exists, and at this scale it is worth
paying. A shared workspace package could remove it, but the backend needs database-level
enforcement regardless, so coupling the two is not worth the indirection.

**Seed data is Adspark-shaped:** `ASP-####` tags, a mix of MacBooks and Windows laptops,
two devices in repair, two resigned employees still holding devices, and one laptop with
three handouts of history so the timeline views have something real to render.

### Cutover is a deletion

When the backend lands: delete `client/src/mocks/`, remove the worker startup call in
`main.jsx`. No component, hook, or `api/` module changes. **If something else does need
to change, that is a genuine contract mismatch and it should be loud.**

---

### Frontend phases

#### FE-1 — App shell `Easy`

- [ ] npm workspaces monorepo: `client/`, `server/` (server is an empty stub for now)
- [ ] Vite + React 19 + Tailwind + React Router + TanStack Query
- [ ] MSW installed and started in dev; seed data loads
- [ ] AKM-style layout: left sidebar, header, content area
- [ ] Vitest + React Testing Library run, with MSW in Node for component tests
- [ ] `.env.example` documented, real `.env` gitignored

**Done when:** `npm run dev` serves a navigable shell and a smoke test passes.

#### FE-2 — Devices `Easy`

- [ ] `/devices` table: search by asset tag, serial, model
- [ ] Filter chips: All / Laptops / Mobiles, and Available / Issued / Repair / Retired
- [ ] Current holder shown inline
- [ ] `/devices/:id` detail: holder card, full chronological history
- [ ] Add and edit device forms, with the duplicate-asset-tag 409 surfaced inline
- [ ] Tests: filters return the right rows, duplicate tag shows the server message

**Done when:** you can add a laptop, find it by asset tag, and open its detail page.

#### FE-3 — Employees `Easy`

- [ ] `/employees` table: search by name or email, active / resigned filter
- [ ] `/employees/:id` detail: devices currently held with issue dates, full history
- [ ] Add and edit employee forms
- [ ] Tests: duplicate email surfaced, resigned filter works

**Done when:** you can add staff and filter active from resigned.

#### FE-4 — Handouts `Medium` ⭐ the core

- [ ] Issue dialog with editable `issued_at`, reachable from both device and employee pages
- [ ] Same-type handout warning as an inline confirm, never a blocking error
- [ ] Return dialog with reason
- [ ] Every §5 rejection rendered as a readable message mapped from its `code`
- [ ] Device and employee history timelines
- [ ] `/handouts` chronological log with date-range filter
- [ ] Resign flow listing every device still held, each returned explicitly
- [ ] Tests: each §5 rejection path renders its message; the issue dialog pre-fills correctly from both entry points

**Done when:** you can hand out a laptop, see the exact timestamp, see who holds it, and
be refused when you try to hand it out twice.

#### FE-5 — Remaining screens `Medium`

- [ ] `/` dashboard: counts by total / issued / available / type, "who has what" table
- [ ] `/login` email + password form, protected route shell
- [ ] `/import` CSV upload, column mapping, dry-run preview with per-row errors
- [ ] Tests: bad rows listed with row numbers, counts render correctly

**Done when:** every route in §7 is reachable and behaves.

---

### ▸ REVIEW GATE

Click through everything. Report what is wrong — wording, fields, flows, anything that
does not match how Adspark actually hands out devices. Corrections are applied to the
frontend and, where the contract itself was wrong, to §4–§6 of this spec, **before** any
backend work begins.

---

### Backend phases

Built test-driven, in the order below. Each phase replaces the corresponding MSW
handlers with real routes.

#### BE-1 — Foundation `Easy`

- [ ] Express 5 boots, `GET /api/health` returns 200
- [ ] Supabase project created, connection verified
- [ ] Migration creates all three tables, the partial unique index, and the view
- [ ] Vitest + Supertest run in the server workspace

**Done when:** health check passes and the migration applies clean.

#### BE-2 — Devices `Easy`

- [ ] Device service: create, update, list with filters, retire
- [ ] `/api/devices` routes with Zod validation
- [ ] Tests: duplicate asset tag rejected, filters return the right rows

#### BE-3 — Employees `Easy`

- [ ] Employee service: create, update, list with filters, resign
- [ ] `/api/employees` routes
- [ ] Tests: duplicate email rejected, resigned filter works

#### BE-4 — Assignments `Medium` ⭐

- [ ] Issue as a single INSERT, Postgres `23505` translated to 409
- [ ] Return as a guarded UPDATE, zero rows translated to 409
- [ ] Every remaining rule in §5 enforced in the service layer
- [ ] `POST /api/assignments` and `/api/assignments/:id/return`
- [ ] Tests: all of §5, including concurrent double-issue

#### BE-5 — Auth `Medium`

- [ ] Supabase Auth email + password
- [ ] Express middleware verifies the JWT on every `/api` route
- [ ] `issued_by` and `returned_by` populated from the session
- [ ] Tests: unauthenticated requests get 401

#### BE-6 — CSV import `Medium`

- [ ] Device and employee CSV import with column mapping and dry-run
- [ ] Bad rows reported with row numbers, never crash the batch
- [ ] Duplicate asset tags skipped and reported
- [ ] Tests: malformed CSV, duplicates, missing required columns

#### BE-7 — Dashboard + export `Medium`

- [ ] `GET /api/dashboard` counts
- [ ] `GET /api/export/assignments` CSV with date-range filter
- [ ] Tests: counts correct, export contains the right columns

---

### Cutover `Easy`

- [ ] Delete `client/src/mocks/`
- [ ] Remove the MSW startup call from `main.jsx`
- [ ] Point `api/` at the real server origin
- [ ] Every component test still passes, now against the real API

**Done when:** the app runs end to end with no mock code in the tree.

---

## 11. Open questions

None blocking. Revisit after BE-4:

- Condition notes and accessories at issue/return — likely the first thing you'll miss
  at an offboarding dispute.
- Hosting: the cloud-vs-office-network decision was deferred while this runs locally.
- AKM integration: `asset_tag` ↔ `itemCode` is the join key when you're ready.
