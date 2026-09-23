import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from '../mocks/server.js'
import { resetDb } from '../mocks/db.js'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { server.resetHandlers(); resetDb() })
afterAll(() => server.close())
