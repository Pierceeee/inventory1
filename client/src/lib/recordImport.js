// The Import page's column handling (Devices / Employees): a parsed
// spreadsheet (lib/spreadsheet parseSpreadsheet) -> the rows POST
// /api/import/* expects, decided here instead of asked of the user. The
// page shows the result, so the user approves what will actually be saved.
import { isPlaceholder, isReservedColumn, pickItemCodeColumn } from './spreadsheet.js'

// Lower-case letters and digits only: "Notes/ Anydesk" -> "notesanydesk".
const squash = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** A cell's text, with placeholders (N/A, TBD, none, -) read as empty. */
const cellOf = (values, header) => {
  const value = header ? String(values[header] ?? '').trim() : ''
  return isPlaceholder(value) ? '' : value
}

/** The first header matching a synonym (earlier synonyms win), skipping any
 *  already used. `prefix` / `suffix` also accept a header that starts / ends
 *  with one, after every exact match has been tried. */
function findColumn(headers, synonyms, taken, { prefix = false, suffix = false } = {}) {
  const free = headers.filter((h) => !taken.has(h) && !isReservedColumn(h))
  for (const synonym of synonyms) {
    const hit = free.find((h) => squash(h) === synonym)
    if (hit) return hit
  }
  for (const synonym of synonyms) {
    const hit = free.find((h) => (prefix && squash(h).startsWith(synonym)) || (suffix && squash(h).endsWith(synonym)))
    if (hit) return hit
  }
  return undefined
}

const DEVICE_COLUMNS = {
  type: ['type', 'devicetype', 'assettype', 'equipmenttype', 'category', 'kind'],
  brand: ['brand', 'make', 'manufacturer'],
  model: ['model', 'modelname', 'modelno', 'devicemodel', 'handsetmodel', 'phonemodel', 'mobilemodel', 'unitmodel',
    'handset', 'description', 'devicedescription', 'itemdescription', 'devicename', 'itemname', 'productname',
    'product', 'device', 'item', 'specs'],
  serial_number: ['serialnumber', 'serialno', 'serial', 'sn', 'sno', 'servicetag', 'imei', 'imeino', 'imeinumber'],
  os: ['os', 'operatingsystem', 'osversion', 'platform'],
  notes: ['notes', 'note', 'remarks', 'remark', 'comments', 'comment'],
}
const MATCH_OPTIONS = { model: { suffix: true }, notes: { prefix: true } }

// Headers that only a phone register has. A phone number only counts when
// it is the column identifying each device - a laptop sheet can list its
// assignee's phone number.
const PHONE_COLUMNS = /handset|imei|simcard|simnumber|simno|msisdn/
const PHONE_ID_COLUMNS = /^(mobile|phone|cell|cellphone)(number|no)$/

const LAPTOP_WORDS = /\b(laptop|notebook|macbook|chromebook|ultrabook)s?\b/i
const MOBILE_WORDS = /\b(mobile|phone|smartphone|cellphone|iphone|ipad|tablet)s?\b/i
const LAPTOP_MODELS = /\b(laptop|notebook|macbook|chromebook|ultrabook|thinkpad|ideapad|thinkbook|latitude|inspiron|vostro|probook|elitebook|zenbook|vivobook|matebook|galaxy\s+book)/i
const MOBILE_MODELS = new RegExp([
  /\b(iphone|ipad|phone|smartphone|tablet|pixel|oppo|vivo|realme|infinix|tecno|oneplus|nokia|poco|redmi)\b/.source,
  /\bgalaxy\s+(s|a|z|m|note|tab)\s?\d/.source,
  /\bsamsung\s+(galaxy\s+)?[asmz]\s?\d/.source,
  /\bhuawei\s+(nova|y\d|p\d)/.source,
].join('|'), 'i')

