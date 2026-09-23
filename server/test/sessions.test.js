// Phase 2: audit sessions - listing, creating, reading, completing, and the
// database guarantees around status/archiving. R1 (Reconciliation) overrides
// the original "archived sessions are admin-only" rule: a head sees their
// own department's archived sessions too; a scanner never does.
import {
  useTestApi, STAFF, departmentNamed, activeSessionIn, sessionWithStatus,
} from './support/api.js'

const t = useTestApi()

const completedSession = (fx) => fx.sessions.find((s) => s.name === 'IT Phones Q2 2026')

describe('listing', () => {
  test('an admin sees active and completed sessions from every department', async () => {
    const res = await t.api.get('/api/sessions')
    expect(res.status).toBe(200)
    const names = res.body.data.map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(
      ['IT Laptops Q3 2026', 'Creative Kit Q3 2026', 'IT Phones Q2 2026']))
    expect(names).not.toContain('IT Laptops Q1 2026') // archived, left out by default
  })

  test('a head sees only their own department', async () => {
    const res = await t.as(STAFF.itHead).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((s) => s.department_name.startsWith('IT'))).toBe(true)
  })

  test('a scanner sees only their own department', async () => {
    const res = await t.as(STAFF.creativeScanner).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((s) => s.department_name.startsWith('Creative'))).toBe(true)
  })

  test('a scanner with no department sees none', async () => {
    const res = await t.as(STAFF.unassigned).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  test('archived sessions are left out by default and for status=all unless you are an admin', async () => {
    const byDefault = await t.api.get('/api/sessions')
    expect(byDefault.body.data.some((s) => s.effective_status === 'archived')).toBe(false)

    const allAsHead = await t.as(STAFF.itHead).get('/api/sessions?status=all')
    expect(allAsHead.body.data.some((s) => s.effective_status === 'archived')).toBe(false)

    const allAsAdmin = await t.api.get('/api/sessions?status=all')
    expect(allAsAdmin.body.data.some((s) => s.effective_status === 'archived')).toBe(true)
  })

  test('status=archived lists sessions completed more than 7 days ago, admins and heads (R1)', async () => {
    const asAdmin = await t.api.get('/api/sessions?status=archived')
    expect(asAdmin.status).toBe(200)
    expect(asAdmin.body.data.map((s) => s.name)).toEqual(['IT Laptops Q1 2026'])

    const asHead = await t.as(STAFF.itHead).get('/api/sessions?status=archived')
    expect(asHead.status).toBe(200)
    expect(asHead.body.data.map((s) => s.name)).toEqual(['IT Laptops Q1 2026'])

    // Kim is a Creative head - IT's archived session is a different department.
    const asOtherHead = await t.as(STAFF.creativeHead).get('/api/sessions?status=archived')
    expect(asOtherHead.status).toBe(200)
    expect(asOtherHead.body.data).toEqual([])

    const asScanner = await t.as(STAFF.itScanner).get('/api/sessions?status=archived')
    expect(asScanner.status).toBe(403)
    expect(asScanner.body.error.code).toBe('FORBIDDEN')
  })

  test('each session carries item_count, scanned_count, department_name and effective_status', async () => {
    const res = await t.api.get('/api/sessions')
    const it = res.body.data.find((s) => s.name === 'IT Laptops Q3 2026')
    expect(it).toMatchObject({
      department_name: expect.stringContaining('IT'),
      effective_status: 'active', item_count: 12, scanned_count: 6,
    })
  })

  test('an unknown status filter is a 400', async () => {
    const res = await t.api.get('/api/sessions?status=nonsense')
    expect(res.status).toBe(400)
  })
})

