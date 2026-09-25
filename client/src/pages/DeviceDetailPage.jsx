import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import HistoryTimeline from '../components/handouts/HistoryTimeline.jsx'
import IssueDialog from '../components/handouts/IssueDialog.jsx'
import ReturnDialog from '../components/handouts/ReturnDialog.jsx'
import { useDevice, useRetireDevice } from '../hooks/useDevices.js'
import { formatDateTime, formatDuration } from '../lib/format.js'

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-900">{value || '—'}</dd>
    </div>
  )
}

const OS_LABELS = { macos: 'macOS', windows: 'Windows', ios: 'iOS', android: 'Android' }

export default function DeviceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: device, isPending, error } = useDevice(id)
  const retire = useRetireDevice()
  const [issuing, setIssuing] = useState(false)
  const [returning, setReturning] = useState(false)
  const [confirmingRetire, setConfirmingRetire] = useState(false)

  if (isPending) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (error) return <ErrorBanner error={error} />

  const holder = device.current_holder
  const canIssue = !holder && device.status === 'available'
  const canRetire = !holder && device.status !== 'retired'

  return (
    <>
      <PageHeader
        back={<Link to="/devices" className="mb-1 block text-sm text-brand-700 hover:underline">← Devices</Link>}
        title={device.asset_tag}
        subtitle={[device.brand, device.model].filter(Boolean).join(' ')}
        actions={
          <>
            {canIssue && <Button onClick={() => setIssuing(true)}>Issue device</Button>}
            {holder && <Button onClick={() => setReturning(true)}>Return device</Button>}
            <Button variant="secondary" onClick={() => navigate(`/devices/${device.id}/edit`)}>Edit</Button>
            {canRetire && <Button variant="secondary" onClick={() => setConfirmingRetire(true)}>Retire</Button>}
          </>
        }
      />

      <ErrorBanner error={retire.error} className="mb-4" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <div className="mb-4">
              <StatusBadge status={holder ? 'issued' : device.status} />
            </div>
            {holder ? (
              <div className="rounded-lg bg-brand-50 p-4" role="region" aria-label="Current holder">
                <p className="text-xs uppercase tracking-wide text-brand-700">Currently held by</p>
                <Link to={`/employees/${holder.employee_id}`}
                      className="mt-1 block text-lg font-semibold text-slate-900 hover:underline">
                  {holder.full_name}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  Since {formatDateTime(holder.issued_at)} · {formatDuration(holder.issued_at)}
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                This device is not currently issued to anyone.
              </p>
            )}
          </div>

          <section aria-label="Handout history">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Handout history</h2>
            <HistoryTimeline
              entries={device.history}
              perspective="device"
              emptyMessage="This device has never been issued."
            />
          </section>
        </div>

        <dl className="flex h-fit flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <Detail label="Type" value={device.type === 'laptop' ? 'Laptop' : 'Mobile'} />
          <Detail label="Brand" value={device.brand} />
          <Detail label="Model" value={device.model} />
          <Detail label="Serial number" value={device.serial_number} />
          <Detail label="Operating system" value={OS_LABELS[device.os] ?? device.os} />
          <Detail label="Notes" value={device.notes} />
          <Detail label="Added" value={formatDateTime(device.created_at)} />
        </dl>
      </div>

      <IssueDialog open={issuing} onClose={() => setIssuing(false)} device={device} />
      <ReturnDialog
        open={returning}
        onClose={() => setReturning(false)}
        assignment={holder ? { ...holder, asset_tag: device.asset_tag } : null}
      />

      <Modal
        open={confirmingRetire}
        onClose={() => setConfirmingRetire(false)}
        title={`Retire ${device.asset_tag}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingRetire(false)}>Cancel</Button>
            <Button variant="danger" disabled={retire.isPending}
                    onClick={() => retire.mutate(device.id, { onSuccess: () => setConfirmingRetire(false) })}>
              Retire device
            </Button>
          </>
        }>
        <p className="text-sm text-slate-600">
          A retired device can no longer be issued. Its handout history is kept in full.
        </p>
      </Modal>
    </>
  )
}
