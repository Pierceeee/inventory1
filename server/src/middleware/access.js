import { AppError, forbidden } from '../lib/errors.js'
import { findProfile, upsertProfile } from '../services/profiles.js'

/**
 * Reads role and department from `profiles` on every request - never from the
 * token's user_metadata, which a signed-in user can edit themselves. Runs
 * right after requireAuth, so every route (including /auth/me) sees a role.
 *
 * A first-time visitor has no profile row yet: create one (defaults to
 * scanner, no department) and read it straight back, rather than trying to
 * get role/department out of the upsert's own RETURNING - that upsert skips
 * the write (and returns nothing) when nothing changed.
 *
 * `adminEmails` is the ADMIN_EMAILS bootstrap (README "Locked out"): the
 * operator's recovery path when a Supabase user id changes (the account was
 * deleted and re-created) and the old admin profile is left orphaned, with
 * nobody left who can promote anyone through the Users page. Matched against
 * the VERIFIED token email only (req.user.email, from requireAuth) - never
 * anything a client could put in a request body.
 */
export function loadProfile(db, adminEmails = []) {
  const adminEmailSet = new Set(adminEmails.map((email) => email.trim().toLowerCase()))

  return async (req, res, next) => {
    let profile = await findProfile(db, req.user.id)
    if (!profile) {
      await upsertProfile(db, req.user)
      profile = await findProfile(db, req.user.id)
    }

    // The Set lookup is free, so every ordinary request pays nothing extra;
    // only a listed email causes the additional write + re-read below. Runs
    // before the disabled check, but does not touch disabled_at itself - a
    // deactivated account stays deactivated even if it is also listed.
    if (profile.role !== 'admin' && req.user.email && adminEmailSet.has(req.user.email.toLowerCase())) {
      await db.query(`update profiles set role = 'admin' where id = $1 and role <> 'admin'`, [profile.id])
      profile = await findProfile(db, profile.id)
      console.log(`[auth] ${req.user.email} promoted to admin (ADMIN_EMAILS)`)
    }

    if (profile.disabled_at) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated.')
    }

    req.user = {
      ...req.user,
      role: profile.role,
      department_id: profile.department_id,
      department_name: profile.department_name,
    }
    next()
  }
}

/** Throws 403 (never 401) when the signed-in user's role is not one of
 *  `roles`. Must run before parse() and before any DB lookup in a route, so a
 *  scanner sending a bad body still gets 403, not 400. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) throw forbidden()
    next()
  }
}
