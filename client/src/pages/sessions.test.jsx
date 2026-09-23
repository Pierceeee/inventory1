// Phase 2+3 client tests: the Sessions list, creating a session, uploading a
// spreadsheet, choosing columns, clearing items and completing a session.
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as XLSX from 'xlsx'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import { signInAs } from '../test/signInAs.js'
import { db } from '../test/liveDb.js'
import { importSessionItems } from '../api/inventorySessions.js'
import App from '../App.jsx'

function xlsxFile(rows, name = 'items.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Items')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

const sessionCard = async (name) =>
  (await screen.findByRole('link', { name })).closest('.rounded-xl')

const sessionNamed = (name) => db.sessions.find((s) => s.name === name)

describe('Sessions page', () => {
  test('the Sessions page shows a card per session with status and progress', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    await screen.findByText('IT Laptops Q3 2026')
    expect(screen.getByText('Creative Kit Q3 2026')).toBeInTheDocument()
    expect(screen.getByText('6 of 12 scanned')).toBeInTheDocument()
  })

  test('a scanner sees no New Session or Upload buttons', async () => {
    await signInAs('tess@adspark.ph')
    renderWithProviders(<App />, { route: '/sessions' })
    await screen.findByText('IT Laptops Q3 2026')
    expect(screen.queryByRole('button', { name: /new session/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload excel/i })).not.toBeInTheDocument()
  })

  test('a scanner without a department is told to ask an admin', async () => {
    await signInAs('nina@adspark.ph')
    renderWithProviders(<App />, { route: '/sessions' })
    expect(await screen.findByText(/ask an admin/i)).toBeInTheDocument()
  })

  test('an admin creates a session in a chosen department', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    await userEvent.click(await screen.findByRole('button', { name: /new session/i }))
    await userEvent.type(screen.getByLabelText(/^name/i), 'Finance Audit Q4')
    await waitFor(() => expect(screen.getByLabelText(/department/i).children.length).toBeGreaterThan(1))
    const finance = db.departments.find((d) => d.name.startsWith('Finance'))
    await userEvent.selectOptions(screen.getByLabelText(/department/i), finance.name)
    await userEvent.click(screen.getByRole('button', { name: /create session/i }))

    await screen.findByRole('heading', { name: 'Finance Audit Q4' })
  })

  test("a head's new session goes into their department without asking", async () => {
    await signInAs('rina@adspark.ph')
    renderWithProviders(<App />, { route: '/sessions' })
    await userEvent.click(await screen.findByRole('button', { name: /new session/i }))
    await userEvent.type(screen.getByLabelText(/^name/i), 'Rina New Session')
    expect(screen.queryByRole('combobox', { name: /department/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /create session/i }))

    await screen.findByRole('heading', { name: 'Rina New Session' })
    expect(within(screen.getByRole('main')).getByText(/IT \(example\)/)).toBeInTheDocument()
  })
})

