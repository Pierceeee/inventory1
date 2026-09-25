import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { useSession } from '../../hooks/useSession.jsx'
import { initialsOf } from '../../lib/session.js'
import { ROLE_LABELS } from '../../lib/roles.js'

/**
 * Who is signed in, at the right end of the route strip - on phones the
 * sidebar is off-canvas, so this is where identity stays visible. Opens a
 * small panel with name, email, role and Sign out; Escape or a click
 * outside closes it and focus returns to the button.
 */
export default function AccountMenu() {
  const { user, profile, role, profileLoading, signOut } = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onPointer(e) { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    function onKey(e) {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const roleLine = !profileLoading && role
    ? [ROLE_LABELS[role], profile?.department?.name].filter(Boolean).join(' · ')
    : null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account: ${user.full_name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white transition-colors hover:bg-ink-800">
        {initialsOf(user.full_name)}
      </button>

      {open && (
        <div id={panelId}
             className="absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-overlay motion-safe:animate-overlay-in">
          <div className="px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{user.full_name}</p>
            <p className="truncate text-[13px] text-slate-500">{user.email}</p>
            {roleLine && <p className="mt-0.5 truncate text-[13px] text-slate-500">{roleLine}</p>}
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-ink-900 transition-colors hover:bg-slate-50">
            <Icon name="signOut" size={17} className="text-slate-400" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
