import { randomUUID } from 'node:crypto'
import { conflict } from '../../src/lib/errors.js'

/**
 * Stands in for Supabase Auth in tests - same calls as src/auth/supabase.js
 * (signIn/refresh/verify/createUser/deleteUser), plus test-only helpers
 * (sessionFor, reset, failNextCreateUserWith). Tokens are `test.<userId>`;
 * nothing here ships.
 */
export function createFakeAuth(users) {
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))
  const byId = new Map(users.map((u) => [u.id, u]))
  // Accounts created at runtime via createUser() - dropped by reset() so a
  // registration in one test never leaks a sign-in account into the next.
  const created = new Set()
  let nextCreateFailure = null

  const add = (u) => { byEmail.set(u.email.toLowerCase(), u); byId.set(u.id, u) }
  const remove = (u) => { byEmail.delete(u.email.toLowerCase()); byId.delete(u.id) }

  const publicUser = (u) => ({ id: u.id, email: u.email, full_name: u.full_name })
  const sessionOf = (u) => ({
    token: `test.${u.id}`,
    refresh_token: `refresh.${u.id}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: publicUser(u),
  })

  return {
    async signIn(email, password) {
      const user = byEmail.get(String(email).toLowerCase())
      return user && user.password === password ? sessionOf(user) : null
    },
    async refresh(refreshToken) {
      const user = refreshToken.startsWith('refresh.') && byId.get(refreshToken.slice('refresh.'.length))
      return user ? sessionOf(user) : null
    },
    async verify(token) {
      const user = token.startsWith('test.') && byId.get(token.slice('test.'.length))
      return user ? publicUser(user) : null
    },
    /** A signed-in session without going through /login. */
    sessionFor: (email) => sessionOf(byEmail.get(email.toLowerCase())),

    async createUser({ email, password, full_name }) {
      if (nextCreateFailure) {
        const err = nextCreateFailure
        nextCreateFailure = null
        throw err
      }
      if (byEmail.has(String(email).toLowerCase())) {
        throw conflict('DUPLICATE_EMAIL', 'That email address is already registered.',
          { email: 'Already registered.' })
      }
      const user = { id: randomUUID(), email, password, full_name }
      add(user)
      created.add(user.id)
      return publicUser(user)
    },

    async deleteUser(id) {
      const user = byId.get(id)
      if (!user) return
      remove(user)
      created.delete(id)
    },

    /** Drops every account created at runtime, so tests start clean. */
    reset() {
      for (const id of created) {
        const user = byId.get(id)
        if (user) remove(user)
      }
      created.clear()
    },

    /** Test-only: the next createUser() call throws `err` instead of
     *  succeeding, once - for proving the compensating deleteUser runs. */
    failNextCreateUserWith(err) {
      nextCreateFailure = err
    },
  }
}
