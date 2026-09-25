/** A thin measured bar. Audit progress fills in the Audits zone colour. */
export default function ProgressBar({ value, max, label, tone = 'audits' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const fill = tone === 'audits' ? 'bg-zone-audits' : 'bg-brand-600'
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
