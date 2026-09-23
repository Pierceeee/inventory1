// Phase 3: uploading an Excel/CSV sheet into a session - dry run, commit,
// column merging, duplicate handling, and Clear Items.
import { useTestApi, STAFF, departmentNamed, activeSessionIn } from './support/api.js'

const t = useTestApi()

const itSession = (fx) => activeSessionIn(fx, 'IT') // f1: 12 items, 6 scanned
const creativeSession = (fx) => activeSessionIn(fx, 'Creative') // f2: 9 items, 3 scanned
const completedSession = (fx) => fx.sessions.find((s) => s.name === 'IT Phones Q2 2026')

// GET /:id/items now returns { items, total, page, page_size } - a session
// can hold thousands of items, so filtering/paging happens server-side.
const itemsOf = (sessionId, params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString()
  return t.api.get(`/api/sessions/${sessionId}/items${qs ? `?${qs}` : ''}`)
}

describe('dry run', () => {
  test('a dry run reports what would be added and writes nothing', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['itemName'],
      rows: [{ line: 2, item_code: 'IT-LAP-100', data: { itemName: 'New Laptop' } }],
      commit: false,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(1)
    expect(res.body.data.skipped).toBe(0)

    const items = await itemsOf(session.id)
    expect(items.body.data.items.find((i) => i.item_code === 'IT-LAP-100')).toBeUndefined()
    expect(items.body.data.total).toBe(12)
  })
})

