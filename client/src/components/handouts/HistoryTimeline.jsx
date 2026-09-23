import { Link } from 'react-router-dom'
import { formatDateTime, formatDuration } from '../../lib/format.js'
import { ConditionBadge, CONDITION_RANK, ACCESSORY_LABELS } from './ConditionFields.jsx'

const REASONS = {
  resignation: 'Resignation', swap: 'Swap', repair: 'Repair',
  lost: 'Lost', other: 'Other',
}

/** Only meaningful once a device is back - an open handout is not missing
 *  anything, it is still out. */
function missingAccessories(entry) {
  if (!entry.returned_at || !entry.issued_accessories) return []
  const back = entry.returned_accessories ?? []
  return entry.issued_accessories.filter((a) => !back.includes(a))
}

export default function HistoryTimeline({ entries = [], perspective = 'device', emptyMessage }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200">
      {entries.map((entry) => {
        const open = entry.returned_at === null
        const subject = perspective === 'device'
          ? { label: entry.employee_name, to: `/employees/${entry.employee_id}` }
          : { label: `${entry.asset_tag} · ${entry.device_model ?? ''}`, to: `/devices/${entry.device_id}` }

        return (
          <li key={entry.id} className="bg-white px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to={subject.to} className="text-sm font-medium text-brand-700 hover:underline">
                {subject.label}
              </Link>
              <span className={`text-xs font-medium ${open ? 'text-ok-700' : 'text-slate-500'}`}>
                {open ? `Still held · ${formatDuration(entry.issued_at)}` : REASONS[entry.return_reason] ?? 'Returned'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Issued {formatDateTime(entry.issued_at)}
              {entry.issued_by_name && <> by {entry.issued_by_name}</>}
              {entry.returned_at && (
                <> · Returned {formatDateTime(entry.returned_at)}
                  {entry.returned_by_name && <> by {entry.returned_by_name}</>}</>
              )}
            </p>

            {/* The condition pair is the whole point: what shape it left in,
                what shape it came back in, side by side. */}
            {entry.issued_condition && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <ConditionBadge condition={entry.issued_condition} />
                {entry.returned_condition && (
                  <>
                    <span aria-hidden="true">→</span>
                    <ConditionBadge condition={entry.returned_condition} />
                    {CONDITION_RANK[entry.returned_condition] > CONDITION_RANK[entry.issued_condition] && (
                      <span className="font-medium text-warn-700">deteriorated</span>
                    )}
                  </>
                )}
              </div>
            )}

            {missingAccessories(entry).length > 0 && (
              <p className="mt-1 text-xs font-medium text-warn-700">
                Not returned: {missingAccessories(entry)
                  .map((a) => ACCESSORY_LABELS[a] ?? a).join(', ')}.
              </p>
            )}

            {entry.notes && <p className="mt-1 text-xs text-slate-600">{entry.notes}</p>}
          </li>
        )
      })}
    </ol>
  )
}
