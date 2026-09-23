import { conflict, isUniqueViolation, notFound } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'

export async function listDepartments(db) {
  const { rows } = await db.query(
    `select d.id, d.name, count(p.id)::int as user_count, d.created_at, d.updated_at
       from departments d
       left join profiles p on p.department_id = d.id
      group by d.id
      order by lower(d.name)`,
  )
  return rows
}

async function findDepartment(db, id) {
  if (!isUuid(id)) return undefined
  const { rows } = await db.query('select * from departments where id = $1', [id])
  return rows[0]
}

export async function departmentExists(db, id) {
  if (!isUuid(id)) return false
  const { rows } = await db.query('select 1 from departments where id = $1', [id])
  return rows.length > 0
}

export async function createDepartment(db, { name }) {
  try {
    const { rows } = await db.query(
      'insert into departments (name) values ($1) returning *', [name])
    return { ...rows[0], user_count: 0 }
  } catch (err) {
    throw duplicateOr(err, name)
  }
}

export async function updateDepartment(db, id, { name }) {
  const current = await findDepartment(db, id)
  if (!current) throw notFound('Department')

  try {
    await db.query('update departments set name = $2 where id = $1', [id, name])
  } catch (err) {
    throw duplicateOr(err, name)
  }
  const { rows: [department] } = await db.query(
    `select d.id, d.name, count(p.id)::int as user_count, d.created_at, d.updated_at
       from departments d
       left join profiles p on p.department_id = d.id
      where d.id = $1
      group by d.id`,
    [id],
  )
  return department
}

function duplicateOr(err, name) {
  if (isUniqueViolation(err, 'departments_name_key')) {
    return conflict('DUPLICATE_DEPARTMENT', `${name} already exists.`, { name: 'Already exists.' })
  }
  return err
}
