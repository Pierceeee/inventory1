import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus trap + Escape-to-close + body-scroll-lock + focus-restore, shared by
 * every dialog-shaped overlay (Modal, Drawer). `panelRef` must point at the
 * dialog's root element (the one with `role="dialog"`). Extracted from
 * Modal's own effect unchanged, so Modal's existing keyboard tests keep
 * passing without modification.
 */
export function useDialogFocus({ open, onClose, panelRef }) {
  const restoreRef = useRef(null)

  const focusables = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])
      .filter((el) => el.offsetParent !== null),
    [panelRef],
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
  }, [open, onClose, focusables, panelRef])
}
