import { conflict, invalid, notFound } from '../lib/errors.js'
import { isUuid } from '../lib/values.js'
import { toItem } from './sessionItems.js'
import { isSessionClosedError, sessionNotActive } from './inventorySessions.js'
import { upsertProfile } from './profiles.js'

// Handheld scanners and camera decodes both send raw bytes: strip control
// characters (CR, LF, TAB, and the Group Separator 0x1D some scanners append
// between symbologies) plus invisible Unicode formatting characters a paste
// or a phone keyboard can slip in - zero-width space/joiners, bidi marks and
// embedding/override/isolate controls, word joiner/invisible math operators,
// and the zero-width no-break space (BOM) - then trim (D1). Every other
// check on the result happens after this runs, never on the raw body.
const CONTROL_CHARS = /[\x00-\x1f\x7f​-‏‪-‮⁠-⁤⁦-⁩﻿]/g
export const normaliseCode = (raw) => String(raw ?? '').replace(CONTROL_CHARS, '').trim()

const detailOf = (tx, id) =>
  tx.query('select * from session_item_details where id = $1', [id]).then((r) => r.rows[0])

/** The one statement the scan can succeed with: claims the item only if it
 *  is still pending, atomically - the database (not app logic) is what
 *  guarantees exactly one of two concurrent scans of the same code wins. */
async function tryClaim(tx, sessionId, code, actorId) {
  const { rows: [claimed] } = await tx.query(
    `update session_items set scanned_at = now(), scanned_by = $3
      where session_id = $1 and lower(item_code) = lower($2) and scanned_at is null
      returning id`,
    [sessionId, code, actorId],
  )
  return claimed ? detailOf(tx, claimed.id) : undefined
}

/**
 * Always resolves (never throws for scanned/duplicate/not_found - all three
 * are 200s, OQ9). Every outcome, including not_found, is logged.
 */
export async function scanItem(db, session, rawCode, actor) {
  const code = normaliseCode(rawCode)
  if (!code || code.length > 128) throw invalid({ code: 'Enter a valid item code.' })

  // Keeps the recorded scanner's name current, same as every other write.
  await upsertProfile(db, actor)

  try {
    return await db.transaction(async (tx) => {
      let item = await tryClaim(tx, session.id, code, actor.id)
      let outcome = item ? 'scanned' : undefined

      if (!item) {
        const { rows: [existing] } = await tx.query(
          'select * from session_item_details where session_id = $1 and lower(item_code) = lower($2)',
          [session.id, code],
        )
        if (!existing) {
          outcome = 'not_found'
        } else if (existing.scanned_at === null) {
          // Undone or cleared between our UPDATE and this SELECT - retry the
          // claim once (D1) before settling on duplicate.
          const retried = await tryClaim(tx, session.id, code, actor.id)
          if (retried) { item = retried; outcome = 'scanned' } else { item = existing; outcome = 'duplicate' }
        } else {
          item = existing
          outcome = 'duplicate'
        }
      }

      await tx.query(
        `insert into scan_events (session_id, item_id, item_code, outcome, actor)
         values ($1, $2, $3, $4, $5)`,
        [session.id, item?.id ?? null, item?.item_code ?? code, outcome, actor.id],
      )

      const result = item ? toItem(item) : null
      return {
        outcome,
        code: result?.item_code ?? code,
        item: result,
        scanned_by_name: result?.scanned_by_name ?? null,
        scanned_at: result?.scanned_at ?? null,
      }
    })
  } catch (err) {
    if (isSessionClosedError(err)) throw sessionNotActive(session)
    throw err
  }
}

/** Admin-only (enforced by the route). `itemId` must belong to THIS session
 *  (security: IDOR) - an id from another session is a 404, exactly like an
 *  id that does not exist at all. */
export async function undoScan(db, session, itemId, actor) {
  if (!isUuid(itemId)) throw notFound('Item')

  try {
    return await db.transaction(async (tx) => {
      const { rows: [row] } = await tx.query(
        `update session_items set scanned_at = null, scanned_by = null
          where id = $1 and session_id = $2 and scanned_at is not null
          returning item_code`,
        [itemId, session.id],
      )

      if (!row) {
        const { rows: [existing] } = await tx.query(
          'select item_code from session_items where id = $1 and session_id = $2', [itemId, session.id])
        if (!existing) throw notFound('Item')
        throw conflict('ITEM_NOT_SCANNED', `${existing.item_code} has not been scanned.`)
      }

      await tx.query(
        `insert into scan_events (session_id, item_id, item_code, outcome, actor)
         values ($1, $2, $3, 'undone', $4)`,
        [session.id, itemId, row.item_code, actor.id],
      )

      return toItem(await detailOf(tx, itemId))
    })
  } catch (err) {
    if (isSessionClosedError(err)) throw sessionNotActive(session)
    throw err
  }
}

export async function listRecentScans(db, session, { limit = 10 } = {}) {
  const { rows } = await db.query(
    `select e.id, e.session_id, e.item_id, e.item_code, e.outcome, e.actor,
            p.full_name as actor_name, e.created_at
       from scan_events e left join profiles p on p.id = e.actor
      where e.session_id = $1
      order by e.created_at desc, e.id desc
      limit $2`,
    [session.id, limit],
  )
  return rows
}
