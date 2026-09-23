import { forbidden } from './errors.js'

/**
 * Never `null` = "no filter": a head or scanner without a department must see
 * nothing, not everything. Pair this with the SQL pattern
 *   where ($1::boolean or x.department_id = $2::uuid)
 * passed as [scope.all, scope.departmentId] - a null departmentId matches
 * nothing, so an unassigned head/scanner gets an empty list rather than every
 * department's rows.
 */
export const departmentScope = (user) =>
  user.role === 'admin'
    ? { all: true, departmentId: null }
    : { all: false, departmentId: user.department_id ?? null }

export const canAccessDepartment = (user, departmentId) =>
  user.role === 'admin' || (user.department_id != null && user.department_id === departmentId)

export function assertDepartmentAccess(user, departmentId) {
  if (!canAccessDepartment(user, departmentId)) throw forbidden('That belongs to another department.')
}
