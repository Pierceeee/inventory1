import { request } from './client.js'

// Stands in for Supabase Auth during the frontend phases. BE-5 replaces these
// two calls with the Supabase client SDK; nothing else changes.
export const signIn = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } })

export const getCurrentUser = () => request('/auth/me')
