import { conflict, invalid } from '../lib/errors.js'
import { SESSION_ITEM_CAP } from '../lib/values.js'
import { isItemCodeHeader, isReservedColumn } from '../lib/columns.js'
import { isSessionClosedError, sessionNotActive } from './inventorySessions.js'
import { reportLostRaces } from './imports.js'

/** security MEDIUM: a session's size was otherwise unbounded (10,000 rows
 *  per import, but unlimited imports) - and export builds the whole xlsx
 *  synchronously on the event loop, so a session's total size is a server
 *  cost, not just the caller's own data. `existingCount` must be a FRESH
 *  count for a commit (read under the session's row lock, so two concurrent
 *  imports cannot both squeak in under the cap); the dry run uses the
 *  session's already-loaded `item_count`, which is good enough for a preview. */
function assertWithinItemCap(session, existingCount, incomingCount) {
  if (existingCount + incomingCount <= SESSION_ITEM_CAP) return
  throw conflict('SESSION_FULL',
    `${session.name} already has ${existingCount.toLocaleString()} items. Adding ` +
    `${incomingCount.toLocaleString()} more would pass the ${SESSION_ITEM_CAP.toLocaleString()}-item limit per session.`,
    { current: existingCount, cap: SESSION_ITEM_CAP, incoming: incomingCount })
}

const dedupe = (list) => [...new Set(list)]

/** The view row -> the shape the API returns: drop the internal `seq`
 *  (upload order is exposed only as list order, never as a number the
 *  client could rely on), and derive a plain scanned/pending status. */
export function toItem(row) {
  const { seq, ...rest } = row
  return { ...rest, status: row.scanned_at ? 'scanned' : 'pending' }
}

/** Escapes `\`, `%` and `_` so a search term is matched literally, not as a
 *  LIKE pattern - an item code containing a real underscore must not act as
 *  a single-character wildcard (db M1). Paired with `escape '\'` below.
 *  Exported so the Inventory page's cross-session search (services/items.js)
 *  uses the exact same escaping. */
