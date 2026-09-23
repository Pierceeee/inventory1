import { Router } from 'express'
import { requireRole } from '../middleware/access.js'
import { parse, userRegister, userUpdate } from '../validation.js'
import { listUsers, registerUser, updateUser } from '../services/users.js'

/** Every route here is admin-only (§1.7): account management is not
 *  something a head or scanner can see or change. */
export function usersRouter({ db, auth }) {
  const router = Router()
  const admin = requireRole('admin')

  router.get('/', admin, async (req, res) => {
    res.json({ data: await listUsers(db) })
  })

  router.post('/', admin, async (req, res) => {
    res.status(201).json({ data: await registerUser(db, auth, parse(userRegister, req.body)) })
  })

  router.patch('/:id', admin, async (req, res) => {
    res.json({ data: await updateUser(db, req.params.id, parse(userUpdate, req.body), req.user.id) })
  })

  return router
}
