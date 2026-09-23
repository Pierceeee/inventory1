// The tests run on the same example rows `npm run db:seed` loads - see
// src/db/exampleData.js - inserted into a throwaway in-memory database.
import { EXAMPLE_STAFF, insertExampleData } from '../../src/db/exampleData.js'

/** The IT staff who sign in. Passwords exist only for the fake auth provider. */
export const USERS = EXAMPLE_STAFF.map((staff) => ({ ...staff, password: 'adspark' }))

/** Named handles onto the fixture staff, so tests never hardcode who has
 *  which role/department (§1.6). */
export const STAFF = {
  admin: 'allen@adspark.ph',
  itHead: 'rina@adspark.ph',
  creativeHead: 'kim@adspark.ph',
  itScanner: 'tess@adspark.ph',
  creativeScanner: 'mark@adspark.ph',
  unassigned: 'nina@adspark.ph',
}

export const loadFixtures = (db) => insertExampleData(db)

/** Reads the whole register back as plain rows, in fixture order. Tests use it
 *  to pick "a free laptop" or "someone holding a device" without hardcoding. */
export async function snapshot(db) {
  const [devices, employees, assignments, departments, profiles, sessions, items, scans] = await Promise.all([
    db.query('select * from devices order by asset_tag'),
    db.query('select * from employees order by created_at, full_name'),
    db.query('select * from assignments order by id'),
    db.query('select * from departments order by name'),
    db.query('select * from profiles order by email'),
    db.query('select * from inventory_session_summary order by created_at, name'),
    db.query('select * from session_items order by session_id, seq'),
    db.query('select * from scan_events order by created_at, id'),
  ])
  return {
    devices: devices.rows, employees: employees.rows, assignments: assignments.rows,
    departments: departments.rows, profiles: profiles.rows,
    sessions: sessions.rows, items: items.rows, scans: scans.rows,
  }
}
