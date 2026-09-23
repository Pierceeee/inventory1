// The guarantees that live in the database itself, tested against real Postgres.
import { useTestApi, freeDevice, activeEmployee, openAssignment, isOpen } from './support/api.js'

const t = useTestApi()

const openRow = (deviceId, employeeId) => t.db.query(
  'insert into assignments (device_id, employee_id) values ($1, $2) returning id', [deviceId, employeeId])

describe('the no-double-issue index', () => {
  test('refuses a second open assignment for the same device', async () => {
    const device = freeDevice(t.fx)
    await openRow(device.id, activeEmployee(t.fx).id)
    const err = await openRow(device.id, activeEmployee(t.fx, activeEmployee(t.fx).id).id).catch((e) => e)
    expect(err.code).toBe('23505')
    expect(err.constraint).toBe('one_open_assignment_per_device')
  })

  test('allows a new handout once the previous one is returned', async () => {
    const device = freeDevice(t.fx)
    const { rows: [first] } = await openRow(device.id, activeEmployee(t.fx).id)
    await t.db.query(
      `update assignments set returned_at = now(), return_reason = 'swap', returned_condition = 'good'
        where id = $1`, [first.id])
    await expect(openRow(device.id, activeEmployee(t.fx).id)).resolves.toBeTruthy()
  })
})

describe('check constraints', () => {
  test('a return can never precede its issue', async () => {
    const open = openAssignment(t.fx)
    const err = await t.db.query(
      `update assignments set returned_at = issued_at - interval '1 day',
              return_reason = 'swap', returned_condition = 'good' where id = $1`, [open.id]).catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('a return must record both its reason and its condition', async () => {
    const open = openAssignment(t.fx)
    const err = await t.db.query(
      `update assignments set returned_at = now(), return_reason = 'swap' where id = $1`, [open.id])
      .catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('"issued" is not a storable device status', async () => {
    const err = await t.db.query(
      `update devices set status = 'issued' where id = $1`, [t.fx.devices[0].id]).catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('asset tags are unique regardless of case', async () => {
    const err = await t.db.query(
      `insert into devices (asset_tag, type) values ($1, 'laptop')`,
      [t.fx.devices[0].asset_tag.toLowerCase()]).catch((e) => e)
    expect(err.constraint).toBe('devices_asset_tag_key')
  })

  test('a resigned employee must have a resignation date', async () => {
    const err = await t.db.query(
      `update employees set status = 'resigned' where id = $1`, [activeEmployee(t.fx).id]).catch((e) => e)
    expect(err.code).toBe('23514')
  })

  test('a department name must not have leading or trailing whitespace', async () => {
    const err = await t.db.query(`insert into departments (name) values (' Untrimmed ')`).catch((e) => e)
    expect(err.code).toBe('23514')
    expect(err.constraint).toBe('departments_name_trimmed')
  })
})

describe('schema hygiene', () => {
  test('updated_at moves on every update', async () => {
    const device = t.fx.devices[0]
    await t.db.query(`update devices set notes = 'x' where id = $1`, [device.id])
    const { rows: [after] } = await t.db.query('select updated_at from devices where id = $1', [device.id])
    expect(after.updated_at.getTime()).toBeGreaterThan(new Date(device.updated_at).getTime())
  })

  test('row level security is on for every table, closing the public REST API', async () => {
    const { rows } = await t.db.query(
      `select relname from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`)
    expect(rows).toEqual([])
  })

  test('the views never bypass row level security', async () => {
    const { rows } = await t.db.query(
      `select relname, reloptions from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'v'`)
    expect(rows.map((r) => r.relname).sort()).toEqual([
      'assignment_details', 'device_current_holder', 'inventory_session_summary', 'session_item_details',
    ])
    for (const row of rows) expect(row.reloptions).toContain('security_invoker=true')
  })
})

describe('fixtures', () => {
  test('have the shapes the tests depend on', () => {
    const open = t.fx.assignments.filter(isOpen)
    expect(new Set(open.map((a) => a.device_id)).size).toBe(open.length)
    const idle = t.fx.devices.filter((d) => d.status !== 'available')
    expect(idle.every((d) => !open.some((a) => a.device_id === d.id))).toBe(true)
    const resigned = t.fx.employees.filter((e) => e.status === 'resigned')
    expect(resigned.some((e) => open.some((a) => a.employee_id === e.id))).toBe(true)
    expect(t.fx.assignments.filter((a) => a.device_id === t.fx.devices[0].id)).toHaveLength(3)
  })
})
