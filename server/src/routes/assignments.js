import { Router } from 'express'
import { bool, date, issueCreate, one, parse, returnCreate } from '../validation.js'
import { issueDevice, listAssignments, returnDevice } from '../services/assignments.js'

export function assignmentsRouter({ db }) {
  const router = Router()

  router.get('/', async (req, res) => {
    const q = req.query
    res.json({
      data: await listAssignments(db, {
        device_id: one(q.device_id),
        employee_id: one(q.employee_id),
        open: bool(q.open),
        from: date(q.from, 'from'),
        to: date(q.to, 'to'),
      }),
    })
  })

  // 201 with an optional `warning` beside `data` - a same-type handout is
  // allowed and recorded, and the UI confirms it rather than blocking it.
  router.post('/', async (req, res) => {
    const { data, warning } = await issueDevice(db, parse(issueCreate, req.body), req.user)
    res.status(201).json(warning ? { data, warning } : { data })
  })

  router.post('/:id/return', async (req, res) => {
    res.json({ data: await returnDevice(db, req.params.id, parse(returnCreate, req.body), req.user) })
  })

  return router
}
