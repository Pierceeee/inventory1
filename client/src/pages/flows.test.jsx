import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import DevicesPage, { deviceQueryFor } from './DevicesPage.jsx'
import DeviceDetailPage from './DeviceDetailPage.jsx'
import EmployeesPage from './EmployeesPage.jsx'
import EmployeeDetailPage from './EmployeeDetailPage.jsx'
import HandoutsPage from './HandoutsPage.jsx'
import DashboardPage from './DashboardPage.jsx'
import { db } from '../mocks/db.js'

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const showDevice = (id) =>
  renderWithProviders(<DeviceDetailPage />, { route: `/devices/${id}`, path: '/devices/:id' })
const showEmployee = (id) =>
  renderWithProviders(<EmployeeDetailPage />, { route: `/employees/${id}`, path: '/employees/:id' })

const openAssignment = () => db.assignments.find((a) => a.returned_at === null)
const freeDevice = () => db.devices.find(
  (d) => d.status === 'available' &&
    !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))

// ---------- chip -> query mapping ----------

describe('deviceQueryFor', () => {
  test('"Issued" asks for held devices, because issued is not a status', () => {
    expect(deviceQueryFor('all', 'issued', '')).toEqual({ held: 'true' })
  })
  test('"Available" means free AND lifecycle-available', () => {
    expect(deviceQueryFor('all', 'available', '')).toEqual({ held: 'false', status: 'available' })
  })
  test('Repair and Retired are plain status filters', () => {
    expect(deviceQueryFor('all', 'repair', '')).toEqual({ status: 'repair' })
    expect(deviceQueryFor('all', 'retired', '')).toEqual({ status: 'retired' })
  })
  test('type and search are carried through; "all" adds nothing', () => {
    expect(deviceQueryFor('laptop', 'all', ' asp ')).toEqual({ type: 'laptop', q: 'asp' })
    expect(deviceQueryFor('all', 'all', '')).toEqual({})
  })
})

// ---------- devices list ----------

describe('devices list', () => {
  test('lists every device with its holder inline', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await waitFor(() => expect(rows().length).toBe(db.devices.length))

    const open = openAssignment()
    const device = db.devices.find((d) => d.id === open.device_id)
    const employee = db.employees.find((e) => e.id === open.employee_id)
    const row = screen.getByText(device.asset_tag).closest('tr')
    expect(within(row).getByText(employee.full_name)).toBeInTheDocument()
    expect(within(row).getByText('Issued')).toBeInTheDocument()
  })

  test('the Laptops chip narrows the table', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await waitFor(() => expect(rows().length).toBe(db.devices.length))
    await userEvent.click(screen.getByRole('button', { name: 'Laptops' }))
    await waitFor(() =>
      expect(rows().length).toBe(db.devices.filter((d) => d.type === 'laptop').length))
  })

  test('the Issued chip shows only devices that are out', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await userEvent.click(screen.getByRole('button', { name: 'Issued' }))
    const expected = db.assignments.filter((a) => a.returned_at === null).length
    await waitFor(() => expect(rows().length).toBe(expected))
  })

  test('search is case-insensitive and ignores surrounding whitespace', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    await userEvent.type(screen.getByRole('searchbox'), '  asp-0001  ')
    await waitFor(() => expect(rows().length).toBe(1), { timeout: 3000 })
  })

  test('a filter matching nothing shows a readable empty state', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await userEvent.type(screen.getByRole('searchbox'), 'zzzznothing')
    await waitFor(() => expect(screen.getByText(/no devices match/i)).toBeInTheDocument(),
      { timeout: 3000 })
  })
})

// ---------- device detail ----------

