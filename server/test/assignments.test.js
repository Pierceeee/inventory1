// §5 of the spec: every business rule for issuing and returning, each as a named test.
import {
  useTestApi, freeDevice, activeEmployee, idleEmployee, openAssignment, openFor, isOpen,
} from './support/api.js'

const t = useTestApi()

const PAST = '2026-01-15T01:00:00.000Z'
const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString()
const issue = (body, as = t.api) => as.post('/api/assignments', body)
const giveBack = (id, body) => t.api.post(`/api/assignments/${id}/return`,
  { return_reason: 'swap', returned_condition: 'good', ...body })

describe('issuing a device', () => {
  test('a clean issue returns 201 with the denormalised handout and no warning', async () => {
    const device = freeDevice(t.fx, 'laptop')
    const employee = idleEmployee(t.fx)
    const res = await issue({ device_id: device.id, employee_id: employee.id, issued_at: PAST })

    expect(res.status).toBe(201)
    expect(res.body.warning).toBeUndefined()
    expect(res.body.data).toMatchObject({
      device_id: device.id, employee_id: employee.id, asset_tag: device.asset_tag,
      device_type: 'laptop', device_model: device.model, employee_name: employee.full_name,
      issued_at: PAST, returned_at: null, issued_condition: 'good', returned_condition: null,
    })
  })

  test('issued_at defaults to now', async () => {
    const before = Date.now()
    const res = await issue({ device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id })
    expect(new Date(res.body.data.issued_at).getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  test('a device already out is refused and the response names the holder', async () => {
    const open = openAssignment(t.fx)
    const holder = t.fx.employees.find((e) => e.id === open.employee_id)
    const res = await issue({ device_id: open.device_id, employee_id: idleEmployee(t.fx).id })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DEVICE_ALREADY_ISSUED')
    expect(res.body.error.details.holder_name).toBe(holder.full_name)
    expect(res.body.error.message).toContain(holder.full_name)
  })

  test('a retired device is refused', async () => {
    const retired = t.fx.devices.find((d) => d.status === 'retired')
    const res = await issue({ device_id: retired.id, employee_id: idleEmployee(t.fx).id })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DEVICE_RETIRED')
  })

  test('a device in repair is refused', async () => {
    const inRepair = t.fx.devices.find((d) => d.status === 'repair')
    const res = await issue({ device_id: inRepair.id, employee_id: idleEmployee(t.fx).id })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DEVICE_IN_REPAIR')
  })

  test('a resigned employee is refused', async () => {
    const resigned = t.fx.employees.find((e) => e.status === 'resigned')
    const res = await issue({ device_id: freeDevice(t.fx).id, employee_id: resigned.id })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMPLOYEE_RESIGNED')
  })

  test('a future issued_at is a 400 naming the field', async () => {
    const res = await issue({
      device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id, issued_at: FUTURE(),
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.issued_at).toMatch(/future/i)
  })

  test('a minute of clock drift on the recording PC is not treated as the future', async () => {
    const res = await issue({
      device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id,
      issued_at: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(res.status).toBe(201)
  })

  test('an unparseable issued_at is a 400', async () => {
    const res = await issue({
      device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id, issued_at: 'yesterday-ish',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.details.issued_at).toBeTruthy()
  })

  test('holding a device of the same type succeeds with a warning, not an error', async () => {
    const open = t.fx.assignments.find((a) => isOpen(a) &&
      t.fx.employees.find((e) => e.id === a.employee_id).status === 'active')
    const heldType = t.fx.devices.find((d) => d.id === open.device_id).type
    const res = await issue({ device_id: freeDevice(t.fx, heldType).id, employee_id: open.employee_id })

    expect(res.status).toBe(201)
    expect(res.body.warning.code).toBe('SAME_TYPE_ALREADY_HELD')
    expect(res.body.data.id).toEqual(expect.any(String))
  })

  test('a hard rule beats the same-type warning', async () => {
    const open = openAssignment(t.fx)
    const retired = t.fx.devices.find((d) => d.status === 'retired')
    const res = await issue({ device_id: retired.id, employee_id: open.employee_id })
    expect(res.body.error.code).toBe('DEVICE_RETIRED')
    expect(res.body.warning).toBeUndefined()
  })

  test('an unknown or malformed device id is a 404', async () => {
    for (const deviceId of ['nope', '00000000-0000-4000-8000-000000000000']) {
      const res = await issue({ device_id: deviceId, employee_id: idleEmployee(t.fx).id })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
  })

  test('an unknown employee is a 404', async () => {
    const res = await issue({ device_id: freeDevice(t.fx).id, employee_id: 'nope' })
    expect(res.status).toBe(404)
  })

  test('missing ids are a 400 naming both fields', async () => {
    const res = await issue({})
    expect(res.status).toBe(400)
    expect(res.body.error.details).toMatchObject({
      device_id: expect.any(String), employee_id: expect.any(String),
    })
  })

  test('accessories are tokens for the device type; anything else is dropped', async () => {
    const res = await issue({
      device_id: freeDevice(t.fx, 'laptop').id, employee_id: idleEmployee(t.fx).id,
      issued_accessories: ['charger', 'unicorn', 'sim', 'charger'],
    })
    expect(res.body.data.issued_accessories).toEqual(['charger'])
  })

  test('an invalid condition is refused', async () => {
    const res = await issue({
      device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id, issued_condition: 'pristine',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.details.issued_condition).toBeTruthy()
  })

  test('issued_by comes from the token, never the body', async () => {
    const rina = t.as('rina@adspark.ph')
    const res = await issue({
      device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id,
      issued_by: '00000000-0000-4000-8000-000000000999',
    }, rina)
    expect(res.status).toBe(201)
    expect(res.body.data.issued_by).toBe(t.auth.sessionFor('rina@adspark.ph').user.id)
    expect(res.body.data.issued_by_name).toBe('Rina Delgado')
  })

  // Non-negotiable per §9: exactly one success and one 409.
  test('two concurrent issues of one device produce exactly one 201 and one 409', async () => {
    const device = freeDevice(t.fx)
    const first = activeEmployee(t.fx)
    const second = activeEmployee(t.fx, first.id)

    const results = await Promise.all([
      issue({ device_id: device.id, employee_id: first.id }),
      issue({ device_id: device.id, employee_id: second.id }),
    ])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    const refused = results.find((r) => r.status === 409)
    expect(refused.body.error.code).toBe('DEVICE_ALREADY_ISSUED')
    await t.refresh()
    expect(t.fx.assignments.filter((a) => a.device_id === device.id && isOpen(a))).toHaveLength(1)
  })

  test('ten concurrent issues of one device still produce exactly one handout', async () => {
    const device = freeDevice(t.fx)
    const people = t.fx.employees.filter((e) => e.status === 'active').slice(0, 10)
    const results = await Promise.all(
      people.map((p) => issue({ device_id: device.id, employee_id: p.id })))
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(9)
  })
})

describe('returning a device', () => {
  test('frees the device and records reason, condition pair, accessories and who', async () => {
    const open = openAssignment(t.fx)
    const res = await t.as('kim@adspark.ph').post(`/api/assignments/${open.id}/return`, {
      return_reason: 'resignation', returned_condition: 'damaged',
      returned_accessories: ['charger', 'bogus'], notes: 'Hinge cracked.',
    })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      return_reason: 'resignation', issued_condition: 'good', returned_condition: 'damaged',
      returned_accessories: ['charger'], notes: 'Hinge cracked.', returned_by_name: 'Kim Bautista',
    })
    expect(res.body.data.returned_at).toEqual(expect.any(String))

    const device = await t.api.get(`/api/devices/${open.device_id}`)
    expect(device.body.data.current_holder).toBeNull()
  })

  test('coming back worse than it went out is recorded, not refused', async () => {
    const res = await giveBack(openAssignment(t.fx).id, { returned_condition: 'damaged' })
    expect(res.status).toBe(200)
    expect(res.body.data.returned_condition).toBe('damaged')
  })

  test('returning twice is refused', async () => {
    const open = openAssignment(t.fx)
    await giveBack(open.id)
    const res = await giveBack(open.id)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ASSIGNMENT_ALREADY_RETURNED')
  })

  test('two concurrent returns produce exactly one 200 and one 409', async () => {
    const open = openAssignment(t.fx)
    const results = await Promise.all([giveBack(open.id), giveBack(open.id)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  })

  test('a return dated before the handout is refused', async () => {
    const open = openAssignment(t.fx)
    const before = new Date(new Date(open.issued_at).getTime() - 86_400_000).toISOString()
    const res = await giveBack(open.id, { returned_at: before })
    expect(res.status).toBe(400)
    expect(res.body.error.details.returned_at).toMatch(/before/i)
  })

  test('a future return date is refused', async () => {
    const res = await giveBack(openAssignment(t.fx).id, { returned_at: FUTURE() })
    expect(res.status).toBe(400)
    expect(res.body.error.details.returned_at).toMatch(/future/i)
  })

  test('a return without a reason is refused', async () => {
    const res = await t.api.post(`/api/assignments/${openAssignment(t.fx).id}/return`,
      { returned_condition: 'good' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.return_reason).toBeTruthy()
  })

  test('a return without a condition is refused, because it is the evidence', async () => {
    const res = await t.api.post(`/api/assignments/${openAssignment(t.fx).id}/return`,
      { return_reason: 'swap' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.returned_condition).toMatch(/condition/i)
  })

  test('an unknown assignment is a 404', async () => {
    const res = await giveBack('00000000-0000-4000-8000-000000000000')
    expect(res.status).toBe(404)
  })

  test('the device can be issued again after it comes back', async () => {
    const open = openAssignment(t.fx)
    await giveBack(open.id)
    const res = await issue({ device_id: open.device_id, employee_id: idleEmployee(t.fx).id })
    expect(res.status).toBe(201)
  })
})

describe('the handout log', () => {
  test('lists every handout newest first, with names', async () => {
    const res = await t.api.get('/api/assignments')
    expect(res.body.data).toHaveLength(t.fx.assignments.length)
    const times = res.body.data.map((a) => new Date(a.issued_at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(res.body.data[0]).toMatchObject({
      asset_tag: expect.any(String), employee_name: expect.any(String),
    })
  })

  test('open=true and open=false partition the log', async () => {
    const [out, back] = await Promise.all([
      t.api.get('/api/assignments?open=true'), t.api.get('/api/assignments?open=false'),
    ])
    expect(out.body.data.every((a) => a.returned_at === null)).toBe(true)
    expect(back.body.data.every((a) => a.returned_at !== null)).toBe(true)
    expect(out.body.data.length + back.body.data.length).toBe(t.fx.assignments.length)
  })

  test('from and to bound issued_at', async () => {
    const from = new Date(Date.now() - 100 * 86_400_000).toISOString()
    const to = new Date(Date.now() - 55 * 86_400_000).toISOString()
    const res = await t.api.get(`/api/assignments?from=${from}&to=${to}`)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.length).toBeLessThan(t.fx.assignments.length)
    for (const a of res.body.data) {
      expect(new Date(a.issued_at) >= new Date(from) && new Date(a.issued_at) <= new Date(to)).toBe(true)
    }
  })

  test('filters by device and by employee', async () => {
    const device = t.fx.devices[0]
    const byDevice = await t.api.get(`/api/assignments?device_id=${device.id}`)
    expect(byDevice.body.data).toHaveLength(3)

    const open = openFor(t.fx, device.id)
    const byEmployee = await t.api.get(`/api/assignments?employee_id=${open.employee_id}`)
    expect(byEmployee.body.data.every((a) => a.employee_id === open.employee_id)).toBe(true)
  })

  test('a malformed id filter matches nothing; a bad date is a 400', async () => {
    expect((await t.api.get('/api/assignments?device_id=nope')).body.data).toEqual([])
    expect((await t.api.get('/api/assignments?from=notadate')).status).toBe(400)
  })
})
