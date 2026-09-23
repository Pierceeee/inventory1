const KEY = 'dht.session'

/**
 * The token is what BE-5 will verify as a real Supabase JWT. Everything above
 * this module only ever sees `getSession()` and `getToken()`, so swapping the
 * issuer later touches nothing else.
 *
 * Storage is wrapped because it throws in private windows and with site data
 * blocked - a signed-out state is a far better failure than a blank screen.
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    /* non-persistent session is still a working session */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}

export const getToken = () => getSession()?.token ?? null

export function initialsOf(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
