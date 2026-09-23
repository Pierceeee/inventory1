import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import Field, { inputClass } from '../components/ui/Field.jsx'
import IssueDialog from '../components/handouts/IssueDialog.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useAssignmentList } from '../hooks/useAssignments.js'
import { downloadAssignmentsCsv } from '../api/exports.js'
import { formatDateTime, formatDuration } from '../lib/format.js'

const STATE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Still out' },
  { value: 'false', label: 'Returned' },
]

const REASONS = {
  resignation: 'Resignation', swap: 'Swap', repair: 'Repair', lost: 'Lost', other: 'Other',
}

const columns = [
  {
    key: 'issued_at', header: 'Handed out', sortValue: (a) => new Date(a.issued_at).getTime(),
    render: (a) => (
      <div>
        <p className="whitespace-nowrap text-slate-900">{formatDateTime(a.issued_at)}</p>
        <p className="text-xs text-slate-500">{formatDuration(a.issued_at)} ago</p>
      </div>
    ),
  },
  {
    key: 'device', header: 'Device', sortValue: (a) => a.asset_tag,
    render: (a) => (
      <div>
        <Link to={`/devices/${a.device_id}`}
              className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
          {a.asset_tag}
        </Link>
        <p className="text-xs text-slate-500">{a.device_model ?? ''}</p>
      </div>
    ),
  },
  {
    key: 'employee', header: 'Issued to', sortValue: (a) => a.employee_name,
    render: (a) => (
      <Link to={`/employees/${a.employee_id}`} className="text-brand-700 hover:underline">
        {a.employee_name}
      </Link>
    ),
  },
  {
    key: 'returned', header: 'Returned',
    sortValue: (a) => (a.returned_at ? new Date(a.returned_at).getTime() : null),
    render: (a) => (a.returned_at
      ? <span className="whitespace-nowrap text-slate-700">{formatDateTime(a.returned_at)}</span>
      : <span className="font-medium text-ok-700">Still out</span>),
  },
  { key: 'reason', header: 'Reason', render: (a) => (a.return_reason ? REASONS[a.return_reason] : '—') },
  { key: 'notes', header: 'Notes', render: (a) => a.notes ?? '—' },
]

export default function HandoutsPage() {
  const [openState, setOpenState] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { notify } = useToast()

  const params = {}
  if (openState !== 'all') params.open = openState
  // A date input gives a local calendar day; widen it to cover the whole day.
  if (from) params.from = new Date(`${from}T00:00:00`).toISOString()
  if (to) params.to = new Date(`${to}T23:59:59`).toISOString()

  const { data: handouts, isPending, error } = useAssignmentList(params)

  async function handleExport() {
    setExporting(true)
    try {
      // Export exactly what is on screen. Exporting more than the filters show
      // is a quiet way to hand someone the wrong spreadsheet.
      await downloadAssignmentsCsv(params)
      notify(`Exported ${handouts?.length ?? 0} handouts.`)
    } catch {
      notify('Export failed. Please try again.', { tone: 'warning' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Handouts"
        subtitle="Every issue and return, newest first."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}
                    disabled={exporting || !handouts?.length}>
              <Icon name="download" size={16} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button onClick={() => setIssuing(true)}>Issue a device</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <FilterChips label="State" options={STATE_CHIPS} value={openState} onChange={setOpenState} />
        <div className="w-44">
          <Field id="from" label="Handed out from">
            <input id="from" type="date" className={inputClass} value={from}
                   onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
        <div className="w-44">
          <Field id="to" label="To">
            <input id="to" type="date" className={inputClass} value={to}
                   onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {(from || to) && (
          <Button variant="ghost" onClick={() => { setFrom(''); setTo('') }}>Clear dates</Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={handouts ?? []}
        getRowKey={(a) => a.id}
        isLoading={isPending}
        error={error}
        emptyMessage="No handouts in this range."
      />

      <IssueDialog open={issuing} onClose={() => setIssuing(false)} />
    </>
  )
}
