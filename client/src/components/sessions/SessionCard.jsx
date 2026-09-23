import { Link } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import ProgressBar from '../ui/ProgressBar.jsx'

/** One card per session on the Sessions page. Upload is offered only while
 *  the session is active and the signed-in user may manage it - a completed
 *  or archived session is read-only everywhere (D4). */
export default function SessionCard({ session, canUpload, onUpload }) {
  const { item_count: total, scanned_count: scanned } = session

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/sessions/${session.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:underline">
            {session.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-slate-500">{session.department_name}</p>
        </div>
        <StatusBadge status={session.effective_status} />
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar value={scanned} max={total} label={`${session.name} scanning progress`} />
        <p className="text-xs text-slate-500">{scanned} of {total} scanned</p>
      </div>

      <div className="mt-1 flex gap-2">
        {canUpload && session.effective_status === 'active' && (
          <Button variant="secondary" onClick={() => onUpload(session)}>
            <Icon name="upload" size={16} /> Upload Excel
          </Button>
        )}
        <Link to={`/sessions/${session.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          Open
        </Link>
      </div>
    </div>
  )
}
