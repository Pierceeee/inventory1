import { Router } from 'express'
import { requireRole } from '../middleware/access.js'
import { departmentCreate, departmentUpdate, parse } from '../validation.js'
import { createDepartment, listDepartments, updateDepartment } from '../services/departments.js'

/** Every route here is admin-only (§1.7): departments are company structure,
 *  not something a head or scanner can see or change. */
export function departmentsRouter({ db }) {
  const router = Router()
  const admin = requireRole('admin')

  router.get('/', admin, async (req, res) => {
    res.json({ data: await listDepartments(db) })
  })

  router.post('/', admin, async (req, res) => {
    res.status(201).json({ data: await createDepartment(db, parse(departmentCreate, req.body)) })
  })

  router.patch('/:id', admin, async (req, res) => {
    res.json({ data: await updateDepartment(db, req.params.id, parse(departmentUpdate, req.body)) })
  })

  return router
}
