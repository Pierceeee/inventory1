// The master permission matrix (build plan §1.7). G1 rows: custody routes are
// Admin + Head; departments and users are Admin only. G2 rows: sessions are
// readable by every role (scoped to department); creating/importing/clearing
// is Admin + Head; only Admin completes a session. R1 (Reconciliation)
// overrides the original archived-sessions-are-admin-only rule: a head sees
// their OWN department's archived sessions too, a scanner never does.
import {
  useTestApi, STAFF, freeDevice, activeEmployee, openAssignment, activeSessionIn, sessionWithStatus,
  scannedItemIn,
} from './support/api.js'

const t = useTestApi()

const ROLE_EMAIL = {
  admin: STAFF.admin,       // allen, IT
  head: STAFF.itHead,       // rina, IT
  scanner: STAFF.itScanner, // tess, IT
}

const rand = () => Math.random().toString(36).slice(2, 10)

// One row per request in §1.7's G1 section. `path`/`body` are lazy so each
// test picks a fresh, valid resource out of that test's own fixture snapshot.
const ROWS = [
  { label: 'GET /api/auth/me', method: 'get', path: () => '/api/auth/me', allowed: ['admin', 'head', 'scanner'] },

  { label: 'GET /api/devices', method: 'get', path: () => '/api/devices', allowed: ['admin', 'head'] },
  {
    label: 'POST /api/devices', method: 'post', path: () => '/api/devices', allowed: ['admin', 'head'],
    body: () => ({ asset_tag: `PERM-${rand()}`, type: 'laptop' }),
  },
  { label: 'GET /api/devices/:id', method: 'get', allowed: ['admin', 'head'], path: (fx) => `/api/devices/${fx.devices[0].id}` },
  {
    label: 'PATCH /api/devices/:id', method: 'patch', allowed: ['admin', 'head'],
    path: (fx) => `/api/devices/${fx.devices[0].id}`, body: () => ({ notes: 'permission check' }),
  },
  {
    label: 'POST /api/devices/:id/retire', method: 'post', allowed: ['admin', 'head'],
    path: (fx) => `/api/devices/${freeDevice(fx).id}/retire`, body: () => ({}),
  },

  { label: 'GET /api/employees', method: 'get', path: () => '/api/employees', allowed: ['admin', 'head'] },
  {
    label: 'POST /api/employees', method: 'post', path: () => '/api/employees', allowed: ['admin', 'head'],
    body: () => ({ full_name: `Perm Test ${rand()}` }),
  },
  { label: 'GET /api/employees/:id', method: 'get', allowed: ['admin', 'head'], path: (fx) => `/api/employees/${fx.employees[0].id}` },
  {
    label: 'PATCH /api/employees/:id', method: 'patch', allowed: ['admin', 'head'],
    path: (fx) => `/api/employees/${fx.employees[0].id}`, body: () => ({ department: 'Ops' }),
  },
  {
    label: 'POST /api/employees/:id/resign', method: 'post', allowed: ['admin', 'head'],
    path: (fx) => `/api/employees/${activeEmployee(fx).id}/resign`, body: () => ({}),
  },

  { label: 'GET /api/assignments', method: 'get', path: () => '/api/assignments', allowed: ['admin', 'head'] },
  {
    label: 'POST /api/assignments', method: 'post', allowed: ['admin', 'head'],
    path: () => '/api/assignments',
    body: (fx) => ({ device_id: freeDevice(fx).id, employee_id: activeEmployee(fx).id }),
  },
  {
    label: 'POST /api/assignments/:id/return', method: 'post', allowed: ['admin', 'head'],
    path: (fx) => `/api/assignments/${openAssignment(fx).id}/return`,
    body: () => ({ return_reason: 'other', returned_condition: 'good' }),
  },

  { label: 'GET /api/dashboard', method: 'get', path: () => '/api/dashboard', allowed: ['admin', 'head'] },
  { label: 'GET /api/export/assignments', method: 'get', path: () => '/api/export/assignments', allowed: ['admin', 'head'] },
  {
    label: 'POST /api/import/devices', method: 'post', allowed: ['admin', 'head'],
    path: () => '/api/import/devices', body: () => ({ rows: [] }),
  },
  {
    label: 'POST /api/import/employees', method: 'post', allowed: ['admin', 'head'],
    path: () => '/api/import/employees', body: () => ({ rows: [] }),
  },

  { label: 'GET /api/departments', method: 'get', path: () => '/api/departments', allowed: ['admin'] },
  {
    label: 'POST /api/departments', method: 'post', allowed: ['admin'],
    path: () => '/api/departments', body: () => ({ name: `Perm Dept ${rand()}` }),
  },
  {
    label: 'PATCH /api/departments/:id', method: 'patch', allowed: ['admin'],
    path: (fx) => `/api/departments/${fx.departments[0].id}`, body: () => ({ name: `Renamed ${rand()}` }),
  },

  { label: 'GET /api/users', method: 'get', path: () => '/api/users', allowed: ['admin'] },
  {
    label: 'POST /api/users', method: 'post', allowed: ['admin'],
    path: () => '/api/users',
    body: (fx) => ({
      full_name: `Perm User ${rand()}`, email: `perm.${rand()}@adspark.ph`, password: 'password123',
      role: 'scanner', department_id: fx.departments[0].id,
    }),
  },
  {
    label: 'PATCH /api/users/:id', method: 'patch', allowed: ['admin'],
    path: (fx) => `/api/users/${fx.profiles.find((p) => p.email === STAFF.creativeScanner).id}`,
    body: (fx) => ({ department_id: fx.departments[0].id }),
  },

  { label: 'GET /api/sessions', method: 'get', path: () => '/api/sessions', allowed: ['admin', 'head', 'scanner'] },
  {
    // R1: a head sees their own department's archive too; a scanner never does.
    label: 'GET /api/sessions?status=archived', method: 'get',
    path: () => '/api/sessions?status=archived', allowed: ['admin', 'head'],
  },
  {
    label: 'POST /api/sessions', method: 'post', allowed: ['admin', 'head'],
    path: () => '/api/sessions',
    body: (fx) => ({ name: `Perm Session ${rand()}`, department_id: fx.departments.find((d) => d.name.startsWith('IT')).id }),
  },
  { label: 'GET /api/sessions/:id', method: 'get', allowed: ['admin', 'head', 'scanner'], path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}` },
  {
    // R1: an archived session in the caller's own department stays readable
    // to admins and heads; a scanner still gets 403.
    label: 'GET /api/sessions/:id (archived)', method: 'get', allowed: ['admin', 'head'],
    path: (fx) => `/api/sessions/${sessionWithStatus(fx, 'archived').id}`,
  },
  {
    label: 'PATCH /api/sessions/:id', method: 'patch', allowed: ['admin', 'head'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}`, body: () => ({ name: `Renamed ${rand()}` }),
  },
  {
    label: 'POST /api/sessions/:id/complete', method: 'post', allowed: ['admin'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'Creative').id}/complete`, body: () => ({}),
  },
  { label: 'GET /api/sessions/:id/items', method: 'get', allowed: ['admin', 'head', 'scanner'], path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}/items` },
  {
    label: 'POST /api/sessions/:id/import', method: 'post', allowed: ['admin', 'head'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}/import`,
    body: () => ({ columns: [], rows: [], commit: false }),
  },
  {
    label: 'POST /api/sessions/:id/clear', method: 'post', allowed: ['admin', 'head'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}/clear`, body: () => ({ confirm: 'CLEAR' }),
  },

  // G3: scanning is open to every role, scoped to department (admin any,
  // head/scanner own only); only admins undo; recent scans mirrors read access.
  {
    label: 'POST /api/sessions/:id/scan', method: 'post', allowed: ['admin', 'head', 'scanner'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}/scan`, body: () => ({ code: `PERM-${rand()}` }),
  },
  {
    label: 'POST /api/sessions/:id/items/:itemId/undo', method: 'post', allowed: ['admin'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}/items/${scannedItemIn(fx, activeSessionIn(fx, 'IT').id).id}/undo`,
    body: () => ({}),
  },
  {
    label: 'GET /api/sessions/:id/scans', method: 'get', allowed: ['admin', 'head', 'scanner'],
    path: (fx) => `/api/sessions/${activeSessionIn(fx, 'IT').id}/scans`,
  },
]

