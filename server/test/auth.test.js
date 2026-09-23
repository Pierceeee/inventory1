import { useTestApi, freeDevice, idleEmployee } from './support/api.js'

const t = useTestApi()

describe('authentication', () => {
  test('health is public', async () => {
    const res = await t.anonymous.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ok')
  })

  test.each([
    ['GET', '/api/devices'], ['GET', '/api/employees'], ['GET', '/api/assignments'],
    ['POST', '/api/assignments'], ['GET', '/api/dashboard'], ['GET', '/api/export/assignments'],
    ['POST', '/api/import/devices'], ['GET', '/api/auth/me'],
  ])('%s %s without a token is a 401', async (method, url) => {
    const res = await (method === 'GET' ? t.anonymous.get(url) : t.anonymous.post(url))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  test('a forged or expired token is a 401', async () => {
    const res = await t.anonymous.get('/api/devices').set('Authorization', 'Bearer test.not-a-user')
    expect(res.status).toBe(401)
  })

  test('an unknown route behind auth is a 404, not a crash', async () => {
    const res = await t.api.get('/api/nothing-here')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  test('sign-in returns a token, a refresh token, and the user - never a password', async () => {
    const res = await t.anonymous.post('/api/auth/login', { email: 'allen@adspark.ph', password: 'adspark' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      token: expect.any(String), refresh_token: expect.any(String),
      user: { email: 'allen@adspark.ph', full_name: 'Allen Lacoste' },
    })
    expect(JSON.stringify(res.body)).not.toContain('adspark"')
  })

  test('wrong password and unknown email get the same answer', async () => {
    const wrong = await t.anonymous.post('/api/auth/login', { email: 'allen@adspark.ph', password: 'nope' })
    const ghost = await t.anonymous.post('/api/auth/login', { email: 'ghost@adspark.ph', password: 'adspark' })
    expect(wrong.status).toBe(401)
    expect(ghost.status).toBe(401)
    expect(wrong.body).toEqual(ghost.body)
  })

  test('a refresh token buys a new session; a bad one is a 401', async () => {
    const good = await t.anonymous.post('/api/auth/refresh', { refresh_token: 'refresh.' + t.auth.sessionFor('kim@adspark.ph').user.id })
    expect(good.status).toBe(200)
    expect(good.body.data.user.full_name).toBe('Kim Bautista')
    const bad = await t.anonymous.post('/api/auth/refresh', { refresh_token: 'nope' })
    expect(bad.status).toBe(401)
  })

  test('/me returns who the token belongs to', async () => {
    const res = await t.as('rina@adspark.ph').get('/api/auth/me')
    expect(res.body.data).toMatchObject({ full_name: 'Rina Delgado', email: 'rina@adspark.ph' })
  })

  const kimsStoredName = async () => (await t.db.query(
    'select full_name from profiles where email = $1', ['kim@adspark.ph'])).rows[0].full_name

  test('signing in refreshes the name that history shows', async () => {
    await t.db.query('update profiles set full_name = null where email = $1', ['kim@adspark.ph'])
    await t.anonymous.post('/api/auth/login', { email: 'kim@adspark.ph', password: 'adspark' })
    expect(await kimsStoredName()).toBe('Kim Bautista')
  })

  test('so does recording a handout, for sessions that began before a rename', async () => {
    await t.db.query('update profiles set full_name = null where email = $1', ['kim@adspark.ph'])
    const res = await t.as('kim@adspark.ph').post('/api/assignments', {
      device_id: freeDevice(t.fx).id, employee_id: idleEmployee(t.fx).id,
    })
    expect(res.body.data.issued_by_name).toBe('Kim Bautista')
    expect(await kimsStoredName()).toBe('Kim Bautista')
  })

  test('malformed JSON is a 400, not a 500', async () => {
    const res = await t.anonymous.post('/api/auth/login')
      .set('Content-Type', 'application/json').send('{"email":')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
