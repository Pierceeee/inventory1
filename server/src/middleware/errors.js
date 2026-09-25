import { AppError } from '../lib/errors.js'

const envelope = (code, message, details = {}) => ({ error: { code, message, details } })

// Postgres errors that CAN mean the schema is behind the code -
// undefined_table, undefined_column, undefined_function (e.g. a migration
// that added a function/trigger has not run). A pending migration must read
// as "ask IT to run migrations", never a bare 500 or - worse - a 401 that
// signs the caller out (README "Locked out").
//
// But 42703/42883 also fire on an ORDINARY code bug - a typo'd column name,
// a `uuid = text` comparison - which has nothing to do with a migration
// (db M1 / code MEDIUM). The code alone cannot tell the two apart; only
// actually checking pendingMigrations() can.
const SCHEMA_OUT_OF_DATE_CODES = new Set(['42P01', '42703', '42883'])

const PENDING_CACHE_MS = 30_000

/**
 * The single place a failure becomes a response. Deliberate failures carry
 * their own status and code; anything unexpected is logged in full here and
 * reaches the client only as a generic 500 - internals never leak.
 *
 * A factory, not a bare function, so `pendingMigrations` (an async () =>
 * string[]) is injectable - tests give it a fake, createApp gives it the
 * real `() => pendingMigrations(db)` (server/src/db/migrate.js). The result
 * is cached for ~30s: this runs on every 42703/42883/42P01, and a real
 * migration check is one more round trip to Postgres that most of those
 * requests do not need to repeat.
 */
export function createErrorHandler({ pendingMigrations }) {
  let cache = null // { at, versions }

  async function currentlyPending() {
    if (cache && Date.now() - cache.at < PENDING_CACHE_MS) return cache.versions
    let versions = []
    try {
      versions = await pendingMigrations()
    } catch (err) {
      // Can't tell schema-out-of-date from a code bug right now either way -
      // falls through to the generic 500 below rather than a possibly-wrong
      // 503, and does not poison the cache with a failure.
      console.error('[api] could not check for pending migrations:', err.message)
      return []
    }
    cache = { at: Date.now(), versions }
    return versions
  }

  // Express recognises an error handler by its four parameters; Express 5
  // awaits a handler that returns a promise, so this may be async.
  return async function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
      return res.status(err.status).json(envelope(err.code, err.message, err.details))
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json(envelope('VALIDATION_ERROR', 'The request body is not valid JSON.'))
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json(envelope('PAYLOAD_TOO_LARGE', 'That upload is too large. Split it into smaller files.'))
    }
    if (SCHEMA_OUT_OF_DATE_CODES.has(err?.code)) {
      const pending = await currentlyPending()
      if (pending.length) {
        console.error(`[api] ${req.method} ${req.originalUrl} failed (schema out of date):`, err)
        console.error('Run: npm run db:migrate')
        return res.status(503).json(envelope('DATABASE_OUT_OF_DATE',
          'The database is out of date. Ask IT to run the database migrations.'))
      }
      // No migration is pending, so this is a genuine bug in the query, not
      // a schema gap - the hint below deliberately does not say "run
      // migrations", or every such bug would send an operator on a wild
      // goose chase.
      console.error(`[api] ${req.method} ${req.originalUrl} failed (schema is current - likely a query bug, not a pending migration):`, err)
      return res.status(500).json(envelope('INTERNAL_ERROR', 'Something went wrong on the server. Please try again.'))
    }

    console.error(`[api] ${req.method} ${req.originalUrl} failed:`, err)
    return res.status(500).json(envelope('INTERNAL_ERROR', 'Something went wrong on the server. Please try again.'))
  }
}
