// The api/ modules against the real server: the contract the screens rely on.
import { db, refreshDb } from '../test/liveDb.js'
import { listDevices, getDevice, createDevice, updateDevice } from './devices.js'
import { getEmployee, resignEmployee } from './employees.js'
import { issueDevice, returnDevice, listAssignments } from './assignments.js'
import { getDashboard } from './dashboard.js'
import { fetchWithAuth, SIGNED_OUT_EVENT } from './client.js'
import { ApiError } from '../lib/errors.js'
import { getSession, setSession } from '../lib/session.js'

const freeLaptop = () => db.devices.find(
  (d) => d.type === 'laptop' && d.status === 'available' &&
    !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))
const activeEmployee = () => db.employees.find((e) => e.status === 'active')

test('device list carries the current holder and never the status "issued"', async () => {
  const { data } = await listDevices()
  expect(data.length).toBe(db.devices.length)
  expect(data.some((d) => d.current_holder !== null)).toBe(true)
  for (const d of data) expect(['available', 'repair', 'retired']).toContain(d.status)
})

test('search is case-insensitive and trims whitespace', async () => {
  for (const q of ['ASP-0001', 'asp-0001', '  asp-0001  ', '0001']) {
    const { data } = await listDevices({ q })
    expect(data.some((d) => d.asset_tag === 'ASP-0001')).toBe(true)
  }
})

test('held=true and held=false partition the register', async () => {
  const [all, out, free] = await Promise.all([
    listDevices(), listDevices({ held: 'true' }), listDevices({ held: 'false' }),
  ])
  expect(out.data.length + free.data.length).toBe(all.data.length)
})

test('device detail returns full history newest first', async () => {
  const { data } = await getDevice(db.devices[0].id)
  expect(data.history).toHaveLength(3)
  const times = data.history.map((h) => new Date(h.issued_at).getTime())
  expect(times).toEqual([...times].sort((a, b) => b - a))
})

test('a duplicate asset tag is a 409 with a field-level detail', async () => {
  const error = await createDevice({ asset_tag: db.devices[0].asset_tag, type: 'laptop' })
    .catch((e) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect(error.status).toBe(409)
  expect(error.code).toBe('DUPLICATE_ASSET_TAG')
  expect(error.details.asset_tag).toMatch(/already in use/i)
})

test('issuing a device twice is refused and names the holder', async () => {
  const device = freeLaptop()
  const first = activeEmployee()
  const second = db.employees.find((e) => e.status === 'active' && e.id !== first.id)
  await issueDevice({ device_id: device.id, employee_id: first.id })

  const error = await issueDevice({ device_id: device.id, employee_id: second.id }).catch((e) => e)
  expect(error.status).toBe(409)
  expect(error.code).toBe('DEVICE_ALREADY_ISSUED')
  expect(error.details.holder_name).toBe(first.full_name)
})

test('issuing to a resigned employee is refused', async () => {
  const resigned = db.employees.find((e) => e.status === 'resigned')
  const error = await issueDevice({ device_id: freeLaptop().id, employee_id: resigned.id })
    .catch((e) => e)
  expect(error.code).toBe('EMPLOYEE_RESIGNED')
})

test('a future handout date is a 400 naming the field', async () => {
  const error = await issueDevice({
    device_id: freeLaptop().id, employee_id: activeEmployee().id,
    issued_at: new Date(Date.now() + 86_400_000).toISOString(),
  }).catch((e) => e)
  expect(error.status).toBe(400)
  expect(error.details.issued_at).toBeTruthy()
})

test('a same-type handout succeeds and carries a warning, not an error', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const holder = db.employees.find((e) => e.id === open.employee_id && e.status === 'active')
  const held = db.devices.find((d) => d.id === open.device_id)
  const another = db.devices.find(
    (d) => d.type === held.type && d.status === 'available' &&
      !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))

  const { data, warning } = await issueDevice({ device_id: another.id, employee_id: holder.id })
  expect(data.id).toEqual(expect.any(String))
  expect(warning.code).toBe('SAME_TYPE_ALREADY_HELD')
})

test('returning frees the device; returning twice is refused', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  await returnDevice(open.id, { return_reason: 'swap', returned_condition: 'good' })

  const { data } = await getDevice(open.device_id)
  expect(data.current_holder).toBeNull()

  const error = await returnDevice(open.id, { return_reason: 'swap', returned_condition: 'good' }).catch((e) => e)
  expect(error.code).toBe('ASSIGNMENT_ALREADY_RETURNED')
})

