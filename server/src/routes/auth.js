import { Router } from 'express'
import { AppError, unauthenticated } from '../lib/errors.js'
import { login, parse, refresh } from '../validation.js'
import { upsertProfile } from '../services/profiles.js'

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
    await upsertProfile(db, session.user)
    res.json({ data: session })
  })

  router.post('/refresh', async (req, res) => {
    const { refresh_token } = parse(refresh, req.body)
    const session = await auth.refresh(refresh_token)
    if (!session) throw unauthenticated('Your session has expired. Please sign in again.')
    res.json({ data: session })
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json({ data: req.user })
  })

  return router
}
