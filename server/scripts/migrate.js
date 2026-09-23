// Applies supabase/migrations/*.sql to DATABASE_URL.  Usage: npm run db:migrate
import { loadEnvFile, readConfig } from '../src/config.js'
import { createPostgresDb, sslConfigFrom } from '../src/db/postgres.js'
import { applyMigrations } from '../src/db/migrate.js'

loadEnvFile()
let config
try {
  config = readConfig(process.env, { needAuth: false })
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const db = createPostgresDb({
  connectionString: config.databaseUrl,
  ssl: sslConfigFrom(process.env, config.databaseUrl),
})

try {
  const applied = await applyMigrations(db)
  console.log(applied.length
    ? `Applied ${applied.length} migration(s):\n  ${applied.join('\n  ')}`
    : 'Database is already up to date.')
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await db.close()
}
