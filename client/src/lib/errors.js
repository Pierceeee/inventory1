export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message || code || 'Request failed')
    this.name = 'ApiError'
    this.status = status ?? 0
    this.code = code ?? 'UNKNOWN'
    this.details = details ?? {}
  }
}

// Fallbacks only. The server's own message is preferred because it names the
// actual device and person, which a generic string cannot.
const FALLBACKS = {
  VALIDATION_ERROR: 'Some fields need attention.',
  NOT_FOUND: 'That record no longer exists.',
  DUPLICATE_ASSET_TAG: 'That asset tag is already in use.',
  DUPLICATE_SERIAL: 'That serial number is already in use.',
  DUPLICATE_EMAIL: 'That email address is already registered.',
  DEVICE_ALREADY_ISSUED: 'That device is already issued to someone else.',
  DEVICE_RETIRED: 'That device is retired and cannot be issued.',
  DEVICE_IN_REPAIR: 'That device is in repair. Return it from repair first.',
  EMPLOYEE_RESIGNED: 'That employee has resigned and cannot be issued devices.',
  ASSIGNMENT_ALREADY_RETURNED: 'That device has already been returned.',
  FORBIDDEN: 'You do not have permission to do that.',
  DUPLICATE_DEPARTMENT: 'That department name is already in use.',
  LAST_ADMIN: 'At least one admin must remain.',
  CANNOT_DISABLE_SELF: 'You cannot deactivate your own account.',
  ACCOUNT_DISABLED: 'This account has been deactivated.',
  REGISTRATION_UNAVAILABLE: 'Could not create the account right now. Check the server configuration.',
  SESSION_NOT_ACTIVE: 'This session is completed and read-only.',
  NO_DEPARTMENT: 'You are not assigned to a department yet.',
  ITEM_NOT_SCANNED: 'That item has not been scanned.',
}

// Forms mark individual inputs for these codes, not just the banner.
const FIELD_CODES = new Set([
  'VALIDATION_ERROR', 'DUPLICATE_ASSET_TAG', 'DUPLICATE_SERIAL', 'DUPLICATE_EMAIL', 'DUPLICATE_DEPARTMENT',
])

export function messageFor(error) {
  if (!error) return ''
  if (!(error instanceof ApiError)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (error.message && error.message !== error.code) return error.message
  return FALLBACKS[error.code] ?? 'Something went wrong. Please try again.'
}

export function fieldErrorsOf(error) {
  if (!(error instanceof ApiError)) return {}
  if (!FIELD_CODES.has(error.code)) return {}
  return error.details ?? {}
}
