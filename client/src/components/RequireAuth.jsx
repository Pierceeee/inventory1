import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/useSession.jsx'

/** Sends signed-out visitors to /login, remembering where they were headed so
 *  signing in returns them there rather than dumping them on the dashboard. */
export default function RequireAuth({ children }) {
  const { session } = useSession()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
