import { Router } from 'express'
import { bool, deviceCreate, deviceUpdate, one, parse } from '../validation.js'
import {
  createDevice, getDevice, listDevices, retireDevice, updateDevice,
} from '../services/devices.js'

export function devicesRouter({ db }) {
  const router = Router()

  router.get('/', async (req, res) => {
    const { type, status, held, q } = req.query
    res.json({ data: await listDevices(db, { type: one(type), status: one(status), held: bool(held), q: one(q) }) })
  })

  router.post('/', async (req, res) => {
    res.status(201).json({ data: await createDevice(db, parse(deviceCreate, req.body)) })
  })

  router.get('/:id', async (req, res) => {
    res.json({ data: await getDevice(db, req.params.id) })
  })

  router.patch('/:id', async (req, res) => {
    res.json({ data: await updateDevice(db, req.params.id, parse(deviceUpdate, req.body)) })
  })

  router.post('/:id/retire', async (req, res) => {
    res.json({ data: await retireDevice(db, req.params.id) })
  })

  return router
}
