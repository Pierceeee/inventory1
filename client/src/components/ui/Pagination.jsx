import Button from './Button.jsx'

/** "Showing X-Y of N" plus Prev/Next, server-side paged (the Inventory
 *  page - SessionItemsTable has its own inline copy of the same idea). */
export default function Pagination({ page, pageSize, total, onChange }) {
  if (!total) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p>Showing {start}–{end} of {total}</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>Prev</Button>
        <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={end >= total}>Next</Button>
      </div>
    </div>
  )
}
