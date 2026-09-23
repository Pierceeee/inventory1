# Device Handout Tracker — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every screen in §7 of the spec as a working, clickable React app backed by a Mock Service Worker layer that enforces the §5 business rules, so the UI can be reviewed and corrected before any backend exists.

**Architecture:** React 19 + Vite, React Router for the eight routes, TanStack Query for all server state. Components call `fetch` through a thin `api/` wrapper; MSW intercepts those calls at the network boundary and answers from an in-memory store. No component, hook, or `api/` module contains mock-aware branching — the mock is invisible from above. Layout follows AKM's conventions: fixed left sidebar, page header, content area.

**Tech Stack:** React 19, Vite 6, React Router 7, TanStack Query 5, Tailwind CSS 4, MSW 2, Vitest, React Testing Library, PapaParse.

**Spec:** [`docs/superpowers/specs/2026-09-23-device-handout-tracker-design.md`](../specs/2026-09-23-device-handout-tracker-design.md)

**Scope:** FE-1 through FE-5 only. This plan ends at the REVIEW GATE in §10. BE-1…BE-7 and the cutover get their own plan, written after the gate.

## Global Constraints

- **Contract is fixed.** Every request and response must match §6 of the spec exactly. If a screen seems to need a field or endpoint that §6 does not define, stop and raise it — do not invent an endpoint.
- **Success envelope:** `{ "data": ... }`. **Error envelope:** `{ "error": { "code", "message", "details" } }`. Every handler and every API wrapper uses these, no exceptions.
- **No mock-aware code above `src/mocks/`.** Nothing in `pages/`, `components/`, `hooks/`, or `api/` may import from `mocks/` or branch on whether the mock is running. The single exception is `src/main.jsx`, which starts the worker in dev. This is what makes the cutover a deletion.
- **`src/mocks/rules.js` is disposable.** It duplicates §5 deliberately and is deleted at cutover. Keep it as pure functions with no I/O so it stays cheap to read and throw away.
- **`issued_at` is the point of the system.** It is always stored and transmitted as a UTC ISO 8601 string. It is always displayed in the viewer's local timezone. Never do naive string slicing on a timestamp.
- **Device `status` is lifecycle only** — `available` | `repair` | `retired`. "Issued" is never a stored status; it is derived from an open assignment. No code may write `status: 'issued'`.
- **JavaScript, not TypeScript**, per the spec's stack table. `.jsx` for components, `.js` for everything else.
- **Tailwind 4** uses CSS-first config: `@import "tailwindcss"` plus `@theme`, and the `@tailwindcss/vite` plugin. There is no `tailwind.config.js`.
- **Commit after every task.** No AI attribution lines in commit messages.

## Review Focus

These are the failure modes the spec implies but that a naive reading of the tasks would not exercise. Each one has its test assigned to the task that owns the code.

1. **Timezone round-trip on `issued_at`.** A handout recorded at 09:00 Manila time must read back as 09:00, not 01:00. The `datetime-local` input speaks local time; the API speaks UTC. Pinned in Task 4 (`lib/format.js` round-trip tests) and Task 13 (the issue dialog submits the right instant).
2. **A device that has history but is currently free.** After a return, the device is `available` yet its detail page must still show the full past history and must not render a holder card. Pinned in Task 8.
3. **A resigned employee who still holds devices.** Resignation does not auto-close assignments, so this state is reachable and normal at offboarding. The employee detail page must list those devices, and issuing anything further to that employee must be refused. Pinned in Task 11 and Task 12.
4. **Case-insensitive, partial, whitespace-padded search.** Typing `asp-42` or ` 0042 ` must find `ASP-0042`. Pinned in Task 3 (the handler's matching) and Task 6 (the UI passes the raw query through).
5. **Empty and filtered-to-nothing states.** Zero devices, a filter combination matching nothing, an employee holding nothing, a device with no history. Each must render a readable empty state rather than a bare table head. Pinned in Task 6, Task 8, and Task 11.

---

## File Structure

Split by feature, not by technical layer — the files that change together live together. Each file has one job.

```
inventory/
├── package.json                    npm workspaces root; scripts delegate to client
└── client/
    ├── package.json
    ├── vite.config.js              react + tailwind plugins
    ├── vitest.config.js            jsdom, setup file
    ├── index.html
    └── src/
        ├── main.jsx                entry: starts MSW in dev, mounts QueryClient + Router
        ├── App.jsx                 route table only
        ├── index.css               tailwind import + @theme tokens
        │
        ├── lib/
        │   ├── format.js           pure: UTC ISO <-> datetime-local, display formatting
        │   └── errors.js           ApiError class + error code -> human message map
        │
        ├── api/
        │   ├── client.js           fetch wrapper; unwraps {data}, throws ApiError on {error}
        │   ├── devices.js          listDevices, getDevice, createDevice, updateDevice, retireDevice
        │   ├── employees.js        listEmployees, getEmployee, createEmployee, updateEmployee, resignEmployee
        │   ├── assignments.js      listAssignments, issueDevice, returnDevice
        │   ├── dashboard.js        getDashboard
        │   └── imports.js          importDevices, importEmployees
        │
        ├── hooks/
        │   ├── useDevices.js       query + mutation hooks, cache invalidation
        │   ├── useEmployees.js
        │   ├── useAssignments.js
        │   └── useDashboard.js
        │
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.jsx   sidebar + header + <Outlet/>
        │   │   ├── Sidebar.jsx     nav links, active state
        │   │   └── PageHeader.jsx  title + action slot
        │   ├── ui/
        │   │   ├── Button.jsx      variants: primary, secondary, danger
        │   │   ├── Field.jsx       label + input/select + error text
        │   │   ├── Modal.jsx       focus trap, escape to close
        │   │   ├── DataTable.jsx   columns + rows + empty state
        │   │   ├── FilterChips.jsx single-select chip group
        │   │   ├── SearchInput.jsx debounced text input
        │   │   ├── StatusBadge.jsx colored pill for device/employee status
        │   │   └── ErrorBanner.jsx renders an ApiError readably
        │   ├── devices/
        │   │   ├── DeviceTable.jsx
        │   │   └── DeviceForm.jsx  add + edit, same component
        │   ├── employees/
        │   │   ├── EmployeeTable.jsx
        │   │   └── EmployeeForm.jsx
        │   ├── handouts/
        │   │   ├── IssueDialog.jsx      editable issued_at, same-type inline confirm
        │   │   ├── ReturnDialog.jsx     reason + returned_at
        │   │   ├── ResignDialog.jsx     lists every device still held
        │   │   └── HistoryTimeline.jsx  shared by device + employee detail
        │   └── imports/
        │       ├── ColumnMapper.jsx
        │       └── ImportPreview.jsx
        │
        ├── pages/
        │   ├── DashboardPage.jsx
        │   ├── DevicesPage.jsx
        │   ├── DeviceDetailPage.jsx
        │   ├── EmployeesPage.jsx
        │   ├── EmployeeDetailPage.jsx
        │   ├── HandoutsPage.jsx
        │   ├── ImportPage.jsx
        │   └── LoginPage.jsx
        │
        ├── mocks/                  DELETED AT CUTOVER
        │   ├── db.js               in-memory arrays + query helpers
        │   ├── rules.js            §5, pure functions, disposable
        │   ├── handlers.js         every route in §6
        │   ├── seed.js             Adspark-shaped fixture data
        │   ├── browser.js          setupWorker for dev
        │   └── server.js           setupServer for tests
        │
        └── test/
            ├── setup.js           starts MSW server, resets db between tests
            └── renderWithProviders.jsx   QueryClient + MemoryRouter wrapper
```

### Data shapes the whole plan depends on

Every task uses these. They mirror §4 of the spec plus the `device_current_holder` view.

```js
// Device as returned by the API — `current_holder` comes from the view
{
  id: "uuid", asset_tag: "ASP-0042", type: "laptop",
  brand: "Apple", model: "MacBook Air M2", serial_number: "C02X1234",
  os: "macos", status: "available",          // lifecycle only, never "issued"
  notes: null, created_at: "ISO", updated_at: "ISO",
  current_holder: null | {
    assignment_id: "uuid", employee_id: "uuid",
    full_name: "Maria Santos", issued_at: "ISO"
  }
}

// Employee
{
  id: "uuid", full_name: "Maria Santos", email: "maria@adspark.ph",
  department: "Creative", status: "active",   // "active" | "resigned"
  resigned_at: null, created_at: "ISO", updated_at: "ISO"
}

// Assignment — denormalized with both names so lists need no joins client-side
{
  id: "uuid", device_id: "uuid", employee_id: "uuid",
  asset_tag: "ASP-0042", device_model: "MacBook Air M2", device_type: "laptop",
  employee_name: "Maria Santos",
  issued_at: "ISO", issued_by: null,
  returned_at: null | "ISO", returned_by: null,
  return_reason: null | "resignation"|"swap"|"repair"|"lost"|"other",
  notes: null, created_at: "ISO"
}
```

### Error codes

Produced by `mocks/rules.js`, mapped to prose by `lib/errors.js`, and later reproduced by the real backend.

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | A field failed validation; `details` names the fields |
| `NOT_FOUND` | 404 | No such device, employee, or assignment |
| `DUPLICATE_ASSET_TAG` | 409 | Asset tag already in use |
| `DUPLICATE_SERIAL` | 409 | Serial number already in use |
| `DUPLICATE_EMAIL` | 409 | Employee email already in use |
| `DEVICE_ALREADY_ISSUED` | 409 | Open assignment exists; `details.holder_name` names them |
| `DEVICE_RETIRED` | 409 | Device is retired |
| `DEVICE_IN_REPAIR` | 409 | Device is in repair |
| `EMPLOYEE_RESIGNED` | 409 | Employee has resigned |
| `ASSIGNMENT_ALREADY_RETURNED` | 409 | Assignment is already closed |

One warning, returned **inside a 201 body**, never as an error:

| Code | Where | Meaning |
|---|---|---|
| `SAME_TYPE_ALREADY_HELD` | `POST /api/assignments` 201 `warning` | Employee already holds a device of this type. Allowed. |

---

# FE-1 — App shell

## Task 1: Monorepo, Vite, Tailwind, and the test harness

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`
- Create: `client/package.json`, `client/vite.config.js`, `client/vitest.config.js`, `client/index.html`
- Create: `client/src/main.jsx`, `client/src/App.jsx`, `client/src/index.css`
- Create: `client/src/test/setup.js`
- Test: `client/src/App.test.jsx`

**Interfaces:**
- Consumes: nothing — this is the first task.
- Produces: a working `npm run dev` and `npm test` from the repo root. `App` is the default export of `App.jsx`.

- [ ] **Step 1: Create the workspace root**

`package.json`:

```json
{
  "name": "inventory",
  "private": true,
  "type": "module",
  "workspaces": ["client"],
  "scripts": {
    "dev": "npm run dev --workspace client",
    "build": "npm run build --workspace client",
    "test": "npm run test --workspace client",
    "test:watch": "npm run test:watch --workspace client"
  }
}
```

`.gitignore`:

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
```

`.env.example`:

```
# Frontend phases run entirely against MSW; no real API is needed yet.
# Leave unset to use the same-origin default.
VITE_API_BASE_URL=
```

- [ ] **Step 2: Create the client package**

```bash
mkdir -p client/src/test
```

`client/package.json`:

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@tanstack/react-query": "^5.60.0",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.6.0",
    "msw": "^2.6.0"
  }
}
```

- [ ] **Step 3: Install and initialise the MSW service worker file**

```bash
npm install
npx --workspace client msw init client/public --save
```

Expected: `client/public/mockServiceWorker.js` is created. This file is generated, not hand-edited, and it **does** get committed.

- [ ] **Step 4: Configure Vite and Vitest**

`client/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
})
```

`client/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
```

`client/src/test/setup.js` — MSW gets wired in here in Task 3; for now just the DOM matchers:

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Write the design tokens and entry files**

`client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Device Handout Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`client/src/index.css` — AKM-adjacent palette: slate neutrals, indigo primary:

```css
@import "tailwindcss";

@theme {
  --color-brand-50:  #eef2ff;
  --color-brand-100: #e0e7ff;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;

  --color-ok-50:   #ecfdf5;
  --color-ok-700:  #047857;
  --color-warn-50: #fffbeb;
  --color-warn-700:#b45309;
  --color-bad-50:  #fef2f2;
  --color-bad-700: #b91c1c;
}

html, body, #root { height: 100%; }
body { @apply bg-slate-50 text-slate-900 antialiased; }
```

`client/src/App.jsx` — routes arrive in Task 5; a placeholder for now:

```jsx
export default function App() {
  return <h1 className="p-8 text-2xl font-semibold">Device Handout Tracker</h1>
}
```

`client/src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Write the failing smoke test**

`client/src/App.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

test('renders the application title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Device Handout Tracker' })).toBeInTheDocument()
})
```

- [ ] **Step 7: Run the test**

Run: `npm test`
Expected: PASS, 1 test. If it fails on a missing module, the install in Step 3 did not complete.

- [ ] **Step 8: Verify the dev server boots**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:5173` and the page shows the heading on a light slate background. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold client workspace with vite, tailwind, and vitest"
```

---

## Task 2: The mock store and the §5 rules

The rules are pure functions over plain data with no I/O, which makes them the easiest thing in this plan to test and the easiest to delete later. Test them directly — not through HTTP.

**Files:**
- Create: `client/src/mocks/db.js`, `client/src/mocks/rules.js`, `client/src/mocks/seed.js`
- Test: `client/src/mocks/rules.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `db` — `{ devices: [], employees: [], assignments: [] }` mutable module singleton
  - `resetDb()` — restores the seed, used by tests between cases
  - `openAssignmentFor(deviceId) -> Assignment | undefined`
  - `checkIssue({ device, employee, issuedAt, openAssignment, holderName, sameTypeHeld }) -> { error } | { warning } | {}`
  - `checkReturn({ assignment, returnedAt }) -> { error } | {}`
  - Each `error` is `{ status, code, message, details }`.

- [ ] **Step 1: Write the in-memory store**

`client/src/mocks/db.js`:

