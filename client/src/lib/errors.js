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
}

// Forms mark individual inputs for these codes, not just the banner.
const FIELD_CODES = new Set([
  'VALIDATION_ERROR', 'DUPLICATE_ASSET_TAG', 'DUPLICATE_SERIAL', 'DUPLICATE_EMAIL',
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
