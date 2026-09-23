import { request } from './client.js'

export const listDevices = (params) => request('/devices', { params })
export const getDevice = (id) => request(`/devices/${id}`)
export const createDevice = (body) => request('/devices', { method: 'POST', body })
export const updateDevice = (id, body) => request(`/devices/${id}`, { method: 'PATCH', body })
export const retireDevice = (id) => request(`/devices/${id}/retire`, { method: 'POST', body: {} })
