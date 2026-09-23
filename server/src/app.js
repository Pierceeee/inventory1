import express from 'express'
import { AppError, notFound } from './lib/errors.js'
import { requireAuth } from './middleware/auth.js'
import { loadProfile, requireRole } from './middleware/access.js'
import { errorHandler } from './middleware/errors.js'
import { CUSTODY_ROLES } from './lib/values.js'
import { createScanRateLimiter } from './lib/rateLimit.js'
import { authRouter } from './routes/auth.js'
import { devicesRouter } from './routes/devices.js'
import { employeesRouter } from './routes/employees.js'
import { assignmentsRouter } from './routes/assignments.js'
import { departmentsRouter } from './routes/departments.js'
import { usersRouter } from './routes/users.js'
import { sessionsRouter } from './routes/sessions.js'
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
  // Every request past sign-in gets a role and department from `profiles`,
  // never from the token - also passed to authRouter so /auth/me has one too.
  const signedIn = [requireAuth(auth), loadProfile(db)]
  // Custody = devices, employees, assignments, import, reports (D2). Gated
  // per mount, not with a blanket api.use, because reportsRouter is mounted
  // at the API root and a blanket gate there would leak onto later routers.
  const custody = requireRole(...CUSTODY_ROLES)
  const scanRateLimiter = settings.scanRateLimiter ?? createScanRateLimiter()

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
  api.use('/users', usersRouter({ db, auth }))
  api.use('/sessions', sessionsRouter({ db, scanRateLimiter }))
  api.use(reportsRouter({ db }))
  api.use(() => { throw notFound('Route') })

  app.use('/api', api)
  app.use(errorHandler)
  return app
}
