import { signIn } from '../api/auth.js'
import { setSession } from '../lib/session.js'

/** Signs in as one of the fixture staff (server/src/db/exampleData.js) and
 *  stores the session, the same way LoginPage does - for tests that need to
 *  be someone else without going through the login form. */
export async function signInAs(email) {
  const { data } = await signIn(email, 'adspark')
  setSession(data)
  return data
}
