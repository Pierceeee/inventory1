import { useMemo, useState } from 'react'
import ErrorBanner from './ErrorBanner.jsx'
import Icon from './Icon.jsx'

/**
 * Columns may declare `sortValue(row)` to become sortable. Sorting is
 * client-side and deliberately so: these lists are hundreds of rows, not
 * millions, and a round trip per click would be slower than the sort.
 */
export default function DataTable({
  columns, rows, getRowKey, onRowClick,
  emptyMessage = 'Nothing to show yet.', isLoading = false, error = null,
  defaultSort = null,
}) {
  const [sort, setSort] = useState(defaultSort)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const direction = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = column.sortValue(a)
      const bv = column.sortValue(b)
      if (av === bv) return 0
      if (av === null || av === undefined) return 1      // blanks last, both ways
      if (bv === null || bv === undefined) return -1
      return (av > bv ? 1 : -1) * direction
    })
  }, [rows, sort, columns])

  const toggle = (key) =>
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' })

  if (error) return <ErrorBanner error={error} />

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              {columns.map((c) => {
                const sortable = Boolean(c.sortValue)
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`whitespace-nowrap px-2.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500 first:pl-4 last:pr-4 ${c.className ?? ''}`}>
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={`inline-flex items-center gap-1 rounded uppercase transition-colors hover:text-ink-900 ${active ? 'text-ink-900' : ''}`}>
                        {c.header}
                        <Icon
                          name={active && sort.direction === 'desc' ? 'chevronDown' : 'chevronUp'}
                          size={12}
                          className={active ? 'text-ink-900' : 'text-slate-300'}
                        />
                      </button>
                    ) : c.header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer transition-colors hover:bg-brand-50/50' : 'transition-colors hover:bg-slate-50/70'}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-2.5 py-2.5 text-sm text-slate-700 first:pl-4 last:pr-4 ${/whitespace-/.test(c.className ?? '') ? '' : 'whitespace-nowrap sm:whitespace-normal'} ${c.className ?? ''}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && <SkeletonRows columns={columns.length} />}

      {!isLoading && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-300">
            <Icon name="inventory" size={20} />
          </span>
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}

/** Reserves the space the rows will occupy, so the page does not jump. */
function SkeletonRows({ columns, count = 6 }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <div key={colIndex}
                 className="h-4 flex-1 rounded bg-slate-100 motion-safe:animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
