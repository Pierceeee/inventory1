import { createClient } from '@supabase/supabase-js'
import { AppError, conflict, invalid } from '../lib/errors.js'

const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

/**
 * Supabase Auth behind the interface the API uses:
 *   signIn(email, password)          -> session | null
 *   refresh(refreshToken)            -> session | null
 *   verify(accessToken)              -> user | null
 *   createUser({email,password,full_name}) -> { id, email, full_name }
 *   deleteUser(id)                   -> void   (compensation only, best-effort)
 *   settings()                       -> { autoconfirm, signupDisabled } | null
 * where session = { token, refresh_token, expires_at, user } and
 *       user    = { id, email, full_name }.
 *
 * Tests swap in an in-memory implementation of the same calls.
 */
export function createSupabaseAuth({ url, key, serviceRoleKey }) {
  // A GoTrue client remembers the last session it saw, and this one process
  // serves every user - so sign-in and refresh each get a throwaway client.
  const fresh = () => createClient(url, key, CLIENT_OPTIONS)
  const verifier = fresh()

  // Separate client, created lazily and only used for auth.admin.* - never
  // .from(), and the key never reaches the browser (no VITE_ prefix, C2).
  let adminClient = null
  const admin = () => {
    adminClient ??= createClient(url, serviceRoleKey, CLIENT_OPTIONS)
    return adminClient
  }

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

    async createUser({ email, password, full_name }) {
      // The key is optional server config (R2): Register simply cannot work
      // yet, which is a 503, never a crash at startup.
      if (!serviceRoleKey) {
        throw new AppError(503, 'REGISTRATION_UNAVAILABLE',
          'Could not create the account right now. Check the server configuration.')
      }
      const { data, error } = await admin().auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      })
      if (error) throw createUserFailure(error)
      return { id: data.user.id, email: data.user.email ?? email, full_name }
    },

    /** Best-effort compensation when the profile insert after createUser
     *  fails: never let a half-registered account become unrecoverable. */
    async deleteUser(id) {
      if (!serviceRoleKey) return
      const { error } = await admin().auth.admin.deleteUser(id)
      if (error) console.error('[auth] admin deleteUser failed:', error.message)
    },

    /** Read-only project settings, checked once at startup (index.js) to
     *  decide whether ADMIN_EMAILS can be trusted at all (security HIGH -
     *  see lib/adminEmailsPolicy.js). A public GoTrue endpoint: the anon key
     *  is enough, no session or service-role key needed. Returns null
     *  (never throws) on anything but a clean 2xx - a startup check must
     *  never crash the server over a flaky network call, and must never hang
     *  it either: a 5s abort turns a stalled Supabase into the same "null ->
     *  warn and continue" path as any other failure here. */
    async settings() {
      try {
        const res = await fetch(`${url}/auth/v1/settings`, {
          headers: { apikey: key }, signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) return null
        const json = await res.json()
        return { autoconfirm: Boolean(json.mailer_autoconfirm), signupDisabled: Boolean(json.disable_signup) }
      } catch (err) {
        console.error('[auth] could not read Supabase auth settings:', err.message)
        return null
      }
    },
  }
}

/** Maps a failed admin.createUser call. Never 401 - a 401 would sign the
 *  admin who is registering someone else out of their own session. */
function createUserFailure(error) {
  if (error.code === 'email_exists' || error.code === 'user_already_exists') {
    return conflict('DUPLICATE_EMAIL', 'That email address is already registered.',
      { email: 'Already registered.' })
  }
  if (error.code === 'weak_password') {
    return invalid({ password: error.message })
  }
  if (error.status === 429) {
    return new AppError(429, 'RATE_LIMITED', 'Too many attempts. Wait a minute and try again.')
  }
  // Any other 4xx (including 401/403 for a bad or missing key) or 5xx: the
  // admin API itself is the problem, not what the operator typed.
  console.error('[auth] admin createUser failed:', error.message)
  return new AppError(503, 'REGISTRATION_UNAVAILABLE',
    'Could not create the account right now. Check the server configuration.')
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
