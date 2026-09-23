// npm run db:seed / db:seed:remove, against real Postgres.
import { createTestDb, emptyDb } from './support/testDb.js'
import { buildExampleData, removeExampleData, seedExampleData } from '../src/db/exampleData.js'

let db
beforeAll(async () => { db = await createTestDb() })
beforeEach(() => emptyDb(db))
afterAll(() => db.close())

const count = async (table) =>
  (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n
const example = buildExampleData()

test('loads every example row into an empty database', async () => {
  const result = await seedExampleData(db)
  expect(result).toEqual({
    status: 'loaded',
    devices: example.devices.length,
    employees: example.employees.length,
    handouts: example.assignments.length,
    departments: example.departments.length,
    sessions: example.sessions.length,
    items: example.items.length,
    scans: example.scans.length,
  })
  expect(await count('devices')).toBe(example.devices.length)
  expect(await count('assignments')).toBe(example.assignments.length)
  expect(await count('departments')).toBe(example.departments.length)
  expect(await count('inventory_sessions')).toBe(example.sessions.length)
  expect(await count('session_items')).toBe(example.items.length)
  expect(await count('scan_events')).toBe(example.scans.length)
})

test('loads the example departments and every staff role', async () => {
  await seedExampleData(db)
  const { rows: departments } = await db.query('select name from departments order by name')
  expect(departments.map((d) => d.name)).toEqual(
    [...example.departments.map((d) => d.name)].sort())

  const { rows: staff } = await db.query('select email, role from profiles order by email')
  const roleOf = (email) => example.staff.find((s) => s.email === email).role
  for (const row of staff) expect(row.role).toBe(roleOf(row.email))
  expect(new Set(staff.map((s) => s.role))).toEqual(new Set(['admin', 'head', 'scanner']))
})

test('loading twice does not duplicate anything', async () => {
  await seedExampleData(db)
  expect(await seedExampleData(db)).toEqual({ status: 'already-loaded' })
  expect(await count('devices')).toBe(example.devices.length)
})

test('refuses, writing nothing, when real records use example tags or emails', async () => {
  await db.query(`insert into devices (asset_tag, type) values ('asp-0007', 'laptop')`)
  await db.query(`insert into employees (full_name, email) values ('Real Maria', 'MARIA.SANTOS@adspark.ph')`)

  const result = await seedExampleData(db)

  expect(result.status).toBe('clash')
  expect(result.clashes).toEqual([
    { kind: 'device', label: 'asp-0007' },
    { kind: 'employee', label: 'MARIA.SANTOS@adspark.ph' },
  ])
  expect(await count('devices')).toBe(1)
  expect(await count('employees')).toBe(1)
  expect(await count('profiles')).toBe(0)
  expect(await count('departments')).toBe(0)
})

test('refuses, writing nothing, when a real department already uses an example name', async () => {
  await db.query(`insert into departments (name) values ('it (example)')`)

  const result = await seedExampleData(db)

  expect(result.status).toBe('clash')
  expect(result.clashes).toEqual([{ kind: 'department', label: 'it (example)' }])
  expect(await count('departments')).toBe(1)
  expect(await count('devices')).toBe(0)
})

test('removal takes out the example rows and leaves real ones', async () => {
  await seedExampleData(db)
  const { rows: [realDevice] } = await db.query(
    `insert into devices (asset_tag, type) values ('REAL-1', 'laptop') returning id`)
  const { rows: [realPerson] } = await db.query(
    `insert into employees (full_name) values ('Real Person') returning id`)
  await db.query('insert into assignments (device_id, employee_id) values ($1, $2)',
    [realDevice.id, realPerson.id])

  const removed = await removeExampleData(db)

  expect(removed).toEqual({
    devices: example.devices.length,
    employees: example.employees.length,
    handouts: example.assignments.length,
    yourHandouts: 0,
    departments: example.departments.length,
    sessions: example.sessions.length,
  })
  expect((await db.query('select asset_tag from devices')).rows).toEqual([{ asset_tag: 'REAL-1' }])
  expect((await db.query('select full_name from employees')).rows).toEqual([{ full_name: 'Real Person' }])
  expect(await count('assignments')).toBe(1)
  expect(await count('profiles')).toBe(0)
  expect(await count('departments')).toBe(0)
  expect(await count('inventory_sessions')).toBe(0)
  expect(await count('session_items')).toBe(0)
})

test('removal takes out example sessions with their items and scan history', async () => {
  await seedExampleData(db)
  const removed = await removeExampleData(db)
  expect(removed.sessions).toBe(example.sessions.length)
  expect(await count('inventory_sessions')).toBe(0)
  expect(await count('session_items')).toBe(0)
  expect(await count('scan_events')).toBe(0)
})

test('removal keeps an example department a real session uses', async () => {
  await seedExampleData(db)
  const creativeDepartment = example.departments.find((d) => d.name.startsWith('Creative'))
  const { rows: [realProfile] } = await db.query(
    `insert into profiles (id, email, full_name)
     values (gen_random_uuid(), 'real.session.owner@adspark.ph', 'Real Owner') returning id`)
  await db.query(
    `insert into inventory_sessions (id, name, department_id, created_by)
     values (gen_random_uuid(), 'Real Session', $1, $2)`,
    [creativeDepartment.id, realProfile.id],
  )

  const removed = await removeExampleData(db)

  expect(removed.departments).toBe(example.departments.length - 1)
  const { rows } = await db.query('select name from departments')
  expect(rows).toEqual([{ name: creativeDepartment.name }])
})

test('removal keeps an example department a real account still belongs to', async () => {
  await seedExampleData(db)
  const itDepartment = example.departments.find((d) => d.name.startsWith('IT'))
  await db.query(
    `insert into profiles (id, email, full_name, department_id)
     values (gen_random_uuid(), 'real.person@adspark.ph', 'Real Person', $1)`,
    [itDepartment.id],
  )

  const removed = await removeExampleData(db)

  expect(removed.departments).toBe(example.departments.length - 1)
  const { rows } = await db.query('select name from departments')
  expect(rows).toEqual([{ name: itDepartment.name }])
})

test('removal keeps an example staff member who scanned an item in a real session', async () => {
  await seedExampleData(db)
  const tess = example.staff.find((s) => s.email === 'tess@adspark.ph')
  const itDepartment = example.departments.find((d) => d.name.startsWith('IT'))
  const { rows: [realSession] } = await db.query(
    `insert into inventory_sessions (id, name, department_id) values (gen_random_uuid(), 'Real Session', $1) returning id`,
    [itDepartment.id],
  )
  await db.query(
    `insert into scan_events (session_id, item_code, outcome, actor) values ($1, 'REAL-1', 'not_found', $2)`,
    [realSession.id, tess.id],
  )

  const removed = await removeExampleData(db)

  // Tess's example department is still referenced by the real session too -
  // both survive removal because of the same real row.
  expect(removed.departments).toBe(example.departments.length - 1)
  const { rows } = await db.query('select email from profiles where email = $1', [tess.email])
  expect(rows).toEqual([{ email: tess.email }])
})

test('a real handout involving an example device goes too, and is reported', async () => {
  await seedExampleData(db)
  const { rows: [realPerson] } = await db.query(
    `insert into employees (full_name) values ('Real Person') returning id`)
  const freeExampleDevice = example.devices.find((d) => d.status === 'available' &&
    !example.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
  await db.query('insert into assignments (device_id, employee_id) values ($1, $2)',
    [freeExampleDevice.id, realPerson.id])

  const removed = await removeExampleData(db)

  expect(removed.yourHandouts).toBe(1)
  expect(await count('assignments')).toBe(0)
  expect(await count('employees')).toBe(1)
})

test('removing from a database with no example data changes nothing', async () => {
  await db.query(`insert into devices (asset_tag, type) values ('REAL-1', 'laptop')`)
  expect(await removeExampleData(db)).toEqual({
    devices: 0, employees: 0, handouts: 0, yourHandouts: 0, departments: 0, sessions: 0,
  })
  expect(await count('devices')).toBe(1)
})
