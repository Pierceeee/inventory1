import { loadEnvFile, readConfig } from './config.js'
import { createPostgresDb, sslConfigFrom } from './db/postgres.js'
import { createSupabaseAuth } from './auth/supabase.js'
import { createApp } from './app.js'

loadEnvFile()

let config
try {
  config = readConfig()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const db = createPostgresDb({
  connectionString: config.databaseUrl,
  ssl: sslConfigFrom(process.env, config.databaseUrl),
})
const auth = createSupabaseAuth({ url: config.supabaseUrl, key: config.supabaseKey })
const app = createApp({ db, auth })

const server = app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`)
})

// Say what is wrong at startup rather than on the first click. The server
// keeps running either way; the pool reconnects once the database is back.
db.query('select 1 from public.devices limit 1').catch((err) => {
  const hint = err.code === '42P01'
    ? 'The tables do not exist yet. Run: npm run db:migrate'
    : 'Check DATABASE_URL in .env (use the Session pooler string from Supabase -> Connect).'
  console.error(`[db] ${err.message}\n     ${hint}`)
})

function shutdown() {
  server.close(() => db.close().finally(() => process.exit(0)))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
