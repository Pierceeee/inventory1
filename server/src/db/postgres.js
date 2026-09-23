import fs from 'node:fs'
import pg from 'pg'

/**
 * The whole app talks to the database through two calls:
 *   query(text, params) -> { rows, rowCount }   one parameterised statement
 *   exec(sql)                                    a multi-statement script (migrations)
 * Tests satisfy the same interface with an in-process Postgres (PGlite), so the
 * services run unchanged against both.
 */
export function createPostgresDb({ connectionString, ssl }) {
  const pool = new pg.Pool({ connectionString: withoutSslParams(connectionString), ssl, max: 10 })

  pool.on('error', (err) => {
    // An idle client dropped by the server. The pool replaces it; log and move on.
    console.error('[db] idle client error:', err.message)
  })

  return {
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  }
}

/**
 * SSL is configured explicitly rather than through `?sslmode=` in the URL,
 * because node-postgres lets the URL silently override the `ssl` option.
 *
 *   DATABASE_SSL=false        no TLS (a local Postgres)
 *   DATABASE_SSL_CA=<path>    TLS, verifying the server against that CA
 *                             (Supabase: Settings -> Database -> SSL certificate)
 *   otherwise                 TLS without certificate verification
 */
export function sslConfigFrom(env, connectionString) {
  if (env.DATABASE_SSL === 'false') return false
  if (env.DATABASE_SSL_CA) {
    return { ca: fs.readFileSync(env.DATABASE_SSL_CA, 'utf8'), rejectUnauthorized: true }
  }
  const host = safeHost(connectionString)
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
  return { rejectUnauthorized: false }
}

function withoutSslParams(connectionString) {
  try {
    const url = new URL(connectionString)
    for (const key of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey']) {
      url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return connectionString
  }
}

function safeHost(connectionString) {
  try {
    return new URL(connectionString).hostname.replace(/^\[|\]$/g, '')
  } catch {
    return ''
  }
}
