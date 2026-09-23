import { request } from './client.js'

export const listAssignments = (params) => request('/assignments', { params })
export const issueDevice = (body) => request('/assignments', { method: 'POST', body })
export const returnDevice = (id, body) =>
  request(`/assignments/${id}/return`, { method: 'POST', body })
