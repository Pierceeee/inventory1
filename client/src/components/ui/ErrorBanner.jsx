import Icon from './Icon.jsx'
import { messageFor } from '../../lib/errors.js'

export default function ErrorBanner({ error, className = '' }) {
  if (!error) return null
  return (
    <div role="alert"
         className={`flex items-start gap-3 rounded-lg border border-bad-200 bg-bad-50 px-4 py-3 text-sm text-bad-700 ${className}`}>
      <Icon name="warning" size={18} className="mt-px text-bad-600" />
      <p className="min-w-0 flex-1">{messageFor(error)}</p>
    </div>
  )
}
