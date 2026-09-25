import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

const TONES = {
  slate: 'text-ink-900',
  brand: 'text-brand-700',
  ok: 'text-ok-700',
  warn: 'text-warn-700',
}

/**
 * A ruled row of figures: one hairline strip divided into cells, like the
 * figures on a departures board - not a grid of separate cards. `cols` sets
 * the column classes (the cells wrap onto hairline-ruled rows).
 */
export function Figures({ label, cols = 'grid-cols-2 sm:grid-cols-5 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2', bare = false, className = '', children }) {
  // `bare`: inside a panel that already draws the frame - never a box in a box.
  const frame = bare ? '' : 'overflow-hidden rounded-lg border border-slate-200 shadow-panel'
  return (
    <div role="group" aria-label={label}
         className={`figures grid gap-px bg-slate-200 ${frame} ${cols} ${className}`}>
      {children}
    </div>
  )
}

/**
 * One cell of a Figures row: a caption over its figure. A plain cell, a
 * Link (`to`, e.g. the Dashboard's device counts), or a toggle button
 * (`onClick` + `active` -> aria-pressed, e.g. the Inventory page's
 * Total/Scanned/Pending filters), stamped with an ink bar when chosen.
 */
export default function StatCard({ label, value, tone = 'slate', to, onClick, active }) {
  const figure = typeof value === 'number' ? 'text-[26px] leading-8' : 'text-lg leading-8'
  const body = (
    <>
      <p className="caption flex items-center justify-between gap-2">
        {label}
        {to && <Icon name="arrowRight" size={14} className="text-slate-300 transition-colors group-hover:text-brand-600" />}
      </p>
      <p className={`mt-1 font-semibold tabular-nums ${figure} ${TONES[tone]}`}>{value}</p>
    </>
  )
  const cell = 'group block bg-white px-4 py-3 text-left'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`${cell} transition-colors hover:bg-slate-50 ${active ? 'shadow-[inset_0_-3px_0_theme(colors.ink.900)]' : ''}`}>
        {body}
      </button>
    )
  }
  if (to) return <Link to={to} className={`${cell} transition-colors hover:bg-slate-50`}>{body}</Link>
  return <div className={cell}>{body}</div>
}
