// Turns an uploaded .xlsx/.xls/.csv file into session-import rows (E3).
//
// `parseSpreadsheet` is a PURE function over `{ name, buffer }` - a filename
// (used only to pick xlsx vs csv) and an ArrayBuffer. jsdom's File has no
// arrayBuffer(), so the one DOM-touching step (reading the File) is kept in
// `readFileAsArrayBuffer`, letting everything else run - and be tested -
// without a real browser.
import Papa from 'papaparse'

// Mirrors server/src/lib/columns.js - the two sides must agree on what
// counts as "the item code column" and what counts as a reserved header.
export const normaliseHeader = (h) => String(h ?? '').toLowerCase().replace(/[\s\-_]+/g, '')
export const isItemCodeHeader = (h) => normaliseHeader(h) === 'itemcode'
export const EXPORT_COLUMNS = { status: 'Scan Status', at: 'Scanned At', by: 'Scanned By' }
const RESERVED = new Set(['scanstatus', 'scannedat', 'scannedby'])
export const isReservedColumn = (h) => RESERVED.has(normaliseHeader(h))

// Header names that suggest "this is what's on the label", strongest first.
// Whole words of the raw header, so "STAGE" is not a tag. A superseded
// column ("OLD ASSET TAG") scores just under its current twin.
const CODE_HINTS = [
  [/\b(asset\s*(tag|id|no|number|code)|tag|barcode|qr\s*code|imei)\b/i, 3],
  [/\b(code|sku|msisdn)\b|\b(mobile|phone|cell|sim)\s*(number|no)\b/i, 2],
  [/\bserial\b/i, 1],
]
const SUPERSEDED = /\b(old|previous|prev|former|legacy)\b/i

function hintScore(header) {
  const score = CODE_HINTS.find(([pattern]) => pattern.test(header))?.[1] ?? 0
  return score && SUPERSEDED.test(header) ? score - 0.5 : score
}

// The server refuses longer item codes (services/sessionItems.js).
const MAX_ITEM_CODE_LENGTH = 128
// A label-like column still qualifies with gaps, as long as at least half
// its rows are filled in with different values.
const MIN_HINTED_COVERAGE = 0.5

/** A cell that says "nothing here" in words - N/A, TBD, none, a dash. */
export const isPlaceholder = (value) => /^(n\/?a|none|nil|null|tbd|-+|—|\?)$/i.test(String(value ?? '').trim())

/** usable: every row has a value, none repeats (ignoring case, like the
 *  database's unique index) and each fits the server's 128-char limit.
 *  coverage: distinct values / rows. Placeholders count as blank. */
function columnStats(rows, header) {
  const seen = new Set()
  let filled = 0
  let fits = true
  for (const { values } of rows) {
    const value = String(values[header] ?? '').trim()
    if (!value || isPlaceholder(value)) continue
    filled += 1
    if (value.length > MAX_ITEM_CODE_LENGTH) fits = false
    seen.add(value.toLowerCase())
  }
  return {
    usable: fits && filled === rows.length && seen.size === rows.length,
    coverage: rows.length ? seen.size / rows.length : 0,
  }
}

/**
 * Which column's values become the item codes - decided here, never asked
 * of the user. Tiers, best first:
 *   4 a header named "Item Code" (any spelling) - the user said so
 *   3 a label-like header (asset tag, barcode, code, serial) that is filled
 *     in and unique on every row
 *   2 a label-like header that is at least half filled in (the dry run
 *     reports the gaps)
 *   1 any other column that is filled in and unique
 *   0 anything else
 * Ties go to the filled-in unique one, then the stronger name, then more
 * distinct values, then whichever comes first in the file - except in tier
 * 0, where more distinct values come before the name (a "Serial Number"
 * that says N/A on most rows is no identifier). Reserved export columns are
 * never picked; undefined only when nothing else is left.
 */
export function pickItemCodeColumn({ headers, rows }) {
  let best
  headers.forEach((header, index) => {
    if (isReservedColumn(header)) return
    const { usable, coverage } = columnStats(rows, header)
    const hint = hintScore(header)
    const tier = isItemCodeHeader(header) ? 4
      : hint > 0 && usable ? 3
      : hint > 0 && coverage >= MIN_HINTED_COVERAGE ? 2
      : usable ? 1
      : 0
    const rank = tier === 0
      ? [tier, usable ? 1 : 0, coverage, hint, -index]
      : [tier, usable ? 1 : 0, hint, coverage, -index]
    if (!best || isBetter(rank, best.rank)) best = { header, rank }
  })
  return best?.header
}

