import { AppError } from '../lib/errors.js'

const envelope = (code, message, details = {}) => ({ error: { code, message, details } })

/** The single place a failure becomes a response. Deliberate failures carry
 *  their own status and code; anything unexpected is logged in full here and
 *  reaches the client only as a generic 500 - internals never leak.
 *  Express recognises an error handler by its four parameters. */
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(envelope(err.code, err.message, err.details))
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json(envelope('VALIDATION_ERROR', 'The request body is not valid JSON.'))
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json(envelope('PAYLOAD_TOO_LARGE', 'That upload is too large. Split it into smaller files.'))
  }

  console.error(`[api] ${req.method} ${req.originalUrl} failed:`, err)
  return res.status(500).json(envelope('INTERNAL_ERROR', 'Something went wrong on the server. Please try again.'))
}
