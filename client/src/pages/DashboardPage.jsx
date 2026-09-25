import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import Icon from '../components/ui/Icon.jsx'
import StatCard, { Figures } from '../components/ui/StatCard.jsx'
import AuditSummary from '../components/dashboard/AuditSummary.jsx'
import { useAuditDashboard, useDashboard } from '../hooks/useDashboard.js'
import { formatDate, formatDuration } from '../lib/format.js'

const holderColumns = [
  {
    key: 'holder', header: 'Employee', sortValue: (h) => h.holder_name,
    render: (h) => (
      <Link to={`/employees/${h.employee_id}`} className="font-medium text-brand-700 hover:underline">
        {h.holder_name}
      </Link>
    ),
  },
  {
    key: 'device', header: 'Device', sortValue: (h) => h.asset_tag,
    render: (h) => (
      <div>
        <Link to={`/devices/${h.device_id}`} className="text-slate-900 hover:underline">{h.asset_tag}</Link>
        <p className="text-xs text-slate-500">{h.model ?? ''}</p>
      </div>
    ),
  },
  {
    key: 'type', header: 'Type', sortValue: (h) => h.type,
    render: (h) => (h.type === 'laptop' ? 'Laptop' : 'Mobile'),
  },
  {
    key: 'since', header: 'Since', sortValue: (h) => new Date(h.issued_at).getTime(),
    render: (h) => (
      <div>
        <p className="whitespace-nowrap text-slate-700">{formatDate(h.issued_at)}</p>
        <p className="text-xs text-slate-500">{formatDuration(h.issued_at)}</p>
      </div>
    ),
  },
]

export default function DashboardPage() {
  const { data, isPending, error } = useDashboard()
  const { data: auditData, isPending: auditPending, error: auditError } = useAuditDashboard()

  // Neither section may appear before the other has something to show
  // (G-11): the custody numbers below must never render before the audit
  // section resolves, and vice versa.
  if (isPending || auditPending) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (error) return <ErrorBanner error={error} />
  if (auditError) return <ErrorBanner error={auditError} />

  const { totals, by_type: byType, holders, attention } = data
  const needsAttention = attention.resigned_holding.length + attention.in_repair.length

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Audit progress and where every device is right now." />

      <section aria-label="Device custody" className="flex flex-col gap-6">
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-zone-custody" />
            Device custody
          </h2>
          <Figures label="Device counts">
            <StatCard label="Devices" value={totals.devices} to="/devices" />
            <StatCard label="Issued" value={totals.issued} tone="brand" to="/devices" />
            <StatCard label="Available" value={totals.available} tone="ok" to="/devices" />
            <StatCard label="In repair" value={totals.repair} tone="warn" to="/devices" />
            <StatCard label="Active staff" value={totals.employees} to="/employees" />
          </Figures>
          <ByType byType={byType} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <AuditSummary data={auditData} />
          <NeedsAttention attention={attention} count={needsAttention} />
        </div>

        <section aria-label="Who has what">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-semibold text-ink-900">Who has what</h2>
            <Link to="/handouts" className="text-sm font-medium text-brand-700 hover:underline">All handouts</Link>
          </div>
          <DataTable
            columns={holderColumns}
            rows={holders}
            getRowKey={(h) => h.device_id}
            emptyMessage="No devices are currently issued."
          />
        </section>
      </section>
    </>
  )
}

/** Devices that make the register untrue until someone acts on them. */
function NeedsAttention({ attention, count }) {
  return (
    <section aria-label="Needs attention" className="panel flex flex-col">
      <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-ink-900">
        <Icon name="warning" className={count > 0 ? 'text-warn-600' : 'text-slate-300'} />
        Needs attention
      </h2>

      {count === 0 && (
        <p className="px-5 py-6 text-sm text-slate-500">Nothing needs attention. Every device is where the register says.</p>
      )}

      {attention.resigned_holding.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-warn-700">
            {attention.resigned_holding.length}{' '}
            {attention.resigned_holding.length === 1 ? 'person has' : 'people have'} resigned with devices still out
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {attention.resigned_holding.map((person) => (
              <li key={person.employee_id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <Link to={`/employees/${person.employee_id}`} className="font-medium text-ink-900 hover:underline">
                  {person.full_name}
                </Link>
                <span className="font-mono text-[13px] text-slate-500">{person.devices.map((d) => d.asset_tag).join(', ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-slate-500">
            Resigning does not return devices. Close each handout so the record stays true.
          </p>
        </div>
      )}

      {attention.in_repair.length > 0 && (
        <div className={`px-5 py-4 ${attention.resigned_holding.length > 0 ? 'border-t border-slate-100' : ''}`}>
          <p className="text-sm font-semibold text-ink-900">{attention.in_repair.length} in repair</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {attention.in_repair.map((d) => (
              <li key={d.device_id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <Link to={`/devices/${d.device_id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                  {d.asset_tag}
                </Link>
                <span className="text-slate-500">{d.model}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-slate-500">Cannot be issued until returned from repair.</p>
        </div>
      )}

      <div className="mt-auto flex gap-4 border-t border-slate-100 px-5 py-3 text-sm">
        <Link to="/handouts" className="font-medium text-brand-700 hover:underline">Review handouts</Link>
        <Link to="/devices" className="font-medium text-brand-700 hover:underline">All devices</Link>
      </div>
    </section>
  )
}

/** How much of each device type is out. */
function ByType({ byType }) {
  return (
    <section aria-label="Issued by type"
             className="panel mt-3 grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      {byType.map((t) => {
        const pct = t.total === 0 ? 0 : Math.round((t.issued / t.total) * 100)
        return (
          <div key={t.type} className="px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Icon name={t.type === 'laptop' ? 'laptop' : 'mobile'} size={16} className="text-slate-400" />
                {t.type === 'laptop' ? 'Laptops' : 'Mobiles'}
              </p>
              <p className="text-sm tabular-nums text-slate-500">
                <span className="font-semibold text-ink-900">{t.issued}</span> of {t.total} issued
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
              <div className="h-full rounded-full bg-zone-custody" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[13px] text-slate-500">{t.available} available to issue</p>
          </div>
        )
      })}
    </section>
  )
}