```js
import { seedDevices, seedEmployees, seedAssignments } from './seed.js'

export const db = { devices: [], employees: [], assignments: [] }

export function resetDb() {
  db.devices = structuredClone(seedDevices)
  db.employees = structuredClone(seedEmployees)
  db.assignments = structuredClone(seedAssignments)
}

export function openAssignmentFor(deviceId) {
  return db.assignments.find((a) => a.device_id === deviceId && a.returned_at === null)
}

export function openAssignmentsForEmployee(employeeId) {
  return db.assignments.filter((a) => a.employee_id === employeeId && a.returned_at === null)
}

export function deviceById(id) { return db.devices.find((d) => d.id === id) }
export function employeeById(id) { return db.employees.find((e) => e.id === id) }
export function assignmentById(id) { return db.assignments.find((a) => a.id === id) }

resetDb()
```

- [ ] **Step 2: Write the failing rules tests**

`client/src/mocks/rules.test.js`:

```js
import { checkIssue, checkReturn } from './rules.js'

const available = { id: 'd1', status: 'available', type: 'laptop', asset_tag: 'ASP-0042' }
const active = { id: 'e1', status: 'active', full_name: 'Maria Santos' }
const PAST = '2026-01-15T01:00:00.000Z'
const FUTURE = new Date(Date.now() + 86_400_000).toISOString()

const issue = (over = {}) =>
  checkIssue({ device: available, employee: active, issuedAt: PAST,
               openAssignment: undefined, sameTypeHeld: false, ...over })

test('a clean issue is allowed with no error and no warning', () => {
  expect(issue()).toEqual({})
})

test('issuing a device that is already out is refused and names the holder', () => {
  const result = issue({ openAssignment: { id: 'a1' }, holderName: 'Jose Rizal' })
  expect(result.error.status).toBe(409)
  expect(result.error.code).toBe('DEVICE_ALREADY_ISSUED')
  expect(result.error.details.holder_name).toBe('Jose Rizal')
})

test('issuing a retired device is refused', () => {
  const result = issue({ device: { ...available, status: 'retired' } })
  expect(result.error.status).toBe(409)
  expect(result.error.code).toBe('DEVICE_RETIRED')
})

test('issuing a device that is in repair is refused', () => {
  const result = issue({ device: { ...available, status: 'repair' } })
  expect(result.error.code).toBe('DEVICE_IN_REPAIR')
})

test('issuing to a resigned employee is refused', () => {
  const result = issue({ employee: { ...active, status: 'resigned' } })
  expect(result.error.status).toBe(409)
  expect(result.error.code).toBe('EMPLOYEE_RESIGNED')
})

test('a future issued_at is refused as a validation error', () => {
  const result = issue({ issuedAt: FUTURE })
  expect(result.error.status).toBe(400)
  expect(result.error.code).toBe('VALIDATION_ERROR')
  expect(result.error.details.issued_at).toMatch(/future/i)
})

test('holding a device of the same type warns but does not refuse', () => {
  const result = issue({ sameTypeHeld: true })
  expect(result.error).toBeUndefined()
  expect(result.warning.code).toBe('SAME_TYPE_ALREADY_HELD')
})

test('a hard rule beats the same-type warning', () => {
  const result = issue({ sameTypeHeld: true, device: { ...available, status: 'retired' } })
  expect(result.error.code).toBe('DEVICE_RETIRED')
  expect(result.warning).toBeUndefined()
})

test('returning an already-returned assignment is refused', () => {
  const result = checkReturn({
    assignment: { id: 'a1', issued_at: PAST, returned_at: PAST },
    returnedAt: PAST,
  })
  expect(result.error.status).toBe(409)
  expect(result.error.code).toBe('ASSIGNMENT_ALREADY_RETURNED')
})

test('returning before the device was issued is refused', () => {
  const result = checkReturn({
    assignment: { id: 'a1', issued_at: '2026-03-01T00:00:00.000Z', returned_at: null },
    returnedAt: '2026-02-01T00:00:00.000Z',
  })
  expect(result.error.status).toBe(400)
  expect(result.error.details.returned_at).toMatch(/before/i)
})

test('a future returned_at is refused', () => {
  const result = checkReturn({
    assignment: { id: 'a1', issued_at: PAST, returned_at: null },
    returnedAt: FUTURE,
  })
  expect(result.error.status).toBe(400)
})

test('a valid return is allowed', () => {
  const result = checkReturn({
    assignment: { id: 'a1', issued_at: PAST, returned_at: null },
    returnedAt: new Date().toISOString(),
  })
  expect(result).toEqual({})
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- rules`
Expected: FAIL — `Failed to resolve import "./rules.js"`.

- [ ] **Step 4: Implement the rules**

`client/src/mocks/rules.js`:

```js
// DISPOSABLE — duplicates §5 of the spec so the UI can be reviewed before a
// backend exists. Deleted at cutover. Pure functions, no I/O, no imports.

const err = (status, code, message, details = {}) => ({ error: { status, code, message, details } })

export function checkIssue({ device, employee, issuedAt, openAssignment, holderName, sameTypeHeld }) {
  if (!device) return err(404, 'NOT_FOUND', 'Device not found.')
  if (!employee) return err(404, 'NOT_FOUND', 'Employee not found.')

  if (openAssignment) {
    return err(409, 'DEVICE_ALREADY_ISSUED',
      `${device.asset_tag} is already held by ${holderName ?? 'another employee'}.`,
      { holder_name: holderName ?? null, assignment_id: openAssignment.id })
  }
  if (device.status === 'retired') {
    return err(409, 'DEVICE_RETIRED', `${device.asset_tag} is retired and cannot be issued.`)
  }
  if (device.status === 'repair') {
    return err(409, 'DEVICE_IN_REPAIR', `${device.asset_tag} is in repair. Return it from repair first.`)
  }
  if (employee.status === 'resigned') {
    return err(409, 'EMPLOYEE_RESIGNED', `${employee.full_name} has resigned and cannot be issued devices.`)
  }
  if (new Date(issuedAt).getTime() > Date.now()) {
    return err(400, 'VALIDATION_ERROR', 'The handout date cannot be in the future.',
      { issued_at: 'Must not be in the future.' })
  }

  if (sameTypeHeld) {
    return {
      warning: {
        code: 'SAME_TYPE_ALREADY_HELD',
        message: `${employee.full_name} already holds another ${device.type}.`,
      },
    }
  }
  return {}
}

export function checkReturn({ assignment, returnedAt }) {
  if (!assignment) return err(404, 'NOT_FOUND', 'Assignment not found.')
  if (assignment.returned_at) {
    return err(409, 'ASSIGNMENT_ALREADY_RETURNED', 'This device has already been returned.')
  }
  const at = new Date(returnedAt).getTime()
  if (at < new Date(assignment.issued_at).getTime()) {
    return err(400, 'VALIDATION_ERROR', 'The return date cannot be before the handout date.',
      { returned_at: 'Must not be before the handout date.' })
  }
  if (at > Date.now()) {
    return err(400, 'VALIDATION_ERROR', 'The return date cannot be in the future.',
      { returned_at: 'Must not be in the future.' })
  }
  return {}
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- rules`
Expected: PASS, 12 tests.

- [ ] **Step 6: Write the seed data**

`client/src/mocks/seed.js`. Build it programmatically so the volume stays readable. Note the deliberate shapes it produces: a retired device, two in repair, two resigned employees who still hold devices, and one laptop with three handouts of history.

```js
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
const id = (prefix, n) => `${prefix}-${String(n).padStart(4, '0')}-0000-4000-8000-000000000000`

const DEPARTMENTS = ['Creative', 'Accounts', 'Media', 'IT', 'Finance']

const NAMES = [
  'Maria Santos', 'Jose Rizal', 'Andres Bonifacio', 'Gabriela Silang',
  'Apolinario Mabini', 'Melchora Aquino', 'Juan Luna', 'Emilio Aguinaldo',
  'Gregoria de Jesus', 'Antonio Luna', 'Marcelo del Pilar', 'Diego Silang',
  'Lapu Lapu', 'Teresa Magbanua', 'Trinidad Tecson', 'Macario Sakay',
  'Graciano Lopez', 'Leona Florentino', 'Vicente Lim', 'Josefa Llanes',
  'Carlos Romulo', 'Felipe Agoncillo', 'Marcela Agoncillo', 'Rafael Palma',
  'Sergio Osmena', 'Manuel Quezon', 'Elpidio Quirino', 'Ramon Magsaysay',
  'Cecilia Munoz', 'Pedro Paterno',
]

export const seedEmployees = NAMES.map((full_name, i) => ({
  id: id('e', i + 1),
  full_name,
  email: full_name.toLowerCase().replace(/[^a-z]+/g, '.') + '@adspark.ph',
  department: DEPARTMENTS[i % DEPARTMENTS.length],
  // Employees 29 and 30 have resigned. Both still hold devices — see below.
  status: i >= 28 ? 'resigned' : 'active',
  resigned_at: i >= 28 ? iso(10 + i) : null,
  created_at: iso(400 - i),
  updated_at: iso(400 - i),
}))

const LAPTOPS = [
  ['Apple', 'MacBook Air M2', 'macos'], ['Apple', 'MacBook Pro 14 M3', 'macos'],
  ['Apple', 'MacBook Air M1', 'macos'], ['Dell', 'Latitude 5440', 'windows'],
  ['Lenovo', 'ThinkPad T14', 'windows'], ['HP', 'EliteBook 840', 'windows'],
]
const MOBILES = [
  ['Apple', 'iPhone 14', 'ios'], ['Apple', 'iPhone 13', 'ios'],
  ['Samsung', 'Galaxy S23', 'android'], ['Samsung', 'Galaxy A54', 'android'],
]

export const seedDevices = []
for (let i = 0; i < 24; i++) {
  const [brand, model, os] = LAPTOPS[i % LAPTOPS.length]
  seedDevices.push({
    id: id('d', i + 1), asset_tag: `ASP-${String(i + 1).padStart(4, '0')}`,
    type: 'laptop', brand, model, os,
    serial_number: `SN-L-${1000 + i}`,
    status: i === 22 ? 'repair' : i === 23 ? 'retired' : 'available',
    notes: i === 23 ? 'Battery swelling, removed from service.' : null,
    created_at: iso(500 - i), updated_at: iso(500 - i),
  })
}
for (let i = 0; i < 16; i++) {
  const [brand, model, os] = MOBILES[i % MOBILES.length]
  const n = 24 + i
  seedDevices.push({
    id: id('d', n + 1), asset_tag: `ASP-${String(n + 1).padStart(4, '0')}`,
    type: 'mobile', brand, model, os,
    serial_number: `SN-M-${2000 + i}`,
    status: i === 15 ? 'repair' : 'available',
    notes: null,
    created_at: iso(500 - n), updated_at: iso(500 - n),
  })
}

const laptop = (i) => seedDevices[i]              // indices 0..23
const mobile = (i) => seedDevices[24 + i]         // indices 0..15
const emp = (i) => seedEmployees[i]

let aSeq = 0
const assign = (device, employee, issuedDaysAgo, returned = null) => {
  aSeq += 1
  return {
    id: id('a', aSeq),
    device_id: device.id, employee_id: employee.id,
    issued_at: iso(issuedDaysAgo), issued_by: null,
    returned_at: returned ? iso(returned.daysAgo) : null,
    returned_by: null,
    return_reason: returned ? returned.reason : null,
    notes: null, created_at: iso(issuedDaysAgo),
  }
}

export const seedAssignments = []

// ASP-0001 has three handouts of history: two closed, one still open.
seedAssignments.push(assign(laptop(0), emp(4), 700, { daysAgo: 500, reason: 'swap' }))
seedAssignments.push(assign(laptop(0), emp(7), 480, { daysAgo: 200, reason: 'resignation' }))
seedAssignments.push(assign(laptop(0), emp(0), 180))

// Eighteen more laptops currently out, one each.
for (let i = 1; i <= 18; i++) {
  seedAssignments.push(assign(laptop(i), emp(i), 60 + i * 3))
}
// Twelve mobiles currently out.
for (let i = 0; i < 12; i++) {
  seedAssignments.push(assign(mobile(i), emp(i), 50 + i * 2))
}
// A returned mobile: device is free now but has history. (Review Focus #2)
seedAssignments.push(assign(mobile(12), emp(3), 300, { daysAgo: 30, reason: 'swap' }))

// Both resigned employees still hold devices. (Review Focus #3)
seedAssignments.push(assign(laptop(19), emp(28), 220))
seedAssignments.push(assign(mobile(13), emp(28), 220))
seedAssignments.push(assign(laptop(20), emp(29), 190))
```

- [ ] **Step 7: Add a seed sanity test**

Append to `client/src/mocks/rules.test.js`:

```js
import { db, resetDb, openAssignmentFor, openAssignmentsForEmployee } from './db.js'

describe('seed data', () => {
  beforeEach(() => resetDb())

  test('no device has two open assignments', () => {
    const open = db.assignments.filter((a) => a.returned_at === null)
    const deviceIds = open.map((a) => a.device_id)
    expect(new Set(deviceIds).size).toBe(deviceIds.length)
  })

  test('every assignment points at a real device and a real employee', () => {
    for (const a of db.assignments) {
      expect(db.devices.some((d) => d.id === a.device_id)).toBe(true)
      expect(db.employees.some((e) => e.id === a.employee_id)).toBe(true)
    }
  })

  test('no retired or in-repair device is currently held', () => {
    for (const d of db.devices.filter((x) => x.status !== 'available')) {
      expect(openAssignmentFor(d.id)).toBeUndefined()
    }
  })

  test('at least one resigned employee still holds a device', () => {
    const resigned = db.employees.filter((e) => e.status === 'resigned')
    expect(resigned.some((e) => openAssignmentsForEmployee(e.id).length > 0)).toBe(true)
  })

  test('at least one available device has closed history', () => {
    const withHistory = db.devices.filter(
      (d) => d.status === 'available' &&
        !openAssignmentFor(d.id) &&
        db.assignments.some((a) => a.device_id === d.id),
    )
    expect(withHistory.length).toBeGreaterThan(0)
  })

  test('one device has three handouts of history', () => {
    const counts = {}
    for (const a of db.assignments) counts[a.device_id] = (counts[a.device_id] ?? 0) + 1
    expect(Object.values(counts).some((n) => n === 3)).toBe(true)
  })
})
```

- [ ] **Step 8: Run the tests**

Run: `npm test -- rules`
Expected: PASS, 18 tests. If "no retired or in-repair device is currently held" fails, a seed index collided — check that the repair/retired indices (laptops 22 and 23, mobile 15) are not also handed out.

- [ ] **Step 9: Commit**

```bash
git add client/src/mocks
git commit -m "feat(mocks): add in-memory store, seed data, and §5 rule checks"
```

---

## Task 3: MSW handlers for every route in §6

