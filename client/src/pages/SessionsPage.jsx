import { useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import Icon from '../components/ui/Icon.jsx'
import SessionCard from '../components/sessions/SessionCard.jsx'
import NewSessionDialog from '../components/sessions/NewSessionDialog.jsx'
import UploadItemsDialog from '../components/sessions/UploadItemsDialog.jsx'
import DeleteSessionDialog from '../components/sessions/DeleteSessionDialog.jsx'
import { useSession } from '../hooks/useSession.jsx'
import { useSessionList } from '../hooks/useInventorySessions.js'
import { canManage, isAdmin, ROLE_LABELS } from '../lib/roles.js'

const STATUS_CHIPS = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]
// R1: admins and heads may read their own department's archive too (heads
// otherwise had no UI path to it - the /archive page itself stays admin-
// only). Scanners never see this chip - the API would 403 status=archived
// for them anyway (services/inventorySessions.js's listSessions).
const ARCHIVED_CHIP = { value: 'archived', label: 'Archived' }

export default function SessionsPage() {
  const { user, profile, profileLoading } = useSession()
  const [status, setStatus] = useState(undefined)
  const [creating, setCreating] = useState(false)
  const [uploadingSession, setUploadingSession] = useState(null)
  const [deletingSession, setDeletingSession] = useState(null)
  const { data: sessions, isPending, error } = useSessionList({ status })

  if (profileLoading) return <p role="status" className="text-sm text-slate-500">Loading…</p>

  const hasDepartment = profile?.role === 'admin' || profile?.department != null
  const canCreate = profile?.role === 'admin' || (profile?.role === 'head' && hasDepartment)
  const statusChips = profile?.role === 'scanner' ? STATUS_CHIPS : [...STATUS_CHIPS, ARCHIVED_CHIP]

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Inventory audit sessions."
        actions={canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New Session
          </Button>
        )}
      />

      {!hasDepartment ? (
        <p className="rounded-xl bg-white p-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          You're signed in as {user?.email} ({ROLE_LABELS[profile?.role]}) but you aren't assigned to a
          department yet. Ask an admin to assign you one.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <FilterChips label="Status" options={statusChips} value={status} onChange={setStatus} />
          <ErrorBanner error={error} />

          {!isPending && sessions?.length === 0 && (
            <p className="rounded-xl bg-white p-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              No sessions yet.
            </p>
          )}

          {isPending ? (
            <p role="status" className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  canUpload={canManage(profile, session.department_id)}
                  onUpload={setUploadingSession}
                  onDelete={isAdmin(profile) ? setDeletingSession : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <NewSessionDialog open={creating} onClose={() => setCreating(false)} />
      <UploadItemsDialog
        session={uploadingSession}
        open={Boolean(uploadingSession)}
        onClose={() => setUploadingSession(null)}
      />
      <DeleteSessionDialog
        session={deletingSession}
        open={Boolean(deletingSession)}
        onClose={() => setDeletingSession(null)}
      />
    </>
  )
}
