import { useNavigate } from 'react-router-dom'
import DataTable from '../ui/DataTable.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import Icon from '../ui/Icon.jsx'
import { formatDate } from '../../lib/format.js'

// A device that is out reads as "Issued" even though its stored status is
// "available" - issued is derived from an open assignment, never stored (§4).
const displayStatus = (device) => (device.current_holder ? 'issued' : device.status)

const columns = [
  {
    key: 'asset_tag', header: 'Asset tag',
    sortValue: (d) => d.asset_tag,
    // Tabular figures keep the digits aligned down the column, which is how
    // you spot the tag you are scanning for.
    render: (d) => (
      <span className="font-mono text-[13px] font-medium tabular-nums text-slate-900">
        {d.asset_tag}
      </span>
    ),
  },
  {
    key: 'device', header: 'Device',
    sortValue: (d) => d.model,
    render: (d) => (
      <div className="flex items-center gap-2.5">
        <Icon name={d.type === 'laptop' ? 'laptop' : 'mobile'} className="text-slate-400" />
        <div>
          <p className="text-slate-900">{d.model ?? '—'}</p>
          <p className="text-xs text-slate-500">{d.brand ?? ''}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'serial', header: 'Serial',
    sortValue: (d) => d.serial_number,
    render: (d) => <span className="font-mono text-xs text-slate-600">{d.serial_number ?? '—'}</span>,
  },
  {
    key: 'status', header: 'Status',
    sortValue: (d) => displayStatus(d),
    render: (d) => <StatusBadge status={displayStatus(d)} />,
  },
  {
    key: 'holder', header: 'Held by',
    sortValue: (d) => d.current_holder?.full_name ?? null,
    render: (d) => (d.current_holder ? d.current_holder.full_name : <span className="text-slate-400">—</span>),
  },
  {
    key: 'since', header: 'Since',
    sortValue: (d) => (d.current_holder ? new Date(d.current_holder.issued_at).getTime() : null),
    render: (d) => (d.current_holder
      ? <span className="whitespace-nowrap">{formatDate(d.current_holder.issued_at)}</span>
      : <span className="text-slate-400">—</span>),
  },
]

export default function DeviceTable({ devices = [], isLoading, error }) {
  const navigate = useNavigate()
  return (
    <DataTable
      columns={columns}
      rows={devices}
      getRowKey={(d) => d.id}
      onRowClick={(d) => navigate(`/devices/${d.id}`)}
      isLoading={isLoading}
      error={error}
      emptyMessage="No devices match these filters."
    />
  )
}
