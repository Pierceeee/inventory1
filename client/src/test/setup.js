import '@testing-library/jest-dom/vitest'
import { beforeEach, afterEach, afterAll, vi } from 'vitest'
import { startTestServer } from '../../../server/test/support/testServer.js'
import { clearSession, setSession } from '../lib/session.js'
import { attachServer, refreshDb } from './liveDb.js'

// The real Express API on a random port, over an in-process Postgres with the
// real migrations. Nothing here imitates the server - these tests are the
// frontend's regression suite against the actual backend.
const server = await startTestServer()
vi.stubEnv('VITE_API_BASE_URL', server.url)
attachServer(server)

beforeEach(async () => {
  await server.reset()
  await refreshDb()
  // Signed in unless a test signs out or in as someone else.
  setSession(server.sessionFor('allen@adspark.ph'))
})
afterEach(() => clearSession())
afterAll(() => server.close())