const CASES = ROWS.flatMap((row) =>
  ['admin', 'head', 'scanner'].map((role) => ({
    label: row.label, role, row, expected: row.allowed.includes(role) ? 'allowed' : 'forbidden',
  })))

describe('permission matrix (G1)', () => {
  test.each(CASES)('$label as $role is $expected', async ({ role, row }) => {
    const client = t.as(ROLE_EMAIL[role])
    const path = row.path(t.fx)
    const body = row.body?.(t.fx)
    const res = row.method === 'get' ? await client.get(path) : await client[row.method](path, body)

    if (row.allowed.includes(role)) {
      expect(res.status).not.toBe(403)
      expect(res.status).not.toBe(401)
    } else {
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
  })
})

test('a 403 uses the standard envelope with code FORBIDDEN and is never a 401', async () => {
  const res = await t.as(STAFF.itScanner).get('/api/devices')
  expect(res.status).toBe(403)
  expect(res.body).toMatchObject({ error: { code: 'FORBIDDEN', message: expect.any(String) } })
  expect(res.status).not.toBe(401)
})

test('a scanner with a bad body still gets 403, not 400', async () => {
  // department_id is missing/invalid, which would 400 for an allowed role -
  // requireRole must run before parse(), so a scanner never even reaches it.
  const res = await t.as(STAFF.itScanner).post('/api/users', { nonsense: true })
  expect(res.status).toBe(403)
  expect(res.body.error.code).toBe('FORBIDDEN')
})