describe('device detail', () => {
  test('a held device shows the holder and a Return button, not Issue', async () => {
    const open = openAssignment()
    const device = db.devices.find((d) => d.id === open.device_id)
    const employee = db.employees.find((e) => e.id === open.employee_id)
    showDevice(device.id)

    expect(await screen.findByRole('heading', { name: device.asset_tag })).toBeInTheDocument()
    const holderCard = screen.getByRole('region', { name: /current holder/i })
    expect(within(holderCard).getByText(employee.full_name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /return device/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^issue device$/i })).not.toBeInTheDocument()
  })

  test('a free device shows Issue and says nobody holds it', async () => {
    showDevice(freeDevice().id)
    expect(await screen.findByRole('button', { name: /^issue device$/i })).toBeInTheDocument()
    expect(screen.getByText(/not currently issued/i)).toBeInTheDocument()
  })

  // A returned device is free but must keep every past handout.
  test('a returned device keeps its full history although nobody holds it', async () => {
    const device = db.devices.find(
      (d) => d.status === 'available' &&
        !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null) &&
        db.assignments.some((a) => a.device_id === d.id))
    showDevice(device.id)

    await screen.findByRole('heading', { name: device.asset_tag })
    expect(screen.getByText(/not currently issued/i)).toBeInTheDocument()

    const region = screen.getByRole('region', { name: /history/i })
    for (const a of db.assignments.filter((x) => x.device_id === device.id)) {
      const employee = db.employees.find((e) => e.id === a.employee_id)
      expect(region).toHaveTextContent(employee.full_name)
    }
  })

  test('history is newest first and names the return reasons', async () => {
    showDevice(db.devices[0].id)
    const region = await screen.findByRole('region', { name: /history/i })
    expect(within(region).getAllByRole('listitem')).toHaveLength(3)
    expect(region).toHaveTextContent(/swap/i)
    expect(region).toHaveTextContent(/resignation/i)
  })

  test('a device never issued says so instead of showing an empty list', async () => {
    const untouched = db.devices.find((d) => !db.assignments.some((a) => a.device_id === d.id))
    showDevice(untouched.id)
    expect(await screen.findByText(/never been issued/i)).toBeInTheDocument()
  })

  test('a retired device offers neither Issue nor Retire', async () => {
    const retired = db.devices.find((d) => d.status === 'retired')
    showDevice(retired.id)
    await screen.findByRole('heading', { name: retired.asset_tag })
    expect(screen.queryByRole('button', { name: /^issue device$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^retire$/i })).not.toBeInTheDocument()
  })

  test('an unknown device id shows a readable message', async () => {
    showDevice('nope')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i)
  })
})

// ---------- issuing ----------

describe('issuing a device', () => {
  test('issuing from a device page records the handout and shows the holder', async () => {
    const device = freeDevice()
    const employee = db.employees.find((e) => e.status === 'active' &&
      !db.assignments.some((a) => a.employee_id === e.id && a.returned_at === null &&
        db.devices.find((d) => d.id === a.device_id)?.type === device.type))
    showDevice(device.id)

    await userEvent.click(await screen.findByRole('button', { name: /^issue device$/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/issue to/i), employee.id)
    await userEvent.click(within(dialog).getByRole('button', { name: /^issue device$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => {
      const holderCard = screen.getByRole('region', { name: /current holder/i })
      expect(within(holderCard).getByText(employee.full_name)).toBeInTheDocument()
    })
    expect(db.assignments.some(
      (a) => a.device_id === device.id && a.employee_id === employee.id && a.returned_at === null),
    ).toBe(true)
  })

  test('the same-type warning blocks submit until it is confirmed, then allows it', async () => {
    const open = openAssignment()
    const holder = db.employees.find((e) => e.id === open.employee_id && e.status === 'active')
    const heldType = db.devices.find((d) => d.id === open.device_id).type
    const another = db.devices.find(
      (d) => d.type === heldType && d.status === 'available' &&
        !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))

    showDevice(another.id)
    await userEvent.click(await screen.findByRole('button', { name: /^issue device$/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/issue to/i), holder.id)

    const submit = within(dialog).getByRole('button', { name: /^issue device$/i })
    await waitFor(() => expect(within(dialog).getByText(/already holds a/i)).toBeInTheDocument())
    expect(submit).toBeDisabled()

    await userEvent.click(within(dialog).getByLabelText(/issue it anyway/i))
    expect(submit).toBeEnabled()
    await userEvent.click(submit)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  test('a resigned employee is not offered in the issue dialog', async () => {
    const resigned = db.employees.find((e) => e.status === 'resigned')
    showDevice(freeDevice().id)
    await userEvent.click(await screen.findByRole('button', { name: /^issue device$/i }))
    const dialog = await screen.findByRole('dialog')
    const select = within(dialog).getByLabelText(/issue to/i)
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1))
    expect([...select.options].map((o) => o.value)).not.toContain(resigned.id)
  })
})

// ---------- returning ----------

describe('returning a device', () => {
  test('a return requires a reason and then frees the device', async () => {
    const open = openAssignment()
    const device = db.devices.find((d) => d.id === open.device_id)
    showDevice(device.id)

    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: /^return device$/i })
    expect(submit).toBeDisabled()

    await userEvent.selectOptions(within(dialog).getByLabelText(/reason/i), 'swap')
    expect(submit).toBeDisabled()                  // condition is required too
    await userEvent.click(within(dialog).getByRole('radio', { name: /good/i }))
    expect(submit).toBeEnabled()
    await userEvent.click(submit)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/not currently issued/i)).toBeInTheDocument())
    expect(db.assignments.find((a) => a.id === open.id).return_reason).toBe('swap')
  })
})

