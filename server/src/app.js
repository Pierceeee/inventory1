import express from 'express'
import { AppError, notFound } from './lib/errors.js'
import { requireAuth } from './middleware/auth.js'
import { loadProfile, requireRole } from './middleware/access.js'
import { createErrorHandler } from './middleware/errors.js'
import { securityHeaders } from './middleware/securityHeaders.js'
import { officeNetworkOnly } from './middleware/network.js'
import { serveClient } from './middleware/serveClient.js'
import { CUSTODY_ROLES } from './lib/values.js'
import { createExportRateLimiter, createScanRateLimiter, createSessionDeleteRateLimiter } from './lib/rateLimit.js'
import { createExportGuard } from './lib/exportGuard.js'
import { pendingMigrations } from './db/migrate.js'
import { authRouter } from './routes/auth.js'
import { devicesRouter } from './routes/devices.js'
import { employeesRouter } from './routes/employees.js'
import { assignmentsRouter } from './routes/assignments.js'
import { departmentsRouter } from './routes/departments.js'
import { usersRouter } from './routes/users.js'
import { sessionsRouter } from './routes/sessions.js'
import { itemsRouter } from './routes/items.js'
import { reportsRouter } from './routes/reports.js'

/**
 * Builds the API. `db` and `auth` are passed in so tests can run the exact
 * same app against an in-process Postgres and a stand-in auth provider.
 * `settings` carries tunables with production defaults, injectable for tests
 * (e.g. a tiny `scanRateLimiter` that trips after a couple of requests).
 */
export function createApp({ db, auth, settings = {} }) {
  const app = express()
  app.disable('x-powered-by')
  // Never `true` - server/src/lib/ipAllowList.js's parseTrustProxy refuses
  // that at parse time, because it would make X-Forwarded-For (and so
  // officeNetworkOnly and req.ip everywhere) fully attacker-controlled.
  // Undefined (the default: nothing set in .env) leaves Express's own
  // default of `false` in place, so X-Forwarded-For is ignored outright.
  if (settings.trustProxy !== undefined) app.set('trust proxy', settings.trustProxy)

  // Runs before EVERYTHING else, including officeNetworkOnly's own blocked
  // responses, so even the Access Restricted page and the JSON 403 carry
  // these headers (Group 6 scope item 5).
  app.use(securityHeaders)

  // The office-network allowlist (Phase 8, D3): the very first gate, before
  // the JSON parsers (a blocked client must never cause the server to parse
  // its body), before `/api`, and before static files - so a blocked visitor
  // gets no app bundle and no login form. Off entirely when no ALLOWED_IPS is
  // configured (production defaults to on via readConfig's fail-closed
  // check; tests and `npm run dev` are unrestricted unless they opt in).
  if (settings.allowedIps?.entries.length) app.use(officeNetworkOnly(settings.allowedIps, settings.networkDrain))

  // Spreadsheets are the one large payload; everything else stays small
  // (G-10). The import route skips this parser entirely - it mounts its own
  // 20MB one (routes/sessions.js), but only AFTER authentication and the
  // role check, so an unauthenticated or unauthorised request never causes a
  // large-body parse at all (security M2). Every other route keeps the 5MB
  // cap, including a 413 for an oversized body elsewhere under /sessions.
  const IMPORT_ROUTE = /^\/api\/sessions\/[^/]+\/import$/
  const json = express.json({ limit: '5mb' })
  app.use((req, res, next) => (IMPORT_ROUTE.test(req.path) ? next() : json(req, res, next)))

  const api = express.Router()
  // ADMIN_EMAILS (README "Locked out"): a production default of none, so
  // every existing test keeps its current behaviour unless it opts in.
  const adminEmails = settings.adminEmails ?? []
  // Every request past sign-in gets a role and department from `profiles`,
  // never from the token - also passed to authRouter so /auth/me has one too.
  const signedIn = [requireAuth(auth), loadProfile(db, adminEmails)]
  // Custody = devices, employees, assignments, import, reports (D2). Gated
  // per mount, not with a blanket api.use, because reportsRouter is mounted
  // at the API root and a blanket gate there would leak onto later routers.
  const custody = requireRole(...CUSTODY_ROLES)
  const scanRateLimiter = settings.scanRateLimiter ?? createScanRateLimiter()
  const deleteRateLimiter = settings.sessionDeleteRateLimiter ?? createSessionDeleteRateLimiter()
  const exportRateLimiter = settings.exportRateLimiter ?? createExportRateLimiter()
  // Process-wide, unlike the per-user limiter above (security HIGH,
  // lib/exportGuard.js) - injectable so a test can hold it busy deterministically.
  const exportGuard = settings.exportGuard ?? createExportGuard()

  api.get('/health', async (req, res) => {
    try {
      await db.query('select 1')
    } catch (err) {
      console.error('[health] database unreachable:', err.message)
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The database is not reachable.')
    }
    res.json({ data: { status: 'ok' } })
  })

  api.use('/auth', authRouter({ db, auth, requireAuth: signedIn }))

  api.use(signedIn)
  api.use('/devices', custody, devicesRouter({ db }))
  api.use('/employees', custody, employeesRouter({ db }))
  api.use('/assignments', custody, assignmentsRouter({ db }))
  api.use('/departments', departmentsRouter({ db }))
  api.use('/users', usersRouter({ db, auth, adminEmails }))
  api.use('/sessions', sessionsRouter({
    db, auth, scanRateLimiter, deleteRateLimiter, exportRateLimiter, exportGuard,
    timeZone: settings.officeTimeZone ?? 'Asia/Manila',
  }))
  api.use('/items', itemsRouter({ db }))
  api.use(reportsRouter({ db }))
  api.use(() => { throw notFound('Route') })

  app.use('/api', api)
  // The built client (Group 6 scope item 4), only when index.js found
  // `client/dist` - `npm run dev` and every test keep serving nothing here.
  // Mounted AFTER `/api`, so an unknown `/api/*` route still gets its own
  // JSON 404 from the router above, never the SPA's index.html.
  if (settings.clientDist) app.use(serveClient(settings.clientDist))
  // Only 42703/42883/42P01 that a genuinely pending migration explains
  // become 503 DATABASE_OUT_OF_DATE - the same codes from an ordinary query
  // bug get the normal 500 (db M1 / code MEDIUM).
  app.use(createErrorHandler({ pendingMigrations: () => pendingMigrations(db) }))
  return app
}
