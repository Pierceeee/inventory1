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

export const findItemCodeColumn = (headers) => headers.find((h) => isItemCodeHeader(h))

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
 * expects. Returns `{ error }` when no single item-code column can be found.
 * The item-code column and any reserved export header (Scan Status, Scanned
 * At, Scanned By) never become part of `data` or `columns`.
 */
export function buildImportPayload(parsed, displayColumns) {
  const codeColumns = parsed.headers.filter((h) => isItemCodeHeader(h))
  if (codeColumns.length === 0) {
    return { error: 'No item code column found. Add a column named "Item Code" (or similar).' }
  }
  if (codeColumns.length > 1) {
    return { error: 'More than one column looks like an item code column. Keep only one.' }
  }
  const codeColumn = codeColumns[0]

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
