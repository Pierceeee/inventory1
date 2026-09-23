// The tests run on the same example rows `npm run db:seed` loads - see
// src/db/exampleData.js - inserted into a throwaway in-memory database.
import { EXAMPLE_STAFF, insertExampleData } from '../../src/db/exampleData.js'

/** The IT staff who sign in. Passwords exist only for the fake auth provider. */
export const USERS = EXAMPLE_STAFF.map((staff) => ({ ...staff, password: 'adspark' }))

export const loadFixtures = (db) => insertExampleData(db)

/** Reads the whole register back as plain rows, in fixture order. Tests use it
 *  to pick "a free laptop" or "someone holding a device" without hardcoding. */
export async function snapshot(db) {
  const [devices, employees, assignments] = await Promise.all([
    db.query('select * from devices order by asset_tag'),
    db.query('select * from employees order by created_at, full_name'),
    db.query('select * from assignments order by id'),
  ])
  return { devices: devices.rows, employees: employees.rows, assignments: assignments.rows }
}
