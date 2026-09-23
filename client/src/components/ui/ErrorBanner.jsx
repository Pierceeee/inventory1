import { messageFor } from '../../lib/errors.js'

export default function ErrorBanner({ error, className = '' }) {
  if (!error) return null
  return (
    <div role="alert"
         className={`rounded-lg bg-bad-50 px-4 py-3 text-sm text-bad-700 ring-1 ring-inset ring-red-200 ${className}`}>
      {messageFor(error)}
    </div>
  )
}
