import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearSessionItems, completeSession, createSession, getSession, importSessionItems,
  listRecentScans, listSessionItems, listSessions, scanItem, undoScan, updateSession,
} from '../api/inventorySessions.js'

export const inventorySessionKeys = {
  all: ['inventory-sessions'],
  list: (params) => ['inventory-sessions', 'list', params ?? {}],
  detail: (id) => ['inventory-sessions', 'detail', id],
}

/**
 * A session's items live under their own top-level key, `['sessions', id,
 * 'items', params]` - Group 3's scanner patches a freshly-scanned item into
 * this cache (queryClient.setQueriesData with a predicate matching the
 * `['sessions', id, 'items']` prefix, since the exact `params` - status/q/
 * page - varies with whatever filter the item table currently has open).
 * `params` always includes `page`, `page_size`, `status` and `q` so the key
 * is stable for a given filter/page combination.
 */
export const sessionItemsKey = (id, params) => ['sessions', id, 'items', params ?? {}]

export function useSessionList(params) {
  return useQuery({
    queryKey: inventorySessionKeys.list(params),
    queryFn: () => listSessions(params).then((r) => r.data),
  })
}

export function useInventorySession(id) {
  return useQuery({
    queryKey: inventorySessionKeys.detail(id),
    queryFn: () => getSession(id).then((r) => r.data),
    enabled: Boolean(id),
  })
}

/** Filtering, search and pagination all happen server-side - a session can
 *  hold thousands of items. `keepPreviousData` keeps the old page on screen
 *  while the next one loads, instead of flashing "Loading…" on every click. */
export function useSessionItems(id, params) {
  return useQuery({
    queryKey: sessionItemsKey(id, params),
    queryFn: () => listSessionItems(id, params).then((r) => r.data),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  })
}

function useSessionMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventorySessionKeys.all })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'audit'] })
    },
  })
}

export const useCreateSession = () => useSessionMutation((body) => createSession(body).then((r) => r.data))
export const useUpdateSession = () =>
  useSessionMutation(({ id, ...body }) => updateSession(id, body).then((r) => r.data))
export const useCompleteSession = () => useSessionMutation((id) => completeSession(id).then((r) => r.data))
export const useImportItems = () =>
  useSessionMutation(({ id, ...body }) => importSessionItems(id, body).then((r) => r.data))
export const useClearItems = () => useSessionMutation((id) => clearSessionItems(id).then((r) => r.data))

/** The recent-scans list under the scanner panel - its own small query, kept
 *  under the same `['sessions', id, ...]` prefix as the items list. */
export const sessionScansKey = (id, params) => ['sessions', id, 'scans', params ?? {}]

export function useRecentScans(sessionId, params) {
  return useQuery({
    queryKey: sessionScansKey(sessionId, params),
    queryFn: () => listRecentScans(sessionId, params).then((r) => r.data),
    enabled: Boolean(sessionId),
  })
}

/** A cached items page matches `item` if the page has no status filter, or
 *  its filter agrees with the item's (now-current) status. */
const stillMatchesFilter = (params, item) => !params?.status || params.status === item.status

/**
 * Patches one item into every cached items page for this session, whatever
 * filter (status/q/page) each is currently showing. Uses the query cache
 * directly (not `setQueriesData`) because each page's own `params` - in
 * particular its status filter - live in its query key
 * (`sessionItemsKey(id, params)`), and a page whose filter the item no
 * longer matches (e.g. a Pending-filtered page, just scanned) must drop the
 * row and shrink its `total`, not show it looking wrong until the next
 * fetch; a page the item still matches gets it patched in place. Pages that
 * don't currently hold the item are left untouched either way - inserting a
 * "new" row into a filtered/paginated page would put it in the wrong
 * position relative to the server's own ordering.
 */
function patchCachedItems(qc, sessionId, item) {
  const queries = qc.getQueryCache().findAll({ queryKey: ['sessions', sessionId, 'items'] })
  for (const query of queries) {
    const params = query.queryKey[3]
    qc.setQueryData(query.queryKey, (old) => {
      if (!old?.items) return old
      const index = old.items.findIndex((i) => i.id === item.id)
      if (index === -1) return old
      if (!stillMatchesFilter(params, item)) {
        const items = old.items.filter((i) => i.id !== item.id)
        return { ...old, items, total: Math.max(0, old.total - 1) }
      }
      const items = old.items.slice()
      items[index] = item
      return { ...old, items }
    })
  }
  // Other, currently-inactive filtered pages may now be missing this item
  // (e.g. a Pending page should gain it back after an undo) - mark every
  // items query for this session stale without forcing a network refetch of
  // whichever page is on screen right now (that one was just patched above);
  // an inactive one refetches on its own next time it is viewed.
  qc.invalidateQueries({ queryKey: ['sessions', sessionId, 'items'], refetchType: 'none' })
}

/**
 * A handheld scanner can fire several scans a second: never refetch the
 * (possibly large, paginated) item list per scan. Instead patch the one item
 * that changed directly into every cached page, and only invalidate the
 * small queries (the session summary for its progress bar, and the recent
 * scans list).
 */
export function useScanItem(sessionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code) => scanItem(sessionId, code).then((r) => r.data),
    onSuccess: (result) => {
      if (result.item) patchCachedItems(qc, sessionId, result.item)
      qc.invalidateQueries({ queryKey: inventorySessionKeys.all })
      qc.invalidateQueries({ queryKey: ['sessions', sessionId, 'scans'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'audit'] })
    },
  })
}

export function useUndoScan(sessionId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId) => undoScan(sessionId, itemId).then((r) => r.data),
    onSuccess: (item) => {
      patchCachedItems(qc, sessionId, item)
      qc.invalidateQueries({ queryKey: inventorySessionKeys.all })
      qc.invalidateQueries({ queryKey: ['sessions', sessionId, 'scans'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'audit'] })
    },
  })
}
