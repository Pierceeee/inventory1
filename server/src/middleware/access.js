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
 */
export function loadProfile(db) {
  return async (req, res, next) => {
    let profile = await findProfile(db, req.user.id)
    if (!profile) {
      await upsertProfile(db, req.user)
      profile = await findProfile(db, req.user.id)
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
