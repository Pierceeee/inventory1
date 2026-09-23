import { DEVICE_TYPES } from '../lib/values.js'

export async function getDashboard(db) {
  const [totals, employees, byType, stranded, inRepair, unassigned, holders] = await Promise.all([
    db.query(
      `select count(*)::int                                                          as devices,
              count(*) filter (where assignment_id is not null)::int                 as issued,
              count(*) filter (where assignment_id is null and status = 'available')::int as available,
              count(*) filter (where status = 'repair')::int                         as repair,
              count(*) filter (where status = 'retired')::int                        as retired
         from device_current_holder`),
    db.query(`select count(*)::int as active from employees where status = 'active'`),
    db.query(
      `select type,
              count(*)::int                                                          as total,
              count(*) filter (where assignment_id is not null)::int                 as issued,
              count(*) filter (where assignment_id is null and status = 'available')::int as available
         from device_current_holder
        group by type`),
    // §5 lets a resigned person keep holding devices; these need chasing.
    db.query(
      `select e.id as employee_id, e.full_name, e.resigned_at,
              a.id as assignment_id, a.device_id, d.asset_tag, a.issued_at
         from employees e
         join assignments a on a.employee_id = e.id and a.returned_at is null
         join devices d on d.id = a.device_id
        where e.status = 'resigned'
        order by e.resigned_at, e.full_name, a.issued_at`),
    db.query(
      `select id as device_id, asset_tag, model
         from devices where status = 'repair'
        order by asset_tag`),
    db.query(
      `select e.id as employee_id, e.full_name, e.department
         from employees e
        where e.status = 'active'
          and not exists (select 1 from assignments a
                           where a.employee_id = e.id and a.returned_at is null)
        order by e.full_name`),
    db.query(
      `select id as device_id, asset_tag, type, model,
              holder_id as employee_id, holder_name, issued_at
         from device_current_holder
        where assignment_id is not null
        order by holder_name, asset_tag`),
  ])

  const counts = new Map(byType.rows.map((row) => [row.type, row]))

  return {
    totals: { ...totals.rows[0], employees: employees.rows[0].active },
    // Always both types, so an empty register reads as zeros rather than a gap.
    by_type: DEVICE_TYPES.map((type) => ({
      type,
      total: counts.get(type)?.total ?? 0,
      issued: counts.get(type)?.issued ?? 0,
      available: counts.get(type)?.available ?? 0,
    })),
    attention: {
      resigned_holding: groupByEmployee(stranded.rows),
      in_repair: inRepair.rows,
      unassigned_staff: unassigned.rows,
    },
    holders: holders.rows,
  }
}

function groupByEmployee(rows) {
  const people = new Map()
  for (const { employee_id, full_name, resigned_at, ...device } of rows) {
    if (!people.has(employee_id)) {
      people.set(employee_id, { employee_id, full_name, resigned_at, devices: [] })
    }
    people.get(employee_id).devices.push(device)
  }
  return [...people.values()]
}
