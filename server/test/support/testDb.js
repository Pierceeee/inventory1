import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { PGlite } from '@electric-sql/pglite'
import { applyMigrations } from '../../src/db/migrate.js'

/**
 * A real Postgres, compiled to WASM and running in-process, with the real
 * migrations applied. The partial unique index, CHECK constraints and 23505
 * errors behave exactly as they do on Supabase - no Docker needed.
 */
export async function createTestDb() {
  const pg = await bootPglite()
  const db = {
    query: async (text, params) => {
      const result = await pg.query(text, params)
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }
    },
    exec: (sql) => pg.exec(sql),
    close: () => pg.close(),
  }
  await applyMigrations(db)
  return db
}

/** The client tests run under jsdom, whose Blob and File lack arrayBuffer() -
 *  which PGlite calls while unpacking its data directory at boot. Lend it
 *  Node's for the duration; under plain Node this changes nothing. */
async function bootPglite() {
  const ambient = { Blob: globalThis.Blob, File: globalThis.File }
  Object.assign(globalThis, { Blob: NodeBlob, File: NodeFile })
  try {
    return await PGlite.create()
  } finally {
    Object.assign(globalThis, ambient)
  }
}

export const emptyDb = (db) =>
  db.exec('truncate table assignments, devices, employees, profiles cascade')
