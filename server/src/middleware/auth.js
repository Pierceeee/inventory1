import { unauthenticated } from '../lib/errors.js'

/** Every /api route except health and sign-in requires a signed-in user.
 *  Who acted is taken from the verified token and never from the request
 *  body, or anyone could record a handout as a colleague. */
export function requireAuth(auth) {
  return async (req, res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '')
    if (!match) throw unauthenticated()

    const user = await auth.verify(match[1])
    if (!user) throw unauthenticated('Your session has expired. Please sign in again.')

    req.user = user
    next()
  }
}
