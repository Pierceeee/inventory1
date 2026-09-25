// Example data for trying the app out.
//   npm run db:seed          loads it into DATABASE_URL
//   npm run db:seed:remove   takes it out again, leaving real data untouched
// The test suite uses the same rows as its fixtures.
//
// Adspark-shaped on purpose: ASP-#### tags, MacBooks and Windows laptops, a
// retired device, two in repair, two resigned employees still holding
// devices, a returned device with history, and one laptop with three handouts.
//
// Every example row has a fixed id of the form <hex>NNNNNNN-GGGG-4000-8000-000000000000,
// so it can always be found and removed however much real data sits beside it.

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
// b=department, c=staff profile, e=employee, d=device, a=assignment.
// `group` tells apart id families that share a kind letter in later phases
// (sessions/items/scan events); every G1 id uses the default group 0, which
// reproduces the ids this file used before roles and departments existed.
const id = (kind, n, group = 0) =>
  `${kind}${String(n).padStart(7, '0')}-${String(group).padStart(4, '0')}-4000-8000-000000000000`

// Suffixed "(example)" (R5) so `db:seed` never collides with a real
// department of the same short name, and so the clash check can spot one.
export const EXAMPLE_DEPARTMENTS = [
  { id: id('b', 1), name: 'IT (example)' },
  { id: id('b', 2), name: 'Creative (example)' },
  { id: id('b', 3), name: 'Finance (example)' }, // no staff, no sessions - deliberately empty
]
const [IT, CREATIVE] = EXAMPLE_DEPARTMENTS

/** The IT staff shown as having recorded the example handouts, plus the
 *  heads and scanners the role/department examples need. */
export const EXAMPLE_STAFF = [
  { id: id('c', 1), full_name: 'Allen Lacoste', email: 'allen@adspark.ph', role: 'admin', department_id: IT.id },
  { id: id('c', 2), full_name: 'Rina Delgado', email: 'rina@adspark.ph', role: 'head', department_id: IT.id },
  { id: id('c', 3), full_name: 'Kim Bautista', email: 'kim@adspark.ph', role: 'head', department_id: CREATIVE.id },
  { id: id('c', 4), full_name: 'Tess Ramos', email: 'tess@adspark.ph', role: 'scanner', department_id: IT.id },
  { id: id('c', 5), full_name: 'Mark Villanueva', email: 'mark@adspark.ph', role: 'scanner', department_id: CREATIVE.id },
  { id: id('c', 6), full_name: 'Nina Cruz', email: 'nina@adspark.ph', role: 'scanner', department_id: null },
]

// Handouts must stay recorded by someone who can actually work custody pages
// (admin or head), and the handout fixtures must stay byte-identical to
// before roles existed - so only the first three staff (all admin/head) ever
// record one, same as when EXAMPLE_STAFF had exactly these three rows (G-5).
const RECORDERS = EXAMPLE_STAFF.slice(0, 3)

// Free-text department shown on employee records - unrelated to the
// `departments` table above (custody stays free text; see D1/G-20).
const EMPLOYEE_DEPARTMENTS = ['Creative', 'Accounts', 'Media', 'IT', 'Finance']

const [ALLEN, RINA, KIM, TESS, MARK] = EXAMPLE_STAFF

