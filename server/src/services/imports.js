import { DEVICE_TYPES, OS_VALUES } from '../lib/values.js'

// Same loose check as the employee form.
const EMAIL_RE = /^\S+@\S+\.\S+$/

const str = (value) => String(value ?? '').trim()
const key = (value) => str(value).toLowerCase()

/** The row's own spreadsheet line when the client sent one (it drops blank
 *  rows but keeps real line numbers), else its position after the header. */
const lineOf = (row, index) => (Number.isInteger(row.line) && row.line > 1 ? row.line : index + 2)

// The device form's limits (validation.js deviceCreate), so an imported
// device can always be saved again from its edit page.
const DEVICE_LIMITS = [['brand', 200], ['model', 200], ['serial_number', 200], ['notes', 5000]]
const LIMIT_LABELS = { brand: 'brand', model: 'model', serial_number: 'the serial number', notes: 'notes' }

/** Why a key cannot be imported again - already saved, or a repeat within
 *  this file (the sheet to fix, not the register) - or null when it is new. */
const whereSeen = (k, saved, inFile) =>
  (saved.has(k) ? 'already exists' : inFile.has(k) ? 'appears earlier in this file' : null)

/**
 * CSV import with a dry run (§6, BE-6). Rows arrive already column-mapped by
 * the client. Every row is checked and bad ones are reported by spreadsheet
 * line number (header is line 1); a bad row never sinks the batch.
 *
 * With commit=false nothing is written. With commit=true the valid rows go in
 * as one statement; any row that a concurrent save beat us to is skipped by
 * ON CONFLICT and reported like any other duplicate.
 */
export async function importDevices(db, rows, { commit = false } = {}) {
  const result = { created: 0, skipped: 0, errors: [] }
  const [{ rows: tagRows }, { rows: serialRows }] = await Promise.all([
    db.query('select lower(asset_tag) as k from devices'),
    db.query('select lower(serial_number) as k from devices where serial_number is not null'),
  ])
  const tags = new Set(tagRows.map((r) => r.k))
  const serials = new Set(serialRows.map((r) => r.k))
  const fileTags = new Set()
  const fileSerials = new Set()
  const valid = []

  rows.forEach((row, index) => {
    const line = lineOf(row, index)
    const assetTag = str(row.asset_tag)
    const type = key(row.type)
    const serial = str(row.serial_number)

    if (!assetTag) {
      result.errors.push({ line, field: 'asset_tag', message: 'Asset tag is required.' })
      return
    }
    if (assetTag.length > 64) {
      result.errors.push({ line, field: 'asset_tag', message: 'Asset tag must be under 64 characters.' })
      return
    }
    if (!DEVICE_TYPES.includes(type)) {
      result.errors.push({ line, field: 'type', message: 'Type must be laptop or mobile.' })
      return
    }
    const tooLong = DEVICE_LIMITS.find(([field, max]) => str(row[field]).length > max)
    if (tooLong) {
      const [field, max] = tooLong
      result.errors.push({ line, field, message: `Keep ${LIMIT_LABELS[field]} under ${max.toLocaleString('en-US')} characters.` })
      return
    }
    const tagSeen = whereSeen(assetTag.toLowerCase(), tags, fileTags)
    if (tagSeen) {
      result.skipped += 1
      result.errors.push({ line, field: 'asset_tag', message: `${assetTag} ${tagSeen} - skipped.` })
      return
    }
    const serialSeen = serial && whereSeen(serial.toLowerCase(), serials, fileSerials)
    if (serialSeen) {
      result.skipped += 1
      result.errors.push({ line, field: 'serial_number',
        message: `Serial number ${serial} ${serialSeen} - skipped.` })
      return
    }

    fileTags.add(assetTag.toLowerCase())
    if (serial) fileSerials.add(serial.toLowerCase())
    valid.push({
      line,
      asset_tag: assetTag,
      type,
      brand: str(row.brand) || null,
      model: str(row.model) || null,
      serial_number: serial || null,
      os: OS_VALUES.includes(key(row.os)) ? key(row.os) : null,
      notes: str(row.notes) || null,
    })
  })

  result.created = valid.length
  if (!commit || valid.length === 0) return result

  const { rows: inserted } = await db.query(
    `insert into devices (asset_tag, type, brand, model, serial_number, os, notes)
     select asset_tag, type, brand, model, serial_number, os, notes
       from jsonb_to_recordset($1::jsonb)
         as r(asset_tag text, type text, brand text, model text, serial_number text, os text, notes text)
     on conflict do nothing
     returning lower(asset_tag) as k`,
    [JSON.stringify(valid)],
  )
  reportLostRaces(result, valid, new Set(inserted.map((r) => r.k)),
    (row) => row.asset_tag.toLowerCase(), 'asset_tag', (row) => row.asset_tag)
  return result
}

export async function importEmployees(db, rows, { commit = false } = {}) {
  const result = { created: 0, skipped: 0, errors: [] }
  const { rows: emailRows } = await db.query(
    'select lower(email) as k from employees where email is not null')
  const emails = new Set(emailRows.map((r) => r.k))
  const fileEmails = new Set()
  const valid = []

  rows.forEach((row, index) => {
    const line = lineOf(row, index)
    const fullName = str(row.full_name)
    const email = str(row.email)

    if (!fullName) {
      result.errors.push({ line, field: 'full_name', message: 'Full name is required.' })
      return
    }
    if (email && !EMAIL_RE.test(email)) {
      result.errors.push({ line, field: 'email', message: 'Not a valid email address.' })
      return
    }
    const emailSeen = email && whereSeen(email.toLowerCase(), emails, fileEmails)
    if (emailSeen) {
      result.skipped += 1
      result.errors.push({ line, field: 'email', message: `${email} ${emailSeen} - skipped.` })
      return
    }

    if (email) fileEmails.add(email.toLowerCase())
    valid.push({ line, full_name: fullName, email: email || null, department: str(row.department) || null })
  })

  result.created = valid.length
  if (!commit || valid.length === 0) return result

  const { rows: inserted } = await db.query(
    `insert into employees (full_name, email, department)
     select full_name, email, department
       from jsonb_to_recordset($1::jsonb) as r(full_name text, email text, department text)
     on conflict do nothing
     returning id, lower(email) as k`,
    [JSON.stringify(valid)],
  )
  // Rows without an email cannot collide, so only emailed rows can be missing.
  reportLostRaces(result, valid.filter((row) => row.email),
    new Set(inserted.map((r) => r.k).filter(Boolean)),
    (row) => row.email.toLowerCase(), 'email', (row) => row.email)
  return result
}

/** After an ON CONFLICT DO NOTHING insert, moves any row a concurrent write
 *  beat us to from "created" into "skipped" - shared by every import that
 *  commits its valid rows in one statement (devices, employees, session
 *  items). */
export function reportLostRaces(result, candidates, insertedKeys, keyOf, field, label) {
  for (const row of candidates) {
    if (insertedKeys.has(keyOf(row))) continue
    result.created -= 1
    result.skipped += 1
    result.errors.push({ line: row.line, field, message: `${label(row)} already exists - skipped.` })
  }
}
