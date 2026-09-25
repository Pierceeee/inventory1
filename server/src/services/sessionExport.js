// Builds the .xlsx a session downloads as (E1/E2/E4/E5, Group 5).
import * as XLSX from 'xlsx'
import { EXPORT_COLUMNS } from '../lib/columns.js'
import { safeFileName } from '../lib/fileName.js'

/** ISO timestamp -> 'YYYY-MM-DD HH:mm' in `timeZone`, via
 *  Intl.DateTimeFormat's parts (never string-parsing a locale-formatted
 *  string, which would be locale-dependent). hourCycle 'h23' keeps midnight
 *  as "00", not "24". */
export function formatOfficeTime(iso, timeZone) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

/** Same zone, date only - used for the file name. */
function formatOfficeDate(date, timeZone) {
  return formatOfficeTime(date.toISOString(), timeZone).slice(0, 10)
}

/**
 * Reads the session's items (in upload order) and writes them to a single-
 * sheet .xlsx buffer. Every cell is built explicitly as `{ t: 's', v: text }`
 * - never `aoa_to_sheet` (which would infer types from JS values) and never a
 * formula (`f`) - so a value that looks like "=1+1" or starts with +/-/@ is
 * shown as inert text and, crucially, re-imports back to that exact text
 * (E4: no apostrophe prefix either - that CSV-only trick would corrupt a
 * value like "+63 917..." or "-5" on re-import).
 */
export async function exportSessionWorkbook(db, session, { timeZone }) {
  // db MEDIUM (-73% query time, measured): only these four columns are ever
  // read below - `select *` on a wide view (session_item_details joins in
  // session/department/scanner names) is needless I/O on a large session.
  const { rows: items } = await db.query(
    `select item_code, data, scanned_at, scanned_by_name
       from session_item_details where session_id = $1 order by seq`,
    [session.id],
  )

  const header = ['itemCode', ...session.columns, EXPORT_COLUMNS.status, EXPORT_COLUMNS.at, EXPORT_COLUMNS.by]
  const rows = items.map((item) => {
    const scanned = Boolean(item.scanned_at)
    return [
      item.item_code,
      ...session.columns.map((c) => item.data?.[c] ?? ''),
      scanned ? 'Scanned' : 'Pending',
      scanned ? formatOfficeTime(item.scanned_at, timeZone) : '',
      item.scanned_by_name ?? '',
    ]
  })

  const aoa = [header, ...rows]
  const ws = {}
  aoa.forEach((row, r) => {
    row.forEach((value, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: value === null || value === undefined ? '' : String(value) }
    })
  })
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: header.length - 1 } })
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 4)) }))

  const wb = XLSX.utils.book_new()
  // Fixed sheet name (E5) - the client's own parser (client/src/lib/
  // spreadsheet.js) always reads the FIRST sheet anyway, but a fixed, known
  // name makes a re-import predictable for anyone opening the file by hand.
  XLSX.utils.book_append_sheet(wb, ws, 'Items')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true })

  const fileName = `${safeFileName(session.name)} - ${formatOfficeDate(new Date(), timeZone)}.xlsx`
  return { buffer, fileName }
}
