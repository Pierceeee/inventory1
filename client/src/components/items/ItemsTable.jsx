import DataTable from '../ui/DataTable.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import Icon from '../ui/Icon.jsx'
import { formatDateTime } from '../../lib/format.js'
import { canManage, isAdmin } from '../../lib/roles.js'

/**
 * The Inventory page's cross-session table. `columns` is the server's
 * already-ordered, already-trimmed-of-empties list (services/items.js);
 * each one is keyed `data:${name}` so it can never collide with a built-in
 * column like "status" (E7). DataTable already wraps everything in
 * `overflow-x-auto`.
 */
export default function ItemsTable({ items, columns, showSession, profile, onEdit, onDelete, isLoading, error }) {
  const tableColumns = [
    {
      key: 'item_code', header: 'Item code', className: 'whitespace-nowrap',
      render: (i) => <span className="font-mono text-[13px] text-slate-900">{i.item_code}</span>,
    },
    ...(showSession ? [{
      key: 'session', header: 'Session', className: 'whitespace-nowrap',
      render: (i) => (
        <div>
          <p className="text-slate-900">{i.session_name}</p>
          <p className="text-xs text-slate-500">{i.department_name}</p>
        </div>
      ),
    }] : []),
    ...columns.map((name) => ({
      key: `data:${name}`, header: name, className: 'whitespace-nowrap',
      render: (i) => i.data?.[name] ?? '—',
    })),
    { key: 'status', header: 'Status', className: 'whitespace-nowrap', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'scanned_by_name', header: 'Scanned by', className: 'whitespace-nowrap', render: (i) => i.scanned_by_name ?? '—' },
    {
      key: 'scanned_at', header: 'Scanned at', className: 'whitespace-nowrap',
      render: (i) => (i.scanned_at ? formatDateTime(i.scanned_at) : '—'),
    },
    {
      key: 'actions', header: '', className: 'whitespace-nowrap text-right',
      render: (i) => {
        const editable = i.writable && canManage(profile, i.department_id)
        const deletable = i.writable && isAdmin(profile)
        if (!editable && !deletable) return <span className="text-xs text-slate-400">Read-only</span>
        return (
          <div className="flex justify-end gap-1">
            {editable && (
              <button
                type="button"
                title={`Edit ${i.item_code}`}
                aria-label={`Edit ${i.item_code}`}
                onClick={() => onEdit(i)}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <Icon name="pencil" size={16} />
              </button>
            )}
            {deletable && (
              <button
                type="button"
                title={`Delete ${i.item_code}`}
                aria-label={`Delete ${i.item_code}`}
                onClick={() => onDelete(i)}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-bad-50 hover:text-bad-700">
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={tableColumns}
      rows={items}
      getRowKey={(i) => i.id}
      isLoading={isLoading}
      error={error}
      emptyMessage="No items yet."
    />
  )
}
