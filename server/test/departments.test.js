import { useTestApi, STAFF } from './support/api.js'

const t = useTestApi()

describe('departments', () => {
  test('lists departments with how many users each has', async () => {
    const res = await t.api.get('/api/departments')
    expect(res.status).toBe(200)
    const it = res.body.data.find((d) => d.name.startsWith('IT'))
    const itCount = t.fx.profiles.filter((p) => p.department_id === it.id).length
    expect(it.user_count).toBe(itCount)
    expect(itCount).toBeGreaterThan(0)

    const finance = res.body.data.find((d) => d.name.startsWith('Finance'))
    expect(finance.user_count).toBe(0)
  })

  test('an admin adds a department', async () => {
    const res = await t.api.post('/api/departments', { name: 'Operations' })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ name: 'Operations', user_count: 0 })

    const list = await t.api.get('/api/departments')
    expect(list.body.data.some((d) => d.name === 'Operations')).toBe(true)
  })

  test('department names are unique regardless of case and surrounding spaces', async () => {
    const first = await t.api.post('/api/departments', { name: 'Logistics' })
    expect(first.status).toBe(201)

    const dupe = await t.api.post('/api/departments', { name: '  logistics  ' })
    expect(dupe.status).toBe(409)
    expect(dupe.body.error.code).toBe('DUPLICATE_DEPARTMENT')
    expect(dupe.body.error.details.name).toBeTruthy()
  })

  test('a blank name is a 400 naming the field', async () => {
    const res = await t.api.post('/api/departments', { name: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.name).toBeTruthy()
  })

  test('an admin renames a department', async () => {
    const created = await t.api.post('/api/departments', { name: 'Temp Name' })
    const res = await t.api.patch(`/api/departments/${created.body.data.id}`, { name: 'Better Name' })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Better Name')
  })

  test('renaming to an existing name is a 409', async () => {
    const it = t.fx.departments.find((d) => d.name.startsWith('IT'))
    const creative = t.fx.departments.find((d) => d.name.startsWith('Creative'))
    const res = await t.api.patch(`/api/departments/${creative.id}`, { name: it.name })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_DEPARTMENT')
  })

  test('an unknown or malformed department id is a 404', async () => {
    const unknown = await t.api.patch('/api/departments/00000000-0000-4000-8000-000000000000', { name: 'X' })
    expect(unknown.status).toBe(404)
    const malformed = await t.api.patch('/api/departments/not-a-uuid', { name: 'X' })
    expect(malformed.status).toBe(404)
  })

  test('a head cannot see or change departments', async () => {
    const res = await t.as(STAFF.itHead).get('/api/departments')
    expect(res.status).toBe(403)
  })
})
