import { useMemo, useRef } from 'react'

/**
 * Drops the result of async work the user has since moved past - a dry run
 * for a file they replaced, an import for a dialog they reset. `track()`
 * starts a piece of work and returns `stillCurrent()`; `invalidate()` makes
 * every tracked piece of work stale.
 */
export function useStaleGuard() {
  const generation = useRef(0)
  return useMemo(() => ({
    invalidate: () => { generation.current += 1 },
    track: () => {
      const mine = generation.current
      return () => mine === generation.current
    },
  }), [])
}
