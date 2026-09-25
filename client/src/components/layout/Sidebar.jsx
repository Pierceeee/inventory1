import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { useSession } from '../../hooks/useSession.jsx'
import { initialsOf } from '../../lib/session.js'
import { ROLE_LABELS } from '../../lib/roles.js'
import { zonesFor } from './navigation.js'

// Heads and scanners are stuck without a department, so say so plainly.
// Admins work across every department and usually have none - no label.
const departmentLabel = (role, profile) =>
  profile?.department?.name ?? (role === 'admin' ? null : 'No department')

/** Stands in for Adspark's logo until the real file is supplied. */
export function LogoPlaceholder({ className = '' }) {
  return (
    <span
      role="img"
      aria-label="Logo placeholder"
      title="Logo placeholder - replace with Adspark's logo"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-ink-400 text-[9px] font-semibold uppercase tracking-wider text-ink-300 ${className}`}>
      Logo
    </span>
  )
}

/**
 * The sign panel: zones (Overview, Audits, Custody, Admin) each keyed by
 * its line colour, a pictogram per page, and a yellow "you are here" bar on
 * the current one. Links are filtered by role; while the role is unknown
 * nothing is listed, so a scanner never sees a flash of pages they cannot
 * reach.
 */
export default function Sidebar({ open, onClose }) {
  const { user, profile, role, profileLoading, signOut } = useSession()
  const zones = profileLoading ? [] : zonesFor(role)

  return (
    <>
      {/* Scrim, mobile only. */}
      {open && (
        <div className="fixed inset-0 z-30 bg-ink-950/50 motion-safe:animate-scrim-in lg:hidden"
             onClick={onClose} aria-hidden="true" />
      )}

      <nav
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col bg-ink-900 text-ink-300 transition-transform duration-150 ease-out print:hidden lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex items-center gap-3 px-5 pb-5 pt-5">
          <LogoPlaceholder />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[15px] font-semibold text-white">Adspark</p>
            <p className="text-[13px] font-medium text-ink-300">IT Inventory</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded-md p-2 text-ink-300 hover:bg-white/10 hover:text-white focus-visible:outline-white lg:hidden">
            <Icon name="close" title="Close menu" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {zones.map((zone) => (
            <div key={zone.id}>
              <p className="flex items-center gap-2 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                <span aria-hidden="true" className={`h-2 w-2 rounded-[2px] ${zone.key}`} />
                {zone.label}
              </p>
              <ul className="flex flex-col gap-px">
                {zone.links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={link.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-white focus-visible:outline-offset-[-2px] ${
                          isActive ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.05] hover:text-white'
                        }`}>
                      {({ isActive }) => (
                        <>
                          {/* You are here. */}
                          <span aria-hidden="true"
                                className={`absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm bg-signal transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                          <Icon name={link.icon} size={18}
                                className={isActive ? 'text-white' : 'text-ink-400 group-hover:text-ink-300'} />
                          {link.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-3">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold text-white">
                {initialsOf(user.full_name)}
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
                <p className="truncate text-xs text-ink-300">{user.email}</p>
                {/* Who the app thinks you are: role + department, so a
                    department-less account is obvious rather than a silent
                    dead end (README "Locked out"). Nothing while the profile
                    is still loading, to avoid a flash of stale/empty state. */}
                {!profileLoading && role && (
                  <p data-testid="sidebar-role" className="truncate text-xs text-ink-300">
                    {[ROLE_LABELS[role], departmentLabel(role, profile)].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-white focus-visible:outline-offset-[-2px]">
            <Icon name="signOut" size={18} className="text-ink-400" />
            Sign out
          </button>
        </div>
      </nav>
    </>
  )
}