Tested with plain `fetch` against `setupServer` in Node — no React, no api wrapper. If these tests pass, the contract the UI is about to be written against is real.

**Files:**
- Create: `client/src/mocks/handlers.js`, `client/src/mocks/server.js`, `client/src/mocks/browser.js`
- Modify: `client/src/test/setup.js`
- Test: `client/src/mocks/handlers.test.js`

**Interfaces:**
- Consumes: `db`, `resetDb`, `openAssignmentFor`, `openAssignmentsForEmployee`, `deviceById`, `employeeById`, `assignmentById` from `./db.js`; `checkIssue`, `checkReturn` from `./rules.js`.
- Produces: `handlers` (array), `server` (Node), `worker` (browser). Every response is `{ data }` or `{ error: { code, message, details } }`.

- [ ] **Step 1: Wire MSW into the test setup**

`client/src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from '../mocks/server.js'
import { resetDb } from '../mocks/db.js'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { server.resetHandlers(); resetDb() })
afterAll(() => server.close())
```

`client/src/mocks/server.js`:

```js
import { setupServer } from 'msw/node'
import { handlers } from './handlers.js'

export const server = setupServer(...handlers)
```

`client/src/mocks/browser.js`:

```js
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers.js'

export const worker = setupWorker(...handlers)
```

- [ ] **Step 2: Write the failing handler tests**

`client/src/mocks/handlers.test.js`:

