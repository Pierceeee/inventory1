import { request } from './client.js'

export const listItems = (params) => request('/items', { params })
export const updateItem = (id, body) => request(`/items/${id}`, { method: 'PATCH', body })
export const deleteItem = (id) => request(`/items/${id}`, { method: 'DELETE' })
