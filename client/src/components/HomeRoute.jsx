import { Navigate } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage.jsx'
import { useSession } from '../hooks/useSession.jsx'

/** The index route (§1.5): scanners have no custody access, so "home" for
 *  them is Sessions, not the custody dashboard. */
export default function HomeRoute() {
  const { role, profileLoading } = useSession()

  if (profileLoading) return <p role="status" className="p-8 text-sm text-slate-500">Loading…</p>
  if (role === 'scanner') return <Navigate to="/sessions" replace />
  return <DashboardPage />
}