```js
import { db } from './db.js'

const get = (path) => fetch(`http://localhost/api${path}`).then(async (r) => [r.status, await r.json()])
const send = (method, path, body) =>
  fetch(`http://localhost/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => [r.status, await r.json()])

const freeLaptop = () => db.devices.find(
  (d) => d.type === 'laptop' && d.status === 'available' &&
    !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
const heldDevice = () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  return db.devices.find((d) => d.id === open.device_id)
}
const activeEmployee = () => db.employees.find((e) => e.status === 'active')

test('health returns ok', async () => {
  const [status, body] = await get('/health')
  expect(status).toBe(200)
  expect(body.data.status).toBe('ok')
})

test('device list includes the current holder for held devices', async () => {
  const [status, body] = await get('/devices')
  expect(status).toBe(200)
  const held = body.data.find((d) => d.current_holder !== null)
  expect(held.current_holder).toMatchObject({
    assignment_id: expect.any(String),
    employee_id: expect.any(String),
    full_name: expect.any(String),
    issued_at: expect.any(String),
  })
})

test('no device in the list is ever given the status "issued"', async () => {
  const [, body] = await get('/devices')
  for (const d of body.data) expect(['available', 'repair', 'retired']).toContain(d.status)
})

test('type and status filters narrow the list', async () => {
  const [, body] = await get('/devices?type=mobile&status=available')
  expect(body.data.length).toBeGreaterThan(0)
  for (const d of body.data) {
    expect(d.type).toBe('mobile')
    expect(d.status).toBe('available')
  }
})

test('held=true and held=false partition the list', async () => {
  const [, all] = await get('/devices')
  const [, out] = await get('/devices?held=true')
  const [, free] = await get('/devices?held=false')
  expect(out.data.length + free.data.length).toBe(all.data.length)
  for (const d of out.data) expect(d.current_holder).not.toBeNull()
  for (const d of free.data) expect(d.current_holder).toBeNull()
})

// Review Focus #4
test('search is case-insensitive, trims whitespace, and matches partials', async () => {
  const target = db.devices[0]           // ASP-0001
  for (const q of ['ASP-0001', 'asp-0001', '  asp-0001  ', '0001']) {
    const [, body] = await get(`/devices?q=${encodeURIComponent(q)}`)
    expect(body.data.some((d) => d.id === target.id)).toBe(true)
  }
})

test('search also matches model and serial number', async () => {
  const target = db.devices[0]
  const [, byModel] = await get(`/devices?q=${encodeURIComponent(target.model.toLowerCase())}`)
  expect(byModel.data.some((d) => d.id === target.id)).toBe(true)
  const [, bySerial] = await get(`/devices?q=${encodeURIComponent(target.serial_number)}`)
  expect(bySerial.data.some((d) => d.id === target.id)).toBe(true)
})

test('a search matching nothing returns an empty array, not an error', async () => {
  const [status, body] = await get('/devices?q=zzzznothing')
  expect(status).toBe(200)
  expect(body.data).toEqual([])
})

test('device detail returns the holder and the full history newest first', async () => {
  const device = db.devices[0]           // ASP-0001 — three handouts
  const [status, body] = await get(`/devices/${device.id}`)
  expect(status).toBe(200)
  expect(body.data.history).toHaveLength(3)
  const times = body.data.history.map((h) => new Date(h.issued_at).getTime())
  expect(times).toEqual([...times].sort((a, b) => b - a))
  expect(body.data.history[0].employee_name).toEqual(expect.any(String))
})

test('an unknown device id returns 404 with NOT_FOUND', async () => {
  const [status, body] = await get('/devices/nope')
  expect(status).toBe(404)
  expect(body.error.code).toBe('NOT_FOUND')
})

test('creating a device with a duplicate asset tag returns 409', async () => {
  const [status, body] = await send('POST', '/devices', {
    asset_tag: db.devices[0].asset_tag, type: 'laptop', brand: 'Dell', model: 'X', os: 'windows',
  })
  expect(status).toBe(409)
  expect(body.error.code).toBe('DUPLICATE_ASSET_TAG')
})

test('creating a device without an asset tag returns 400 naming the field', async () => {
  const [status, body] = await send('POST', '/devices', { type: 'laptop' })
  expect(status).toBe(400)
  expect(body.error.code).toBe('VALIDATION_ERROR')
  expect(body.error.details.asset_tag).toBeTruthy()
})

test('creating a valid device returns 201 and it appears in the list', async () => {
  const [status, body] = await send('POST', '/devices', {
    asset_tag: 'ASP-9999', type: 'laptop', brand: 'Dell', model: 'Latitude 7440', os: 'windows',
  })
  expect(status).toBe(201)
  expect(body.data.status).toBe('available')
  expect(body.data.current_holder).toBeNull()
  const [, list] = await get('/devices?q=ASP-9999')
  expect(list.data).toHaveLength(1)
})

test('patching a device updates only the fields sent', async () => {
  const device = db.devices[1]
  const [status, body] = await send('PATCH', `/devices/${device.id}`, { notes: 'Screen scratch' })
  expect(status).toBe(200)
  expect(body.data.notes).toBe('Screen scratch')
  expect(body.data.asset_tag).toBe(device.asset_tag)
})

test('retiring a held device is refused', async () => {
  const [status, body] = await send('POST', `/devices/${heldDevice().id}/retire`, {})
  expect(status).toBe(409)
  expect(body.error.code).toBe('DEVICE_ALREADY_ISSUED')
})

test('employee detail lists devices held and full history', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const [status, body] = await get(`/employees/${open.employee_id}`)
  expect(status).toBe(200)
  expect(body.data.devices_held.length).toBeGreaterThan(0)
  expect(body.data.devices_held[0]).toMatchObject({
    asset_tag: expect.any(String), issued_at: expect.any(String), assignment_id: expect.any(String),
  })
})

test('employee search matches name and email case-insensitively', async () => {
  const target = db.employees[0]
  const [, byName] = await get(`/employees?q=${encodeURIComponent(target.full_name.toUpperCase())}`)
  expect(byName.data.some((e) => e.id === target.id)).toBe(true)
  const [, byEmail] = await get(`/employees?q=${encodeURIComponent(target.email.slice(0, 5))}`)
  expect(byEmail.data.some((e) => e.id === target.id)).toBe(true)
})

test('creating an employee with a duplicate email returns 409', async () => {
  const [status, body] = await send('POST', '/employees', {
    full_name: 'Someone Else', email: db.employees[0].email, department: 'IT',
  })
  expect(status).toBe(409)
  expect(body.error.code).toBe('DUPLICATE_EMAIL')
})

test('resigning an employee does not close their assignments', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const before = db.assignments.filter(
    (a) => a.employee_id === open.employee_id && a.returned_at === null).length
  const [status, body] = await send('POST', `/employees/${open.employee_id}/resign`, {})
  expect(status).toBe(200)
  expect(body.data.status).toBe('resigned')
  expect(body.data.resigned_at).toEqual(expect.any(String))
  const after = db.assignments.filter(
    (a) => a.employee_id === open.employee_id && a.returned_at === null).length
  expect(after).toBe(before)
})

test('issuing a free device to an active employee returns 201', async () => {
  const device = freeLaptop()
  const [status, body] = await send('POST', '/assignments', {
    device_id: device.id, employee_id: activeEmployee().id,
  })
  expect(status).toBe(201)
  expect(body.data.returned_at).toBeNull()
  expect(body.data.asset_tag).toBe(device.asset_tag)
})

test('issuing the same device twice returns 409 naming the holder', async () => {
  const device = freeLaptop()
  const first = activeEmployee()
  const second = db.employees.find((e) => e.status === 'active' && e.id !== first.id)
  await send('POST', '/assignments', { device_id: device.id, employee_id: first.id })
  const [status, body] = await send('POST', '/assignments', {
    device_id: device.id, employee_id: second.id,
  })
  expect(status).toBe(409)
  expect(body.error.code).toBe('DEVICE_ALREADY_ISSUED')
  expect(body.error.details.holder_name).toBe(first.full_name)
})

// Review Focus #3
test('issuing to a resigned employee returns 409', async () => {
  const resigned = db.employees.find((e) => e.status === 'resigned')
  const [status, body] = await send('POST', '/assignments', {
    device_id: freeLaptop().id, employee_id: resigned.id,
  })
  expect(status).toBe(409)
  expect(body.error.code).toBe('EMPLOYEE_RESIGNED')
})

test('a same-type handout succeeds with a warning in the body', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const holder = db.employees.find((e) => e.id === open.employee_id && e.status === 'active')
  const held = db.devices.find((d) => d.id === open.device_id)
  const another = db.devices.find(
    (d) => d.type === held.type && d.status === 'available' &&
      !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
  const [status, body] = await send('POST', '/assignments', {
    device_id: another.id, employee_id: holder.id,
  })
  expect(status).toBe(201)
  expect(body.warning.code).toBe('SAME_TYPE_ALREADY_HELD')
})

test('a future issued_at returns 400', async () => {
  const [status, body] = await send('POST', '/assignments', {
    device_id: freeLaptop().id, employee_id: activeEmployee().id,
    issued_at: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(status).toBe(400)
  expect(body.error.details.issued_at).toBeTruthy()
})

test('returning frees the device and records the reason', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const [status, body] = await send('POST', `/assignments/${open.id}/return`, {
    return_reason: 'swap',
  })
  expect(status).toBe(200)
  expect(body.data.returned_at).toEqual(expect.any(String))
  expect(body.data.return_reason).toBe('swap')
  const [, device] = await get(`/devices/${open.device_id}`)
  expect(device.data.current_holder).toBeNull()
})

test('returning the same assignment twice returns 409', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  await send('POST', `/assignments/${open.id}/return`, { return_reason: 'swap' })
  const [status, body] = await send('POST', `/assignments/${open.id}/return`, {
    return_reason: 'swap',
  })
  expect(status).toBe(409)
  expect(body.error.code).toBe('ASSIGNMENT_ALREADY_RETURNED')
})

test('a return without a reason returns 400', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const [status, body] = await send('POST', `/assignments/${open.id}/return`, {})
  expect(status).toBe(400)
  expect(body.error.details.return_reason).toBeTruthy()
})

test('the assignment log is newest first and filters by date range', async () => {
  const [, body] = await get('/assignments')
  const times = body.data.map((a) => new Date(a.issued_at).getTime())
  expect(times).toEqual([...times].sort((a, b) => b - a))

  const from = new Date(Date.now() - 100 * 86_400_000).toISOString()
  const [, ranged] = await get(`/assignments?from=${encodeURIComponent(from)}`)
  for (const a of ranged.data) {
    expect(new Date(a.issued_at).getTime()).toBeGreaterThanOrEqual(new Date(from).getTime())
  }
  expect(ranged.data.length).toBeLessThan(body.data.length)
})

test('open=true returns only assignments that are still out', async () => {
  const [, body] = await get('/assignments?open=true')
  expect(body.data.length).toBeGreaterThan(0)
  for (const a of body.data) expect(a.returned_at).toBeNull()
})

test('dashboard counts agree with the device list', async () => {
  const [, devices] = await get('/devices')
  const [status, body] = await get('/dashboard')
  expect(status).toBe(200)
  expect(body.data.totals.devices).toBe(devices.data.length)
  expect(body.data.totals.issued).toBe(devices.data.filter((d) => d.current_holder).length)
  expect(body.data.totals.available).toBe(
    devices.data.filter((d) => !d.current_holder && d.status === 'available').length)
  expect(body.data.by_type.map((t) => t.type).sort()).toEqual(['laptop', 'mobile'])
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- handlers`
Expected: FAIL — `Failed to resolve import "./handlers.js"`.

- [ ] **Step 4: Implement the handlers**

`client/src/mocks/handlers.js`:

```js
import { http, HttpResponse } from 'msw'
import {
  db, openAssignmentFor, openAssignmentsForEmployee,
  deviceById, employeeById, assignmentById,
} from './db.js'
import { checkIssue, checkReturn } from './rules.js'

const ok = (data, status = 200) => HttpResponse.json({ data }, { status })
const fail = ({ status, code, message, details = {} }) =>
  HttpResponse.json({ error: { code, message, details } }, { status })
const notFound = (what) => fail({ status: 404, code: 'NOT_FOUND', message: `${what} not found.` })
const invalid = (details, message = 'Some fields need attention.') =>
  fail({ status: 400, code: 'VALIDATION_ERROR', message, details })

const nowIso = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()
const norm = (s) => String(s ?? '').trim().toLowerCase()
const matches = (q, ...fields) => fields.some((f) => norm(f).includes(norm(q)))

const DEVICE_TYPES = ['laptop', 'mobile']
const DEVICE_STATUSES = ['available', 'repair', 'retired']
const OS_VALUES = ['macos', 'windows', 'ios', 'android']
const RETURN_REASONS = ['resignation', 'swap', 'repair', 'lost', 'other']

// ---- serialisation: mirrors the device_current_holder view in §4 ----

function toDevice(device) {
  const open = openAssignmentFor(device.id)
  const holder = open ? employeeById(open.employee_id) : null
  return {
    ...device,
    current_holder: open && holder
      ? { assignment_id: open.id, employee_id: holder.id,
          full_name: holder.full_name, issued_at: open.issued_at }
      : null,
  }
}

function toAssignment(a) {
  const device = deviceById(a.device_id)
  const employee = employeeById(a.employee_id)
  return {
    ...a,
    asset_tag: device?.asset_tag ?? null,
    device_model: device?.model ?? null,
    device_type: device?.type ?? null,
    employee_name: employee?.full_name ?? null,
  }
}

const newestFirst = (list) =>
  [...list].sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))

// ---- handlers ----

export const handlers = [
  http.get('*/api/health', () => ok({ status: 'ok' })),

  // --- devices ---

  http.get('*/api/devices', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = db.devices.map(toDevice)
    if (p.get('type')) rows = rows.filter((d) => d.type === p.get('type'))
    if (p.get('status')) rows = rows.filter((d) => d.status === p.get('status'))
    if (p.get('held') === 'true') rows = rows.filter((d) => d.current_holder !== null)
    if (p.get('held') === 'false') rows = rows.filter((d) => d.current_holder === null)
    const q = p.get('q')
    if (norm(q)) {
      rows = rows.filter((d) => matches(q, d.asset_tag, d.serial_number, d.model, d.brand))
    }
    return ok(rows.sort((a, b) => a.asset_tag.localeCompare(b.asset_tag)))
  }),

  http.get('*/api/devices/:id', ({ params }) => {
    const device = deviceById(params.id)
    if (!device) return notFound('Device')
    const history = newestFirst(db.assignments.filter((a) => a.device_id === device.id))
    return ok({ ...toDevice(device), history: history.map(toAssignment) })
  }),

  http.post('*/api/devices', async ({ request }) => {
    const body = await request.json()
    const details = {}
    if (!String(body.asset_tag ?? '').trim()) details.asset_tag = 'Asset tag is required.'
    if (!DEVICE_TYPES.includes(body.type)) details.type = 'Choose laptop or mobile.'
    if (body.os && !OS_VALUES.includes(body.os)) details.os = 'Not a valid operating system.'
    if (body.status && !DEVICE_STATUSES.includes(body.status)) {
      details.status = 'Status must be available, repair, or retired.'
    }
    if (Object.keys(details).length) return invalid(details)

    if (db.devices.some((d) => norm(d.asset_tag) === norm(body.asset_tag))) {
      return fail({ status: 409, code: 'DUPLICATE_ASSET_TAG',
        message: `Asset tag ${body.asset_tag} is already in use.`,
        details: { asset_tag: 'Already in use.' } })
    }
    if (body.serial_number &&
        db.devices.some((d) => norm(d.serial_number) === norm(body.serial_number))) {
      return fail({ status: 409, code: 'DUPLICATE_SERIAL',
        message: `Serial number ${body.serial_number} is already in use.`,
        details: { serial_number: 'Already in use.' } })
    }

    const device = {
      id: uuid(),
      asset_tag: String(body.asset_tag).trim(),
      type: body.type,
      brand: body.brand ?? null,
      model: body.model ?? null,
      serial_number: body.serial_number || null,
      os: body.os ?? null,
      status: body.status ?? 'available',
      notes: body.notes || null,
      created_at: nowIso(), updated_at: nowIso(),
    }
    db.devices.push(device)
    return ok(toDevice(device), 201)
  }),

  http.patch('*/api/devices/:id', async ({ params, request }) => {
    const device = deviceById(params.id)
    if (!device) return notFound('Device')
    const body = await request.json()

    if (body.asset_tag && db.devices.some(
      (d) => d.id !== device.id && norm(d.asset_tag) === norm(body.asset_tag))) {
      return fail({ status: 409, code: 'DUPLICATE_ASSET_TAG',
        message: `Asset tag ${body.asset_tag} is already in use.`,
        details: { asset_tag: 'Already in use.' } })
    }
    if (body.serial_number && db.devices.some(
      (d) => d.id !== device.id && norm(d.serial_number) === norm(body.serial_number))) {
      return fail({ status: 409, code: 'DUPLICATE_SERIAL',
        message: `Serial number ${body.serial_number} is already in use.`,
        details: { serial_number: 'Already in use.' } })
    }

    const editable = ['asset_tag', 'type', 'brand', 'model', 'serial_number', 'os', 'status', 'notes']
    for (const key of editable) {
      if (key in body) device[key] = body[key]
    }
    device.updated_at = nowIso()
    return ok(toDevice(device))
  }),

  http.post('*/api/devices/:id/retire', ({ params }) => {
    const device = deviceById(params.id)
    if (!device) return notFound('Device')
    const open = openAssignmentFor(device.id)
    if (open) {
      const holder = employeeById(open.employee_id)
      return fail({ status: 409, code: 'DEVICE_ALREADY_ISSUED',
        message: `${device.asset_tag} is still held by ${holder?.full_name ?? 'an employee'}. Return it before retiring.`,
        details: { holder_name: holder?.full_name ?? null } })
    }
    device.status = 'retired'
    device.updated_at = nowIso()
    return ok(toDevice(device))
  }),

  // --- employees ---

  http.get('*/api/employees', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = [...db.employees]
    if (p.get('status')) rows = rows.filter((e) => e.status === p.get('status'))
    const q = p.get('q')
    if (norm(q)) rows = rows.filter((e) => matches(q, e.full_name, e.email, e.department))
    return ok(rows
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((e) => ({ ...e, devices_held_count: openAssignmentsForEmployee(e.id).length })))
  }),

  http.get('*/api/employees/:id', ({ params }) => {
    const employee = employeeById(params.id)
    if (!employee) return notFound('Employee')

    const devices_held = openAssignmentsForEmployee(employee.id).map((a) => {
      const d = deviceById(a.device_id)
      return {
        assignment_id: a.id, issued_at: a.issued_at,
        device_id: d.id, asset_tag: d.asset_tag, type: d.type,
        brand: d.brand, model: d.model, serial_number: d.serial_number,
      }
    })
    const history = newestFirst(db.assignments.filter((a) => a.employee_id === employee.id))
    return ok({ ...employee, devices_held, history: history.map(toAssignment) })
  }),

  http.post('*/api/employees', async ({ request }) => {
    const body = await request.json()
    const details = {}
    if (!String(body.full_name ?? '').trim()) details.full_name = 'Full name is required.'
    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) details.email = 'Not a valid email address.'
    if (Object.keys(details).length) return invalid(details)

    if (body.email && db.employees.some((e) => norm(e.email) === norm(body.email))) {
      return fail({ status: 409, code: 'DUPLICATE_EMAIL',
        message: `${body.email} is already registered.`,
        details: { email: 'Already in use.' } })
    }

    const employee = {
      id: uuid(),
      full_name: String(body.full_name).trim(),
      email: body.email || null,
      department: body.department || null,
      status: 'active', resigned_at: null,
      created_at: nowIso(), updated_at: nowIso(),
    }
    db.employees.push(employee)
    return ok({ ...employee, devices_held_count: 0 }, 201)
  }),

  http.patch('*/api/employees/:id', async ({ params, request }) => {
    const employee = employeeById(params.id)
    if (!employee) return notFound('Employee')
    const body = await request.json()

    if (body.email && db.employees.some(
      (e) => e.id !== employee.id && norm(e.email) === norm(body.email))) {
      return fail({ status: 409, code: 'DUPLICATE_EMAIL',
        message: `${body.email} is already registered.`,
        details: { email: 'Already in use.' } })
    }
    for (const key of ['full_name', 'email', 'department']) {
      if (key in body) employee[key] = body[key]
    }
    employee.updated_at = nowIso()
    return ok(employee)
  }),

  // Deliberately does NOT close assignments — §5. The UI surfaces them instead.
  http.post('*/api/employees/:id/resign', ({ params }) => {
    const employee = employeeById(params.id)
    if (!employee) return notFound('Employee')
    employee.status = 'resigned'
    employee.resigned_at = nowIso()
    employee.updated_at = nowIso()
    return ok(employee)
  }),

  // --- assignments ---

  http.get('*/api/assignments', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = [...db.assignments]
    if (p.get('device_id')) rows = rows.filter((a) => a.device_id === p.get('device_id'))
    if (p.get('employee_id')) rows = rows.filter((a) => a.employee_id === p.get('employee_id'))
    if (p.get('open') === 'true') rows = rows.filter((a) => a.returned_at === null)
    if (p.get('open') === 'false') rows = rows.filter((a) => a.returned_at !== null)
    if (p.get('from')) {
      const from = new Date(p.get('from')).getTime()
      rows = rows.filter((a) => new Date(a.issued_at).getTime() >= from)
    }
    if (p.get('to')) {
      const to = new Date(p.get('to')).getTime()
      rows = rows.filter((a) => new Date(a.issued_at).getTime() <= to)
    }
    return ok(newestFirst(rows).map(toAssignment))
  }),

  http.post('*/api/assignments', async ({ request }) => {
    const body = await request.json()
    const device = deviceById(body.device_id)
    const employee = employeeById(body.employee_id)
    const issuedAt = body.issued_at ?? nowIso()

    if (body.issued_at && Number.isNaN(new Date(body.issued_at).getTime())) {
      return invalid({ issued_at: 'Not a valid date.' })
    }

    const open = device ? openAssignmentFor(device.id) : undefined
    const holderName = open ? employeeById(open.employee_id)?.full_name : undefined
    const sameTypeHeld = device && employee
      ? openAssignmentsForEmployee(employee.id)
          .some((a) => deviceById(a.device_id)?.type === device.type)
      : false

    const verdict = checkIssue({ device, employee, issuedAt, openAssignment: open, holderName, sameTypeHeld })
    if (verdict.error) return fail(verdict.error)

    const assignment = {
      id: uuid(),
      device_id: device.id, employee_id: employee.id,
      issued_at: issuedAt, issued_by: null,
      returned_at: null, returned_by: null, return_reason: null,
      notes: body.notes || null, created_at: nowIso(),
    }
    db.assignments.push(assignment)

    const payload = { data: toAssignment(assignment) }
    if (verdict.warning) payload.warning = verdict.warning
    return HttpResponse.json(payload, { status: 201 })
  }),

  http.post('*/api/assignments/:id/return', async ({ params, request }) => {
    const assignment = assignmentById(params.id)
    if (!assignment) return notFound('Assignment')
    const body = await request.json()

    if (!RETURN_REASONS.includes(body.return_reason)) {
      return invalid({ return_reason: 'Choose a reason for the return.' })
    }
    const returnedAt = body.returned_at ?? nowIso()
    if (Number.isNaN(new Date(returnedAt).getTime())) {
      return invalid({ returned_at: 'Not a valid date.' })
    }

    const verdict = checkReturn({ assignment, returnedAt })
    if (verdict.error) return fail(verdict.error)

    assignment.returned_at = returnedAt
    assignment.return_reason = body.return_reason
    if (body.notes) assignment.notes = body.notes
    return ok(toAssignment(assignment))
  }),

  // --- dashboard ---

  http.get('*/api/dashboard', () => {
    const devices = db.devices.map(toDevice)
    const issued = devices.filter((d) => d.current_holder !== null)
    const byType = DEVICE_TYPES.map((type) => {
      const of = devices.filter((d) => d.type === type)
      return {
        type,
        total: of.length,
        issued: of.filter((d) => d.current_holder !== null).length,
        available: of.filter((d) => d.current_holder === null && d.status === 'available').length,
      }
    })
    return ok({
      totals: {
        devices: devices.length,
        issued: issued.length,
        available: devices.filter((d) => d.current_holder === null && d.status === 'available').length,
        repair: devices.filter((d) => d.status === 'repair').length,
        retired: devices.filter((d) => d.status === 'retired').length,
        employees: db.employees.filter((e) => e.status === 'active').length,
      },
      by_type: byType,
      holders: issued.map((d) => ({
        device_id: d.id, asset_tag: d.asset_tag, type: d.type, model: d.model,
        employee_id: d.current_holder.employee_id,
        holder_name: d.current_holder.full_name,
        issued_at: d.current_holder.issued_at,
      })).sort((a, b) => a.holder_name.localeCompare(b.holder_name)),
    })
  }),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- handlers`
Expected: PASS, 31 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, all tests. The seed sanity tests from Task 2 must still pass — `resetDb()` in the setup file keeps cases isolated.

- [ ] **Step 7: Commit**

```bash
git add client/src/mocks client/src/test
git commit -m "feat(mocks): implement every §6 route as MSW handlers"
```

---

## Task 4: Timestamp formatting and error translation

Two pure modules, both easy to get subtly wrong and both used by every screen. `format.js` is where Review Focus #1 lives: the API speaks UTC, the `datetime-local` input speaks local wall-clock time, and the conversion between them must not drift.

**Files:**
- Create: `client/src/lib/format.js`, `client/src/lib/errors.js`
- Test: `client/src/lib/format.test.js`, `client/src/lib/errors.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toLocalInput(iso) -> "YYYY-MM-DDTHH:mm"` — local wall-clock, for `<input type="datetime-local">`
  - `fromLocalInput(value) -> utcIsoString`
  - `toDateInput(iso) -> "YYYY-MM-DD"` — for `<input type="date">`
  - `formatDateTime(iso) -> "14 Mar 2026, 9:00 am"`
  - `formatDate(iso) -> "14 Mar 2026"`
  - `formatDuration(fromIso, toIso = now) -> "6 months"` — for "held for X"
  - `class ApiError extends Error` with `.status`, `.code`, `.details`
  - `messageFor(error) -> string`
  - `fieldErrorsOf(error) -> { field: message }`

- [ ] **Step 1: Write the failing format tests**

`client/src/lib/format.test.js`:

```js
import { toLocalInput, fromLocalInput, toDateInput, formatDateTime, formatDate, formatDuration } from './format.js'

// Review Focus #1 — the round trip must not drift, in any timezone.
test('a local wall-clock time survives the round trip to UTC and back', () => {
  const localNineAm = new Date(2026, 2, 14, 9, 0, 0)       // 14 Mar 2026, 09:00 local
  const iso = localNineAm.toISOString()
  expect(toLocalInput(iso)).toBe('2026-03-14T09:00')
  expect(fromLocalInput('2026-03-14T09:00')).toBe(iso)
})

test('the round trip is stable across many instants', () => {
  for (const daysAgo of [0, 1, 45, 120, 365, 900]) {
    const d = new Date(Date.now() - daysAgo * 86_400_000)
    d.setSeconds(0, 0)
    const iso = d.toISOString()
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
  }
})

test('toLocalInput zero-pads single-digit months, days, hours, and minutes', () => {
  const iso = new Date(2026, 0, 5, 7, 3, 0).toISOString()
  expect(toLocalInput(iso)).toBe('2026-01-05T07:03')
})

test('toDateInput gives the local calendar date', () => {
  const iso = new Date(2026, 2, 14, 9, 0, 0).toISOString()
  expect(toDateInput(iso)).toBe('2026-03-14')
})

test('null and undefined produce empty strings, never "Invalid Date"', () => {
  for (const fn of [toLocalInput, toDateInput, formatDateTime, formatDate]) {
    expect(fn(null)).toBe('')
    expect(fn(undefined)).toBe('')
    expect(fn('')).toBe('')
  }
})

test('formatDateTime is human readable and includes the day, month, and year', () => {
  const iso = new Date(2026, 2, 14, 9, 0, 0).toISOString()
  const out = formatDateTime(iso)
  expect(out).toMatch(/14/)
  expect(out).toMatch(/Mar/)
  expect(out).toMatch(/2026/)
  expect(out).toMatch(/9/)
})

test('formatDate omits the time', () => {
  const iso = new Date(2026, 2, 14, 9, 0, 0).toISOString()
  expect(formatDate(iso)).toBe('14 Mar 2026')
})

test('formatDuration describes the gap in the largest sensible unit', () => {
  const now = new Date('2026-09-23T00:00:00.000Z').toISOString()
  expect(formatDuration('2026-09-22T00:00:00.000Z', now)).toBe('1 day')
  expect(formatDuration('2026-09-20T00:00:00.000Z', now)).toBe('3 days')
  expect(formatDuration('2026-08-23T00:00:00.000Z', now)).toBe('1 month')
  expect(formatDuration('2026-03-23T00:00:00.000Z', now)).toBe('6 months')
  expect(formatDuration('2024-09-23T00:00:00.000Z', now)).toBe('2 years')
  expect(formatDuration('2026-09-23T00:00:00.000Z', now)).toBe('today')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- format`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `format.js`**

```js
const pad = (n) => String(n).padStart(2, '0')
const parse = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" in the viewer's local time, for datetime-local. */
export function toLocalInput(iso) {
  const d = parse(iso)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" in local time -> UTC ISO. A bare datetime-local value is
 *  parsed as local time by the platform, which is exactly what we want. */
export function fromLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** UTC ISO -> "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInput(iso) {
  const d = parse(iso)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
})
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric', minute: '2-digit', hour12: true,
})

export function formatDate(iso) {
  const d = parse(iso)
  return d ? DATE_FMT.format(d) : ''
}

export function formatDateTime(iso) {
  const d = parse(iso)
  return d ? `${DATE_FMT.format(d)}, ${TIME_FMT.format(d).toLowerCase()}` : ''
}

/** Largest sensible unit: "today", "3 days", "6 months", "2 years". */
export function formatDuration(fromIso, toIso) {
  const from = parse(fromIso)
  const to = toIso ? parse(toIso) : new Date()
  if (!from || !to) return ''

  const days = Math.floor((to - from) / 86_400_000)
  if (days <= 0) return 'today'
  if (days < 30) return days === 1 ? '1 day' : `${days} days`

  const months = Math.floor(days / 30.44)
  if (months < 12) return months === 1 ? '1 month' : `${months} months`

  const years = Math.floor(days / 365.25)
  return years === 1 ? '1 year' : `${years} years`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- format`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing error tests**

`client/src/lib/errors.test.js`:

```js
import { ApiError, messageFor, fieldErrorsOf } from './errors.js'

const err = (code, message = 'raw', details = {}, status = 409) =>
  new ApiError({ status, code, message, details })

test('ApiError carries status, code, and details', () => {
  const e = err('DEVICE_ALREADY_ISSUED', 'ASP-0042 is already held by Jose Rizal.',
    { holder_name: 'Jose Rizal' })
  expect(e).toBeInstanceOf(Error)
  expect(e.status).toBe(409)
  expect(e.code).toBe('DEVICE_ALREADY_ISSUED')
  expect(e.details.holder_name).toBe('Jose Rizal')
})

test('the server message wins, because it names the specific device and person', () => {
  const e = err('DEVICE_ALREADY_ISSUED', 'ASP-0042 is already held by Jose Rizal.')
  expect(messageFor(e)).toBe('ASP-0042 is already held by Jose Rizal.')
})

test('a known code without a server message falls back to prose, not the code', () => {
  const e = err('DEVICE_RETIRED', '')
  expect(messageFor(e)).toMatch(/retired/i)
  expect(messageFor(e)).not.toMatch(/DEVICE_RETIRED/)
})

test('an unknown code still produces something a person can read', () => {
  const e = err('SOMETHING_NEW', '')
  expect(messageFor(e)).toMatch(/went wrong/i)
})

test('a network failure reads as a connection problem, not a stack trace', () => {
  expect(messageFor(new TypeError('Failed to fetch'))).toMatch(/could not reach/i)
})

test('field errors come back only for validation errors', () => {
  const v = err('VALIDATION_ERROR', 'Check the fields.', { asset_tag: 'Required.' }, 400)
  expect(fieldErrorsOf(v)).toEqual({ asset_tag: 'Required.' })
  expect(fieldErrorsOf(err('DEVICE_RETIRED'))).toEqual({})
  expect(fieldErrorsOf(null)).toEqual({})
})

test('duplicate-key conflicts also surface as field errors so forms can mark the input', () => {
  const e = err('DUPLICATE_ASSET_TAG', 'In use.', { asset_tag: 'Already in use.' })
  expect(fieldErrorsOf(e)).toEqual({ asset_tag: 'Already in use.' })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- errors`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `errors.js`**

```js
export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message || code || 'Request failed')
    this.name = 'ApiError'
    this.status = status ?? 0
    this.code = code ?? 'UNKNOWN'
    this.details = details ?? {}
  }
}

// Fallbacks only. The server's own message is preferred because it names the
// actual device and person, which a generic string cannot.
const FALLBACKS = {
  VALIDATION_ERROR: 'Some fields need attention.',
  NOT_FOUND: 'That record no longer exists.',
  DUPLICATE_ASSET_TAG: 'That asset tag is already in use.',
  DUPLICATE_SERIAL: 'That serial number is already in use.',
  DUPLICATE_EMAIL: 'That email address is already registered.',
  DEVICE_ALREADY_ISSUED: 'That device is already issued to someone else.',
  DEVICE_RETIRED: 'That device is retired and cannot be issued.',
  DEVICE_IN_REPAIR: 'That device is in repair. Return it from repair first.',
  EMPLOYEE_RESIGNED: 'That employee has resigned and cannot be issued devices.',
  ASSIGNMENT_ALREADY_RETURNED: 'That device has already been returned.',
}

// Forms mark individual inputs for these codes, not just the banner.
const FIELD_CODES = new Set([
  'VALIDATION_ERROR', 'DUPLICATE_ASSET_TAG', 'DUPLICATE_SERIAL', 'DUPLICATE_EMAIL',
])

export function messageFor(error) {
  if (!error) return ''
  if (!(error instanceof ApiError)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (error.message && error.message !== error.code) return error.message
  return FALLBACKS[error.code] ?? 'Something went wrong. Please try again.'
}

export function fieldErrorsOf(error) {
  if (!(error instanceof ApiError)) return {}
  if (!FIELD_CODES.has(error.code)) return {}
  return error.details ?? {}
}
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 9: Commit**

```bash
git add client/src/lib
git commit -m "feat(lib): add timestamp formatting and error translation"
```

---

## Task 5: The API layer and query hooks

Everything above this line is mock-agnostic. Nothing in `api/` or `hooks/` may mention MSW.

**Files:**
- Create: `client/src/api/client.js`, `client/src/api/devices.js`, `client/src/api/employees.js`, `client/src/api/assignments.js`, `client/src/api/dashboard.js`
- Create: `client/src/hooks/useDevices.js`, `client/src/hooks/useEmployees.js`, `client/src/hooks/useAssignments.js`, `client/src/hooks/useDashboard.js`
- Create: `client/src/test/renderWithProviders.jsx`
- Test: `client/src/api/client.test.js`

**Interfaces:**
- Consumes: `ApiError` from `../lib/errors.js`.
- Produces:
  - `request(path, { method, body, params }) -> Promise<{ data, warning? }>`
  - `listDevices(params)`, `getDevice(id)`, `createDevice(body)`, `updateDevice(id, body)`, `retireDevice(id)`
  - `listEmployees(params)`, `getEmployee(id)`, `createEmployee(body)`, `updateEmployee(id, body)`, `resignEmployee(id)`
  - `listAssignments(params)`, `issueDevice(body) -> { data, warning }`, `returnDevice(id, body)`
  - `getDashboard()`
  - Hooks: `useDeviceList(params)`, `useDevice(id)`, `useCreateDevice()`, `useUpdateDevice()`, `useRetireDevice()`, and the equivalents for employees, assignments, and the dashboard.
  - `renderWithProviders(ui, { route })` for component tests.

- [ ] **Step 1: Write the failing client tests**

`client/src/api/client.test.js`:

```js
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server.js'
import { ApiError } from '../lib/errors.js'
import { request } from './client.js'
import { listDevices, createDevice } from './devices.js'
import { issueDevice } from './assignments.js'
import { db } from '../mocks/db.js'

test('request unwraps the data envelope', async () => {
  const { data } = await request('/devices')
  expect(Array.isArray(data)).toBe(true)
})

test('request throws an ApiError carrying the server code and details', async () => {
  await expect(request('/devices/nope')).rejects.toMatchObject({
    name: 'ApiError', status: 404, code: 'NOT_FOUND',
  })
})

test('request passes the warning through alongside the data', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const holder = db.employees.find((e) => e.id === open.employee_id && e.status === 'active')
  const held = db.devices.find((d) => d.id === open.device_id)
  const another = db.devices.find(
    (d) => d.type === held.type && d.status === 'available' &&
      !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))

  const result = await issueDevice({ device_id: another.id, employee_id: holder.id })
  expect(result.warning.code).toBe('SAME_TYPE_ALREADY_HELD')
  expect(result.data.id).toEqual(expect.any(String))
})

