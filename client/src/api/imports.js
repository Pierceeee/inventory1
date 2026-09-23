import { request } from './client.js'

export const importDevices = (rows, commit) =>
  request('/import/devices', { method: 'POST', body: { rows, commit } })
export const importEmployees = (rows, commit) =>
  request('/import/employees', { method: 'POST', body: { rows, commit } })
