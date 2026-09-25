import { AppError, conflict, forbidden, invalid, noDepartment, notFound, tooManyAttempts } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'
import { assertDepartmentAccess, departmentScope } from '../lib/access.js'
import { upsertProfile } from './profiles.js'

const SUMMARY_COLUMNS = `
  id, name, department_id, department_name, status, effective_status,
  completed_at, completed_by, completed_by_name, columns, display_columns,
  created_by, created_by_name, created_at, updated_at, item_count, scanned_count
`

export async function findSession(db, id) {
  if (!isUuid(id)) return undefined
  const { rows } = await db.query(
    `select ${SUMMARY_COLUMNS} from inventory_session_summary where id = $1`, [id])
  return rows[0]
}

/** 404 if it does not exist (or the id is malformed); 403 if it belongs to
 *  another department; 403 if it is archived and this caller may not see
 *  archived sessions - R1: admins and heads see their own department's
 *  archive, scanners never do. */
export async function getSessionFor(db, id, user) {
  const session = await findSession(db, id)
  if (!session) throw notFound('Session')
  assertDepartmentAccess(user, session.department_id)
  if (session.effective_status === 'archived' && user.role === 'scanner') {
    throw forbidden('Archived sessions are only available to admins and heads.')
  }
  return session
}

export const sessionNotActive = (session) => conflict('SESSION_NOT_ACTIVE',
  `${session.name} is ${session.effective_status === 'archived' ? 'archived' : 'completed'} and read-only.`)

/** The database trigger's errcode when a write lands on a session that is no
 *  longer active - the race the app-level check above cannot fully close. */
export const isSessionClosedError = (err) => err?.code === '55000'

/** Every write to a session or its items goes through this: right
 *  department, and the session must still be active (D4 - completed and
 *  archived sessions are read-only everywhere, including for admins). */
export function assertSessionWritable(session, user) {
  assertDepartmentAccess(user, session.department_id)
  if (session.effective_status !== 'active') throw sessionNotActive(session)
}

export async function writableSession(db, id, user) {
  const session = await getSessionFor(db, id, user)
  assertSessionWritable(session, user)
  return session
}

const ORDER = 'order by (effective_status = \'active\') desc, created_at desc'

export async function listSessions(db, user, { status } = {}) {
  const scope = departmentScope(user)

  if (status === 'archived') {
    // R1: heads see their own department's archive; scanners never do (the
    // Archive PAGE itself stays admin-only, but the API scopes for heads).
    if (user.role === 'scanner') {
      throw forbidden('Archived sessions are only available to admins and heads.')
    }
    const { rows } = await db.query(
      `select ${SUMMARY_COLUMNS} from inventory_session_summary
        where ($1::boolean or department_id = $2::uuid) and effective_status = 'archived'
        ${ORDER}`,
      [scope.all, scope.departmentId],
    )
    return rows
  }

  // 'all' still leaves archived sessions out for non-admins - only an admin
  // (or a head, scoped, via status=archived above) ever sees them.
  const statuses = status === undefined
    ? ['active', 'completed']
    : status === 'all'
      ? (user.role === 'admin' ? ['active', 'completed', 'archived'] : ['active', 'completed'])
      : [status]

  const { rows } = await db.query(
    `select ${SUMMARY_COLUMNS} from inventory_session_summary
      where ($1::boolean or department_id = $2::uuid) and effective_status = any($3::text[])
      ${ORDER}`,
    [scope.all, scope.departmentId, statuses],
  )
  return rows
}

export async function createSession(db, input, user) {
  // Same pattern as issueDevice: keep the recorded name current.
  await upsertProfile(db, user)

  let departmentId
  if (user.role === 'admin') {
    if (!input.department_id) throw invalid({ department_id: 'Choose a department.' })
    departmentId = input.department_id
  } else {
    if (!user.department_id) throw noDepartment()
    if (input.department_id && input.department_id !== user.department_id) {
      throw forbidden('That belongs to another department.')
    }
    departmentId = user.department_id
  }

  try {
    const { rows: [{ id }] } = await db.query(
      `insert into inventory_sessions (name, department_id, created_by) values ($1, $2, $3) returning id`,
      [input.name, departmentId, user.id],
    )
    return findSession(db, id)
  } catch (err) {
    if (err?.code === '23503') throw invalid({ department_id: 'No such department.' })
    throw err
  }
}

