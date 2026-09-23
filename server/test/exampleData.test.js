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
  })
  expect(await count('devices')).toBe(example.devices.length)
  expect(await count('assignments')).toBe(example.assignments.length)
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
  })
  expect((await db.query('select asset_tag from devices')).rows).toEqual([{ asset_tag: 'REAL-1' }])
  expect((await db.query('select full_name from employees')).rows).toEqual([{ full_name: 'Real Person' }])
  expect(await count('assignments')).toBe(1)
  expect(await count('profiles')).toBe(0)
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
  expect(await removeExampleData(db)).toEqual({ devices: 0, employees: 0, handouts: 0, yourHandouts: 0 })
  expect(await count('devices')).toBe(1)
})
