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
  success: { icon: 'check',   ring: 'ring-emerald-200', bg: 'bg-ok-50',    fg: 'text-ok-700' },
  warning: { icon: 'warning', ring: 'ring-amber-200',   bg: 'bg-warn-50',  fg: 'text-warn-700' },
  info:    { icon: 'info',    ring: 'ring-slate-200',   bg: 'bg-white',    fg: 'text-slate-700' },
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
            className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ring-inset motion-safe:animate-[toast-in_180ms_ease-out] ${tone.bg} ${tone.ring}`}>
            <Icon name={tone.icon} className={tone.fg} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${tone.fg}`}>{toast.message}</p>
              {toast.detail && <p className="mt-0.5 text-xs text-slate-600">{toast.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600">
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
