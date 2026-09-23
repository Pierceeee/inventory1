/**
 * What is in the test database right now, as plain rows - so a test can pick
 * "a free laptop" or "someone holding a device" without hardcoding fixtures.
 * Refreshed before every test; call refreshDb() again after the UI changes
 * something you want to assert on.
 */
export const db = {
  devices: [], employees: [], assignments: [], departments: [], profiles: [], sessions: [], items: [],
  scans: [],
}

let server = null

export function attachServer(testServer) {
  server = testServer
}

export async function refreshDb() {
  Object.assign(db, await server.snapshot())
}
