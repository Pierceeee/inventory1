/**
 * A tiny, dependency-free in-memory sliding-window limiter. Not distributed -
 * fine for this app's single Node process. Keyed by whatever the caller
 * chooses (a user id here for scan volume; Group 5 reuses the same building
 * block, also keyed by user id, for session-delete password attempts and
 * session exports).
 *
 * `check` looks without recording; `commit` records; `hit` does both in one
 * call - the shape `combineRateLimiters` needs to check several limiters
 * before deciding whether an attempt counts against ANY of them. `release`
 * gives back exactly one reservation (the most recent hit) - for a caller
 * that must reserve BEFORE an async call (so concurrent requests cannot all
 * slip past `check()` while the first one is still awaiting, security HIGH),
 * but the reservation turns out not to have been the caller's fault (e.g. the
 * downstream service itself failed) and must not burn their budget.
 */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map() // key -> ascending timestamps within the window

  function prune(timestamps, now) {
    let i = 0
    while (i < timestamps.length && now - timestamps[i] >= windowMs) i++
    return i === 0 ? timestamps : timestamps.slice(i)
  }

  return {
    check(key, now = Date.now()) {
      const timestamps = prune(hits.get(key) ?? [], now)
      hits.set(key, timestamps)
      if (timestamps.length >= max) {
        return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - timestamps[0])) }
      }
      return { allowed: true, retryAfterMs: 0 }
    },
    commit(key, now = Date.now()) {
      const timestamps = hits.get(key) ?? []
      timestamps.push(now)
      hits.set(key, timestamps)
    },
    hit(key, now = Date.now()) {
      const result = this.check(key, now)
      if (result.allowed) this.commit(key, now)
      return result
    },
    reset(key) {
      if (key === undefined) hits.clear()
      else hits.delete(key)
    },
    /** Drops the single most recent hit for `key` - a no-op if there is
     *  none. Other, earlier hits for that key (real prior attempts) are left
     *  exactly as they were. */
    release(key) {
      const timestamps = hits.get(key)
      if (timestamps?.length) timestamps.pop()
    },
  }
}

/**
 * Every limiter must allow an attempt for it to count against any of them -
 * a request refused by the burst cap does not also eat into the sustained
 * budget, so a person who is merely fast (not abusive) is never punished
 * twice for the same attempt.
 */
export function combineRateLimiters(limiters) {
  return {
    hit(key, now = Date.now()) {
      let worst = null
      for (const limiter of limiters) {
        const result = limiter.check(key, now)
        if (!result.allowed && (!worst || result.retryAfterMs > worst.retryAfterMs)) worst = result
      }
      if (worst) return worst
      for (const limiter of limiters) limiter.commit(key, now)
      return { allowed: true, retryAfterMs: 0 }
    },
    reset(key) {
      for (const limiter of limiters) limiter.reset(key)
    },
  }
}

// Generous on purpose: a handheld scanner can fire several codes a second in
// a burst, and a busy audit can run for a while. These caps exist to stop an
// append-only-log flood (a script, or a stuck retry loop), not to slow down
// a person actually scanning. Documented so Group 5 (or anyone tuning this)
// does not have to reverse-engineer the numbers:
//   burst:     20 scans / 2s   (10/s sustained peak - well above a realistic
//              2-4 scans/s handheld cadence)
//   sustained: 600 scans / 60s (10/s average over a full minute)
const DEFAULT_SCAN_BURST = { windowMs: 2_000, max: 20 }
const DEFAULT_SCAN_SUSTAINED = { windowMs: 60_000, max: 600 }

export function createScanRateLimiter({ burst = DEFAULT_SCAN_BURST, sustained = DEFAULT_SCAN_SUSTAINED } = {}) {
  return combineRateLimiters([createRateLimiter(burst), createRateLimiter(sustained)])
}

// Session deletion (Group 5, F2): 5 FAILED password attempts / 15 minutes,
// keyed by user id - a correct password never counts against the budget, only
// wrong ones do (services/inventorySessions.js's deleteSession reserves with
// `.hit()` BEFORE calling Supabase, then `.reset()`s the whole budget on a
// right password or `.release()`s the one reservation if signIn itself
// throws - never a straddling check()-then-commit(), see that function's own
// comment). Generous enough that a genuine typo or two never locks an admin
// out, tight enough to make a password-guessing script useless.
const DEFAULT_SESSION_DELETE_LIMIT = { windowMs: 15 * 60_000, max: 5 }

export function createSessionDeleteRateLimiter(options = DEFAULT_SESSION_DELETE_LIMIT) {
  return createRateLimiter(options)
}

// Session export (Group 5 security review): building an xlsx is synchronous,
// CPU-bound work on the single Node event loop (~1.3s for a 10,000-row
// session, measured) - unlike everything else here, this budget exists to
// protect the SERVER, not the caller's own data. 10 exports/minute is well
// above any legitimate workflow (nobody re-downloads the same backup ten
// times a minute) but caps how much of the process a single user can occupy.
const DEFAULT_EXPORT_LIMIT = { windowMs: 60_000, max: 10 }

export function createExportRateLimiter(options = DEFAULT_EXPORT_LIMIT) {
  return createRateLimiter(options)
}
