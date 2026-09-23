// Pure logic, no DB - `now` is always passed explicitly so these never
// depend on wall-clock timing.
import { createRateLimiter, combineRateLimiters, createScanRateLimiter } from '../src/lib/rateLimit.js'

describe('createRateLimiter', () => {
  test('allows up to max hits within the window, then blocks', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 })
    const now = 1_000_000
    expect(limiter.hit('a', now).allowed).toBe(true)
    expect(limiter.hit('a', now + 10).allowed).toBe(true)
    expect(limiter.hit('a', now + 20).allowed).toBe(true)
    const blocked = limiter.hit('a', now + 30)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  test('the window slides - an old hit falling out lets a new one in', () => {
    const limiter = createRateLimiter({ windowMs: 100, max: 1 })
    const now = 1_000_000
    expect(limiter.hit('a', now).allowed).toBe(true)
    expect(limiter.hit('a', now + 50).allowed).toBe(false)
    expect(limiter.hit('a', now + 150).allowed).toBe(true)
  })

  test('different keys have independent budgets', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 })
    const now = 1_000_000
    expect(limiter.hit('a', now).allowed).toBe(true)
    expect(limiter.hit('b', now).allowed).toBe(true)
  })

  test('reset clears one key, or every key', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 })
    const now = 1_000_000
    limiter.hit('a', now)
    limiter.hit('b', now)
    limiter.reset('a')
    expect(limiter.hit('a', now).allowed).toBe(true)
    expect(limiter.hit('b', now).allowed).toBe(false)
    limiter.reset()
    expect(limiter.hit('b', now).allowed).toBe(true)
  })
})

describe('combineRateLimiters', () => {
  test('a request is refused if any limiter alone would refuse it', () => {
    const burst = createRateLimiter({ windowMs: 1000, max: 2 })
    const sustained = createRateLimiter({ windowMs: 60_000, max: 100 })
    const combined = combineRateLimiters([burst, sustained])
    const now = 1_000_000
    expect(combined.hit('a', now).allowed).toBe(true)
    expect(combined.hit('a', now + 1).allowed).toBe(true)
    expect(combined.hit('a', now + 2).allowed).toBe(false)
  })

  test("a refused attempt does not consume the other limiter's budget", () => {
    const burst = createRateLimiter({ windowMs: 1000, max: 1 })
    const sustained = createRateLimiter({ windowMs: 60_000, max: 2 })
    const combined = combineRateLimiters([burst, sustained])
    const now = 1_000_000

    expect(combined.hit('a', now).allowed).toBe(true) // consumes burst 1/1, sustained 1/2
    expect(combined.hit('a', now + 1).allowed).toBe(false) // burst full - refused

    // If the refused attempt had wrongly consumed sustained too, sustained
    // would already be at 2/2 and this direct probe would report blocked.
    expect(sustained.hit('a', now + 2).allowed).toBe(true)
  })

  test('reset clears every underlying limiter', () => {
    const burst = createRateLimiter({ windowMs: 1000, max: 1 })
    const sustained = createRateLimiter({ windowMs: 60_000, max: 1 })
    const combined = combineRateLimiters([burst, sustained])
    const now = 1_000_000
    combined.hit('a', now)
    expect(combined.hit('a', now + 1).allowed).toBe(false)
    combined.reset('a')
    expect(combined.hit('a', now + 2).allowed).toBe(true)
  })
})

describe('createScanRateLimiter', () => {
  test('the documented defaults are generous enough for a realistic scanning burst', () => {
    const limiter = createScanRateLimiter()
    const now = 1_000_000
    // 15 scans across 700ms - well within a handheld scanner's realistic pace.
    for (let i = 0; i < 15; i++) expect(limiter.hit('scanner', now + i * 50).allowed).toBe(true)
  })

  test('the default burst cap trips after 20 scans in under 2 seconds', () => {
    const limiter = createScanRateLimiter()
    const now = 1_000_000
    for (let i = 0; i < 20; i++) expect(limiter.hit('scanner', now + i * 10).allowed).toBe(true)
    expect(limiter.hit('scanner', now + 205).allowed).toBe(false)
  })

  test('the burst window can be overridden for a fast test', () => {
    const limiter = createScanRateLimiter({ burst: { windowMs: 1000, max: 2 } })
    const now = 1_000_000
    expect(limiter.hit('x', now).allowed).toBe(true)
    expect(limiter.hit('x', now + 1).allowed).toBe(true)
    expect(limiter.hit('x', now + 2).allowed).toBe(false)
  })
})