// Gadgets for the Creative department's session - unrelated to the laptop/
// mobile catalogue below, which is IT's.
const CREATIVE_ITEMS = [
  'Canon EOS R6', 'Wacom Intuos Pro', 'Rode VideoMic', 'DJI Ronin', 'Sony A7 IV',
  'Elgato Key Light', 'Wacom Cintiq 16', 'GoPro Hero 12', 'Zoom H6',
]

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
    department: EMPLOYEE_DEPARTMENTS[i % EMPLOYEE_DEPARTMENTS.length],
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
    const recorder = RECORDERS[seq % RECORDERS.length]
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

  // Audit sessions (Phases 2-3). Item ids share the `f` kind with sessions,
  // in group 1 (§1.6) - group 0 is the session itself. Sessions are built
  // here with their FINAL desired status; insertExampleData inserts them all
  // as active first (session_items' insert trigger requires it) and only
  // flips f3/f4 to completed once their items exist (G-8).
  let nextItemN = 1
  const item = (sessionId, fields) => ({ id: id('f', nextItemN++, 1), session_id: sessionId, ...fields })

  const f1 = id('f', 1)
  const f1Items = Array.from({ length: 12 }, (_, i) => {
    const k = i + 1
    const [brand, model] = LAPTOPS[(k - 1) % 6]
    const scannedBy = k <= 4 ? TESS.id : k <= 6 ? RINA.id : null
    return item(f1, {
      item_code: `IT-LAP-${String(k).padStart(3, '0')}`,
      data: {
        itemName: `${brand} ${model}`, serialNumber: `SN-IT-${1000 + k}`,
        assignedTo: NAMES[k - 1], location: k % 2 ? 'IT Room' : '3F Pod A',
      },
      scanned_at: scannedBy ? iso(2 - k / 10) : null, scanned_by: scannedBy,
    })
  })

  const f2 = id('f', 2)
  const f2Items = Array.from({ length: 9 }, (_, i) => {
    const k = i + 1
    const scannedBy = k <= 3 ? MARK.id : null
    return item(f2, {
      item_code: `CR-KIT-${String(k).padStart(3, '0')}`,
      data: { itemName: CREATIVE_ITEMS[k - 1], serialNumber: `SN-CR-${2000 + k}`, location: 'Studio' },
      scanned_at: scannedBy ? iso(1 - k / 10) : null, scanned_by: scannedBy,
    })
  })

  const f3 = id('f', 3)
  const f3Items = Array.from({ length: 6 }, (_, i) => {
    const k = i + 1
    const [brand, model] = MOBILES[(k - 1) % 4]
    const scannedBy = k <= 5 ? TESS.id : null
    return item(f3, {
      item_code: `IT-PH-${String(k).padStart(3, '0')}`,
      data: { itemName: `${brand} ${model}`, assignedTo: NAMES[10 + k] },
      scanned_at: scannedBy ? iso(5 + k / 10) : null, scanned_by: scannedBy,
    })
  })

  // Same codes as f1 (IT-LAP-001..004) on purpose - item codes are unique per
  // session, not globally (I6).
  const f4 = id('f', 4)
  const f4Items = Array.from({ length: 4 }, (_, i) => {
    const k = i + 1
    const [brand, model] = LAPTOPS[(k - 1) % 6]
    return item(f4, {
      item_code: `IT-LAP-${String(k).padStart(3, '0')}`,
      data: { itemName: `${brand} ${model}`, serialNumber: `SN-IT-${1000 + k}` },
      scanned_at: iso(35 + k / 10), scanned_by: RINA.id,
    })
  })

  const sessions = [
    {
      id: f1, name: 'IT Laptops Q3 2026', department_id: IT.id, status: 'active',
      completed_at: null, completed_by: null,
      columns: ['itemName', 'serialNumber', 'assignedTo', 'location', 'remarks'],
      display_columns: ['itemName', 'serialNumber', 'assignedTo', 'location'],
      created_by: ALLEN.id, created_at: iso(10),
    },
    {
      id: f2, name: 'Creative Kit Q3 2026', department_id: CREATIVE.id, status: 'active',
      completed_at: null, completed_by: null,
      columns: ['itemName', 'serialNumber', 'location'],
      display_columns: ['itemName', 'serialNumber', 'location'],
      created_by: KIM.id, created_at: iso(8),
    },
    {
      // Completed 2 days ago: still reads as "completed", not archived.
      id: f3, name: 'IT Phones Q2 2026', department_id: IT.id, status: 'completed',
      completed_at: iso(2), completed_by: ALLEN.id,
      columns: ['itemName', 'assignedTo'], display_columns: ['itemName', 'assignedTo'],
      created_by: RINA.id, created_at: iso(40),
    },
    {
      // Completed 30 days ago (never exactly 7): reads as archived.
      id: f4, name: 'IT Laptops Q1 2026', department_id: IT.id, status: 'completed',
      completed_at: iso(30), completed_by: ALLEN.id,
      columns: ['itemName', 'serialNumber'], display_columns: ['itemName', 'serialNumber'],
      created_by: ALLEN.id, created_at: iso(120),
    },
  ]
  const items = [...f1Items, ...f2Items, ...f3Items, ...f4Items]

  // Scan history (Phase 4). Group 2 - group 1 is the items themselves
  // (§1.6) - so the two families never collide even though both use the
  // 'f' kind. One 'scanned' event per already-scanned item, created_at
  // matching that item's scanned_at, plus two extra events on f1 so every
  // outcome has at least one example: a duplicate (IT-LAP-001, re-scanned
  // by Tess) and a not-found (a code nobody ever uploaded).
  let nextEventN = 1
  const scanEvent = (fields) => ({ id: id('f', nextEventN++, 2), ...fields })
  const scannedEvents = items
    .filter((it) => it.scanned_at)
    .map((it) => scanEvent({
      session_id: it.session_id, item_id: it.id, item_code: it.item_code,
      outcome: 'scanned', actor: it.scanned_by, created_at: it.scanned_at,
    }))
  const firstLaptop = f1Items[0] // IT-LAP-001, already scanned by Tess above
  const scans = [
    ...scannedEvents,
    scanEvent({
      session_id: f1, item_id: firstLaptop.id, item_code: firstLaptop.item_code,
      outcome: 'duplicate', actor: TESS.id, created_at: iso(0.5),
    }),
    scanEvent({
      session_id: f1, item_id: null, item_code: 'IT-LAP-999',
      outcome: 'not_found', actor: TESS.id, created_at: iso(0.4),
    }),
  ]

  return {
    departments: EXAMPLE_DEPARTMENTS, staff: EXAMPLE_STAFF, employees, devices, assignments,
    sessions, items, scans,
  }
}

