import ProgressBar from '../ui/ProgressBar.jsx'
import StatCard from '../ui/StatCard.jsx'

/**
 * The audit-progress section at the top of the Dashboard (Phase 7). Counts
 * cover ACTIVE sessions only (D6). Every scanned/total/percent figure that
 * could otherwise collide with the custody widgets' own bare numbers (G-11:
 * the existing dashboard test looks up the literal text "40" and "34") is
 * rendered as one template-literal string, never a lone `{number}` in its
 * own element - even though this section's own fixture numbers never
 * happen to equal 40 or 34 either, by construction (see exampleData.js).
 */
export default function AuditSummary({ data }) {
  const { departments, active_sessions: activeSessions, items, by_department: byDepartment } = data

  return (
    <section aria-label="Audit progress" className="mb-6 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Departments" value={departments} />
        <StatCard label="Active sessions" value={activeSessions} tone="brand" />
        <StatCard label="Items" value={items.total} />
        <StatCard label="Scanned" value={`${items.scanned} of ${items.total} scanned`} tone="ok" />
      </div>

      <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-semibold text-slate-900">Overall scan progress</p>
          <p className="text-sm text-slate-500">{`${items.percent}%`}</p>
        </div>
        <ProgressBar value={items.scanned} max={items.total} label="Overall scan progress" />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">By department</h2>
        {byDepartment.map((d) => (
          <div key={d.department_id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">{d.name}</p>
              <p className="text-sm text-slate-500">{`${d.scanned} of ${d.total} scanned · ${d.percent}%`}</p>
            </div>
            <ProgressBar value={d.scanned} max={d.total} label={`${d.name} scan progress`} />
          </div>
        ))}
      </div>
    </section>
  )
}
