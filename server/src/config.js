import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_ENV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env')

/** Loads the repo-root .env (one file for server and client). Real
 *  environment variables win over the file. */
export function loadEnvFile() {
  if (fs.existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV)
}

/** Reads the environment once at startup and fails loudly on anything
 *  missing, rather than on the first request that needs it. */
export function readConfig(env = process.env, { needAuth = true } = {}) {
  const missing = []
  const need = (key) => {
    const value = env[key]?.trim()
    if (!value) missing.push(key)
    return value
  }

  const config = {
    port: Number(env.PORT) || 3001,
    host: env.HOST?.trim() || '127.0.0.1',
    databaseUrl: need('DATABASE_URL'),
    supabaseUrl: needAuth ? need('SUPABASE_URL') : env.SUPABASE_URL,
    supabaseKey: needAuth ? need('SUPABASE_ANON_KEY') : env.SUPABASE_ANON_KEY,
    // Optional (R2): lets Register create sign-in accounts. Missing it does
    // not stop the server starting - only POST /api/users needs it, and it
    // then answers 503 REGISTRATION_UNAVAILABLE rather than failing to boot.
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  }

  if (missing.length) {
    throw new Error(
      `Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.\n` +
      'Copy .env.example to .env at the repo root and fill it in.')
  }
  return config
}
