// TEST FIXTURES ONLY. Loaded into the throwaway in-memory test database before
// each test, never into a real one - the real register starts empty.
//
// Adspark-shaped on purpose: ASP-#### tags, MacBooks and Windows laptops, a
// retired device, two in repair, two resigned employees still holding
// devices, a returned device with history, and one laptop with three handouts.

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
// Valid, recognisable uuids: c=user, e=employee, d=device, a=assignment.
const id = (kind, n) => `${kind}${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`

const DEPARTMENTS = ['Creative', 'Accounts', 'Media', 'IT', 'Finance']

const NAMES = [
  'Maria Santos', 'Jose Rizal', 'Andres Bonifacio', 'Gabriela Silang',
  'Apolinario Mabini', 'Melchora Aquino', 'Juan Luna', 'Emilio Aguinaldo',
  'Gregoria de Jesus', 'Antonio Luna', 'Marcelo del Pilar', 'Diego Silang',
  'Lapu Lapu', 'Teresa Magbanua', 'Trinidad Tecson', 'Macario Sakay',
  'Graciano Lopez', 'Leona Florentino', 'Vicente Lim', 'Josefa Llanes',
  'Carlos Romulo', 'Felipe Agoncillo', 'Marcela Agoncillo', 'Rafael Palma',
  'Sergio Osmena', 'Manuel Quezon', 'Elpidio Quirino', 'Ramon Magsaysay',
  'Cecilia Munoz', 'Pedro Paterno',
]

/** The IT staff who sign in. Passwords exist only for the fake auth provider. */
export const USERS = [
  { id: id('c', 1), full_name: 'Allen Lacoste', email: 'allen@adspark.ph', password: 'adspark' },
  { id: id('c', 2), full_name: 'Rina Delgado', email: 'rina@adspark.ph', password: 'adspark' },
  { id: id('c', 3), full_name: 'Kim Bautista', email: 'kim@adspark.ph', password: 'adspark' },
]

function build() {
  const employees = NAMES.map((full_name, i) => ({
    id: id('e', i + 1),
    full_name,
    email: full_name.toLowerCase().replace(/[^a-z]+/g, '.') + '@adspark.ph',
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    // The last two have resigned. Both still hold devices - see below.
    status: i >= 28 ? 'resigned' : 'active',
    resigned_at: i >= 28 ? iso(10 + i) : null,
    created_at: iso(400 - i),
    updated_at: iso(400 - i),
  }))

  const LAPTOPS = [
    ['Apple', 'MacBook Air M2', 'macos'], ['Apple', 'MacBook Pro 14 M3', 'macos'],
    ['Apple', 'MacBook Air M1', 'macos'], ['Dell', 'Latitude 5440', 'windows'],
    ['Lenovo', 'ThinkPad T14', 'windows'], ['HP', 'EliteBook 840', 'windows'],
  ]
  const MOBILES = [
    ['Apple', 'iPhone 14', 'ios'], ['Apple', 'iPhone 13', 'ios'],
    ['Samsung', 'Galaxy S23', 'android'], ['Samsung', 'Galaxy A54', 'android'],
  ]

  const devices = []
  for (let i = 0; i < 24; i++) {
    const [brand, model, os] = LAPTOPS[i % LAPTOPS.length]
    devices.push({
      id: id('d', i + 1), asset_tag: `ASP-${String(i + 1).padStart(4, '0')}`,
      type: 'laptop', brand, model, os,
      serial_number: `SN-L-${1000 + i}`,
      status: i === 22 ? 'repair' : i === 23 ? 'retired' : 'available',
      notes: i === 23 ? 'Battery swelling, removed from service.' : null,
      created_at: iso(500 - i), updated_at: iso(500 - i),
    })
  }
  for (let i = 0; i < 16; i++) {
    const [brand, model, os] = MOBILES[i % MOBILES.length]
    const n = 24 + i
    devices.push({
      id: id('d', n + 1), asset_tag: `ASP-${String(n + 1).padStart(4, '0')}`,
      type: 'mobile', brand, model, os,
      serial_number: `SN-M-${2000 + i}`,
      status: i === 15 ? 'repair' : 'available',
      notes: null,
      created_at: iso(500 - n), updated_at: iso(500 - n),
    })
  }

  const ACCESSORIES = { laptop: ['charger', 'case'], mobile: ['charger', 'case', 'sim'] }
  const laptop = (i) => devices[i]
  const mobile = (i) => devices[24 + i]
  const emp = (i) => employees[i]

  const assignments = []
  const assign = (device, employee, issuedDaysAgo, returned = null) => {
    const seq = assignments.length + 1
    const recorder = USERS[seq % USERS.length]
    const issuedAccessories = ACCESSORIES[device.type]
    assignments.push({
      id: id('a', seq),
      device_id: device.id, employee_id: employee.id,
      issued_at: iso(issuedDaysAgo), issued_by: recorder.id,
      returned_at: returned ? iso(returned.daysAgo) : null,
      returned_by: returned ? recorder.id : null,
      return_reason: returned ? returned.reason : null,
      issued_condition: 'good',
      returned_condition: returned ? (returned.condition ?? 'good') : null,
      issued_accessories: issuedAccessories,
      returned_accessories: returned ? (returned.accessories ?? issuedAccessories) : null,
      notes: returned?.notes ?? null,
      created_at: iso(issuedDaysAgo),
    })
  }

  // ASP-0001 has three handouts of history: two closed, one still open.
  assign(laptop(0), emp(4), 700, { daysAgo: 500, reason: 'swap' })
  assign(laptop(0), emp(7), 480, {
    daysAgo: 200, reason: 'resignation', condition: 'fair', accessories: ['charger'],
    notes: 'Case not returned. Small dent on the lid.',
  })
  assign(laptop(0), emp(0), 180)

  // Eighteen more laptops out, one each; twelve mobiles out.
  for (let i = 1; i <= 18; i++) assign(laptop(i), emp(i), 60 + i * 3)
  for (let i = 0; i < 12; i++) assign(mobile(i), emp(i), 50 + i * 2)

  // Returned: the device is free now but keeps its history. Came back damaged.
  assign(mobile(12), emp(3), 300, {
    daysAgo: 30, reason: 'swap', condition: 'damaged', accessories: ['charger', 'sim'],
    notes: 'Screen cracked. Case missing.',
  })

  // Both resigned employees still hold devices.
  assign(laptop(19), emp(28), 220)
  assign(mobile(13), emp(28), 220)
  assign(laptop(20), emp(29), 190)

  return { employees, devices, assignments }
}

