import Field, { inputClass } from '../ui/Field.jsx'

export default function ColumnMapper({ fields, headers, mapping, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <Field key={field.key} id={`map-${field.key}`} label={field.label} required={field.required}
               hint={field.hint}>
          <select id={`map-${field.key}`} className={inputClass} value={mapping[field.key] ?? ''}
                  onChange={(e) => onChange({ ...mapping, [field.key]: e.target.value })}>
            <option value="">— not in this file —</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
      ))}
    </div>
  )
}
