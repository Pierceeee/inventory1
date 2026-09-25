import { conflict, invalid, isUniqueViolation, notFound } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'
import { departmentScope } from '../lib/access.js'
import {
  assertSessionWritable, findSession, isSessionClosedError, sessionNotActive,
} from './inventorySessions.js'
import { escapeLike, toItem } from './sessionItems.js'
import { lockSessionForShare } from './scans.js'

const detailOf = (db, id) =>
  db.query('select * from session_item_details where id = $1', [id]).then((r) => r.rows[0])

const EMPTY_RESULT = (page, pageSize) => ({
  items: [], columns: [], counts: { total: 0, scanned: 0, pending: 0 }, page, page_size: pageSize, total: 0,
})

/**
 * The Inventory page: every item an admin/head can see, across every
 * session, filtered/searched/paginated server-side. Scope is department-only
 * - admins and heads (the only two roles this route allows) both see their
 * own department's archived sessions too (R1); there is no separate
 * "hide archived" branch here the way sessions.js has one for scanners,
 * because scanners never reach this route at all.
 */
export async function listItems(db, user, { session_id, status, q, page = 1, page_size = 100 } = {}) {
  if (session_id !== undefined && !isUuid(session_id)) return EMPTY_RESULT(page, page_size)

  const scope = departmentScope(user)
  const conditions = ['($1::boolean or department_id = $2::uuid)']
  const params = [scope.all, scope.departmentId]
  if (session_id) { params.push(session_id); conditions.push(`session_id = $${params.length}`) }
  if (q) { params.push(`%${escapeLike(q)}%`); conditions.push(`item_code ilike $${params.length} escape '\\'`) }
  const baseWhere = conditions.join(' and ')

  // Counts ignore the status filter, so clicking Scanned/Pending never
  // zeroes out the other two cards - only session_id/q narrow them.
  const { rows: [{ total: countTotal, scanned: countScanned }] } = await db.query(
    `select count(*)::int as total, count(scanned_at)::int as scanned
       from session_item_details where ${baseWhere}`,
    params,
  )
  const counts = { total: countTotal, scanned: countScanned, pending: countTotal - countScanned }

  const listConditions = [...conditions]
  const listParams = [...params]
  if (status === 'scanned') listConditions.push('scanned_at is not null')
  if (status === 'pending') listConditions.push('scanned_at is null')
  const listWhere = listConditions.join(' and ')

  const { rows: [{ n: total }] } = await db.query(
    `select count(*)::int as n from session_item_details where ${listWhere}`, listParams)

  const limitParams = [...listParams, page_size, (page - 1) * page_size]
  const { rows } = await db.query(
    `select * from session_item_details where ${listWhere}
      order by session_created_at desc, seq
      limit $${limitParams.length - 1} offset $${limitParams.length}`,
    limitParams,
  )

  // Columns: the ordered union of the `columns` of every session
  // represented in this filtered result (oldest session first, so a later
  // session's brand-new headers land after the ones already established),
  // minus any column with no value anywhere in the WHOLE filtered result -
  // not just the current page (A3: "column has a value" == "key exists").
  const { rows: sessionCols } = await db.query(
    `select s.columns from inventory_sessions s
      where s.id in (select distinct session_id from session_item_details where ${listWhere})
      order by s.created_at asc`,
    listParams,
  )
  const union = []
  for (const { columns: sessionColumns } of sessionCols) {
    for (const c of sessionColumns) if (!union.includes(c)) union.push(c)
  }

  // One EXISTS per candidate column (via unnest), not a cross-join over
  // every row's every key: the old `jsonb_each_text` cross join scans and
  // explodes the WHOLE filtered set regardless of how many columns there
  // are to check, which is super-linear in (rows x columns). This instead
  // does at most `union.length` semi-join probes, each free to stop at the
  // first match - measured 899ms -> 91ms at 40k items / 13 columns. Same
  // semantics (A3): a column counts as non-empty if ANY item anywhere in
  // the whole filtered set (not just the current page) has a trimmed,
  // non-blank value for it.
  let columns = []
  if (union.length) {
    const params = [...listParams, union]
    const { rows: nonEmpty } = await db.query(
      `select c.col from unnest($${params.length}::text[]) as c(col)
        where exists (
          select 1 from session_item_details i
           where ${listWhere} and i.data ? c.col and btrim(i.data ->> c.col) <> ''
        )`,
      params,
    )
    const nonEmptyKeys = new Set(nonEmpty.map((r) => r.col))
    columns = union.filter((c) => nonEmptyKeys.has(c))
  }

  return {
    items: rows.map((row) => ({ ...toItem(row), writable: row.session_effective_status === 'active' })),
    columns,
    counts,
    page, page_size, total,
  }
}

