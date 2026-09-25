import { useId, useRef } from 'react'
import Icon from './Icon.jsx'
import { useDialogFocus } from './useDialogFocus.js'

const WIDTHS = { false: 'max-w-lg', true: 'max-w-2xl', xl: 'max-w-5xl' }

/** `wide`: false (default), true, or 'xl' for a table-sized dialog. */
export default function Modal({ open, onClose, title, children, footer, wide = false }) {
  const panelRef = useRef(null)
  const titleId = useId()

  useDialogFocus({ open, onClose, panelRef })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/45 motion-safe:animate-scrim-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${WIDTHS[wide]} rounded-lg bg-white shadow-overlay outline-none motion-safe:animate-overlay-in`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-[17px] font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-1.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink-900">
            <Icon name="close" title="Close" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
