import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations')

/**
 * Applies every `supabase/migrations/*.sql` not yet recorded, in filename
 * order, each inside its own transaction. Returns the versions applied.
 *
 * Deliberately tiny so the schema can be set up with nothing but a
 * DATABASE_URL - no Supabase CLI required.
 */
export async function applyMigrations(db, dir = MIGRATIONS_DIR) {
  await db.exec(`
    create table if not exists public.schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations enable row level security;
  `)

  const { rows } = await db.query('select version from public.schema_migrations')
  const applied = new Set(rows.map((r) => r.version))

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const done = []

  for (const file of files) {
    const version = file.replace(/\.sql$/, '')
    if (applied.has(version)) continue
    if (!/^[\w.-]+$/.test(version)) throw new Error(`Unsafe migration file name: ${file}`)

    const sql = await fs.readFile(path.join(dir, file), 'utf8')
    try {
      await db.exec(`begin;\n${sql}\n;insert into public.schema_migrations (version) values ('${version}');\ncommit;`)
    } catch (err) {
      await db.exec('rollback').catch(() => {})
      err.message = `Migration ${file} failed: ${err.message}`
      throw err
    }
    done.push(version)
  }
  return done
}
