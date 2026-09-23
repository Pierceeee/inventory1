// Sets an existing profile's role directly in the database. For bootstrapping
// the first admin on a fresh install, and for fixing an account by hand.
//   npm run user:role -- you@adspark.ph admin
//
// Connects to DATABASE_URL only - never run this from an agent or test.
import { loadEnvFile, readConfig } from '../src/config.js'
import { createPostgresDb, sslConfigFrom } from '../src/db/postgres.js'
import { setUserRole } from '../src/services/users.js'
import { ROLES } from '../src/lib/values.js'

loadEnvFile()

const [email, role] = process.argv.slice(2)
if (!email || !role) {
  console.error('Usage: npm run user:role -- <email> <admin|head|scanner>')
  process.exit(1)
}
if (!ROLES.includes(role)) {
  console.error(`Role must be one of: ${ROLES.join(', ')}.`)
  process.exit(1)
}

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
  const count = await setUserRole(db, email, role)
  if (count === 0) {
    console.log(`No profile for ${email} yet - sign in once, then run this again.`)
  } else {
    console.log(`Set ${email} to ${role} (${count} profile(s)).`)
  }
} catch (err) {
  console.error(err.code === '42P01'
    ? 'The tables do not exist yet. Run: npm run db:migrate'
    : err.message)
  process.exitCode = 1
} finally {
  await db.close()
}