describe('Uploading a spreadsheet', () => {
  test('uploading an .xlsx detects the item code column and imports its rows', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    const card = await sessionCard('IT Laptops Q3 2026')
    await userEvent.click(within(card).getByRole('button', { name: /upload excel/i }))

    const file = xlsxFile([['Item Code', 'Notes'], ['NEW-1', 'First'], ['NEW-2', 'Second']])
    await userEvent.upload(screen.getByLabelText('Choose a spreadsheet'), file)
    await screen.findByText(/Item codes: column/i)

    await userEvent.click(screen.getByRole('button', { name: /check file/i }))
    await screen.findByText(/will be added/i)

    await userEvent.click(screen.getByRole('button', { name: /^import \d+ items?/i }))
    const dialog = screen.getByRole('dialog')
    await within(dialog).findByText(/added 2 items/i)
  })

  test('dropping a file onto the zone reads it', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    const card = await sessionCard('IT Laptops Q3 2026')
    await userEvent.click(within(card).getByRole('button', { name: /upload excel/i }))

    const file = xlsxFile([['Item Code'], ['DROP-1']])
    const dropzone = screen.getByText(/drag a spreadsheet here/i).closest('label')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await screen.findByText(/Item codes: column/i)
  })

  test('a file without an item code column is refused before upload', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    const card = await sessionCard('IT Laptops Q3 2026')
    await userEvent.click(within(card).getByRole('button', { name: /upload excel/i }))

    const file = xlsxFile([['Name'], ['Just a name']], 'no-code.xlsx')
    await userEvent.upload(screen.getByLabelText('Choose a spreadsheet'), file)

    expect(await screen.findByText(/no item code column/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check file/i })).not.toBeInTheDocument()
  })

  test('the import result lists skipped rows by line', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    const card = await sessionCard('IT Laptops Q3 2026')
    await userEvent.click(within(card).getByRole('button', { name: /upload excel/i }))

    const file = xlsxFile([['Item Code'], ['IT-LAP-001'], ['NEW-5']])
    await userEvent.upload(screen.getByLabelText('Choose a spreadsheet'), file)
    await screen.findByText(/Item codes: column/i)
    await userEvent.click(screen.getByRole('button', { name: /check file/i }))

    await screen.findByText(/already exist/i)
    const table = screen.getByRole('table')
    expect(within(table).getByText('2')).toBeInTheDocument() // IT-LAP-001's spreadsheet line
  })

  test('reserved export columns are listed as ignored, not silently dropped', async () => {
    renderWithProviders(<App />, { route: '/sessions' })
    const card = await sessionCard('IT Laptops Q3 2026')
    await userEvent.click(within(card).getByRole('button', { name: /upload excel/i }))

    const file = xlsxFile([['Item Code', 'Scan Status'], ['RES-1', 'Scanned']])
    await userEvent.upload(screen.getByLabelText('Choose a spreadsheet'), file)

    expect(await screen.findByText(/ignored columns/i)).toBeInTheDocument()
    expect(screen.getByText(/Scan Status/)).toBeInTheDocument()
  })
})

describe('Session detail', () => {
  test('a session with more items than the page size shows a pager, and page 2 is reachable', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026') // starts with 12 items
    const rows = Array.from({ length: 120 }, (_, i) => ({
      line: i + 2, item_code: `BULK-${String(i).padStart(3, '0')}`,
    }))
    await importSessionItems(f1.id, { columns: [], rows, commit: true })

    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await screen.findByText('Showing 1–100 of 132')
    expect(screen.getByRole('button', { name: /^prev$/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /^next$/i }))
    await screen.findByText('Showing 101–132 of 132')
  })

  test('search finds an item beyond the first page', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const rows = Array.from({ length: 120 }, (_, i) => ({
      line: i + 2, item_code: `BULK-${String(i).padStart(3, '0')}`,
    }))
    await importSessionItems(f1.id, { columns: [], rows, commit: true })

    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await screen.findByText('Showing 1–100 of 132')

    await userEvent.type(screen.getByLabelText(/search item code/i), 'BULK-119')
    await screen.findByText('Showing 1–1 of 1')
    expect(screen.getByText('BULK-119')).toBeInTheDocument()
  })

  test('the column picker decides which columns the item table shows', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await screen.findByRole('columnheader', { name: 'serialNumber' })

    // The action buttons depend on the role loaded via /me, which may
    // resolve after the session/items queries (G-12) - wait for it.
    await userEvent.click(await screen.findByRole('button', { name: /choose columns/i }))
    await userEvent.click(await screen.findByRole('checkbox', { name: 'serialNumber' }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: 'serialNumber' })).not.toBeInTheDocument())
  })

  test('Clear All Items stays disabled until CLEAR is typed, then empties the session', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await userEvent.click(await screen.findByRole('button', { name: /clear items/i }))

    const clearButton = screen.getByRole('button', { name: /clear all items/i })
    expect(clearButton).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/type clear to confirm/i), 'CLEAR')
    expect(clearButton).toBeEnabled()

    await userEvent.click(clearButton)
    await screen.findByText('No items yet.')
  })

  test('Mark Complete closes the session and hides Upload', async () => {
    const f2 = sessionNamed('Creative Kit Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f2.id}` })
    await userEvent.click(await screen.findByRole('button', { name: /mark complete/i }))

    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /mark complete/i }))

    await waitFor(() => expect(screen.queryByRole('button', { name: /upload excel/i })).not.toBeInTheDocument())
    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })

  test('a completed session shows a read-only notice', async () => {
    const f3 = sessionNamed('IT Phones Q2 2026')
    renderWithProviders(<App />, { route: `/sessions/${f3.id}` })
    expect(await screen.findByText(/completed and read-only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload excel/i })).not.toBeInTheDocument()
  })
})
