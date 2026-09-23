import { useTestApi, STAFF } from './support/api.js'
import { registerUser, setUserRole, updateUser } from '../src/services/users.js'

const t = useTestApi()

const validRegistration = (overrides = {}) => ({
  full_name: 'New Person', email: 'new.person@adspark.ph', password: 'password123',
  role: 'scanner', department_id: t.fx.departments[0].id,
  ...overrides,
})

const findId = (email) => t.fx.profiles.find((p) => p.email === email).id

describe('listing', () => {
  test('lists every account with role and department', async () => {
    const res = await t.api.get('/api/users')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(t.fx.profiles.length)
    const allen = res.body.data.find((u) => u.email === STAFF.admin)
    expect(allen).toMatchObject({ role: 'admin' })
    const it = t.fx.departments.find((d) => d.name.startsWith('IT'))
    const rina = res.body.data.find((u) => u.email === STAFF.itHead)
    expect(rina).toMatchObject({ role: 'head', department_id: it.id, department_name: it.name })
  })
})

describe('registering', () => {
  test('register creates both the sign-in account and the profile', async () => {
    const res = await t.api.post('/api/users', validRegistration())
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      email: 'new.person@adspark.ph', full_name: 'New Person', role: 'scanner',
    })
    const { rows } = await t.db.query('select * from profiles where email = $1', ['new.person@adspark.ph'])
    expect(rows).toHaveLength(1)
  })

  test('a registered user can sign in with the password given and has the chosen role', async () => {
    await t.api.post('/api/users', validRegistration({ email: 'signin.test@adspark.ph' }))
    const login = await t.anonymous.post('/api/auth/login', {
      email: 'signin.test@adspark.ph', password: 'password123',
    })
    expect(login.status).toBe(200)
    const me = await t.as('signin.test@adspark.ph').get('/api/auth/me')
    expect(me.body.data.role).toBe('scanner')
  })

  test('registering an email that already exists is a 409 DUPLICATE_EMAIL and creates no profile', async () => {
    const res = await t.api.post('/api/users', validRegistration({ email: STAFF.admin }))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL')
    const { rows } = await t.db.query('select count(*)::int as n from profiles where email = $1', [STAFF.admin])
    expect(rows[0].n).toBe(1)
  })

  test('heads and scanners must be given a department; admins need not', async () => {
    const head = await t.api.post('/api/users', validRegistration({ email: 'head.nodept@adspark.ph', role: 'head', department_id: undefined }))
    expect(head.status).toBe(400)
    expect(head.body.error.details.department_id).toBeTruthy()

    const admin = await t.api.post('/api/users', validRegistration({ email: 'admin.nodept@adspark.ph', role: 'admin', department_id: undefined }))
    expect(admin.status).toBe(201)
    expect(admin.body.data.department_id).toBeNull()
  })

  test('register refuses an unknown department without creating an account', async () => {
    const res = await t.api.post('/api/users', validRegistration({
      email: 'ghost.dept@adspark.ph', department_id: '00000000-0000-4000-8000-000000000000',
    }))
    expect(res.status).toBe(400)
    expect(res.body.error.details.department_id).toBeTruthy()

    const login = await t.anonymous.post('/api/auth/login', { email: 'ghost.dept@adspark.ph', password: 'password123' })
    expect(login.status).toBe(401) // no account was ever created
  })

  test('register validates email, password length and role', async () => {
    const res = await t.api.post('/api/users', validRegistration({
      email: 'not-an-email', password: 'short', role: 'owner',
    }))
    expect(res.status).toBe(400)
    expect(res.body.error.details.email).toBeTruthy()
    expect(res.body.error.details.password).toBeTruthy()
    expect(res.body.error.details.role).toBeTruthy()
  })

  test('a failed profile write deletes the auth account it just created', async () => {
    const failingDb = {
      query: (sql, params) => {
        if (sql.includes('insert into profiles')) throw new Error('simulated profile write failure')
        return t.db.query(sql, params)
      },
    }
    const err = await registerUser(failingDb, t.auth, {
      full_name: 'Doomed', email: 'doomed@adspark.ph', password: 'password123', role: 'admin',
    }).catch((e) => e)
    expect(err.message).toBe('simulated profile write failure')

    // Compensated: the auth account created just before the failed write is gone.
    const session = await t.auth.signIn('doomed@adspark.ph', 'password123')
    expect(session).toBeNull()
    const { rows } = await t.db.query('select count(*)::int as n from profiles where email = $1', ['doomed@adspark.ph'])
    expect(rows[0].n).toBe(0)
  })

  test('an unknown department discovered only at the write itself is reported, not a 500, and still compensates', async () => {
    const ghostDeptId = '00000000-0000-4000-8000-000000000000' // valid uuid, no such department
    // Simulates a TOCTOU race: the pre-check sees it as existing, but the
    // real write still hits the foreign key.
    const racyDb = {
      query: (sql, params) => {
        if (sql.includes('select 1 from departments')) return { rows: [{ x: 1 }], rowCount: 1 }
        return t.db.query(sql, params)
      },
    }
    const err = await registerUser(racyDb, t.auth, {
      full_name: 'Racy', email: 'racy@adspark.ph', password: 'password123',
      role: 'scanner', department_id: ghostDeptId,
    }).catch((e) => e)

    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.details.department_id).toBeTruthy()

    // Compensated here too: this failure path must not leave an orphan account.
    const session = await t.auth.signIn('racy@adspark.ph', 'password123')
    expect(session).toBeNull()
  })
})

