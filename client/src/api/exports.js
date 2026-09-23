import { fetchWithAuth } from './client.js'

/**
 * Downloads rather than returning JSON, so it bypasses the api client's
 * envelope. Uses a Blob so the browser saves the file the server named
 * instead of navigating away from the app.
 */
export async function downloadAssignmentsCsv(params = {}) {
  const response = await fetchWithAuth('/export/assignments', { params })
  if (!response.ok) throw new Error('Export failed')

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `handouts-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  return blob
}
