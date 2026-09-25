import { Link } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import ProgressBar from '../ui/ProgressBar.jsx'

/** One card per session on the Sessions page. Upload is offered only while
 *  the session is active and the signed-in user may manage it - a completed
 *  or archived session is read-only everywhere (D4). `onDelete` is optional -
 *  only admins get the trash icon. */
export default function SessionCard({ session, canUpload, onUpload, onDelete }) {
  const { item_count: total, scanned_count: scanned } = session

  return (
    <div data-session-card className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/sessions/${session.id}`} className="block truncate text-[15px] font-semibold text-ink-900 hover:underline">
            {session.name}
          </Link>
          <p className="mt-0.5 truncate text-[13px] text-slate-500">{session.department_name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={session.effective_status} />
          {onDelete && (
            <button
              type="button"
              title={`Delete ${session.name}`}
              aria-label={`Delete ${session.name}`}
              onClick={() => onDelete(session)}
              className="-m-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-bad-50 hover:text-bad-700">
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar value={scanned} max={total} label={`${session.name} scanning progress`} />
        <p className="text-[13px] tabular-nums text-slate-500">{scanned} of {total} scanned</p>
      </div>

      <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
        {canUpload && session.effective_status === 'active' && (
          <Button variant="secondary" onClick={() => onUpload(session)}>
            <Icon name="upload" size={16} /> Upload Excel
          </Button>
        )}
        <Link to={`/sessions/${session.id}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:h-9">
          Open <Icon name="arrowRight" size={15} />
        </Link>
      </div>
    </div>
  )
}
