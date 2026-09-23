const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
const id = (prefix, n) => `${prefix}${String(n).padStart(4, '0')}-0000-4000-8000-000000000000`

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

export const seedEmployees = NAMES.map((full_name, i) => ({
  id: id('e', i + 1),
  full_name,
  email: full_name.toLowerCase().replace(/[^a-z]+/g, '.') + '@adspark.ph',
  department: DEPARTMENTS[i % DEPARTMENTS.length],
  // Employees 29 and 30 have resigned. Both still hold devices - see below.
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

export const seedDevices = []
for (let i = 0; i < 24; i++) {
  const [brand, model, os] = LAPTOPS[i % LAPTOPS.length]
  seedDevices.push({
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
  seedDevices.push({
    id: id('d', n + 1), asset_tag: `ASP-${String(n + 1).padStart(4, '0')}`,
    type: 'mobile', brand, model, os,
    serial_number: `SN-M-${2000 + i}`,
    status: i === 15 ? 'repair' : 'available',
    notes: null,
    created_at: iso(500 - n), updated_at: iso(500 - n),
  })
}

// The small IT team who actually record handouts. Password for all of them is
// "adspark" - this is a mock stand-in for Supabase Auth, deleted at cutover.
export const seedUsers = [
  { id: id('u', 1), full_name: 'Allen Lacoste', email: 'allen@adspark.ph', password: 'adspark' },
  { id: id('u', 2), full_name: 'Rina Delgado',  email: 'rina@adspark.ph',  password: 'adspark' },
  { id: id('u', 3), full_name: 'Kim Bautista',  email: 'kim@adspark.ph',   password: 'adspark' },
]

const ACCESSORIES_FOR = { laptop: ['charger', 'case', 'box'], mobile: ['charger', 'case', 'sim', 'box'] }

const laptop = (i) => seedDevices[i]
const mobile = (i) => seedDevices[24 + i]
const emp = (i) => seedEmployees[i]

let aSeq = 0
const assign = (device, employee, issuedDaysAgo, returned = null) => {
  aSeq += 1
  const recorder = seedUsers[aSeq % seedUsers.length]
  const issuedAccessories = ACCESSORIES_FOR[device.type].filter((a) => a !== 'box')
  return {
    id: id('a', aSeq),
    device_id: device.id, employee_id: employee.id,
    issued_at: iso(issuedDaysAgo), issued_by: recorder.id,
    returned_at: returned ? iso(returned.daysAgo) : null,
    returned_by: returned ? recorder.id : null,
    return_reason: returned ? returned.reason : null,
    issued_condition: returned?.issuedCondition ?? 'good',
    returned_condition: returned ? (returned.condition ?? 'good') : null,
    issued_accessories: issuedAccessories,
    // A returned device that came back short of a charger: the case the
    // accessory tokens exist to make reportable.
    returned_accessories: returned
      ? (returned.accessories ?? issuedAccessories)
      : null,
    notes: returned?.notes ?? null,
    created_at: iso(issuedDaysAgo),
  }
}

export const seedAssignments = []

// ASP-0001 has three handouts of history: two closed, one still open.
seedAssignments.push(assign(laptop(0), emp(4), 700, { daysAgo: 500, reason: 'swap' }))
seedAssignments.push(assign(laptop(0), emp(7), 480, {
  daysAgo: 200, reason: 'resignation',
  condition: 'fair', accessories: ['charger'],
  notes: 'Case not returned. Small dent on the lid.',
}))
seedAssignments.push(assign(laptop(0), emp(0), 180))

// Eighteen more laptops currently out, one each.
for (let i = 1; i <= 18; i++) {
  seedAssignments.push(assign(laptop(i), emp(i), 60 + i * 3))
}
// Twelve mobiles currently out.
for (let i = 0; i < 12; i++) {
  seedAssignments.push(assign(mobile(i), emp(i), 50 + i * 2))
}
// A returned mobile: device is free now but has history.
seedAssignments.push(assign(mobile(12), emp(3), 300, {
  daysAgo: 30, reason: 'swap',
  condition: 'damaged', accessories: ['charger', 'sim'],
  notes: 'Screen cracked. Case missing.',
}))

// Both resigned employees still hold devices.
seedAssignments.push(assign(laptop(19), emp(28), 220))
seedAssignments.push(assign(mobile(13), emp(28), 220))
seedAssignments.push(assign(laptop(20), emp(29), 190))
