export const PREVIEW_LIMIT = 200

const th = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const td = 'max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5 text-slate-700'
const code = 'whitespace-nowrap px-3 py-1.5 font-mono text-[13px] text-slate-900'

/** Rows exactly as an import will save them, before anything is saved.
 *  `columns`: `[{ key, header, value: (row) => string, code? }]` - `code`
 *  marks the identifying column (monospace, never truncated). Each row needs
 *  its spreadsheet `line`. Rows the dry run flagged (`problems`, its
 *  `errors`) are tinted - amber when skipped, red when they cannot be read.
 *  Long files show their first PREVIEW_LIMIT rows; the dry run and the
 *  import always cover all of them. */
export default function RecordPreview({ caption, columns, rows, problems = [] }) {
  const flagged = new Map()
  for (const { line, message } of problems) {
    if (flagged.get(line) !== 'bad') flagged.set(line, /skipped/i.test(message) ? 'skipped' : 'bad')
  }
  const shown = rows.slice(0, PREVIEW_LIMIT)

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[45vh] overflow-auto rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th scope="col" className={th}>Row</th>
              {columns.map((c) => <th key={c.key} scope="col" className={th}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {shown.map((row) => {
              const problem = flagged.get(row.line)
              const tint = problem === 'bad' ? 'bg-bad-50' : problem === 'skipped' ? 'bg-warn-50' : ''
              return (
                <tr key={row.line} data-problem={problem} className={tint}>
                  <td className="px-3 py-1.5 tabular-nums text-slate-400">{row.line}</td>
                  {columns.map((c) => {
                    const value = c.value(row)
                    return c.code
                      ? <td key={c.key} className={code}>{value}</td>
                      : <td key={c.key} title={value || undefined} className={td}>{value}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="text-xs text-slate-500">
          Showing the first {PREVIEW_LIMIT} of {rows.length} rows. All {rows.length} are checked and imported.
        </p>
      )}
    </div>
  )
}
