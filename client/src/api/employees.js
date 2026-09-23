import { request } from './client.js'

export const listEmployees = (params) => request('/employees', { params })
export const getEmployee = (id) => request(`/employees/${id}`)
export const createEmployee = (body) => request('/employees', { method: 'POST', body })
export const updateEmployee = (id, body) => request(`/employees/${id}`, { method: 'PATCH', body })
export const resignEmployee = (id) => request(`/employees/${id}/resign`, { method: 'POST', body: {} })
