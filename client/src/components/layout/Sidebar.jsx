import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { useSession } from '../../hooks/useSession.jsx'
import { initialsOf } from '../../lib/session.js'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/devices', label: 'Devices' },
  { to: '/employees', label: 'Employees' },
  { to: '/handouts', label: 'Handouts' },
  { to: '/import', label: 'Import' },
]

export default function Sidebar({ open, onClose }) {
  const { user, signOut } = useSession()

  return (
    <>
      {/* Scrim, mobile only. */}
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <nav
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Device Handout Tracker</p>
            <p className="text-xs text-slate-500">Adspark IT</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <Icon name="close" title="Close menu" />
          </button>
        </div>

        <ul className="flex flex-col gap-0.5 p-3">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-auto border-t border-slate-200 p-3">
          {user && (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {initialsOf(user.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{user.full_name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
            Sign out
          </button>
        </div>
      </nav>
    </>
  )
}
