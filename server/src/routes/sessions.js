import express, { Router } from 'express'
import { requireRole } from '../middleware/access.js'
import { ROLES } from '../lib/values.js'
import { tooManyRequests } from '../lib/errors.js'
import {
  clearItems, int, one, oneOf, parse, scanCreate, sessionCreate, sessionImport, sessionUpdate,
  ITEM_STATUS_FILTERS, SESSION_STATUS_FILTERS,
} from '../validation.js'
import {
  completeSession, createSession, getSessionFor, listSessions, updateSession, writableSession,
} from '../services/inventorySessions.js'
import { clearSessionItems, importSessionItems, listSessionItems } from '../services/sessionItems.js'
import { listRecentScans, scanItem, undoScan } from '../services/scans.js'

// Spreadsheets are the one large payload; everything else stays small
// (G-10). Mounted on the route itself, AFTER auth + role checks below, so an
// unauthenticated or unauthorised request is rejected before the server ever
// spends effort parsing up to 20MB of attacker-controlled JSON (security M2).
const bigJson = express.json({ limit: '20mb' })

/** Mounted at /api/sessions (app.js), after `signedIn` - every route here
 *  needs a role and department on req.user. Every write goes through
 *  writableSession/assertSessionWritable, never straight to the service. */
export function sessionsRouter({ db, scanRateLimiter }) {
  const router = Router()
  const anyRole = requireRole(...ROLES)
  const canManage = requireRole('admin', 'head')
  const admin = requireRole('admin')

  // Keyed per signed-in user, so one person flooding scans (a stuck retry
  // loop, or a script) never affects anyone else's budget. Checked before
  // any DB work, right after the role gate - never 401 (security M?).
  function rateLimitScans(req, res, next) {
    const { allowed, retryAfterMs } = scanRateLimiter.hit(req.user.id)
    if (!allowed) {
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)))
      throw tooManyRequests('Too many scans in a row. Wait a moment and try again.',
        { retry_after_ms: Math.ceil(retryAfterMs) })
    }
    next()
  }

  router.get('/', anyRole, async (req, res) => {
    const status = oneOf(req.query.status, SESSION_STATUS_FILTERS, 'status')
    res.json({ data: await listSessions(db, req.user, { status }) })
  })

  router.post('/', canManage, async (req, res) => {
    res.status(201).json({ data: await createSession(db, parse(sessionCreate, req.body), req.user) })
  })

  router.get('/:id', anyRole, async (req, res) => {
    res.json({ data: await getSessionFor(db, req.params.id, req.user) })
  })

  router.patch('/:id', canManage, async (req, res) => {
    res.json({ data: await updateSession(db, req.params.id, parse(sessionUpdate, req.body), req.user) })
  })

  router.post('/:id/complete', admin, async (req, res) => {
    res.json({ data: await completeSession(db, req.params.id, req.user) })
  })

  router.get('/:id/items', anyRole, async (req, res) => {
    const session = await getSessionFor(db, req.params.id, req.user)
    const status = oneOf(req.query.status, ITEM_STATUS_FILTERS, 'status')
    const q = one(req.query.q)
    // Clamped, never trusted as-is (security L1): a huge offset is just an
    // empty page, never a slow query, and page_size is capped at 500.
    const page = int(req.query.page, 'page', { min: 1, fallback: 1 })
    const pageSize = int(req.query.page_size, 'page_size', { min: 1, max: 500, fallback: 100 })
    res.json({ data: await listSessionItems(db, session, { status, q, page, pageSize }) })
  })

  // requireRole runs before the body is ever parsed - a scanner (or an
  // unauthenticated caller, rejected even earlier by `signedIn`) never
  // causes the server to read a byte of a 20MB body (security M2).
  router.post('/:id/import', canManage, bigJson, async (req, res) => {
    const session = await writableSession(db, req.params.id, req.user)
    res.json({ data: await importSessionItems(db, session, parse(sessionImport, req.body)) })
  })

  router.post('/:id/clear', canManage, async (req, res) => {
    const session = await writableSession(db, req.params.id, req.user)
    parse(clearItems, req.body)
    res.json({ data: await clearSessionItems(db, session, req.user) })
  })

  // Gated by writableSession, not requireRole, for the department scoping:
  // admin (any dept), head/scanner (own dept only) - D5. Order matches every
  // other write: 403 wrong role -> 403 wrong department -> 409 not active ->
  // 400 body.
  router.post('/:id/scan', anyRole, rateLimitScans, async (req, res) => {
    const session = await writableSession(db, req.params.id, req.user)
    const { code } = parse(scanCreate, req.body)
    res.json({ data: await scanItem(db, session, code, req.user) })
  })

  router.post('/:id/items/:itemId/undo', admin, async (req, res) => {
    const session = await writableSession(db, req.params.id, req.user)
    res.json({ data: await undoScan(db, session, req.params.itemId, req.user) })
  })

  router.get('/:id/scans', anyRole, async (req, res) => {
    const session = await getSessionFor(db, req.params.id, req.user)
    const limit = int(req.query.limit, 'limit', { min: 1, max: 50, fallback: 10 })
    res.json({ data: await listRecentScans(db, session, { limit }) })
  })

  return router
}