/** Inserts the rows, one statement per table. No checks - see seedExampleData. */
export async function insertExampleData(db, data = buildExampleData()) {
  const insert = (table, columns, types, rows) => db.query(
    `insert into ${table} (${columns.join(', ')})
     select ${columns.join(', ')} from jsonb_to_recordset($1::jsonb)
       as r(${columns.map((c, i) => `${c} ${types[i]}`).join(', ')})`,
    [JSON.stringify(rows)],
  )

  await insert('departments', ['id', 'name'], ['uuid', 'text'], data.departments)
  await insert('profiles', ['id', 'email', 'full_name', 'role', 'department_id'],
    ['uuid', 'text', 'text', 'text', 'uuid'], data.staff)
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

  // Every session is inserted active - the session_items insert trigger
  // requires it - then items go in, then one update flips the completed ones
  // (G-8). columns/display_columns are set directly: only session_items has
  // an active-session trigger, inventory_sessions itself does not.
  await insert('inventory_sessions',
    ['id', 'name', 'department_id', 'columns', 'display_columns', 'created_by', 'created_at'],
    ['uuid', 'text', 'uuid', 'text[]', 'text[]', 'uuid', 'timestamptz'],
    data.sessions.map((s) => ({
      id: s.id, name: s.name, department_id: s.department_id,
      columns: s.columns, display_columns: s.display_columns,
      created_by: s.created_by, created_at: s.created_at,
    })))
  // Ordered explicitly (not left to incidental jsonb_to_recordset/plan
  // order) so the generated `seq` - and therefore list/spreadsheet order -
  // is deterministic. Item ids are zero-padded and assigned in fixture
  // order (§1.6), so sorting by id reproduces that order exactly.
  await db.query(
    `insert into session_items (id, session_id, item_code, data, scanned_at, scanned_by)
     select id, session_id, item_code, data, scanned_at, scanned_by
       from jsonb_to_recordset($1::jsonb)
         as r(id uuid, session_id uuid, item_code text, data jsonb, scanned_at timestamptz, scanned_by uuid)
      order by id`,
    [JSON.stringify(data.items)],
  )
  // Scan history (Phase 4) goes in before the completing update too (G-8) -
  // its insert trigger requires the session to still be active.
  await db.query(
    `insert into scan_events (id, session_id, item_id, item_code, outcome, actor, created_at)
     select id, session_id, item_id, item_code, outcome, actor, created_at
       from jsonb_to_recordset($1::jsonb)
         as r(id uuid, session_id uuid, item_id uuid, item_code text, outcome text, actor uuid, created_at timestamptz)
      order by id`,
    [JSON.stringify(data.scans)],
  )

  const completing = data.sessions.filter((s) => s.status === 'completed')
  if (completing.length) {
    await db.query(
      `update inventory_sessions s
          set status = 'completed', completed_at = r.completed_at, completed_by = r.completed_by
         from jsonb_to_recordset($1::jsonb) as r(id uuid, completed_at timestamptz, completed_by uuid)
        where s.id = r.id`,
      [JSON.stringify(completing.map((s) => ({ id: s.id, completed_at: s.completed_at, completed_by: s.completed_by })))],
    )
  }
}

