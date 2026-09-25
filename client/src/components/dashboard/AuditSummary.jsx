import { Link } from 'react-router-dom'
import ProgressBar from '../ui/ProgressBar.jsx'
import StatCard, { Figures } from '../ui/StatCard.jsx'

/**
 * The audit-progress panel on the Dashboard (Phase 7). Counts cover ACTIVE
 * sessions only (D6). Every scanned/total/percent figure that could
 * otherwise collide with the custody figures' own bare numbers (G-11: the
 * dashboard test looks up the literal text "40" and "34") is rendered as
 * one template-literal string, never a lone `{number}` in its own element.
 */
export default function AuditSummary({ data }) {
  const { departments, active_sessions: activeSessions, items, by_department: byDepartment } = data

  return (
    <section aria-label="Audit progress" className="panel flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-zone-audits" />
          Audit progress
        </h2>
        <Link to="/sessions" className="text-sm font-medium text-brand-700 hover:underline">Open sessions</Link>
      </div>

      <Figures label="Active audits" cols="grid-cols-2 sm:grid-cols-4" bare className="border-b border-slate-200">
        <StatCard label="Departments" value={departments} />
        <StatCard label="Active sessions" value={activeSessions} tone="brand" />
        <StatCard label="Items" value={items.total} />
        <StatCard label="Scanned" value={`${items.scanned} of ${items.total} scanned`} tone="ok" />
      </Figures>

      <div className="px-5 pb-4 pt-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <p className="font-medium text-ink-900">Overall scan progress</p>
            <p className="font-semibold tabular-nums text-ink-900">{`${items.percent}%`}</p>
          </div>
          <ProgressBar value={items.scanned} max={items.total} label="Overall scan progress" />
        </div>
      </div>

      <div className="border-t border-slate-200">
        <h3 className="caption px-5 pb-1 pt-3">By department</h3>
        <ul className="divide-y divide-slate-100">
          {byDepartment.map((d) => (
            <li key={d.department_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-2.5 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_auto]">
              <p className="truncate text-sm font-medium text-ink-900">{d.name}</p>
              <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                <ProgressBar value={d.scanned} max={d.total} label={`${d.name} scan progress`} />
              </div>
              <p className={`whitespace-nowrap text-right text-sm tabular-nums ${d.total === 0 ? 'text-slate-400' : 'text-slate-600'}`}>
                {`${d.scanned} of ${d.total} scanned · ${d.percent}%`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
