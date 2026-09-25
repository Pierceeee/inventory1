import { conflict, invalid, notFound } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'
import { departmentExists } from './departments.js'
import { findProfile } from './profiles.js'

export async function listUsers(db) {
  const { rows } = await db.query(
    `select p.id, p.email, p.full_name, p.role, p.department_id, d.name as department_name,
            p.disabled_at, p.created_at
       from profiles p
       left join departments d on d.id = p.department_id
      order by lower(coalesce(p.full_name, p.email))`,
  )
  return rows
}

/**
 * Creates both the Supabase sign-in account and the profile row. The
 * department is checked BEFORE the auth account is created, so a typo'd
 * department never leaves an orphan account behind. If the profile insert
 * still fails for some other reason, the auth account is deleted to match -
 * a registration must succeed completely or not at all (C4).
 */
export async function registerUser(db, auth, input) {
  if (input.department_id && !(await departmentExists(db, input.department_id))) {
    throw invalid({ department_id: 'No such department.' })
  }

  const account = await auth.createUser({
    email: input.email, password: input.password, full_name: input.full_name,
  })

  try {
    await db.query(
      `insert into profiles (id, email, full_name, role, department_id)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update
         set email = excluded.email, full_name = excluded.full_name,
             role = excluded.role, department_id = excluded.department_id`,
      [account.id, account.email, account.full_name, input.role, input.department_id ?? null],
    )
  } catch (err) {
    await auth.deleteUser(account.id).catch((deleteErr) => {
      console.error('[users] compensating deleteUser failed:', deleteErr.message)
    })
    // The pre-check above already covers the common case; this only fires on
    // a genuine race (the department vanished between the check and the
    // write), and must still read as a 400 naming the field, not a 500.
    throw isMissingDepartment(err) ? invalid({ department_id: 'No such department.' }) : err
  }

  return findProfile(db, account.id)
}

/**
 * A single guarded change of role/department/disabled. Runs inside a
 * transaction that locks every enabled admin row (R3), so two concurrent
 * requests can never both demote/disable the last one - whichever commits
 * second sees the other's change and refuses.
 *
 * `adminEmails` mirrors the ADMIN_EMAILS server setting (README "Locked
 * out"): an account whose email is listed there is re-promoted to admin on
 * its next request regardless of what is in the database (loadProfile), so
 * demoting it here would only be undone a moment later - refuse instead of
 * silently doing nothing.
 */
export async function updateUser(db, id, patch, actorId, adminEmails = []) {
  if (!isUuid(id)) throw notFound('User')
  if (patch.department_id && !(await departmentExists(db, patch.department_id))) {
    throw invalid({ department_id: 'No such department.' })
  }

  // Only a role or disabled change can affect who the last admin is - a
  // department-only patch has no reason to lock the whole admin set (M1).
  const needsAdminLock = patch.role !== undefined || patch.disabled !== undefined

  return db.transaction(async (tx) => {
    let isTheLastAdmin = false
    if (needsAdminLock) {
      const { rows: enabledAdmins } = await tx.query(
        `select id from profiles where role = 'admin' and disabled_at is null for update`)
      isTheLastAdmin = enabledAdmins.length === 1 && enabledAdmins[0].id === id
    }

    const { rows: [current] } = await tx.query('select * from profiles where id = $1', [id])
    if (!current) throw notFound('User')

    if (patch.disabled === true && actorId === id) {
      throw conflict('CANNOT_DISABLE_SELF', 'You cannot deactivate your own account.')
    }

    const demotingConfiguredAdmin = patch.role !== undefined && patch.role !== 'admin' &&
      isConfiguredAdmin(current.email, adminEmails)
    if (demotingConfiguredAdmin) {
      throw conflict('CONFIGURED_ADMIN',
        'This account is an admin because it is listed in ADMIN_EMAILS on the server.')
    }

    const demotingLastAdmin = patch.role !== undefined && patch.role !== 'admin' && isTheLastAdmin
    const disablingLastAdmin = patch.disabled === true && isTheLastAdmin
    if (demotingLastAdmin || disablingLastAdmin) {
      throw conflict('LAST_ADMIN', 'At least one admin must remain.')
    }

    const sets = []
    const values = [id]
    if (patch.role !== undefined) { values.push(patch.role); sets.push(`role = $${values.length}`) }
    if ('department_id' in patch) {
      values.push(patch.department_id ?? null)
      sets.push(`department_id = $${values.length}`)
    }
    if (patch.disabled !== undefined) {
      values.push(patch.disabled ? new Date() : null)
      sets.push(`disabled_at = $${values.length}`)
    }
    if (sets.length) {
      try {
        await tx.query(`update profiles set ${sets.join(', ')} where id = $1`, values)
      } catch (err) {
        // Same race as registerUser: the pre-check passed, but the
        // department was gone by the time this write ran.
        throw isMissingDepartment(err) ? invalid({ department_id: 'No such department.' }) : err
      }
    }

    return findProfile(tx, id)
  })
}

/** Postgres foreign_key_violation on profiles.department_id. */
const isMissingDepartment = (err) => err?.code === '23503'

const isConfiguredAdmin = (email, adminEmails) =>
  Boolean(email) && adminEmails.some((listed) => listed.toLowerCase() === email.toLowerCase())

/** For the `user:role` bootstrap script. Not exposed over HTTP: it connects
 *  to DATABASE_URL directly. Promotes every profile with that email - there
 *  can only sensibly be one, but the count tells the operator what happened. */
export async function setUserRole(db, email, role) {
  const { rowCount } = await db.query(
    'update profiles set role = $2 where lower(email) = lower($1)', [email, role])
  return rowCount
}