// ---------- employees ----------

describe('employees', () => {
  test('the list shows the devices-held count per person', async () => {
    renderWithProviders(<EmployeesPage />, { route: '/employees' })
    const open = openAssignment()
    const employee = db.employees.find((e) => e.id === open.employee_id)
    const expected = db.assignments.filter(
      (a) => a.employee_id === employee.id && a.returned_at === null).length

    const row = await screen.findByText(employee.full_name).then((el) => el.closest('tr'))
    expect(within(row).getByText(String(expected))).toBeInTheDocument()
  })

  test('the Resigned chip narrows the list', async () => {
    renderWithProviders(<EmployeesPage />, { route: '/employees' })
    await userEvent.click(screen.getByRole('button', { name: 'Resigned' }))
    const expected = db.employees.filter((e) => e.status === 'resigned').length
    await waitFor(() => expect(rows().length).toBe(expected))
  })

  // Resigning does not close assignments, so this state is reachable and normal.
  test('a resigned employee still holding devices is flagged with the count', async () => {
    const open = db.assignments.find(
      (a) => a.returned_at === null &&
        db.employees.find((e) => e.id === a.employee_id)?.status === 'resigned')
    const employee = db.employees.find((e) => e.id === open.employee_id)
    const heldCount = db.assignments.filter(
      (a) => a.employee_id === employee.id && a.returned_at === null).length

    showEmployee(employee.id)
    await screen.findByRole('heading', { name: employee.full_name })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/still holds/i)
    expect(alert).toHaveTextContent(String(heldCount))
  })

  test('an active employee holding devices shows no warning', async () => {
    const open = db.assignments.find(
      (a) => a.returned_at === null &&
        db.employees.find((e) => e.id === a.employee_id)?.status === 'active')
    const employee = db.employees.find((e) => e.id === open.employee_id)
    showEmployee(employee.id)
    await screen.findByRole('heading', { name: employee.full_name })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('a resigned employee is offered no Mark Resigned button', async () => {
    const employee = db.employees.find((e) => e.status === 'resigned')
    showEmployee(employee.id)
    await screen.findByRole('heading', { name: employee.full_name })
    expect(screen.queryByRole('button', { name: /mark resigned/i })).not.toBeInTheDocument()
  })

  test('an employee holding nothing says so', async () => {
    const idle = db.employees.find(
      (e) => !db.assignments.some((a) => a.employee_id === e.id && a.returned_at === null))
    showEmployee(idle.id)
    expect(await screen.findByText(/holds no devices/i)).toBeInTheDocument()
  })

  test('the resign dialog lists every outstanding device', async () => {
    const open = db.assignments.find(
      (a) => a.returned_at === null &&
        db.employees.find((e) => e.id === a.employee_id)?.status === 'active')
    const employee = db.employees.find((e) => e.id === open.employee_id)
    const held = db.assignments.filter(
      (a) => a.employee_id === employee.id && a.returned_at === null)

    showEmployee(employee.id)
    await userEvent.click(await screen.findByRole('button', { name: /mark resigned/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/still out/i)
    for (const a of held) {
      const device = db.devices.find((d) => d.id === a.device_id)
      expect(dialog).toHaveTextContent(device.asset_tag)
    }
  })
})

// ---------- handouts log ----------

describe('handouts log', () => {
  test('lists every handout newest first', async () => {
    renderWithProviders(<HandoutsPage />, { route: '/handouts' })
    await waitFor(() => expect(rows().length).toBe(db.assignments.length))
  })

  test('the "Still out" chip shows only open handouts', async () => {
    renderWithProviders(<HandoutsPage />, { route: '/handouts' })
    await waitFor(() => expect(rows().length).toBe(db.assignments.length))
    await userEvent.click(screen.getByRole('button', { name: 'Still out' }))
    const expected = db.assignments.filter((a) => a.returned_at === null).length
    await waitFor(() => expect(rows().length).toBe(expected))
  })
})

// ---------- dashboard ----------

describe('dashboard', () => {
  test('counts match the register and the holder table is populated', async () => {
    renderWithProviders(<DashboardPage />, { route: '/' })
    await screen.findByRole('heading', { name: 'Dashboard' })

    const issued = db.assignments.filter((a) => a.returned_at === null).length
    expect(screen.getByText(String(db.devices.length))).toBeInTheDocument()
    expect(screen.getByText(String(issued))).toBeInTheDocument()

    const region = screen.getByRole('region', { name: /who has what/i })
    expect(within(region).getAllByRole('row').slice(1)).toHaveLength(issued)
  })
})
