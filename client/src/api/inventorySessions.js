import { request } from './client.js'

export const listSessions = (params) => request('/sessions', { params })
export const getSession = (id) => request(`/sessions/${id}`)
export const createSession = (body) => request('/sessions', { method: 'POST', body })
export const updateSession = (id, body) => request(`/sessions/${id}`, { method: 'PATCH', body })
export const completeSession = (id) => request(`/sessions/${id}/complete`, { method: 'POST' })
export const listSessionItems = (id, params) => request(`/sessions/${id}/items`, { params })
export const importSessionItems = (id, body) => request(`/sessions/${id}/import`, { method: 'POST', body })
export const clearSessionItems = (id) =>
  request(`/sessions/${id}/clear`, { method: 'POST', body: { confirm: 'CLEAR' } })
export const scanItem = (id, code) => request(`/sessions/${id}/scan`, { method: 'POST', body: { code } })
export const undoScan = (id, itemId) => request(`/sessions/${id}/items/${itemId}/undo`, { method: 'POST' })
export const listRecentScans = (id, params) => request(`/sessions/${id}/scans`, { params })
