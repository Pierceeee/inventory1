import { useRecentScans } from '../../hooks/useInventorySessions.js'
import { formatDateTime } from '../../lib/format.js'

const OUTCOME_LABEL = {
  scanned: 'Scanned', duplicate: 'Duplicate', not_found: 'Not found',
  undone: 'Undone', cleared: 'Cleared', deleted: 'Deleted',
}

/** Its own small query, refetched after each scan/undo rather than the
 *  (possibly large) item list - quick reference during a scan session. */
export default function RecentScans({ sessionId }) {
  const { data: scans } = useRecentScans(sessionId, { limit: 10 })

  return (
    <section aria-label="Recent scans" className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent scans</h3>
      {!scans?.length ? (
        <p className="text-sm text-slate-500">No scans yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {scans.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <span className="font-mono text-slate-900">{s.item_code}</span>
              <span className="text-slate-500">{OUTCOME_LABEL[s.outcome] ?? s.outcome}</span>
              <span className="text-slate-500">{s.actor_name ?? '—'}</span>
              <span className="whitespace-nowrap text-xs text-slate-400">{formatDateTime(s.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
