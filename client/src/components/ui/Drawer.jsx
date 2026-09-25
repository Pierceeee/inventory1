import { useId, useRef } from 'react'
import Icon from './Icon.jsx'
import { useDialogFocus } from './useDialogFocus.js'

/**
 * A right-side slide-over panel - for editing one record without leaving
 * the list behind it (Modal is for shorter confirmations/forms). Same
 * focus-trap/Escape/restore/scroll-lock behaviour as Modal, via the shared
 * useDialogFocus hook.
 */
export default function Drawer({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null)
  const titleId = useId()

  useDialogFocus({ open, onClose, panelRef })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/45 motion-safe:animate-scrim-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-overlay outline-none motion-safe:animate-[drawer-in_160ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-[17px] font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-1.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink-900">
            <Icon name="close" title="Close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
