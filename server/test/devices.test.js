import { useTestApi, freeDevice, openAssignment } from './support/api.js'

const t = useTestApi()

describe('listing devices', () => {
  test('includes the current holder for held devices, and nothing is ever "issued"', async () => {
    const res = await t.api.get('/api/devices')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(t.fx.devices.length)

    const held = res.body.data.find((d) => d.current_holder !== null)
    expect(held.current_holder).toMatchObject({
      assignment_id: expect.any(String), employee_id: expect.any(String),
      full_name: expect.any(String), issued_at: expect.any(String),
      type: held.type, issued_condition: 'good', issued_accessories: expect.any(Array),
    })
    for (const d of res.body.data) expect(['available', 'repair', 'retired']).toContain(d.status)
  })

  test('is sorted by asset tag', async () => {
    const tags = (await t.api.get('/api/devices')).body.data.map((d) => d.asset_tag)
    expect(tags).toEqual([...tags].sort())
  })

  test('type and status filters narrow the list', async () => {
    const res = await t.api.get('/api/devices?type=mobile&status=available')
    expect(res.body.data.length).toBeGreaterThan(0)
    for (const d of res.body.data) expect(d).toMatchObject({ type: 'mobile', status: 'available' })
  })

  test('held=true and held=false partition the register', async () => {
    const [out, free] = await Promise.all([
      t.api.get('/api/devices?held=true'), t.api.get('/api/devices?held=false'),
    ])
    expect(out.body.data.every((d) => d.current_holder !== null)).toBe(true)
    expect(free.body.data.every((d) => d.current_holder === null)).toBe(true)
    expect(out.body.data.length + free.body.data.length).toBe(t.fx.devices.length)
  })

  test('search is case-insensitive, trims whitespace, and matches partials', async () => {
    for (const q of ['ASP-0001', 'asp-0001', '  asp-0001  ', '0001']) {
      const res = await t.api.get(`/api/devices?q=${encodeURIComponent(q)}`)
      expect(res.body.data.some((d) => d.asset_tag === 'ASP-0001')).toBe(true)
    }
  })

  test('search also matches model, brand and serial number', async () => {
    const target = t.fx.devices[0]
    for (const q of [target.model.toLowerCase(), target.serial_number, 'lenovo']) {
      const res = await t.api.get(`/api/devices?q=${encodeURIComponent(q)}`)
      expect(res.body.data.length).toBeGreaterThan(0)
    }
  })

  test('search characters that are special in SQL patterns are matched literally', async () => {
    const res = await t.api.get(`/api/devices?q=${encodeURIComponent('%')}`)
    expect(res.body.data).toEqual([])
  })

  test('a search matching nothing is an empty list, not an error', async () => {
    const res = await t.api.get('/api/devices?q=zzzznothing')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

describe('device detail', () => {
  test('returns the holder and full history, newest first', async () => {
    const res = await t.api.get(`/api/devices/${t.fx.devices[0].id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.current_holder).not.toBeNull()
    expect(res.body.data.history).toHaveLength(3)
    const times = res.body.data.history.map((h) => new Date(h.issued_at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(res.body.data.history[0]).toMatchObject({
      employee_name: expect.any(String), issued_by_name: expect.any(String),
    })
  })

  test('unknown and malformed ids are a 404 with NOT_FOUND', async () => {
    for (const id of ['nope', '00000000-0000-4000-8000-000000000000']) {
      const res = await t.api.get(`/api/devices/${id}`)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
  })
})

describe('creating and editing devices', () => {
  const laptop = { asset_tag: 'ASP-9999', type: 'laptop', brand: 'Dell', model: 'Latitude 7440', os: 'windows' }

  test('a valid device is created available and unheld', async () => {
    const res = await t.api.post('/api/devices', laptop)
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ ...laptop, status: 'available', current_holder: null })
    const list = await t.api.get('/api/devices?q=ASP-9999')
    expect(list.body.data).toHaveLength(1)
  })

  test('blank optional fields are stored as null, and text is trimmed', async () => {
    const res = await t.api.post('/api/devices', { ...laptop, asset_tag: '  ASP-8888 ', serial_number: '', notes: '' })
    expect(res.body.data).toMatchObject({ asset_tag: 'ASP-8888', serial_number: null, notes: null })
  })

  test('a duplicate asset tag - in any case - is a 409 with a field detail', async () => {
    const res = await t.api.post('/api/devices', { ...laptop, asset_tag: 'asp-0001' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_ASSET_TAG')
    expect(res.body.error.details.asset_tag).toMatch(/already in use/i)
  })

  test('a duplicate serial number is a 409', async () => {
    const res = await t.api.post('/api/devices', { ...laptop, serial_number: t.fx.devices[0].serial_number })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_SERIAL')
  })

  test('missing asset tag and bad type are a 400 naming both fields', async () => {
    const res = await t.api.post('/api/devices', { type: 'tablet' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.asset_tag).toMatch(/required/i)
    expect(res.body.error.details.type).toBeTruthy()
  })

  test('a status of "issued" cannot be written', async () => {
    const res = await t.api.post('/api/devices', { ...laptop, status: 'issued' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.status).toBeTruthy()
  })

  test('patching updates only the fields sent', async () => {
    const device = t.fx.devices[1]
    const res = await t.api.patch(`/api/devices/${device.id}`, { notes: 'Screen scratch' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ notes: 'Screen scratch', asset_tag: device.asset_tag, model: device.model })
  })

  test('patching to another device\'s asset tag is a 409', async () => {
    const res = await t.api.patch(`/api/devices/${t.fx.devices[1].id}`, { asset_tag: t.fx.devices[0].asset_tag })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_ASSET_TAG')
  })

  test('a held device cannot be moved into repair until it is returned', async () => {
    const open = openAssignment(t.fx)
    const res = await t.api.patch(`/api/devices/${open.device_id}`, { status: 'repair' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DEVICE_ALREADY_ISSUED')
  })

  test('a free device can be moved into repair and back', async () => {
    const device = freeDevice(t.fx)
    expect((await t.api.patch(`/api/devices/${device.id}`, { status: 'repair' })).body.data.status).toBe('repair')
    expect((await t.api.patch(`/api/devices/${device.id}`, { status: 'available' })).body.data.status).toBe('available')
  })
})

describe('retiring', () => {
  test('a held device is refused, naming the holder', async () => {
    const open = openAssignment(t.fx)
    const res = await t.api.post(`/api/devices/${open.device_id}/retire`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DEVICE_ALREADY_ISSUED')
    expect(res.body.error.details.holder_name).toEqual(expect.any(String))
  })

  test('a free device is retired and keeps its history', async () => {
    const withHistory = t.fx.devices.find((d) => d.status === 'available' &&
      t.fx.assignments.some((a) => a.device_id === d.id) &&
      !t.fx.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
    const res = await t.api.post(`/api/devices/${withHistory.id}/retire`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('retired')
    const detail = await t.api.get(`/api/devices/${withHistory.id}`)
    expect(detail.body.data.history.length).toBeGreaterThan(0)
  })
})
