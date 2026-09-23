// Phase 4 client tests: the QR Scanner panel, its manual scan flow, undo,
// and the print-labels page.
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders.jsx'
import { signInAs } from '../test/signInAs.js'
import { db } from '../test/liveDb.js'
import App from '../App.jsx'

const sessionNamed = (name) => db.sessions.find((s) => s.name === name)
const itemsOf = (sessionId) => db.items.filter((i) => i.session_id === sessionId)
const pendingItem = (sessionId) => itemsOf(sessionId).find((i) => !i.scanned_at)
const scannedItem = (sessionId) => itemsOf(sessionId).find((i) => i.scanned_at)

// Scoped to the item table, not just "the first match" - the recent-scans
// list under the scanner shows the same code text once a scan has happened.
const rowFor = async (code) => {
  const table = await screen.findByRole('table')
  return (await within(table).findByText(code)).closest('tr')
}

async function openScanner() {
  const toggle = await screen.findByRole('button', { name: /qr scanner/i })
  await userEvent.click(toggle)
  return toggle
}

describe('the scanner panel', () => {
  test('expands and starts in Manual mode', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })

    await openScanner()

    const manualTab = screen.getByRole('tab', { name: /manual/i })
    expect(manualTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /camera/i })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByLabelText('Item code')).toBeInTheDocument()
  })

  test('is not offered on a completed session', async () => {
    const f3 = sessionNamed('IT Phones Q2 2026')
    renderWithProviders(<App />, { route: `/sessions/${f3.id}` })
    await screen.findByText(/read-only/i)
    expect(screen.queryByRole('button', { name: /qr scanner/i })).not.toBeInTheDocument()
  })

  test('camera mode explains when no camera is available', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    await userEvent.click(screen.getByRole('tab', { name: /camera/i }))

    expect(await screen.findByText(/needs a camera and a secure/i)).toBeInTheDocument()
  })
})

describe('manual scanning', () => {
  test('Enter scans, clears the input and keeps focus for the next code', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = pendingItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    const input = screen.getByLabelText('Item code')
    await userEvent.type(input, `${item.item_code}{Enter}`)

    await screen.findByText(`${item.item_code} scanned.`)
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  test('a successful scan shows a green result and marks the row Scanned', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = pendingItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    await userEvent.type(screen.getByLabelText('Item code'), `${item.item_code}{Enter}`)

    const banner = await screen.findByText(`${item.item_code} scanned.`)
    expect(banner).toHaveClass('bg-ok-50')

    const row = await rowFor(item.item_code)
    await waitFor(() => expect(within(row).getByText('Scanned')).toBeInTheDocument())
  })

  test('an already-scanned code shows a yellow warning naming who scanned it', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = scannedItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    await userEvent.type(screen.getByLabelText('Item code'), `${item.item_code}{Enter}`)

    const banner = await screen.findByText(new RegExp(`${item.item_code} was already scanned by`))
    expect(banner).toHaveClass('bg-warn-50')
  })

  test('an unknown code shows a red not-found result', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    await userEvent.type(screen.getByLabelText('Item code'), 'NOPE-DOES-NOT-EXIST{Enter}')

    const banner = await screen.findByText(/NOPE-DOES-NOT-EXIST is not in this session\./)
    expect(banner).toHaveClass('bg-bad-50')
  })

  test('the ten most recent scans are listed under the scanner', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    const region = await screen.findByRole('region', { name: /recent scans/i })
    // The fixture already seeds 8 events for f1 (§5.4).
    expect(within(region).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(region).getAllByRole('listitem').length).toBeLessThanOrEqual(10)
  })

  test('the recent scans list picks up a new scan', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = pendingItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()
    const region = await screen.findByRole('region', { name: /recent scans/i })
    expect(within(region).queryByText(item.item_code)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Item code'), `${item.item_code}{Enter}`)

    await waitFor(() => expect(within(region).getByText(item.item_code)).toBeInTheDocument())
  })

  test('scanning updates the session progress without reloading the whole item table', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = pendingItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await screen.findByText(/of 12 scanned/)
    const before = itemsOf(f1.id).filter((i) => i.scanned_at).length
    await openScanner()

    await userEvent.type(screen.getByLabelText('Item code'), `${item.item_code}{Enter}`)
    await screen.findByText(`${item.item_code} scanned.`)

    // The session summary (progress) refreshes on its own small query...
    await screen.findByText(new RegExp(`${before + 1} of 12 scanned`))
    // ...while the just-scanned row flips to Scanned via the same cache
    // patch the mutation applies - not a full item-list refetch.
    const row = await rowFor(item.item_code)
    expect(within(row).getByText('Scanned')).toBeInTheDocument()
  })
})

