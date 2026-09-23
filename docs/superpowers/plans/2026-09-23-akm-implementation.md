# AKM Implementation Plan

Build plan for [improvements.md](../../../improvements.md), produced by the planner agent (blueprint, §0–§8) and
reviewed by the architect agent (Appendix A). **Read the Reconciliation section first — it overrides both.**

## Reconciliation (binding; overrides the blueprint and Appendix A where they conflict)

Rule of thumb: where the architect review (Appendix A) flags a correctness or security issue, the review wins.
Where the two differ only in naming or limits, follow the blueprint (e.g. `session_items.seq` generated identity
== the review's `position`; object rows `{ line, data }` built with `Object.create(null)` are fine instead of
array rows; the blueprint's 2,000-char cell cap stands).

- **R1 Archived sessions (overrides blueprint §1.3 and matrix rows).** Heads may read their OWN department's
  archived sessions via the API (`GET /api/sessions?status=archived`, `GET /api/sessions/:archivedId`, its
  items/scans, its export) and see those items on the Inventory page. Scanners never see archived sessions (403).
  The Archive PAGE (sidebar link + route) stays admin-only. Archived sessions stay read-only for everyone.
  Matrix changes: `GET /api/sessions?status=archived` head ✓ (scoped) · scanner 403; `GET /api/sessions/:f4`
  head ✓ · scanner 403.
- **R2 Service-role key is OPTIONAL (overrides blueprint §2 G-4, §3.2 config).** `readConfig` returns
  `supabaseServiceRoleKey` (maybe undefined) and never fails on it; `index.js` logs a one-line warning when it is
  missing. `createUser` without a key throws 503 `REGISTRATION_UNAVAILABLE`. Test: `readConfig` does NOT require it.
- **R3 Last-admin guard (overrides blueprint single guarded UPDATE).** Inside `db.transaction`, lock
  `select id from profiles where role = 'admin' and disabled_at is null for update`, then refuse demoting or
  deactivating the last enabled admin with 409 `LAST_ADMIN`.
- **R4 User deactivation (new, Group 1).** Migration adds `profiles.disabled_at timestamptz`.
  `PATCH /api/users/:id` accepts `disabled: boolean` (admin only; an admin cannot disable themselves → 409
  `CANNOT_DISABLE_SELF`; last-admin guard applies). `loadProfile` throws 403 `ACCOUNT_DISABLED` for disabled users;
  `POST /api/auth/login` refuses them with 403 `ACCOUNT_DISABLED` after a successful sign-in check (don't upsert).
  Client: `request()`/`fetchWithAuth` ends the session on a 403 whose code is `ACCOUNT_DISABLED`; LoginPage shows
  its message. Users page shows a Disabled badge and Deactivate / Reactivate buttons. `GET /api/users` returns
  `disabled_at`.
- **R5 Example departments are named `IT (example)`, `Creative (example)`, `Finance (example)`** so `db:seed` does
  not collide with a real "IT" department; include them in the seed clash check. Test expectations use these names.
- **R6 Out of scope (follow-ups, document only):** password change/reset (use the Supabase dashboard), reopening a
  completed session, renaming the app. The Mark Complete dialog warns how many items are still pending.
- **R7 `GET /api/health` is exempt from the office-network allowlist (Group 6).** `OFFICE_TIME_ZONE` defaults to
  `Asia/Manila`.

---

Each implementing agent should read ORCHESTRATION_RULES.md, then §0–§2 of this file, then its own group section. The groups run in order: G1 → G2 → G3 → G4 → G5 → G6. G4 and G5 could run in either order, but both edit the same files (SessionDetailPage, Sidebar, App.jsx, permissions.test.js), so run them one after the other. G6 goes last because it edits config/app/index, which G1 and G5 also touch.

---

## 0. Ground truth this plan is built on (verified in the code)

- Express 5 (thrown errors in async handlers reach `errorHandler`), zod 4, pg / PGlite. `createApp({ db, auth })` is in `server/src/app.js`. Every route after `api.use(signedIn)` already needs a token.
- `requireAuth(auth)` sets `req.user = { id, email, full_name }` from the token (`server/src/middleware/auth.js`). The server never reads a role today.
- `upsertProfile(db, user)` runs on `/auth/login` and on handout writes (`server/src/services/profiles.js`).
- Tests:
  - `useTestApi()` (`server/test/support/api.js`) resets PGlite with `emptyDb` + `loadFixtures` before every test. It signs in as `allen@adspark.ph` by default (`t.api`). `t.as(email)` signs in as someone else.
  - The client tests (`client/src/test/setup.js`) run against `startTestServer()` and also sign in as allen.
  - Fake auth has `signIn/refresh/verify/sessionFor` (`server/test/support/fakeAuth.js`). `USERS` = `EXAMPLE_STAFF` + password `adspark`.
- Existing tests that use other staff:
  - `rina@` issues handouts (`server/test/assignments.test.js:149`, `client/src/pages/custody.test.jsx:165`).
  - `kim@` returns handouts (`assignments.test.js:190`) and records one (`auth.test.js:75`).
  - Both must therefore be admin or head.
- `server/test/schema.test.js:84` asserts the exact list of views, and `:73` asserts that every table has RLS.
- `server/test/reports.test.js:25` truncates `profiles` (see gotcha G-2).
- `server/test/exampleData.test.js` uses `toEqual` on the exact seed/remove result objects.
- `client/src/pages/flows.test.jsx:346-347` calls `getByText('40')` and `getByText('34')` on the Dashboard (40 devices, 34 open handouts).
- jsdom has no `File.arrayBuffer()` (see the comment in `server/test/support/testDb.js`), no `URL.createObjectURL`, no canvas and no camera.

---

## 1. Cross-cutting conventions

### 1.1 Naming
| Layer | Name |
|---|---|
| Migrations | `20260924000100_roles_departments.sql` (G1), `20260925000100_inventory_sessions.sql` (G2), `20260926000100_scan_events.sql` (G3). G4–G6 add none. |
| Tables | `departments`, `inventory_sessions`, `session_items`, `scan_events` |
| Views | `inventory_session_summary`, `session_item_details` (both `with (security_invoker = true)`) |
| SQL functions | `public.session_effective_status(text, timestamptz)`, `public.assert_session_active()`, `public.refuse_scan_event_update()` |
| Server services | `departments.js`, `users.js`, `inventorySessions.js`, `sessionItems.js`, `scans.js`, `items.js`, `auditDashboard.js`, `sessionExport.js` |
| Server routes | `departments.js`, `users.js`, `sessions.js` (URL `/api/sessions`), `items.js` |
| Client api/hooks | `api/inventorySessions.js`, `hooks/useInventorySessions.js`, `api/items.js`, `hooks/useItems.js`, `api/departments.js`, `api/users.js`, `hooks/useDepartments.js`, `hooks/useUsers.js` |
| Client components | `components/sessions/*`, `components/scanner/*`, `components/items/*`, `components/labels/*`, `components/dashboard/*`, `components/users/*`, `components/departments/*` |
| UI copy | "Session(s)". `lib/session.js` and `hooks/useSession.jsx` stay the **login** session. Do not rename them or reuse them for audit sessions. |

### 1.2 How role and department reach `req.user` (server)
- In `app.js`: `const signedIn = [requireAuth(auth), loadProfile(db)]`. Use it both for `api.use(signedIn)` and as the `requireAuth` passed to `authRouter`, so `/auth/me` gets it too. Express accepts arrays of middleware.
- `loadProfile(db)` (in `server/src/middleware/access.js`):
  - Reads `profiles` (joined to `departments`) on **every request**. It never reads token `user_metadata`.
  - If there is no profile row, it calls `upsertProfile(db, req.user)` first. That creates the row with the defaults: `scanner`, no department.
  - Afterwards `req.user = { id, email, full_name, role, department_id, department_name }`.
- `requireRole(...roles)` (same file) throws `forbidden()` when `req.user.role` is not in `roles`.
  - **Rule:** in every route, `requireRole` runs **before** `parse()` and before any DB lookup. A scanner who sends a bad body gets 403, not 400.
- Pure helpers go in `server/src/lib/access.js`:
  ```js
  // Never `null` = "no filter": a head/scanner without a department must see nothing, not everything.
  export const departmentScope = (user) => ({ all: user.role === 'admin', departmentId: user.department_id ?? null })
  export const canAccessDepartment = (user, departmentId) =>
    user.role === 'admin' || (user.department_id != null && user.department_id === departmentId)
  export function assertDepartmentAccess(user, departmentId) {
    if (!canAccessDepartment(user, departmentId)) throw forbidden('That belongs to another department.')
  }
  ```
  - **SQL pattern for every scoped query:** `where ($1::boolean or x.department_id = $2::uuid)` with `[scope.all, scope.departmentId]`. A null `departmentId` matches nothing.
  - This deliberately differs from improvements.md, where `departmentScope(req)` returns `null` for admins. That form would widen access for users who have no department.
- `ROLES = ['admin', 'head', 'scanner']` and `CUSTODY_ROLES = ['admin', 'head']` go in `server/src/lib/values.js`.
- `forbidden(message = 'You do not have permission to do that.')` goes in `server/src/lib/errors.js` and returns `new AppError(403, 'FORBIDDEN', message)`.
- `assertSessionWritable(session, user)` (G2, exported from `server/src/services/inventorySessions.js`) calls `assertDepartmentAccess` (403) and then requires `session.effective_status === 'active'` (otherwise 409 `SESSION_NOT_ACTIVE`). Every write to items goes through it: upload, clear, scan, undo, edit item, delete item, rename, display columns.

### 1.3 Archived sessions are admin-only
This is my reading of the matrix row "Archive page: Admin only". The server enforces it:
- Non-admins asking for `GET /api/sessions?status=archived` get 403.
- `status=all` for non-admins leaves out archived sessions.
- `getSessionFor()` returns 403 ("Archived sessions are only available to admins.") when a non-admin opens an archived session. This also blocks its items, scans and export.
- `GET /api/items` hides items in archived sessions from non-admins.

### 1.4 Error envelope and codes
Everything goes through `middleware/errors.js`: `{ error: { code, message, details } }`.

| Status | Code | When |
|---|---|---|
| 403 | `FORBIDDEN` | Wrong role, other department, archived for a non-admin, head with no department creating a session |
| 409 | `SESSION_NOT_ACTIVE` | Writing to a completed/archived session. The message says "completed" or "archived". DB errcode `55000` is mapped to this. |
| 409 | `DUPLICATE_DEPARTMENT` | `details.name` |
| 409 | `DUPLICATE_EMAIL` | Register (reuses the client's existing code). `details.email` |
| 409 | `LAST_ADMIN` | Demoting the only admin |
| 409 | `DUPLICATE_ITEM_CODE` | Item edit collides within its session. `details.item_code` |
| 409 | `ITEM_NOT_SCANNED` | Undo on a pending item |
| 422 | `WRONG_PASSWORD` | Session delete re-auth. `details.password`. **Never 401.** |
| 503 | `REGISTRATION_UNAVAILABLE` | The Supabase admin API refused the service key or is down. **Never 401.** |
| 403 | `OFFICE_NETWORK_ONLY` | G6 allowlist, `/api/*` only |

A 401 means only "your token is bad". `client.js` treats every 401 as an expired session: it refreshes, and if that fails it signs the user out. So no permission or password failure may ever be 401.

### 1.5 How the client learns its role; 401 vs 403
- The role is read **only** from `GET /api/auth/me`, through a TanStack query inside `SessionProvider`, key `['me', session?.user?.id]`. It is never read from the login response, from localStorage or from the token. The login response is unchanged.
- `useSession()` returns `{ session, user, profile, role, profileLoading, profileError, signIn, signOut }`:
  - `profile` = `{ id, email, full_name, role, department_id, department_name }`
  - `profileLoading = Boolean(session) && me.isPending`
  - `signOut` also calls `queryClient.removeQueries({ queryKey: ['me'] })`
- 401 is handled by the existing `client.js` renew/sign-out logic, unchanged.
- 403 / 409 / 422 become an `ApiError`:
  - Show it inline with `ErrorBanner`, or with `fieldErrorsOf` when `details` names a field.
  - Never sign the user out.
  - Optional (G1): in `main.jsx`, build the `QueryClient` with `queryCache: new QueryCache({ onError: (e) => e?.status === 403 && queryClient.invalidateQueries({ queryKey: ['me'] }) })` so a demotion updates the sidebar.
- Client-side role helpers mirror the server. They only hide UI; the server still decides. They live in `client/src/lib/roles.js`:
  ```js
  export const ROLES = ['admin', 'head', 'scanner']
  export const ROLE_LABELS = { admin: 'Admin', head: 'Head', scanner: 'Scanner' }
  export const CUSTODY_ROLES = ['admin', 'head']
  export const homeFor = (role) => (role === 'scanner' ? '/sessions' : '/')
  export const isAdmin = (p) => p?.role === 'admin'
  export const canManage = (p, deptId) => isAdmin(p) || (p?.role === 'head' && p.department_id != null && p.department_id === deptId)
  export const canScan = (p, deptId) => isAdmin(p) || (p?.department_id != null && p.department_id === deptId)
  ```

### 1.6 Fixture conventions (`server/src/db/exampleData.js`)
- Change the id helper. `group` 0 reproduces today's ids exactly:
  ```js
  // b=department, c=staff, e=employee, d=device, a=assignment,
  // f=audit: second group 0000 session, 0001 item, 0002 scan event.
  const id = (kind, n, group = 0) =>
    `${kind}${String(n).padStart(7, '0')}-${String(group).padStart(4, '0')}-4000-8000-000000000000`
  ```
- Staff, finalised in G1:

| id | name | email | role | department |
|---|---|---|---|---|
| c1 | Allen Lacoste | allen@adspark.ph | admin | IT |
| c2 | Rina Delgado | rina@adspark.ph | head | IT |
| c3 | Kim Bautista | kim@adspark.ph | head | Creative |
| c4 | Tess Ramos | tess@adspark.ph | scanner | IT |
| c5 | Mark Villanueva | mark@adspark.ph | scanner | Creative |
| c6 | Nina Cruz | nina@adspark.ph | scanner | — (null) |

- Departments: b1 `IT`, b2 `Creative`, b3 `Finance` (Finance has no staff and no sessions).
- `server/test/support/fixtures.js` exports:
  ```js
  export const STAFF = {
    admin: 'allen@adspark.ph', itHead: 'rina@adspark.ph', creativeHead: 'kim@adspark.ph',
    itScanner: 'tess@adspark.ph', creativeScanner: 'mark@adspark.ph', unassigned: 'nina@adspark.ph',
  }
  ```
  `server/test/support/api.js` re-exports it.
- Sessions (G2) and scans (G3) are fully specified in their groups. The derived numbers that tests assert:
  - Active sessions: 2 (IT 12 items / 6 scanned, Creative 9 / 3) → 21 items, 9 scanned, **43%**.
  - All items: 31 total / 18 scanned / 13 pending.
  - Rina's Inventory (IT, archived excluded): 18 / 11 / 7.
  - **None of these numbers is 40 or 34** (see gotcha G-11).

### 1.7 Master permission matrix (server). Every row becomes a case in `server/test/permissions.test.js`
Test identities: admin = allen, head = rina (IT), scanner = tess (IT). Resources are IT-owned: f1 is the active IT session, f4 is the archived IT session.

| Method | Path | admin | head | scanner | Added by |
|---|---|---|---|---|---|
| GET | /api/auth/me | ✓ | ✓ | ✓ | G1 |
| GET, POST | /api/devices | ✓ | ✓ | 403 | G1 |
| GET, PATCH | /api/devices/:id | ✓ | ✓ | 403 | G1 |
| POST | /api/devices/:id/retire | ✓ | ✓ | 403 | G1 |
| GET, POST | /api/employees | ✓ | ✓ | 403 | G1 |
| GET, PATCH | /api/employees/:id | ✓ | ✓ | 403 | G1 |
| POST | /api/employees/:id/resign | ✓ | ✓ | 403 | G1 |
| GET, POST | /api/assignments | ✓ | ✓ | 403 | G1 |
| POST | /api/assignments/:id/return | ✓ | ✓ | 403 | G1 |
| GET | /api/dashboard | ✓ | ✓ | 403 | G1 |
| GET | /api/export/assignments | ✓ | ✓ | 403 | G1 |
| POST | /api/import/devices, /api/import/employees | ✓ | ✓ | 403 | G1 |
| GET, POST | /api/departments | ✓ | 403 | 403 | G1 |
| PATCH | /api/departments/:id | ✓ | 403 | 403 | G1 |
| GET, POST | /api/users | ✓ | 403 | 403 | G1 |
| PATCH | /api/users/:id | ✓ | 403 | 403 | G1 |
| GET | /api/sessions | ✓ | ✓ | ✓ | G2 |
| GET | /api/sessions?status=archived | ✓ | 403 | 403 | G2 |
| POST | /api/sessions | ✓ | ✓ | 403 | G2 |
| GET | /api/sessions/:f1 | ✓ | ✓ | ✓ | G2 |
| GET | /api/sessions/:f4 (archived) | ✓ | 403 | 403 | G2 |
| PATCH | /api/sessions/:f1 | ✓ | ✓ | 403 | G2 |
| POST | /api/sessions/:f1/complete | ✓ | 403 | 403 | G2 |
| GET | /api/sessions/:f1/items | ✓ | ✓ | ✓ | G2 |
| POST | /api/sessions/:f1/import | ✓ | ✓ | 403 | G2 |
| POST | /api/sessions/:f1/clear | ✓ | ✓ | 403 | G2 |
| POST | /api/sessions/:f1/scan | ✓ | ✓ | ✓ | G3 |
| POST | /api/sessions/:f1/items/:itemId/undo | ✓ | 403 | 403 | G3 |
| GET | /api/sessions/:f1/scans | ✓ | ✓ | ✓ | G3 |
| GET | /api/items | ✓ | ✓ | 403 | G4 |
| PATCH | /api/items/:id | ✓ | ✓ | 403 | G4 |
| DELETE | /api/items/:id | ✓ | 403 | 403 | G4 |
| GET | /api/dashboard/audit | ✓ | ✓ | 403 | G4 |
| GET | /api/sessions/:f1/export | ✓ | ✓ | 403 | G5 |
| DELETE | /api/sessions/:f1 | ✓ | 403 | 403 | G5 |

Case assertion:
- Allowed → `status !== 403 && status !== 401`.
- Forbidden → `status === 403 && body.error.code === 'FORBIDDEN'`.

Department-scope cases (for example Rina on the Creative session f2) are separate named tests in each group.

---

## 2. Risks / ordering gotchas (read before coding)

- **G-1 Existing tests sign in as allen, rina and kim.**
  - Allen must be admin; rina and kim must be admin or head, or the custody tests turn 403 once G1 gates custody routes.
  - The default client identity (`setup.js`) is allen, so admin.
- **G-2 `reports.test.js:25` truncates `profiles`.** After G1 the next request re-creates allen's profile as a **scanner**, and `/api/dashboard` returns 403.
  - Fix in G1: change that line to `truncate table assignments, devices, employees cascade`.
  - General rule: API tests must never truncate `profiles` or `departments`, because the signed-in user's role lives there. Truncate only the tables under test.
- **G-3 Backfill.** The G1 migration sets every existing profile to `admin`, so production staff keep full access.
  - After that, profiles created on first login default to `scanner` with no department. They sign in and see an empty Sessions page until an admin assigns them.
  - Fresh installs bootstrap the first admin with `npm run user:role -- <email> admin`. Agents must not run it: it connects to DATABASE_URL.
- **G-4 Service-role key.**
  - `auth.createUser` needs a new server-only `SUPABASE_SERVICE_ROLE_KEY`.
  - G1 makes it required in `readConfig` when `needAuth`, so the server fails loudly at startup. Scripts don't need it.
  - The human must add it to `.env` before the next `npm start`. It must never have a `VITE_` prefix.
  - The fake auth needs `createUser` **and** `reset()`, because accounts created during a test must not leak into the next one.
- **G-5 Handout recorders.** `EXAMPLE_STAFF` grows from 3 to 6. Existing handouts use `EXAMPLE_STAFF[seq % length]`. Replace that with `RECORDERS = EXAMPLE_STAFF.slice(0, 3)` so the handout fixtures stay byte-identical and scanners never "record" handouts.
- **G-6 `exampleData.test.js`** checks exact seed/remove result objects. Update the expectations in G1 (add `departments`) and G2 (add `sessions`, `items`).
- **G-7 View and RLS lists.** Update `schema.test.js`'s view list in G2 to `['assignment_details', 'device_current_holder', 'inventory_session_summary', 'session_item_details']`. The RLS test catches any new table without `enable row level security`.
- **G-8 The G2 trigger refuses item and scan-event inserts into non-active sessions.**
  - `insertExampleData` must insert all sessions as `active`, then their items (and scan events in G3), then run one `update` that completes f3 and f4.
  - Deletes (cascade, Clear Items, delete item) are not covered by the trigger. The services guard them.
- **G-9 `emptyDb` must list every new table** (see each group). Truncating `departments` cascades to `profiles` and `inventory_sessions`.
- **G-10 JSON limit.** The global `express.json({ limit: '5mb' })` would reject large sheets with 413 before any route-level parser runs. G2 switches parsers per path: 20 MB for `/api/sessions/:id/import`, 5 MB everywhere else.
- **G-11 Dashboard test numbers.** `flows.test.jsx` calls `getByText('40')` and `getByText('34')`.
  - The audit section must never render an element whose own text is exactly `40` or `34`. The fixture numbers avoid this.
  - Render `x of y scanned` and `43%` as one string each.
  - DashboardPage must keep showing "Loading…" until **both** the custody and audit queries resolve, so the heading never appears before the custody numbers.
- **G-12 `me` loads asynchronously.**
  - Pages rendered directly in tests (no `RequireRole`) must still work while `profile` is null: show a loading state or hide role-only buttons until it loads.
  - Tests must use `findBy*` / `waitFor` for anything that depends on role.
- **G-13 jsdom gaps.**
  - Read files with `FileReader` (jsdom's `File` has no `arrayBuffer()`).
  - Stub `URL.createObjectURL` / `URL.revokeObjectURL` and `HTMLAnchorElement.prototype.click` in download tests.
  - Load the camera library lazily, and only after checking `navigator.mediaDevices?.getUserMedia`.
  - Generate QR codes as **SVG strings** (no canvas).
- **G-14 PGlite serialises everything.** Concurrency tests prove the logic. The production guarantee comes from single-statement `UPDATE … WHERE scanned_at IS NULL`, `ON CONFLICT DO NOTHING`, and the `FOR SHARE` lock in `assert_session_active()`.
- **G-15 Express 5 wildcard.** The SPA fallback must be `app.get('/{*path}', …)`; `'*'` throws in path-to-regexp v8. Mount it **after** `/api`, whose router already ends in a JSON 404.
- **G-16 trust proxy.**
  - Never `true`. Accept only a hop count or a list of proxy IP/CIDRs.
  - supertest connects as `::ffff:127.0.0.1`, so IPv4-mapped IPv6 must be normalised before matching.
- **G-17 SheetJS from the CDN tarball.** `package-lock.json` records `https://cdn.sheetjs.com/...`, so `npm ci` needs network access to that host. Import it with `import * as XLSX from 'xlsx'`. On the client, load it dynamically so the main bundle stays small.
- **G-18 `bigint` columns.** node-postgres returns int8 as a string and PGlite may return BigInt, which breaks `JSON.stringify`. `session_items.seq` is therefore `integer`, and counts use `::int`, as they do today.
- **G-19 DELETE with a JSON body.**
  - G1 adds `delete` to the supertest `client()` helper.
  - The browser `request()` already sends a body for any method.
  - If G6 puts a reverse proxy in front that strips DELETE bodies, fall back to `POST /api/sessions/:id/delete` and note it (not expected on Caddy/nginx defaults).
- **G-20 Custody `employees.department` stays free text.** It is separate from `departments` (D1). Do not migrate it.

---

## 3. Group 1: Phase 1 (roles, departments, users)

### 3.1 Migration: `supabase/migrations/20260924000100_roles_departments.sql`
```sql
-- AKM Phase 1 - departments and roles.
--
-- Role and department live on profiles and the API reads them on every
-- request, never from the token: Supabase lets users edit their own
-- user_metadata.

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null
                constraint departments_name_length check (length(btrim(name)) between 1 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- "IT", "it" and " IT " are one department.
create unique index departments_name_key on public.departments (lower(btrim(name)));

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

alter table public.departments enable row level security;

-- New accounts start as scanners with no department: they can sign in but
-- see nothing until an admin assigns them.
alter table public.profiles
  add column role text not null default 'scanner'
    constraint profiles_role_check check (role in ('admin', 'head', 'scanner')),
  add column department_id uuid references public.departments (id) on delete set null;

create index profiles_department_idx on public.profiles (department_id);

-- Everyone who could sign in before this had full access. Keep it that way,
-- or current IT staff are locked out the moment this runs.
update public.profiles set role = 'admin';
```

### 3.2 Server

**Modify `server/src/lib/errors.js`**: add `export const forbidden = (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message)`.

**Modify `server/src/lib/values.js`**: add `ROLES`, `CUSTODY_ROLES` (§1.2).

**New `server/src/lib/access.js`**: `departmentScope(user)`, `canAccessDepartment(user, departmentId)`, `assertDepartmentAccess(user, departmentId)` (§1.2).

**New `server/src/middleware/access.js`**:
```js
export function loadProfile(db) // async (req,res,next): findProfile -> upsertProfile if missing -> req.user = {...req.user, role, department_id, department_name}
export function requireRole(...roles) // (req,res,next): if (!roles.includes(req.user?.role)) throw forbidden()
```

**Modify `server/src/services/profiles.js`**: add
```js
export async function findProfile(db, id)
// select p.id, p.email, p.full_name, p.role, p.department_id, d.name as department_name, p.created_at
//   from profiles p left join departments d on d.id = p.department_id where p.id = $1   (isUuid guard -> undefined)
```
`upsertProfile` stays as it is, so it never touches `role` or `department_id`.

**New `server/src/services/departments.js`**:
```js
export async function listDepartments(db)            // [{ id, name, user_count, created_at, updated_at }] order by lower(name)
export async function createDepartment(db, { name }) // 201 row; 23505 on departments_name_key -> conflict('DUPLICATE_DEPARTMENT', `${name} already exists.`, { name: 'Already exists.' })
export async function updateDepartment(db, id, { name }) // 404 notFound('Department'); same 409 mapping
export async function departmentExists(db, id)       // boolean (isUuid guard)
```

**New `server/src/services/users.js`**:
```js
export async function listUsers(db)  // [{ id, email, full_name, role, department_id, department_name, created_at }] order by lower(coalesce(full_name, email))
export async function registerUser(db, auth, input)
//   1. if input.department_id && !(await departmentExists) -> invalid({ department_id: 'No such department.' })   (checked BEFORE creating the auth account)
//   2. account = await auth.createUser({ email, password, full_name })
//   3. insert into profiles (id, email, full_name, role, department_id) values (...)
//        on conflict (id) do update set email = excluded.email, full_name = excluded.full_name,
//        role = excluded.role, department_id = excluded.department_id
//   4. return findProfile(db, account.id)
export async function updateUser(db, id, patch)
//   404 if no profile; unknown department -> 400 details.department_id
//   one guarded UPDATE so the last admin cannot be demoted:
//   update profiles set role = coalesce($2, role),
//          department_id = case when $3::boolean then $4::uuid else department_id end
//    where id = $1
//      and ($2::text is null or $2 = 'admin' or role <> 'admin'
//           or exists (select 1 from profiles o where o.role = 'admin' and o.id <> $1))
//   returning id        -- 0 rows & profile exists -> conflict('LAST_ADMIN', 'At least one admin must remain.')
export async function setUserRole(db, email, role) // for the bootstrap script: update ... where lower(email) = lower($1) returning id -> count
```

**Modify `server/src/auth/supabase.js`**:
- `createSupabaseAuth({ url, key, serviceRoleKey })`.
- Add to the documented interface: `createUser({ email, password, full_name }) -> { id, email, full_name }`. It calls `createClient(url, serviceRoleKey, CLIENT_OPTIONS).auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`. Create the admin client once, lazily.
- Error mapping:
  - `error.code` in (`email_exists`, `user_already_exists`) → `conflict('DUPLICATE_EMAIL', 'That email address is already registered.', { email: 'Already registered.' })`
  - `weak_password` → `invalid({ password: error.message })`
  - any other 4xx (including 401/403 for a bad key) or 5xx → log `[auth] admin createUser failed` without the key, then throw `AppError(503, 'REGISTRATION_UNAVAILABLE', 'Could not create the account right now. Check the server configuration.')`
  - Never return 401.

**Modify `server/src/config.js`**: add `supabaseServiceRoleKey: needAuth ? need('SUPABASE_SERVICE_ROLE_KEY') : env.SUPABASE_SERVICE_ROLE_KEY`.
**Modify `server/src/index.js`**: `createSupabaseAuth({ url, key, serviceRoleKey: config.supabaseServiceRoleKey })`.

**Modify `server/src/validation.js`** (add `import { isUuid, ROLES } from './lib/values.js'`):
```js
const uuidRef = (message) => z.string({ error: message }).refine(isUuid, message)
const departmentName = z.string({ error: 'Department name is required.' }).trim()
  .min(1, 'Department name is required.').max(100, 'Keep the name under 100 characters.')
export const departmentCreate = z.object({ name: departmentName })
export const departmentUpdate = departmentCreate
export const userRegister = z.object({
  full_name: z.string({ error: 'Full name is required.' }).trim().min(1, 'Full name is required.').max(200, 'Keep the name under 200 characters.'),
  email: z.string({ error: 'Enter an email address.' }).trim().max(254).refine((v) => EMAIL_RE.test(v), 'Not a valid email address.'),
  password: z.string({ error: 'Enter a password.' }).min(8, 'Use at least 8 characters.').max(72, 'Keep the password under 72 characters.'),
  role: z.enum(ROLES, { error: 'Choose admin, head or scanner.' }),
  department_id: uuidRef('Choose a department.').nullish(),
}).refine((u) => u.role === 'admin' || u.department_id,
  { path: ['department_id'], message: 'Heads and scanners need a department.' })
export const userUpdate = z.object({
  role: z.enum(ROLES, { error: 'Choose admin, head or scanner.' }).optional(),
  department_id: uuidRef('Choose a department.').nullable().optional(),
})
```

**New `server/src/routes/departments.js`** and **`server/src/routes/users.js`**. Every route starts with `requireRole('admin')`.

| Method | Path | Body | Response | Errors |
|---|---|---|---|---|
| GET | /api/departments | — | 200 `[Department]` | 403 |
| POST | /api/departments | `departmentCreate` | 201 Department | 400, 403, 409 DUPLICATE_DEPARTMENT |
| PATCH | /api/departments/:id | `departmentUpdate` | 200 Department | 400, 403, 404, 409 |
| GET | /api/users | — | 200 `[User]` | 403 |
| POST | /api/users | `userRegister` | 201 User | 400, 403, 409 DUPLICATE_EMAIL, 503 REGISTRATION_UNAVAILABLE |
| PATCH | /api/users/:id | `userUpdate` | 200 User | 400, 403, 404, 409 LAST_ADMIN |
| GET | /api/auth/me | — | 200 `{ id, email, full_name, role, department_id, department_name }` | 401 |

Routers take `{ db }` (users also takes `auth`).

**Modify `server/src/app.js`**:
```js
const signedIn = [requireAuth(auth), loadProfile(db)]
const custody = requireRole(...CUSTODY_ROLES)
api.use('/auth', authRouter({ db, auth, requireAuth: signedIn }))
api.use(signedIn)
api.use('/devices', custody, devicesRouter({ db }))
api.use('/employees', custody, employeesRouter({ db }))
api.use('/assignments', custody, assignmentsRouter({ db }))
api.use('/departments', departmentsRouter({ db }))
api.use('/users', usersRouter({ db, auth }))
api.use(reportsRouter({ db }))
```

**Modify `server/src/routes/reports.js`**: add `custody` per route (`router.get('/dashboard', custody, …)`, same for export and both imports). It is mounted at the root, so it must not use a blanket `router.use`.

**New `server/scripts/userRole.js`**:
- Usage: `node scripts/userRole.js <email> <admin|head|scanner>`.
- `readConfig(process.env, { needAuth: false })`, then `setUserRole`.
- Prints `Set <email> to admin (n profile(s)).` or `No profile for <email> yet - sign in once, then run this again.`
- Validates the role argument.
- Add `"user:role": "node scripts/userRole.js"` to `server/package.json` and `"user:role": "npm run user:role --workspace server --"` to the root `package.json`.

**Modify `.env.example`**:
- Fix the anon-key comment: remove "service_role key is not needed".
- Add:
  ```
  # Supabase -> Project Settings -> API Keys -> the secret / service_role key.
  # Server only: it lets the Register page create sign-in accounts. Never give
  # it a VITE_ prefix - anything VITE_ is bundled into every browser.
  SUPABASE_SERVICE_ROLE_KEY=
  ```

**Docs**:
- README §5 step 3: add a `SUPABASE_SERVICE_ROLE_KEY` row.
- README §5 step 6: first admin via `npm run user:role -- you@adspark.ph admin`; everyone else via **Users → Register**.
- README §9: remove "One kind of user".
- AKM §10: note that the Users page lists accounts that were registered or have signed in at least once.

### 3.3 Client
| File | Change |
|---|---|
| `client/src/lib/roles.js` (new) | §1.5 helpers |
| `client/src/hooks/useSession.jsx` | Add the `me` `useQuery` (`getCurrentUser().then(r => r.data)`, `enabled: Boolean(session)`, `staleTime: 60_000`). Expose `profile, role, profileLoading, profileError`. `signOut` removes `['me']`. |
| `client/src/components/RequireRole.jsx` (new) | Props `{ roles, children }`. `profileLoading` → `<p role="status">Loading…</p>`; `profileError` → `ErrorBanner`; role not in `roles` → `<Navigate to={homeFor(role)} replace />`; otherwise children. |
| `client/src/components/HomeRoute.jsx` (new) | Index route: loading → status; scanner → `<Navigate to="/sessions" replace />`; otherwise `<DashboardPage />` |
| `client/src/App.jsx` | Index → `HomeRoute`. `sessions` → `SessionsPage`. Custody routes inside `<Route element={<RequireRole roles={CUSTODY_ROLES}><Outlet/></RequireRole>}>`. Admin routes `users`, `users/register`, `departments` inside `RequireRole roles={['admin']}`. |
| `client/src/components/layout/Sidebar.jsx` | Sections (below). Links filtered by `role`; render nothing until `role` loads; hide a section whose links are all filtered out. User block shows `ROLE_LABELS[role] · department_name`. |
| `client/src/api/departments.js` (new) | `listDepartments()`, `createDepartment(body)`, `updateDepartment(id, body)` |
| `client/src/api/users.js` (new) | `listUsers()`, `registerUser(body)`, `updateUser(id, body)` |
| `client/src/hooks/useDepartments.js` (new) | Key `['departments']`: `useDepartmentList()`, `useCreateDepartment()`, `useUpdateDepartment()` |
| `client/src/hooks/useUsers.js` (new) | Key `['users']`: `useUserList()`, `useRegisterUser()`, `useUpdateUser()`. Mutations also invalidate `['me']` and `['departments']`. |
| `client/src/pages/UsersPage.jsx` (new) | PageHeader "Users" with action "Register user" (link to `/users/register`). `DataTable` columns: Name, Email, Role, Department (`—` if none, with a warn hint "Not assigned" for head/scanner), Edit button → `EditUserDialog`. |
| `client/src/components/users/EditUserDialog.jsx` (new) | Props `{ user, open, onClose }`. State `{ role, department_id }`. Role `<select>` and Department `<select>` (with "No department"). Save → PATCH; toast "Updated <name>."; field and banner errors (LAST_ADMIN in the banner). |
| `client/src/pages/RegisterPage.jsx` (new) | Form: Full name, Email, Password (`PasswordInput`), Role select, Department select (required unless admin; client check mirrors the server). Submit → toast "Registered <name> as <Role>." → `navigate('/users')`. Server field errors via `fieldErrorsOf`. |
| `client/src/pages/DepartmentsPage.jsx` (new) | "Add Department" button → `DepartmentDialog`. Table: Name, Users (count), Rename button. |
| `client/src/components/departments/DepartmentDialog.jsx` (new) | Props `{ department?: {id,name}, open, onClose }` (create when no department). State `name`. 409 shown on the Name field. |
| `client/src/components/ui/PasswordInput.jsx` (new) | Props `{ id, value, onChange, autoComplete = 'current-password', ...rest }`. State `visible`. Toggle button with `aria-label={visible ? 'Hide password' : 'Show password'}` and `aria-pressed`. |
| `client/src/pages/SessionsPage.jsx` (new placeholder) | PageHeader "Sessions" and an empty state; G2 replaces it. |
| `client/src/components/ui/Icon.jsx` | Add `eye`, `eyeOff`, `pencil`, `plus` paths |
| `client/src/lib/errors.js` | `FALLBACKS`: `FORBIDDEN`, `DUPLICATE_DEPARTMENT`, `LAST_ADMIN`, `REGISTRATION_UNAVAILABLE`. `FIELD_CODES`: add `DUPLICATE_DEPARTMENT` (DUPLICATE_EMAIL is already there). |
| `client/src/test/liveDb.js` | Initial `db` gains `departments: [], profiles: []` |
| `client/src/test/signInAs.js` (new) | `export async function signInAs(email) { const { data } = await signIn(email, 'adspark'); setSession(data); return data }` |
| `client/src/main.jsx` | Optional `QueryCache` 403 → invalidate `['me']` (§1.5) |

Sidebar sections (G4 and G5 add the commented rows):
```js
const SECTIONS = [
  { label: null, links: [
    { to: '/', label: 'Dashboard', end: true, roles: CUSTODY_ROLES },
    { to: '/sessions', label: 'Sessions', roles: ROLES },
    // G4 { to: '/inventory', label: 'Inventory', roles: CUSTODY_ROLES },
    // G5 { to: '/archive', label: 'Archive', roles: ['admin'] },
  ] },
  { label: 'Custody', links: [Devices, Employees, Handouts, Import].map(... roles: CUSTODY_ROLES) },
  { label: 'Admin', links: [
    { to: '/users', label: 'Users', end: true, roles: ['admin'] },
    { to: '/users/register', label: 'Register', roles: ['admin'] },
    { to: '/departments', label: 'Departments', roles: ['admin'] },
  ] },
]
```

### 3.4 Test fixtures and support
- `server/src/db/exampleData.js`:
  - New `id(kind, n, group = 0)`.
  - `EXAMPLE_DEPARTMENTS` (b1 IT, b2 Creative, b3 Finance). Export it.
  - `EXAMPLE_STAFF` with 6 rows including `role` and `department_id` (§1.6).
  - `RECORDERS = EXAMPLE_STAFF.slice(0, 3)` for handouts (G-5).
  - Rename the employee free-text list `DEPARTMENTS` → `EMPLOYEE_DEPARTMENTS`.
  - `buildExampleData()` returns `{ departments, staff, employees, devices, assignments }`.
  - `insertExampleData`: insert `departments (id, name)` first, then `profiles (id, email, full_name, role, department_id)` with types `uuid, text, text, text, uuid`.
  - `seedExampleData`:
    - Add a department clash check: `select 'department', name from departments where lower(btrim(name)) = any($4::text[])`.
    - Result becomes `{ status: 'loaded', devices, employees, handouts, departments }`.
  - `removeExampleData`, after profiles are removed:
    ```sql
    delete from departments d where d.id = any($1::uuid[])
       and not exists (select 1 from profiles p where p.department_id = d.id)
    ```
    Return `{ devices, employees, handouts, yourHandouts, departments }`.
  - `server/scripts/seed.js` messages mention departments.
- `server/test/support/testDb.js`: `emptyDb` = `truncate table assignments, devices, employees, profiles, departments cascade`. Add `export async function createBareTestDb()`: PGlite boot with no migrations, for the backfill test.
- `server/test/support/fakeAuth.js`:
  - Maps become mutable through an `add(u)` helper.
  - Add `createUser({ email, password, full_name })`: 409 `DUPLICATE_EMAIL` via `conflict()` imported from `../../src/lib/errors.js` if the email exists. Otherwise `id: randomUUID()` (node:crypto); remember the id in `created`.
  - Add `reset()`, which drops every account created at runtime.
- `server/test/support/api.js`:
  - `beforeEach` calls `t.auth.reset()`.
  - `client()` gains `delete: (url, body) => (body === undefined ? auth(request(app).delete(url)) : auth(request(app).delete(url)).send(body))`.
  - Re-export `STAFF`.
- `server/test/support/testServer.js`: `reset()` also calls `auth.reset()`.
- `server/test/support/fixtures.js`: `STAFF`. `snapshot` adds `departments` (`select * from departments order by name`) and `profiles` (`select * from profiles order by email`).
- `server/test/reports.test.js:25` → `truncate table assignments, devices, employees cascade` (G-2).
- `server/test/exampleData.test.js`: update the `toEqual` objects to include `departments`.

### 3.5 Tests to write first
Server, `server/test/permissions.test.js` (new):
- Table-driven cases `'$method $label as $role is $expected'` over the G1 rows of §1.7.
- `a 403 uses the standard envelope with code FORBIDDEN and is never a 401`
- `a scanner with a bad body still gets 403, not 400`

Server, `server/test/roles.test.js` (new):
- `the roles migration makes every existing profile an admin` (`createBareTestDb` → apply a temp dir containing only init.sql → insert a profile → `applyMigrations(db)` → role = admin)
- `a new profile defaults to scanner with no department`
- `role must be admin, head or scanner` (23514)
- `/me returns role, department id and department name`
- `an account signing in for the first time becomes a scanner with no department` (delete nina's profile, log in)
- `signing in never resets an existing role`
- `a role change takes effect on the next request, because roles are read from profiles`
- `a user with no profile row gets one on their first API call`

Server, `server/test/departments.test.js` (new):
- `lists departments with how many users each has`
- `an admin adds a department`
- `department names are unique regardless of case and surrounding spaces`
- `a blank name is a 400 naming the field`
- `an admin renames a department`
- `renaming to an existing name is a 409`
- `an unknown or malformed department id is a 404`

Server, `server/test/users.test.js` (new):
- `lists every account with role and department`
- `register creates both the sign-in account and the profile`
- `a registered user can sign in with the password given and has the chosen role`
- `registering an email that already exists is a 409 DUPLICATE_EMAIL and creates no profile`
- `heads and scanners must be given a department; admins need not`
- `register refuses an unknown department without creating an account`
- `register validates email, password length and role`
- `an admin changes a user's role and department`
- `a department can be removed from a user`
- `the last admin cannot be demoted`
- `an unknown user id is a 404`
- `setUserRole promotes every profile with that email and reports when there is none`

Server, `server/test/config.test.js` (new):
- `readConfig requires SUPABASE_SERVICE_ROLE_KEY for the server`
- `scripts (needAuth false) do not need the service role key`

Server, `server/test/exampleData.test.js` (add):
- `loads the example departments and every staff role`
- `refuses, writing nothing, when a real department already uses an example name`
- `removal keeps an example department a real account still belongs to`

Server, `server/test/auth.test.js`: add `['GET','/api/users']` and `['GET','/api/departments']` to the 401 table.

Client, `client/src/pages/admin.test.jsx` (new):
- `a scanner signing in lands on Sessions and sees only Sessions in the sidebar` (render `<App/>` at `/login` after `clearSession()`)
- `a scanner opening a custody page is sent to Sessions`
- `an admin sees Custody and an Admin section with Users, Register and Departments`
- `a head sees custody links but no Admin section`
- `the Users page lists accounts with their role and department`
- `registering a user adds them to the Users list`
- `the Register form requires a department for heads and scanners`
- `the password field has a show/hide toggle`
- `adding a department shows it in the list`
- `a duplicate department name is shown on the field`
- `changing a user's role saves and is shown in the list`

Client, `client/src/api/contract.test.js` (add):
- `getCurrentUser returns role and department`
- `a 403 is an ApiError FORBIDDEN and does not sign you out` (as tess: `listDevices()`)

### 3.6 Dependencies
None.

### 3.7 Done when
- Every G1 row of §1.7 passes as a table-driven test.
- A scanner signing in sees only **Sessions**. Admin/head see custody; only admin sees Admin.
- Register creates the auth user and the profile. The last admin can't be demoted.
- All pre-existing server and client tests pass, with only the intentional edits from G-2 and G-6.
- `npm test --workspace server`, `npm test --workspace client` and `npm run build --workspace client` are green, with exact counts reported.

---

## 4. Group 2: Phases 2+3 (sessions + Excel import into sessions)

### 4.1 Migration: `supabase/migrations/20260925000100_inventory_sessions.sql`
```sql
-- AKM Phases 2-3 - audit sessions and the items uploaded into them.
--
-- Named inventory_sessions so it never collides with sign-in "session" code;
-- the UI still says Sessions. Archiving is derived, not stored: a session
-- reads as archived 7 days after completion, so no cron job can silently
-- fail to run.

create table public.inventory_sessions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null
                    constraint inventory_sessions_name_length check (length(btrim(name)) between 1 and 200),
  department_id   uuid not null references public.departments (id) on delete restrict,
  status          text not null default 'active'
                    constraint inventory_sessions_status_check check (status in ('active', 'completed')),
  completed_at    timestamptz,
  completed_by    uuid references public.profiles (id),
  -- Spreadsheet headers in their original order: jsonb does not keep key order.
  columns         text[] not null default '{}',
  display_columns text[] not null default '{}',
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint inventory_sessions_completed_at_matches_status
    check ((status = 'completed') = (completed_at is not null)),
  constraint inventory_sessions_completed_by_needs_completion
    check (completed_by is null or completed_at is not null),
  constraint inventory_sessions_display_columns_known
    check (display_columns <@ columns)
);

create index inventory_sessions_department_idx on public.inventory_sessions (department_id, created_at desc);
create index inventory_sessions_status_idx on public.inventory_sessions (status, completed_at);

create trigger inventory_sessions_set_updated_at
  before update on public.inventory_sessions
  for each row execute function public.set_updated_at();

alter table public.inventory_sessions enable row level security;

create table public.session_items (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.inventory_sessions (id) on delete cascade,
  -- Upload order, so tables, labels and exports follow the spreadsheet.
  seq         integer generated always as identity,
  item_code   text not null
                constraint session_items_code_trimmed
                check (item_code = btrim(item_code) and length(item_code) between 1 and 100),
  data        jsonb not null default '{}'
                constraint session_items_data_is_object check (jsonb_typeof(data) = 'object'),
  scanned_at  timestamptz,
  scanned_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint session_items_scan_is_complete check ((scanned_at is null) = (scanned_by is null))
);

-- Unique within a session only: the same sticker is audited again every quarter.
create unique index session_items_code_key on public.session_items (session_id, lower(item_code));
create index session_items_session_scanned_idx on public.session_items (session_id, scanned_at);
create index session_items_session_seq_idx on public.session_items (session_id, seq);
create index session_items_scanned_by_idx on public.session_items (scanned_by) where scanned_by is not null;

create trigger session_items_set_updated_at
  before update on public.session_items
  for each row execute function public.set_updated_at();

alter table public.session_items enable row level security;

-- The one place the 7-day archive rule lives.
create function public.session_effective_status(status text, completed_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when status = 'active' then 'active'
    when completed_at <= now() - interval '7 days' then 'archived'
    else 'completed'
  end
$$;

-- A completed session is read-only (D4). FOR SHARE makes Mark Complete wait
-- for in-flight item writes, and them wait for it, so nothing lands after a
-- session closes. Deletes are not covered: cascades must still work.
create function public.assert_session_active() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.inventory_sessions
   where id = new.session_id and status = 'active'
     for share;
  if not found then
    raise exception 'Session % is not active', new.session_id using errcode = '55000';
  end if;
  return new;
end
$$;

create trigger session_items_require_active_session
  before insert or update on public.session_items
  for each row execute function public.assert_session_active();

create view public.inventory_session_summary with (security_invoker = true) as
select
  s.*,
  d.name  as department_name,
  cb.full_name as created_by_name,
  pb.full_name as completed_by_name,
  public.session_effective_status(s.status, s.completed_at) as effective_status,
  i.item_count,
  i.scanned_count
from public.inventory_sessions s
join public.departments d on d.id = s.department_id
left join public.profiles cb on cb.id = s.created_by
left join public.profiles pb on pb.id = s.completed_by
cross join lateral (
  select count(*)::int as item_count, count(si.scanned_at)::int as scanned_count
    from public.session_items si where si.session_id = s.id
) i;

create view public.session_item_details with (security_invoker = true) as
select
  i.*,
  s.name        as session_name,
  s.department_id,
  d.name        as department_name,
  s.created_at  as session_created_at,
  public.session_effective_status(s.status, s.completed_at) as session_effective_status,
  sb.full_name  as scanned_by_name
from public.session_items i
join public.inventory_sessions s on s.id = i.session_id
join public.departments d on d.id = s.department_id
left join public.profiles sb on sb.id = i.scanned_by;
```

### 4.2 Server

**New `server/src/lib/columns.js`** (the client has an identical copy, §4.3):
```js
export const normaliseHeader = (h) => String(h ?? '').toLowerCase().replace(/[\s\-_]+/g, '')
export const isItemCodeHeader = (h) => normaliseHeader(h) === 'itemcode'
export const EXPORT_COLUMNS = { status: 'Scan Status', at: 'Scanned At', by: 'Scanned By' }
const RESERVED = new Set(['scanstatus', 'scannedat', 'scannedby'])
export const isReservedColumn = (h) => RESERVED.has(normaliseHeader(h))
```

**Modify `server/src/validation.js`**. Add:
```js
export function oneOf(value, allowed, field) // one(value) -> undefined | value; not in allowed -> invalid({ [field]: `Must be one of: ...` })
export function int(value, field, { min, max, fallback }) // whole number in range or 400
export const SESSION_STATUS_FILTERS = ['active', 'completed', 'archived', 'all']
export const ITEM_STATUS_FILTERS = ['scanned', 'pending']
const sessionName = z.string({ error: 'Session name is required.' }).trim()
  .min(1, 'Session name is required.').max(200, 'Keep the name under 200 characters.')
const columnName = z.string({ error: 'Column names must be text.' }).trim().min(1).max(200, 'Keep column names under 200 characters.')
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const sessionCreate = z.object({ name: sessionName, department_id: uuidRef('Choose a department.').nullish() })
export const sessionUpdate = z.object({
  name: sessionName.optional(),
  display_columns: z.array(columnName, { error: 'Must be a list.' }).max(200).optional(),
})
export const sessionImport = z.object({
  columns: z.array(columnName, { error: 'columns must be a list.' }).max(200, 'At most 200 columns.'),
  display_columns: z.array(columnName).max(200).optional(),
  rows: z.array(z.object({
    line: z.number().int().min(2).max(1_048_576).optional(),
    item_code: cell.optional(),
    data: z.record(z.string(), cell).optional(),
  }), { error: 'rows must be a list.' }).max(10_000, 'Import at most 10,000 rows at a time.'),
  commit: z.boolean().optional(),
})
export const clearItems = z.object({ confirm: z.literal('CLEAR', { error: 'Type CLEAR to confirm.' }) })
```

**New `server/src/services/inventorySessions.js`**:
```js
export async function findSession(db, id)                 // summary row | undefined (isUuid guard)
export async function getSessionFor(db, id, user)         // 404 notFound('Session'); assertDepartmentAccess; archived && !admin -> forbidden('Archived sessions are only available to admins.')
export function assertSessionWritable(session, user)      // assertDepartmentAccess, then effective_status === 'active' or throw sessionNotActive(session)
export async function writableSession(db, id, user)       // getSessionFor + assertSessionWritable
export const sessionNotActive = (s) => conflict('SESSION_NOT_ACTIVE',
  `${s.name} is ${s.effective_status === 'archived' ? 'archived' : 'completed'} and read-only.`)
export const isSessionClosedError = (err) => err?.code === '55000'   // services translate to sessionNotActive
export async function listSessions(db, user, { status })  // see rules below
export async function createSession(db, input, user)
export async function updateSession(db, id, patch, user)  // writableSession; display_columns must be ⊆ session.columns -> else invalid({ display_columns: `Unknown column: ${c}` })
export async function completeSession(db, id, user)       // update ... set status='completed', completed_at=now(), completed_by=$2 where id=$1 and status='active' returning id; 0 rows -> sessionNotActive
```
- `listSessions` rules:
  - `status` undefined → active + completed.
  - `'all'` → admin sees every session, others see active + completed.
  - `'archived'` → admin only (403 otherwise).
  - `'active'` / `'completed'` filter normally.
  - Scope uses `($1::boolean or department_id = $2::uuid)`.
  - Order: `order by (effective_status = 'active') desc, created_at desc`.
- `createSession`:
  - Admin must pass `department_id` (else 400 `details.department_id`).
  - Head: no department → `forbidden('You are not assigned to a department yet.')`. A `department_id` other than their own → `forbidden('That belongs to another department.')`. Otherwise use their own.
  - 23503 → `invalid({ department_id: 'No such department.' })`.
  - `created_by = user.id`. Run `upsertProfile(db, user)` first (same pattern as `issueDevice`).
  - Returns the summary row.

**New `server/src/services/sessionItems.js`**:
```js
export function toItem(row)                                   // drop seq; add status: row.scanned_at ? 'scanned' : 'pending'
export async function listSessionItems(db, session, { status, q } = {}) // from session_item_details where session_id; status/q filters; order by seq
export async function importSessionItems(db, session, input, user)      // returns { created, skipped, errors, columns, display_columns }
export async function clearSessionItems(db, session)          // { deleted }
```
- `importSessionItems` algorithm. Reuse the `importDevices` pattern and **export `reportLostRaces` from `services/imports.js`**:
  1. `incoming = dedupe(input.columns.filter((c) => !isReservedColumn(c) && !isItemCodeHeader(c)))`. `merged = [...session.columns, ...incoming.filter((c) => !session.columns.includes(c))]`.
  2. Load existing keys: `select lower(item_code) as k from session_items where session_id = $1`.
  3. For each row, `line = row.line ?? index + 2`, `code = String(row.item_code ?? '').trim()`:
     - empty → error `{ line, field: 'item_code', message: 'Item code is required.' }`
     - over 100 chars → `'Item code must be under 100 characters.'`
     - exists in the session → `skipped += 1`, error `` `${code} is already in this session - skipped.` ``
     - seen earlier in the file → `skipped += 1`, error `` `${code} appears earlier in this file - skipped.` ``
  4. `data = Object.create(null)`. For each `[k, v]` of `Object.entries(row.data ?? {})` where `incoming.includes(k)`: `text = String(v ?? '').trim()`. Skip empty text. Over 2000 chars → row error `{ line, field: k, message: 'Keep each cell under 2,000 characters.' }`.
  5. `display = input.display_columns ?? [...session.display_columns, ...incoming.filter((c) => !session.columns.includes(c))]`. Every entry must be in `merged`, else 400 `details.display_columns`.
  6. If `commit && valid.length`, run `db.transaction`:
     ```sql
     insert into session_items (session_id, item_code, data)
     select $1, item_code, data from jsonb_to_recordset($2::jsonb) as r(line int, item_code text, data jsonb)
      order by line
     on conflict do nothing
     returning lower(item_code) as k
     ```
     then `update inventory_sessions set columns = $2, display_columns = $3 where id = $1`, then `reportLostRaces(...)`.
     - Catch `isSessionClosedError` → `sessionNotActive(session)`.
  7. On a dry run, return `{ created, skipped, errors, columns: merged, display_columns: display }` without writing anything.
- `clearSessionItems`:
  ```sql
  delete from session_items where session_id = $1
    and exists (select 1 from inventory_sessions s where s.id = $1 and s.status = 'active')
  ```
  - Then `update inventory_sessions set columns = '{}', display_columns = '{}' where id = $1 and status = 'active'`. The next file brings its own columns.
  - Both statements run in one transaction.
  - Scan history is untouched (scan_events references the session).

**New `server/src/routes/sessions.js`**, `sessionsRouter({ db })`. Mounted with `api.use('/sessions', sessionsRouter({ db }))`.

| Method | Path | requireRole | Body / query | Response | Errors |
|---|---|---|---|---|---|
| GET | / | ROLES | `?status` via `oneOf(SESSION_STATUS_FILTERS)` | 200 `[Session]` | 400, 403 (archived for non-admin) |
| POST | / | admin, head | `sessionCreate` | 201 Session | 400, 403 |
| GET | /:id | ROLES | — | 200 Session | 403, 404 |
| PATCH | /:id | admin, head | `sessionUpdate` | 200 Session | 400, 403, 404, 409 SESSION_NOT_ACTIVE |
| POST | /:id/complete | admin | — | 200 Session | 404, 409 SESSION_NOT_ACTIVE |
| GET | /:id/items | ROLES | `?status` (`oneOf(ITEM_STATUS_FILTERS)`), `?q` | 200 `[Item]` | 400, 403, 404 |
| POST | /:id/import | admin, head | `sessionImport` | 200 `{ created, skipped, errors, columns, display_columns }` | 400, 403, 404, 409, 413 |
| POST | /:id/clear | admin, head | `clearItems` | 200 `{ deleted }` | 400, 403, 404, 409 |

- Session shape: the summary row, i.e. `{ id, name, department_id, department_name, status, effective_status, completed_at, completed_by, completed_by_name, columns, display_columns, created_by, created_by_name, created_at, updated_at, item_count, scanned_count }`.
- Item shape: `{ id, session_id, item_code, data, status, scanned_at, scanned_by, scanned_by_name, session_name, department_id, department_name, session_created_at, session_effective_status, created_at, updated_at }`.

**Modify `server/src/app.js`**. Replace `app.use(express.json({ limit: '5mb' }))` with:
```js
// Spreadsheets are the one large payload; everything else stays small.
const IMPORT_ROUTE = /^\/api\/sessions\/[^/]+\/import$/
const bigJson = express.json({ limit: '20mb' })
const json = express.json({ limit: '5mb' })
app.use((req, res, next) => (IMPORT_ROUTE.test(req.path) ? bigJson : json)(req, res, next))
```
Then mount `sessionsRouter`.

**Docs** (AKM): §5 (heads create sessions for their own department; only admins mark complete), §6 (.csv is accepted too; a dry-run preview comes before the import), and Clear Items also resets the column list.

### 4.3 Client
| File | Change |
|---|---|
| `client/src/lib/spreadsheet.js` (new) | `normaliseHeader`, `isItemCodeHeader`, `isReservedColumn`, `findItemCodeColumn(headers)`, `readFileAsArrayBuffer(file)` (FileReader), `parseSpreadsheet(file)` → `{ headers, rows: [{ line, values }], sheetName }`, `buildImportPayload(parsed, displayColumns)` → `{ codeColumn, columns, display_columns, rows: [{ line, item_code, data }] }` or `{ error }` |
| `client/src/api/inventorySessions.js` (new) | `listSessions(params)`, `getSession(id)`, `createSession(body)`, `updateSession(id, body)`, `completeSession(id)`, `listSessionItems(id, params)`, `importSessionItems(id, body)`, `clearSessionItems(id)` → body `{ confirm: 'CLEAR' }` |
| `client/src/hooks/useInventorySessions.js` (new) | Keys below. `useSessionList(params)`, `useInventorySession(id)`, `useSessionItems(id, params)`, `useCreateSession()`, `useUpdateSession()`, `useCompleteSession()`, `useImportItems()`, `useClearItems()`. Mutations invalidate `['inventory-sessions']`, `['items']`, `['dashboard','audit']`. |
| `client/src/components/ui/ProgressBar.jsx` (new) | Props `{ value, max, label }`. `role="progressbar"` with `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax`, `aria-label`. Brand fill. |
| `client/src/components/ui/StatusBadge.jsx` | Add `completed` (brand), `archived` (slate), `scanned` (ok), `pending` (warn) |
| `client/src/components/ui/Icon.jsx` | Add `eraser`, `upload` |
| `client/src/components/sessions/SessionCard.jsx` (new) | Props `{ session, canUpload, onUpload }`: name link, department, badge, `ProgressBar` + "x of y scanned", **Upload Excel** (if `canUpload && effective_status==='active'`), **Open** link. (G5 adds `onDelete`.) |
| `client/src/components/sessions/NewSessionDialog.jsx` (new) | Props `{ open, onClose }`. State `{ name, department_id }`. Admin gets a Department `<select>` (`useDepartmentList`); a head sees "Department: <name>" as read-only text. On success: toast, then `navigate('/sessions/' + id)`. |
| `client/src/components/sessions/DropZone.jsx` (new) | Props `{ onFile, accept = '.xlsx,.xls,.csv', disabled }`. State `dragging`. A `<label>` wraps a visually hidden `<input type="file" aria-label="Choose a spreadsheet">`; `onDragOver` calls preventDefault; `onDrop` takes `e.dataTransfer.files[0]`. |
| `client/src/components/sessions/ColumnPicker.jsx` (new) | Props `{ columns, selected: string[], onChange }`. `<fieldset><legend>Columns to show</legend>` with a checkbox per column and "Select all" / "Select none". |
| `client/src/components/sessions/UploadItemsDialog.jsx` (new) | Props `{ session, open, onClose }`. State `{ fileName, parsed, selected, preview, committed, error, busy }`. Steps: DropZone → "Item codes: column <X> · N rows" (or the no-itemCode error) → ColumnPicker (all ticked) → **Check file** (dry run → `ImportPreview`) → **Import N items** → "Added N items. M skipped." Reuses `components/imports/ImportPreview.jsx`. |
| `client/src/components/sessions/ClearItemsDialog.jsx` (new) | Props `{ session, open, onClose }`. State `confirm`. Input label "Type CLEAR to confirm"; **Clear All Items** (danger) disabled until `confirm === 'CLEAR'`; toast "Cleared N items from <name>." |
| `client/src/components/sessions/CompleteSessionDialog.jsx` (new) | Props `{ session, open, onClose }`. Copy: "Scanning and uploads close for good. N items are still pending." **Mark Complete** button. |
| `client/src/components/sessions/SessionItemsTable.jsx` (new) | Props `{ session, items, isLoading, error, renderActions? }`. Columns: Item code (mono), each of `display_columns` (or `columns` if that is empty), Status badge, Scanned by, Scanned at (`formatDateTime`). Client-side search box plus chips All / Scanned / Pending. Uses `DataTable`. |
| `client/src/pages/SessionsPage.jsx` | Replaces the placeholder. PageHeader "Sessions" with **New Session** (admin, or head with a department). Chips All / Active / Completed map to `status` undefined / `active` / `completed`. Grid of `SessionCard`. Empty states: "No sessions yet." and, for a profile without a department, "You're not assigned to a department yet. Ask an admin." |
| `client/src/pages/SessionDetailPage.jsx` (new) | Route `sessions/:id`. Header: back link, name, subtitle `department · status · x of y scanned`. Actions shown only when `canManage` and active: **Upload Excel**, **Clear Items** (eraser), **Choose columns** (ColumnPicker in a Modal → PATCH). **Mark Complete** for admins while active. Read-only notice when not active: "This session is completed and read-only." Then `ProgressBar` and `SessionItemsTable`. Placeholders commented for G3 (ScannerPanel, Print QR codes) and G5 (Export, Delete). |
| `client/src/App.jsx` | `sessions/:id` route |
| `client/src/lib/errors.js` | `FALLBACKS.SESSION_NOT_ACTIVE: 'This session is completed and read-only.'` |
| `client/src/test/liveDb.js` | Add `sessions: [], items: []` |

Query keys:
```js
export const inventorySessionKeys = {
  all: ['inventory-sessions'],
  list: (params) => ['inventory-sessions', 'list', params ?? {}],
  detail: (id) => ['inventory-sessions', 'detail', id],
  items: (id, params) => ['inventory-sessions', 'items', id, params ?? {}],
  scans: (id) => ['inventory-sessions', 'scans', id],       // G3
}
```

`parseSpreadsheet` rules:
- `.xlsx` / `.xls`:
  - `const XLSX = await import('xlsx')`, then `XLSX.read(buf, { type: 'array', dense: true })` and take the first sheet.
  - `XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true })`. `raw: false` keeps the text users see, including leading zeros.
  - Line number = `decode_range(ws['!ref']).s.r + index + 1`.
- `.csv`: `Papa.parse(file, { header: false, skipEmptyLines: false })`.
- Header cleaning:
  - Trim.
  - A blank header becomes `Column <n>`.
  - Duplicate headers get ` (2)`, ` (3)`.
- Rows:
  - Each row's `values` is `Object.create(null)`, so a `__proto__` header is just data.
  - Values are trimmed strings.
  - Rows where every value is empty are dropped, but the lines of the other rows keep their original numbers.

### 4.4 Test fixtures
Add to `exampleData.js` (types: `columns text[]`, `display_columns text[]`, `data jsonb`):

| id | name | dept | created | by | status | columns | display_columns | items |
|---|---|---|---|---|---|---|---|---|
| f1 `id('f',1)` | IT Laptops Q3 2026 | IT | iso(10) | Allen | active | itemName, serialNumber, assignedTo, location, remarks | itemName, serialNumber, assignedTo, location | 12: `IT-LAP-001…012`; k≤4 scanned by Tess, k=5–6 by Rina, `scanned_at iso(2 - k/10)` |
| f2 | Creative Kit Q3 2026 | Creative | iso(8) | Kim | active | itemName, serialNumber, location | same | 9: `CR-KIT-001…009`; k≤3 scanned by Mark, `iso(1 - k/10)` |
| f3 | IT Phones Q2 2026 | IT | iso(40) | Rina | completed iso(2) by Allen | itemName, assignedTo | same | 6: `IT-PH-001…006`; k≤5 scanned by Tess, `iso(5 + k/10)` |
| f4 | IT Laptops Q1 2026 | IT | iso(120) | Allen | completed iso(30) by Allen → **archived** | itemName, serialNumber | same | 4: `IT-LAP-001…004` (same codes as f1, I6); all scanned by Rina, `iso(35 + k/10)` |

- Item ids: `id('f', n, 1)` with global n = 1…31 in the order f1, f2, f3, f4.
- f1 data:
  - `itemName = \`${brand} ${model}\`` from `LAPTOPS[(k-1)%6]`
  - `serialNumber = SN-IT-${1000+k}`
  - `assignedTo = NAMES[k-1]`
  - `location = k % 2 ? 'IT Room' : '3F Pod A'`
  - **`remarks` is never set**, so it is an all-empty column.
- f2 data:
  - `itemName` from `['Canon EOS R6','Wacom Intuos Pro','Rode VideoMic','DJI Ronin','Sony A7 IV','Elgato Key Light','Wacom Cintiq 16','GoPro Hero 12','Zoom H6']`
  - `serialNumber = SN-CR-${2000+k}`
  - `location 'Studio'`
- f3 data: `itemName` from `MOBILES[(k-1)%4]` (brand + model), `assignedTo = NAMES[10+k]`.
- f4 data: `itemName` from `LAPTOPS[(k-1)%6]`, `serialNumber = SN-IT-${1000+k}`.
- `insertExampleData` order: departments → profiles → employees → devices → assignments → **sessions all inserted as `status 'active', completed_at null, completed_by null`** → items (in the order above; `seq` is generated) → one completing update:
  ```sql
  update inventory_sessions s set status = 'completed', completed_at = r.completed_at, completed_by = r.completed_by
    from jsonb_to_recordset($1::jsonb) as r(id uuid, completed_at timestamptz, completed_by uuid) where s.id = r.id
  ```
- `seedExampleData` result adds `sessions: 4, items: 31`.
- `removeExampleData`:
  - First `delete from inventory_sessions where id = any($1)` (items cascade), then handouts/devices/employees as today.
  - The profile guard adds `and not exists (select 1 from inventory_sessions s where s.created_by = p.id or s.completed_by = p.id) and not exists (select 1 from session_items i where i.scanned_by = p.id)`.
  - The department guard adds `and not exists (select 1 from inventory_sessions s where s.department_id = d.id)`.
  - Result adds `sessions`.
- `emptyDb`: `truncate table session_items, inventory_sessions, assignments, devices, employees, profiles, departments cascade`.
- `snapshot` adds `sessions` (`select * from inventory_session_summary order by created_at, name`) and `items` (`select * from session_items order by session_id, seq`).
- `server/test/support/api.js` finders:
  - `departmentNamed(fx, name)`, `sessionNamed(fx, name)`
  - `activeSessionIn(fx, deptName)`, `sessionWithStatus(fx, effective)`
  - `itemsOf(fx, sessionId)`, `pendingItemIn(fx, sessionId)`, `scannedItemIn(fx, sessionId)`
- `schema.test.js`: update the view list (G-7).
- `exampleData.test.js`: update result objects; add removal tests.

### 4.5 Tests to write first
`server/test/sessions.test.js` (new):
- Listing:
  - `an admin sees active and completed sessions from every department`
  - `a head sees only their own department`
  - `a scanner sees only their own department`
  - `a scanner with no department sees none`
  - `archived sessions are left out by default and for status=all unless you are an admin`
  - `status=archived lists sessions completed more than 7 days ago, admins only`
  - `each session carries item_count, scanned_count, department_name and effective_status`
  - `an unknown status filter is a 400`
- Creating:
  - `an admin creates a session in any department`
  - `an admin must choose a department`
  - `a head's session goes into their own department`
  - `a head cannot create a session in another department`
  - `a head with no department cannot create a session`
  - `a scanner cannot create sessions`
  - `a blank name is a 400 naming the field`
- Reading:
  - `a scanner cannot open another department's session`
  - `a non-admin cannot open an archived session`
  - `an unknown or malformed id is a 404`
- Completing:
  - `an admin marks a session complete, recording who and when`
  - `completing an already-completed session is refused`
  - `a head cannot mark complete`
  - `a completed session refuses renames and column changes`
- Archiving:
  - `a session reads as archived once completed more than 7 days ago`
  - `a session completed 6 days ago still reads as completed`
- Schema:
  - `the database refuses status completed without completed_at`
  - `display_columns must be a subset of columns`
  - `item codes are unique per session regardless of case, but repeat across sessions`
  - `the database refuses item writes in a completed session` (errcode 55000)

`server/test/sessionImport.test.js` (new):
- `a dry run reports what would be added and writes nothing`
- `commit adds every row with its item code and every other column as data`
- `columns are stored in spreadsheet order and display columns as chosen`
- `uploading again merges new columns after the existing ones`
- `the same code imports into two different sessions`
- `a code already in the session is skipped and its line reported, whatever its case`
- `a code repeated within the file is skipped and its line reported`
- `a row missing its item code is skipped and reported by line`
- `reserved export columns (Scan Status, Scanned At, Scanned By) are ignored`
- `a header named __proto__ is stored as plain data`
- `empty cells are not stored`
- `uploading again adds new items and never overwrites existing ones`
- `a completed session refuses import`
- `a head cannot import into another department's session`
- `a scanner cannot import`
- `rows must be a list of at most 10,000`
- `an upload larger than 5 MB is accepted on the import route` (about 9,000 rows with a padded column, `commit: false`)
- Clear items:
  - `clear requires the word CLEAR`
  - `clear removes every item, resets the columns and keeps the session`
  - `a completed session refuses clear`
  - `a scanner cannot clear`
- `listing a session's items returns data, status and who scanned, in upload order`

Also: append the G2 rows of §1.7 to `permissions.test.js`, and update `exampleData.test.js` (`removal takes out example sessions with their items`, `removal keeps an example department a real session uses`).

Client, `client/src/lib/spreadsheet.test.js` (new):
- `normaliseHeader strips case, spaces, dashes and underscores`
- `findItemCodeColumn matches itemCode, Item Code, item-code, ITEMCODE and item_code`
- `parseSpreadsheet reads an .xlsx into headers and rows with sheet line numbers`
- `parseSpreadsheet reads a .csv`
- `blank rows are dropped but the other rows keep their line numbers`
- `row values are null-prototype objects, so __proto__ is just a column`
- `buildImportPayload drops reserved export columns and the item-code column from data`
- `blank and duplicate headers get readable names`

Client, `client/src/pages/sessions.test.jsx` (new):
- `the Sessions page shows a card per session with status and progress`
- `a scanner sees no New Session or Upload buttons`
- `a scanner without a department is told to ask an admin`
- `an admin creates a session in a chosen department`
- `a head's new session goes into their department without asking`
- `uploading an .xlsx detects the item code column and imports its rows` (build the workbook with `XLSX.utils.aoa_to_sheet` + `XLSX.write(..., { type: 'array' })`)
- `dropping a file onto the zone reads it`
- `a file without an item code column is refused before upload`
- `the column picker decides which columns the item table shows`
- `the import result lists skipped rows by line`
- `Clear All Items stays disabled until CLEAR is typed, then empties the session`
- `Mark Complete closes the session and hides Upload`
- `a completed session shows a read-only notice`

### 4.6 Dependencies
- Client: `npm install --workspace client https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Use the newest version listed at cdn.sheetjs.com if there is one. The npm `xlsx` 0.18.5 has advisories (CVE-2023-30533). Keep papaparse for CSV.

### 4.7 Done when
- An AKM-style `.xlsx` with arbitrary columns uploads into a session, and those columns show in the item table.
- Sessions can be created, listed per department and completed. A completed session refuses every write (server and DB trigger).
- Archive is derived (f4 reads `archived`).
- `db:seed` / `db:seed:remove` tests pass.
- Full server + client suites and the client build are green, with counts reported.

---

## 5. Group 3: Phase 4 (scanning + QR labels)

### 5.1 Migration: `supabase/migrations/20260926000100_scan_events.sql`
```sql
-- AKM Phase 4 - the scan log. Append-only: it feeds "10 most recent scans"
-- and survives Clear Items because it points at the session, not the item.

create table public.scan_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.inventory_sessions (id) on delete cascade,
  item_code   text not null
                constraint scan_events_code_length check (length(item_code) between 1 and 200),
  outcome     text not null
                constraint scan_events_outcome_check
                check (outcome in ('scanned', 'duplicate', 'not_found', 'undone')),
  actor       uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index scan_events_session_created_idx on public.scan_events (session_id, created_at desc);
create index scan_events_actor_idx on public.scan_events (actor);

alter table public.scan_events enable row level security;

-- Nothing is logged against a closed session, not even a "not found".
create trigger scan_events_require_active_session
  before insert on public.scan_events
  for each row execute function public.assert_session_active();

create function public.refuse_scan_event_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'scan_events is append-only';
end
$$;

create trigger scan_events_append_only
  before update on public.scan_events
  for each row execute function public.refuse_scan_event_update();
```

### 5.2 Server
**Modify `server/src/validation.js`**: `export const scanCreate = z.object({ code: z.string({ error: 'Enter an item code.' }).trim().min(1, 'Enter an item code.').max(200, 'That code is too long.') })`.

**New `server/src/services/scans.js`**:
```js
export async function scanItem(db, session, code, actor)
// upsertProfile(db, actor) first. Then in db.transaction:
//   update session_items set scanned_at = now(), scanned_by = $3
//    where session_id = $1 and lower(item_code) = lower($2) and scanned_at is null
//   returning id
//   hit  -> outcome 'scanned', item = toItem(detail row)
//   miss -> select * from session_item_details where session_id = $1 and lower(item_code) = lower($2)
//           found -> 'duplicate' (item carries scanned_by_name, scanned_at); none -> 'not_found', item null
//   insert into scan_events (session_id, item_code, outcome, actor) values ($1, <item.item_code ?? code>, outcome, $3)
// 55000 -> sessionNotActive(session). Returns { outcome, code: item?.item_code ?? code, item }
export async function undoScan(db, session, itemId, actor)
// isUuid guard -> 404 notFound('Item'). In db.transaction:
//   update session_items set scanned_at = null, scanned_by = null
//    where id = $1 and session_id = $2 and scanned_at is not null returning item_code
//   0 rows: item missing in this session -> 404; exists but pending -> conflict('ITEM_NOT_SCANNED', `${code} has not been scanned.`)
//   insert scan_events (..., 'undone', actor). 55000 -> sessionNotActive. Returns toItem(detail row)
export async function listRecentScans(db, session, { limit = 10 })
// select e.id, e.session_id, e.item_code, e.outcome, e.actor, p.full_name as actor_name, e.created_at
//   from scan_events e left join profiles p on p.id = e.actor
//  where e.session_id = $1 order by e.created_at desc, e.id desc limit $2
```

**Modify `server/src/routes/sessions.js`**:

| Method | Path | requireRole | Body / query | Response | Errors |
|---|---|---|---|---|---|
| POST | /:id/scan | ROLES (scope does the gating: admin, head own, scanner own) | `scanCreate` | 200 `{ outcome, code, item }` (all three outcomes are 200) | 400, 403, 404, 409 SESSION_NOT_ACTIVE |
| POST | /:id/items/:itemId/undo | admin | — | 200 Item | 404, 409 ITEM_NOT_SCANNED, 409 SESSION_NOT_ACTIVE |
| GET | /:id/scans | ROLES | `?limit` via `int(…, { min: 1, max: 50, fallback: 10 })` | 200 `[ScanEvent]` | 400, 403, 404 |

Scan and undo use `writableSession(db, id, req.user)`. Recent scans uses `getSessionFor`.

**Docs**: AKM §7 (heads can scan in their own department (D5); camera mode needs HTTPS or localhost; manual mode works everywhere, including handheld scanners).

### 5.3 Client
| File | Change |
|---|---|
| `client/src/api/inventorySessions.js` | `scanItem(id, code)`, `undoScan(id, itemId)`, `listRecentScans(id, params)` |
| `client/src/hooks/useInventorySessions.js` | `useScanItem(sessionId)`, `useUndoScan(sessionId)`: invalidate detail, items, scans and `['dashboard','audit']`. `useRecentScans(sessionId)`. |
| `client/src/components/scanner/ScannerPanel.jsx` (new) | Props `{ session }`. State `{ expanded (default false), mode: 'manual'\|'camera', result, lastDetect: useRef({code, at}) }`. Header button **QR Scanner** with `aria-expanded`. Tabs **Manual** (default) and **Camera** with `role="tablist"` and `aria-selected`. Camera detections are ignored if the same code came within 2000 ms or a request is in flight. Renders `ScanResultBanner` and `RecentScans`. |
| `client/src/components/scanner/ManualScanForm.jsx` (new) | Props `{ onScan(code): Promise, busy }`. Input `aria-label="Item code"`, `autoFocus`, `autoComplete="off"`. Submit on Enter or the **Scan** button; afterwards clear and refocus (ref). |
| `client/src/components/scanner/CameraScanner.jsx` (new) | Props `{ onDetect(code), paused }`. If `!navigator.mediaDevices?.getUserMedia` render "Camera scanning needs a camera and a secure (https) connection. Use Manual mode." and do not import anything. Otherwise `const { BrowserQRCodeReader } = await import('@zxing/browser')`, `decodeFromVideoDevice(undefined, videoRef.current, cb)`, keep `controls`, and `controls.stop()` on unmount (StrictMode-safe). Permission denied → message. |
| `client/src/components/scanner/ScanResultBanner.jsx` (new) | Props `{ result }`. `role="status"`. scanned → green `ok` "<code> scanned."; duplicate → yellow `warn` "<code> was already scanned by <name> on <formatDateTime>."; not_found → red `bad` "<code> is not in this session."; 409/403 errors go through `ErrorBanner`. |
| `client/src/components/scanner/RecentScans.jsx` (new) | Props `{ sessionId }`. `<section aria-label="Recent scans">` list of up to 10: outcome icon + code + actor + time |
| `client/src/components/sessions/SessionItemsTable.jsx` | For admins on an active session, add an actions column: on scanned rows, an **undo** icon button (`title`/`aria-label` "Undo scan of <code>") → `useUndoScan`; toast "<code> is pending again." |
| `client/src/pages/SessionDetailPage.jsx` | Mount `ScannerPanel` above the table when `effective_status === 'active'`. Admin action **Print QR codes** → `/sessions/:id/labels`. |
| `client/src/components/labels/QrLabel.jsx` (new) | Props `{ code, caption }`. `useEffect` → `QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })` → `<img src={'data:image/svg+xml;utf8,' + encodeURIComponent(svg)} alt={code}>`, plus the code in mono and an optional caption. `break-inside-avoid`. |
| `client/src/pages/PrintLabelsPage.jsx` (new) | Route `sessions/:id/labels` (admin via `RequireRole`). Loads the session and items. Header (`print:hidden`): back link and **Print** → `window.print()`. Grid `grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2`. Caption = the first display column's value. |
| `client/src/components/layout/Sidebar.jsx`, `AppLayout.jsx` | Add `print:hidden` to the nav and the mobile bar; add `print:p-0` to main |
| `client/src/components/ui/Icon.jsx` | Add `qr`, `camera`, `undo`, `printer` |
| `client/src/App.jsx` | `sessions/:id/labels` inside `RequireRole roles={['admin']}` |
| `client/src/lib/errors.js` | `ITEM_NOT_SCANNED` fallback |
| `client/src/test/liveDb.js` | Add `scans: []` |

### 5.4 Test fixtures
- `scan_events`, ids `id('f', n, 2)`:
  - One `scanned` event per scanned item (18 in total), with `created_at = scanned_at`, `actor = scanned_by` and `item_code` = the item's code.
  - f1 also gets `duplicate` for `IT-LAP-001` by Tess at `iso(0.5)` and `not_found` for `IT-LAP-999` by Tess at `iso(0.4)`.
  - Total 20 events; f1 has 8.
- Insert them **before** the completing update (G-8).
- `emptyDb`: prepend `scan_events`.
- `snapshot` adds `scans` (`select * from scan_events order by created_at, id`).
- `removeExampleData`: the profile guard adds `and not exists (select 1 from scan_events e where e.actor = p.id)`. Example scans go with their sessions through the cascade.

### 5.5 Tests to write first
`server/test/scanning.test.js` (new):
- `a scan moves an item from pending to scanned and records who`
- `scanning ignores case and surrounding spaces`
- `scanning it again returns duplicate with the original scanner and time`
- `an unknown code returns not_found and changes nothing`
- `two scans of the same code at once give exactly one success and one duplicate`
- `every outcome is logged to scan_events`
- `a head can scan in their own department`
- `a scanner from another department gets 403`
- `scanning a completed session is refused and nothing is logged`
- `recent scans are newest first and limited to 10 by default`
- `recent scans survive Clear Items`
- `an admin undoes a scan: the item is pending again and undone is logged`
- `a head trying to undo gets 403`
- `undoing a pending item is a 409 ITEM_NOT_SCANNED`
- `undoing in a completed session is refused`
- `scan history cannot be edited` (a direct SQL update throws)

Also append the G3 rows of §1.7 to `permissions.test.js`, add the table to the schema RLS check (automatic), and update `exampleData.test.js` if counts are asserted.

`client/src/pages/scanning.test.jsx` (new):
- `the QR Scanner panel expands and starts in Manual mode`
- `Enter in the manual input scans, then clears and refocuses the input`
- `a successful scan shows a green result and marks the row Scanned`
- `an already-scanned code shows a yellow warning naming who scanned it`
- `an unknown code shows a red not-found result`
- `the ten most recent scans are listed under the scanner`
- `the scanner is not offered on a completed session`
- `camera mode explains when no camera is available`
- `only admins see the undo button, and undo returns the item to Pending`
- `Print QR codes renders one labelled QR image per item` (img alt = code)
- `a non-admin opening the labels page is sent home`

### 5.6 Dependencies
`npm install --workspace client qrcode @zxing/browser @zxing/library`:
- `qrcode` (MIT) generates SVG in the browser.
- `@zxing/browser` does camera decoding; its peer is `@zxing/library`. It is loaded lazily.

### 5.7 Done when
- Using only the manual input (the handheld-scanner path), a scanner can scan every item in f1, and the table shows all of them as Scanned.
- Duplicate and not-found show yellow and red.
- An admin can undo; heads and scanners cannot.
- Labels print.
- Suites and build are green, with counts reported.

---

## 6. Group 4: Phases 5 + 7 (Inventory page + audit dashboard)

### 6.1 Migration
None. G2's `session_item_details` and indexes cover this group.

### 6.2 Server
**Modify `server/src/validation.js`**:
```js
export const itemUpdate = z.object({
  item_code: z.string({ error: 'Item code is required.' }).trim()
    .min(1, 'Item code is required.').max(100, 'Keep the item code under 100 characters.').optional(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.null()]), { error: 'data must be an object.' }).optional(),
})
```

**New `server/src/services/items.js`**:
```js
export async function listItems(db, user, { session_id, status, q, page = 1, page_size = 50 })
// scope: ($1::boolean or department_id = $2::uuid); non-admins also: session_effective_status <> 'archived'
// base filters: session_id (isUuid else return empty result), q -> strpos(lower(item_code), lower(q)) > 0
// counts ignore `status`:   select count(*)::int total, count(scanned_at)::int scanned from session_item_details where <base>
// page query adds status:   ... and ($n::text is null or (scanned_at is not null) = ($n = 'scanned'))
//                           order by session_created_at desc, seq limit $x offset $y
// columns: sessions in the filtered set ordered by created_at asc -> union of their `columns` in order,
//          keeping only keys with a non-blank value somewhere in the filtered set (base + status):
//          select distinct e.key from session_item_details i cross join lateral jsonb_each_text(i.data) e
//           where <filters> and btrim(e.value) <> ''
// returns { items: toItem[], columns, counts: { total, scanned, pending }, page, page_size, total: <count with status> }
export async function updateItem(db, id, patch, user)
// select d.*, s.columns as session_columns from session_item_details d join inventory_sessions s on s.id = d.session_id where d.id = $1
// 404 notFound('Item'); assertDepartmentAccess(user, row.department_id); session_effective_status !== 'active' -> SESSION_NOT_ACTIVE (409)
// data keys must be in session_columns -> else invalid({ data: `Unknown column: ${k}` })
// merged = Object.assign(Object.create(null), row.data); for each patch key: text = String(v ?? '').trim(); '' -> delete, >2000 -> 400, else set
// update session_items set item_code = coalesce($2, item_code), data = $3::jsonb where id = $1   (never touches scanned_*)
// 23505 session_items_code_key -> conflict('DUPLICATE_ITEM_CODE', `${code} is already in this session.`, { item_code: 'Already in this session.' })
// 55000 -> SESSION_NOT_ACTIVE
export async function deleteItem(db, id, user)
// load as above; 404; session not active -> 409;
// delete from session_items where id = $1 and exists (select 1 from inventory_sessions s where s.id = session_id and s.status = 'active')
// 0 rows -> 409 SESSION_NOT_ACTIVE; returns { id, item_code }
```

**New `server/src/services/auditDashboard.js`**:
```js
export async function getAuditDashboard(db, user)
// select d.id as department_id, d.name,
//        count(distinct s.id)::int as active_sessions,
//        count(i.id)::int as total, count(i.scanned_at)::int as scanned
//   from departments d
//   left join inventory_sessions s on s.department_id = d.id and s.status = 'active'
//   left join session_items i on i.session_id = s.id
//  where ($1::boolean or d.id = $2::uuid)
//  group by d.id, d.name order by lower(d.name)
// percent = total ? Math.round(scanned * 100 / total) : 0
// returns { departments: rows.length, active_sessions: Σ, items: { total: Σ, scanned: Σ, percent },
//           by_department: [{ department_id, name, active_sessions, total, scanned, percent }] }
```

**New `server/src/routes/items.js`**, mounted with `api.use('/items', itemsRouter({ db }))`:

| Method | Path | requireRole | Body / query | Response | Errors |
|---|---|---|---|---|---|
| GET | /api/items | admin, head | `session_id`, `status` (`oneOf(ITEM_STATUS_FILTERS)`), `q`, `page` (`int` 1–100000, default 1), `page_size` (`int` 1–200, default 50) | 200 `{ items, columns, counts, page, page_size, total }` | 400, 403 |
| PATCH | /api/items/:id | admin, head | `itemUpdate` | 200 Item | 400, 403, 404, 409 DUPLICATE_ITEM_CODE, 409 SESSION_NOT_ACTIVE |
| DELETE | /api/items/:id | admin | — | 200 `{ id, item_code }` | 404, 409 |

**Modify `server/src/routes/reports.js`**: add `router.get('/dashboard/audit', requireRole(...CUSTODY_ROLES), …getAuditDashboard(db, req.user))`. It is distinct from `/dashboard`, which Express matches exactly.

**Docs**: AKM §8 (items in completed or archived sessions are read-only (D4); heads don't see archived items) and §4 (totals cover active sessions only (D6)).

### 6.3 Client
| File | Change |
|---|---|
| `client/src/api/items.js` (new) | `listItems(params)`, `updateItem(id, body)`, `deleteItem(id)` (`method: 'DELETE'`) |
| `client/src/hooks/useItems.js` (new) | `itemKeys = { all: ['items'], list: (p) => ['items','list',p ?? {}] }`. `useItemList(params)` (`placeholderData: keepPreviousData`), `useUpdateItem()`, `useDeleteItem()`: invalidate `['items']`, `['inventory-sessions']`, `['dashboard','audit']` |
| `client/src/api/dashboard.js` / `hooks/useDashboard.js` | `getAuditDashboard()`; `useAuditDashboard()` with key `['dashboard','audit']` |
| `client/src/components/ui/useDialogFocus.js` (new) | Extract Modal's focus-trap/Escape/restore/scroll-lock effect as `useDialogFocus({ open, onClose, panelRef })`. Refactor `Modal.jsx` to use it with no change in behaviour (the `polish.test.jsx` modal tests guard this). |
| `client/src/components/ui/Drawer.jsx` (new) | Props `{ open, onClose, title, children, footer }`. `fixed inset-y-0 right-0 w-full max-w-md` slide-in panel with `role="dialog"`, `aria-modal`, `aria-labelledby`, a close button, and `useDialogFocus`. |
| `client/src/components/ui/StatCard.jsx` (new) | Move StatCard out of DashboardPage. Props `{ label, value, tone, to?, onClick?, active? }`: renders a `<button aria-pressed={active}>` when `onClick` is given, otherwise a Link or div. DashboardPage imports it. |
| `client/src/components/ui/Pagination.jsx` (new) | Props `{ page, pageSize, total, onChange }`: "Page p of n · total items" with Previous / Next buttons |
| `client/src/components/items/EditItemPanel.jsx` (new) | Props `{ item, open, onClose }`. Uses `useInventorySession(item.session_id)` for the full `columns` list. State `{ item_code, data }`. One `Field` per column plus Item Code. **Save Changes** → PATCH; 409 goes on the Item code field; toast "Saved <code>." |
| `client/src/components/items/DeleteItemDialog.jsx` (new) | Props `{ item, open, onClose }`. Modal "Delete <code>? This cannot be undone." with a **Delete** danger button |
| `client/src/components/items/ItemsTable.jsx` (new) | Props `{ items, columns, showSession, profile, onEdit, onDelete, isLoading, error }`. Columns: Item code, Session (if `showSession`; name plus department), each of `columns`, Status, Scanned by, Scanned at, actions. The pencil shows when `canManage(profile, item.department_id) && item.session_effective_status === 'active'`; the trash when `isAdmin(profile)` and active; otherwise a small "Read-only" text. No `sortValue` (the server orders rows). Cells are `whitespace-nowrap`; `DataTable` already scrolls horizontally. |
| `client/src/pages/InventoryPage.jsx` (new) | State `{ sessionId: 'all', status: 'all', q: '', page: 1 }`; reset `page` on filter change. `<select aria-label="Session">` with "All sessions" plus `useSessionList({ status: 'all' })`. StatCards **Total / Scanned / Pending** as buttons that set `status` (`aria-pressed`). `SearchInput` "Search item code…". `ItemsTable` + `Pagination` + `EditItemPanel` + `DeleteItemDialog`. |
| `client/src/components/dashboard/AuditSummary.jsx` (new) | Props `{ data }`. `<section aria-label="Audit progress">`: StatCards Departments, Active sessions, Items, Scanned; an overall `ProgressBar` labelled "Overall scan progress" with a single-string "`43%`"; then a list with one row per department: name, a single-string "`scanned of total scanned`", its percentage and a `ProgressBar`. |
| `client/src/pages/DashboardPage.jsx` | Uses `useAuditDashboard()` and `useDashboard()`. Loading until **both** resolve (G-11). PageHeader "Dashboard", then `AuditSummary`, then the existing custody widgets unchanged inside `<section aria-label="Device custody">`, keeping the "Needs attention" and "Who has what" regions. |
| `client/src/components/layout/Sidebar.jsx` / `App.jsx` | Inventory link and route `inventory` inside `RequireRole roles={CUSTODY_ROLES}` |
| `client/src/components/ui/Icon.jsx` | Add `trash` |
| `client/src/lib/errors.js` | `DUPLICATE_ITEM_CODE` fallback and FIELD_CODES entry |

### 6.4 Test fixtures
No new rows. Expected numbers (from §1.6/§4.4):
- Admin: total 31, scanned 18, pending 13.
- Rina: 18 / 11 / 7.
- f1 only: 12 / 6 / 6, columns `itemName, serialNumber, assignedTo, location` (`remarks` hidden).
- All sessions (admin), column order: `itemName, serialNumber, assignedTo, location`.
- Audit (admin): departments 3, active_sessions 2, items 21 / 9 / 43%. By department: Creative 1 session, 9/3, 33%; Finance 0, 0/0, 0%; IT 1, 12/6, 50%.
- Audit (Rina): departments 1, IT 12/6/50.

### 6.5 Tests to write first
`server/test/items.test.js` (new):
- `an admin sees items from every session with total, scanned and pending counts`
- `a head sees only their own department and no archived items`
- `a scanner gets 403`
- `filtering by session narrows the items and the columns`
- `status=scanned and status=pending partition the items, and counts ignore the status filter`
- `search matches item code case-insensitively`
- `columns come in session order and all-empty columns are hidden`
- `results are paginated with a total`
- `editing changes the code and data but keeps the scan status`
- `a blank value removes that field`
- `a code that collides within the session is a 409 DUPLICATE_ITEM_CODE`
- `a code used in another session is fine`
- `unknown data columns are refused`
- `a head can edit in their own department but not another`
- `items in a completed session cannot be edited`
- `items in an archived session cannot be edited`
- `an admin deletes an item`
- `a head trying to delete gets 403`
- `deleting from a completed session is refused`

`server/test/auditDashboard.test.js` (new):
- `totals cover active sessions only and match the fixtures`
- `lists every department, including one with no sessions`
- `a head's view has only their department`
- `a scanner gets 403`
- `no active sessions reads as zeros, not NaN` (only `truncate table session_items, inventory_sessions cascade`; never profiles, see G-2)
- `completing a session drops it from the totals`

Also append the G4 rows of §1.7 to `permissions.test.js`.

`client/src/pages/inventory.test.jsx` (new):
- `lists every item with one column per imported field`
- `empty columns are hidden`
- `choosing a session hides the Session column`
- `the Pending card filters the table`
- `searching by item code narrows the table`
- `the edit panel slides in and saves a change without changing scan status`
- `a duplicate code shows on the Item code field`
- `items in a completed session have no edit button`
- `admins see a trash icon and deletion asks for confirmation`
- `a head sees no trash icon`
- `the edit panel traps focus and closes on Escape`

`client/src/pages/auditDashboard.test.jsx` (new):
- `the audit section shows departments, active sessions and overall progress`
- `each department has its own progress bar`
- `a head sees only their department`
- `custody widgets still render below the audit section`

The existing `flows.test.jsx` and `polish.test.jsx` dashboard tests must pass unchanged.

### 6.6 Dependencies
None.

### 6.7 Done when
- An admin can find, edit and delete any item across all sessions from one page; heads are limited to their department and to active sessions.
- The Dashboard matches AKM §4, with active-only totals and a per-department breakdown.
- Suites and build are green, with counts reported.

---

## 7. Group 5: Phase 6 (export, archive, session deletion)

### 7.1 Migration
None. `inventory_sessions` → `session_items` / `scan_events` already cascade.

### 7.2 Server
**Modify `server/src/config.js`**: `officeTimeZone: env.OFFICE_TIME_ZONE?.trim() || 'Asia/Manila'`. Validate it with `new Intl.DateTimeFormat('en', { timeZone })`; a RangeError becomes a config error naming the variable.

**Modify `server/src/app.js`**: the signature becomes `createApp({ db, auth, settings = {} })`, and `sessionsRouter({ db, auth, timeZone: settings.officeTimeZone ?? 'Asia/Manila' })`. **`index.js`** passes `settings: { officeTimeZone: config.officeTimeZone }`.

**New `server/src/lib/fileName.js`**: `safeFileName(name)` removes `\ / : * ? " < > |` and control characters, trims, caps at 150 characters and falls back to `session`. `contentDisposition(fileName)` returns `attachment; filename="<ascii fallback>"; filename*=UTF-8''<encodeURIComponent>`.

**New `server/src/services/sessionExport.js`**:
```js
import * as XLSX from 'xlsx'
export function formatOfficeTime(iso, timeZone) // 'YYYY-MM-DD HH:mm' via Intl.DateTimeFormat formatToParts, hourCycle h23
export async function exportSessionWorkbook(db, session, { timeZone })
// items = select * from session_item_details where session_id = $1 order by seq
// header = ['itemCode', ...session.columns, EXPORT_COLUMNS.status, EXPORT_COLUMNS.at, EXPORT_COLUMNS.by]
// row    = [item_code, ...columns.map((c) => item.data[c] ?? ''), scanned ? 'Scanned' : 'Pending',
//           scanned ? formatOfficeTime(scanned_at, tz) : '', scanned_by_name ?? '']
// Every cell is a plain string cell (aoa_to_sheet of strings -> t:'s', never `f`), so a value typed as
// "=HYPERLINK(...)" is shown as text and never evaluated - the xlsx equivalent of exports.js's
// neutralising, without altering the value (so the file re-imports exactly).
// ws['!cols'] widths; book_new + book_append_sheet(wb, ws, 'Items');
// buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true })
// fileName = `${safeFileName(session.name)} - ${YYYY-MM-DD in timeZone}.xlsx`
// returns { buffer, fileName }
```

**Modify `server/src/services/inventorySessions.js`**:
```js
export async function deleteSession(db, auth, id, password, user)
// session = await getSessionFor(db, id, user)          (admin-only route; 404 for unknown)
// const check = user.email ? await auth.signIn(user.email, password) : null
// if (!check || check.user.id !== user.id)
//   throw new AppError(422, 'WRONG_PASSWORD', 'That password is not correct.', { password: 'That password is not correct.' })
//   // Never 401: the client treats 401 as an expired login and would sign the admin out over a typo.
// delete from inventory_sessions where id = $1  (items and scan_events cascade)
// returns { id, name: session.name, items: session.item_count }
```

**Modify `server/src/validation.js`**: `export const sessionDelete = z.object({ password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.') })`.

**Modify `server/src/routes/sessions.js`**. The router now takes `{ db, auth, timeZone }`.

| Method | Path | requireRole | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | /:id/export | admin, head (scoped via `getSessionFor`; archived is admin-only) | — | 200 binary. `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition` from `contentDisposition`, `Cache-Control: no-store` | 403, 404 |
| DELETE | /:id | admin | `sessionDelete` | 200 `{ id, name, items }` | 400, 404, 422 WRONG_PASSWORD, 429 RATE_LIMITED (from `auth.signIn`) |

**`.env.example`**: add `# OFFICE_TIME_ZONE=Asia/Manila   time zone for "Scanned At" in exports`.
**Docs**:
- AKM §12: the exact column list; the time zone.
- AKM §13: the wrong-password behaviour.
- README §8: the xlsx export is the second non-JSON endpoint.

### 7.3 Client
| File | Change |
|---|---|
| `client/src/lib/download.js` (new) | `saveBlob(blob, fileName)` (createObjectURL, hidden anchor, click, revoke) and `exportFileName(name, date = new Date())`, which mirrors `safeFileName` and gives `<name> - YYYY-MM-DD.xlsx` |
| `client/src/api/client.js` | Export `async function errorFrom(response)`: parse the JSON envelope into an `ApiError`, or `ApiError({ status })` |
| `client/src/api/exports.js` | Use `saveBlob` (optional tidy-up; the behaviour stays the same) |
| `client/src/api/inventorySessions.js` | `downloadSessionExport(session)`: `fetchWithAuth('/sessions/'+id+'/export')`; `!ok` → `throw await errorFrom(response)`; `saveBlob(await response.blob(), exportFileName(session.name))`. `deleteSession(id, password)`: `request(..., { method: 'DELETE', body: { password } })` |
| `client/src/hooks/useInventorySessions.js` | `useDeleteSession()` invalidates `['inventory-sessions']`, `['items']`, `['dashboard','audit']` |
| `client/src/components/sessions/DeleteSessionDialog.jsx` (new) | Props `{ session, open, onClose, onDeleted }`. State `{ backedUp: false, downloading, password: '', passwordError, error }`. **Step 1** "Download Excel Backup": once the download succeeds the button turns green (`bg-ok-50 text-ok-700 ring-emerald-200`, check icon, label "Backup downloaded"). **Step 2** `PasswordInput` labelled "Your password". **Delete Session** (danger) stays disabled until `backedUp && password`. WRONG_PASSWORD → inline field error, dialog stays open, user stays signed in. Success → toast "Deleted <name> and its N items." → `onDeleted()`. |
| `client/src/pages/ArchivePage.jsx` (new) | Route `archive` (admin via `RequireRole`). `useSessionList({ status: 'archived' })`. `DataTable`: Name, Department, Completed (date), Items "x of y scanned", actions **Export** and a trash icon (`DeleteSessionDialog`). Empty state: "Nothing archived yet. Sessions move here 7 days after they are completed." |
| `client/src/pages/SessionDetailPage.jsx` | **Export** button (canManage, any status; admin for archived). **Delete** trash (admin) → dialog → `navigate('/sessions')`. |
| `client/src/components/sessions/SessionCard.jsx` | Optional `onDelete` → trash icon button (admin), `aria-label "Delete <name>"` |
| `client/src/pages/SessionsPage.jsx` | Wire `DeleteSessionDialog` for admins |
| `client/src/components/layout/Sidebar.jsx`, `App.jsx` | Archive link and route |
| `client/src/lib/errors.js` | `WRONG_PASSWORD` fallback and FIELD_CODES entry |

### 7.4 Test fixtures
None new. f4 is the archived session and f3 the completed one; f1 has the empty `remarks` column, which the round trip uses.

### 7.5 Tests to write first
In server tests, read binary responses with `.buffer(true).parse((res, cb) => { const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => cb(null, Buffer.concat(c))) })`.

`server/test/sessionExport.test.js` (new):
- `exports an .xlsx attachment named after the session and the date`
- `columns are itemCode, the imported columns in order, then Scan Status, Scanned At, Scanned By`
- `scanned rows carry office-time Scanned At and the scanner's name; pending rows are blank` (set one `scanned_at` to `2026-09-21T07:04:00Z` → `2026-09-21 15:04`)
- `a value that looks like a formula is written as a text cell, never a formula`
- `export then re-import into a new session gives the same items, all pending`
- `an admin can export an archived session`
- `a head exports their own department but not another`
- `a head cannot export an archived session`
- `a scanner cannot export`

`server/test/sessionDelete.test.js` (new):
- `a wrong password deletes nothing and is a 422 WRONG_PASSWORD, never a 401`
- `a missing password is a 400`
- `the right password deletes the session, its items and its scan history`
- `a head gets 403`
- `an unknown session is a 404`
- `an archived session can be deleted`

`server/test/config.test.js` (add): `OFFICE_TIME_ZONE defaults to Asia/Manila and rejects an unknown zone`.

Also append the G5 rows of §1.7 to `permissions.test.js`.

`client/src/pages/archive.test.jsx` (new). Stub `URL.createObjectURL`/`revokeObjectURL` and `HTMLAnchorElement.prototype.click` in `beforeEach` (G-13).
- `the Archive lists only sessions completed more than 7 days ago`
- `Delete Session stays disabled until the backup is downloaded and a password is typed`
- `the backup button turns green after the download`
- `the eye button shows and hides the password`
- `a wrong password shows an inline error, deletes nothing and keeps you signed in`
- `the right password deletes the session and removes it from the list`
- `Export on the session page downloads the workbook`
- `heads see Export but no Delete`
- `the delete dialog opens from the Sessions list, the session page and the Archive`

### 7.6 Dependencies
Server: `npm install --workspace server https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (same version as the client; use the newest on cdn.sheetjs.com).

### 7.7 Done when
- A session completed more than 7 days ago appears in Archive.
- An admin can export it (the file re-imports cleanly) and delete it after a password check.
- A wrong password gives an inline error and never a sign-out.
- Suites and build are green, with counts reported.

---

## 8. Group 6: Phase 8 (office-network restriction + production serving)

### 8.1 Migration
None.

### 8.2 Server
**New `server/src/lib/ipAllowList.js`**:
```js
export function normaliseIp(ip)  // strip IPv6 zone; '::ffff:a.b.c.d' -> 'a.b.c.d'; returns '' if net.isIP() === 0
export function parseAllowList(text)
// comma/whitespace separated entries; each is an IPv4/IPv6 address or CIDR (a.b.c.d/nn, xxxx::/nn)
// builds a net.BlockList (addAddress / addSubnet with 'ipv4' | 'ipv6'); throws Error naming every bad entry
// returns { entries: string[], allows(ip): boolean }  // allows() normalises first; invalid ip -> false
export function parseTrustProxy(value)
// undefined | '' | 'false' -> false; /^\d+$/ -> Number; 'true' -> throw Error('TRUST_PROXY=true lets anyone fake
// their address with X-Forwarded-For. Set the number of proxy hops (usually 1) or the proxy IP.');
// otherwise a comma list where each token is an IP/CIDR or loopback|linklocal|uniquelocal -> string (else throw)
```

**New `server/src/lib/accessRestrictedPage.js`**: `accessRestrictedHtml(ip)` returns a self-contained HTML page:
- Inline CSS; no scripts, forms, links to the app, or external assets.
- `<meta name="robots" content="noindex">`.
- Title and heading "Access Restricted". Text: "AKM is only available on the Adspark office network. Connect to the office Wi-Fi or LAN and try again. If you are in the office and still see this, contact IT."
- "Your address: <escaped ip>".

**New `server/src/middleware/network.js`**: `officeNetworkOnly(allowList)` returns `(req, res, next)`:
- It uses `req.ip`, which honours `trust proxy`.
- Allowed → `next()`.
- Blocked, path starts with `/api/` → `res.status(403).json({ error: { code: 'OFFICE_NETWORK_ONLY', message: 'AKM is only available on the Adspark office network.', details: {} } })`.
- Blocked, any other path → `res.status(403).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).send(accessRestrictedHtml(req.ip))`.

**New `server/src/middleware/securityHeaders.js`**: sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.

**New `server/src/middleware/serveClient.js`**: `serveClient(dir)` returns a Router:
- `express.static(dir, { index: false, maxAge: '1y', immutable: true })`.
- `router.get('/{*path}', …)`: if `path.extname(req.path)` is non-empty, `next()` (a missing asset stays a 404). Otherwise set `Cache-Control: no-cache` and `res.sendFile(path.join(dir, 'index.html'))`.

**Modify `server/src/app.js`**. Order matters:
```js
export function createApp({ db, auth, settings = {} }) {
  const app = express()
  app.disable('x-powered-by')
  if (settings.trustProxy) app.set('trust proxy', settings.trustProxy)   // never `true` (parseTrustProxy refuses it)
  // First, before static files and /api: a blocked visitor gets no bundle and no login form.
  if (settings.allowedIps?.entries.length) app.use(officeNetworkOnly(settings.allowedIps))
  app.use(securityHeaders)
  app.use(<json parser switch from G2>)
  ... api as before ...
  app.use('/api', api)
  if (settings.clientDist) app.use(serveClient(settings.clientDist))
  app.use(errorHandler)
  return app
}
```
Tests that don't pass `settings` keep today's behaviour: no allowlist, no static serving.

**Modify `server/src/config.js`**:
```js
const production = env.NODE_ENV === 'production'
host: env.HOST?.trim() || (production ? '0.0.0.0' : '127.0.0.1'),
production,
allowedIps: parseAllowList(env.ALLOWED_IPS ?? ''),          // throws on bad entries -> readConfig throws
trustProxy: parseTrustProxy(env.TRUST_PROXY),
serveClient: production || env.SERVE_CLIENT === 'true',
tls: both TLS_CERT_FILE and TLS_KEY_FILE ? { certFile, keyFile } : null   // exactly one set -> throw
// fail closed:
if (needAuth && production && config.allowedIps.entries.length === 0) throw new Error(
  'ALLOWED_IPS is empty. In production AKM refuses to start without an office-network allowlist.\n' +
  'Set ALLOWED_IPS in .env to the office public IPs (cloud) or LAN subnet (office server).')
