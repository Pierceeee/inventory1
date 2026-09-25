import { z } from 'zod'
import { invalid } from './lib/errors.js'
import {
  CONDITIONS, DEVICE_STATUSES, DEVICE_TYPES, OS_VALUES, RETURN_REASONS, ROLES, isUuid,
} from './lib/values.js'

// Same loose check the client uses, so the two never disagree about an address.
const EMAIL_RE = /^\S+@\S+\.\S+$/

/** Parses `input` with `schema` or throws a 400 whose `details` name each
 *  offending field - the shape the forms use to mark individual inputs. */
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {})
  if (result.success) return result.data
  const details = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] ?? 'body'
    details[field] ??= issue.message
  }
  throw invalid(details)
}

const text = (max) =>
  z.string({ error: 'Must be text.' }).trim().max(max, `Keep this under ${max} characters.`).nullish()

const dateTime = (message = 'Not a valid date.') =>
  z.string({ error: message }).refine((v) => !Number.isNaN(Date.parse(v)), message)

const accessories = z.array(z.string(), { error: 'Must be a list.' }).max(20).nullish()

// ---- devices ----

export const deviceCreate = z.object({
  asset_tag: z.string({ error: 'Asset tag is required.' }).trim()
    .min(1, 'Asset tag is required.').max(64, 'Keep the asset tag under 64 characters.'),
  type: z.enum(DEVICE_TYPES, { error: 'Choose laptop or mobile.' }),
  brand: text(200),
  model: text(200),
  serial_number: text(200),
  os: z.enum(OS_VALUES, { error: 'Not a valid operating system.' }).nullish(),
  status: z.enum(DEVICE_STATUSES, { error: 'Status must be available, repair, or retired.' }).optional(),
  notes: text(5000),
})

export const deviceUpdate = deviceCreate.partial()

// ---- employees ----

const email = z.string({ error: 'Not a valid email address.' }).trim().max(254)
  .refine((v) => v === '' || EMAIL_RE.test(v), 'Not a valid email address.')
  .nullish()

export const employeeCreate = z.object({
  full_name: z.string({ error: 'Full name is required.' }).trim()
    .min(1, 'Full name is required.').max(200, 'Keep the name under 200 characters.'),
  email,
  department: text(200),
})

export const employeeUpdate = employeeCreate.partial()

// ---- assignments ----

export const issueCreate = z.object({
  device_id: z.string({ error: 'Choose a device.' }).min(1, 'Choose a device.'),
  employee_id: z.string({ error: 'Choose an employee.' }).min(1, 'Choose an employee.'),
  issued_at: dateTime().nullish(),
  issued_condition: z.enum(CONDITIONS, { error: 'Condition must be good, fair, or damaged.' }).nullish(),
  issued_accessories: accessories,
  notes: text(5000),
})

export const returnCreate = z.object({
  returned_at: dateTime().nullish(),
  return_reason: z.enum(RETURN_REASONS, { error: 'Choose a reason for the return.' }),
  // Recording a return without its condition throws away the only evidence an
  // offboarding dispute can turn on, so it is required, not optional.
  returned_condition: z.enum(CONDITIONS, { error: 'Record the condition it came back in.' }),
  returned_accessories: accessories,
  notes: text(5000),
})

// ---- auth ----

export const login = z.object({
  email: z.string({ error: 'Enter your email address.' }).trim().min(1, 'Enter your email address.'),
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.'),
})

export const refresh = z.object({
  refresh_token: z.string({ error: 'Missing refresh token.' }).min(1, 'Missing refresh token.'),
})

// ---- departments ----

const uuidRef = (message) => z.string({ error: message }).refine(isUuid, message)

const departmentName = z.string({ error: 'Department name is required.' }).trim()
  .min(1, 'Department name is required.').max(100, 'Keep the name under 100 characters.')

export const departmentCreate = z.object({ name: departmentName })
export const departmentUpdate = departmentCreate

// ---- users ----

export const userRegister = z.object({
  full_name: z.string({ error: 'Full name is required.' }).trim()
    .min(1, 'Full name is required.').max(200, 'Keep the name under 200 characters.'),
  email: z.string({ error: 'Enter an email address.' }).trim().max(254)
    .refine((v) => EMAIL_RE.test(v), 'Not a valid email address.'),
  password: z.string({ error: 'Enter a password.' })
    .min(8, 'Use at least 8 characters.').max(72, 'Keep the password under 72 characters.'),
  role: z.enum(ROLES, { error: 'Choose admin, head or scanner.' }),
  department_id: uuidRef('Choose a department.').nullish(),
}).refine((u) => u.role === 'admin' || u.department_id,
  { path: ['department_id'], message: 'Heads and scanners need a department.' })

