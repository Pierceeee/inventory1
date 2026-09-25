import { matchPath } from 'react-router-dom'
import { CUSTODY_ROLES, ROLES } from '../../lib/roles.js'

/**
 * The app's zones and pages, in sidebar order - the one map the sidebar,
 * the route strip ("Custody › Devices") and the Find directory all read, so
 * they can never disagree about where a page lives. Roles only hide links;
 * the server and the route guards decide access.
 */
export const ZONES = [
  {
    id: 'overview', label: 'Overview', key: 'bg-zone-overview',
    links: [{ to: '/', label: 'Dashboard', icon: 'dashboard', end: true, roles: CUSTODY_ROLES }],
  },
  {
    id: 'audits', label: 'Audits', key: 'bg-zone-audits',
    links: [
      { to: '/sessions', label: 'Sessions', icon: 'sessions', roles: ROLES },
      { to: '/inventory', label: 'Inventory', icon: 'inventory', roles: CUSTODY_ROLES },
      // Admin only (R1): heads may read their own department's archived
      // sessions via the API, but the Archive PAGE itself stays admin-only.
      { to: '/archive', label: 'Archive', icon: 'archive', roles: ['admin'] },
    ],
  },
  {
    id: 'custody', label: 'Custody', key: 'bg-zone-custody',
    links: [
      { to: '/devices', label: 'Devices', icon: 'devices', roles: CUSTODY_ROLES },
      { to: '/employees', label: 'Employees', icon: 'employees', roles: CUSTODY_ROLES },
      { to: '/handouts', label: 'Handouts', icon: 'handouts', roles: CUSTODY_ROLES },
      { to: '/import', label: 'Import', icon: 'import', roles: CUSTODY_ROLES },
    ],
  },
  {
    id: 'admin', label: 'Admin', key: 'bg-zone-admin',
    links: [
      { to: '/users', label: 'Users', icon: 'users', end: true, roles: ['admin'] },
      { to: '/users/register', label: 'Register', icon: 'register', roles: ['admin'] },
      { to: '/departments', label: 'Departments', icon: 'departments', roles: ['admin'] },
    ],
  },
]

/** The zones and links a role may see, empty zones dropped. */
export const zonesFor = (role) =>
  ZONES
    .map((zone) => ({ ...zone, links: zone.links.filter((link) => link.roles.includes(role)) }))
    .filter((zone) => zone.links.length > 0)

// Pages below a sidebar page: [pattern, owning page path, label].
const SUB_PAGES = [
  ['/devices/new', '/devices', 'New device'],
  ['/devices/:id/edit', '/devices', 'Edit device'],
  ['/devices/:id', '/devices', 'Device'],
  ['/employees/new', '/employees', 'New employee'],
  ['/employees/:id/edit', '/employees', 'Edit employee'],
  ['/employees/:id', '/employees', 'Employee'],
  ['/sessions/:id/labels', '/sessions', 'Labels'],
  ['/sessions/:id', '/sessions', 'Session'],
]

const allLinks = ZONES.flatMap((zone) => zone.links.map((link) => ({ ...link, zone })))

/**
 * Where a pathname sits: `{ zone, page, sub }`. `page` is the sidebar
 * link, `sub` the label of a page below it (a device, a session's labels),
 * null on the page itself. Null for a path the map does not know.
 */
export function locate(pathname) {
  const exact = allLinks.find((link) => matchPath({ path: link.to, end: true }, pathname))
  if (exact) return { zone: exact.zone, page: exact, sub: null }
  for (const [pattern, owner, label] of SUB_PAGES) {
    if (matchPath({ path: pattern, end: true }, pathname)) {
      const page = allLinks.find((link) => link.to === owner)
      return { zone: page.zone, page, sub: label }
    }
  }
  return null
}
