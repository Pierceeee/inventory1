import { useMemo, useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import StatCard from '../components/ui/StatCard.jsx'
import SearchInput from '../components/ui/SearchInput.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { inputClass } from '../components/ui/Field.jsx'
import ItemsTable from '../components/items/ItemsTable.jsx'
import EditItemPanel from '../components/items/EditItemPanel.jsx'
import DeleteItemDialog from '../components/items/DeleteItemDialog.jsx'
import { useSession } from '../hooks/useSession.jsx'
import { useSessionList } from '../hooks/useInventorySessions.js'
import { useItemList } from '../hooks/useItems.js'

const PAGE_SIZE = 100

/** The master data view across every session (Phase 5). Scoped by
 *  department on the server; admins and heads only (RequireRole in App.jsx),
 *  and heads see their own department's archived sessions too (R1). */
export default function InventoryPage() {
  const { profile, profileLoading } = useSession()
  const [sessionId, setSessionId] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [editingItem, setEditingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)

  // `status: 'all'` deliberately leaves archived sessions out for non-admins
  // (server/src/services/inventorySessions.js) - a second, separate call for
  // `status: 'archived'` is the only way a head's OWN department's archived
  // sessions (R1) reach this dropdown too. For a scanner this page is never
  // reached (RequireRole in App.jsx), so the second call never even fires
  // the 403 it would otherwise get. For an ADMIN, `status: 'all'` already
  // includes archived sessions, so the two lists overlap - dedupe by id
  // rather than assume which caller's `all` does or doesn't include them.
  const { data: openSessions = [] } = useSessionList({ status: 'all' })
  const { data: archivedSessions = [] } = useSessionList({ status: 'archived' })
  const sessions = useMemo(() => {
    const byId = new Map([...openSessions, ...archivedSessions].map((s) => [s.id, s]))
    return [...byId.values()]
  }, [openSessions, archivedSessions])
  const { data, isLoading, error } = useItemList({
    session_id: sessionId === 'all' ? undefined : sessionId,
    status: status === 'all' ? undefined : status,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
  })

  function handleSessionChange(next) { setSessionId(next); setPage(1) }
  function handleStatusChange(next) { setStatus(next); setPage(1) }
  function handleQChange(next) { setQ(next); setPage(1) }

  const items = data?.items ?? []
  const columns = data?.columns ?? []
  const counts = data?.counts ?? { total: 0, scanned: 0, pending: 0 }

  return (
    <>
      <PageHeader title="Inventory" subtitle="Every item across every session, in one place." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="Session"
          className={`${inputClass} max-w-xs`}
          value={sessionId}
          onChange={(e) => handleSessionChange(e.target.value)}>
          <option value="all">All sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <SearchInput value={q} onChange={handleQChange} placeholder="Search item code…" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={counts.total}
                  active={status === 'all'} onClick={() => handleStatusChange('all')} />
        <StatCard label="Scanned" value={counts.scanned} tone="ok"
                  active={status === 'scanned'} onClick={() => handleStatusChange('scanned')} />
        <StatCard label="Pending" value={counts.pending} tone="warn"
                  active={status === 'pending'} onClick={() => handleStatusChange('pending')} />
      </div>

      <ErrorBanner error={error} className="mb-4" />

      <div className="flex flex-col gap-4">
        <ItemsTable
          items={items}
          columns={columns}
          showSession={sessionId === 'all'}
          profile={profile}
          onEdit={setEditingItem}
          onDelete={setDeletingItem}
          isLoading={isLoading || profileLoading}
          error={null}
        />
        <Pagination
          page={data?.page ?? page}
          pageSize={data?.page_size ?? PAGE_SIZE}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </div>

      <EditItemPanel item={editingItem} open={Boolean(editingItem)} onClose={() => setEditingItem(null)} />
      <DeleteItemDialog item={deletingItem} open={Boolean(deletingItem)} onClose={() => setDeletingItem(null)} />
    </>
  )
}
