import { useCallback, useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, footer, wide = false }) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const titleId = useId()

  const focusables = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])
      .filter((el) => el.offsetParent !== null),
    [],
  )

  useEffect(() => {
    if (!open) return

    // Remember where focus came from so it can be handed back on close.
    restoreRef.current = document.activeElement

    const first = focusables()[0]
    ;(first ?? panelRef.current)?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return

      // Keep Tab inside the dialog. Without this, focus walks onto the page
      // behind the overlay, where a keyboard user cannot see where they are.
      const items = focusables()
      if (items.length === 0) { e.preventDefault(); return }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault(); lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault(); firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose, focusables])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl bg-white shadow-xl outline-none`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600">
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
