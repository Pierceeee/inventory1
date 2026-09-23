/**
 * Every failure the API reports on purpose. The error middleware turns these
 * into the single envelope from §6 of the spec:
 *   { "error": { "code", "message", "details" } }
 */
export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const notFound = (what) => new AppError(404, 'NOT_FOUND', `${what} not found.`)

export const invalid = (details, message = 'Some fields need attention.') =>
  new AppError(400, 'VALIDATION_ERROR', message, details)

export const conflict = (code, message, details = {}) => new AppError(409, code, message, details)

export const unauthenticated = (message = 'Please sign in.') =>
  new AppError(401, 'UNAUTHENTICATED', message)

/** Postgres unique_violation, optionally for one named index. */
export const isUniqueViolation = (err, constraint) =>
  err?.code === '23505' && (constraint === undefined || err.constraint === constraint)
