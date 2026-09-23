import { Router } from 'express'
import { employeeCreate, employeeUpdate, one, parse } from '../validation.js'
import {
  createEmployee, getEmployee, listEmployees, resignEmployee, updateEmployee,
} from '../services/employees.js'

export function employeesRouter({ db }) {
  const router = Router()

  router.get('/', async (req, res) => {
    res.json({ data: await listEmployees(db, { status: one(req.query.status), q: one(req.query.q) }) })
  })

  router.post('/', async (req, res) => {
    res.status(201).json({ data: await createEmployee(db, parse(employeeCreate, req.body)) })
  })

  router.get('/:id', async (req, res) => {
    res.json({ data: await getEmployee(db, req.params.id) })
  })

  router.patch('/:id', async (req, res) => {
    res.json({ data: await updateEmployee(db, req.params.id, parse(employeeUpdate, req.body)) })
  })

  router.post('/:id/resign', async (req, res) => {
    res.json({ data: await resignEmployee(db, req.params.id) })
  })

  return router
}
