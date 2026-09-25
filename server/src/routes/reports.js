import { Router } from 'express'
import { bool, date, importBatch, parse } from '../validation.js'
import { requireRole } from '../middleware/access.js'
import { CUSTODY_ROLES } from '../lib/values.js'
import { getDashboard } from '../services/dashboard.js'
import { getAuditDashboard } from '../services/auditDashboard.js'
import { exportAssignmentsCsv } from '../services/exports.js'
import { importDevices, importEmployees } from '../services/imports.js'

/** Dashboard, CSV export (BE-7) and CSV import (BE-6). Mounted at the API
 *  root (app.js), so the custody gate goes on each route here, never on a
 *  blanket router.use - that would leak onto whatever is mounted after it. */
export function reportsRouter({ db }) {
  const router = Router()
  const custody = requireRole(...CUSTODY_ROLES)

  router.get('/dashboard', custody, async (req, res) => {
    res.json({ data: await getDashboard(db) })
  })

  // Distinct from /dashboard above - Express matches it exactly, so order
  // relative to that route does not matter, but it is kept nearby.
  router.get('/dashboard/audit', custody, async (req, res) => {
    res.json({ data: await getAuditDashboard(db, req.user) })
  })

  router.get('/export/assignments', custody, async (req, res) => {
    const csv = await exportAssignmentsCsv(db, {
      open: bool(req.query.open),
      from: date(req.query.from, 'from'),
      to: date(req.query.to, 'to'),
    })
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="handouts.csv"',
      'Cache-Control': 'no-store',
    })
    res.send(csv)
  })

  router.post('/import/devices', custody, async (req, res) => {
    const { rows, commit } = parse(importBatch, req.body)
    res.json({ data: await importDevices(db, rows, { commit }) })
  })

  router.post('/import/employees', custody, async (req, res) => {
    const { rows, commit } = parse(importBatch, req.body)
    res.json({ data: await importEmployees(db, rows, { commit }) })
  })

  return router
}