test('params are serialised and blank ones are dropped', async () => {
  let seen = null
  server.use(http.get('*/api/devices', ({ request: req }) => {
    seen = new URL(req.url).searchParams
    return HttpResponse.json({ data: [] })
  }))
  await listDevices({ type: 'laptop', status: '', q: undefined, held: false })
  expect(seen.get('type')).toBe('laptop')
  expect(seen.has('status')).toBe(false)
  expect(seen.has('q')).toBe(false)
  expect(seen.get('held')).toBe('false')
})

test('a non-JSON server response still raises a readable ApiError', async () => {
  server.use(http.get('*/api/devices', () => new HttpResponse('<html>502</html>', { status: 502 })))
  const error = await listDevices().catch((e) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect(error.status).toBe(502)
})

test('createDevice posts JSON and returns the created device', async () => {
  const { data } = await createDevice({
    asset_tag: 'ASP-8888', type: 'mobile', brand: 'Apple', model: 'iPhone 15', os: 'ios',
  })
  expect(data.asset_tag).toBe('ASP-8888')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- client`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the fetch wrapper**

`client/src/api/client.js`:

```js
import { ApiError } from '../lib/errors.js'

const BASE = import.meta.env?.VITE_API_BASE_URL || ''

function buildUrl(path, params) {
  const url = `${BASE}/api${path}`
  if (!params) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request(path, { method = 'GET', body, params } = {}) {
  let response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    // Network-level failure — messageFor() renders this as a connection problem.
    throw cause
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'UNKNOWN',
      message: payload?.error?.message ?? '',
      details: payload?.error?.details ?? {},
    })
  }
  return { data: payload?.data, warning: payload?.warning }
}
```

- [ ] **Step 4: Implement the resource modules**

`client/src/api/devices.js`:

```js
import { request } from './client.js'

export const listDevices = (params) => request('/devices', { params })
export const getDevice = (id) => request(`/devices/${id}`)
export const createDevice = (body) => request('/devices', { method: 'POST', body })
export const updateDevice = (id, body) => request(`/devices/${id}`, { method: 'PATCH', body })
export const retireDevice = (id) => request(`/devices/${id}/retire`, { method: 'POST', body: {} })
```

`client/src/api/employees.js`:

```js
import { request } from './client.js'

export const listEmployees = (params) => request('/employees', { params })
export const getEmployee = (id) => request(`/employees/${id}`)
export const createEmployee = (body) => request('/employees', { method: 'POST', body })
export const updateEmployee = (id, body) => request(`/employees/${id}`, { method: 'PATCH', body })
export const resignEmployee = (id) => request(`/employees/${id}/resign`, { method: 'POST', body: {} })
```

`client/src/api/assignments.js`:

```js
import { request } from './client.js'

export const listAssignments = (params) => request('/assignments', { params })
export const issueDevice = (body) => request('/assignments', { method: 'POST', body })
export const returnDevice = (id, body) =>
  request(`/assignments/${id}/return`, { method: 'POST', body })
```

`client/src/api/dashboard.js`:

```js
import { request } from './client.js'

export const getDashboard = () => request('/dashboard')
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- client`
Expected: PASS, 6 tests.

- [ ] **Step 6: Implement the query hooks**

Every mutation invalidates the query keys a change can affect. Issuing a device changes the device, the employee, the assignment log, and the dashboard — so all four are invalidated. Being generous here is what stops stale holder names appearing after a return.

`client/src/hooks/useDevices.js`:

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listDevices, getDevice, createDevice, updateDevice, retireDevice } from '../api/devices.js'

export const deviceKeys = {
  all: ['devices'],
  list: (params) => ['devices', 'list', params ?? {}],
  detail: (id) => ['devices', 'detail', id],
}

export function useDeviceList(params) {
  return useQuery({
    queryKey: deviceKeys.list(params),
    queryFn: () => listDevices(params).then((r) => r.data),
  })
}

export function useDevice(id) {
  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => getDevice(id).then((r) => r.data),
    enabled: Boolean(id),
  })
}

function useDeviceMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCreateDevice = () => useDeviceMutation((body) => createDevice(body).then((r) => r.data))
export const useUpdateDevice = () =>
  useDeviceMutation(({ id, ...body }) => updateDevice(id, body).then((r) => r.data))
export const useRetireDevice = () => useDeviceMutation((id) => retireDevice(id).then((r) => r.data))
```

`client/src/hooks/useEmployees.js`:

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, resignEmployee,
} from '../api/employees.js'

