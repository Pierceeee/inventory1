import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile, readConfig, trustProxyHopCountIsRisky } from './config.js'
import { createPostgresDb, sslConfigFrom } from './db/postgres.js'
import { pendingMigrations } from './db/migrate.js'
import { createSupabaseAuth } from './auth/supabase.js'
import { adminEmailsPolicy } from './lib/adminEmailsPolicy.js'
import { createApp } from './app.js'

// The built client (Group 6, "npm run build && npm start"). Resolved
// relative to this file rather than process.cwd(), so `npm start` works the
// same whether it is launched from the repo root or from server/.
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
const CLIENT_INDEX_HTML = path.join(CLIENT_DIST, 'index.html')

loadEnvFile()

let config
try {
  config = readConfig()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

if (!config.supabaseServiceRoleKey) {
  console.warn(
    '[auth] SUPABASE_SERVICE_ROLE_KEY is not set - the Register page will answer ' +
    '503 REGISTRATION_UNAVAILABLE until it is added to .env.')
}

const db = createPostgresDb({
  connectionString: config.databaseUrl,
  ssl: sslConfigFrom(process.env, config.databaseUrl),
})
const auth = createSupabaseAuth({
  url: config.supabaseUrl, key: config.supabaseKey, serviceRoleKey: config.supabaseServiceRoleKey,
})

// ADMIN_EMAILS trusts the token's email claim, which is only actually
// verified while Supabase requires email confirmation (security HIGH - see
// lib/adminEmailsPolicy.js). Skip the check entirely when nobody is
// configured - no need for a network call nobody's answer would change.
let adminEmails = config.adminEmails
if (adminEmails.length) {
  const authSettings = await auth.settings()
  const policy = adminEmailsPolicy(adminEmails, authSettings)
  adminEmails = policy.adminEmails
  for (const warning of policy.warnings) {
    const log = warning.level === 'error' ? console.error : console.warn
    log(`[auth] ${warning.message}`)
  }
}

// Serve the built client only when it actually exists - a fresh checkout
// (or a `dev` setup that never runs `npm run build`) keeps working exactly
// as before, API-only, with one explanatory log line instead of a crash.
const clientDistExists = fs.existsSync(CLIENT_INDEX_HTML)
if (!clientDistExists) {
  console.log('[client] No client/dist found - serving the API only. Run `npm run build` to also serve the app here.')
}

const app = createApp({
  db, auth,
  settings: {
    adminEmails,
    officeTimeZone: config.officeTimeZone,
    allowedIps: config.allowedIps,
    trustProxy: config.trustProxy,
    clientDist: clientDistExists ? CLIENT_DIST : null,
  },
})

const server = app.listen(config.port, config.host, () => {
  const restricted = config.allowedIps.entries.length > 0
  console.log(`API listening on http://${config.host}:${config.port}` +
    ` (office-network allowlist: ${restricted ? 'ON' : 'OFF'})`)
  if (!restricted) {
    console.warn('[network] ALLOWED_IPS is empty - every request is currently accepted. ' +
      'Set ALLOWED_IPS in .env before exposing this beyond your own machine.')
  }
  // security MEDIUM (review fix #5): a bare hop-count TRUST_PROXY trusts
  // X-Forwarded-For from whoever connects directly, with no check on who
  // that is - only safe when nothing but a same-machine process can reach
  // this server directly in the first place (a loopback HOST).
  if (trustProxyHopCountIsRisky(config.host, config.trustProxy)) {
    console.warn(
      `[network] TRUST_PROXY=${config.trustProxy} is a bare hop count while HOST is not loopback - ` +
      'anyone who connects directly can claim any address via X-Forwarded-For and bypass ALLOWED_IPS. ' +
      'Prefer TRUST_PROXY=loopback or the exact reverse-proxy IP/CIDR instead of a hop count.')
  }
})

// Say what is wrong at startup rather than on the first click. The server
// keeps running either way; the pool reconnects once the database is back.
db.query('select 1 from public.devices limit 1').catch((err) => {
  const hint = err.code === '42P01'
    ? 'The tables do not exist yet. Run: npm run db:migrate'
    : 'Check DATABASE_URL in .env (use the Session pooler string from Supabase -> Connect).'
  console.error(`[db] ${err.message}\n     ${hint}`)
})

// Names exactly which migrations are missing, rather than waiting for a
// route to hit the first absent table/column (which answers 503
// DATABASE_OUT_OF_DATE - see middleware/errors.js).
pendingMigrations(db).then((pending) => {
  if (pending.length) {
    console.log(`[db] ${pending.length} migration(s) not applied: ${pending.join(', ')}\n     Run: npm run db:migrate`)
  }
}).catch((err) => {
  console.error('[db] could not check for pending migrations:', err.message)
})

function shutdown() {
  server.close(() => db.close().finally(() => process.exit(0)))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
