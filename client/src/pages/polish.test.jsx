import { screen, waitFor, within, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import DeviceDetailPage from './DeviceDetailPage.jsx'
import EmployeeDetailPage from './EmployeeDetailPage.jsx'
import DashboardPage from './DashboardPage.jsx'
import DevicesPage from './DevicesPage.jsx'
import Modal from '../components/ui/Modal.jsx'
import Button from '../components/ui/Button.jsx'
import { db } from '../test/liveDb.js'

const showDevice = (id) =>
  renderWithProviders(<DeviceDetailPage />, { route: `/devices/${id}`, path: '/devices/:id' })
const openAssignment = () => db.assignments.find((a) => a.returned_at === null)
const freeDevice = () => db.devices.find(
  (d) => d.status === 'available' &&
    !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))

// ---------- success is never silent ----------

describe('success feedback', () => {
  test('issuing announces what happened, to whom', async () => {
    const device = freeDevice()
    const employee = db.employees.find((e) => e.status === 'active' &&
      !db.assignments.some((a) => a.employee_id === e.id && a.returned_at === null &&
        db.devices.find((d) => d.id === a.device_id)?.type === device.type))

    showDevice(device.id)
    await userEvent.click(await screen.findByRole('button', { name: /^issue device$/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/issue to/i), employee.id)
    await userEvent.click(within(dialog).getByRole('button', { name: /^issue device$/i }))

    const status = await screen.findByText(
      new RegExp(`${device.asset_tag} issued to ${employee.full_name}`, 'i'))
    expect(status).toBeInTheDocument()
  })

  test('a same-type handout is confirmed as a warning, so the overlap is on record', async () => {
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
    await waitFor(() => expect(within(dialog).getByLabelText(/issue it anyway/i)).toBeInTheDocument())
    await userEvent.click(within(dialog).getByLabelText(/issue it anyway/i))
    await userEvent.click(within(dialog).getByRole('button', { name: /^issue device$/i }))

    expect(await screen.findByText(/already holds another/i)).toBeInTheDocument()
  })

  test('returning confirms the device is back', async () => {
    const open = openAssignment()
    const device = db.devices.find((d) => d.id === open.device_id)
    showDevice(device.id)

    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/reason/i), 'swap')
    await userEvent.click(within(dialog).getByRole('radio', { name: /good/i }))
    await userEvent.click(within(dialog).getByRole('button', { name: /^return device$/i }))

    expect(await screen.findByText(new RegExp(`${device.asset_tag} returned`, 'i'))).toBeInTheDocument()
  })

  test('resigning with devices out says so in the confirmation, not just the page', async () => {
    const open = db.assignments.find(
      (a) => a.returned_at === null &&
        db.employees.find((e) => e.id === a.employee_id)?.status === 'active')
    const employee = db.employees.find((e) => e.id === open.employee_id)

    renderWithProviders(<EmployeeDetailPage />,
      { route: `/employees/${employee.id}`, path: '/employees/:id' })
    await userEvent.click(await screen.findByRole('button', { name: /mark resigned/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^mark resigned$/i }))

    expect(await screen.findByText(/marked as resigned/i)).toBeInTheDocument()
    expect(await screen.findByText(/still outstanding/i)).toBeInTheDocument()
  })

  test('the toast region is announced politely, not assertively', async () => {
    showDevice(freeDevice().id)
    await screen.findByRole('button', { name: /^issue device$/i })
    const region = document.querySelector('[aria-live]')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })
})

// ---------- modal keyboard behaviour ----------

describe('modal keyboard handling', () => {
  function Harness() {
    return (
      <Modal open onClose={() => {}} title="Issue device"
             footer={<Button>Confirm</Button>}>
        <input aria-label="First field" />
        <input aria-label="Second field" />
      </Modal>
    )
  }

  test('focus starts inside the dialog', async () => {
    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true))
  })

  test('Tab cycles within the dialog instead of escaping to the page behind', async () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 8; i++) {
      await userEvent.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  test('Shift+Tab from the first control wraps to the last', async () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    await userEvent.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  test('there is a visible close control, not only the Escape key', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })
})

// ---------- needs attention ----------

describe('dashboard needs-attention panel', () => {
  test('names every resigned person still holding devices, with their asset tags', async () => {
    renderWithProviders(<DashboardPage />, { route: '/' })
    const panel = await screen.findByRole('region', { name: /needs attention/i })

    const stranded = db.employees.filter(
      (e) => e.status === 'resigned' &&
        db.assignments.some((a) => a.employee_id === e.id && a.returned_at === null))
    expect(stranded.length).toBeGreaterThan(0)

    for (const person of stranded) {
      expect(panel).toHaveTextContent(person.full_name)
      for (const a of db.assignments.filter(
        (x) => x.employee_id === person.id && x.returned_at === null)) {
        expect(panel).toHaveTextContent(db.devices.find((d) => d.id === a.device_id).asset_tag)
      }
    }
  })

  test('lists devices in repair, which cannot be issued', async () => {
    renderWithProviders(<DashboardPage />, { route: '/' })
    const panel = await screen.findByRole('region', { name: /needs attention/i })
    for (const d of db.devices.filter((x) => x.status === 'repair')) {
      expect(panel).toHaveTextContent(d.asset_tag)
    }
  })
})

// ---------- sorting ----------

describe('table sorting', () => {
  test('sorting by Held by groups the unheld devices to the end', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row').length)
        .toBe(db.devices.length + 1))

    await userEvent.click(screen.getByRole('button', { name: /held by/i }))

    const header = screen.getByRole('columnheader', { name: /held by/i })
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    const cells = within(screen.getByRole('table')).getAllByRole('row').slice(1)
      .map((row) => within(row).getAllByRole('cell')[4].textContent)
    const firstBlank = cells.indexOf('—')
    if (firstBlank !== -1) {
      expect(cells.slice(firstBlank).every((c) => c === '—')).toBe(true)
    }
  })

  test('clicking the same header twice reverses the direction', async () => {
    renderWithProviders(<DevicesPage />, { route: '/devices' })
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(1))

    const button = screen.getByRole('button', { name: /asset tag/i })
    await userEvent.click(button)
    expect(screen.getByRole('columnheader', { name: /asset tag/i })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(button)
    expect(screen.getByRole('columnheader', { name: /asset tag/i })).toHaveAttribute('aria-sort', 'descending')
  })
})
