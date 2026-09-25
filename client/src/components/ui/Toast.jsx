import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Icon from './Icon.jsx'

const ToastContext = createContext(null)

/**
 * Success is never silent. A handout that appears to do nothing is a handout
 * someone records twice.
 *
 * The region is aria-live="polite" so screen readers announce it without
 * interrupting, and each toast is dismissible rather than only timed out.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((message, { tone = 'success', detail, duration = 5000 } = {}) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((list) => [...list, { id, message, detail, tone }])
    if (duration) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

const TONES = {
  success: { icon: 'check',   fg: 'text-ok-600' },
  warning: { icon: 'warning', fg: 'text-warn-600' },
  info:    { icon: 'info',    fg: 'text-slate-500' },
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] ?? TONES.info
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-overlay motion-safe:animate-[toast-in_160ms_cubic-bezier(0.16,1,0.3,1)]">
            <Icon name={tone.icon} className={tone.fg} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{toast.message}</p>
              {toast.detail && <p className="mt-0.5 text-[13px] text-slate-600">{toast.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink-900">
              <Icon name="close" size={16} title="Dismiss" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  // Components are testable in isolation without wrapping them in a provider.
  return ctx ?? { notify: () => {}, dismiss: () => {} }
}
