const COLUMNS = [
  'asset_tag', 'device_type', 'brand', 'model', 'serial_number',
  'employee_name', 'employee_email', 'department',
  'issued_at', 'returned_at', 'return_reason', 'notes',
]

/** The handout log as CSV, newest first, with the same filters as the
 *  on-screen log so what is exported is exactly what was shown. */
export async function exportAssignmentsCsv(db, { open, from, to } = {}) {
  const { rows } = await db.query(
    `select d.asset_tag, d.type as device_type, d.brand, d.model, d.serial_number,
            e.full_name as employee_name, e.email as employee_email, e.department,
            a.issued_at, a.returned_at, a.return_reason, a.notes
       from assignments a
       join devices d on d.id = a.device_id
       join employees e on e.id = a.employee_id
      where ($1::boolean is null or (a.returned_at is null) = $1)
        and ($2::timestamptz is null or a.issued_at >= $2)
        and ($3::timestamptz is null or a.issued_at <= $3)
      order by a.issued_at desc, a.created_at desc`,
    [open ?? null, from ?? null, to ?? null],
  )

  const lines = rows.map((row) => COLUMNS.map((key) => cell(row[key])).join(','))
  // The BOM makes Excel read the file as UTF-8, so "Muñoz" survives the round trip.
  return '﻿' + [COLUMNS.join(','), ...lines].join('\n')
}

/** Quote every field and double embedded quotes, so a model name with a comma
 *  cannot silently become two columns. A leading = + - @ is neutralised so a
 *  note typed as a formula is shown as text, not executed by the spreadsheet. */
function cell(value) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
