import { request } from './client.js'

export const listDepartments = () => request('/departments')
export const createDepartment = (body) => request('/departments', { method: 'POST', body })
export const updateDepartment = (id, body) => request(`/departments/${id}`, { method: 'PATCH', body })
