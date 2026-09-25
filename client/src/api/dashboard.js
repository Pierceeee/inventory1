import { request } from './client.js'

export const getDashboard = () => request('/dashboard')
export const getAuditDashboard = () => request('/dashboard/audit')
