import { ApiError } from '../lib/errors.js'
import { getToken } from '../lib/session.js'

const BASE = import.meta.env?.VITE_API_BASE_URL || ''

function buildUrl(path, params) {
  const url = `${BASE}/api${path}`
  if (!params) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request(path, { method = 'GET', body, params } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // The server resolves who acted from this token, never from the body.
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(buildUrl(path, params), {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'UNKNOWN',
      message: payload?.error?.message ?? '',
      details: payload?.error?.details ?? {},
    })
  }
  return { data: payload?.data, warning: payload?.warning }
}
