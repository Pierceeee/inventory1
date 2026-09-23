// R2 overrides the blueprint here: the service-role key is OPTIONAL. readConfig
// never fails on it - only POST /api/users needs it, and answers 503
// REGISTRATION_UNAVAILABLE at request time when it is missing.
import { readConfig } from '../src/config.js'

const BASE_ENV = {
  DATABASE_URL: 'postgresql://localhost/test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
}

test('readConfig does not require SUPABASE_SERVICE_ROLE_KEY for the server', () => {
  const config = readConfig(BASE_ENV)
  expect(config.supabaseServiceRoleKey).toBeUndefined()
})

test('readConfig returns the service role key when it is set', () => {
  const config = readConfig({ ...BASE_ENV, SUPABASE_SERVICE_ROLE_KEY: '  secret-key  ' })
  expect(config.supabaseServiceRoleKey).toBe('secret-key')
})

test('scripts (needAuth false) do not need the service role key either', () => {
  const config = readConfig({ DATABASE_URL: 'postgresql://localhost/test' }, { needAuth: false })
  expect(config.supabaseServiceRoleKey).toBeUndefined()
})

test('still requires DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY for the server', () => {
  expect(() => readConfig({})).toThrow(/DATABASE_URL/)
  expect(() => readConfig({ DATABASE_URL: BASE_ENV.DATABASE_URL })).toThrow(/SUPABASE_URL/)
})
