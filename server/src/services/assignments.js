import { conflict, invalid, isUniqueViolation, notFound } from '../lib/errors.js'
import { cleanAccessories, isUuid } from '../lib/values.js'
import { upsertProfile } from './profiles.js'

/** Handout times are stamped by the browser's clock. Tolerate a few minutes of
 *  drift so "now" on a slightly fast PC is not refused as the future. */
export const CLOCK_SKEW_MS = 5 * 60_000

// Rows of the assignment_details view are already the API's assignment shape.

async function getAssignment(db, id) {
  const { rows } = await db.query('select * from assignment_details where id = $1', [id])
  return rows[0]
}

export async function listAssignments(db, { device_id, employee_id, open, from, to } = {}) {
  // A malformed id matches nothing; it is not worth a 400.
  if ((device_id && !isUuid(device_id)) || (employee_id && !isUuid(employee_id))) return []

  const { rows } = await db.query(
    `select * from assignment_details
      where ($1::uuid is null or device_id = $1)
        and ($2::uuid is null or employee_id = $2)
        and ($3::boolean is null or (returned_at is null) = $3)
        and ($4::timestamptz is null or issued_at >= $4)
        and ($5::timestamptz is null or issued_at <= $5)
      order by issued_at desc, created_at desc`,
    [device_id ?? null, employee_id ?? null, open ?? null, from ?? null, to ?? null],
  )
  return rows
}

function alreadyIssued(device) {
  return conflict('DEVICE_ALREADY_ISSUED',
    `${device.asset_tag} is already held by ${device.holder_name ?? 'another employee'}.`,
    { holder_name: device.holder_name ?? null, assignment_id: device.assignment_id ?? null })
}

/**
 * Issue a device (§5). Every rule except one is a read-then-check guardrail
 * against user error. The one that must hold under races - a device has at
 * most one open assignment - is the partial unique index: a concurrent second
 * issue fails the INSERT with 23505, and that is translated into exactly the
 * same 409 the checked path produces.
 *
 * Resolves to { data, warning? }. Holding another device of the same type is
 * a warning, never a refusal: swaps and loaners overlap legitimately.
 */
export async function issueDevice(db, input, actor) {
  const [device, employee] = await Promise.all([
    isUuid(input.device_id)
      ? db.query('select * from device_current_holder where id = $1', [input.device_id]).then((r) => r.rows[0])
      : undefined,
    isUuid(input.employee_id)
      ? db.query('select * from employees where id = $1', [input.employee_id]).then((r) => r.rows[0])
      : undefined,
  ])

  if (!device) throw notFound('Device')
  if (!employee) throw notFound('Employee')
  if (device.assignment_id) throw alreadyIssued(device)
  if (device.status === 'retired') {
    throw conflict('DEVICE_RETIRED', `${device.asset_tag} is retired and cannot be issued.`)
  }
  if (device.status === 'repair') {
    throw conflict('DEVICE_IN_REPAIR', `${device.asset_tag} is in repair. Return it from repair first.`)
  }
  if (employee.status === 'resigned') {
    throw conflict('EMPLOYEE_RESIGNED',
      `${employee.full_name} has resigned and cannot be issued devices.`)
  }

  const issuedAt = input.issued_at ? new Date(input.issued_at) : new Date()
  if (issuedAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw invalid({ issued_at: 'Must not be in the future.' },
      'The handout date cannot be in the future.')
  }

  const { rows: sameType } = await db.query(
    `select 1 from assignments a
       join devices d on d.id = a.device_id
      where a.employee_id = $1 and a.returned_at is null and d.type = $2
      limit 1`,
    [employee.id, device.type],
  )

  if (actor) await upsertProfile(db, actor)

  let id
  try {
    const { rows } = await db.query(
      `insert into assignments
         (device_id, employee_id, issued_at, issued_by, issued_condition, issued_accessories, notes)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [
        device.id, employee.id, issuedAt, actor?.id ?? null,
        input.issued_condition ?? 'good',
        cleanAccessories(input.issued_accessories, device.type),
        input.notes || null,
      ],
    )
    id = rows[0].id
  } catch (err) {
    if (isUniqueViolation(err, 'one_open_assignment_per_device')) {
      // Lost the race: someone else issued it between our check and this insert.
      const { rows } = await db.query('select * from device_current_holder where id = $1', [device.id])
      throw alreadyIssued(rows[0] ?? device)
    }
    throw err
  }

  const data = await getAssignment(db, id)
  if (sameType.length === 0) return { data }
  return {
    data,
    warning: {
      code: 'SAME_TYPE_ALREADY_HELD',
      message: `${employee.full_name} already holds another ${device.type}.`,
    },
  }
}

/**
 * Return a device (§5). A worse condition or fewer accessories than it went
 * out with is recorded, never refused - that is exactly what the fields exist
 * to capture. The UPDATE only matches an open assignment, so a concurrent
 * second return touches zero rows and gets the same 409 as the checked path.
 */
export async function returnDevice(db, id, input, actor) {
  if (!isUuid(id)) throw notFound('Assignment')
  const { rows } = await db.query(
    `select a.*, d.type as device_type
       from assignments a join devices d on d.id = a.device_id
      where a.id = $1`,
    [id],
  )
  const assignment = rows[0]
  if (!assignment) throw notFound('Assignment')
  if (assignment.returned_at) throw alreadyReturned()

  const returnedAt = input.returned_at ? new Date(input.returned_at) : new Date()
  if (returnedAt.getTime() < new Date(assignment.issued_at).getTime()) {
    throw invalid({ returned_at: 'Must not be before the handout date.' },
      'The return date cannot be before the handout date.')
  }
  if (returnedAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw invalid({ returned_at: 'Must not be in the future.' },
      'The return date cannot be in the future.')
  }

  if (actor) await upsertProfile(db, actor)

  const { rowCount } = await db.query(
    `update assignments
        set returned_at = $2,
            returned_by = $3,
            return_reason = $4,
            returned_condition = $5,
            returned_accessories = $6,
            notes = coalesce($7, notes)
      where id = $1 and returned_at is null`,
    [
      id, returnedAt, actor?.id ?? null, input.return_reason, input.returned_condition,
      cleanAccessories(input.returned_accessories, assignment.device_type),
      input.notes || null,
    ],
  )
  if (rowCount === 0) throw alreadyReturned()

  return getAssignment(db, id)
}

const alreadyReturned = () =>
  conflict('ASSIGNMENT_ALREADY_RETURNED', 'This device has already been returned.')