/** PATCH whitelists name and display_columns only (A5) - department_id is
 *  immutable and status changes only through completeSession. */
export async function updateSession(db, id, patch, user) {
  const session = await writableSession(db, id, user)

  if (patch.display_columns) {
    const unknown = patch.display_columns.find((c) => !session.columns.includes(c))
    if (unknown) throw invalid({ display_columns: `Unknown column: ${unknown}` })
  }

  const sets = []
  const values = [id]
  if (patch.name !== undefined) { values.push(patch.name); sets.push(`name = $${values.length}`) }
  if ('display_columns' in patch) {
    values.push(patch.display_columns ?? null)
    sets.push(`display_columns = $${values.length}`)
  }
  if (sets.length) {
    // The read above can be stale by the time this write lands (another
    // request may complete the session in between) - the WHERE clause is the
    // real guard, atomically, not just the earlier check (security M1).
    const { rowCount } = await db.query(
      `update inventory_sessions set ${sets.join(', ')} where id = $1 and status = 'active'`, values)
    if (rowCount === 0) throw sessionNotActive(session)
  }
  return findSession(db, id)
}

export async function completeSession(db, id, user) {
  const session = await getSessionFor(db, id, user)
  const { rowCount } = await db.query(
    `update inventory_sessions set status = 'completed', completed_at = now(), completed_by = $2
      where id = $1 and status = 'active'`,
    [id, user.id],
  )
  if (rowCount === 0) throw sessionNotActive(session)
  return findSession(db, id)
}

/**
 * Admin-only, at ANY status (F3 - the "download a backup first" step is
 * UI-only; the server does not require it). Order matters: the route already
 * checked the role (403); this checks existence (404), then the per-user
 * failed-attempt limiter (429, BEFORE calling Supabase at all - a locked-out
 * attacker never even reaches signIn), then the password itself (422, NEVER
 * 401 - a typo must not sign the admin out of their own session).
 *
 * security HIGH (reviewer-reproduced): the reservation is taken with `hit()`
 * BEFORE `auth.signIn()`, not a `check()`-then-`commit()`-after straddling
 * that `await`. `check()` alone only LOOKS at the budget; two (or twenty)
 * concurrent requests would all see it un-full and all pass, and only commit
 * afterwards - Supabase's own ~100-150ms latency is easily enough for every
 * one of them to slip through before any commits. Reserving synchronously,
 * before the network call, closes that window: only 5 concurrent callers can
 * ever win the reservation at all, no matter how slow signIn is.
 *   - Wrong password: the reservation already counts against the budget -
 *     nothing further to do.
 *   - Right password: this was never a real failed attempt - `reset()` gives
 *     the whole budget back (also clears any earlier genuine failures, which
 *     is fine: a successful admin re-auth is exactly when forgiving prior
 *     typos is safe).
 *   - signIn ITSELF throws (Supabase outage, its own rate limit, etc - never
 *     a wrong password, which resolves to `null`): that is not the caller's
 *     fault, so `release()` gives back the one reservation this attempt took
 *     before rethrowing, and an outage can never burn down the budget.
 */
export async function deleteSession(db, auth, deleteRateLimiter, id, password, user) {
  const session = await getSessionFor(db, id, user)

  const { allowed, retryAfterMs } = deleteRateLimiter.hit(user.id)
  if (!allowed) {
    throw tooManyAttempts('Too many attempts. Wait a while and try again.',
      { retry_after_ms: Math.ceil(retryAfterMs) })
  }

  let check
  try {
    check = user.email ? await auth.signIn(user.email, password) : null
  } catch (err) {
    deleteRateLimiter.release(user.id)
    throw err
  }

  if (!check || check.user.id !== user.id) {
    throw new AppError(422, 'WRONG_PASSWORD', 'That password is not correct.',
      { password: 'That password is not correct.' })
  }
  deleteRateLimiter.reset(user.id)

  // Items and scan_events cascade (they reference inventory_sessions.id
  // on delete cascade) - nothing else to clean up. This DELETE locks the
  // session row before its cascade reaches the item rows, so it is already
  // in the right global lock order (services/scans.js's comment on
  // lockSessionForShare).
  await db.query('delete from inventory_sessions where id = $1', [id])
  return { id: session.id, name: session.name, items: session.item_count }
}
