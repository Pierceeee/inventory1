// Phase 4: scanning and the scan log. D1 (Appendix A) governs the atomic
// claim/classify/retry algorithm; OQ9 governs the always-200 response shape.
import {
  useTestApi, STAFF, client, activeSessionIn, sessionWithStatus, pendingItemIn, scannedItemIn, itemsOf, scansOf,
} from './support/api.js'
import { createApp } from '../src/app.js'
import { createScanRateLimiter } from '../src/lib/rateLimit.js'

const t = useTestApi()

const f1 = (fx) => activeSessionIn(fx, 'IT')
const scan = (client, sessionId, code) => client.post(`/api/sessions/${sessionId}/scan`, { code })

describe('scanning', () => {
  test('a scan moves an item from pending to scanned and records who', async () => {
    const session = f1(t.fx)
    const item = pendingItemIn(t.fx, session.id)

    const res = await scan(t.as(STAFF.itScanner), session.id, item.item_code)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      outcome: 'scanned', code: item.item_code,
      scanned_by_name: 'Tess Ramos',
      item: { id: item.id, status: 'scanned', scanned_by_name: 'Tess Ramos' },
    })
    expect(res.body.data.scanned_at).toEqual(expect.any(String))

    await t.refresh()
    const updated = itemsOf(t.fx, session.id).find((i) => i.id === item.id)
    expect(updated.scanned_at).not.toBeNull()
    expect(updated.scanned_by).toBe(t.auth.sessionFor(STAFF.itScanner).user.id)
  })

  test('scanning ignores case and surrounding spaces, and control characters a scanner might append', async () => {
    const session = f1(t.fx)
    const item = pendingItemIn(t.fx, session.id)
    const noisy = `  ${item.item_code.toLowerCase()}\r\n\t\x1d `

    const res = await scan(t.as(STAFF.itScanner), session.id, noisy)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ outcome: 'scanned', code: item.item_code })
  })

  test('scanning ignores invisible Unicode formatting characters', async () => {
    const session = f1(t.fx)
    const item = pendingItemIn(t.fx, session.id)
    // Zero-width space, then the code, then a right-to-left override and a
    // zero-width no-break space (BOM) - the kind of thing a phone keyboard
    // or a paste from a chat app can silently insert.
    const noisy = `​${item.item_code}‮﻿`

    const res = await scan(t.as(STAFF.itScanner), session.id, noisy)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ outcome: 'scanned', code: item.item_code })
  })

  test('scanning it again returns duplicate with the original scanner and time', async () => {
    const session = f1(t.fx)
    // Deterministic in fixture order (§1.6): the first scanned item in f1 is
    // IT-LAP-001, scanned by Tess.
    const item = scannedItemIn(t.fx, session.id)
    expect(item.scanned_by).toBe(t.auth.sessionFor(STAFF.itScanner).user.id)

    const res = await scan(t.as(STAFF.itHead), session.id, item.item_code)

    expect(res.status).toBe(200)
    expect(res.body.data.outcome).toBe('duplicate')
    expect(res.body.data.scanned_by_name).toBe('Tess Ramos')
    expect(new Date(res.body.data.scanned_at).toISOString()).toBe(new Date(item.scanned_at).toISOString())
  })

  test('an unknown code returns not_found and changes nothing', async () => {
    const session = f1(t.fx)
    const before = itemsOf(t.fx, session.id).length

    const res = await scan(t.as(STAFF.itScanner), session.id, 'NOPE-DOES-NOT-EXIST')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ outcome: 'not_found', code: 'NOPE-DOES-NOT-EXIST', item: null })
    await t.refresh()
    expect(itemsOf(t.fx, session.id)).toHaveLength(before)
  })

  test('an empty or over-long code is a 400', async () => {
    const session = f1(t.fx)
    const empty = await scan(t.as(STAFF.itScanner), session.id, '   ')
    expect(empty.status).toBe(400)

    const long = await scan(t.as(STAFF.itScanner), session.id, 'X'.repeat(200))
    expect(long.status).toBe(400)
  })

  test('two scans of the same code at once give exactly one success and one duplicate', async () => {
    const session = f1(t.fx)
    const item = pendingItemIn(t.fx, session.id)

    const results = await Promise.all([
      scan(t.as(STAFF.itScanner), session.id, item.item_code),
      scan(t.as(STAFF.itHead), session.id, item.item_code),
    ])

    const outcomes = results.map((r) => r.body.data.outcome).sort()
    expect(outcomes).toEqual(['duplicate', 'scanned'])
    await t.refresh()
    expect(itemsOf(t.fx, session.id).filter((i) => i.id === item.id && i.scanned_at !== null)).toHaveLength(1)
  })

  test('every outcome is logged to scan_events', async () => {
    const session = f1(t.fx)
    const pending = pendingItemIn(t.fx, session.id)
    const scanned = scannedItemIn(t.fx, session.id)

    await scan(t.as(STAFF.itScanner), session.id, pending.item_code)
    await scan(t.as(STAFF.itScanner), session.id, scanned.item_code)
    await scan(t.as(STAFF.itScanner), session.id, 'GHOST-CODE')

    await t.refresh()
    const events = scansOf(t.fx, session.id)
    expect(events.some((e) => e.item_code === pending.item_code && e.outcome === 'scanned')).toBe(true)
    expect(events.some((e) => e.item_code === scanned.item_code && e.outcome === 'duplicate')).toBe(true)
    expect(events.some((e) => e.item_code === 'GHOST-CODE' && e.outcome === 'not_found')).toBe(true)
  })

  test('a head can scan in their own department', async () => {
    const session = f1(t.fx)
    const item = pendingItemIn(t.fx, session.id)
    const res = await scan(t.as(STAFF.itHead), session.id, item.item_code)
    expect(res.status).toBe(200)
  })

  test('a scanner from another department gets 403', async () => {
    const session = f1(t.fx)
    const res = await scan(t.as(STAFF.creativeScanner), session.id, 'IT-LAP-001')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  test('a scanner with no department gets 403', async () => {
    const session = f1(t.fx)
    const res = await scan(t.as(STAFF.unassigned), session.id, 'IT-LAP-001')
    expect(res.status).toBe(403)
  })

  test('scanning a completed session is refused and nothing is logged', async () => {
    const completed = sessionWithStatus(t.fx, 'completed')
    const before = scansOf(t.fx, completed.id).length

    const res = await scan(t.as(STAFF.admin), completed.id, 'IT-PH-001')

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_NOT_ACTIVE')
    await t.refresh()
    expect(scansOf(t.fx, completed.id)).toHaveLength(before)
  })

  test('scanning an archived session is refused', async () => {
    const archived = sessionWithStatus(t.fx, 'archived')
    const res = await scan(t.as(STAFF.admin), archived.id, 'IT-LAP-001')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_NOT_ACTIVE')
  })
})

