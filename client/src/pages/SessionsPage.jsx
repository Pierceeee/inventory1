import { useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import Icon from '../components/ui/Icon.jsx'
import SessionCard from '../components/sessions/SessionCard.jsx'
import NewSessionDialog from '../components/sessions/NewSessionDialog.jsx'
import UploadItemsDialog from '../components/sessions/UploadItemsDialog.jsx'
import { useSession } from '../hooks/useSession.jsx'
import { useSessionList } from '../hooks/useInventorySessions.js'
import { canManage } from '../lib/roles.js'

const STATUS_CHIPS = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export default function SessionsPage() {
  const { profile, profileLoading } = useSession()
  const [status, setStatus] = useState(undefined)
  const [creating, setCreating] = useState(false)
  const [uploadingSession, setUploadingSession] = useState(null)
  const { data: sessions, isPending, error } = useSessionList({ status })

  if (profileLoading) return <p role="status" className="text-sm text-slate-500">Loading…</p>

  const hasDepartment = profile?.role === 'admin' || profile?.department != null
  const canCreate = profile?.role === 'admin' || (profile?.role === 'head' && hasDepartment)

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
          You're not assigned to a department yet. Ask an admin to assign you one
          before any sessions will show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <FilterChips label="Status" options={STATUS_CHIPS} value={status} onChange={setStatus} />
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
    </>
  )
}