describe('editing', () => {
  test("an admin changes a user's role and department", async () => {
    const creative = t.fx.departments.find((d) => d.name.startsWith('Creative'))
    const res = await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, {
      role: 'head', department_id: creative.id,
    })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ role: 'head', department_id: creative.id })
  })

  test('a department can be removed from a user', async () => {
    const res = await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { department_id: null })
    expect(res.status).toBe(200)
    expect(res.body.data.department_id).toBeNull()
  })

  test('the last admin cannot be demoted', async () => {
    const res = await t.api.patch(`/api/users/${findId(STAFF.admin)}`, { role: 'head' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('LAST_ADMIN')
    const { rows: [row] } = await t.db.query('select role from profiles where email = $1', [STAFF.admin])
    expect(row.role).toBe('admin')
  })

  test('deactivating the last enabled admin is refused even when the actor differs', async () => {
    const allen = findId(STAFF.admin)
    const err = await updateUser(t.db, allen, { disabled: true }, 'not-the-same-id').catch((e) => e)
    expect(err.code).toBe('LAST_ADMIN')
  })

  test('a department-only patch on the last admin still succeeds (does not lock the admin set)', async () => {
    const allen = findId(STAFF.admin)
    const creative = t.fx.departments.find((d) => d.name.startsWith('Creative'))
    const res = await t.api.patch(`/api/users/${allen}`, { department_id: creative.id })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ role: 'admin', department_id: creative.id })
  })

  test('an unknown department discovered only at the write itself is reported, not a 500', async () => {
    const ghostDeptId = '00000000-0000-4000-8000-000000000000'
    const racyDb = {
      query: (sql, params) => {
        if (sql.includes('select 1 from departments')) return { rows: [{ x: 1 }], rowCount: 1 }
        return t.db.query(sql, params)
      },
      transaction: (fn) => t.db.transaction(fn),
    }
    const err = await updateUser(racyDb, findId(STAFF.itScanner), { department_id: ghostDeptId }, findId(STAFF.admin))
      .catch((e) => e)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.details.department_id).toBeTruthy()
  })

  test('an unknown user id is a 404', async () => {
    const unknown = await t.api.patch('/api/users/00000000-0000-4000-8000-000000000000', { role: 'head' })
    expect(unknown.status).toBe(404)
    const malformed = await t.api.patch('/api/users/not-a-uuid', { role: 'head' })
    expect(malformed.status).toBe(404)
  })

  test('an unknown department on update is a 400 naming the field', async () => {
    const res = await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, {
      department_id: '00000000-0000-4000-8000-000000000000',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.details.department_id).toBeTruthy()
  })
})

describe('deactivation (R4)', () => {
  test('an admin deactivates and reactivates a user', async () => {
    const off = await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { disabled: true })
    expect(off.status).toBe(200)
    expect(off.body.data.disabled_at).toBeTruthy()

    const on = await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { disabled: false })
    expect(on.status).toBe(200)
    expect(on.body.data.disabled_at).toBeNull()
  })

  test('an admin cannot disable themselves', async () => {
    const res = await t.api.patch(`/api/users/${findId(STAFF.admin)}`, { disabled: true })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CANNOT_DISABLE_SELF')
  })

  test('a disabled account cannot sign in', async () => {
    await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { disabled: true })
    const res = await t.anonymous.post('/api/auth/login', { email: STAFF.itScanner, password: 'adspark' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  test('a disabled account cannot refresh its session either', async () => {
    const refreshToken = t.auth.sessionFor(STAFF.itScanner).refresh_token
    await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { disabled: true })

    const res = await t.anonymous.post('/api/auth/refresh', { refresh_token: refreshToken })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  test('a disabled account is refused mid-session, not just at login', async () => {
    const scanner = t.as(STAFF.itScanner)
    expect((await scanner.get('/api/auth/me')).status).toBe(200)

    await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { disabled: true })

    const res = await scanner.get('/api/auth/me')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  test('GET /api/users reports disabled_at', async () => {
    await t.api.patch(`/api/users/${findId(STAFF.itScanner)}`, { disabled: true })
    const res = await t.api.get('/api/users')
    const scanner = res.body.data.find((u) => u.email === STAFF.itScanner)
    expect(scanner.disabled_at).toBeTruthy()
    const admin = res.body.data.find((u) => u.email === STAFF.admin)
    expect(admin.disabled_at).toBeNull()
  })
})

describe('setUserRole (bootstrap script)', () => {
  test('promotes every profile with that email and reports when there is none', async () => {
    const count = await setUserRole(t.db, STAFF.itScanner, 'admin')
    expect(count).toBe(1)
    const { rows: [row] } = await t.db.query('select role from profiles where email = $1', [STAFF.itScanner])
    expect(row.role).toBe('admin')

    const none = await setUserRole(t.db, 'nobody@adspark.ph', 'admin')
    expect(none).toBe(0)
  })
})
