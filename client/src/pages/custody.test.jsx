import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import DeviceDetailPage from './DeviceDetailPage.jsx'
import LoginPage from './LoginPage.jsx'
import { db } from '../mocks/db.js'
import { returnDevice, issueDevice } from '../api/assignments.js'
import { signIn } from '../api/auth.js'
import { clearSession, setSession } from '../lib/session.js'
import { ApiError } from '../lib/errors.js'

const showDevice = (id) =>
  renderWithProviders(<DeviceDetailPage />, { route: `/devices/${id}`, path: '/devices/:id' })
const openAssignment = () => db.assignments.find((a) => a.returned_at === null)
const freeLaptop = () => db.devices.find(
  (d) => d.type === 'laptop' && d.status === 'available' &&
    !db.assignments.some((a) => a.device_id === d.id && a.returned_at === null))

afterEach(() => clearSession())

// ---------- condition & accessories: the contract ----------

describe('condition and accessories', () => {
  test('a return without a condition is refused, because it is the evidence', async () => {
    const open = openAssignment()
    const error = await returnDevice(open.id, { return_reason: 'swap' }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.details.returned_condition).toMatch(/condition/i)
  })

  test('the pair is stored: what it left in and what it came back in', async () => {
    const open = openAssignment()
    const { data } = await returnDevice(open.id, {
      return_reason: 'resignation', returned_condition: 'damaged',
      returned_accessories: ['charger'],
    })
    expect(data.issued_condition).toBe('good')
    expect(data.returned_condition).toBe('damaged')
    expect(data.issued_accessories).toContain('case')
    expect(data.returned_accessories).toEqual(['charger'])
  })

  // The dispute case: worse condition must be recordable, never blocked.
  test('coming back worse than it went out is allowed, not refused', async () => {
    const open = openAssignment()
    const { data } = await returnDevice(open.id, {
      return_reason: 'other', returned_condition: 'damaged',
    })
    expect(data.returned_condition).toBe('damaged')
    expect(data.returned_at).toEqual(expect.any(String))
  })

  test('accessories are tokens, so nonsense is dropped rather than stored', async () => {
    const device = freeLaptop()
    const employee = db.employees.find((e) => e.status === 'active')
    const { data } = await issueDevice({
      device_id: device.id, employee_id: employee.id,
      issued_accessories: ['charger', 'unicorn', 'sim'],   // sim is mobile-only
    })
    expect(data.issued_accessories).toEqual(['charger'])
  })

  test('an invalid condition value is refused', async () => {
    const device = freeLaptop()
    const employee = db.employees.find((e) => e.status === 'active')
    const error = await issueDevice({
      device_id: device.id, employee_id: employee.id, issued_condition: 'pristine',
    }).catch((e) => e)
    expect(error.status).toBe(400)
    expect(error.details.issued_condition).toBeTruthy()
  })
})

describe('condition in the UI', () => {
  test('the return dialog will not submit until a condition is chosen', async () => {
    const open = openAssignment()
    showDevice(open.device_id)
    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.selectOptions(within(dialog).getByLabelText(/reason/i), 'swap')
    const submit = within(dialog).getByRole('button', { name: /^return device$/i })
    expect(submit).toBeDisabled()

    await userEvent.click(within(dialog).getByRole('radio', { name: /fair/i }))
    expect(submit).toBeEnabled()
  })

  test('it shows what the device went out as, so the comparison is visible', async () => {
    const open = openAssignment()
    showDevice(open.device_id)
    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/went out as/i)
  })

  test('choosing a worse condition says so rather than letting it pass unnoticed', async () => {
    const open = openAssignment()
    showDevice(open.device_id)
    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('radio', { name: /damaged/i }))
    expect(dialog).toHaveTextContent(/worse than it left/i)
  })

  test('unticking an accessory names what is not coming back', async () => {
    const open = openAssignment()
    showDevice(open.device_id)
    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')

    const charger = within(dialog).getByRole('checkbox', { name: /charger/i })
    await waitFor(() => expect(charger).toBeChecked())
    await userEvent.click(charger)
    expect(dialog).toHaveTextContent(/not coming back: charger/i)
  })

  test('the confirmation reports deterioration and missing items', async () => {
    const open = openAssignment()
    showDevice(open.device_id)
    await userEvent.click(await screen.findByRole('button', { name: /return device/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.selectOptions(within(dialog).getByLabelText(/reason/i), 'resignation')
    await userEvent.click(within(dialog).getByRole('radio', { name: /damaged/i }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /charger/i }))
    await userEvent.click(within(dialog).getByRole('button', { name: /^return device$/i }))

    expect(await screen.findByText(/good → damaged/i)).toBeInTheDocument()
    expect(screen.getByText(/charger.*not returned/i)).toBeInTheDocument()
  })

  test('history shows the condition pair and flags deterioration', async () => {
    // ASP-0025 came back damaged with its case missing.
    const damaged = db.assignments.find((a) => a.returned_condition === 'damaged')
    showDevice(damaged.device_id)
    const region = await screen.findByRole('region', { name: /history/i })
    expect(region).toHaveTextContent(/deteriorated/i)
    expect(region).toHaveTextContent(/not returned/i)
  })
})

// ---------- who recorded it ----------

describe('authentication', () => {
  test('correct credentials return a token and the user', async () => {
    const { data } = await signIn('allen@adspark.ph', 'adspark')
    expect(data.token).toEqual(expect.any(String))
    expect(data.user.full_name).toBe('Allen Lacoste')
    expect(data.user.password).toBeUndefined()      // never leaves the server
  })

  // Saying which half was wrong tells an attacker which addresses are real.
  test('a wrong password and an unknown email give the same message', async () => {
    const wrongPassword = await signIn('allen@adspark.ph', 'nope').catch((e) => e)
    const unknownEmail = await signIn('ghost@adspark.ph', 'adspark').catch((e) => e)
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.message).toBe(unknownEmail.message)
  })

  test('a handout records who recorded it, taken from the token not the body', async () => {
    const { data: auth } = await signIn('rina@adspark.ph', 'adspark')
    setSession(auth)

    const device = freeLaptop()
    const employee = db.employees.find((e) => e.status === 'active')
    const { data } = await issueDevice({
      device_id: device.id, employee_id: employee.id,
      issued_by: 'someone-else',                    // must be ignored
    })
    expect(data.issued_by).toBe(auth.user.id)
    expect(data.issued_by_name).toBe('Rina Delgado')
  })

  test('signing in takes you where you were headed', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })
    await userEvent.type(screen.getByLabelText(/email/i), 'kim@adspark.ph')
    await userEvent.type(screen.getByLabelText(/password/i), 'adspark')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  test('bad credentials are reported without clearing what was typed', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })
    await userEvent.type(screen.getByLabelText(/email/i), 'allen@adspark.ph')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(screen.getByLabelText(/email/i)).toHaveValue('allen@adspark.ph')
  })

  test('history names who recorded each handout', async () => {
    showDevice(db.devices[0].id)
    const region = await screen.findByRole('region', { name: /history/i })
    expect(region).toHaveTextContent(/issued .* by (Allen|Rina|Kim)/i)
  })
})
