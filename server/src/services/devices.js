import { conflict, isUniqueViolation, notFound } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'

const EDITABLE = ['asset_tag', 'type', 'brand', 'model', 'serial_number', 'os', 'status', 'notes']

/** A row of the device_current_holder view -> the API's device shape, with
 *  "issued" expressed as a current_holder object rather than a status. */
export function toDevice(row) {
  const {
    assignment_id, issued_at, issued_condition, issued_accessories, holder_id, holder_name,
    ...device
  } = row
  return {
    ...device,
    current_holder: assignment_id
      ? {
          assignment_id,
          employee_id: holder_id,
          full_name: holder_name,
          issued_at,
          type: device.type,
          issued_condition,
          issued_accessories,
        }
      : null,
  }
}

export async function findDeviceRow(db, id) {
  if (!isUuid(id)) return undefined
  const { rows } = await db.query('select * from device_current_holder where id = $1', [id])
  return rows[0]
}

async function requireDeviceRow(db, id) {
  const row = await findDeviceRow(db, id)
  if (!row) throw notFound('Device')
  return row
}

export async function listDevices(db, { type, status, held, q } = {}) {
  const needle = q ? q.toLowerCase() : null
  const { rows } = await db.query(
    `select * from device_current_holder
      where ($1::text is null or type = $1)
        and ($2::text is null or status = $2)
        and ($3::boolean is null or (assignment_id is not null) = $3)
        and ($4::text is null
             or strpos(lower(asset_tag), $4) > 0
             or strpos(lower(coalesce(serial_number, '')), $4) > 0
             or strpos(lower(coalesce(model, '')), $4) > 0
             or strpos(lower(coalesce(brand, '')), $4) > 0)
      order by asset_tag`,
    [type ?? null, status ?? null, held ?? null, needle],
  )
  return rows.map(toDevice)
}

export async function getDevice(db, id) {
  const row = await requireDeviceRow(db, id)
  const { rows: history } = await db.query(
    `select * from assignment_details
      where device_id = $1
      order by issued_at desc, created_at desc`,
    [id],
  )
  return { ...toDevice(row), history }
}

export async function createDevice(db, input) {
  try {
    const { rows } = await db.query(
      `insert into devices (asset_tag, type, brand, model, serial_number, os, status, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        input.asset_tag, input.type, input.brand || null, input.model || null,
        input.serial_number || null, input.os ?? null, input.status ?? 'available',
        input.notes || null,
      ],
    )
    return toDevice(await findDeviceRow(db, rows[0].id))
  } catch (err) {
    throw duplicateOr(err, input)
  }
}

export async function updateDevice(db, id, patch) {
  const current = await requireDeviceRow(db, id)

  // Moving a device someone is holding into repair or retirement would leave
  // it "issued" and "in repair" at once. The return comes first.
  if (current.assignment_id && patch.status && patch.status !== 'available') {
    throw stillHeld(current, 'changing its status')
  }

  const keys = EDITABLE.filter((key) => key in patch)
  if (keys.length === 0) return toDevice(current)

  const values = keys.map((key) => {
    const v = patch[key]
    return v === '' ? null : v ?? null
  })
  try {
    await db.query(
      `update devices set ${keys.map((key, i) => `${key} = $${i + 2}`).join(', ')} where id = $1`,
      [id, ...values],
    )
  } catch (err) {
    throw duplicateOr(err, patch)
  }
  return toDevice(await findDeviceRow(db, id))
}

export async function retireDevice(db, id) {
  const current = await requireDeviceRow(db, id)
  if (current.assignment_id) throw stillHeld(current, 'retiring')

  // Guarded so a handout that lands between the check above and this write
  // cannot leave a retired device on someone's desk.
  const { rowCount } = await db.query(
    `update devices set status = 'retired'
      where id = $1
        and not exists (select 1 from assignments where device_id = $1 and returned_at is null)`,
    [id],
  )
  const after = await findDeviceRow(db, id)
  if (rowCount === 0) throw stillHeld(after, 'retiring')
  return toDevice(after)
}

function stillHeld(row, action) {
  const holder = row.holder_name ?? 'an employee'
  return conflict('DEVICE_ALREADY_ISSUED',
    `${row.asset_tag} is still held by ${holder}. Return it before ${action}.`,
    { holder_name: row.holder_name ?? null })
}

/** The unique indexes are the only duplicate check, so a race between two
 *  saves produces exactly the same response as an ordinary duplicate. */
function duplicateOr(err, input) {
  if (isUniqueViolation(err, 'devices_asset_tag_key')) {
    return conflict('DUPLICATE_ASSET_TAG', `Asset tag ${input.asset_tag} is already in use.`,
      { asset_tag: 'Already in use.' })
  }
  if (isUniqueViolation(err, 'devices_serial_number_key')) {
    return conflict('DUPLICATE_SERIAL', `Serial number ${input.serial_number} is already in use.`,
      { serial_number: 'Already in use.' })
  }
  return err
}
