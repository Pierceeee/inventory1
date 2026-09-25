import DataTable from '../ui/DataTable.jsx'
import FilterChips from '../ui/FilterChips.jsx'
import SearchInput from '../ui/SearchInput.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import Button from '../ui/Button.jsx'
import { columnLabel, isCodeColumn } from '../../lib/format.js'
import { ScannedBy } from '../items/ItemsTable.jsx'

const STATUS_CHIPS = [
  { value: undefined, label: 'All' },
  { value: 'scanned', label: 'Scanned' },
  { value: 'pending', label: 'Pending' },
]

/**
 * The scanner's item table (also used read-only on completed/archived
 * sessions). Filtering, search and paging all happen server-side - a
 * session can hold thousands of items - so this component is a thin view
 * over whatever page `result` already contains; it never filters `items`
 * itself. `display_columns === null` means "show every column" (E7); each
 * data column is keyed `data:${name}` so it can never collide with a
 * built-in column like "status".
 *
 * Props: `result` = `{ items, total, page, page_size }` from GET
 * /:id/items. `status`/`q`/`onStatusChange`/`onQChange`/`onPageChange` are
 * controlled by the parent, which is expected to reset `page` to 1 whenever
 * `status` or `q` changes.
 */
export default function SessionItemsTable({
  session, result, status, onStatusChange, q, onQChange, onPageChange,
  isLoading, error, renderActions,
}) {
  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pageSize = result?.page_size ?? 100
  const page = result?.page ?? 1
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const visibleColumns = session?.display_columns ?? session?.columns ?? []

  const columns = [
    {
      key: 'item_code', header: 'Item code',
      render: (i) => <span className="font-mono text-[13px] text-slate-900">{i.item_code}</span>,
    },
    ...visibleColumns.map((name) => ({
      key: `data:${name}`, header: columnLabel(name),
      render: (i) => (isCodeColumn(name) && i.data?.[name]
        ? <span className="font-mono text-[13px] text-slate-900">{i.data[name]}</span>
        : i.data?.[name] ?? '—'),
    })),
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'scanned', header: 'Scanned by', className: 'whitespace-nowrap', render: (i) => <ScannedBy item={i} /> },
  ]
  if (renderActions) {
    columns.push({ key: 'actions', header: '', className: 'text-right', render: renderActions })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Item status" options={STATUS_CHIPS} value={status} onChange={onStatusChange} />
        <SearchInput value={q} onChange={onQChange} placeholder="Search item code…" />
      </div>

      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(i) => i.id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No items yet."
      />

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>Showing {start}–{end} of {total}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              Prev
            </Button>
            <Button variant="secondary" onClick={() => onPageChange(page + 1)} disabled={end >= total}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
