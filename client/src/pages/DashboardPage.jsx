import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useDashboard } from '../hooks/useDashboard.js'
import { formatDate, formatDuration } from '../lib/format.js'

function StatCard({ label, value, tone = 'slate', to }) {
  const tones = {
    slate: 'text-slate-900',
    brand: 'text-brand-700',
    ok: 'text-ok-700',
    warn: 'text-warn-700',
  }
  const body = (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200 transition-shadow hover:shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

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

  if (isPending) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (error) return <ErrorBanner error={error} />

  const { totals, by_type: byType, holders, attention } = data
  const needsAttention = attention.resigned_holding.length + attention.in_repair.length

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Where every device is right now." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Devices" value={totals.devices} to="/devices" />
        <StatCard label="Issued" value={totals.issued} tone="brand" to="/devices" />
        <StatCard label="Available" value={totals.available} tone="ok" to="/devices" />
        <StatCard label="In repair" value={totals.repair} tone="warn" to="/devices" />
        <StatCard label="Active staff" value={totals.employees} to="/employees" />
      </div>

      {needsAttention > 0 && (
        <section aria-label="Needs attention" className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon name="warning" className="text-warn-700" />
            Needs attention
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {attention.resigned_holding.length > 0 && (
              <div className="rounded-xl bg-warn-50 p-4 ring-1 ring-inset ring-amber-200">
                <p className="text-sm font-semibold text-warn-700">
                  {attention.resigned_holding.length}{' '}
                  {attention.resigned_holding.length === 1 ? 'person has' : 'people have'} resigned
                  with devices still out
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {attention.resigned_holding.map((person) => (
                    <li key={person.employee_id} className="text-sm">
                      <Link to={`/employees/${person.employee_id}`}
                            className="font-medium text-warn-700 hover:underline">
                        {person.full_name}
                      </Link>
                      <span className="text-warn-700/80">
                        {' — '}
                        {person.devices.map((d) => d.asset_tag).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-warn-700/80">
                  Resigning does not return devices. Close each handout so the record stays true.
                </p>
              </div>
            )}

            {attention.in_repair.length > 0 && (
              <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">
                  {attention.in_repair.length} in repair
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {attention.in_repair.map((d) => (
                    <li key={d.device_id} className="text-sm">
                      <Link to={`/devices/${d.device_id}`}
                            className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                        {d.asset_tag}
                      </Link>
                      <span className="text-slate-500"> — {d.model}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Cannot be issued until returned from repair.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {byType.map((t) => {
          const pct = t.total === 0 ? 0 : Math.round((t.issued / t.total) * 100)
          return (
            <div key={t.type} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {t.type === 'laptop' ? 'Laptops' : 'Mobiles'}
                </p>
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-slate-900">{t.issued}</span> of {t.total} issued
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{t.available} available to issue</p>
            </div>
          )
        })}
      </div>

      <section aria-label="Who has what">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Who has what</h2>
        <DataTable
          columns={holderColumns}
          rows={holders}
          getRowKey={(h) => h.device_id}
          emptyMessage="No devices are currently issued."
        />
      </section>
    </>
  )
}
