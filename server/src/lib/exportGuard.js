/**
 * A process-wide single-flight guard around the session export build.
 *
 * security HIGH: building an xlsx is synchronous, CPU-bound work on the
 * single Node event loop (~1.3s/10,000 rows, ~6.5s at the 50,000-item
 * session cap - lib/rateLimit.js's DEFAULT_EXPORT_LIMIT comment). The
 * per-user export rate limiter caps how often ONE user can trigger a build,
 * but does nothing to stop several admins exporting large sessions AT THE
 * SAME TIME - each one stalls the whole process (scanning, /api/health,
 * everyone else's requests) for its own several seconds, and those seconds
 * can overlap and stack.
 *
 * Only one export may build at a time, server-wide. A second concurrent
 * request is refused (429 EXPORT_BUSY) rather than queued - queueing would
 * only move the stall later, not remove it, and would let a burst of
 * requests pile up an ever-growing wait behind the one CPU-bound worker.
 *
 * Injectable (settings.exportGuard in app.js), same pattern as the rate
 * limiters, so a test can hold it busy deterministically.
 */
export function createExportGuard() {
  let busy = false
  return {
    /** Claims the single slot. Returns false (does NOT claim it) if it is
     *  already held - the caller must not call release() in that case. */
    tryAcquire() {
      if (busy) return false
      busy = true
      return true
    },
    /** Always call from a `finally`, and only after a successful tryAcquire(). */
    release() {
      busy = false
    },
  }
}
