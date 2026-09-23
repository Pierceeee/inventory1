// Header matching for session imports. The client keeps an identical copy
// (client/src/lib/spreadsheet.js) - the two sides must agree on what counts
// as "the item code column" and what counts as a reserved export header.
export const normaliseHeader = (h) => String(h ?? '').toLowerCase().replace(/[\s\-_]+/g, '')
export const isItemCodeHeader = (h) => normaliseHeader(h) === 'itemcode'

// The headers the export writes for scan status - never stored as data if a
// re-imported export file still has them.
export const EXPORT_COLUMNS = { status: 'Scan Status', at: 'Scanned At', by: 'Scanned By' }
const RESERVED = new Set(['scanstatus', 'scannedat', 'scannedby'])
export const isReservedColumn = (h) => RESERVED.has(normaliseHeader(h))
