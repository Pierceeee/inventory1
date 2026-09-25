import { departmentScope } from '../lib/access.js'

const percentOf = (total, scanned) => (total ? Math.round((scanned * 100) / total) : 0)

/**
 * Phase 7: the Dashboard's audit-progress section. Totals cover ACTIVE
 * sessions only (D6) - the join condition filters on the base `status`
 * column, so a session that is merely completed-but-not-yet-archived is
 * excluded exactly like an archived one, and the numbers never grow forever
 * with old history. `left join` keeps a department with zero sessions in
 * the result (admins see every department; a head sees only their own).
 */
export async function getAuditDashboard(db, user) {
  const scope = departmentScope(user)
  const { rows } = await db.query(
    `select d.id as department_id, d.name,
            count(distinct s.id)::int as active_sessions,
            count(i.id)::int as total, count(i.scanned_at)::int as scanned
       from departments d
       left join inventory_sessions s on s.department_id = d.id and s.status = 'active'
       left join session_items i on i.session_id = s.id
      where ($1::boolean or d.id = $2::uuid)
      group by d.id, d.name
      order by lower(d.name)`,
    [scope.all, scope.departmentId],
  )

  const activeSessions = rows.reduce((sum, r) => sum + r.active_sessions, 0)
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  const scanned = rows.reduce((sum, r) => sum + r.scanned, 0)

  return {
    departments: rows.length,
    active_sessions: activeSessions,
    items: { total, scanned, percent: percentOf(total, scanned) },
    by_department: rows.map((r) => ({
      department_id: r.department_id,
      name: r.name,
      active_sessions: r.active_sessions,
      total: r.total,
      scanned: r.scanned,
      percent: percentOf(r.total, r.scanned),
    })),
  }
}
