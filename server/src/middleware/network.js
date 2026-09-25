import { accessRestrictedHtml } from '../lib/accessRestrictedPage.js'

// R7/OQ6: the load balancer / uptime check must reach the API even from
// outside the office - it only ever answers `{ status: 'ok' }`. HEAD too
// (review fix #9) - uptime tools often use HEAD instead of GET.
const HEALTH_PATH = '/api/health'
const EXEMPT_METHODS = new Set(['GET', 'HEAD'])

// security HIGH (review fix #3): the drain below has to actually finish -
// unbounded, an attacker outside the allowlist could hold a socket open (or
// force the server to keep reading) indefinitely by trickling a body one
// byte at a time. Both a byte cap and a short timer bound the cost of a
// single blocked connection to near-nothing. Neither is about the request's
// DATA - nothing here is ever parsed, measured against express.json's own
// limit, or turned into an object.
const DEFAULT_DRAIN_MAX_BYTES = 64 * 1024
const DEFAULT_DRAIN_TIMEOUT_MS = 5_000

function sendBlocked(req, res) {
  // security CRITICAL (review fix #1): a caller that drops mid-drain can
  // fire BOTH 'aborted' and 'error' on the same request - answering twice
  // throws ERR_HTTP_HEADERS_SENT. Thrown from a raw socket-event callback
  // (no Express try/catch around it), that is an UNCAUGHT exception that
  // kills the entire Node process - reachable by any unauthenticated caller
  // with one aborted request to any route. `officeNetworkOnly` below also
  // guards this with a one-shot `settled` flag; this check is the second,
  // independent line of defence (e.g. something else already answered).
  if (res.headersSent || res.writableEnded) return
  try {
    res.set({ 'Cache-Control': 'no-store', Connection: 'close' })
    if (req.path.startsWith('/api/')) {
      res.status(403).json({
        error: {
          code: 'OFFICE_NETWORK_ONLY',
          message: 'AKM is only available on the Adspark office network.',
          details: {},
        },
      })
      return
    }
    res.status(403).set('Content-Type', 'text/html; charset=utf-8').send(accessRestrictedHtml(req.ip))
  } catch {
    // The socket is already gone (or Express itself is confused about its
    // state) - there is nothing left to answer, and nothing here may throw.
  }
}

/**
 * The FIRST middleware in the app (server/src/app.js) - before the JSON
 * parsers, before `/api`, and before static files - so a blocked visitor
 * never causes the server to parse a body, never reaches an API route, and
 * never receives the app bundle or a login form.
 *
 * Uses `req.ip`, which honours Express's `trust proxy` setting - so this
 * MUST run after `app.set('trust proxy', ...)`, and TRUST_PROXY must never
 * be `true` (server/src/lib/ipAllowList.js refuses that at parse time).
 * Loopback is never auto-allowed: behind a same-host reverse proxy with
 * trust proxy unset, every request looks like 127.0.0.1, and this middleware
 * has no way to tell that apart from a genuine local connection.
 *
 * `drain` (review fix #3) overrides the byte/time budget for draining a
 * blocked request's still-arriving body - injectable so tests can use a
 * tiny budget instead of the real ~5s/64KB defaults.
 */
export function officeNetworkOnly(allowList, drain = {}) {
  const maxBytes = drain.maxBytes ?? DEFAULT_DRAIN_MAX_BYTES
  const timeoutMs = drain.timeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS

  return (req, res, next) => {
    if (EXEMPT_METHODS.has(req.method) && req.path === HEALTH_PATH) return next()
    if (allowList.allows(req.ip)) return next()

    // Most requests (GET, or any request whose body already fully arrived)
    // have nothing left to drain - answer immediately, no listeners needed.
    if (req.readableEnded || req.complete) {
      sendBlocked(req, res)
      return
    }

    let settled = false
    let bytesRead = 0

    const cleanup = () => {
      clearTimeout(timer)
      req.off('data', onData)
      req.off('end', finish)
      req.off('aborted', finish)
      req.off('error', finish)
    }
    // One-shot: whichever of finish()/giveUp() runs first wins - the other
    // is a no-op. This is the primary fix for the crash (review fix #1): an
    // abort can fire 'aborted' AND 'error' for the same request, and without
    // this guard `sendBlocked` would run twice.
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      sendBlocked(req, res)
    }
    const giveUp = () => {
      if (settled) return
      settled = true
      cleanup()
      // Over budget (too slow or too large): not worth a clean response - an
      // already-blocked caller gets nothing either way, at minimal server
      // cost. destroy() is safe to call on an already-closing/closed socket.
      req.socket?.destroy()
    }
    const onData = (chunk) => {
      bytesRead += chunk.length
      if (bytesRead > maxBytes) giveUp()
    }

    const timer = setTimeout(giveUp, timeoutMs)
    req.on('data', onData)
    req.once('end', finish)
    req.once('aborted', finish)
    req.once('error', finish)
    req.resume()
  }
}
