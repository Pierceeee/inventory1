import { useTestApi, idleEmployee, isOpen } from './support/api.js'

const t = useTestApi()

const holderOf = (status) => {
  const open = t.fx.assignments.find((a) => isOpen(a) &&
    t.fx.employees.find((e) => e.id === a.employee_id).status === status)
  return t.fx.employees.find((e) => e.id === open.employee_id)
}
const heldBy = (employee) => t.fx.assignments.filter((a) => a.employee_id === employee.id && isOpen(a))

describe('listing employees', () => {
  test('includes how many devices each person holds, sorted by name', async () => {
    const res = await t.api.get('/api/employees')
    expect(res.body.data).toHaveLength(t.fx.employees.length)
    const names = res.body.data.map((e) => e.full_name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

    const holder = holderOf('active')
    const row = res.body.data.find((e) => e.id === holder.id)
    expect(row.devices_held_count).toBe(heldBy(holder).length)
  })

  test('the status filter narrows the list', async () => {
    const res = await t.api.get('/api/employees?status=resigned')
    expect(res.body.data).toHaveLength(t.fx.employees.filter((e) => e.status === 'resigned').length)
  })

  test('search matches name and email case-insensitively', async () => {
    const target = t.fx.employees[0]
    const byName = await t.api.get(`/api/employees?q=${encodeURIComponent(target.full_name.toUpperCase())}`)
    expect(byName.body.data.some((e) => e.id === target.id)).toBe(true)
    const byEmail = await t.api.get(`/api/employees?q=${encodeURIComponent(target.email.slice(0, 5))}`)
    expect(byEmail.body.data.some((e) => e.id === target.id)).toBe(true)
  })
})

describe('employee detail', () => {
  test('lists devices held with issue dates, and full history', async () => {
    const holder = holderOf('active')
    const res = await t.api.get(`/api/employees/${holder.id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.devices_held).toHaveLength(heldBy(holder).length)
    expect(res.body.data.devices_held[0]).toMatchObject({
      assignment_id: expect.any(String), device_id: expect.any(String), asset_tag: expect.any(String),
      type: expect.any(String), issued_at: expect.any(String), issued_condition: 'good',
      issued_accessories: expect.any(Array),
    })
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(heldBy(holder).length)
  })

  test('someone holding nothing has an empty list', async () => {
    const res = await t.api.get(`/api/employees/${idleEmployee(t.fx).id}`)
    expect(res.body.data.devices_held).toEqual([])
  })

  test('an unknown id is a 404', async () => {
    expect((await t.api.get('/api/employees/nope')).status).toBe(404)
  })
})

describe('creating and editing employees', () => {
  test('a valid employee is created active', async () => {
    const res = await t.api.post('/api/employees', {
      full_name: '  Nora Aunor ', email: 'nora@adspark.ph', department: 'Media',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      full_name: 'Nora Aunor', status: 'active', resigned_at: null, devices_held_count: 0,
    })
  })

  test('a duplicate email - in any case - is a 409', async () => {
    const res = await t.api.post('/api/employees', {
      full_name: 'Someone Else', email: t.fx.employees[0].email.toUpperCase(),
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL')
    expect(res.body.error.details.email).toBeTruthy()
  })

  test('several people may have no email', async () => {
    expect((await t.api.post('/api/employees', { full_name: 'A', email: '' })).status).toBe(201)
    expect((await t.api.post('/api/employees', { full_name: 'B' })).status).toBe(201)
  })

  test('a missing name or malformed email is a 400 naming the fields', async () => {
    const res = await t.api.post('/api/employees', { email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(res.body.error.details).toMatchObject({
      full_name: expect.any(String), email: expect.any(String),
    })
  })

  test('patching updates only the fields sent and cannot change status', async () => {
    const target = t.fx.employees[0]
    const res = await t.api.patch(`/api/employees/${target.id}`, { department: 'IT', status: 'resigned' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ department: 'IT', status: 'active', full_name: target.full_name })
  })
})

describe('resigning', () => {
  test('marks resigned but does NOT close assignments', async () => {
    const holder = holderOf('active')
    const before = heldBy(holder).length

    const res = await t.api.post(`/api/employees/${holder.id}/resign`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'resigned', resigned_at: expect.any(String) })

    const detail = await t.api.get(`/api/employees/${holder.id}`)
    expect(detail.body.data.devices_held).toHaveLength(before)
  })

  test('resigning twice keeps the original date', async () => {
    const resigned = t.fx.employees.find((e) => e.status === 'resigned')
    const res = await t.api.post(`/api/employees/${resigned.id}/resign`)
    expect(new Date(res.body.data.resigned_at).getTime()).toBe(new Date(resigned.resigned_at).getTime())
  })
})
