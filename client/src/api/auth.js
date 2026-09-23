import { request } from './client.js'

// Sign-in goes through the API, which asks Supabase Auth. The browser holds a
// session of { token, refresh_token, expires_at, user }; client.js renews it.
export const signIn = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } })

export const getCurrentUser = () => request('/auth/me')