```

**Modify `server/src/index.js`**:
- `CLIENT_DIST = path.resolve(<server/src>, '../../client/dist')`. If `config.serveClient` and `CLIENT_DIST/index.html` is missing → exit with "Run npm run build first."
- `createApp({ db, auth, settings: { allowedIps: config.allowedIps, trustProxy: config.trustProxy, clientDist: config.serveClient ? CLIENT_DIST : null, officeTimeZone: config.officeTimeZone } })`.
- If `config.tls`: `https.createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app).listen(port, host)`. Otherwise `app.listen`.
- Log the scheme, the host, and whether the allowlist is on. When there is no allowlist outside production, print a warning line.

**Modify `.env.example`**, adding a commented section "Production / office network":
- `NODE_ENV=production`
- `ALLOWED_IPS=` with examples `203.0.113.10, 198.51.100.20` (primary + backup ISP, cloud) or `192.168.1.0/24` (office server)
- `TRUST_PROXY=` ("number of reverse-proxy hops, e.g. 1, or the proxy IP. Never true.")
- `SERVE_CLIENT=`
- `TLS_CERT_FILE=`, `TLS_KEY_FILE=`

**Docs**:
- AKM §2 and FAQ: the allowlist lives in `ALLOWED_IPS` in `.env`, not in `middleware.ts`. Restart after editing.
- README gets a new "Running it for the office" section:
  - `npm run build`, then `npm start` with `NODE_ENV=production`.
  - Both D3 recipes: cloud behind Caddy/nginx with `TRUST_PROXY=1` and public IPs; office server with the LAN subnet and TLS via cert files or Caddy's internal CA.
  - HTTPS is required for camera scanning.
- Remove the two README §9 bullets that this group resolves.

### 8.3 Client
No code changes. `npm run build --workspace client` must still produce `client/dist/index.html`.

### 8.4 Test fixtures
None. Tests pass `settings` to `createApp` directly and build a temporary `client/dist` stand-in with `fs.mkdtemp(os.tmpdir())` containing `index.html` and `assets/app.js`.

### 8.5 Tests to write first
`server/test/network.test.js` (new):
- `an allowed IP reaches the API` (`ALLOWED_IPS '127.0.0.1, ::1'`; supertest arrives as `::ffff:127.0.0.1`)
- `a blocked IP gets the Access Restricted page on / with no script or login form`
- `a blocked IP gets a JSON 403 OFFICE_NETWORK_ONLY on /api/*`
- `blocked requests never receive the app bundle` (`/assets/app.js` → 403)
- `a CIDR range matches addresses inside it and not outside` (unit test on `parseAllowList`, v4 and v6)
- `IPv4-mapped IPv6 addresses match IPv4 entries`
- `a spoofed X-Forwarded-For is ignored when no proxy is trusted`
- `with one trusted proxy hop, the client address comes from X-Forwarded-For`
- `the address shown on the blocked page is HTML-escaped`
- `security headers are set on every response`

`server/test/config.test.js` (add):
- `the server refuses to start in production with an empty allowlist`
- `a malformed ALLOWED_IPS entry is named in the error`
- `TRUST_PROXY=true is refused`
- `TRUST_PROXY accepts a hop count or proxy addresses`
- `production binds to 0.0.0.0 unless HOST is set`
- `TLS needs both a cert and a key file`

`server/test/serveClient.test.js` (new):
- `serves the built client and falls back to index.html for app routes`
- `index.html is not cached; hashed assets are`
- `a missing asset is a 404, not index.html`
- `unknown /api routes stay JSON 404s`

### 8.6 Dependencies
None. `net.BlockList` and `https` are built into Node.

### 8.7 Done when
- In production mode with an allowlist, office IPs (or the LAN subnet) get the app and API, everyone else gets only the Access Restricted page or a JSON 403, and a spoofed `X-Forwarded-For` does not get through.
- The server refuses to start in production without `ALLOWED_IPS`.
- Express serves `client/dist`, over HTTPS when cert files are set.
- Docs are updated. Suites and build are green, with counts reported.

---

## HANDOFF: planner -> tdd-guide

### Context
- I read ORCHESTRATION_RULES.md, improvements.md, AKM_User_Documentation.md and the relevant server, client, test-support and migration files.
- This blueprint splits the 8 phases into 6 implementation groups. Each group has exact DDL, service signatures, route tables with roles and zod schemas, client files with props and state, fixture rows with fixed ids, test titles to write first, dependencies and done-when checks.
- Everything follows the existing conventions: thin routes plus `db`-first services, the `parse()`/AppError envelope, the `useTestApi`/`startTestServer` harness, and the `request()`/TanStack hooks pattern.

### Findings
- Existing tests that will break unless handled: `reports.test.js:25` truncates profiles (G-2); `schema.test.js:84` has a fixed view list (G-7); `exampleData.test.js` checks exact result objects (G-6); `flows.test.jsx:346` uses `getByText('40'/'34')` on the Dashboard (G-11). Changing the handout recorders would alter the handout fixtures (G-5).
- Rina and kim must be admin or head because existing tests record and return handouts as them. Allen must be admin.
- `departmentScope` must not use `null` to mean "no filter". A head or scanner without a department would otherwise see everything. I replaced it with a `{ all, departmentId }` object and a fixed SQL pattern.
- A DB trigger (`assert_session_active`, with `FOR SHARE`) makes D4 (completed means read-only) a database guarantee. It forces a specific fixture insertion order (G-8).
- The global 5 MB JSON limit blocks large sheets. A per-path parser switch fixes this (G-10).
- jsdom limits dictate the approach: FileReader instead of `File.arrayBuffer`, SVG QR codes instead of canvas, a lazily loaded camera library, and stubbed object URLs (G-13).

### Files Modified
None. The planner has read-only tools. The orchestrator saves this blueprint to `docs/superpowers/plans/2026-09-23-akm-implementation.md`.

### Test Results (exact counts)
Not run. I have no shell, so there is no baseline count; the first implementer should record the pre-change server and client pass counts.

### Open Questions
1. `SUPABASE_SERVICE_ROLE_KEY` is **required** at server start (fail loudly). The alternative is optional, with Register returning 503. Required means the human must update `.env` before the next `npm start`.
2. Archived sessions are admin-only (§1.3), based on the matrix row "Archive page: Admin". Heads and scanners don't see archived sessions or their items. Please confirm.
3. The xlsx export neutralises formulas by writing every cell as a typed string cell instead of adding a leading `'`, so export → re-import is exact. This deviates from the letter of "keep exports.js neutralising".
4. Clear Items also resets `columns` and `display_columns`, so the next file starts clean. AKM only says the session and scan history are kept.
5. A single guarded UPDATE enforces the last-admin guard. Two admins demoting each other at the same instant could still leave none (low risk).
6. Other-department resources return 403 rather than 404, which confirms that an id exists (low risk: UUIDs, internal app).
7. `not_found` and `duplicate` scans return 200 with an `outcome`, not 404 or 409.
8. The example department names (IT, Creative, Finance) make `db:seed` refuse if a real department already has one of those names. That matches the existing all-or-nothing behaviour.
9. Deactivating or deleting users is out of scope. Password resets stay in Supabase.
10. The office time zone defaults to Asia/Manila (`OFFICE_TIME_ZONE`).

### Recommendations
- Implement the groups strictly in order. After each group, run both suites and the client build and report exact counts.
- Grow `server/test/permissions.test.js` in every group from the §1.7 table. It is the single regression net for the matrix.
- Code reviewer should focus on: `requireRole` running before `parse()` on every route; every scoped query using `($1::boolean or department_id = $2::uuid)`; `assertSessionWritable` on every item write; no `seq`/bigint in JSON; `Object.create(null)` for spreadsheet rows on both client and server.
- Security reviewer should focus on:
  - `loadProfile` reads role from `profiles`, never from the token.
  - The service-role key is server-only and never logged; admin API failures are never 401.
  - WRONG_PASSWORD is 422.
  - Import size, row and cell caps, and `__proto__` handling.
  - xlsx cells are never formulas.
  - trust proxy is never `true`; IPv4-mapped addresses are normalised; the blocked page escapes the IP; the allowlist middleware comes before static files and `/api`.
  - Production fails closed when the allowlist is empty.
---

# Appendix A — Architect review (binding adjustments)


These OVERRIDE improvements.md wherever they conflict. Section letters (A1, B2, …) are referenced from the build plan.

## Resolved open questions (orchestrator decisions)
- OQ1 Deactivation: YES, minimal. `profiles.disabled_at timestamptz` (Group 1). Admin "Deactivate/Reactivate" on Users page.
  loadProfile returns 403 `ACCOUNT_DISABLED` for disabled users; POST /auth/login also refuses them (403 ACCOUNT_DISABLED,
  checked after a successful signIn); the client signs out on that code. An admin cannot deactivate themselves; the
  last-admin guard counts only enabled admins.
- OQ2 Password change/reset: OUT OF SCOPE (document: reset in Supabase dashboard). Record as follow-up.
- OQ3 Reopen completed session: OUT OF SCOPE (follow-up). Mark Complete dialog must warn with the pending-item count.
- OQ4 Heads may see their own department's archived sessions via the API (`?status=archived`) and on Inventory. The
  Archive PAGE stays admin-only. Scanners see non-archived sessions only.
- OQ5 SUPABASE_SERVICE_ROLE_KEY is OPTIONAL in readConfig; startup warning when missing; Register returns 503
  `REGISTRATION_UNAVAILABLE`.
- OQ6 `GET /api/health` is exempt from the office-network allowlist (it returns only "ok"). Document it.
- OQ7 `OFFICE_TIME_ZONE` env, default `Asia/Manila`.
- OQ8 App rename: OUT OF SCOPE (keep "Device Handout Tracker" branding; follow-up).
- OQ9 Scan outcomes (scanned / duplicate / not_found) are 200 with `{ data: { outcome, item, scanned_by_name, scanned_at } }`.

## A. Data model
- A1 Per-session uniqueness is an expression index, not a table constraint:
  `create unique index session_items_code_key on public.session_items (session_id, lower(item_code));`
  PATCH maps `isUniqueViolation(err, 'session_items_code_key')` → 409 `DUPLICATE_ITEM_CODE`.
- A2 `session_items.position integer not null` = session max(position) + ordinality, computed inside the import
  transaction. Index `(session_id, position)`. Every list + the export orders by position.
- A3 `item_code text not null check (item_code = btrim(item_code) and length(item_code) between 1 and 128)`;
  `data jsonb not null default '{}' check (jsonb_typeof(data) = 'object')`. Store only non-empty string values (drop
  empty keys on import/edit), so "column has a value" == "key exists" → hidden-empty-columns is one
  `jsonb_object_keys` query over the whole filtered set. Keep scanned_at/scanned_by pair check + (session_id, scanned_at) index.
- A4 `columns` excludes the item-code column; server-owned. Re-import merges: existing columns first, then new
  headers in file order; a header equal ignoring case to an existing column reuses the existing spelling.
  `display_columns text[]` nullable; null = show all (incl. future). `check (display_columns is null or display_columns <@ columns)`,
  `check (cardinality(columns) <= 100)`. Clear Items resets `columns='{}'`, `display_columns=null`.
- A5 `PATCH /api/sessions/:id` whitelists `name`, `display_columns` only. department_id immutable; status only via /complete.
- A6 No DELETE for departments; FKs to departments `on delete restrict`. Profiles never deleted by app;
  scanned_by/actor/created_by/completed_by → profiles default NO ACTION (NOT set null). session_items + scan_events
  cascade from inventory_sessions; optional `scan_events.item_id ... on delete set null` so Clear keeps history.
  Indexes: profiles(department_id), inventory_sessions(department_id, status), scan_events(session_id, created_at desc).
  Optional `check (role <> 'head' or department_id is not null)`.
- A7 Department change mid-session → next request 403; past scans keep attribution. Test it. ScannerPanel handles 403
  with "You no longer have access to this session" and refetches /me.
- A8 `inventory_session_summary` view: explicit column list; `effective_status = case when s.status='completed' and
  s.completed_at <= now() - interval '7 days' then 'archived' else s.status end`; plus department_name, item_count,
  scanned_count via left join lateral. security_invoker. WRITES never go through the view: assertSessionWritable
  checks the BASE TABLE `status = 'active'`. Fixtures use 6 and 8 days, never exactly 7.
- A9 Caps: 100 columns, header ≤100 chars, cell ≤1000 chars, ≤10,000 rows per import.
- A10 `check (status = 'active' or completed_by is not null)`; completed fixtures need completed_by.

## B. Authorization
- B1 CRITICAL: never "null means all departments". Use:
  ```js
  export const departmentScope = (user) =>
    user.role === 'admin' ? { all: true, departmentId: null } : { all: false, departmentId: user.department_id ?? null }
  // SQL: where ($1::boolean or s.department_id = $2::uuid)   -- null departmentId matches nothing
  export const canAccessDepartment = (user, id) =>
    user.role === 'admin' || (user.department_id != null && user.department_id === id)
  ```
  Test: scanner/head with no department get empty lists and 403 on by-id reads/writes.
- B2 Gate per mount: `const staff = requireRole('admin','head')`; `api.use('/devices', staff, devicesRouter(...))` etc.
  reportsRouter is mounted at the API root → put `staff` on EACH route inside it (never `router.use`/`api.use` gates
  that leak onto later routers). `signedIn = [requireAuth(auth), loadProfile(db)]`, passed to authRouter too so /me has
  role. Order: 401 (requireAuth) → loadProfile → 403 (requireRole). New routers mounted before the 404 catch-all.
- B3 loadProfile: `select role, department_id, disabled_at from profiles where id=$1`; no row → `insert ... on conflict (id) do nothing`
  and treat as scanner/no department. Don't reuse upsertProfile+RETURNING (ON CONFLICT DO UPDATE ... WHERE returns no row when WHERE false).
- B4 Fixtures: EXAMPLE_STAFF gains role + department_id: Allen admin, Rina head of dept A, Kim head of dept B; add
  scanner staff: one in A, one in B, one with no department. Insert departments before profiles. Handout recorders
  (exampleData `EXAMPLE_STAFF[seq % length]`) must stay the first three custody-capable staff only.
- B5 Client role ONLY from `GET /api/auth/me` → `{ id, email, full_name, role, department: {id,name}|null }`.
  TanStack query ['me'], enabled when signed in, staleTime ~60s, refetchOnWindowFocus true (main.jsx disables it globally),
  refetch on any 403 (QueryCache onError). RequireRole shows loading until me resolves (no redirect flash). Index route
  sends scanners to /sessions. `queryClient.clear()` on sign-in and sign-out.
- B6 Last-admin guard: in db.transaction, `select id from profiles where role='admin' and disabled_at is null for update`, refuse 409 `LAST_ADMIN`.
- B7 Document: seeded example profiles become admins via backfill if db:seed was run in prod; db:seed:remove deletes them.
- B8 No-department users: explanatory empty state on Sessions. Head w/o dept keeps custody pages; POST /sessions → 403
  `NO_DEPARTMENT`. Register requires department for head/scanner (zod refine); optional/ignored for admin.
- B10 Document: heads see company-wide custody data (employees.department is free text).
- B11 Embed department_name in session payloads and /me, so GET /departments can stay admin-only (but see plan: a
  lightweight list may be needed for the New Session picker — admin only anyway).

## C. Registration
- C1 `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`.
- C2 Separate service-role client used ONLY for auth.admin.*; never `.from()`; never VITE_ prefixed. Optional config (OQ5).
  Fix .env.example wording + README.
- C3 createUser error mapping (not rejectedOrThrow): 422 email_exists/user_already_exists → 409 `DUPLICATE_EMAIL`;
  weak_password/400 → 400 {password}; 429 → 429 RATE_LIMITED; else 503 AUTH_UNAVAILABLE. Zod: email EMAIL_RE,
  password min 8 max 72, role enum, department_id uuid required unless admin.
- C4 Order: validate → check department exists → createUser → upsert profile (`on conflict (id) do update set role,
  department_id, email, full_name`) → on failure try `auth.admin.deleteUser(id)`, log both, rethrow.
- C5 Fake auth: createUser (updates maps so the user can sign in; duplicate → same 409), deleteUser, reset() called
  from useTestApi beforeEach and testServer.reset(), plus a failure switch to test compensation.
- C7 Document: Supabase per-IP sign-in rate limit is shared by the whole office via the server's IP.

## D. Scanning
- D1 Two statements under READ COMMITTED inside one db.transaction using the `tx` handle for EVERY call (calling outer
  db inside deadlocks PGlite): UPDATE ... WHERE scanned_at IS NULL RETURNING; if none, SELECT to classify duplicate vs
  not_found; if SELECT finds it still pending (undo/clear race) retry the update once. Normalise in JS: strip control
  chars (\r \t GS 0x1D etc.), trim, length 1–128. Order: 403 department → 409 `SESSION_NOT_ACTIVE`.
- D2 Add `GET /api/sessions/:id/items?status=&q=&page=` for every role with department access, paginated, ordered by position.
- D3 Scanner input never disabled; clear+refocus immediately; one mutation per Enter; update item in cache with
  setQueryData; refetch only the small recent-scans query.
- D4 Undo: `update ... set scanned_at=null, scanned_by=null where id=$item and session_id=$session and scanned_at is not null`;
  0 rows → 409 `ITEM_NOT_SCANNED` (404 if item not in session). Session active. Log `undone`.
- D5 scan_events uuid PK; outcomes may include 'cleared' and 'deleted' for audit.
- D6 Prefer `@zxing/browser` (or `barcode-detector` ponyfill) over unmaintained html5-qrcode; dynamic `import()` for
  camera lib, qrcode and SheetJS; stop the camera stream on collapse/unmount; camera code isolated, test manual path.

## E. Import / export
- E1 Register `app.use('/api/sessions/:id/import', express.json({ limit: '20mb' }))` BEFORE the global 5mb parser.
  Payload `{ columns, rows: string[][], lines: number[], display_columns?, commit }` (array rows aligned to columns;
  server builds data with Object.fromEntries — no __proto__ hazards). Zod caps 10k rows / 100 cols / 1000 chars. No chunking.
- E2 Commit path in db.transaction: `select ... from inventory_sessions where id=$1 for update` → re-check active →
  merge columns + compute positions → insert ON CONFLICT DO NOTHING + reportLostRaces → update columns/display_columns.
  Dry run takes no lock. Clear Items: lock, check, delete items, reset columns, log 'cleared'.
- E3 SheetJS client parsing: `XLSX.read(buf, { type:'array', cellDates:true })`, first sheet (say so in UI),
  `sheet_to_json(ws, { header:1, raw:true, defval:'' })`. Numeric codes: use formatted text (cell.w) unless it's in
  exponent form, then String(v); dates → YYYY-MM-DD. Keep original line numbers; silently drop all-empty rows.
  Headers: trim; blank header over data → "Column N"; duplicate → "Name (2)"; exactly one header must normalise to
  `itemcode` (clear error for none/several); reserved export headers (Scan Status, Scanned At, Scanned By) dropped AND
  listed in the preview. Pure parser over ArrayBuffer (jsdom File lacks arrayBuffer(); component uses FileReader).
  Tests: text "00123", number 123 formatted "00000", a 16-digit number.
- E4 xlsx export: every cell explicit `{ t:'s', v:text }`, never `f`, NO apostrophe prefix (that's CSV-only). Round-trip
  test includes values starting with = + - @.
- E5 Fixed sheet name "Items". Sanitised Content-Disposition (strip CR/LF, quotes, slashes; ASCII fallback +
  filename*=UTF-8''). Scanned At as text in OFFICE_TIME_ZONE via Intl.DateTimeFormat. Order by position. Scanned By =
  full_name fallback email. Round-trip test in the CLIENT suite (real server + real parser).
- E6 PATCH /api/items/:id: data keys must be in session.columns; values strings ≤1000; empty removes key; item_code
  normalised like import; 23505 on session_items_code_key → 409; session active + department; never touches scan fields.
- E7 DataTable keys for data columns: `data:${name}` reading item.data[name].

## F. Session deletion
- F1 Wrong password → 422 `WRONG_PASSWORD` (not 401, not 403).
- F2 In-memory per-user failure limiter: 5 failures / 15 min → 429 `TOO_MANY_ATTEMPTS` before calling Supabase.
- F3 Order: admin → uuid/404 → limiter → password → delete (cascade) → 204. JSON body on DELETE. Add `delete` to the
  supertest helper. Never log bodies. Allowed at any status; backup step is UI-only.

## G. Phase 8
- G1 Normalise IP: strip zone id, unwrap `::ffff:a.b.c.d`, `net.isIP`, always pass family to BlockList.check. Parse
  ALLOWED_IPS at startup with addAddress/addSubnet + explicit family; validate prefix lengths; throw on invalid.
- G2 Fail closed when HOST is not loopback: readConfig throws unless ALLOWED_IPS non-empty and TRUST_PROXY valid.
  createApp default (tests) = no restriction. NEVER auto-allow loopback.
- G3 TRUST_PROXY: hop count /^\d+$/ → Number, or comma list of IPs/CIDRs/'loopback'. Reject 'true'. Tests with trust
  proxy 'loopback' + X-Forwarded-For; spoofed XFF ignored when unset.
- G4 Express 5: `app.get('/{*splat}', ...)` (not '*'). Order: officeNetworkOnly → import json parser → global json
  parser → /api (own 404) → express.static(dist) (long cache for /assets) → index.html fallback (Cache-Control: no-cache)
  → missing /assets/* gets 404 not index.html. Headers: nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer,
  Permissions-Policy camera=(self).
- G5 Blocked: Cache-Control no-store; /api/* JSON 403 `OFFICE_NETWORK_ONLY`; else static Access Restricted page.
  officeNetworkOnly before JSON parsers. /api/health exempt (OQ6).
- G6/G7 Document: static IPs needed, publish A record only (or add IPv6 prefix), LAN HTTPS via real hostname
  (Caddy DNS-01), TRUST_PROXY=loopback behind local proxy; run db:migrate before new code; migrations can't use
  `concurrently` or their own transactions.

## H. Existing-suite breakers & example data
- H1 Update: schema.test.js exact view list; emptyDb truncates departments, inventory_sessions, session_items,
  scan_events; exampleData.test.js exact result shapes; auth.test.js 401 route list gets the new routes.
- H2 Example ids must be hex: kind prefixes a,c,d,e used → use b (departments), f (sessions), 1 (items), 2 (scan
  events). Example department names suffixed " (example)" and added to the seed clash check. Removal order: sessions
  (cascade) → profiles → departments, each guarded by `not exists` for real referencing rows; extend the profile guard
  to scan_events.actor, scanned_by, created_by, completed_by. Note "already loaded" is detected by devices only.
- H4 Role wrappers go in App.jsx routes, not inside pages (page tests render pages directly).
- H5 isUuid-check every :id and body id (else 22P02 → 500); check department exists before insert (else 23503 → 500).