describe('commit', () => {
  test('commit adds every row with its item code and every other column as data', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['itemName', 'notes'],
      rows: [{ line: 2, item_code: 'IT-LAP-100', data: { itemName: 'New Laptop', notes: 'Fresh stock' } }],
      commit: true,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(1)

    const items = await itemsOf(session.id)
    const added = items.body.data.items.find((i) => i.item_code === 'IT-LAP-100')
    expect(added.data).toEqual({ itemName: 'New Laptop', notes: 'Fresh stock' })
    expect(added.status).toBe('pending')
  })

  test('columns are stored in spreadsheet order and display columns as chosen', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const created = await t.api.post('/api/sessions', { name: 'Fresh Session', department_id: it.id })
    const session = created.body.data

    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['Zebra', 'Alpha'], display_columns: ['Alpha'],
      rows: [{ line: 2, item_code: 'X-1', data: { Zebra: 'z', Alpha: 'a' } }],
      commit: true,
    })
    expect(res.body.data.columns).toEqual(['Zebra', 'Alpha'])
    expect(res.body.data.display_columns).toEqual(['Alpha'])
  })

  test('rows are inserted in spreadsheet (line) order, whatever order they arrive in', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const created = await t.api.post('/api/sessions', { name: 'Out Of Order', department_id: it.id })
    const session = created.body.data

    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['itemName'],
      rows: [
        { line: 4, item_code: 'C-3', data: { itemName: 'Third' } },
        { line: 2, item_code: 'A-1', data: { itemName: 'First' } },
        { line: 3, item_code: 'B-2', data: { itemName: 'Second' } },
      ],
      commit: true,
    })
    expect(res.body.data.created).toBe(3)

    const items = await itemsOf(session.id)
    expect(items.body.data.items.map((i) => i.item_code)).toEqual(['A-1', 'B-2', 'C-3'])
  })

  test('uploading again merges new columns after the existing ones', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['itemName', 'newColumn'],
      rows: [{ line: 2, item_code: 'IT-LAP-101', data: { itemName: 'X', newColumn: 'Y' } }],
      commit: true,
    })
    expect(res.body.data.columns).toEqual(
      ['itemName', 'serialNumber', 'assignedTo', 'location', 'remarks', 'newColumn'])
  })

  test('two concurrent imports adding different new columns both keep their column', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const created = await t.api.post('/api/sessions', { name: 'Concurrent Columns', department_id: it.id })
    const session = created.body.data

    const [first, second] = await Promise.all([
      t.api.post(`/api/sessions/${session.id}/import`, {
        columns: ['FirstColumn'], rows: [{ line: 2, item_code: 'CONC-1', data: { FirstColumn: 'a' } }], commit: true,
      }),
      t.api.post(`/api/sessions/${session.id}/import`, {
        columns: ['SecondColumn'], rows: [{ line: 2, item_code: 'CONC-2', data: { SecondColumn: 'b' } }], commit: true,
      }),
    ])
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const after = await t.api.get(`/api/sessions/${session.id}`)
    expect(after.body.data.columns).toEqual(expect.arrayContaining(['FirstColumn', 'SecondColumn']))
    expect(after.body.data.columns).toHaveLength(2)
  })

  test('the same code imports into two different sessions', async () => {
    const code = 'SHARED-CODE-1'
    const first = await t.api.post(`/api/sessions/${itSession(t.fx).id}/import`, {
      columns: [], rows: [{ line: 2, item_code: code }], commit: true,
    })
    const second = await t.api.post(`/api/sessions/${creativeSession(t.fx).id}/import`, {
      columns: [], rows: [{ line: 2, item_code: code }], commit: true,
    })
    expect(first.body.data.created).toBe(1)
    expect(second.body.data.created).toBe(1)
  })

  test('a code already in the session is skipped and its line reported, whatever its case', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: [], rows: [{ line: 2, item_code: 'it-lap-001' }], commit: true,
    })
    expect(res.body.data.created).toBe(0)
    expect(res.body.data.skipped).toBe(1)
    expect(res.body.data.errors[0]).toMatchObject({ line: 2 })
  })

  test('a code repeated within the file is skipped and its line reported', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: [],
      rows: [{ line: 2, item_code: 'DUP-1' }, { line: 3, item_code: 'dup-1' }],
      commit: true,
    })
    expect(res.body.data.created).toBe(1)
    expect(res.body.data.skipped).toBe(1)
    expect(res.body.data.errors.some((e) => e.line === 3)).toBe(true)
  })

  test('a row missing its item code is skipped and reported by line', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: [], rows: [{ line: 2, item_code: '' }], commit: true,
    })
    expect(res.body.data.created).toBe(0)
    expect(res.body.data.errors[0]).toMatchObject({ line: 2, field: 'item_code' })
  })

  test('a commit with zero valid rows reports the columns actually on the session, not a discarded preview', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['brandNewColumn'], rows: [{ line: 2, item_code: '' }], commit: true,
    })
    expect(res.body.data.created).toBe(0)
    expect(res.body.data.columns).not.toContain('brandNewColumn')
    expect(res.body.data.columns).toEqual(['itemName', 'serialNumber', 'assignedTo', 'location', 'remarks'])

    const after = await t.api.get(`/api/sessions/${session.id}`)
    expect(after.body.data.columns).not.toContain('brandNewColumn')
  })

  test('reserved export columns (Scan Status, Scanned At, Scanned By) are ignored', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['Scan Status', 'Scanned At', 'Scanned By', 'itemName'],
      rows: [{ line: 2, item_code: 'RES-1', data: { 'Scan Status': 'Scanned', itemName: 'Kept' } }],
      commit: true,
    })
    expect(res.body.data.columns).not.toContain('Scan Status')
    expect(res.body.data.columns).not.toContain('Scanned At')
    expect(res.body.data.columns).not.toContain('Scanned By')

    const items = await itemsOf(session.id)
    const added = items.body.data.items.find((i) => i.item_code === 'RES-1')
    expect(added.data).toEqual({ itemName: 'Kept' })
  })

  test('a header named __proto__ is stored as plain data', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const created = await t.api.post('/api/sessions', { name: 'Proto Session', department_id: it.id })
    const session = created.body.data

    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['__proto__'],
      rows: [{ line: 2, item_code: 'P-1', data: { ['__proto__']: 'not-a-prototype' } }],
      commit: true,
    })
    expect(res.status).toBe(200)

    const items = await itemsOf(session.id)
    const added = items.body.data.items.find((i) => i.item_code === 'P-1')
    expect(added.data.__proto__).toBe('not-a-prototype')
  })

  test('empty cells are not stored', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['itemName', 'notes'],
      rows: [{ line: 2, item_code: 'EMPTY-1', data: { itemName: 'Has Name', notes: '   ' } }],
      commit: true,
    })
    expect(res.status).toBe(200)
    const items = await itemsOf(session.id)
    const added = items.body.data.items.find((i) => i.item_code === 'EMPTY-1')
    expect(added.data).toEqual({ itemName: 'Has Name' })
  })

  test('uploading again adds new items and never overwrites existing ones', async () => {
    const session = itSession(t.fx)
    await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: ['itemName'],
      rows: [{ line: 2, item_code: 'IT-LAP-001', data: { itemName: 'Should not overwrite' } }],
      commit: true,
    })
    const items = await itemsOf(session.id)
    expect(items.body.data.total).toBe(12) // unchanged - the only row was a duplicate
    const original = items.body.data.items.find((i) => i.item_code === 'IT-LAP-001')
    expect(original.data.itemName).not.toBe('Should not overwrite')
  })

  test('a completed session refuses import', async () => {
    const res = await t.api.post(`/api/sessions/${completedSession(t.fx).id}/import`, {
      columns: [], rows: [], commit: true,
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_NOT_ACTIVE')
  })

  test("a head cannot import into another department's session", async () => {
    const res = await t.as(STAFF.itHead).post(`/api/sessions/${creativeSession(t.fx).id}/import`, {
      columns: [], rows: [], commit: true,
    })
    expect(res.status).toBe(403)
  })

  test('a scanner cannot import', async () => {
    const res = await t.as(STAFF.itScanner).post(`/api/sessions/${itSession(t.fx).id}/import`, {
      columns: [], rows: [], commit: true,
    })
    expect(res.status).toBe(403)
  })

  test('rows must be a list of at most 10,000', async () => {
    const rows = Array.from({ length: 10_001 }, (_, i) => ({ line: i + 2, item_code: `BULK-${i}` }))
    const res = await t.api.post(`/api/sessions/${itSession(t.fx).id}/import`, {
      columns: [], rows, commit: false,
    })
    expect(res.status).toBe(400)
  })

  test('an upload larger than 5 MB is accepted on the import route', async () => {
    const padding = 'x'.repeat(1000)
    const rows = Array.from({ length: 9000 }, (_, i) => ({
      line: i + 2, item_code: `PAD-${i}`, data: { notes: padding },
    }))
    const res = await t.api.post(`/api/sessions/${itSession(t.fx).id}/import`, {
      columns: ['notes'], rows, commit: false,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(9000)
  })
})

// security M2: the import route's 20MB parser must never run before
// authentication/authorisation - proven by getting rejected, not a body
// error, when neither has happened yet.
describe('import route security', () => {
  test('an unauthenticated request is a 401, never a body-parse 400', async () => {
    const session = itSession(t.fx)
    const res = await t.anonymous.post(`/api/sessions/${session.id}/import`)
      .set('Content-Type', 'application/json')
      .send('{"not valid json')
    expect(res.status).toBe(401)
  })

  test('a scanner is a 403, never a body-parse 400', async () => {
    const session = itSession(t.fx)
    const res = await t.as(STAFF.itScanner).post(`/api/sessions/${session.id}/import`)
      .set('Content-Type', 'application/json')
      .send('{"not valid json')
    expect(res.status).toBe(403)
  })

  test('a body over 5MB on a non-import session route is still rejected (413)', async () => {
    const session = itSession(t.fx)
    const res = await t.api.patch(`/api/sessions/${session.id}`, { name: 'x'.repeat(6 * 1024 * 1024) })
    expect(res.status).toBe(413)
  })
})

describe('clear items', () => {
  test('clear requires the word CLEAR', async () => {
    const res = await t.api.post(`/api/sessions/${itSession(t.fx).id}/clear`, { confirm: 'nope' })
    expect(res.status).toBe(400)
  })

  test('clear removes every item, resets the columns and keeps the session', async () => {
    const session = itSession(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/clear`, { confirm: 'CLEAR' })
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(12)

    const after = await t.api.get(`/api/sessions/${session.id}`)
    expect(after.status).toBe(200)
    expect(after.body.data.columns).toEqual([])
    expect(after.body.data.display_columns).toBeNull()

    const items = await itemsOf(session.id)
    expect(items.body.data.items).toEqual([])
    expect(items.body.data.total).toBe(0)
  })

  test('a completed session refuses clear', async () => {
    const res = await t.api.post(`/api/sessions/${completedSession(t.fx).id}/clear`, { confirm: 'CLEAR' })
    expect(res.status).toBe(409)
  })

  test('a scanner cannot clear', async () => {
    const res = await t.as(STAFF.itScanner).post(`/api/sessions/${itSession(t.fx).id}/clear`, { confirm: 'CLEAR' })
    expect(res.status).toBe(403)
  })
})

describe('listing items', () => {
  test("returns data, status and who scanned, in upload order", async () => {
    const session = itSession(t.fx)
    const res = await itemsOf(session.id)
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(12)
    expect(res.body.data.total).toBe(12)
    expect(res.body.data.items[0].item_code).toBe('IT-LAP-001')
    expect(res.body.data.items[0]).toMatchObject({ status: 'scanned', scanned_by_name: 'Tess Ramos' })
    const pending = res.body.data.items.find((i) => i.status === 'pending')
    expect(pending.scanned_by).toBeNull()
  })

  test('a session with more items than page_size is paginated, and page 2 is reachable', async () => {
    const session = itSession(t.fx)
    const first = await itemsOf(session.id, { page_size: 5 })
    expect(first.body.data.items).toHaveLength(5)
    expect(first.body.data.total).toBe(12)
    expect(first.body.data.page).toBe(1)

    const second = await itemsOf(session.id, { page_size: 5, page: 2 })
    expect(second.body.data.items).toHaveLength(5)
    expect(second.body.data.page).toBe(2)

    const firstCodes = new Set(first.body.data.items.map((i) => i.item_code))
    const secondCodes = new Set(second.body.data.items.map((i) => i.item_code))
    expect([...firstCodes].some((c) => secondCodes.has(c))).toBe(false)
  })

  test('search finds an item beyond the first page', async () => {
    const session = itSession(t.fx)
    const res = await itemsOf(session.id, { page_size: 5, q: 'IT-LAP-012' })
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items[0].item_code).toBe('IT-LAP-012')
  })

  test('status filter counts come from the server, not just the current page', async () => {
    const session = itSession(t.fx)
    const scanned = await itemsOf(session.id, { status: 'scanned', page_size: 2 })
    expect(scanned.body.data.total).toBe(6)
    expect(scanned.body.data.items).toHaveLength(2)

    const pending = await itemsOf(session.id, { status: 'pending', page_size: 2 })
    expect(pending.body.data.total).toBe(6)
  })

  test('an underscore in a search term is matched literally, not as a wildcard', async () => {
    const it = departmentNamed(t.fx, 'IT')
    const created = await t.api.post('/api/sessions', { name: 'Wildcard Session', department_id: it.id })
    const session = created.body.data
    await t.api.post(`/api/sessions/${session.id}/import`, {
      columns: [],
      rows: [{ line: 2, item_code: 'AB_CD' }, { line: 3, item_code: 'ABXCD' }],
      commit: true,
    })

    const res = await itemsOf(session.id, { q: 'AB_CD' })
    expect(res.body.data.items.map((i) => i.item_code)).toEqual(['AB_CD'])
  })
})
