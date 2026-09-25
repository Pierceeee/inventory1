import { formatDateTime } from '../../lib/format.js'

const TONE = {
  scanned: 'bg-ok-50 text-ok-700 ring-ok-200',
  duplicate: 'bg-warn-50 text-warn-700 ring-warn-200',
  not_found: 'bg-bad-50 text-bad-700 ring-bad-200',
}

/** Green/yellow/red result of the last scan (§7). Duplicate names who
 *  scanned it and when, so a scanner does not have to go hunting in the
 *  table for who beat them to it. */
export default function ScanResultBanner({ result }) {
  if (!result) return null
  const { outcome, code } = result

  const message =
    outcome === 'scanned'
      ? `${code} scanned.`
      : outcome === 'duplicate'
        ? `${code} was already scanned by ${result.scanned_by_name ?? 'someone'} on ${formatDateTime(result.scanned_at)}.`
        : `${code} is not in this session.`

  return (
    <div role="status" className={`mt-3 rounded-lg px-4 py-3 text-sm font-medium ring-1 ring-inset ${TONE[outcome] ?? TONE.not_found}`}>
      {message}
    </div>
  )
}
