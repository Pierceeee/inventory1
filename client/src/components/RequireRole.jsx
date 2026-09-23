import { Navigate } from 'react-router-dom'
import ErrorBanner from './ui/ErrorBanner.jsx'
import { useSession } from '../hooks/useSession.jsx'
import { homeFor } from '../lib/roles.js'

/** Gates a route by role, client-side only - the server decides for real.
 *  Waits for /me to resolve before deciding anything, so a page a user is
 *  not allowed to see never flashes before the redirect. */
export default function RequireRole({ roles, children }) {
  const { role, profileLoading, profileError } = useSession()

  if (profileLoading) return <p role="status" className="p-8 text-sm text-slate-500">Loading…</p>
  if (profileError) return <ErrorBanner error={profileError} className="m-8" />
  if (!roles.includes(role)) return <Navigate to={homeFor(role)} replace />
  return children
}
