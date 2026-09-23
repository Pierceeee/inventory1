import { useNavigate } from 'react-router-dom'
import DataTable from '../ui/DataTable.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

const columns = [
  {
    key: 'name', header: 'Name', sortValue: (e) => e.full_name,
    render: (e) => <span className="font-medium text-slate-900">{e.full_name}</span>,
  },
  { key: 'email', header: 'Email', sortValue: (e) => e.email, render: (e) => e.email ?? '—' },
  {
    key: 'department', header: 'Department', sortValue: (e) => e.department,
    render: (e) => e.department ?? '—',
  },
  {
    key: 'held', header: 'Devices held', className: 'text-right',
    sortValue: (e) => e.devices_held_count ?? 0,
    render: (e) => (
      <span className={e.devices_held_count > 0 ? 'font-medium tabular-nums text-slate-900' : 'tabular-nums text-slate-400'}>
        {e.devices_held_count ?? 0}
      </span>
    ),
  },
  {
    key: 'status', header: 'Status', sortValue: (e) => e.status,
    render: (e) => <StatusBadge status={e.status} />,
  },
]

export default function EmployeeTable({ employees = [], isLoading, error }) {
  const navigate = useNavigate()
  return (
    <DataTable
      columns={columns}
      rows={employees}
      getRowKey={(e) => e.id}
      onRowClick={(e) => navigate(`/employees/${e.id}`)}
      isLoading={isLoading}
      error={error}
      emptyMessage="No employees match these filters."
    />
  )
}
