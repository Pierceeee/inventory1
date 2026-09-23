import { z } from 'zod'
import { invalid } from './lib/errors.js'
import {
  CONDITIONS, DEVICE_STATUSES, DEVICE_TYPES, OS_VALUES, RETURN_REASONS,
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
