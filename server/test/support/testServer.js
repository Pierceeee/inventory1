import { createApp } from '../../src/app.js'
import { createTestDb, emptyDb } from './testDb.js'
import { createFakeAuth } from './fakeAuth.js'
import { USERS, loadFixtures, snapshot } from './fixtures.js'

/**
 * The real API on a random local port, backed by an in-process Postgres.
 * The client's component tests run against this, so they exercise the actual
 * server rather than a mock of it.
 */
export async function startTestServer() {
  const db = await createTestDb()
  const auth = createFakeAuth(USERS)
  const app = createApp({ db, auth })

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    db,
    async reset() {
      await emptyDb(db)
      await loadFixtures(db)
    },
    snapshot: () => snapshot(db),
    sessionFor: (email) => auth.sessionFor(email),
    async close() {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
      await db.close()
    },
  }
}