export const employeeKeys = {
  all: ['employees'],
  list: (params) => ['employees', 'list', params ?? {}],
  detail: (id) => ['employees', 'detail', id],
}

export function useEmployeeList(params) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => listEmployees(params).then((r) => r.data),
  })
}

export function useEmployee(id) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => getEmployee(id).then((r) => r.data),
    enabled: Boolean(id),
  })
}

function useEmployeeMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCreateEmployee = () =>
  useEmployeeMutation((body) => createEmployee(body).then((r) => r.data))
export const useUpdateEmployee = () =>
  useEmployeeMutation(({ id, ...body }) => updateEmployee(id, body).then((r) => r.data))
export const useResignEmployee = () =>
  useEmployeeMutation((id) => resignEmployee(id).then((r) => r.data))
```

`client/src/hooks/useAssignments.js` — note that `useIssueDevice` returns the **whole envelope**, warning included, because the issue dialog needs it:

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAssignments, issueDevice, returnDevice } from '../api/assignments.js'
import { deviceKeys } from './useDevices.js'
import { employeeKeys } from './useEmployees.js'

export const assignmentKeys = {
  all: ['assignments'],
  list: (params) => ['assignments', 'list', params ?? {}],
}

export function useAssignmentList(params) {
  return useQuery({
    queryKey: assignmentKeys.list(params),
    queryFn: () => listAssignments(params).then((r) => r.data),
  })
}

function useHandoutMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // A handout changes the device, the employee, the log, and the counts.
      qc.invalidateQueries({ queryKey: deviceKeys.all })
      qc.invalidateQueries({ queryKey: employeeKeys.all })
      qc.invalidateQueries({ queryKey: assignmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// Resolves to { data, warning } — the dialog reads the warning.
export const useIssueDevice = () => useHandoutMutation((body) => issueDevice(body))
export const useReturnDevice = () =>
  useHandoutMutation(({ id, ...body }) => returnDevice(id, body).then((r) => r.data))
```

`client/src/hooks/useDashboard.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api/dashboard.js'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard().then((r) => r.data),
  })
}
```

- [ ] **Step 7: Write the test render helper**

`client/src/test/renderWithProviders.jsx` — retries off so error-path tests fail fast rather than hanging:

```jsx
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

export function renderWithProviders(ui, { route = '/', path = '*' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 9: Commit**

```bash
git add client/src/api client/src/hooks client/src/test
git commit -m "feat(api): add fetch wrapper, resource modules, and query hooks"
```

---

## Task 6: App shell, routing, and the UI primitives

AKM's conventions: fixed left sidebar with the product name at the top, nav links with an active state, a page header with a title and one action slot, content below. Every later task builds inside this frame, so the shared primitives land here too.

**Files:**
- Create: `client/src/components/layout/AppLayout.jsx`, `Sidebar.jsx`, `PageHeader.jsx`
- Create: `client/src/components/ui/Button.jsx`, `Field.jsx`, `Modal.jsx`, `DataTable.jsx`, `FilterChips.jsx`, `SearchInput.jsx`, `StatusBadge.jsx`, `ErrorBanner.jsx`
- Modify: `client/src/App.jsx`, `client/src/main.jsx`
- Test: `client/src/components/layout/AppLayout.test.jsx`, `client/src/components/ui/ui.test.jsx`

**Interfaces:**
- Consumes: `messageFor` from `../../lib/errors.js`.
- Produces:
  - `<AppLayout />` — renders `<Sidebar/>` and `<Outlet/>`
  - `<PageHeader title subtitle actions />`
  - `<Button variant="primary|secondary|danger" ...props />`
  - `<Field label error htmlFor children />`
  - `<Modal open onClose title children footer />`
  - `<DataTable columns rows getRowKey onRowClick emptyMessage isLoading error />` where `columns` is `[{ key, header, render(row), className }]`
  - `<FilterChips options value onChange label />` where `options` is `[{ value, label }]`
  - `<SearchInput value onChange placeholder />` — debounced 250ms internally, calls `onChange` with the raw string
  - `<StatusBadge status />` — accepts `available|repair|retired|active|resigned|issued`
  - `<ErrorBanner error />` — renders nothing when `error` is falsy

- [ ] **Step 1: Write the failing shell tests**

`client/src/components/layout/AppLayout.test.jsx`:

```jsx
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders.jsx'
import AppLayout from './AppLayout.jsx'

test('the sidebar links to every top-level screen', () => {
  renderWithProviders(<AppLayout />, { route: '/devices' })
  for (const name of ['Dashboard', 'Devices', 'Employees', 'Handouts', 'Import']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
})

test('the link for the current route is marked as current', () => {
  renderWithProviders(<AppLayout />, { route: '/devices' })
  expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Employees' })).not.toHaveAttribute('aria-current')
})

test('the product name is present as a banner', () => {
  renderWithProviders(<AppLayout />, { route: '/' })
  expect(screen.getByText('Device Handout Tracker')).toBeInTheDocument()
})
```

`client/src/components/ui/ui.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../../lib/errors.js'
import DataTable from './DataTable.jsx'
import FilterChips from './FilterChips.jsx'
import ErrorBanner from './ErrorBanner.jsx'
import Modal from './Modal.jsx'
import StatusBadge from './StatusBadge.jsx'

const columns = [
  { key: 'tag', header: 'Asset tag', render: (r) => r.tag },
  { key: 'holder', header: 'Holder', render: (r) => r.holder ?? '—' },
]

test('DataTable renders a row per item', () => {
  render(<DataTable columns={columns} rows={[{ id: '1', tag: 'ASP-0001', holder: 'Maria Santos' }]}
                    getRowKey={(r) => r.id} />)
  expect(screen.getByText('ASP-0001')).toBeInTheDocument()
  expect(screen.getByText('Maria Santos')).toBeInTheDocument()
})

// Review Focus #5
test('DataTable shows the empty message instead of a bare header when there are no rows', () => {
  render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id}
                    emptyMessage="No devices match these filters." />)
  expect(screen.getByText('No devices match these filters.')).toBeInTheDocument()
})

test('DataTable shows a loading state and no empty message while loading', () => {
  render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id} isLoading
                    emptyMessage="No devices." />)
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByText('No devices.')).not.toBeInTheDocument()
})

test('DataTable surfaces an error instead of pretending the list is empty', () => {
  render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id}
                    error={new ApiError({ status: 500, code: 'UNKNOWN', message: 'Server exploded.' })}
                    emptyMessage="No devices." />)
  expect(screen.getByText('Server exploded.')).toBeInTheDocument()
  expect(screen.queryByText('No devices.')).not.toBeInTheDocument()
})

test('FilterChips reports the chosen value and marks it pressed', async () => {
  const onChange = vi.fn()
  render(<FilterChips label="Type" value="all" onChange={onChange}
                      options={[{ value: 'all', label: 'All' }, { value: 'laptop', label: 'Laptops' }]} />)
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Laptops' }))
  expect(onChange).toHaveBeenCalledWith('laptop')
})

test('ErrorBanner renders nothing when there is no error', () => {
  const { container } = render(<ErrorBanner error={null} />)
  expect(container).toBeEmptyDOMElement()
})

test('ErrorBanner uses the human message, never the raw code', () => {
  render(<ErrorBanner error={new ApiError({ status: 409, code: 'DEVICE_RETIRED', message: '' })} />)
  expect(screen.getByRole('alert')).toHaveTextContent(/retired/i)
  expect(screen.queryByText(/DEVICE_RETIRED/)).not.toBeInTheDocument()
})

