import { Link } from 'react-router-dom'

const TONES = {
  slate: 'text-slate-900',
  brand: 'text-brand-700',
  ok: 'text-ok-700',
  warn: 'text-warn-700',
}

/**
 * A stat tile: a plain div, a Link (`to`, e.g. the Dashboard's device
 * counts), or a toggle button (`onClick` + `active` -> aria-pressed, e.g.
 * the Inventory page's Total/Scanned/Pending filters).
 */
export default function StatCard({ label, value, tone = 'slate', to, onClick, active }) {
  const body = (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200 transition-shadow hover:shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</p>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`w-full rounded-xl text-left transition-shadow ${active ? 'ring-2 ring-brand-600' : ''}`}>
        {body}
      </button>
    )
  }
  if (to) return <Link to={to} className="block">{body}</Link>
  return body
}
