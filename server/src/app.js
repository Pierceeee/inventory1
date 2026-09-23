import express from 'express'
import { AppError, notFound } from './lib/errors.js'
import { requireAuth } from './middleware/auth.js'
import { errorHandler } from './middleware/errors.js'
import { authRouter } from './routes/auth.js'
import { devicesRouter } from './routes/devices.js'
import { employeesRouter } from './routes/employees.js'
import { assignmentsRouter } from './routes/assignments.js'
import { reportsRouter } from './routes/reports.js'

/**
 * Builds the API. `db` and `auth` are passed in so tests can run the exact
 * same app against an in-process Postgres and a stand-in auth provider.
 */
export function createApp({ db, auth }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '5mb' }))

  const api = express.Router()
  const signedIn = requireAuth(auth)

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
  api.use('/devices', devicesRouter({ db }))
  api.use('/employees', employeesRouter({ db }))
  api.use('/assignments', assignmentsRouter({ db }))
  api.use(reportsRouter({ db }))
  api.use(() => { throw notFound('Route') })

  app.use('/api', api)
  app.use(errorHandler)
  return app
}