test('Modal renders nothing when closed and a dialog when open', async () => {
  const onClose = vi.fn()
  const { rerender } = render(<Modal open={false} onClose={onClose} title="Issue device"><p>Body</p></Modal>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  rerender(<Modal open onClose={onClose} title="Issue device"><p>Body</p></Modal>)
  expect(screen.getByRole('dialog', { name: 'Issue device' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('StatusBadge labels every status it can receive', () => {
  for (const [status, label] of Object.entries({
    available: 'Available', repair: 'In repair', retired: 'Retired',
    issued: 'Issued', active: 'Active', resigned: 'Resigned',
  })) {
    const { unmount } = render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
    unmount()
  }
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- AppLayout ui`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the UI primitives**

`client/src/components/ui/Button.jsx`:

```jsx
const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-bad-700 text-white hover:bg-red-800 focus-visible:outline-bad-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

export default function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2
                  text-sm font-medium transition-colors focus-visible:outline
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  disabled:cursor-not-allowed disabled:opacity-50
                  ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
```

`client/src/components/ui/Field.jsx`:

```jsx
export default function Field({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-bad-700" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-bad-700">{error}</p>}
    </div>
  )
}

export const inputClass =
  'rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600'
```

`client/src/components/ui/StatusBadge.jsx`:

```jsx
const STYLES = {
  available: ['Available', 'bg-ok-50 text-ok-700'],
  issued:    ['Issued',    'bg-brand-50 text-brand-700'],
  repair:    ['In repair', 'bg-warn-50 text-warn-700'],
  retired:   ['Retired',   'bg-slate-100 text-slate-600'],
  active:    ['Active',    'bg-ok-50 text-ok-700'],
  resigned:  ['Resigned',  'bg-slate-100 text-slate-600'],
}

export default function StatusBadge({ status }) {
  const [label, classes] = STYLES[status] ?? [status, 'bg-slate-100 text-slate-600']
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}
```

`client/src/components/ui/ErrorBanner.jsx`:

```jsx
import { messageFor } from '../../lib/errors.js'

export default function ErrorBanner({ error, className = '' }) {
  if (!error) return null
  return (
    <div role="alert"
         className={`rounded-lg bg-bad-50 px-4 py-3 text-sm text-bad-700 ring-1 ring-inset ring-red-200 ${className}`}>
      {messageFor(error)}
    </div>
  )
}
```

`client/src/components/ui/DataTable.jsx`:

```jsx
import ErrorBanner from './ErrorBanner.jsx'

export default function DataTable({
  columns, rows, getRowKey, onRowClick,
  emptyMessage = 'Nothing to show yet.', isLoading = false, error = null,
}) {
  if (error) return <ErrorBanner error={error} />

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide
                              text-slate-500 ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 text-sm text-slate-700 ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {isLoading && (
        <p role="status" className="px-4 py-10 text-center text-sm text-slate-500">Loading…</p>
      )}
      {!isLoading && rows.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  )
}
```

`client/src/components/ui/FilterChips.jsx`:

```jsx
export default function FilterChips({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selected
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
            }`}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
```

`client/src/components/ui/SearchInput.jsx` — debounced so typing does not fire a request per keystroke, but the value shown updates immediately:

```jsx
import { useEffect, useState } from 'react'
import { inputClass } from './Field.jsx'

export default function SearchInput({ value, onChange, placeholder = 'Search…', delay = 250 }) {
  const [draft, setDraft] = useState(value ?? '')

  useEffect(() => { setDraft(value ?? '') }, [value])

  useEffect(() => {
    if (draft === (value ?? '')) return
    const timer = setTimeout(() => onChange(draft), delay)
    return () => clearTimeout(timer)
  }, [draft, delay])          // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="search"
      role="searchbox"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      className={`${inputClass} w-full max-w-xs`}
    />
  )
}
```

`client/src/components/ui/Modal.jsx`:

```jsx
import { useEffect, useId, useRef } from 'react'

export default function Modal({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl outline-none">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement the layout**

`client/src/components/layout/Sidebar.jsx`:

```jsx
import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/devices', label: 'Devices' },
  { to: '/employees', label: 'Employees' },
  { to: '/handouts', label: 'Handouts' },
  { to: '/import', label: 'Import' },
]

export default function Sidebar() {
  return (
    <nav aria-label="Main" className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-sm font-semibold text-slate-900">Device Handout Tracker</p>
        <p className="text-xs text-slate-500">Adspark IT</p>
      </div>
      <ul className="flex flex-col gap-0.5 p-3">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              aria-current={undefined}>
              {({ isActive }) => <span aria-current={isActive ? 'page' : undefined}>{link.label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

**Note on `aria-current`:** `NavLink` sets `aria-current="page"` on the anchor itself by default. Do not pass a render-prop child as sketched above — it moves the attribute onto a `<span>` and the test asserts it is on the link. Use the simpler form:

```jsx
<NavLink
  to={link.to}
  end={link.end}
  className={({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
    }`}>
  {link.label}
</NavLink>
```

`client/src/components/layout/PageHeader.jsx`:

```jsx
export default function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {back}
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
```

`client/src/components/layout/AppLayout.jsx`:

```jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-auto px-8 py-7">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Wire the routes**

Create placeholder pages so routing can be verified before the real screens exist. Each one is replaced in a later task.

```bash
mkdir -p client/src/pages
for p in Dashboard Devices DeviceDetail Employees EmployeeDetail Handouts Import Login; do
  printf 'export default function %sPage() {\n  return <p>%s</p>\n}\n' "$p" "$p" \
    > "client/src/pages/${p}Page.jsx"
done
```

`client/src/App.jsx`:

```jsx
import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DevicesPage from './pages/DevicesPage.jsx'
import DeviceDetailPage from './pages/DeviceDetailPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import EmployeeDetailPage from './pages/EmployeeDetailPage.jsx'
import HandoutsPage from './pages/HandoutsPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="devices/:id" element={<DeviceDetailPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="handouts" element={<HandoutsPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
      <Route path="*" element={<p className="p-8">Page not found.</p>} />
    </Routes>
  )
}
```

Delete the now-obsolete `client/src/App.test.jsx` from Task 1 — the shell tests replace it.

```bash
rm client/src/App.test.jsx
```

- [ ] **Step 6: Start MSW in the browser**

`client/src/main.jsx` — the **only** file above `mocks/` that may mention the mock:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

// FE phases only. Deleted at cutover — see §10 of the spec.
async function startMocks() {
  if (!import.meta.env.DEV) return
  const { worker } = await import('./mocks/browser.js')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

startMocks().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
})
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: PASS, all tests including the 3 layout tests and 9 UI tests.

- [ ] **Step 8: Verify in the browser**

Run: `npm run dev`
Expected: the sidebar renders with five links, clicking each changes the content, the active link is highlighted, and the browser console shows `[MSW] Mocking enabled.` Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): add app shell, routing, and shared components"
```

---

# FE-2 — Devices

## Task 7: The devices list

Spec §7: "Table of all devices. Search by asset tag, serial, model. Filter chips: All / Laptops / Mobiles, and Available / Issued / Repair / Retired. Shows current holder inline."

Note the mismatch the chips have to bridge: **Issued is not a status.** The Available / Issued / Repair / Retired chip group maps onto two different query parameters — `held=true` for Issued, `held=false&status=available` for Available, and `status=` for the other two.

**Files:**
- Create: `client/src/components/devices/DeviceTable.jsx`
- Rewrite: `client/src/pages/DevicesPage.jsx`
- Test: `client/src/pages/DevicesPage.test.jsx`

**Interfaces:**
- Consumes: `useDeviceList` from `../hooks/useDevices.js`; `DataTable`, `FilterChips`, `SearchInput`, `StatusBadge`, `Button`; `formatDate` from `../lib/format.js`.
- Produces: `<DeviceTable devices isLoading error />`; `deviceQueryFor(typeChip, stateChip, q)` exported from `DevicesPage.jsx` for direct testing.

- [ ] **Step 1: Write the failing tests**

`client/src/pages/DevicesPage.test.jsx`:

```jsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import DevicesPage, { deviceQueryFor } from './DevicesPage.jsx'
import { db } from '../mocks/db.js'

const render = () => renderWithProviders(<DevicesPage />, { route: '/devices' })
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('deviceQueryFor', () => {
  test('"Issued" asks for held devices, not a status', () => {
    expect(deviceQueryFor('all', 'issued', '')).toEqual({ held: 'true' })
  })

  test('"Available" means free AND lifecycle-available', () => {
    expect(deviceQueryFor('all', 'available', '')).toEqual({ held: 'false', status: 'available' })
  })

  test('"Repair" and "Retired" are plain status filters', () => {
    expect(deviceQueryFor('all', 'repair', '')).toEqual({ status: 'repair' })
    expect(deviceQueryFor('all', 'retired', '')).toEqual({ status: 'retired' })
  })

  test('the type chip and the search box are carried through', () => {
    expect(deviceQueryFor('laptop', 'all', 'asp')).toEqual({ type: 'laptop', q: 'asp' })
  })

  test('"all" chips and a blank search add nothing', () => {
    expect(deviceQueryFor('all', 'all', '')).toEqual({})
  })
})

test('every device is listed with its asset tag and model', async () => {
  render()
  await waitFor(() => expect(rows().length).toBe(db.devices.length))
  expect(screen.getByText('ASP-0001')).toBeInTheDocument()
})

test('a held device shows its holder and the date it went out', async () => {
  render()
  const open = db.assignments.find((a) => a.returned_at === null)
  const device = db.devices.find((d) => d.id === open.device_id)
  const employee = db.employees.find((e) => e.id === open.employee_id)

  const row = await screen.findByText(device.asset_tag).then((el) => el.closest('tr'))
  expect(within(row).getByText(employee.full_name)).toBeInTheDocument()
  expect(within(row).getByText('Issued')).toBeInTheDocument()
})

test('a free device shows no holder', async () => {
  render()
  const free = db.devices.find(
    (d) => d.status === 'available' &&
      !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
  const row = await screen.findByText(free.asset_tag).then((el) => el.closest('tr'))
  expect(within(row).getByText('Available')).toBeInTheDocument()
  expect(within(row).getByText('—')).toBeInTheDocument()
})

test('the Laptops chip narrows the table to laptops', async () => {
  render()
  await waitFor(() => expect(rows().length).toBe(db.devices.length))
  await userEvent.click(screen.getByRole('button', { name: 'Laptops' }))
  await waitFor(() => {
    expect(rows().length).toBe(db.devices.filter((d) => d.type === 'laptop').length)
  })
})

test('the Issued chip shows only devices that are out', async () => {
  render()
  await userEvent.click(screen.getByRole('button', { name: 'Issued' }))
  const expected = db.assignments.filter((a) => a.returned_at === null).length
  await waitFor(() => expect(rows().length).toBe(expected))
})

// Review Focus #4
test('search is case-insensitive and ignores surrounding whitespace', async () => {
  render()
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
  await userEvent.type(screen.getByRole('searchbox'), '  asp-0001  ')
  await waitFor(() => expect(rows().length).toBe(1), { timeout: 2000 })
  expect(screen.getByText('ASP-0001')).toBeInTheDocument()
})

// Review Focus #5
test('a filter combination matching nothing shows a readable empty state', async () => {
  render()
  await userEvent.type(screen.getByRole('searchbox'), 'zzzznothing')
  await waitFor(() => {
    expect(screen.getByText(/no devices match/i)).toBeInTheDocument()
  }, { timeout: 2000 })
  expect(screen.queryAllByRole('row').length).toBe(1)     // header only
})

test('clicking a row opens that device', async () => {
  render()
  const row = await screen.findByText('ASP-0001').then((el) => el.closest('tr'))
  await userEvent.click(row)
  const device = db.devices.find((d) => d.asset_tag === 'ASP-0001')
  expect(window.location.pathname === `/devices/${device.id}` ||
         screen.queryByText('DeviceDetail')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- DevicesPage`
Expected: FAIL — `deviceQueryFor` is not exported.

- [ ] **Step 3: Implement the table**

`client/src/components/devices/DeviceTable.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import DataTable from '../ui/DataTable.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import { formatDate } from '../../lib/format.js'

// A device that is out reads as "Issued" even though its stored status is
// "available" — issued is derived from an open assignment, never stored (§4).
const displayStatus = (device) =>
  device.current_holder ? 'issued' : device.status

const columns = [
  {
    key: 'asset_tag', header: 'Asset tag',
    render: (d) => <span className="font-medium text-slate-900">{d.asset_tag}</span>,
  },
  {
    key: 'device', header: 'Device',
    render: (d) => (
      <div>
        <p className="text-slate-900">{d.model ?? '—'}</p>
        <p className="text-xs text-slate-500">{d.brand ?? ''}</p>
      </div>
    ),
  },
  { key: 'type', header: 'Type', render: (d) => (d.type === 'laptop' ? 'Laptop' : 'Mobile') },
  { key: 'serial', header: 'Serial', render: (d) => d.serial_number ?? '—' },
  { key: 'status', header: 'Status', render: (d) => <StatusBadge status={displayStatus(d)} /> },
  {
    key: 'holder', header: 'Held by',
    render: (d) => (d.current_holder ? d.current_holder.full_name : '—'),
  },
  {
    key: 'since', header: 'Since',
    render: (d) => (d.current_holder ? formatDate(d.current_holder.issued_at) : '—'),
  },
]

export default function DeviceTable({ devices = [], isLoading, error }) {
  const navigate = useNavigate()
  return (
    <DataTable
      columns={columns}
      rows={devices}
      getRowKey={(d) => d.id}
      onRowClick={(d) => navigate(`/devices/${d.id}`)}
      isLoading={isLoading}
      error={error}
      emptyMessage="No devices match these filters."
    />
  )
}
```

- [ ] **Step 4: Implement the page**

`client/src/pages/DevicesPage.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import SearchInput from '../components/ui/SearchInput.jsx'
import DeviceTable from '../components/devices/DeviceTable.jsx'
import { useDeviceList } from '../hooks/useDevices.js'

const TYPE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'laptop', label: 'Laptops' },
  { value: 'mobile', label: 'Mobiles' },
]

const STATE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'issued', label: 'Issued' },
  { value: 'repair', label: 'Repair' },
  { value: 'retired', label: 'Retired' },
]

/**
 * The chips are a UI vocabulary; §6 is the API vocabulary. "Issued" is not a
 * status — it is the presence of an open assignment — so it maps to `held`.
 * "Available" means both free AND lifecycle-available, otherwise a device in
 * repair would show up as available simply because nobody holds it.
 */
export function deviceQueryFor(type, state, q) {
  const params = {}
  if (type !== 'all') params.type = type
  if (state === 'issued') params.held = 'true'
  else if (state === 'available') { params.held = 'false'; params.status = 'available' }
  else if (state !== 'all') params.status = state
  if (q.trim()) params.q = q.trim()
  return params
}

export default function DevicesPage() {
  const navigate = useNavigate()
  const [type, setType] = useState('all')
  const [state, setState] = useState('all')
  const [q, setQ] = useState('')

  const params = deviceQueryFor(type, state, q)
  const { data: devices, isPending, error } = useDeviceList(params)

  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Every laptop and mobile on the register."
        actions={<Button onClick={() => navigate('/devices/new')}>Add device</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SearchInput value={q} onChange={setQ} placeholder="Asset tag, serial, or model…" />
        <FilterChips label="Type" options={TYPE_CHIPS} value={type} onChange={setType} />
        <FilterChips label="Status" options={STATE_CHIPS} value={state} onChange={setState} />
      </div>

      <DeviceTable devices={devices ?? []} isLoading={isPending} error={error} />
    </>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- DevicesPage`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/DevicesPage.jsx client/src/pages/DevicesPage.test.jsx client/src/components/devices
git commit -m "feat(devices): add the device list with search and filter chips"
```

---

## Task 8: The device detail page

Spec §7: "Device detail. Current holder card. Issue or Return button. Full chronological history."

The issue and return dialogs arrive in Tasks 13 and 14. This task renders the page and the buttons, and wires the buttons to local state that the dialogs will later read.

**Review Focus #2 lives here:** a device that has been returned is `available` and has no holder card, yet its history must still be fully visible. Getting this wrong makes the system forget the thing it exists to remember.

**Files:**
- Create: `client/src/components/handouts/HistoryTimeline.jsx`
- Rewrite: `client/src/pages/DeviceDetailPage.jsx`
- Test: `client/src/pages/DeviceDetailPage.test.jsx`

**Interfaces:**
- Consumes: `useDevice`, `useRetireDevice`; `formatDateTime`, `formatDate`, `formatDuration`.
- Produces: `<HistoryTimeline entries perspective="device"|"employee" />` — `perspective` decides whether each entry names the employee or the device.

- [ ] **Step 1: Write the failing tests**

`client/src/pages/DeviceDetailPage.test.jsx`:

```jsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import DeviceDetailPage from './DeviceDetailPage.jsx'
import { db } from '../mocks/db.js'

const show = (id) =>
  renderWithProviders(<DeviceDetailPage />, { route: `/devices/${id}`, path: '/devices/:id' })

const heldDevice = () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  return { device: db.devices.find((d) => d.id === open.device_id), assignment: open }
}
const freeWithHistory = () =>
  db.devices.find((d) => d.status === 'available' &&
    !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null) &&
    db.assignments.some((a) => a.device_id === d.id))

test('a held device shows the holder, the handout date, and a Return button', async () => {
  const { device, assignment } = heldDevice()
  const employee = db.employees.find((e) => e.id === assignment.employee_id)
  show(device.id)

  expect(await screen.findByRole('heading', { name: device.asset_tag })).toBeInTheDocument()
  expect(screen.getByText(employee.full_name)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /return/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^issue/i })).not.toBeInTheDocument()
})

test('a free device shows an Issue button and no holder card', async () => {
  const free = db.devices.find(
    (d) => d.status === 'available' &&
      !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
  show(free.id)

  expect(await screen.findByRole('button', { name: /^issue/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /return/i })).not.toBeInTheDocument()
  expect(screen.getByText(/not currently issued/i)).toBeInTheDocument()
})

// Review Focus #2
test('a returned device keeps its full history even though nobody holds it', async () => {
  const device = freeWithHistory()
  const past = db.assignments.filter((a) => a.device_id === device.id)
  show(device.id)

  await screen.findByRole('heading', { name: device.asset_tag })
  expect(screen.getByText(/not currently issued/i)).toBeInTheDocument()

  const historyRegion = screen.getByRole('region', { name: /history/i })
  for (const a of past) {
    const employee = db.employees.find((e) => e.id === a.employee_id)
    expect(historyRegion).toHaveTextContent(employee.full_name)
  }
})

test('history is newest first and closed entries show the return reason', async () => {
  const device = db.devices[0]         // ASP-0001 — three handouts, two closed
  show(device.id)

  const region = await screen.findByRole('region', { name: /history/i })
  const entries = within(region).getAllByRole('listitem')
  expect(entries).toHaveLength(3)
  expect(region).toHaveTextContent(/swap/i)
  expect(region).toHaveTextContent(/resignation/i)
})

// Review Focus #5
test('a device with no history says so instead of showing an empty list', async () => {
  const untouched = db.devices.find((d) => !db.assignments.some((a) => a.device_id === d.id))
  show(untouched.id)
  expect(await screen.findByText(/never been issued/i)).toBeInTheDocument()
})

test('a retired device offers neither Issue nor Retire', async () => {
  const retired = db.devices.find((d) => d.status === 'retired')
  show(retired.id)
  await screen.findByRole('heading', { name: retired.asset_tag })
  expect(screen.queryByRole('button', { name: /^issue/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /retire/i })).not.toBeInTheDocument()
})

test('retiring a free device updates the page', async () => {
  const free = db.devices.find(
    (d) => d.status === 'available' &&
      !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
  show(free.id)

  await userEvent.click(await screen.findByRole('button', { name: /retire/i }))
  await userEvent.click(screen.getByRole('button', { name: /^retire device$/i }))
  await waitFor(() => expect(screen.getByText('Retired')).toBeInTheDocument())
})

test('an unknown device id shows a readable message', async () => {
  show('nope')
  expect(await screen.findByText(/no longer exists|not found/i)).toBeInTheDocument()
})
```

Add the missing import at the top of the file:

```js
import { within } from '@testing-library/react'
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- DeviceDetailPage`
Expected: FAIL — the page still renders the placeholder.

- [ ] **Step 3: Implement the history timeline**

`client/src/components/handouts/HistoryTimeline.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { formatDateTime, formatDuration } from '../../lib/format.js'

const REASONS = {
  resignation: 'Resignation', swap: 'Swap', repair: 'Repair',
  lost: 'Lost', other: 'Other',
}

export default function HistoryTimeline({ entries = [], perspective = 'device', emptyMessage }) {
  if (entries.length === 0) {
    return <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
      {emptyMessage}
    </p>
  }

  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200">
      {entries.map((entry) => {
        const open = entry.returned_at === null
        const subject = perspective === 'device'
          ? { label: entry.employee_name, to: `/employees/${entry.employee_id}` }
          : { label: `${entry.asset_tag} · ${entry.device_model ?? ''}`, to: `/devices/${entry.device_id}` }

        return (
          <li key={entry.id} className="bg-white px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to={subject.to} className="text-sm font-medium text-brand-700 hover:underline">
                {subject.label}
              </Link>
              <span className={`text-xs font-medium ${open ? 'text-ok-700' : 'text-slate-500'}`}>
                {open ? `Still held · ${formatDuration(entry.issued_at)}` : REASONS[entry.return_reason] ?? 'Returned'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Issued {formatDateTime(entry.issued_at)}
              {entry.returned_at && <> · Returned {formatDateTime(entry.returned_at)}</>}
            </p>
            {entry.notes && <p className="mt-1 text-xs text-slate-600">{entry.notes}</p>}
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 4: Implement the page**

`client/src/pages/DeviceDetailPage.jsx`:

```jsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import HistoryTimeline from '../components/handouts/HistoryTimeline.jsx'
import { useDevice, useRetireDevice } from '../hooks/useDevices.js'
import { formatDateTime, formatDuration } from '../lib/format.js'

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  )
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const { data: device, isPending, error } = useDevice(id)
  const retire = useRetireDevice()
  const [confirmingRetire, setConfirmingRetire] = useState(false)

  if (isPending) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (error) return <ErrorBanner error={error} />

  const holder = device.current_holder
  const canIssue = !holder && device.status === 'available'
  const canRetire = !holder && device.status !== 'retired'

  return (
    <>
      <PageHeader
        back={<Link to="/devices" className="mb-1 block text-sm text-brand-700 hover:underline">← Devices</Link>}
        title={device.asset_tag}
        subtitle={[device.brand, device.model].filter(Boolean).join(' ')}
        actions={
          <>
            {canIssue && <Button onClick={() => { /* wired in Task 13 */ }}>Issue device</Button>}
            {holder && <Button onClick={() => { /* wired in Task 14 */ }}>Return device</Button>}
            {canRetire && (
              <Button variant="secondary" onClick={() => setConfirmingRetire(true)}>Retire</Button>
            )}
          </>
        }
      />

      <ErrorBanner error={retire.error} className="mb-4" />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <div className="mb-4 flex items-center gap-2">
              <StatusBadge status={holder ? 'issued' : device.status} />
            </div>
            {holder ? (
              <div className="rounded-lg bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-wide text-brand-700">Currently held by</p>
                <Link to={`/employees/${holder.employee_id}`}
                      className="mt-1 block text-lg font-semibold text-slate-900 hover:underline">
                  {holder.full_name}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  Since {formatDateTime(holder.issued_at)} · {formatDuration(holder.issued_at)}
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                This device is not currently issued to anyone.
              </p>
            )}
          </div>

          <section aria-label="Handout history">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Handout history</h2>
            <HistoryTimeline
              entries={device.history}
              perspective="device"
              emptyMessage="This device has never been issued."
            />
          </section>
        </section>

        <dl className="flex h-fit flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <Detail label="Type" value={device.type === 'laptop' ? 'Laptop' : 'Mobile'} />
          <Detail label="Brand" value={device.brand} />
          <Detail label="Model" value={device.model} />
          <Detail label="Serial number" value={device.serial_number} />
          <Detail label="Operating system" value={device.os} />
          <Detail label="Notes" value={device.notes} />
          <Detail label="Added" value={formatDateTime(device.created_at)} />
        </dl>
      </div>

      <Modal
        open={confirmingRetire}
        onClose={() => setConfirmingRetire(false)}
        title={`Retire ${device.asset_tag}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingRetire(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={retire.isPending}
              onClick={() => retire.mutate(device.id, { onSuccess: () => setConfirmingRetire(false) })}>
              Retire device
            </Button>
          </>
        }>
        <p className="text-sm text-slate-600">
          A retired device can no longer be issued. Its handout history is kept in full.
        </p>
      </Modal>
    </>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- DeviceDetailPage`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/DeviceDetailPage.jsx client/src/pages/DeviceDetailPage.test.jsx client/src/components/handouts
git commit -m "feat(devices): add device detail with holder card and history"
```

---

## Task 9: Add and edit a device

One form component serves both. Duplicate asset tags and serials come back as 409s carrying `details`, and `fieldErrorsOf` turns those into per-input messages, so the error lands on the field rather than only in a banner.

**Files:**
- Create: `client/src/components/devices/DeviceForm.jsx`, `client/src/pages/DeviceFormPage.jsx`
- Modify: `client/src/App.jsx` — add `/devices/new` and `/devices/:id/edit`
- Modify: `client/src/pages/DeviceDetailPage.jsx` — add the Edit action
- Test: `client/src/components/devices/DeviceForm.test.jsx`

**Interfaces:**
- Consumes: `useCreateDevice`, `useUpdateDevice`, `useDevice`; `fieldErrorsOf`; `Field`, `inputClass`, `Button`, `ErrorBanner`.
- Produces: `<DeviceForm device onSubmit isPending error submitLabel onCancel />` — `device` undefined means create.

- [ ] **Step 1: Write the failing tests**

`client/src/components/devices/DeviceForm.test.jsx`:

```jsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/renderWithProviders.jsx'
import DeviceFormPage from '../../pages/DeviceFormPage.jsx'
import { db } from '../../mocks/db.js'

const create = () => renderWithProviders(<DeviceFormPage />, { route: '/devices/new', path: '/devices/new' })
const edit = (id) =>
  renderWithProviders(<DeviceFormPage />, { route: `/devices/${id}/edit`, path: '/devices/:id/edit' })

test('submitting without an asset tag marks the field, not just a banner', async () => {
  create()
  await userEvent.click(screen.getByRole('button', { name: /save device/i }))
  await waitFor(() => {
    expect(screen.getByLabelText(/asset tag/i)).toHaveAccessibleDescription(/required/i)
  })
})

test('a duplicate asset tag shows the error on the asset tag field', async () => {
  create()
  await userEvent.type(screen.getByLabelText(/asset tag/i), db.devices[0].asset_tag)
  await userEvent.selectOptions(screen.getByLabelText(/type/i), 'laptop')
  await userEvent.click(screen.getByRole('button', { name: /save device/i }))

  await waitFor(() => {
    expect(screen.getByLabelText(/asset tag/i)).toHaveAccessibleDescription(/already in use/i)
  })
})

test('a valid device is created and appears in the register', async () => {
  const before = db.devices.length
  create()
  await userEvent.type(screen.getByLabelText(/asset tag/i), 'ASP-7777')
  await userEvent.selectOptions(screen.getByLabelText(/type/i), 'laptop')
  await userEvent.type(screen.getByLabelText(/brand/i), 'Dell')
  await userEvent.type(screen.getByLabelText(/model/i), 'Latitude 7440')
  await userEvent.click(screen.getByRole('button', { name: /save device/i }))

  await waitFor(() => expect(db.devices.length).toBe(before + 1))
  expect(db.devices.at(-1).asset_tag).toBe('ASP-7777')
})

test('the edit form arrives pre-filled with the existing values', async () => {
  const device = db.devices[0]
  edit(device.id)
  await waitFor(() => expect(screen.getByLabelText(/asset tag/i)).toHaveValue(device.asset_tag))
  expect(screen.getByLabelText(/model/i)).toHaveValue(device.model)
  expect(screen.getByLabelText(/serial/i)).toHaveValue(device.serial_number)
})

test('editing saves only what changed', async () => {
  const device = db.devices[1]
  edit(device.id)
  const notes = await screen.findByLabelText(/notes/i)
  await userEvent.type(notes, 'Dented lid')
  await userEvent.click(screen.getByRole('button', { name: /save device/i }))

  await waitFor(() => {
    expect(db.devices.find((d) => d.id === device.id).notes).toBe('Dented lid')
  })
  expect(db.devices.find((d) => d.id === device.id).asset_tag).toBe(device.asset_tag)
})

test('the status field never offers "issued"', async () => {
  const device = db.devices[1]
  edit(device.id)
  const select = await screen.findByLabelText(/lifecycle status/i)
  const values = [...select.options].map((o) => o.value)
  expect(values).toEqual(['available', 'repair', 'retired'])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- DeviceForm`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the form**

`client/src/components/devices/DeviceForm.jsx`:

```jsx
import { useId, useState } from 'react'
import Field, { inputClass } from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { fieldErrorsOf } from '../../lib/errors.js'

const EMPTY = {
  asset_tag: '', type: 'laptop', brand: '', model: '',
  serial_number: '', os: 'macos', status: 'available', notes: '',
}

// "issued" is deliberately absent — it is derived, never stored (§4).
const STATUSES = [
  ['available', 'Available'], ['repair', 'In repair'], ['retired', 'Retired'],
]
const OSES = [
  ['macos', 'macOS'], ['windows', 'Windows'], ['ios', 'iOS'], ['android', 'Android'],
]

export default function DeviceForm({ device, onSubmit, isPending, error, onCancel, isEdit }) {
  const [values, setValues] = useState({ ...EMPTY, ...pickFields(device) })
  const [localErrors, setLocalErrors] = useState({})
  const ids = useId()

  const serverErrors = fieldErrorsOf(error)
  const errors = { ...serverErrors, ...localErrors }
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const fieldId = (key) => `${ids}-${key}`
  const describedBy = (key) => (errors[key] ? `${fieldId(key)}-error` : undefined)

  function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!values.asset_tag.trim()) found.asset_tag = 'Asset tag is required.'
    setLocalErrors(found)
    if (Object.keys(found).length) return
    onSubmit({
      ...values,
      asset_tag: values.asset_tag.trim(),
      serial_number: values.serial_number.trim() || null,
      notes: values.notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-5">
      {!Object.keys(serverErrors).length && <ErrorBanner error={error} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id={fieldId('asset_tag')} label="Asset tag" required error={errors.asset_tag}>
          <input id={fieldId('asset_tag')} className={inputClass} value={values.asset_tag}
                 onChange={set('asset_tag')} aria-describedby={describedBy('asset_tag')}
                 placeholder="ASP-0042" />
        </FormField>

        <FormField id={fieldId('type')} label="Type" required error={errors.type}>
          <select id={fieldId('type')} className={inputClass} value={values.type} onChange={set('type')}>
            <option value="laptop">Laptop</option>
            <option value="mobile">Mobile</option>
          </select>
        </FormField>

        <FormField id={fieldId('brand')} label="Brand" error={errors.brand}>
          <input id={fieldId('brand')} className={inputClass} value={values.brand ?? ''} onChange={set('brand')} />
        </FormField>

        <FormField id={fieldId('model')} label="Model" error={errors.model}>
          <input id={fieldId('model')} className={inputClass} value={values.model ?? ''} onChange={set('model')} />
        </FormField>

        <FormField id={fieldId('serial_number')} label="Serial number" error={errors.serial_number}>
          <input id={fieldId('serial_number')} className={inputClass} value={values.serial_number ?? ''}
                 onChange={set('serial_number')} aria-describedby={describedBy('serial_number')} />
        </FormField>

        <FormField id={fieldId('os')} label="Operating system" error={errors.os}>
          <select id={fieldId('os')} className={inputClass} value={values.os ?? ''} onChange={set('os')}>
            {OSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>

        {isEdit && (
          <FormField id={fieldId('status')} label="Lifecycle status" error={errors.status}>
            <select id={fieldId('status')} className={inputClass} value={values.status} onChange={set('status')}>
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
        )}
      </div>

      <FormField id={fieldId('notes')} label="Notes" error={errors.notes}>
        <textarea id={fieldId('notes')} rows={3} className={inputClass}
                  value={values.notes ?? ''} onChange={set('notes')} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save device'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function pickFields(device) {
  if (!device) return {}
  const { asset_tag, type, brand, model, serial_number, os, status, notes } = device
  return {
    asset_tag: asset_tag ?? '', type: type ?? 'laptop', brand: brand ?? '', model: model ?? '',
    serial_number: serial_number ?? '', os: os ?? 'macos', status: status ?? 'available',
    notes: notes ?? '',
  }
}

/** Wraps Field so the error is exposed via aria-describedby, which is what the
 *  tests assert and what a screen reader announces. */
function FormField({ id, label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-bad-700" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs font-medium text-bad-700">{error}</p>}
    </div>
  )
}
```

**Important:** every `<input>` and `<select>` above must carry `aria-describedby={describedBy(key)}` for its own key, or the `toHaveAccessibleDescription` assertions fail. The snippet shows it on the fields the tests check; add it to the rest for consistency.

- [ ] **Step 4: Implement the page and routes**

`client/src/pages/DeviceFormPage.jsx`:

```jsx
import { useNavigate, useParams, Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import DeviceForm from '../components/devices/DeviceForm.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { useDevice, useCreateDevice, useUpdateDevice } from '../hooks/useDevices.js'

export default function DeviceFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const { data: device, isPending: loading, error: loadError } = useDevice(id)
  const create = useCreateDevice()
  const update = useUpdateDevice()
  const mutation = isEdit ? update : create

  if (isEdit && loading) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (isEdit && loadError) return <ErrorBanner error={loadError} />

  const handleSubmit = (values) => {
    const payload = isEdit ? { id, ...values } : values
    mutation.mutate(payload, {
      onSuccess: (saved) => navigate(`/devices/${saved.id}`),
    })
  }

  return (
    <>
      <PageHeader
        back={<Link to="/devices" className="mb-1 block text-sm text-brand-700 hover:underline">← Devices</Link>}
        title={isEdit ? `Edit ${device.asset_tag}` : 'Add device'}
      />
      <DeviceForm
        device={device}
        isEdit={isEdit}
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
        error={mutation.error}
        onCancel={() => navigate(isEdit ? `/devices/${id}` : '/devices')}
      />
    </>
  )
}
```

In `client/src/App.jsx`, add these two routes **above** `devices/:id` so `/devices/new` is not swallowed by the detail route:

```jsx
import DeviceFormPage from './pages/DeviceFormPage.jsx'
// ...
<Route path="devices/new" element={<DeviceFormPage />} />
<Route path="devices/:id/edit" element={<DeviceFormPage />} />
<Route path="devices/:id" element={<DeviceDetailPage />} />
```

In `client/src/pages/DeviceDetailPage.jsx`, add an Edit action alongside the others:

```jsx
<Button variant="secondary" onClick={() => navigate(`/devices/${device.id}/edit`)}>Edit</Button>
```

Add `const navigate = useNavigate()` and import `useNavigate` from `react-router-dom` in that file.

- [ ] **Step 5: Run the tests**

Run: `npm test -- DeviceForm`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the whole suite and check the browser**

Run: `npm test` — expected PASS.
Run: `npm run dev` — add a device, see it in the list, open it, edit the notes, see them saved. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(devices): add and edit device forms with field-level errors"
```

---
