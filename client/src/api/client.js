import { ApiError } from '../lib/errors.js'
import { getSession, getToken, setSession, clearSession } from '../lib/session.js'

const BASE = import.meta.env?.VITE_API_BASE_URL || ''

/** Fired when the session can no longer be renewed; SessionProvider listens
 *  and RequireAuth then sends the user to /login. */
export const SIGNED_OUT_EVENT = 'dht:signed-out'

function buildUrl(path, params) {
  const url = `${BASE}/api${path}`
  if (!params) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

function send(path, { method = 'GET', body, params } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // The server resolves who acted from this token, never from the body.
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(buildUrl(path, params), {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

let refreshing = null

/**
 * Access tokens expire (Supabase: after an hour). Swap the refresh token for a
 * new session once, however many requests hit the 401 together. Resolves to
 * 'refreshed', 'expired' (the server said no), or 'unavailable' (it could not
 * be asked - which must not sign anyone out).
 */
function renewSession() {
  refreshing ??= (async () => {
    const refreshToken = getSession()?.refresh_token
    if (!refreshToken) return 'expired'
    try {
      const response = await send('/auth/refresh', {
        method: 'POST', body: { refresh_token: refreshToken },
      })
      if (response.status === 401 || response.status === 400) return 'expired'
      if (!response.ok) return 'unavailable'
      const payload = await response.json()
      setSession(payload.data)
      return 'refreshed'
    } catch {
      return 'unavailable'
    }
  })().finally(() => { refreshing = null })
  return refreshing
}

function endSession() {
  clearSession()
  globalThis.dispatchEvent?.(new Event(SIGNED_OUT_EVENT))
}

/** fetch with the bearer token, renewing an expired session once. Returns the
 *  raw Response, for callers that want something other than JSON. */
export async function fetchWithAuth(path, options) {
  const wasSignedIn = Boolean(getToken())
  const response = await send(path, options)
  if (response.status !== 401 || !wasSignedIn || path.startsWith('/auth/')) return response

  const outcome = await renewSession()
  if (outcome === 'expired') endSession()
  if (outcome !== 'refreshed') return response

  const retried = await send(path, options)
  if (retried.status === 401) endSession()
  return retried
}

export async function request(path, options) {
  const response = await fetchWithAuth(path, options)

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const code = payload?.error?.code ?? 'UNKNOWN'
    // A deactivated account is done, wherever in the session it happens - not
    // just at login. This must never be a 401 (that means "expired token"),
    // so client.js's ordinary renew logic never sees it; end it explicitly.
    if (response.status === 403 && code === 'ACCOUNT_DISABLED') endSession()
    throw new ApiError({
      status: response.status,
      code,
      message: payload?.error?.message ?? '',
      details: payload?.error?.details ?? {},
    })
  }
  return { data: payload?.data, warning: payload?.warning }
}
