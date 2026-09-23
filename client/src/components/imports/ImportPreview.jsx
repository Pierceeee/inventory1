export default function ImportPreview({ result }) {
  if (!result) return null
  const { created, skipped, errors } = result
  const failed = errors.filter((e) => !/skipped/i.test(e.message))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <span className="rounded-lg bg-ok-50 px-3 py-2 text-sm font-medium text-ok-700">
          {created} will be added
        </span>
        {skipped > 0 && (
          <span className="rounded-lg bg-warn-50 px-3 py-2 text-sm font-medium text-warn-700">
            {skipped} already exist — skipped
          </span>
        )}
        {failed.length > 0 && (
          <span className="rounded-lg bg-bad-50 px-3 py-2 text-sm font-medium text-bad-700">
            {failed.length} cannot be read
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Row</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Field</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Problem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.map((e, i) => (
                <tr key={`${e.line}-${e.field}-${i}`}>
                  <td className="px-4 py-2 text-sm tabular-nums text-slate-500">{e.line}</td>
                  <td className="px-4 py-2 text-sm text-slate-700">{e.field}</td>
                  <td className="px-4 py-2 text-sm text-slate-700">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