export const escapeLike = (value) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`)

/**
 * Filtering, search and pagination all run server-side (a session can hold
 * thousands of items - the client only ever sees one page). Returns
 * `{ items, total, page, page_size }`; `total` is the count AFTER the
 * status/search filters, so the pager reflects what is actually reachable.
 */
export async function listSessionItems(db, session, { status, q, page = 1, pageSize = 100 } = {}) {
  const conditions = ['session_id = $1']
  const params = [session.id]
  if (status === 'scanned') conditions.push('scanned_at is not null')
  if (status === 'pending') conditions.push('scanned_at is null')
  if (q) {
    params.push(`%${escapeLike(q)}%`)
    conditions.push(`item_code ilike $${params.length} escape '\\'`)
  }
  const where = conditions.join(' and ')

  const { rows: [{ n: total }] } = await db.query(
    `select count(*)::int as n from session_item_details where ${where}`, params)

  const limitParams = [...params, pageSize, (page - 1) * pageSize]
  const { rows } = await db.query(
    `select * from session_item_details where ${where}
      order by seq limit $${limitParams.length - 1} offset $${limitParams.length}`,
    limitParams,
  )
  return { items: rows.map(toItem), total, page, page_size: pageSize }
}

/** Pure: incoming headers (already deduped, reserved/item-code columns
 *  filtered out) against an existing column list. A header equal ignoring
 *  case to an existing column reuses the existing spelling (A4); a brand-new
 *  header is appended in file order. */
function mergeColumns(existingColumns, incoming) {
  const merged = [...existingColumns]
  const resolved = new Map() // header as given in this file -> stored spelling
  for (const header of incoming) {
    const existing = merged.find((c) => c.toLowerCase() === header.toLowerCase())
    if (existing) { resolved.set(header, existing); continue }
    merged.push(header)
    resolved.set(header, header)
  }
  return { merged, resolved }
}

/** null (display_columns) means "show every column" and stays null across an
 *  import - the new headers already show, nothing to add. A chosen subset
 *  gains any brand-new headers this file introduced, so a re-upload never
 *  silently hides a column nobody asked to hide. An explicit choice in the
 *  request (including null, to reset to "show all") always wins. */
function resolveDisplayColumns(currentDisplayColumns, currentColumns, input, merged, incoming, resolved) {
  if (input.display_columns !== undefined) {
    if (input.display_columns) {
      const unknown = input.display_columns.find((c) => !merged.includes(c))
      if (unknown) throw invalid({ display_columns: `Unknown column: ${unknown}` })
    }
    return input.display_columns
  }
  if (currentDisplayColumns == null) return null
  const added = incoming.map((h) => resolved.get(h)).filter((c) => !currentColumns.includes(c))
  return dedupe([...currentDisplayColumns, ...added])
}

/**
 * Dry run (commit falsy) reports what would happen and writes nothing, using
 * the session as already read by the router - fine for a preview.
 *
 * Commit locks the session row, re-checks it is still active, and - because
 * a concurrent import may have committed its own new columns while this one
 * was waiting on the lock (db H1) - re-reads `columns`/`display_columns` from
 * the now-locked row and merges THIS import's headers against that fresh
 * value, never the router's pre-transaction snapshot. Otherwise the second
 * of two concurrent imports would overwrite the first import's new columns
 * with its own stale copy. Rows are inserted with ON CONFLICT DO NOTHING (a
 * concurrent import may also have beaten us to a code); any such loss is
 * folded into `skipped` via reportLostRaces.
 */
export async function importSessionItems(db, session, input) {
  const incoming = dedupe(input.columns.filter((c) => !isReservedColumn(c) && !isItemCodeHeader(c)))
  const incomingSet = new Set(incoming)

  const { rows: existingRows } = await db.query(
    'select lower(item_code) as k from session_items where session_id = $1', [session.id])
  const existingKeys = new Set(existingRows.map((r) => r.k))
  const seenInFile = new Set()
  const result = { created: 0, skipped: 0, errors: [] }
  // Row-level validation (item code + cell values) does not depend on the
  // session's current column list, so it can run once, before the lock;
  // only the column-spelling resolution is deferred to commit time.
  const candidates = []

  input.rows.forEach((row, index) => {
    const line = row.line ?? index + 2
    const code = String(row.item_code ?? '').trim()

    if (!code) {
      result.errors.push({ line, field: 'item_code', message: 'Item code is required.' })
      return
    }
    if (code.length > 128) {
      result.errors.push({ line, field: 'item_code', message: 'Item code must be under 128 characters.' })
      return
    }
    const key = code.toLowerCase()
    if (existingKeys.has(key)) {
      result.skipped += 1
      result.errors.push({ line, field: 'item_code', message: `${code} is already in this session - skipped.` })
      return
    }
    if (seenInFile.has(key)) {
      result.skipped += 1
      result.errors.push({ line, field: 'item_code', message: `${code} appears earlier in this file - skipped.` })
      return
    }

    const cells = []
    let rowFailed = false
    for (const [header, value] of Object.entries(row.data ?? {})) {
      if (!incomingSet.has(header)) continue // reserved / item-code / undeclared headers are ignored
      const text = String(value ?? '').trim()
      if (!text) continue // empty cells are not stored
      if (text.length > 2000) {
        result.errors.push({ line, field: header, message: 'Keep each cell under 2,000 characters.' })
        rowFailed = true
        break
      }
      cells.push([header, text])
    }
    if (rowFailed) return

    seenInFile.add(key)
    candidates.push({ line, item_code: code, cells })
  })

  result.created = candidates.length

  if (!input.commit) {
    assertWithinItemCap(session, session.item_count, candidates.length)
    const { merged, resolved } = mergeColumns(session.columns, incoming)
    const display = resolveDisplayColumns(session.display_columns, session.columns, input, merged, incoming, resolved)
    return { created: result.created, skipped: result.skipped, errors: result.errors, columns: merged, display_columns: display }
  }

  if (candidates.length === 0) {
    // Nothing to write - report the session's actual columns, not a
    // speculative merge that was never applied.
    return { created: 0, skipped: result.skipped, errors: result.errors, columns: session.columns, display_columns: session.display_columns }
  }

  return db.transaction(async (tx) => {
    // Session locked FOR UPDATE first, items inserted second - the right
    // global lock order (services/scans.js's comment on lockSessionForShare).
    const { rows: [locked] } = await tx.query(
      'select status, columns, display_columns from inventory_sessions where id = $1 for update', [session.id])
    if (!locked || locked.status !== 'active') throw sessionNotActive(session)

    // Fresh count under the lock (not session.item_count, which may be
    // stale by the time this transaction got the lock) - the cap must hold
    // even when two imports race to commit at once.
    const { rows: [{ n: currentCount }] } = await tx.query(
      'select count(*)::int as n from session_items where session_id = $1', [session.id])
    assertWithinItemCap(session, currentCount, candidates.length)

    // Fresh merge against the locked row's CURRENT columns (db H1) - not the
    // `session` object the router read before this transaction started.
    const { merged, resolved } = mergeColumns(locked.columns, incoming)
    const display = resolveDisplayColumns(locked.display_columns, locked.columns, input, merged, incoming, resolved)

    const valid = candidates.map(({ line, item_code, cells }) => {
      const data = Object.create(null)
      for (const [header, text] of cells) {
        if (resolved.has(header)) data[resolved.get(header)] = text
      }
      return { line, item_code, data }
    })

    let inserted
    try {
      const { rows } = await tx.query(
        `insert into session_items (session_id, item_code, data)
         select $1, item_code, data from jsonb_to_recordset($2::jsonb) as r(line int, item_code text, data jsonb)
          order by line
         on conflict do nothing
         returning lower(item_code) as k`,
        [session.id, JSON.stringify(valid)],
      )
      inserted = rows
    } catch (err) {
      if (isSessionClosedError(err)) throw sessionNotActive(session)
      throw err
    }
    reportLostRaces(result, valid, new Set(inserted.map((r) => r.k)),
      (row) => row.item_code.toLowerCase(), 'item_code', (row) => row.item_code)

    await tx.query(
      'update inventory_sessions set columns = $2, display_columns = $3 where id = $1',
      [session.id, merged, display],
    )

    return { created: result.created, skipped: result.skipped, errors: result.errors, columns: merged, display_columns: display }
  })
}

/** `actor` is who clicked Clear Items (G3) - logged once per item in the
 *  same transaction as the delete, so the scan history keeps a record of
 *  everything Clear removed. One INSERT ... SELECT, not N inserts. Already
 *  in the right global lock order (session `for update` first, items second
 *  - see services/scans.js's comment on lockSessionForShare). */
export async function clearSessionItems(db, session, actor) {
  return db.transaction(async (tx) => {
    const { rows: [locked] } = await tx.query(
      'select status from inventory_sessions where id = $1 for update', [session.id])
    if (!locked || locked.status !== 'active') throw sessionNotActive(session)

    await tx.query(
      `insert into scan_events (session_id, item_id, item_code, outcome, actor)
       select session_id, id, item_code, 'cleared', $2 from session_items where session_id = $1`,
      [session.id, actor.id],
    )

    const { rowCount } = await tx.query('delete from session_items where session_id = $1', [session.id])
    await tx.query(
      `update inventory_sessions set columns = '{}', display_columns = null where id = $1`, [session.id])
    return { deleted: rowCount }
  })
}
