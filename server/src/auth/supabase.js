import { createClient } from '@supabase/supabase-js'
import { AppError } from '../lib/errors.js'

const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

/**
 * Supabase Auth behind the interface the API uses:
 *   signIn(email, password) -> session | null
 *   refresh(refreshToken)   -> session | null
 *   verify(accessToken)     -> user | null
 * where session = { token, refresh_token, expires_at, user } and
 *       user    = { id, email, full_name }.
 *
 * Tests swap in an in-memory implementation of the same three calls.
 */
export function createSupabaseAuth({ url, key }) {
  // A GoTrue client remembers the last session it saw, and this one process
  // serves every user - so sign-in and refresh each get a throwaway client.
  const fresh = () => createClient(url, key, CLIENT_OPTIONS)
  const verifier = fresh()

  return {
    async signIn(email, password) {
      const { data, error } = await fresh().auth.signInWithPassword({ email, password })
      if (error) return rejectedOrThrow(error)
      return toSession(data.session)
    },

    async refresh(refreshToken) {
      const { data, error } = await fresh().auth.refreshSession({ refresh_token: refreshToken })
      if (error) return rejectedOrThrow(error)
      return data.session ? toSession(data.session) : null
    },

    async verify(token) {
      // Verified locally against the project's published signing keys where
      // possible; projects on the legacy shared secret fall back to a call.
      const { data, error } = await verifier.auth.getClaims(token)
      if (error) return rejectedOrThrow(error)
      const claims = data?.claims
      // The anon key is itself a validly signed JWT. Only a signed-in user's
      // token carries role=authenticated and a subject.
      if (!claims?.sub || claims.role !== 'authenticated') return null
      return {
        id: claims.sub,
        email: claims.email ?? null,
        full_name: displayName(claims.user_metadata, claims.email),
      }
    },
  }
}

function toSession(session) {
  const { user } = session
  return {
    token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: user.id,
      email: user.email ?? null,
      full_name: displayName(user.user_metadata, user.email),
    },
  }
}

/** Set a person's name in Supabase: Authentication -> Users -> the user ->
 *  raw user metadata {"full_name": "Rina Delgado"}. Falls back to the email. */
function displayName(meta, email) {
  return meta?.full_name?.trim() || meta?.name?.trim() || email?.split('@')[0] || 'Unknown'
}

/** 4xx means "no": wrong password, expired token, bad signature. Anything else
 *  means Supabase could not be asked, which must not look like a sign-out. */
function rejectedOrThrow(error) {
  const status = error.status ?? 0
  if (status === 429) {
    throw new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Wait a minute and try again.')
  }
  if (status >= 400 && status < 500) return null
  console.error('[auth] Supabase Auth unavailable:', error.message)
  throw new AppError(503, 'AUTH_UNAVAILABLE', 'Could not reach the sign-in service. Try again shortly.')
}
