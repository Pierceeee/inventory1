// BE-6 import, BE-7 dashboard and export.
import { useTestApi, isOpen } from './support/api.js'

const t = useTestApi()

const csvLines = (text) => text.replace(/^\uFEFF/, '').trim().split('\n')

describe('dashboard', () => {
  test('counts agree with the device list', async () => {
    const [devices, dash] = await Promise.all([t.api.get('/api/devices'), t.api.get('/api/dashboard')])
    const list = devices.body.data
    const { totals, by_type } = dash.body.data

    expect(totals.devices).toBe(list.length)
    expect(totals.issued).toBe(list.filter((d) => d.current_holder).length)
    expect(totals.available).toBe(list.filter((d) => !d.current_holder && d.status === 'available').length)
    expect(totals.repair).toBe(list.filter((d) => d.status === 'repair').length)
    expect(totals.retired).toBe(list.filter((d) => d.status === 'retired').length)
    expect(totals.employees).toBe(t.fx.employees.filter((e) => e.status === 'active').length)
    expect(by_type.map((x) => x.type)).toEqual(['laptop', 'mobile'])
    expect(by_type.reduce((n, x) => n + x.total, 0)).toBe(list.length)
  })

  test('an empty register reads as zeros for both types', async () => {
    // Never truncate profiles/departments here - the signed-in user's role
    // lives there, and re-creating it would default allen back to scanner,
    // turning this very request 403 (G-2).
    await t.db.exec('truncate table assignments, devices, employees cascade')
    const { body } = await t.api.get('/api/dashboard')
    expect(body.data.totals).toEqual({ devices: 0, issued: 0, available: 0, repair: 0, retired: 0, employees: 0 })
    expect(body.data.by_type).toEqual([
      { type: 'laptop', total: 0, issued: 0, available: 0 },
      { type: 'mobile', total: 0, issued: 0, available: 0 },
    ])
    expect(body.data.holders).toEqual([])
  })

  test('names every resigned person still holding devices, with each asset tag', async () => {
    const { body } = await t.api.get('/api/dashboard')
    const stranded = t.fx.employees.filter((e) => e.status === 'resigned' &&
      t.fx.assignments.some((a) => a.employee_id === e.id && isOpen(a)))

    expect(body.data.attention.resigned_holding).toHaveLength(stranded.length)
    for (const person of stranded) {
      const entry = body.data.attention.resigned_holding.find((p) => p.employee_id === person.id)
      const held = t.fx.assignments.filter((a) => a.employee_id === person.id && isOpen(a))
      expect(entry.devices.map((d) => d.asset_tag).sort()).toEqual(
        held.map((a) => t.fx.devices.find((d) => d.id === a.device_id).asset_tag).sort())
    }
  })

  test('lists devices in repair and staff holding nothing', async () => {
    const { body } = await t.api.get('/api/dashboard')
    expect(body.data.attention.in_repair).toHaveLength(t.fx.devices.filter((d) => d.status === 'repair').length)
    for (const person of body.data.attention.unassigned_staff) {
      expect(t.fx.assignments.some((a) => a.employee_id === person.employee_id && isOpen(a))).toBe(false)
    }
  })

  test('the holder table has one row per device out, sorted by holder', async () => {
    const { body } = await t.api.get('/api/dashboard')
    expect(body.data.holders).toHaveLength(t.fx.assignments.filter(isOpen).length)
    expect(body.data.holders[0]).toMatchObject({
      device_id: expect.any(String), asset_tag: expect.any(String), type: expect.any(String),
      employee_id: expect.any(String), holder_name: expect.any(String), issued_at: expect.any(String),
    })
  })
})

