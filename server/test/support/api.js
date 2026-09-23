import request from 'supertest'
import { beforeAll, beforeEach, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { createScanRateLimiter } from '../../src/lib/rateLimit.js'
import { createTestDb, emptyDb } from './testDb.js'
import { createFakeAuth } from './fakeAuth.js'
import { STAFF, USERS, loadFixtures, snapshot } from './fixtures.js'

export { STAFF }

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
    // Production defaults are generous enough that ordinary tests never trip
    // it; reset every test so one test's scan volume can never bleed into
    // the next (the app/limiter live for the whole file, not per test).
    t.rateLimiter = createScanRateLimiter()
    t.app = createApp({ db: t.db, auth: t.auth, settings: { scanRateLimiter: t.rateLimiter } })
    t.as = (email) => client(t.app, t.auth.sessionFor(email).token)
    t.api = t.as('allen@adspark.ph')
    t.anonymous = client(t.app, null)
  })
  beforeEach(async () => {
    t.auth.reset()
    t.rateLimiter.reset()
    await emptyDb(t.db)
    await loadFixtures(t.db)
    t.fx = await snapshot(t.db)
  })
  afterAll(() => t.db?.close())

  t.refresh = async () => { t.fx = await snapshot(t.db) }
  return t
}

export function client(app, token) {
  const auth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req)
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body = {}) => auth(request(app).post(url)).send(body),
    patch: (url, body = {}) => auth(request(app).patch(url)).send(body),
    // Deletes with a JSON body (session deletion re-auth, G5) need `.send()`
    // called explicitly - supertest otherwise sends no body for DELETE.
    delete: (url, body) => (body === undefined ? auth(request(app).delete(url)) : auth(request(app).delete(url)).send(body)),
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

// ---- inventory sessions (G2) ----

export const departmentNamed = (fx, name) => fx.departments.find((d) => d.name.startsWith(name))
export const sessionNamed = (fx, name) => fx.sessions.find((s) => s.name === name)
export const activeSessionIn = (fx, deptName) =>
  fx.sessions.find((s) => s.department_name.startsWith(deptName) && s.effective_status === 'active')
export const sessionWithStatus = (fx, effective) => fx.sessions.find((s) => s.effective_status === effective)
export const itemsOf = (fx, sessionId) => fx.items.filter((i) => i.session_id === sessionId)
export const pendingItemIn = (fx, sessionId) =>
  fx.items.find((i) => i.session_id === sessionId && i.scanned_at === null)
export const scannedItemIn = (fx, sessionId) =>
  fx.items.find((i) => i.session_id === sessionId && i.scanned_at !== null)

// ---- scan history (G3) ----

export const scansOf = (fx, sessionId) => fx.scans.filter((s) => s.session_id === sessionId)