/** Inserts the fixtures, one statement per table. */
export async function loadFixtures(db) {
  const { employees, devices, assignments } = build()
  const profiles = USERS.map(({ id: userId, email, full_name }) => ({ id: userId, email, full_name }))

  const insert = (table, columns, types, rows) => db.query(
    `insert into ${table} (${columns.join(', ')})
     select ${columns.join(', ')} from jsonb_to_recordset($1::jsonb)
       as r(${columns.map((c, i) => `${c} ${types[i]}`).join(', ')})`,
    [JSON.stringify(rows)],
  )

  await insert('profiles', ['id', 'email', 'full_name'], ['uuid', 'text', 'text'], profiles)
  await insert('employees',
    ['id', 'full_name', 'email', 'department', 'status', 'resigned_at', 'created_at', 'updated_at'],
    ['uuid', 'text', 'text', 'text', 'text', 'timestamptz', 'timestamptz', 'timestamptz'],
    employees)
  await insert('devices',
    ['id', 'asset_tag', 'type', 'brand', 'model', 'serial_number', 'os', 'status', 'notes', 'created_at', 'updated_at'],
    ['uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'timestamptz', 'timestamptz'],
    devices)
  await insert('assignments',
    ['id', 'device_id', 'employee_id', 'issued_at', 'issued_by', 'returned_at', 'returned_by',
      'return_reason', 'issued_condition', 'returned_condition', 'issued_accessories',
      'returned_accessories', 'notes', 'created_at'],
    ['uuid', 'uuid', 'uuid', 'timestamptz', 'uuid', 'timestamptz', 'uuid',
      'text', 'text', 'text', 'text[]', 'text[]', 'text', 'timestamptz'],
    assignments)
}

/** Reads the whole register back as plain rows, in fixture order. Tests use it
 *  to pick "a free laptop" or "someone holding a device" without hardcoding. */
export async function snapshot(db) {
  const [devices, employees, assignments] = await Promise.all([
    db.query('select * from devices order by asset_tag'),
    db.query('select * from employees order by created_at, full_name'),
    db.query('select * from assignments order by id'),
  ])
  return { devices: devices.rows, employees: employees.rows, assignments: assignments.rows }
}
