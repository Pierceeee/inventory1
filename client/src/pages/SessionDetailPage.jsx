import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ProgressBar from '../components/ui/ProgressBar.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import Modal from '../components/ui/Modal.jsx'
import ColumnPicker from '../components/sessions/ColumnPicker.jsx'
import SessionItemsTable from '../components/sessions/SessionItemsTable.jsx'
import UploadItemsDialog from '../components/sessions/UploadItemsDialog.jsx'
import ClearItemsDialog from '../components/sessions/ClearItemsDialog.jsx'
import CompleteSessionDialog from '../components/sessions/CompleteSessionDialog.jsx'
import ScannerPanel from '../components/scanner/ScannerPanel.jsx'
import UndoScanDialog from '../components/scanner/UndoScanDialog.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useSession } from '../hooks/useSession.jsx'
import { useInventorySession, useSessionItems, useUpdateSession } from '../hooks/useInventorySessions.js'
import { canManage, canScan, isAdmin } from '../lib/roles.js'

const PAGE_SIZE = 100

export default function SessionDetailPage() {
  const { id } = useParams()
  const { profile, profileLoading } = useSession()
  const { notify } = useToast()
  const { data: session, isPending, error } = useInventorySession(id)
  const [status, setStatus] = useState(undefined)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data: itemsResult, isLoading: itemsLoading, error: itemsError } =
    useSessionItems(id, { status, q, page, page_size: PAGE_SIZE })
  const updateSession = useUpdateSession()

  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [pickingColumns, setPickingColumns] = useState(false)
  const [displayDraft, setDisplayDraft] = useState([])
  const [undoingItem, setUndoingItem] = useState(null)

  // The role-gated action buttons below depend on /me, which can resolve
  // after the session query (G-12) - wait for both rather than flash them in.
  if (isPending || profileLoading) return <p role="status" className="p-8 text-sm text-slate-500">Loading…</p>
  if (error) return <ErrorBanner error={error} className="m-8" />
  if (!session) return null

  function handleStatusChange(next) { setStatus(next); setPage(1) }
  function handleQChange(next) { setQ(next); setPage(1) }

  const manage = canManage(profile, session.department_id)
  const active = session.effective_status === 'active'

  function openColumnPicker() {
    setDisplayDraft(session.display_columns ?? session.columns)
    setPickingColumns(true)
  }

  function saveColumns() {
    updateSession.mutate({ id: session.id, display_columns: displayDraft }, {
      onSuccess: () => { notify('Updated the columns shown.'); setPickingColumns(false) },
    })
  }

  return (
    <>
      <PageHeader
        back={<Link to="/sessions" className="mb-1 block text-sm text-brand-700 hover:underline">← Sessions</Link>}
        title={session.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {session.department_name} <StatusBadge status={session.effective_status} />
            {session.item_count} items · {session.scanned_count} of {session.item_count} scanned
          </span>
        }
        actions={
          <>
            {manage && active && (
              <>
                <Button variant="secondary" onClick={() => setUploading(true)}>
                  <Icon name="upload" size={16} /> Upload Excel
                </Button>
                <Button variant="secondary" onClick={openColumnPicker}>Choose columns</Button>
                <Button variant="secondary" onClick={() => setClearing(true)}>
                  <Icon name="eraser" size={16} /> Clear Items
                </Button>
              </>
            )}
            {isAdmin(profile) && (
              <Link to={`/sessions/${session.id}/labels`}>
                <Button variant="secondary"><Icon name="printer" size={16} /> Print QR codes</Button>
              </Link>
            )}
            {isAdmin(profile) && active && (
              <Button onClick={() => setCompleting(true)}>Mark Complete</Button>
            )}
            {/* G5 adds Export and Delete here. */}
          </>
        }
      />

      {!active && (
        <p className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          This session is {session.effective_status} and read-only.
        </p>
      )}

      <div className="mb-6 max-w-sm">
        <ProgressBar value={session.scanned_count} max={session.item_count} label="Scanning progress" />
      </div>

      {canScan(profile, session.department_id) && active && <ScannerPanel session={session} />}

      <SessionItemsTable
        session={session}
        result={itemsResult}
        status={status}
        onStatusChange={handleStatusChange}
        q={q}
        onQChange={handleQChange}
        onPageChange={setPage}
        isLoading={itemsLoading}
        error={itemsError}
        renderActions={isAdmin(profile) && active ? (item) => (
          item.status === 'scanned' ? (
            <button
              type="button"
              title={`Undo scan of ${item.item_code}`}
              aria-label={`Undo scan of ${item.item_code}`}
              onClick={() => setUndoingItem(item)}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <Icon name="undo" size={16} />
            </button>
          ) : null
        ) : undefined}
      />

      <UploadItemsDialog session={session} open={uploading} onClose={() => setUploading(false)} />
      <ClearItemsDialog session={session} open={clearing} onClose={() => setClearing(false)} />
      <CompleteSessionDialog session={session} open={completing} onClose={() => setCompleting(false)} />
      <UndoScanDialog session={session} item={undoingItem} open={Boolean(undoingItem)} onClose={() => setUndoingItem(null)} />

      <Modal open={pickingColumns} onClose={() => setPickingColumns(false)} title="Choose columns"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPickingColumns(false)}>Cancel</Button>
            <Button onClick={saveColumns} disabled={updateSession.isPending}>
              {updateSession.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }>
        <ErrorBanner error={updateSession.error} />
        <ColumnPicker columns={session.columns} selected={displayDraft} onChange={setDisplayDraft} />
      </Modal>
    </>
  )
}