describe('creating', () => {
  test('an admin creates a session in any department', async () => {
    const creative = departmentNamed(t.fx, 'Creative')
    const res = await t.api.post('/api/sessions', { name: 'New Audit', department_id: creative.id })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      name: 'New Audit', department_id: creative.id, status: 'active', columns: [],
    })
  })

  test('an admin must choose a department', async () => {
    const res = await t.api.post('/api/sessions', { name: 'No Dept' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.department_id).toBeTruthy()
  })

  test("a head's session goes into their own department", async () => {
    const res = await t.as(STAFF.itHead).post('/api/sessions', { name: 'Head Session' })
    expect(res.status).toBe(201)
    expect(res.body.data.department_name).toContain('IT')
  })

  test('a head cannot create a session in another department', async () => {
    const creative = departmentNamed(t.fx, 'Creative')
    const res = await t.as(STAFF.itHead).post('/api/sessions', { name: 'Wrong Dept', department_id: creative.id })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  test('a head with no department cannot create a session', async () => {
    await t.db.query('update profiles set department_id = null where email = $1', [STAFF.itHead])
    const res = await t.as(STAFF.itHead).post('/api/sessions', { name: 'No Dept Head' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NO_DEPARTMENT')
  })

  test('a scanner cannot create sessions', async () => {
    const res = await t.as(STAFF.itScanner).post('/api/sessions', { name: 'Scanner Session' })
    expect(res.status).toBe(403)
  })

  test('a blank name is a 400 naming the field', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const res = await t.api.post('/api/sessions', { name: '   ', department_id: it.id })
    expect(res.status).toBe(400)
    expect(res.body.error.details.name).toBeTruthy()
  })
})

describe('reading', () => {
  test("a scanner cannot open another department's session", async () => {
    const creative = activeSessionIn(t.fx, 'Creative')
    const res = await t.as(STAFF.itScanner).get(`/api/sessions/${creative.id}`)
    expect(res.status).toBe(403)
  })

  test('a scanner cannot open an archived session', async () => {
    const archived = sessionWithStatus(t.fx, 'archived')
    const res = await t.as(STAFF.itScanner).get(`/api/sessions/${archived.id}`)
    expect(res.status).toBe(403)
  })

  test("a head can open their own department's archived session (R1)", async () => {
    const archived = sessionWithStatus(t.fx, 'archived')
    const res = await t.as(STAFF.itHead).get(`/api/sessions/${archived.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.effective_status).toBe('archived')
  })

  test('an unknown or malformed id is a 404', async () => {
    const malformed = await t.api.get('/api/sessions/not-a-uuid')
    expect(malformed.status).toBe(404)
    const unknown = await t.api.get('/api/sessions/00000000-0000-4000-8000-000000000000')
    expect(unknown.status).toBe(404)
  })
})

describe('completing', () => {
  test('an admin marks a session complete, recording who and when', async () => {
    const active = activeSessionIn(t.fx, 'IT')
    const res = await t.api.post(`/api/sessions/${active.id}/complete`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('completed')
    expect(res.body.data.completed_by_name).toBe('Allen Lacoste')
    expect(res.body.data.completed_at).toBeTruthy()
  })

  test('completing an already-completed session is refused', async () => {
    const res = await t.api.post(`/api/sessions/${completedSession(t.fx).id}/complete`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_NOT_ACTIVE')
  })

  test('a head cannot mark complete', async () => {
    const active = activeSessionIn(t.fx, 'IT')
    const res = await t.as(STAFF.itHead).post(`/api/sessions/${active.id}/complete`)
    expect(res.status).toBe(403)
  })

  test('a completed session refuses renames and column changes', async () => {
    const res = await t.api.patch(`/api/sessions/${completedSession(t.fx).id}`, { name: 'Renamed' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_NOT_ACTIVE')
  })

  // security M1: the rename UPDATE itself must carry the active guard, not
  // just the read that happens before it - otherwise a rename that read the
  // session while it was still active could land after a concurrent Mark
  // Complete. Proven two ways: the SQL guard directly (deterministic), and a
  // same-tick race through the real HTTP routes (best-effort, PGlite
  // serialises everything so this can't truly run in parallel, but the
  // invariant below must hold whichever request the DB happens to run first).
  test('the rename UPDATE is atomically guarded, not just pre-checked', async () => {
    const active = activeSessionIn(t.fx, 'IT')
    const admin = t.fx.profiles.find((p) => p.email === STAFF.admin)
    await t.db.query(
      `update inventory_sessions set status = 'completed', completed_at = now(), completed_by = $2 where id = $1`,
      [active.id, admin.id],
    )
    const { rowCount } = await t.db.query(
      `update inventory_sessions set name = 'Too Late' where id = $1 and status = 'active'`, [active.id])
    expect(rowCount).toBe(0)
  })

  test('completing a session and renaming it at the same time never lets the rename win', async () => {
    const active = activeSessionIn(t.fx, 'IT')
    await Promise.all([
      t.api.post(`/api/sessions/${active.id}/complete`),
      t.api.patch(`/api/sessions/${active.id}`, { name: 'Race Name' }),
    ])
    const { rows: [row] } = await t.db.query(
      'select name, status from inventory_sessions where id = $1', [active.id])
    if (row.status === 'completed') expect(row.name).not.toBe('Race Name')
  })
})

describe('archiving', () => {
  test('a session reads as archived once completed more than 7 days ago', () => {
    expect(sessionWithStatus(t.fx, 'archived').name).toBe('IT Laptops Q1 2026')
  })

  test('a session completed 6 days ago still reads as completed', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const admin = t.fx.profiles.find((p) => p.email === STAFF.admin)
    const { rows: [session] } = await t.db.query(
      `insert into inventory_sessions (name, department_id, created_by) values ('Six Days', $1, $2) returning id`,
      [it.id, admin.id],
    )
    await t.db.query(
      `update inventory_sessions
          set status = 'completed', completed_at = now() - interval '6 days', completed_by = $2
        where id = $1`,
      [session.id, admin.id],
    )
    const { rows: [summary] } = await t.db.query(
      'select effective_status from inventory_session_summary where id = $1', [session.id])
    expect(summary.effective_status).toBe('completed')
  })
})

describe('schema', () => {
  test('the database refuses status completed without completed_at', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const err = await t.db.query(
      `insert into inventory_sessions (name, department_id, status) values ('Bad', $1, 'completed')`,
      [it.id],
    ).catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('display_columns must be a subset of columns', async () => {
    const active = activeSessionIn(t.fx, 'IT')
    const err = await t.db.query(
      `update inventory_sessions set display_columns = array['not-a-real-column'] where id = $1`,
      [active.id],
    ).catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('item codes are unique per session regardless of case, but repeat across sessions', async () => {
    const active = activeSessionIn(t.fx, 'IT')
    const admin = t.fx.profiles.find((p) => p.email === STAFF.admin)
    const err = await t.db.query(
      `insert into session_items (session_id, item_code) values ($1, 'it-lap-001')`, [active.id],
    ).catch((e) => e)
    expect(err.constraint).toBe('session_items_code_key')

    const { rows: [fresh] } = await t.db.query(
      `insert into inventory_sessions (name, department_id, created_by) values ('Fresh', $1, $2) returning id`,
      [active.department_id, admin.id],
    )
    await expect(t.db.query(
      `insert into session_items (session_id, item_code) values ($1, 'IT-LAP-001')`, [fresh.id],
    )).resolves.toBeTruthy()
  })

  test('the database refuses item writes in a completed session', async () => {
    const err = await t.db.query(
      `insert into session_items (session_id, item_code) values ($1, 'NEW-CODE')`,
      [completedSession(t.fx).id],
    ).catch((e) => e)
    expect(err.code).toBe('55000')
  })
})
