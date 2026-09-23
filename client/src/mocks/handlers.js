import { http, HttpResponse } from 'msw'
import {
  db, openAssignmentFor, openAssignmentsForEmployee,
  deviceById, employeeById, assignmentById, userById,
} from './db.js'
import { checkIssue, checkReturn } from './rules.js'

const ok = (data, status = 200) => HttpResponse.json({ data }, { status })
const fail = ({ status, code, message, details = {} }) =>
  HttpResponse.json({ error: { code, message, details } }, { status })
const notFound = (what) => fail({ status: 404, code: 'NOT_FOUND', message: `${what} not found.` })
const invalid = (details, message = 'Some fields need attention.') =>
  fail({ status: 400, code: 'VALIDATION_ERROR', message, details })

const nowIso = () => new Date().toISOString()
const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now()}`)
const norm = (s) => String(s ?? '').trim().toLowerCase()
const matches = (q, ...fields) => fields.some((f) => norm(f).includes(norm(q)))

const DEVICE_TYPES = ['laptop', 'mobile']
const DEVICE_STATUSES = ['available', 'repair', 'retired']
const OS_VALUES = ['macos', 'windows', 'ios', 'android']
const RETURN_REASONS = ['resignation', 'swap', 'repair', 'lost', 'other']
const CONDITIONS = ['good', 'fair', 'damaged']
export const ACCESSORIES_FOR = {
  laptop: ['charger', 'case', 'box'],
  mobile: ['charger', 'case', 'sim', 'box'],
}

/** Who is acting, resolved from the bearer token - never from the request body,
 *  or anyone could record a handout as a colleague. */
function actorFrom(request) {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token.startsWith('mock.')) return null
  return userById(token.slice('mock.'.length)) ?? null
}

const publicUser = (u) => (u ? { id: u.id, full_name: u.full_name, email: u.email } : null)

const cleanAccessories = (list, type) => {
  const allowed = ACCESSORIES_FOR[type] ?? []
  return Array.isArray(list) ? list.filter((a) => allowed.includes(a)) : []
}

// ---- serialisation: mirrors the device_current_holder view in §4 ----

function toDevice(device) {
  const open = openAssignmentFor(device.id)
  const holder = open ? employeeById(open.employee_id) : null
  return {
    ...device,
    current_holder: open && holder
      ? {
          assignment_id: open.id, employee_id: holder.id,
          full_name: holder.full_name, issued_at: open.issued_at,
          type: device.type,
          issued_condition: open.issued_condition ?? 'good',
          issued_accessories: open.issued_accessories ?? [],
        }
      : null,
  }
}

function toAssignment(a) {
  const device = deviceById(a.device_id)
  const employee = employeeById(a.employee_id)
  return {
    ...a,
    asset_tag: device?.asset_tag ?? null,
    device_model: device?.model ?? null,
    device_type: device?.type ?? null,
    employee_name: employee?.full_name ?? null,
    issued_by_name: publicUser(userById(a.issued_by))?.full_name ?? null,
    returned_by_name: publicUser(userById(a.returned_by))?.full_name ?? null,
  }
}

const newestFirst = (list) =>
  [...list].sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))

// ---- handlers ----

export const handlers = [
  http.get('*/api/health', () => ok({ status: 'ok' })),

  // --- auth: stands in for Supabase Auth, deleted at cutover ---

  http.post('*/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json()
    const user = db.users.find((u) => norm(u.email) === norm(email))
    // One message for both wrong-email and wrong-password: saying which is
    // wrong tells an attacker which addresses are real accounts.
    if (!user || user.password !== password) {
      return fail({ status: 401, code: 'INVALID_CREDENTIALS',
        message: 'That email and password do not match.' })
    }
    return ok({ token: `mock.${user.id}`, user: publicUser(user) })
  }),

  http.get('*/api/auth/me', ({ request }) => {
    const actor = actorFrom(request)
    if (!actor) return fail({ status: 401, code: 'UNAUTHENTICATED', message: 'Please sign in.' })
    return ok(publicUser(actor))
  }),

  // --- devices ---

  http.get('*/api/devices', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = db.devices.map(toDevice)
    if (p.get('type')) rows = rows.filter((d) => d.type === p.get('type'))
    if (p.get('status')) rows = rows.filter((d) => d.status === p.get('status'))
    if (p.get('held') === 'true') rows = rows.filter((d) => d.current_holder !== null)
    if (p.get('held') === 'false') rows = rows.filter((d) => d.current_holder === null)
    const q = p.get('q')
    if (norm(q)) {
      rows = rows.filter((d) => matches(q, d.asset_tag, d.serial_number, d.model, d.brand))
    }
    return ok(rows.sort((a, b) => a.asset_tag.localeCompare(b.asset_tag)))
  }),

  http.get('*/api/devices/:id', ({ params }) => {
    const device = deviceById(params.id)
    if (!device) return notFound('Device')
    const history = newestFirst(db.assignments.filter((a) => a.device_id === device.id))
    return ok({ ...toDevice(device), history: history.map(toAssignment) })
  }),

  http.post('*/api/devices', async ({ request }) => {
    const body = await request.json()
    const details = {}
    if (!String(body.asset_tag ?? '').trim()) details.asset_tag = 'Asset tag is required.'
    if (!DEVICE_TYPES.includes(body.type)) details.type = 'Choose laptop or mobile.'
    if (body.os && !OS_VALUES.includes(body.os)) details.os = 'Not a valid operating system.'
    if (body.status && !DEVICE_STATUSES.includes(body.status)) {
      details.status = 'Status must be available, repair, or retired.'
    }
    if (Object.keys(details).length) return invalid(details)

    if (db.devices.some((d) => norm(d.asset_tag) === norm(body.asset_tag))) {
      return fail({ status: 409, code: 'DUPLICATE_ASSET_TAG',
        message: `Asset tag ${body.asset_tag} is already in use.`,
        details: { asset_tag: 'Already in use.' } })
    }
    if (body.serial_number &&
        db.devices.some((d) => norm(d.serial_number) === norm(body.serial_number))) {
      return fail({ status: 409, code: 'DUPLICATE_SERIAL',
        message: `Serial number ${body.serial_number} is already in use.`,
        details: { serial_number: 'Already in use.' } })
    }

    const device = {
      id: uuid(),
      asset_tag: String(body.asset_tag).trim(),
      type: body.type,
      brand: body.brand || null,
      model: body.model || null,
      serial_number: body.serial_number || null,
      os: body.os ?? null,
      status: body.status ?? 'available',
      notes: body.notes || null,
      created_at: nowIso(), updated_at: nowIso(),
    }
    db.devices.push(device)
    return ok(toDevice(device), 201)
  }),

  http.patch('*/api/devices/:id', async ({ params, request }) => {
    const device = deviceById(params.id)
    if (!device) return notFound('Device')
    const body = await request.json()

    if (body.asset_tag && db.devices.some(
      (d) => d.id !== device.id && norm(d.asset_tag) === norm(body.asset_tag))) {
      return fail({ status: 409, code: 'DUPLICATE_ASSET_TAG',
        message: `Asset tag ${body.asset_tag} is already in use.`,
        details: { asset_tag: 'Already in use.' } })
    }
    if (body.serial_number && db.devices.some(
      (d) => d.id !== device.id && norm(d.serial_number) === norm(body.serial_number))) {
      return fail({ status: 409, code: 'DUPLICATE_SERIAL',
        message: `Serial number ${body.serial_number} is already in use.`,
        details: { serial_number: 'Already in use.' } })
    }

    for (const key of ['asset_tag', 'type', 'brand', 'model', 'serial_number', 'os', 'status', 'notes']) {
      if (key in body) device[key] = body[key]
    }
    device.updated_at = nowIso()
    return ok(toDevice(device))
  }),

  http.post('*/api/devices/:id/retire', ({ params }) => {
    const device = deviceById(params.id)
    if (!device) return notFound('Device')
    const open = openAssignmentFor(device.id)
    if (open) {
      const holder = employeeById(open.employee_id)
      return fail({ status: 409, code: 'DEVICE_ALREADY_ISSUED',
        message: `${device.asset_tag} is still held by ${holder?.full_name ?? 'an employee'}. Return it before retiring.`,
        details: { holder_name: holder?.full_name ?? null } })
    }
    device.status = 'retired'
    device.updated_at = nowIso()
    return ok(toDevice(device))
  }),

  // --- employees ---

  http.get('*/api/employees', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = [...db.employees]
    if (p.get('status')) rows = rows.filter((e) => e.status === p.get('status'))
    const q = p.get('q')
    if (norm(q)) rows = rows.filter((e) => matches(q, e.full_name, e.email, e.department))
    return ok(rows
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((e) => ({ ...e, devices_held_count: openAssignmentsForEmployee(e.id).length })))
  }),

  http.get('*/api/employees/:id', ({ params }) => {
    const employee = employeeById(params.id)
    if (!employee) return notFound('Employee')

    const devices_held = openAssignmentsForEmployee(employee.id).map((a) => {
      const d = deviceById(a.device_id)
      return {
        assignment_id: a.id, issued_at: a.issued_at,
        device_id: d.id, asset_tag: d.asset_tag, type: d.type,
        brand: d.brand, model: d.model, serial_number: d.serial_number,
        issued_condition: a.issued_condition ?? 'good',
        issued_accessories: a.issued_accessories ?? [],
      }
    })
    const history = newestFirst(db.assignments.filter((a) => a.employee_id === employee.id))
    return ok({ ...employee, devices_held, history: history.map(toAssignment) })
  }),

  http.post('*/api/employees', async ({ request }) => {
    const body = await request.json()
    const details = {}
    if (!String(body.full_name ?? '').trim()) details.full_name = 'Full name is required.'
    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) details.email = 'Not a valid email address.'
    if (Object.keys(details).length) return invalid(details)

    if (body.email && db.employees.some((e) => norm(e.email) === norm(body.email))) {
      return fail({ status: 409, code: 'DUPLICATE_EMAIL',
        message: `${body.email} is already registered.`,
        details: { email: 'Already in use.' } })
    }

    const employee = {
      id: uuid(),
      full_name: String(body.full_name).trim(),
      email: body.email || null,
      department: body.department || null,
      status: 'active', resigned_at: null,
      created_at: nowIso(), updated_at: nowIso(),
    }
    db.employees.push(employee)
    return ok({ ...employee, devices_held_count: 0 }, 201)
  }),

  http.patch('*/api/employees/:id', async ({ params, request }) => {
    const employee = employeeById(params.id)
    if (!employee) return notFound('Employee')
    const body = await request.json()

    if (body.email && db.employees.some(
      (e) => e.id !== employee.id && norm(e.email) === norm(body.email))) {
      return fail({ status: 409, code: 'DUPLICATE_EMAIL',
        message: `${body.email} is already registered.`,
        details: { email: 'Already in use.' } })
    }
    for (const key of ['full_name', 'email', 'department']) {
      if (key in body) employee[key] = body[key]
    }
    employee.updated_at = nowIso()
    return ok(employee)
  }),

  // Deliberately does NOT close assignments - §5. The UI surfaces them instead.
  http.post('*/api/employees/:id/resign', ({ params }) => {
    const employee = employeeById(params.id)
    if (!employee) return notFound('Employee')
    employee.status = 'resigned'
    employee.resigned_at = nowIso()
    employee.updated_at = nowIso()
    return ok(employee)
  }),

  // --- assignments ---

  http.get('*/api/assignments', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = [...db.assignments]
    if (p.get('device_id')) rows = rows.filter((a) => a.device_id === p.get('device_id'))
    if (p.get('employee_id')) rows = rows.filter((a) => a.employee_id === p.get('employee_id'))
    if (p.get('open') === 'true') rows = rows.filter((a) => a.returned_at === null)
    if (p.get('open') === 'false') rows = rows.filter((a) => a.returned_at !== null)
    if (p.get('from')) {
      const from = new Date(p.get('from')).getTime()
      rows = rows.filter((a) => new Date(a.issued_at).getTime() >= from)
    }
    if (p.get('to')) {
      const to = new Date(p.get('to')).getTime()
      rows = rows.filter((a) => new Date(a.issued_at).getTime() <= to)
    }
    return ok(newestFirst(rows).map(toAssignment))
  }),

  http.post('*/api/assignments', async ({ request }) => {
    const body = await request.json()
    const actor = actorFrom(request)
    const device = deviceById(body.device_id)
    const employee = employeeById(body.employee_id)
    const issuedAt = body.issued_at ?? nowIso()

    if (body.issued_at && Number.isNaN(new Date(body.issued_at).getTime())) {
      return invalid({ issued_at: 'Not a valid date.' })
    }
    if (body.issued_condition && !CONDITIONS.includes(body.issued_condition)) {
      return invalid({ issued_condition: 'Condition must be good, fair, or damaged.' })
    }

    const open = device ? openAssignmentFor(device.id) : undefined
    const holderName = open ? employeeById(open.employee_id)?.full_name : undefined
    const sameTypeHeld = device && employee
      ? openAssignmentsForEmployee(employee.id)
          .some((a) => deviceById(a.device_id)?.type === device.type)
      : false

    const verdict = checkIssue({ device, employee, issuedAt, openAssignment: open, holderName, sameTypeHeld })
    if (verdict.error) return fail(verdict.error)

    const assignment = {
      id: uuid(),
      device_id: device.id, employee_id: employee.id,
      issued_at: issuedAt, issued_by: actor?.id ?? null,
      returned_at: null, returned_by: null, return_reason: null,
      issued_condition: body.issued_condition ?? 'good',
      returned_condition: null,
      issued_accessories: cleanAccessories(body.issued_accessories, device.type),
      returned_accessories: null,
      notes: body.notes || null, created_at: nowIso(),
    }
    db.assignments.push(assignment)

    const payload = { data: toAssignment(assignment) }
    if (verdict.warning) payload.warning = verdict.warning
    return HttpResponse.json(payload, { status: 201 })
  }),

  http.post('*/api/assignments/:id/return', async ({ params, request }) => {
    const assignment = assignmentById(params.id)
    if (!assignment) return notFound('Assignment')
    const body = await request.json()
    const actor = actorFrom(request)

    const problems = {}
    if (!RETURN_REASONS.includes(body.return_reason)) {
      problems.return_reason = 'Choose a reason for the return.'
    }
    // Recording a return without its condition throws away the only evidence
    // an offboarding dispute can turn on, so it is required, not optional.
    if (!CONDITIONS.includes(body.returned_condition)) {
      problems.returned_condition = 'Record the condition it came back in.'
    }
    if (Object.keys(problems).length) return invalid(problems)
    const returnedAt = body.returned_at ?? nowIso()
    if (Number.isNaN(new Date(returnedAt).getTime())) {
      return invalid({ returned_at: 'Not a valid date.' })
    }

    const verdict = checkReturn({ assignment, returnedAt })
    if (verdict.error) return fail(verdict.error)

    const device = deviceById(assignment.device_id)
    assignment.returned_at = returnedAt
    assignment.returned_by = actor?.id ?? null
    assignment.return_reason = body.return_reason
    assignment.returned_condition = body.returned_condition
    assignment.returned_accessories = cleanAccessories(body.returned_accessories, device?.type)
    if (body.notes) assignment.notes = body.notes
    return ok(toAssignment(assignment))
  }),

  // --- dashboard ---

  http.get('*/api/dashboard', () => {
    const devices = db.devices.map(toDevice)
    const issued = devices.filter((d) => d.current_holder !== null)
    const byType = DEVICE_TYPES.map((type) => {
      const of = devices.filter((d) => d.type === type)
      return {
        type,
        total: of.length,
        issued: of.filter((d) => d.current_holder !== null).length,
        available: of.filter((d) => d.current_holder === null && d.status === 'available').length,
      }
    })
    return ok({
      totals: {
        devices: devices.length,
        issued: issued.length,
        available: devices.filter((d) => d.current_holder === null && d.status === 'available').length,
        repair: devices.filter((d) => d.status === 'repair').length,
        retired: devices.filter((d) => d.status === 'retired').length,
        employees: db.employees.filter((e) => e.status === 'active').length,
      },
      by_type: byType,
      // Things a person should act on, computed once here rather than by the UI
      // walking every employee. §5 lets a resigned person still hold devices.
      attention: {
        resigned_holding: db.employees
          .filter((e) => e.status === 'resigned' && openAssignmentsForEmployee(e.id).length > 0)
          .map((e) => ({
            employee_id: e.id,
            full_name: e.full_name,
            resigned_at: e.resigned_at,
            devices: openAssignmentsForEmployee(e.id).map((a) => ({
              assignment_id: a.id,
              device_id: a.device_id,
              asset_tag: deviceById(a.device_id)?.asset_tag ?? null,
              issued_at: a.issued_at,
            })),
          })),
        in_repair: devices
          .filter((d) => d.status === 'repair')
          .map((d) => ({ device_id: d.id, asset_tag: d.asset_tag, model: d.model })),
        unassigned_staff: db.employees
          .filter((e) => e.status === 'active' && openAssignmentsForEmployee(e.id).length === 0)
          .map((e) => ({ employee_id: e.id, full_name: e.full_name, department: e.department })),
      },
      holders: issued.map((d) => ({
        device_id: d.id, asset_tag: d.asset_tag, type: d.type, model: d.model,
        employee_id: d.current_holder.employee_id,
        holder_name: d.current_holder.full_name,
        issued_at: d.current_holder.issued_at,
      })).sort((a, b) => a.holder_name.localeCompare(b.holder_name)),
    })
  }),

  // --- CSV export (§6) ---

  http.get('*/api/export/assignments', ({ request }) => {
    const p = new URL(request.url).searchParams
    let rows = [...db.assignments]
    if (p.get('from')) {
      const from = new Date(p.get('from')).getTime()
      rows = rows.filter((a) => new Date(a.issued_at).getTime() >= from)
    }
    if (p.get('to')) {
      const to = new Date(p.get('to')).getTime()
      rows = rows.filter((a) => new Date(a.issued_at).getTime() <= to)
    }
    if (p.get('open') === 'true') rows = rows.filter((a) => a.returned_at === null)
    if (p.get('open') === 'false') rows = rows.filter((a) => a.returned_at !== null)

    const header = [
      'asset_tag', 'device_type', 'brand', 'model', 'serial_number',
      'employee_name', 'employee_email', 'department',
      'issued_at', 'returned_at', 'return_reason', 'notes',
    ]
    // Quote every field and double any embedded quote: a model name with a
    // comma in it must not silently become two columns.
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const body = newestFirst(rows).map((a) => {
      const d = deviceById(a.device_id)
      const e = employeeById(a.employee_id)
      return [
        d?.asset_tag, d?.type, d?.brand, d?.model, d?.serial_number,
        e?.full_name, e?.email, e?.department,
        a.issued_at, a.returned_at, a.return_reason, a.notes,
      ].map(cell).join(',')
    })

    const csv = [header.join(','), ...body].join('\n')
    return new HttpResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="handouts.csv"',
      },
    })
  }),

  // --- CSV import (dry-run + commit) ---

  http.post('*/api/import/devices', async ({ request }) => {
    const { rows = [], commit = false } = await request.json()
    const result = { created: 0, skipped: 0, errors: [] }
    const seenTags = new Set(db.devices.map((d) => norm(d.asset_tag)))

    rows.forEach((row, index) => {
      const line = index + 2                                   // +1 header, +1 to 1-index
      if (!String(row.asset_tag ?? '').trim()) {
        result.errors.push({ line, field: 'asset_tag', message: 'Asset tag is required.' })
        return
      }
      if (!DEVICE_TYPES.includes(row.type)) {
        result.errors.push({ line, field: 'type', message: 'Type must be laptop or mobile.' })
        return
      }
      if (seenTags.has(norm(row.asset_tag))) {
        result.skipped += 1
        result.errors.push({ line, field: 'asset_tag',
          message: `${row.asset_tag} already exists - skipped.` })
        return
      }
      seenTags.add(norm(row.asset_tag))
      result.created += 1
      if (commit) {
        db.devices.push({
          id: uuid(), asset_tag: String(row.asset_tag).trim(), type: row.type,
          brand: row.brand || null, model: row.model || null,
          serial_number: row.serial_number || null,
          os: OS_VALUES.includes(row.os) ? row.os : null,
          status: 'available', notes: row.notes || null,
          created_at: nowIso(), updated_at: nowIso(),
        })
      }
    })
    return ok(result)
  }),

  http.post('*/api/import/employees', async ({ request }) => {
    const { rows = [], commit = false } = await request.json()
    const result = { created: 0, skipped: 0, errors: [] }
    const seenEmails = new Set(db.employees.map((e) => norm(e.email)).filter(Boolean))

    rows.forEach((row, index) => {
      const line = index + 2
      if (!String(row.full_name ?? '').trim()) {
        result.errors.push({ line, field: 'full_name', message: 'Full name is required.' })
        return
      }
      if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) {
        result.errors.push({ line, field: 'email', message: 'Not a valid email address.' })
        return
      }
      if (row.email && seenEmails.has(norm(row.email))) {
        result.skipped += 1
        result.errors.push({ line, field: 'email', message: `${row.email} already exists - skipped.` })
        return
      }
      if (row.email) seenEmails.add(norm(row.email))
      result.created += 1
      if (commit) {
        db.employees.push({
          id: uuid(), full_name: String(row.full_name).trim(),
          email: row.email || null, department: row.department || null,
          status: 'active', resigned_at: null,
          created_at: nowIso(), updated_at: nowIso(),
        })
      }
    })
    return ok(result)
  }),
]
