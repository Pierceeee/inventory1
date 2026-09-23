// Mirrors server/src/lib/values.js and server/src/lib/access.js. These only
// hide UI - the server is what actually decides every request.
export const ROLES = ['admin', 'head', 'scanner']
export const ROLE_LABELS = { admin: 'Admin', head: 'Head', scanner: 'Scanner' }
export const CUSTODY_ROLES = ['admin', 'head']

export const homeFor = (role) => (role === 'scanner' ? '/sessions' : '/')

export const isAdmin = (profile) => profile?.role === 'admin'

// `profile` is the shape GET /api/auth/me returns: department is a nested
// { id, name } object or null, never a bare department_id.
export const canManage = (profile, departmentId) =>
  isAdmin(profile) ||
  (profile?.role === 'head' && profile?.department?.id != null && profile.department.id === departmentId)

export const canScan = (profile, departmentId) =>
  isAdmin(profile) || (profile?.department?.id != null && profile.department.id === departmentId)
