/** Which columns the item table (and export) show. `columns` is every column
 *  available; `selected` is the subset currently checked. */
export default function ColumnPicker({ columns, selected, onChange }) {
  const toggle = (name) =>
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name])

  return (
    <fieldset className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-slate-900">Columns to show</legend>
        <div className="flex gap-2 text-xs">
          <button type="button" className="font-medium text-brand-700 hover:underline"
                  onClick={() => onChange([...columns])}>
            Select all
          </button>
          <button type="button" className="font-medium text-brand-700 hover:underline"
                  onClick={() => onChange([])}>
            Select none
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {columns.map((name) => (
          <label key={name} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => toggle(name)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