// Only names and product lines that can't mean anything else.
const BRANDS = [
  [/\b(apple|macbook|imac|iphone|ipad)\b/i, 'Apple'],
  [/\b(dell|latitude|inspiron|vostro)\b/i, 'Dell'],
  [/\b(hp|hewlett|probook|elitebook)\b/i, 'HP'],
  [/\b(lenovo|thinkpad|ideapad|thinkbook)\b/i, 'Lenovo'],
  [/\b(asus|zenbook|vivobook)\b/i, 'Asus'],
  [/\b(acer)\b/i, 'Acer'],
  [/\b(microsoft|surface)\b/i, 'Microsoft'],
  [/\b(samsung|galaxy)\b/i, 'Samsung'],
  [/\b(huawei|matebook)\b/i, 'Huawei'],
  [/\b(xiaomi|redmi)\b/i, 'Xiaomi'],
  [/\b(google|pixel)\b/i, 'Google'],
  [/\bmsi\b/i, 'MSI'],
  [/\b(toshiba|dynabook)\b/i, 'Toshiba'],
  [/\bfujitsu\b/i, 'Fujitsu'],
  [/\brazer\b/i, 'Razer'],
  [/\boppo\b/i, 'Oppo'],
  [/\bvivo\b/i, 'Vivo'],
  [/\brealme\b/i, 'Realme'],
  [/\b(nokia)\b/i, 'Nokia'],
  [/\boneplus\b/i, 'OnePlus'],
  [/\binfinix\b/i, 'Infinix'],
  [/\btecno\b/i, 'Tecno'],
]

/** Free text -> one of the devices.os values, or '' when it is none of them. */
export function normaliseOs(raw) {
  const text = String(raw ?? '')
  if (/windows|\bwin\s*(xp|7|8|10|11)\b/i.test(text)) return 'windows'
  if (/mac\s*os|os\s*x|\bmac\b|macbook/i.test(text)) return 'macos'
  if (/\bios\b|ipados|iphone|ipad/i.test(text)) return 'ios'
  if (/android/i.test(text)) return 'android'
  return ''
}

/** A Type cell -> laptop / mobile; anything else is passed through so the
 *  server reports it on that row. Blank -> guessed like a missing column. */
function readType(raw, guess) {
  if (!raw) return guess()
  if (LAPTOP_WORDS.test(raw)) return 'laptop'
  if (MOBILE_WORDS.test(raw)) return 'mobile'
  return raw.toLowerCase()
}

const guessBrand = (text) => BRANDS.find(([pattern]) => pattern.test(text))?.[1] ?? ''

/**
 * `{ headers, rows }` -> `{ rows, sources, extras, typeDefault, typeSignals }`
 * for POST /api/import/devices. Placeholder cells (N/A, TBD...) are empty.
 * - asset_tag: pickItemCodeColumn's choice (an asset-tag-like column that is
 *   filled in and unique - NEW ASSET TAG over OLD ASSET TAG; Mobile Number
 *   in a phone register).
 * - type: a Type column if there is one. Otherwise per row: laptop when the
 *   model is a laptop line, mobile when the OS or model says phone/tablet,
 *   else `typeDefault` - mobile when the sheet has phone columns (listed in
 *   `typeSignals`: Handset..., IMEI, SIM, or a phone number as the tag).
 * - brand: a Brand/Make column, else read from the model where unmistakable.
 * - notes: the Notes column, then "Header: value" for every column no field
 *   took (and the OS as written, when the os field can't hold it exactly).
 * `sources` names the column behind each field (null = worked out);
 * `extras` lists the columns kept in Notes. `{ error }` only when the file
 * has nothing to import.
 */
export function mapDevices(parsed) {
  const { headers } = parsed
  const tag = pickItemCodeColumn(parsed)
  if (!tag) return { error: 'This file has no columns to import.' }

  const { sources, extras } = deviceSources(headers, tag)
  const typeSignals = phoneSignals(headers, tag)
  const typeDefault = typeSignals.length > 0 ? 'mobile' : 'laptop'
  const rows = parsed.rows.map((row) => mapDeviceRow(row, { headers, sources, extras, typeDefault }))

  return { rows, sources, extras, typeDefault, typeSignals }
}

/** Which header fills each device field (null = none), claiming each header
 *  at most once, and the headers left over for Notes. */
