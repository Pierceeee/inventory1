/**
 * A tiny, dependency-free in-memory sliding-window limiter. Not distributed -
 * fine for this app's single Node process. Keyed by whatever the caller
 * chooses (a user id here for scan volume; Group 5 reuses the same building
 * block, keyed by email, for session-delete password attempts).
 *
 * `check` looks without recording; `commit` records; `hit` does both in one
 * call - the shape `combineRateLimiters` needs to check several limiters
 * before deciding whether an attempt counts against ANY of them.
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