function isBetter(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsArrayBuffer(file)
  })
}

/** `{ name, buffer }` -> `{ headers, rows: [{ line, values }], sheetName }`.
 *  `values` is a null-prototype object keyed by cleaned header, so a column
 *  literally named `__proto__` is just data. Blank rows are dropped, but the
 *  remaining rows keep their original spreadsheet line numbers. */
export async function parseSpreadsheet({ name, buffer }) {
  return /\.csv$/i.test(name) ? parseCsv(buffer) : parseXlsx(buffer)
}

async function parseXlsx(buffer) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')

  const table = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })]))
    }
    table.push(row)
  }
  return buildParsed(table, sheetName, range.s.r)
}

/** Numeric cells: use the formatted text SheetJS computed (keeps leading
 *  zeros and custom number formats like "00000") unless it is in exponent
 *  form, where the raw value converted with String() keeps full precision
 *  ("1E+15" would silently truncate a 16-digit code). Dates: YYYY-MM-DD. */
function cellText(cell) {
  if (!cell || cell.v === undefined || cell.v === null) return ''
  if (cell.t === 'n') {
    const formatted = cell.w
    return formatted && !/e/i.test(formatted) ? formatted : String(cell.v)
  }
  if (cell.t === 'd' || cell.v instanceof Date) {
    const d = cell.v instanceof Date ? cell.v : new Date(cell.v)
    return isoDate(d)
  }
  return String(cell.v)
}

const pad2 = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

function parseCsv(buffer) {
  const text = new TextDecoder('utf-8').decode(buffer)
  const { data } = Papa.parse(text, { header: false, skipEmptyLines: false })
  return buildParsed(data, null, 0)
}

/** Header cleaning: trim; a blank header (with data below it) becomes
 *  "Column N"; a header repeated later gets " (2)", " (3)", ... */
function cleanHeaders(raw) {
  const seen = new Map()
  return raw.map((h, i) => {
    const trimmed = String(h ?? '').trim()
    const base = trimmed || `Column ${i + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count > 1 ? `${base} (${count})` : base
  })
}

function buildParsed(table, sheetName, startRow) {
  if (table.length === 0) return { headers: [], rows: [], sheetName }
  const headers = cleanHeaders(table[0])
  const rows = []

  for (let t = 1; t < table.length; t++) {
    const raw = table[t] ?? []
    const values = Object.create(null)
    let hasValue = false
    headers.forEach((header, i) => {
      const v = String(raw[i] ?? '').trim()
      if (v) hasValue = true
      values[header] = v
    })
    if (!hasValue) continue // dropped, but later rows keep their own line number
    rows.push({ line: startRow + t + 1, values })
  }

  return { headers, rows, sheetName }
}

/**
 * `parseSpreadsheet`'s output -> the shape POST /api/sessions/:id/import
 * expects. The item code comes from `pickItemCodeColumn` - a real asset
 * register rarely has a column literally named "Item Code" (e.g. "NEW ASSET
 * TAG"), and the upload dialog does not ask. That column and any reserved
 * export header (Scan Status, Scanned At, Scanned By) never become part of
 * `data` or `columns`; every other column is kept as it is in the file.
 * `{ error }` only when the file has no usable column at all.
 */
export function buildImportPayload(parsed, { displayColumns } = {}) {
  const codeColumn = pickItemCodeColumn(parsed)
  if (!codeColumn) return { error: 'This file has no columns to import.' }

  const reserved = []
  const columns = []
  for (const header of parsed.headers) {
    if (header === codeColumn) continue
    if (isReservedColumn(header)) { reserved.push(header); continue }
    columns.push(header)
  }

  const rows = parsed.rows.map(({ line, values }) => {
    const data = Object.create(null)
    for (const c of columns) data[c] = values[c]
    return { line, item_code: values[codeColumn], data }
  })

  return { codeColumn, columns, reserved, display_columns: displayColumns ?? columns, rows }
}