function deviceSources(headers, tag) {
  const taken = new Set([tag])
  const sources = { asset_tag: tag }
  for (const [field, synonyms] of Object.entries(DEVICE_COLUMNS)) {
    sources[field] = findColumn(headers, synonyms, taken, MATCH_OPTIONS[field]) ?? null
    if (sources[field]) taken.add(sources[field])
  }
  const extras = headers.filter((h) => !taken.has(h) && !isReservedColumn(h))
  return { sources, extras }
}

/** Headers that only a phone register has (a phone number counts only as
 *  the column identifying each device). */
const phoneSignals = (headers, tag) => headers.filter((h) =>
  PHONE_COLUMNS.test(squash(h)) || (h === tag && PHONE_ID_COLUMNS.test(squash(h))))

/** Type for a row with no Type cell: a laptop line, then a phone or tablet
 *  by OS or model, then the sheet's default. */
function guessDeviceType({ brand, model, os, fallback }) {
  const text = `${brand} ${model}`
  if (LAPTOP_MODELS.test(text)) return 'laptop'
  if (os === 'ios' || os === 'android' || MOBILE_MODELS.test(text)) return 'mobile'
  return fallback
}

/** The Notes column first, then "Header: value" for every column no field
 *  took - and the OS as written when the os field could not hold it. */
function deviceNotes({ headers, cell, sources, extras, os }) {
  const kept = headers
    .map((h) => [h, cell(h)])
    .filter(([h, value]) => value && ((h === sources.os && os !== value.toLowerCase()) || extras.includes(h)))
    .map(([h, value]) => `${h}: ${value}`)
  return [cell(sources.notes), ...kept].filter(Boolean).join('\n')
}

function mapDeviceRow({ line, values }, { headers, sources, extras, typeDefault }) {
  const cell = (h) => cellOf(values, h)
  const model = cell(sources.model)
  const os = normaliseOs(cell(sources.os))
  const brand = cell(sources.brand) || guessBrand(model)
  return {
    line,
    asset_tag: cell(sources.asset_tag),
    type: readType(cell(sources.type), () => guessDeviceType({ brand, model, os, fallback: typeDefault })),
    brand,
    model,
    serial_number: cell(sources.serial_number),
    os,
    notes: deviceNotes({ headers, cell, sources, extras, os }),
  }
}

const EMPLOYEE_COLUMNS = {
  full_name: ['fullname', 'name', 'employeename', 'employee', 'staffname', 'completename'],
  email: ['email', 'emailaddress', 'workemail', 'companyemail', 'mail'],
  department: ['department', 'dept', 'businessunit', 'team', 'division', 'unit'],
}

/** `{ headers, rows }` -> `{ rows, sources, extras }` for POST
 *  /api/import/employees. Separate First/Last Name columns are joined when
 *  there is no single name column. Employees have no notes field, so
 *  `extras` - the columns not stored - is listed for the user to see. */
export function mapEmployees(parsed) {
  const { headers } = parsed
  const taken = new Set()
  const sources = {}
  for (const [field, synonyms] of Object.entries(EMPLOYEE_COLUMNS)) {
    sources[field] = findColumn(headers, synonyms, taken) ?? null
    if (sources[field]) taken.add(sources[field])
  }

  let nameOf = (cell) => cell(sources.full_name)
  if (!sources.full_name) {
    const first = findColumn(headers, ['firstname', 'givenname', 'first'], taken)
    const last = first && findColumn(headers, ['lastname', 'surname', 'familyname', 'last'], taken)
    if (!first || !last) {
      return { error: 'This file has no name column. Add one called "Name" or "Full Name".' }
    }
    taken.add(first); taken.add(last)
    sources.full_name = `${first} + ${last}`
    nameOf = (cell) => [cell(first), cell(last)].filter(Boolean).join(' ')
  }
  const extras = headers.filter((h) => !taken.has(h) && !isReservedColumn(h))

  const rows = parsed.rows.map(({ line, values }) => {
    const cell = (h) => cellOf(values, h)
    return { line, full_name: nameOf(cell), email: cell(sources.email), department: cell(sources.department) }
  })
  return { rows, sources, extras }
}
