// DISPOSABLE - duplicates §5 of the spec so the UI can be reviewed before a
// backend exists. Deleted at cutover. Pure functions, no I/O, no imports.

const err = (status, code, message, details = {}) => ({ error: { status, code, message, details } })

export function checkIssue({ device, employee, issuedAt, openAssignment, holderName, sameTypeHeld }) {
  if (!device) return err(404, 'NOT_FOUND', 'Device not found.')
  if (!employee) return err(404, 'NOT_FOUND', 'Employee not found.')

  if (openAssignment) {
    return err(409, 'DEVICE_ALREADY_ISSUED',
      `${device.asset_tag} is already held by ${holderName ?? 'another employee'}.`,
      { holder_name: holderName ?? null, assignment_id: openAssignment.id })
  }
  if (device.status === 'retired') {
    return err(409, 'DEVICE_RETIRED', `${device.asset_tag} is retired and cannot be issued.`)
  }
  if (device.status === 'repair') {
    return err(409, 'DEVICE_IN_REPAIR', `${device.asset_tag} is in repair. Return it from repair first.`)
  }
  if (employee.status === 'resigned') {
    return err(409, 'EMPLOYEE_RESIGNED', `${employee.full_name} has resigned and cannot be issued devices.`)
  }
  if (new Date(issuedAt).getTime() > Date.now()) {
    return err(400, 'VALIDATION_ERROR', 'The handout date cannot be in the future.',
      { issued_at: 'Must not be in the future.' })
  }

  if (sameTypeHeld) {
    return {
      warning: {
        code: 'SAME_TYPE_ALREADY_HELD',
        message: `${employee.full_name} already holds another ${device.type}.`,
      },
    }
  }
  return {}
}

export function checkReturn({ assignment, returnedAt }) {
  if (!assignment) return err(404, 'NOT_FOUND', 'Assignment not found.')
  if (assignment.returned_at) {
    return err(409, 'ASSIGNMENT_ALREADY_RETURNED', 'This device has already been returned.')
  }
  const at = new Date(returnedAt).getTime()
  if (at < new Date(assignment.issued_at).getTime()) {
    return err(400, 'VALIDATION_ERROR', 'The return date cannot be before the handout date.',
      { returned_at: 'Must not be before the handout date.' })
  }
  if (at > Date.now()) {
    return err(400, 'VALIDATION_ERROR', 'The return date cannot be in the future.',
      { returned_at: 'Must not be in the future.' })
  }
  return {}
}
