import { request } from './client.js'

export const listUsers = () => request('/users')
export const registerUser = (body) => request('/users', { method: 'POST', body })
export const updateUser = (id, body) => request(`/users/${id}`, { method: 'PATCH', body })
