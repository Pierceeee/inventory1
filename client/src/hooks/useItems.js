import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteItem, listItems, updateItem } from '../api/items.js'

export const itemKeys = {
  all: ['items'],
  list: (params) => ['items', 'list', params ?? {}],
}

/** The Inventory page's own list - filtered/searched/paginated server-side.
 *  `keepPreviousData` keeps the current page on screen while the next
 *  filter/page loads, instead of flashing "Loading…" on every click. */
export function useItemList(params) {
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => listItems(params).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
}

/** Edit and delete both touch a session's own item list and summary too
 *  (SessionDetailPage, if the edited/deleted item's session is open
 *  elsewhere) - those get `refetchType: 'none'` (mark stale, don't force a
 *  network refetch of a page that is not even on screen right now), the same
 *  pattern useInventorySessions.js uses for scans. The Inventory list and
 *  the audit dashboard DO refetch, since they are what the user is looking
 *  at when they edit or delete. `result.session_id` comes from the PATCH
 *  response for edits; deleteItem's response has no session_id, so
 *  useDeleteItem's mutationFn attaches the one the caller already knows. */
function useItemMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard', 'audit'] })
      if (result?.session_id) {
        qc.invalidateQueries({ queryKey: ['sessions', result.session_id, 'items'], refetchType: 'none' })
        qc.invalidateQueries({ queryKey: ['inventory-sessions', 'detail', result.session_id], refetchType: 'none' })
      }
    },
  })
}

export const useUpdateItem = () => useItemMutation(({ id, ...body }) => updateItem(id, body).then((r) => r.data))
export const useDeleteItem = () => useItemMutation(({ id, session_id }) =>
  deleteItem(id).then((r) => ({ ...r.data, session_id })))
