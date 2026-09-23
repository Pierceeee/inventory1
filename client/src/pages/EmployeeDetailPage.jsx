import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import HistoryTimeline from '../components/handouts/HistoryTimeline.jsx'
import IssueDialog from '../components/handouts/IssueDialog.jsx'
import ReturnDialog from '../components/handouts/ReturnDialog.jsx'
import ResignDialog from '../components/handouts/ResignDialog.jsx'
import { useEmployee } from '../hooks/useEmployees.js'
import { formatDateTime, formatDuration } from '../lib/format.js'

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: employee, isPending, error } = useEmployee(id)
  const [issuing, setIssuing] = useState(false)
  const [resigning, setResigning] = useState(false)
  const [returning, setReturning] = useState(null)

  if (isPending) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (error) return <ErrorBanner error={error} />

  const held = employee.devices_held ?? []
  const isActive = employee.status === 'active'
  // §5: resigning does not close assignments. This state is normal mid-offboarding.
  const outstandingAtOffboarding = !isActive && held.length > 0

  return (
    <>
      <PageHeader
        back={<Link to="/employees" className="mb-1 block text-sm text-brand-700 hover:underline">← Employees</Link>}
        title={employee.full_name}
        subtitle={[employee.department, employee.email].filter(Boolean).join(' · ')}
        actions={
          <>
            {isActive && <Button onClick={() => setIssuing(true)}>Issue device</Button>}
            <Button variant="secondary" onClick={() => navigate(`/employees/${employee.id}/edit`)}>Edit</Button>
            {isActive && <Button variant="danger" onClick={() => setResigning(true)}>Mark resigned</Button>}
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={employee.status} />
        {employee.resigned_at && (
          <span className="text-sm text-slate-500">Resigned {formatDateTime(employee.resigned_at)}</span>
        )}
      </div>

      {outstandingAtOffboarding && (
        <div role="alert"
             className="mb-6 rounded-lg bg-warn-50 px-4 py-3 text-sm text-warn-700 ring-1 ring-inset ring-amber-200">
          <strong className="font-semibold">
            {employee.full_name} has resigned but still holds {held.length}{' '}
            {held.length === 1 ? 'device' : 'devices'}.
          </strong>{' '}
          Return each one below so the record stays accurate.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Currently held devices">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Currently held</h2>
          {held.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              {employee.full_name} holds no devices.
            </p>
          ) : (
            <ul className="flex flex-col gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200">
              {held.map((d) => (
                <li key={d.assignment_id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                  <div>
                    <Link to={`/devices/${d.device_id}`}
                          className="text-sm font-medium text-brand-700 hover:underline">
                      {d.asset_tag}
                    </Link>
                    <p className="text-xs text-slate-500">{[d.brand, d.model].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-slate-400">
                      Since {formatDateTime(d.issued_at)} · {formatDuration(d.issued_at)}
                    </p>
                  </div>
                  <Button variant="secondary"
                          onClick={() => setReturning({ ...d, full_name: employee.full_name })}>
                    Return
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Handout history">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Handout history</h2>
          <HistoryTimeline
            entries={employee.history}
            perspective="employee"
            emptyMessage={`${employee.full_name} has never been issued a device.`}
          />
        </section>
      </div>

      <IssueDialog open={issuing} onClose={() => setIssuing(false)} employee={employee} />
      <ResignDialog open={resigning} onClose={() => setResigning(false)} employee={employee} />
      <ReturnDialog open={Boolean(returning)} assignment={returning}
                    onClose={() => setReturning(null)} onReturned={() => setReturning(null)} />
    </>
  )
}
