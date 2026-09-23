// Example data for trying the app out.
//   npm run db:seed          loads it into DATABASE_URL
//   npm run db:seed:remove   takes it out again, leaving real data untouched
// The test suite uses the same rows as its fixtures.
//
// Adspark-shaped on purpose: ASP-#### tags, MacBooks and Windows laptops, a
// retired device, two in repair, two resigned employees still holding
// devices, a returned device with history, and one laptop with three handouts.
//
// Every example row has a fixed id of the form <letter>NNNNNNN-0000-4000-8000-000000000000,
// so it can always be found and removed however much real data sits beside it.

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
// c=staff profile, e=employee, d=device, a=assignment.
const id = (kind, n) => `${kind}${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`

/** The IT staff shown as having recorded the example handouts. */
export const EXAMPLE_STAFF = [
  { id: id('c', 1), full_name: 'Allen Lacoste', email: 'allen@adspark.ph' },
  { id: id('c', 2), full_name: 'Rina Delgado', email: 'rina@adspark.ph' },
  { id: id('c', 3), full_name: 'Kim Bautista', email: 'kim@adspark.ph' },
]

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

/** Builds the rows fresh each call, so dates are always relative to today. */
export function buildExampleData() {
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
    const recorder = EXAMPLE_STAFF[seq % EXAMPLE_STAFF.length]
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

  return { staff: EXAMPLE_STAFF, employees, devices, assignments }
}

/** Inserts the rows, one statement per table. No checks - see seedExampleData. */
export async function insertExampleData(db, data = buildExampleData()) {
  const insert = (table, columns, types, rows) => db.query(
    `insert into ${table} (${columns.join(', ')})
     select ${columns.join(', ')} from jsonb_to_recordset($1::jsonb)
       as r(${columns.map((c, i) => `${c} ${types[i]}`).join(', ')})`,
    [JSON.stringify(rows)],
  )

  await insert('profiles', ['id', 'email', 'full_name'], ['uuid', 'text', 'text'], data.staff)
  await insert('employees',
    ['id', 'full_name', 'email', 'department', 'status', 'resigned_at', 'created_at', 'updated_at'],
    ['uuid', 'text', 'text', 'text', 'text', 'timestamptz', 'timestamptz', 'timestamptz'],
    data.employees)
  await insert('devices',
    ['id', 'asset_tag', 'type', 'brand', 'model', 'serial_number', 'os', 'status', 'notes', 'created_at', 'updated_at'],
    ['uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'timestamptz', 'timestamptz'],
    data.devices)
  await insert('assignments',
    ['id', 'device_id', 'employee_id', 'issued_at', 'issued_by', 'returned_at', 'returned_by',
      'return_reason', 'issued_condition', 'returned_condition', 'issued_accessories',
      'returned_accessories', 'notes', 'created_at'],
    ['uuid', 'uuid', 'uuid', 'timestamptz', 'uuid', 'timestamptz', 'uuid',
      'text', 'text', 'text', 'text[]', 'text[]', 'text', 'timestamptz'],
    data.assignments)
}

const idsOf = (rows) => rows.map((r) => r.id)

/**
 * Loads the example data alongside whatever is already there, all or nothing.
 * Refuses rather than half-loads if a real device or employee already uses one
 * of the example asset tags, serial numbers or email addresses.
 */
export async function seedExampleData(db) {
  const data = buildExampleData()

  return db.transaction(async (tx) => {
    const { rows: [present] } = await tx.query(
      'select count(*)::int as n from devices where id = any($1::uuid[])', [idsOf(data.devices)])
    if (present.n > 0) return { status: 'already-loaded' }

    const { rows: clashes } = await tx.query(
      `select 'device' as kind, asset_tag as label from devices
        where lower(asset_tag) = any($1::text[]) or lower(serial_number) = any($2::text[])
       union all
       select 'employee', coalesce(email, full_name) from employees
        where lower(email) = any($3::text[])
        order by 1, 2`,
      [
        data.devices.map((d) => d.asset_tag.toLowerCase()),
        data.devices.map((d) => d.serial_number.toLowerCase()),
        data.employees.map((e) => e.email.toLowerCase()),
      ],
    )
    if (clashes.length) return { status: 'clash', clashes }

    await insertExampleData(tx, data)
    return {
      status: 'loaded',
      devices: data.devices.length,
      employees: data.employees.length,
      handouts: data.assignments.length,
    }
  })
}

/**
 * Deletes every example row. Handouts you recorded yourself that involve an
 * example device or example employee go too, since they cannot outlive what
 * they point at; they are counted separately so nothing disappears unreported.
 */
export async function removeExampleData(db) {
  const data = buildExampleData()
  const exampleHandouts = new Set(idsOf(data.assignments))

  return db.transaction(async (tx) => {
    const { rows: handouts } = await tx.query(
      `delete from assignments
        where id = any($1::uuid[]) or device_id = any($2::uuid[]) or employee_id = any($3::uuid[])
        returning id`,
      [[...exampleHandouts], idsOf(data.devices), idsOf(data.employees)],
    )
    const devices = await tx.query('delete from devices where id = any($1::uuid[])', [idsOf(data.devices)])
    const employees = await tx.query('delete from employees where id = any($1::uuid[])', [idsOf(data.employees)])
    await tx.query(
      `delete from profiles p
        where p.id = any($1::uuid[])
          and not exists (select 1 from assignments a where a.issued_by = p.id or a.returned_by = p.id)`,
      [idsOf(data.staff)],
    )

    return {
      devices: devices.rowCount,
      employees: employees.rowCount,
      handouts: handouts.filter((h) => exampleHandouts.has(h.id)).length,
      yourHandouts: handouts.filter((h) => !exampleHandouts.has(h.id)).length,
    }
  })
}
