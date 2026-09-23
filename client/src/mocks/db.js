import { seedDevices, seedEmployees, seedAssignments, seedUsers } from './seed.js'

export const db = { devices: [], employees: [], assignments: [], users: [] }

export function resetDb() {
  db.devices = structuredClone(seedDevices)
  db.employees = structuredClone(seedEmployees)
  db.assignments = structuredClone(seedAssignments)
  db.users = structuredClone(seedUsers)
}

export function openAssignmentFor(deviceId) {
  return db.assignments.find((a) => a.device_id === deviceId && a.returned_at === null)
}

export function openAssignmentsForEmployee(employeeId) {
  return db.assignments.filter((a) => a.employee_id === employeeId && a.returned_at === null)
}

export const deviceById = (id) => db.devices.find((d) => d.id === id)
export const employeeById = (id) => db.employees.find((e) => e.id === id)
export const assignmentById = (id) => db.assignments.find((a) => a.id === id)
export const userById = (id) => db.users.find((u) => u.id === id)

resetDb()