test('resigning does NOT close assignments', async () => {
  const open = db.assignments.find((a) => a.returned_at === null)
  const before = db.assignments.filter(
    (a) => a.employee_id === open.employee_id && a.returned_at === null).length

  const { data } = await resignEmployee(open.employee_id)
  expect(data.status).toBe('resigned')

  await refreshDb()
  const after = db.assignments.filter(
    (a) => a.employee_id === open.employee_id && a.returned_at === null).length
  expect(after).toBe(before)

  const detail = await getEmployee(open.employee_id)
  expect(detail.data.devices_held.length).toBe(before)
})

test('the handout log is newest first and filters by date', async () => {
  const { data } = await listAssignments()
  const times = data.map((a) => new Date(a.issued_at).getTime())
  expect(times).toEqual([...times].sort((a, b) => b - a))

  const from = new Date(Date.now() - 100 * 86_400_000).toISOString()
  const ranged = await listAssignments({ from })
  expect(ranged.data.length).toBeLessThan(data.length)
})

test('dashboard counts agree with the device list', async () => {
  const [devices, dash] = await Promise.all([listDevices(), getDashboard()])
  expect(dash.data.totals.devices).toBe(devices.data.length)
  expect(dash.data.totals.issued).toBe(devices.data.filter((d) => d.current_holder).length)
  expect(dash.data.by_type.map((t) => t.type)).toEqual(['laptop', 'mobile'])
})

describe('CSV export (§6)', () => {
  const fetchCsv = (params) =>
    fetchWithAuth('/export/assignments', { params }).then(async (r) => [r, await r.text()])

  test('returns a CSV attachment with a header row per handout', async () => {
    const [response, text] = await fetchCsv()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/text\/csv/)
    expect(response.headers.get('content-disposition')).toMatch(/attachment/)

    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(db.assignments.length + 1)
    expect(lines[0]).toBe(
      'asset_tag,device_type,brand,model,serial_number,employee_name,employee_email,' +
      'department,issued_at,returned_at,return_reason,notes')
  })

  test('joins the device and employee, not just ids', async () => {
    const [, text] = await fetchCsv()
    const open = db.assignments.find((a) => a.returned_at === null)
    const device = db.devices.find((d) => d.id === open.device_id)
    const employee = db.employees.find((e) => e.id === open.employee_id)
    expect(text).toContain(`"${device.asset_tag}"`)
    expect(text).toContain(`"${employee.full_name}"`)
    expect(text).not.toContain(open.device_id)
  })

  // A model name containing a comma must not silently become two columns.
  test('quotes every field so commas in the data cannot shift columns', async () => {
    await updateDevice(db.devices[0].id, { model: 'MacBook Air, 13-inch' })
    const [, text] = await fetchCsv()
    expect(text).toContain('"MacBook Air, 13-inch"')
    const row = text.split('\n').find((l) => l.includes('MacBook Air, 13-inch'))
    expect(row.match(/","/g).length).toBe(11)      // 12 fields => 11 separators
  })

  test('the date range filter narrows the export', async () => {
    const from = new Date(Date.now() - 100 * 86_400_000).toISOString()
    const [, all] = await fetchCsv()
    const [, ranged] = await fetchCsv({ from })
    expect(ranged.trim().split('\n').length).toBeLessThan(all.trim().split('\n').length)
  })

  test('open=true exports only handouts still out', async () => {
    const [, text] = await fetchCsv({ open: 'true' })
    const expected = db.assignments.filter((a) => a.returned_at === null).length
    expect(text.trim().split('\n')).toHaveLength(expected + 1)
  })
})

describe('session renewal', () => {
  const allen = () => getSession()

  test('an expired token is renewed once and the request goes through', async () => {
    const good = allen()
    setSession({ ...good, token: 'test.expired' })

    const { data } = await listDevices()
    expect(data.length).toBe(db.devices.length)
    expect(getSession().token).toBe(good.token)
  })

  test('a refused renewal ends the session and says so', async () => {
    setSession({ ...allen(), token: 'test.expired', refresh_token: 'revoked' })
    const signedOut = vi.fn()
    window.addEventListener(SIGNED_OUT_EVENT, signedOut)

    const error = await listDevices().catch((e) => e)
    window.removeEventListener(SIGNED_OUT_EVENT, signedOut)

    expect(error.status).toBe(401)
    expect(getSession()).toBeNull()
    expect(signedOut).toHaveBeenCalledOnce()
  })

  test('many requests failing together share one renewal', async () => {
    setSession({ ...allen(), token: 'test.expired' })
    const spy = vi.spyOn(globalThis, 'fetch')

    const results = await Promise.all([listDevices(), getDashboard(), listAssignments()])
    const renewals = spy.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))
    spy.mockRestore()

    expect(results.every((r) => r.data)).toBe(true)
    expect(renewals).toHaveLength(1)
  })
})