/** Admin anywhere, head in their own department (assertSessionWritable
 *  checks department access BEFORE the active check - 403 before 409). The
 *  session must still be active (D4): session_items' own insert/update
 *  trigger (assert_session_active) is the atomic guard against a
 *  just-completed session, surfaced here as isSessionClosedError. Never
 *  touches scanned_at/scanned_by.
 *
 *  db HIGH: the item lookup and the department/active checks below are
 *  plain reads (no lock survives past them) - the WRITE itself happens
 *  inside a transaction that opens with the session `for share` lock, same
 *  global lock order as scans.js's scanItem/undoScan (see the comment
 *  there), so this can never deadlock against clearSessionItems/deleteItem/
 *  the import commit/deleteSession, which all lock the session first too. */
export async function updateItem(db, id, patch, user) {
  if (!isUuid(id)) throw notFound('Item')
  const { rows: [item] } = await db.query(
    'select id, session_id, item_code from session_items where id = $1', [id])
  if (!item) throw notFound('Item')

  const session = await findSession(db, item.session_id)
  assertSessionWritable(session, user)

  if (patch.data) {
    const unknown = Object.keys(patch.data).find((k) => !session.columns.includes(k))
    if (unknown) throw invalid({ data: `Unknown column: ${unknown}` })
  }

  // Cleaned once, up front - this only depends on the PATCH values, never on
  // the item's current data, so it can fail fast (400) before opening the
  // write transaction / taking any lock at all.
  const cleanedData = patch.data && Object.entries(patch.data).map(([key, value]) => {
    const text = String(value ?? '').trim()
    if (text.length > 2000) throw invalid({ [key]: 'Keep each cell under 2,000 characters.' })
    return [key, text]
  })

  const itemCode = patch.item_code !== undefined ? patch.item_code.trim() : null

  try {
    await db.transaction(async (tx) => {
      // Global lock order (services/scans.js) - must be the first statement
      // in this transaction.
      await lockSessionForShare(tx, item.session_id)

      // Fresh read under the lock, not the pre-transaction snapshot above -
      // another edit could have changed `data` while this request waited.
      const { rows: [current] } = await tx.query('select data from session_items where id = $1', [id])
      if (!current) throw notFound('Item')

      // Object.create(null) as elsewhere (services/sessionItems.js): a header
      // literally named __proto__ must stay ordinary data, not the prototype.
      const merged = Object.assign(Object.create(null), current.data)
      if (cleanedData) {
        for (const [key, text] of cleanedData) {
          if (!text) delete merged[key] // an empty value removes the key
          else merged[key] = text
        }
      }

      await tx.query(
        `update session_items set item_code = coalesce($2, item_code), data = $3::jsonb where id = $1`,
        [id, itemCode, JSON.stringify(merged)],
      )
    })
  } catch (err) {
    if (isUniqueViolation(err, 'session_items_code_key')) {
      throw conflict('DUPLICATE_ITEM_CODE', `${itemCode ?? item.item_code} is already in this session.`,
        { item_code: 'Already in this session.' })
    }
    if (isSessionClosedError(err)) throw sessionNotActive(session)
    throw err
  }

  return toItem(await detailOf(db, id))
}

/** Admin only (enforced by the route). Logs a `deleted` scan_events row
 *  BEFORE the delete, in one transaction - the FK (item_id ... on delete set
 *  null) then nulls that very row's item_id when the item goes, which the
 *  append-only trigger allows (it is the one update the trigger lets
 *  through). An explicit row lock re-checks the session is still active,
 *  same pattern as clearSessionItems - the session_items table has no
 *  delete trigger of its own (G-8), so this lock is the only guard. Already
 *  in the right global lock order (session `for update` first, item second -
 *  see services/scans.js's comment on lockSessionForShare). */
export async function deleteItem(db, id, user) {
  if (!isUuid(id)) throw notFound('Item')
  const { rows: [item] } = await db.query(
    'select id, session_id, item_code from session_items where id = $1', [id])
  if (!item) throw notFound('Item')

  const session = await findSession(db, item.session_id)

  return db.transaction(async (tx) => {
    const { rows: [locked] } = await tx.query(
      'select status from inventory_sessions where id = $1 for update', [item.session_id])
    if (!locked || locked.status !== 'active') throw sessionNotActive(session)

    await tx.query(
      `insert into scan_events (session_id, item_id, item_code, outcome, actor)
       values ($1, $2, $3, 'deleted', $4)`,
      [item.session_id, item.id, item.item_code, user.id],
    )
    await tx.query('delete from session_items where id = $1', [id])
    return { id: item.id, item_code: item.item_code }
  })
}