describe('CSV export', () => {
  test('is a CSV attachment with a header and one row per handout', async () => {
    const res = await t.api.get('/api/export/assignments')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/attachment/)
    const lines = csvLines(res.text)
    expect(lines[0]).toBe(
      'asset_tag,device_type,brand,model,serial_number,employee_name,employee_email,' +
      'department,issued_at,returned_at,return_reason,notes')
    expect(lines).toHaveLength(t.fx.assignments.length + 1)
  })

  test('joins names rather than exporting ids, with ISO timestamps', async () => {
    const res = await t.api.get('/api/export/assignments')
    const open = t.fx.assignments.find(isOpen)
    expect(res.text).toContain(`"${t.fx.devices.find((d) => d.id === open.device_id).asset_tag}"`)
    expect(res.text).toContain(`"${t.fx.employees.find((e) => e.id === open.employee_id).full_name}"`)
    expect(res.text).not.toContain(open.device_id)
    expect(res.text).toMatch(/"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z"/)
  })

  test('quotes every field so commas and quotes cannot shift columns', async () => {
    await t.db.query(`update devices set model = 'MacBook Air, 13" 2024' where id = $1`, [t.fx.devices[0].id])
    const res = await t.api.get('/api/export/assignments')
    const row = csvLines(res.text).find((l) => l.includes('MacBook Air, 13'))
    expect(row).toContain('"MacBook Air, 13"" 2024"')
    expect(row.match(/","/g)).toHaveLength(11)
  })

  test('a note that looks like a formula is exported as text', async () => {
    await t.db.query(`update assignments set notes = '=HYPERLINK("http://x")' where id = $1`, [t.fx.assignments[0].id])
    const res = await t.api.get('/api/export/assignments')
    expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`)
  })

  test('date range and open filters narrow the export like the on-screen log', async () => {
    const from = new Date(Date.now() - 100 * 86_400_000).toISOString()
    const ranged = await t.api.get(`/api/export/assignments?from=${encodeURIComponent(from)}`)
    expect(csvLines(ranged.text).length).toBeLessThan(t.fx.assignments.length + 1)
    const open = await t.api.get('/api/export/assignments?open=true')
    expect(csvLines(open.text)).toHaveLength(t.fx.assignments.filter(isOpen).length + 1)
  })
})

describe('CSV import', () => {
  const devices = (rows, commit = false) => t.api.post('/api/import/devices', { rows, commit })
  const employees = (rows, commit = false) => t.api.post('/api/import/employees', { rows, commit })

  test('a dry run reports what would happen and writes nothing', async () => {
    const res = await devices([{ asset_tag: 'ASP-5000', type: 'laptop' }])
    expect(res.body.data).toEqual({ created: 1, skipped: 0, errors: [] })
    expect((await t.api.get('/api/devices?q=ASP-5000')).body.data).toEqual([])
  })

  test('commit writes the valid rows', async () => {
    const res = await devices([
      { asset_tag: 'ASP-5000', type: 'Laptop', brand: 'Apple', model: 'MacBook Air M3', os: 'MACOS', serial_number: 'SN-X' },
      { asset_tag: 'ASP-5001', type: 'mobile', os: 'symbian' },
    ], true)
    expect(res.body.data.created).toBe(2)
    const [a, b] = (await t.api.get('/api/devices?q=ASP-500')).body.data
    expect(a).toMatchObject({ asset_tag: 'ASP-5000', type: 'laptop', os: 'macos', status: 'available' })
    expect(b.os).toBeNull()
  })

  test('bad rows are reported by spreadsheet line and never sink the batch', async () => {
    const res = await devices([
      { asset_tag: 'ASP-5000', type: 'laptop' },
      { asset_tag: '', type: 'laptop' },
      { asset_tag: 'ASP-5002', type: 'tablet' },
      { asset_tag: 'ASP-5003', type: 'mobile' },
    ], true)
    expect(res.body.data.created).toBe(2)
    expect(res.body.data.errors).toEqual([
      { line: 3, field: 'asset_tag', message: 'Asset tag is required.' },
      { line: 4, field: 'type', message: 'Type must be laptop or mobile.' },
    ])
  })

  test('existing asset tags and serials, and repeats within the file, are skipped and reported', async () => {
    const res = await devices([
      { asset_tag: 'asp-0001', type: 'laptop' },
      { asset_tag: 'ASP-5000', type: 'laptop', serial_number: t.fx.devices[0].serial_number },
      { asset_tag: 'ASP-5001', type: 'laptop' },
      { asset_tag: 'ASP-5001', type: 'laptop' },
    ], true)
    expect(res.body.data.created).toBe(1)
    expect(res.body.data.skipped).toBe(3)
    expect(res.body.data.errors.map((e) => e.line)).toEqual([2, 3, 5])
  })

  test('employees: missing names, bad emails and duplicates are reported; the rest import', async () => {
    const res = await employees([
      { full_name: 'Nora Aunor', email: 'nora@adspark.ph', department: 'Media' },
      { full_name: '', email: 'x@adspark.ph' },
      { full_name: 'Bad Email', email: 'nope' },
      { full_name: 'Dupe', email: t.fx.employees[0].email.toUpperCase() },
      { full_name: 'No Email' },
    ], true)
    expect(res.body.data).toMatchObject({ created: 2, skipped: 1 })
    expect(res.body.data.errors.map((e) => [e.line, e.field])).toEqual([[3, 'full_name'], [4, 'email'], [5, 'email']])
    const found = await t.api.get('/api/employees?q=nora')
    expect(found.body.data[0]).toMatchObject({ full_name: 'Nora Aunor', status: 'active' })
  })

  test('rows must be a list of at most 5,000', async () => {
    expect((await t.api.post('/api/import/devices', { rows: 'nope' })).status).toBe(400)
    const tooMany = Array.from({ length: 5001 }, (_, i) => ({ asset_tag: `X-${i}`, type: 'laptop' }))
    const res = await devices(tooMany)
    expect(res.status).toBe(400)
    expect(res.body.error.details.rows).toMatch(/5,000/)
  })
})