export const userUpdate = z.object({
  role: z.enum(ROLES, { error: 'Choose admin, head or scanner.' }).optional(),
  department_id: uuidRef('Choose a department.').nullable().optional(),
  disabled: z.boolean({ error: 'disabled must be true or false.' }).optional(),
})

// ---- import ----

export const importBatch = z.object({
  rows: z.array(z.record(z.string(), z.unknown()), { error: 'rows must be a list.' })
    .max(5000, 'Import at most 5,000 rows at a time.'),
  commit: z.boolean().optional(),
})

// ---- query strings ----

/** Express parses `?a=1&a=2` to an array; take the first, trimmed. */
export const one = (value) => {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string') return undefined
  return v.trim() || undefined
}

export const bool = (value) => {
  const v = one(value)
  return v === 'true' ? true : v === 'false' ? false : undefined
}

export function date(value, field) {
  const v = one(value)
  if (v === undefined) return undefined
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw invalid({ [field]: 'Not a valid date.' })
  return d
}

/** A query string that must be one of a fixed set, or 400 naming the field. */
export function oneOf(value, allowed, field) {
  const v = one(value)
  if (v === undefined) return undefined
  if (!allowed.includes(v)) throw invalid({ [field]: `Must be one of: ${allowed.join(', ')}.` })
  return v
}

/** A whole-number query string within [min, max], or `fallback` when absent. */
export function int(value, field, { min, max, fallback } = {}) {
  const v = one(value)
  if (v === undefined) return fallback
  const n = Number(v)
  if (!Number.isInteger(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
    throw invalid({ [field]: 'Not a valid number.' })
  }
  return n
}

// ---- inventory sessions ----

export const SESSION_STATUS_FILTERS = ['active', 'completed', 'archived', 'all']
export const ITEM_STATUS_FILTERS = ['scanned', 'pending']

const sessionName = z.string({ error: 'Session name is required.' }).trim()
  .min(1, 'Session name is required.').max(200, 'Keep the name under 200 characters.')
const columnName = z.string({ error: 'Column names must be text.' }).trim()
  .min(1).max(200, 'Keep column names under 200 characters.')
// Cell values arrive already stringified by the client's spreadsheet parser,
// but tolerate the JSON primitives a hand-built request might send too.
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()])
// z.record() rebuilds its output with ordinary property assignment, which
// silently drops a key literally named "__proto__" (assigning a string to
// the inherited __proto__ setter is a no-op) - a column with that header
// must still reach the service untouched. z.custom() passes the original
// object through by reference instead of rebuilding it; the service already
// coerces and length-checks every cell itself.
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const dataRow = z.custom(isPlainObject, { error: "Each row's data must be an object." })

export const sessionCreate = z.object({
  name: sessionName,
  department_id: uuidRef('Choose a department.').nullish(),
})

export const sessionUpdate = z.object({
  name: sessionName.optional(),
  // null resets to "show every column"; the DB caps at 100 (A4).
  display_columns: z.array(columnName, { error: 'Must be a list.' }).max(100).nullable().optional(),
})

export const sessionImport = z.object({
  columns: z.array(columnName, { error: 'columns must be a list.' }).max(100, 'At most 100 columns.'),
  display_columns: z.array(columnName).max(100).nullable().optional(),
  rows: z.array(z.object({
    line: z.number().int().min(2).max(1_048_576).optional(),
    item_code: cell.optional(),
    data: dataRow.optional(),
  }), { error: 'rows must be a list.' }).max(10_000, 'Import at most 10,000 rows at a time.'),
  commit: z.boolean().optional(),
})

export const clearItems = z.object({ confirm: z.literal('CLEAR', { error: 'Type CLEAR to confirm.' }) })

// ---- session deletion (Group 5) ----

export const sessionDelete = z.object({
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.'),
})

// ---- scanning ----

// The final 1-128 length check happens after JS-side normalisation
// (server/src/services/scans.js), which strips control characters a
// handheld scanner or camera decode can include - this only keeps an
// empty/absurdly long body from reaching that point.
export const scanCreate = z.object({
  code: z.string({ error: 'Enter an item code.' }).min(1, 'Enter an item code.').max(1000, 'That code is too long.'),
})

// ---- items (Inventory page, G4) ----

// Same length cap as session_items_code_trimmed (1-128) - normalised the
// same way as import: trimmed, and an empty value is refused rather than
// silently kept.
export const itemUpdate = z.object({
  item_code: z.string({ error: 'Item code is required.' }).trim()
    .min(1, 'Item code is required.').max(128, 'Keep the item code under 128 characters.').optional(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.null()]), { error: 'data must be an object.' }).optional(),
})
