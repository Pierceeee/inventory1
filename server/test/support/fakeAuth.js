/**
 * Stands in for Supabase Auth in tests - same three calls as
 * src/auth/supabase.js. Tokens are `test.<userId>`; nothing here ships.
 */
export function createFakeAuth(users) {
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))
  const byId = new Map(users.map((u) => [u.id, u]))
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
  }
}
