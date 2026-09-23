import { conflict, isUniqueViolation, notFound } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'

const EDITABLE = ['full_name', 'email', 'department']

const WITH_HELD_COUNT = `
  select e.*, count(a.id)::int as devices_held_count
    from employees e
    left join assignments a on a.employee_id = e.id and a.returned_at is null`

async function findEmployee(db, id) {
  if (!isUuid(id)) return undefined
  const { rows } = await db.query(`${WITH_HELD_COUNT} where e.id = $1 group by e.id`, [id])
  return rows[0]
}

async function requireEmployee(db, id) {
  const row = await findEmployee(db, id)
  if (!row) throw notFound('Employee')
  return row
}

export async function listEmployees(db, { status, q } = {}) {
  const needle = q ? q.toLowerCase() : null
  const { rows } = await db.query(
    `${WITH_HELD_COUNT}
      where ($1::text is null or e.status = $1)
        and ($2::text is null
             or strpos(lower(e.full_name), $2) > 0
             or strpos(lower(coalesce(e.email, '')), $2) > 0
             or strpos(lower(coalesce(e.department, '')), $2) > 0)
      group by e.id
      order by e.full_name`,
    [status ?? null, needle],
  )
  return rows
}

export async function getEmployee(db, id) {
  const employee = await requireEmployee(db, id)

  const [{ rows: held }, { rows: history }] = await Promise.all([
    db.query(
      `select a.id as assignment_id, a.issued_at, a.issued_condition, a.issued_accessories,
              d.id as device_id, d.asset_tag, d.type, d.brand, d.model, d.serial_number
         from assignments a
         join devices d on d.id = a.device_id
        where a.employee_id = $1 and a.returned_at is null
        order by a.issued_at`,
      [id],
    ),
    db.query(
      `select * from assignment_details
        where employee_id = $1
        order by issued_at desc, created_at desc`,
      [id],
    ),
  ])

  return { ...employee, devices_held: held, history }
}

export async function createEmployee(db, input) {
  try {
    const { rows } = await db.query(
      `insert into employees (full_name, email, department)
       values ($1, $2, $3)
       returning id`,
      [input.full_name, input.email || null, input.department || null],
    )
    return findEmployee(db, rows[0].id)
  } catch (err) {
    throw duplicateOr(err, input)
  }
}

export async function updateEmployee(db, id, patch) {
  const current = await requireEmployee(db, id)
  const keys = EDITABLE.filter((key) => key in patch)
  if (keys.length === 0) return current

  const values = keys.map((key) => (patch[key] === '' ? null : patch[key] ?? null))
  try {
    await db.query(
      `update employees set ${keys.map((key, i) => `${key} = $${i + 2}`).join(', ')} where id = $1`,
      [id, ...values],
    )
  } catch (err) {
    throw duplicateOr(err, patch)
  }
  return findEmployee(db, id)
}

/** Marks resigned. Deliberately does NOT close assignments (§5): the UI lists
 *  every device still held so each is returned explicitly and nothing quietly
 *  disappears from the record at offboarding. */
export async function resignEmployee(db, id) {
  await requireEmployee(db, id)
  await db.query(
    `update employees
        set status = 'resigned', resigned_at = coalesce(resigned_at, now())
      where id = $1`,
    [id],
  )
  return findEmployee(db, id)
}

function duplicateOr(err, input) {
  if (isUniqueViolation(err, 'employees_email_key')) {
    return conflict('DUPLICATE_EMAIL', `${input.email} is already registered.`,
      { email: 'Already in use.' })
  }
  return err
}
