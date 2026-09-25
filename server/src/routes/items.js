import { Router } from 'express'
import { requireRole } from '../middleware/access.js'
import { int, itemUpdate, one, oneOf, parse, ITEM_STATUS_FILTERS } from '../validation.js'
import { deleteItem, listItems, updateItem } from '../services/items.js'

/** Mounted at /api/items (app.js), after `signedIn`. The Inventory page:
 *  cross-session search/edit/delete, scoped by department (R1: heads
 *  include their own department's archived sessions; scanners never reach
 *  this router at all). */
export function itemsRouter({ db }) {
  const router = Router()
  const canManage = requireRole('admin', 'head')
  const admin = requireRole('admin')

  router.get('/', canManage, async (req, res) => {
    const session_id = one(req.query.session_id)
    const status = oneOf(req.query.status, ITEM_STATUS_FILTERS, 'status')
    const q = one(req.query.q)
    // Clamped, never trusted as-is - a huge offset is just an empty page.
    const page = int(req.query.page, 'page', { min: 1, max: 100_000, fallback: 1 })
    const page_size = int(req.query.page_size, 'page_size', { min: 1, max: 500, fallback: 100 })
    res.json({ data: await listItems(db, req.user, { session_id, status, q, page, page_size }) })
  })

  router.patch('/:id', canManage, async (req, res) => {
    res.json({ data: await updateItem(db, req.params.id, parse(itemUpdate, req.body), req.user) })
  })

  router.delete('/:id', admin, async (req, res) => {
    res.json({ data: await deleteItem(db, req.params.id, req.user) })
  })

  return router
}
