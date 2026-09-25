import { useQuery } from '@tanstack/react-query'
import { getAuditDashboard, getDashboard } from '../api/dashboard.js'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard().then((r) => r.data),
  })
}

/** Phase 7's audit-progress section - a separate query so it can fail or
 *  load independently of the custody dashboard above (DashboardPage waits
 *  for both before it shows anything, G-11). */
export function useAuditDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'audit'],
    queryFn: () => getAuditDashboard().then((r) => r.data),
  })
}
