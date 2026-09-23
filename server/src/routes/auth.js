import { Router } from 'express'
import { AppError, unauthenticated } from '../lib/errors.js'
import { login, parse, refresh } from '../validation.js'
import { findProfile, upsertProfile } from '../services/profiles.js'

/** Sign-in goes through the API rather than the browser calling Supabase
 *  directly, so the browser holds no Supabase configuration at all. */
export function authRouter({ db, auth, requireAuth }) {
  const router = Router()

  router.post('/login', async (req, res) => {
    const { email, password } = parse(login, req.body)
    const session = await auth.signIn(email, password)
    // One message for wrong email and wrong password alike: saying which half
    // was wrong tells an attacker which addresses are real accounts.
    if (!session) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'That email and password do not match.')
    }
    // Checked before the upsert, and the upsert is skipped for a disabled
    // account: a deactivated person's profile is left exactly as it was.
    const existing = await findProfile(db, session.user.id)
    if (existing?.disabled_at) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated.')
    }
    await upsertProfile(db, session.user)
    res.json({ data: session })
  })

  router.post('/refresh', async (req, res) => {
    const { refresh_token } = parse(refresh, req.body)
    const session = await auth.refresh(refresh_token)
    if (!session) throw unauthenticated('Your session has expired. Please sign in again.')
    // Mirrors /login: a token can still be validly refreshable after an admin
    // deactivates the account, so this must be checked here too, and it is
    // never a 401 - that would look like an ordinary expired-session refresh.
    const existing = await findProfile(db, session.user.id)
    if (existing?.disabled_at) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated.')
    }
    res.json({ data: session })
  })

  // requireAuth here is [requireAuth(auth), loadProfile(db)] (app.js), so
  // req.user already carries role and department by the time this runs.
  router.get('/me', requireAuth, (req, res) => {
    const { id, email, full_name, role, department_id, department_name } = req.user
    res.json({
      data: {
        id, email, full_name, role,
        department: department_id ? { id: department_id, name: department_name } : null,
      },
    })
  })

  return router
}
