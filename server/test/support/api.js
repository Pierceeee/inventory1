import request from 'supertest'
import { beforeAll, beforeEach, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { createTestDb, emptyDb } from './testDb.js'
import { createFakeAuth } from './fakeAuth.js'
import { USERS, loadFixtures, snapshot } from './fixtures.js'

/**
 * Registers per-file hooks: one in-process Postgres for the file, emptied and
 * re-seeded with the fixtures before every test. Returns a live handle whose
 * fields are filled in once beforeAll has run.
 */
export function useTestApi() {
  const t = {}

  beforeAll(async () => {
    t.db = await createTestDb()
    t.auth = createFakeAuth(USERS)
    t.app = createApp({ db: t.db, auth: t.auth })
    t.as = (email) => client(t.app, t.auth.sessionFor(email).token)
    t.api = t.as('allen@adspark.ph')
    t.anonymous = client(t.app, null)
  })
  beforeEach(async () => {
    await emptyDb(t.db)
    await loadFixtures(t.db)
    t.fx = await snapshot(t.db)
  })
  afterAll(() => t.db?.close())

  t.refresh = async () => { t.fx = await snapshot(t.db) }
  return t
}

function client(app, token) {
  const auth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req)
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body = {}) => auth(request(app).post(url)).send(body),
    patch: (url, body = {}) => auth(request(app).patch(url)).send(body),
  }
}

// ---- finders over a snapshot, so tests never hardcode fixture rows ----

export const isOpen = (a) => a.returned_at === null
export const openFor = (fx, deviceId) => fx.assignments.find((a) => a.device_id === deviceId && isOpen(a))
export const freeDevice = (fx, type) => fx.devices.find(
  (d) => (!type || d.type === type) && d.status === 'available' && !openFor(fx, d.id))
export const activeEmployee = (fx, except) =>
  fx.employees.find((e) => e.status === 'active' && e.id !== except)
export const idleEmployee = (fx) => fx.employees.find(
  (e) => e.status === 'active' && !fx.assignments.some((a) => a.employee_id === e.id && isOpen(a)))
export const openAssignment = (fx) => fx.assignments.find(isOpen)