describe('out-of-order responses', () => {
  test('shows the latest result when two scans resolve out of order', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const [item1, item2] = itemsOf(f1.id).filter((i) => !i.scanned_at)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await openScanner()

    // A deferred fetch for the FIRST scan only: it starts before the second
    // one, but is held back so the second one's (real, fast) response lands
    // first - the banner must reflect item2, never the late item1 reply.
    const realFetch = globalThis.fetch.bind(globalThis)
    let releaseFirst
    const gate = new Promise((resolve) => { releaseFirst = resolve })
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).includes('/scan') && typeof options?.body === 'string' && options.body.includes(item1.item_code)) {
        await gate
      }
      return realFetch(url, options)
    })

    const input = screen.getByLabelText('Item code')
    await userEvent.type(input, `${item1.item_code}{Enter}`)
    await userEvent.type(input, `${item2.item_code}{Enter}`)

    await screen.findByText(`${item2.item_code} scanned.`)
    releaseFirst()
    // Give the now-resolving, late first response a chance to (wrongly, if
    // this regresses) overwrite the banner.
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(screen.getByText(`${item2.item_code} scanned.`)).toBeInTheDocument()
    expect(screen.queryByText(`${item1.item_code} scanned.`)).not.toBeInTheDocument()

    spy.mockRestore()
  })
})

describe('scanning under a status filter', () => {
  test('scanning a Pending-filtered item removes it from view, drops the count, and never refetches the list', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = pendingItem(f1.id)
    const pendingCount = itemsOf(f1.id).filter((i) => !i.scanned_at).length
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Pending' }))
    await rowFor(item.item_code)
    await screen.findByText(`Showing 1–${pendingCount} of ${pendingCount}`)

    const spy = vi.spyOn(globalThis, 'fetch')
    const itemsCallsBefore = spy.mock.calls.filter(([url]) => String(url).includes('/items?')).length

    await openScanner()
    await userEvent.type(screen.getByLabelText('Item code'), `${item.item_code}{Enter}`)
    await screen.findByText(`${item.item_code} scanned.`)

    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText(item.item_code)).not.toBeInTheDocument())
    await screen.findByText(`Showing 1–${pendingCount - 1} of ${pendingCount - 1}`)

    const itemsCallsAfter = spy.mock.calls.filter(([url]) => String(url).includes('/items?')).length
    expect(itemsCallsAfter).toBe(itemsCallsBefore)
    spy.mockRestore()
  })

  test('undoing a scan under a Scanned filter removes it from view and drops the count', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = scannedItem(f1.id)
    const scannedCount = itemsOf(f1.id).filter((i) => i.scanned_at).length
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Scanned' }))
    const row = await rowFor(item.item_code)
    await screen.findByText(`Showing 1–${scannedCount} of ${scannedCount}`)

    const spy = vi.spyOn(globalThis, 'fetch')
    const itemsCallsBefore = spy.mock.calls.filter(([url]) => String(url).includes('/items?')).length

    await userEvent.click(within(row).getByRole('button', { name: new RegExp(`undo scan of ${item.item_code}`, 'i') }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^undo scan$/i }))

    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText(item.item_code)).not.toBeInTheDocument())
    await screen.findByText(`Showing 1–${scannedCount - 1} of ${scannedCount - 1}`)

    const itemsCallsAfter = spy.mock.calls.filter(([url]) => String(url).includes('/items?')).length
    expect(itemsCallsAfter).toBe(itemsCallsBefore)
    spy.mockRestore()
  })
})

describe('undo', () => {
  test('an admin sees the undo button and undo returns the item to Pending', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = scannedItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })

    const row = await rowFor(item.item_code)
    await userEvent.click(within(row).getByRole('button', { name: new RegExp(`undo scan of ${item.item_code}`, 'i') }))

    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^undo scan$/i }))

    await waitFor(() => expect(within(row).getByText('Pending')).toBeInTheDocument())
  })

  test('a non-admin does not see the undo button', async () => {
    await signInAs('rina@adspark.ph')
    const f1 = sessionNamed('IT Laptops Q3 2026')
    const item = scannedItem(f1.id)
    renderWithProviders(<App />, { route: `/sessions/${f1.id}` })

    const row = await rowFor(item.item_code)
    expect(within(row).queryByRole('button', { name: /undo scan/i })).not.toBeInTheDocument()
  })
})

describe('print QR labels', () => {
  test('renders one labelled QR image per item', async () => {
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}/labels` })

    const main = await screen.findByRole('main')
    await waitFor(() => expect(within(main).getAllByRole('img')).toHaveLength(itemsOf(f1.id).length))

    const images = within(main).getAllByRole('img')
    expect(images.map((img) => img.alt).sort()).toEqual(itemsOf(f1.id).map((i) => i.item_code).sort())
  })

  test('a non-admin opening the labels page is sent home', async () => {
    await signInAs('tess@adspark.ph')
    const f1 = sessionNamed('IT Laptops Q3 2026')
    renderWithProviders(<App />, { route: `/sessions/${f1.id}/labels` })

    const main = await screen.findByRole('main')
    await within(main).findByRole('heading', { name: 'Sessions' })
    expect(within(main).queryByRole('img')).not.toBeInTheDocument()
  })
})
