/**
 * A handful of response headers that cost nothing and help everywhere: no
 * MIME sniffing, no framing (there is no embeddable use case for AKM), no
 * referrer leaked to third parties, and the camera stays available to the
 * app itself only (the QR scanner, Phase 4) but nowhere else. Runs before
 * `officeNetworkOnly`, so even the blocked "Access Restricted" page and the
 * JSON 403 carry these. No new dependency (no helmet) - this is the whole
 * policy AKM needs.
 */
export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self)',
  })
  next()
}