describe('recent scans', () => {
  test('are newest first and limited to 10 by default', async () => {
    const session = f1(t.fx) // fixture already carries 8 events for f1

    const res = await t.as(STAFF.itScanner).get(`/api/sessions/${session.id}/scans`)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(10)
    const times = res.body.data.map((e) => new Date(e.created_at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  test('the limit is honoured and capped', async () => {
    const session = f1(t.fx)
    const three = await t.as(STAFF.itScanner).get(`/api/sessions/${session.id}/scans?limit=3`)
    expect(three.body.data).toHaveLength(3)

    const tooMany = await t.as(STAFF.itScanner).get(`/api/sessions/${session.id}/scans?limit=51`)
    expect(tooMany.status).toBe(400)
  })

  test('survive Clear Items', async () => {
    const session = f1(t.fx)
    const before = scansOf(t.fx, session.id).length
    expect(before).toBeGreaterThan(0)

    await t.api.post(`/api/sessions/${session.id}/clear`, { confirm: 'CLEAR' })

    const res = await t.as(STAFF.admin).get(`/api/sessions/${session.id}/scans`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  test('Clear Items logs a cleared event for every item it removes', async () => {
    const session = f1(t.fx)
    const itemCount = itemsOf(t.fx, session.id).length

    await t.api.post(`/api/sessions/${session.id}/clear`, { confirm: 'CLEAR' })

    await t.refresh()
    const cleared = scansOf(t.fx, session.id).filter((e) => e.outcome === 'cleared')
    expect(cleared).toHaveLength(itemCount)
  })

  test('a scanner outside the department gets 403', async () => {
    const session = f1(t.fx)
    const res = await t.as(STAFF.creativeScanner).get(`/api/sessions/${session.id}/scans`)
    expect(res.status).toBe(403)
  })
})

describe('undoing a scan', () => {
  test('an admin undoes a scan: the item is pending again and undone is logged', async () => {
    const session = f1(t.fx)
    const item = scannedItemIn(t.fx, session.id)

    const res = await t.api.post(`/api/sessions/${session.id}/items/${item.id}/undo`)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ id: item.id, status: 'pending', scanned_at: null, scanned_by: null })

    await t.refresh()
    const events = scansOf(t.fx, session.id)
    expect(events.some((e) => e.item_code === item.item_code && e.outcome === 'undone')).toBe(true)
  })

  test('a head trying to undo gets 403', async () => {
    const session = f1(t.fx)
    const item = scannedItemIn(t.fx, session.id)
    const res = await t.as(STAFF.itHead).post(`/api/sessions/${session.id}/items/${item.id}/undo`)
    expect(res.status).toBe(403)
  })

  test('a scanner trying to undo gets 403', async () => {
    const session = f1(t.fx)
    const item = scannedItemIn(t.fx, session.id)
    const res = await t.as(STAFF.itScanner).post(`/api/sessions/${session.id}/items/${item.id}/undo`)
    expect(res.status).toBe(403)
  })

  test('undoing a pending item is a 409 ITEM_NOT_SCANNED', async () => {
    const session = f1(t.fx)
    const item = pendingItemIn(t.fx, session.id)
    const res = await t.api.post(`/api/sessions/${session.id}/items/${item.id}/undo`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ITEM_NOT_SCANNED')
  })

  test('an itemId from another session is a 404 (not applied cross-session)', async () => {
    const session = f1(t.fx)
    const other = t.fx.sessions.find((s) => s.id !== session.id && s.department_name.startsWith('Creative'))
    const foreignItem = scannedItemIn(t.fx, other.id)

    const res = await t.api.post(`/api/sessions/${session.id}/items/${foreignItem.id}/undo`)

    expect(res.status).toBe(404)
    await t.refresh()
    // The foreign item is untouched - the wrong-session id must not reach it.
    expect(itemsOf(t.fx, other.id).find((i) => i.id === foreignItem.id).scanned_at).not.toBeNull()
  })

  test('an unknown item id is a 404', async () => {
    const session = f1(t.fx)
    const res = await t.api.post(`/api/sessions/${session.id}/items/00000000-0000-4000-8000-000000000000/undo`)
    expect(res.status).toBe(404)
  })

  test('undoing in a completed session is refused', async () => {
    const completed = sessionWithStatus(t.fx, 'completed')
    const item = scannedItemIn(t.fx, completed.id)
    const res = await t.api.post(`/api/sessions/${completed.id}/items/${item.id}/undo`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_NOT_ACTIVE')
  })
})

describe('the scan log is append-only', () => {
  test('a direct update is refused', async () => {
    const event = t.fx.scans[0]
    const err = await t.db.query(
      `update scan_events set outcome = 'undone' where id = $1`, [event.id]).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/append-only/)
  })

  test('clearing the item it points at nulls item_id instead of failing', async () => {
    const session = f1(t.fx)
    // Clear Items itself exercises this path (its own delete), but assert it
    // directly too: deleting the item behind a scan event must succeed and
    // only ever null out item_id, never anything else.
    const event = scansOf(t.fx, session.id).find((e) => e.item_id !== null)
    await t.db.query('delete from session_items where id = $1', [event.item_id])
    const { rows: [after] } = await t.db.query('select item_id, outcome from scan_events where id = $1', [event.id])
    expect(after.item_id).toBeNull()
    expect(after.outcome).toBe(event.outcome)
  })

  test('the append-only exception never lets id change alongside item_id', async () => {
    // A row can never be relabelled as a different one while quietly nulling
    // its item_id - the allow-list requires id to stay the same too.
    const event = t.fx.scans[0]
    const err = await t.db.query(
      `update scan_events set item_id = null, id = gen_random_uuid() where id = $1`,
      [event.id],
    ).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/append-only/)
  })
})

describe('database indexes (db review)', () => {
  const indexDef = async (name) => {
    const { rows } = await t.db.query(
      `select indexdef from pg_indexes where tablename = 'scan_events' and indexname = $1`, [name])
    return rows[0]?.indexdef
  }

  test('item_id has its own partial index, so ON DELETE SET NULL never scans the whole table', async () => {
    const def = await indexDef('scan_events_item_idx')
    expect(def).toBeTruthy()
    expect(def).toMatch(/\(item_id\)/)
    expect(def).toMatch(/where \(item_id is not null\)/i)
  })

  test('the recent-scans index covers the id tiebreaker, not just created_at', async () => {
    const def = await indexDef('scan_events_session_created_idx')
    expect(def).toBeTruthy()
    expect(def.replace(/\s+/g, ' ')).toMatch(/session_id, created_at desc, id desc/i)
  })
})

describe('scan volume rate limiting', () => {
  test('a flood past the burst cap is a 429 RATE_LIMITED, never a 401, and does not touch other users', async () => {
    const scanRateLimiter = createScanRateLimiter({ burst: { windowMs: 5000, max: 2 } })
    const app = createApp({ db: t.db, auth: t.auth, settings: { scanRateLimiter } })
    const tess = client(app, t.auth.sessionFor(STAFF.itScanner).token)
    const rina = client(app, t.auth.sessionFor(STAFF.itHead).token)
    const session = f1(t.fx)

    const first = await scan(tess, session.id, 'RL-CHECK-1')
    const second = await scan(tess, session.id, 'RL-CHECK-2')
    const third = await scan(tess, session.id, 'RL-CHECK-3')

    expect(first.status).not.toBe(429)
    expect(second.status).not.toBe(429)
    expect(third.status).toBe(429)
    expect(third.status).not.toBe(401)
    expect(third.body.error.code).toBe('RATE_LIMITED')
    expect(third.headers['retry-after']).toBeTruthy()

    // Tess's own flood does not spend Rina's budget.
    const rinaScan = await scan(rina, session.id, 'RL-CHECK-4')
    expect(rinaScan.status).not.toBe(429)
  })
})
