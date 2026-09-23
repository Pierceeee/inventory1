import { Router } from 'express'
import { bool, date, importBatch, parse } from '../validation.js'
import { getDashboard } from '../services/dashboard.js'
import { exportAssignmentsCsv } from '../services/exports.js'
import { importDevices, importEmployees } from '../services/imports.js'

/** Dashboard, CSV export (BE-7) and CSV import (BE-6). */
export function reportsRouter({ db }) {
  const router = Router()

  router.get('/dashboard', async (req, res) => {
    res.json({ data: await getDashboard(db) })
  })

  router.get('/export/assignments', async (req, res) => {
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

  router.post('/import/devices', async (req, res) => {
    const { rows, commit } = parse(importBatch, req.body)
    res.json({ data: await importDevices(db, rows, { commit }) })
  })

  router.post('/import/employees', async (req, res) => {
    const { rows, commit } = parse(importBatch, req.body)
    res.json({ data: await importEmployees(db, rows, { commit }) })
  })

  return router
}
