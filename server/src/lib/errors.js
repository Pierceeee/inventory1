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

// A wrong role or department is 403, never 401 - a 401 tells the client its
// token is bad and signs it out, which a permission problem must not do.
export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError(403, 'FORBIDDEN', message)

// A head or scanner with no department yet (B8): distinct from FORBIDDEN so
// the client can show "ask an admin to assign you one" instead of a bare
// permission error.
export const noDepartment = (message = 'You are not assigned to a department yet.') =>
  new AppError(403, 'NO_DEPARTMENT', message)

/** Postgres unique_violation, optionally for one named index. */
export const isUniqueViolation = (err, constraint) =>
  err?.code === '23505' && (constraint === undefined || err.constraint === constraint)

// Never 401 - a flood of scans (or password attempts, Group 5) is a rate
// problem, not an authentication one, and a 401 would wrongly sign the user out.
export const tooManyRequests = (message = 'Too many attempts. Please slow down and try again shortly.', details = {}) =>
  new AppError(429, 'RATE_LIMITED', message, details)
