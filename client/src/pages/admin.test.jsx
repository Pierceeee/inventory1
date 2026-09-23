// Role-gated navigation and the new admin screens (Users, Register,
// Departments) - Group 1 of the AKM build.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import { signInAs } from '../test/signInAs.js'
import { clearSession } from '../lib/session.js'
import { db } from '../test/liveDb.js'
import App from '../App.jsx'

const mainNav = () => screen.findByRole('navigation', { name: /main/i })

describe('role-gated navigation', () => {
  test('a scanner signing in lands on Sessions and sees only Sessions in the sidebar', async () => {
    clearSession()
    renderWithProviders(<App />, { route: '/login' })

    await userEvent.type(screen.getByLabelText(/email/i), 'tess@adspark.ph')
    await userEvent.type(screen.getByLabelText(/password/i), 'adspark')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('heading', { name: /sessions/i })
    const nav = await mainNav()
    await waitFor(() => {
      expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Sessions'])
    })
  })

  test('a scanner opening a custody page is sent to Sessions', async () => {
    await signInAs('tess@adspark.ph')
    renderWithProviders(<App />, { route: '/devices' })
    await screen.findByRole('heading', { name: /sessions/i })
  })

  test('an admin sees Custody and an Admin section with Users, Register and Departments', async () => {
    renderWithProviders(<App />, { route: '/' })
    const nav = await mainNav()
    await waitFor(() => expect(within(nav).getByText('Devices')).toBeInTheDocument())
    expect(within(nav).getByText('Users')).toBeInTheDocument()
    expect(within(nav).getByText('Register')).toBeInTheDocument()
    expect(within(nav).getByText('Departments')).toBeInTheDocument()
  })

  test('a head sees custody links but no Admin section', async () => {
    await signInAs('rina@adspark.ph')
    renderWithProviders(<App />, { route: '/' })
    const nav = await mainNav()
    await waitFor(() => expect(within(nav).getByText('Devices')).toBeInTheDocument())
    expect(within(nav).queryByText('Users')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Departments')).not.toBeInTheDocument()
  })
})

describe('Users page', () => {
  test('lists accounts with their role and department', async () => {
    renderWithProviders(<App />, { route: '/users' })
    const cell = await screen.findByText('rina@adspark.ph')
    const row = cell.closest('tr')
    expect(within(row).getByText('Head')).toBeInTheDocument()
    expect(within(row).getByText(/IT/)).toBeInTheDocument()
  })

  test("changing a user's role saves and is shown in the list", async () => {
    renderWithProviders(<App />, { route: '/users' })
    const cell = await screen.findByText('tess@adspark.ph')
    const row = cell.closest('tr')
    await userEvent.click(within(row).getByRole('button', { name: /edit/i }))

    const roleSelect = await screen.findByLabelText(/^role/i)
    await userEvent.selectOptions(roleSelect, 'head')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      const updatedRow = screen.getByText('tess@adspark.ph').closest('tr')
      expect(within(updatedRow).getByText('Head')).toBeInTheDocument()
    })
  })

  test('has no Deactivate button on your own row, but does on another user\'s row', async () => {
    renderWithProviders(<App />, { route: '/users' })

    // Scoped to the table itself - the sidebar can also show the signed-in
    // user's raw email briefly while /me is still loading.
    const table = await screen.findByRole('table')
    const ownRow = (await within(table).findByText('allen@adspark.ph')).closest('tr')
    // Only "Edit" - no second, unlabeled button for the signed-in user's own row.
    expect(within(ownRow).getAllByRole('button')).toHaveLength(1)

    const otherRow = within(table).getByText('tess@adspark.ph').closest('tr')
    expect(within(otherRow).getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
  })
})

describe('Register page', () => {
  test('registering a user adds them to the Users list', async () => {
    renderWithProviders(<App />, { route: '/users/register' })

    await userEvent.type(await screen.findByLabelText(/full name/i), 'Test Person')
    await userEvent.type(screen.getByLabelText(/^email/i), 'test.person@adspark.ph')
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
    await userEvent.selectOptions(screen.getByLabelText(/^role/i), 'scanner')
    await waitFor(() => expect(screen.getByLabelText(/department/i).children.length).toBeGreaterThan(1))
    await userEvent.selectOptions(screen.getByLabelText(/department/i), db.departments[0].name)
    await userEvent.click(screen.getByRole('button', { name: /register user/i }))

    await screen.findByText('test.person@adspark.ph')
  })

  test('the Register form requires a department for heads and scanners', async () => {
    renderWithProviders(<App />, { route: '/users/register' })

    await userEvent.type(await screen.findByLabelText(/full name/i), 'No Dept Head')
    await userEvent.type(screen.getByLabelText(/^email/i), 'nodept.head@adspark.ph')
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123')
    await userEvent.selectOptions(screen.getByLabelText(/^role/i), 'head')
    await userEvent.click(screen.getByRole('button', { name: /register user/i }))

    expect(await screen.findByText(/need a department/i)).toBeInTheDocument()
  })

  test('the password field has a show/hide toggle', async () => {
    renderWithProviders(<App />, { route: '/users/register' })
    const password = await screen.findByLabelText(/^password/i)
    expect(password).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})

describe('Departments page', () => {
  test('adding a department shows it in the list', async () => {
    renderWithProviders(<App />, { route: '/departments' })
    await userEvent.click(await screen.findByRole('button', { name: 'Add Department' }))
    await userEvent.type(screen.getByLabelText(/name/i), 'Operations Test')
    await userEvent.click(screen.getByRole('button', { name: 'Add department' }))

    await screen.findByText('Operations Test')
  })

  test('a duplicate department name is shown on the field', async () => {
    renderWithProviders(<App />, { route: '/departments' })
    await userEvent.click(await screen.findByRole('button', { name: 'Add Department' }))
    await userEvent.type(screen.getByLabelText(/name/i), db.departments[0].name)
    await userEvent.click(screen.getByRole('button', { name: 'Add department' }))

    expect(await screen.findByText(/already/i)).toBeInTheDocument()
  })
})
