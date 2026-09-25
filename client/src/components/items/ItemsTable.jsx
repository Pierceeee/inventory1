import DataTable from '../ui/DataTable.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import Icon from '../ui/Icon.jsx'
import { columnLabel, formatDateTime, isCodeColumn } from '../../lib/format.js'
import { canManage, isAdmin } from '../../lib/roles.js'

/**
 * The Inventory page's cross-session table. `columns` is the server's
 * already-ordered, already-trimmed-of-empties list (services/items.js);
 * each one is keyed `data:${name}` so it can never collide with a built-in
 * column like "status" (E7). DataTable already wraps everything in
 * `overflow-x-auto`.
 */
/** Who scanned an item, with when beneath; a dash while it is pending. */
export function ScannedBy({ item }) {
  if (!item.scanned_by_name && !item.scanned_at) return <span className="text-slate-400">—</span>
  return (
    <div className="leading-tight">
      <p className="text-slate-700">{item.scanned_by_name ?? '—'}</p>
      {item.scanned_at && <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.scanned_at)}</p>}
    </div>
  )
}

export default function ItemsTable({ items, columns, showSession, profile, onEdit, onDelete, isLoading, error }) {
  const tableColumns = [
    {
      key: 'item_code', header: 'Item code', className: 'whitespace-nowrap',
      render: (i) => <span className="font-mono text-[13px] text-slate-900">{i.item_code}</span>,
    },
    ...(showSession ? [{
      key: 'session', header: 'Session', className: 'whitespace-nowrap',
      render: (i) => (
        <div className="leading-tight">
          <p className="text-ink-900">{i.session_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{i.department_name}</p>
        </div>
      ),
    }] : []),
    ...columns.map((name) => ({
      key: `data:${name}`, header: columnLabel(name), className: 'whitespace-nowrap',
      render: (i) => (isCodeColumn(name) && i.data?.[name]
        ? <span className="font-mono text-[13px] text-slate-900">{i.data[name]}</span>
        : <span className="block max-w-[11rem] truncate" title={i.data?.[name] || undefined}>{i.data?.[name] ?? '—'}</span>),
    })),
    { key: 'status', header: 'Status', className: 'whitespace-nowrap', render: (i) => <StatusBadge status={i.status} /> },
    // Who and when in one cell - the when is detail of the who, and two
    // columns pushed the row actions off a 1440 screen.
    { key: 'scanned', header: 'Scanned by', className: 'whitespace-nowrap', render: (i) => <ScannedBy item={i} /> },
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
