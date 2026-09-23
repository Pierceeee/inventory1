// How role and department reach profiles, and how loadProfile keeps them
// current on every request (build plan §1.2, §3.5).
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { useTestApi, STAFF } from './support/api.js'
import { createBareTestDb } from './support/testDb.js'
import { MIGRATIONS_DIR, applyMigrations } from '../src/db/migrate.js'

describe('the roles migration backfill', () => {
  // Boots two PGlite instances in one test; under a full-suite parallel run
  // that occasionally needs more than the default 15s.
  test('makes every existing profile an admin', async () => {
    const db = await createBareTestDb()
    const onlyInit = await fs.mkdtemp(path.join(os.tmpdir(), 'akm-init-only-'))
    await fs.copyFile(
      path.join(MIGRATIONS_DIR, '20260923000000_init.sql'),
      path.join(onlyInit, '20260923000000_init.sql'),
    )

    try {
      // Just the schema as it was before roles existed.
      await applyMigrations(db, onlyInit)
      await db.query(
        `insert into profiles (id, email, full_name) values (gen_random_uuid(), 'preexisting@adspark.ph', 'Preexisting')`)

      // Now catch it up with every migration, including the roles one.
      await applyMigrations(db)

      const { rows } = await db.query('select role from profiles')
      expect(rows).toHaveLength(1)
      expect(rows[0].role).toBe('admin')
    } finally {
      await db.close()
      await fs.rm(onlyInit, { recursive: true, force: true })
    }
  }, 30_000)
})

describe('role and department on profiles', () => {
  const t = useTestApi()

  test('a new profile defaults to scanner with no department', async () => {
    await t.auth.createUser({ email: 'brand.new@adspark.ph', password: 'whatever1', full_name: 'Brand New' })
    const res = await t.as('brand.new@adspark.ph').get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ email: 'brand.new@adspark.ph', role: 'scanner', department: null })
  })

  test('a user with no profile row gets one on their first API call', async () => {
    await t.auth.createUser({ email: 'fresh@adspark.ph', password: 'whatever1', full_name: 'Fresh Person' })
    await t.as('fresh@adspark.ph').get('/api/auth/me')
    const { rows } = await t.db.query(
      'select role, department_id from profiles where email = $1', ['fresh@adspark.ph'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ role: 'scanner', department_id: null })
  })

  test('role must be admin, head or scanner', async () => {
    const err = await t.db.query(
      `update profiles set role = 'superadmin' where email = $1`, [STAFF.admin]).catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('/me returns role, department id and department name', async () => {
    const res = await t.as(STAFF.itHead).get('/api/auth/me')
    const it = t.fx.departments.find((d) => d.name.startsWith('IT'))
    expect(res.body.data).toMatchObject({
      email: STAFF.itHead, role: 'head', department: { id: it.id, name: it.name },
    })
  })

  test('an account signing in for the first time becomes a scanner with no department', async () => {
    await t.db.query('delete from profiles where email = $1', [STAFF.unassigned])
    const res = await t.anonymous.post('/api/auth/login', { email: STAFF.unassigned, password: 'adspark' })
    expect(res.status).toBe(200)
    const { rows: [profile] } = await t.db.query(
      'select role, department_id from profiles where email = $1', [STAFF.unassigned])
    expect(profile).toMatchObject({ role: 'scanner', department_id: null })
  })

  test('signing in never resets an existing role', async () => {
    await t.anonymous.post('/api/auth/login', { email: STAFF.admin, password: 'adspark' })
    const { rows: [profile] } = await t.db.query('select role from profiles where email = $1', [STAFF.admin])
    expect(profile.role).toBe('admin')
  })

  test('a role change takes effect on the next request, because roles are read from profiles', async () => {
    const before = await t.as(STAFF.itScanner).get('/api/devices')
    expect(before.status).toBe(403)

    await t.db.query(`update profiles set role = 'admin' where email = $1`, [STAFF.itScanner])

    const after = await t.as(STAFF.itScanner).get('/api/devices')
    expect(after.status).not.toBe(403)
  })
})