const idsOf = (rows) => rows.map((r) => r.id)

/**
 * Loads the example data alongside whatever is already there, all or nothing.
 * Refuses rather than half-loads if a real device, employee or department
 * already uses one of the example asset tags, serial numbers, emails or
 * department names.
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
       union all
       select 'department', name from departments
        where lower(btrim(name)) = any($4::text[])
        order by 1, 2`,
      [
        data.devices.map((d) => d.asset_tag.toLowerCase()),
        data.devices.map((d) => d.serial_number.toLowerCase()),
        data.employees.map((e) => e.email.toLowerCase()),
        data.departments.map((d) => d.name.toLowerCase()),
      ],
    )
    if (clashes.length) return { status: 'clash', clashes }

    await insertExampleData(tx, data)
    return {
      status: 'loaded',
      devices: data.devices.length,
      employees: data.employees.length,
      handouts: data.assignments.length,
      departments: data.departments.length,
      sessions: data.sessions.length,
      items: data.items.length,
      scans: data.scans.length,
    }
  })
}

/**
 * Deletes every example row. Handouts you recorded yourself that involve an
 * example device or example employee go too, since they cannot outlive what
 * they point at; they are counted separately so nothing disappears unreported.
 * An example department a real account still belongs to is left in place -
 * `on delete restrict` would otherwise abort the whole removal.
 */
export async function removeExampleData(db) {
  const data = buildExampleData()
  const exampleHandouts = new Set(idsOf(data.assignments))

  return db.transaction(async (tx) => {
    // Sessions first (items cascade with them) - nothing else depends on a
    // session, and profiles/departments guards below need it gone first.
    const sessions = await tx.query(
      'delete from inventory_sessions where id = any($1::uuid[])', [idsOf(data.sessions)])
    const { rows: handouts } = await tx.query(
      `delete from assignments
        where id = any($1::uuid[]) or device_id = any($2::uuid[]) or employee_id = any($3::uuid[])
        returning id`,
      [[...exampleHandouts], idsOf(data.devices), idsOf(data.employees)],
    )
    const devices = await tx.query('delete from devices where id = any($1::uuid[])', [idsOf(data.devices)])
    const employees = await tx.query('delete from employees where id = any($1::uuid[])', [idsOf(data.employees)])
    const profiles = await tx.query(
      `delete from profiles p
        where p.id = any($1::uuid[])
          and not exists (select 1 from assignments a where a.issued_by = p.id or a.returned_by = p.id)
          and not exists (select 1 from inventory_sessions s where s.created_by = p.id or s.completed_by = p.id)
          and not exists (select 1 from session_items i where i.scanned_by = p.id)
          and not exists (select 1 from scan_events e where e.actor = p.id)`,
      [idsOf(data.staff)],
    )
    const departments = await tx.query(
      `delete from departments d
        where d.id = any($1::uuid[])
          and not exists (select 1 from profiles p where p.department_id = d.id)
          and not exists (select 1 from inventory_sessions s where s.department_id = d.id)`,
      [idsOf(data.departments)],
    )

    return {
      devices: devices.rowCount,
      employees: employees.rowCount,
      handouts: handouts.filter((h) => exampleHandouts.has(h.id)).length,
      yourHandouts: handouts.filter((h) => !exampleHandouts.has(h.id)).length,
      profiles: profiles.rowCount,
      departments: departments.rowCount,
      sessions: sessions.rowCount,
    }
  })
}
