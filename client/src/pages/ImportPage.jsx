import { useRef, useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import DropZone from '../components/sessions/DropZone.jsx'
import ImportPreview from '../components/imports/ImportPreview.jsx'
import RecordPreview from '../components/imports/RecordPreview.jsx'
import { importDevices, importEmployees } from '../api/imports.js'
import { parseSpreadsheet, readFileAsArrayBuffer } from '../lib/spreadsheet.js'
import { mapDevices, mapEmployees } from '../lib/recordImport.js'
import { ApiError } from '../lib/errors.js'

// A local (never-sent-to-the-server) file problem, shaped like an ApiError so
// ErrorBanner shows its own message instead of the generic network fallback.
const localError = (message) => new ApiError({ status: 0, code: 'INVALID_FILE', message })

const MAX_ROWS = 5000 // server/src/validation.js importBatch

const oneLine = (text) => String(text ?? '').replace(/\n/g, ' · ')

/** Everything that differs between the two kinds: how the file is read,
 *  where it is sent, how its rows are previewed and how each field's source
 *  is described. */
const KINDS = {
  devices: {
    label: 'Devices',
    noun: ['device', 'devices'],
    map: mapDevices,
    send: importDevices,
    columns: [
      { key: 'asset_tag', header: 'Asset tag', code: true, value: (r) => r.asset_tag },
      { key: 'type', header: 'Type', value: (r) => r.type },
      { key: 'brand', header: 'Brand', value: (r) => r.brand },
      { key: 'model', header: 'Model', value: (r) => r.model },
      { key: 'serial_number', header: 'Serial number', value: (r) => r.serial_number },
      { key: 'os', header: 'OS', value: (r) => r.os },
      { key: 'notes', header: 'Notes', value: (r) => oneLine(r.notes) },
    ],
    fields: [
      ['asset_tag', 'Asset tag'],
      ['type', 'Type', ({ typeDefault, typeSignals }) => (typeDefault === 'mobile'
        ? `mobile, because this is a phone sheet (${typeSignals.join(', ')}). A row whose model is a laptop is saved as laptop`
        : "worked out from each row's OS and model: laptop, unless it looks like a phone or tablet")],
      ['brand', 'Brand', () => 'worked out from the model where the maker is clear'],
      ['model', 'Model'],
      ['serial_number', 'Serial number'],
      ['os', 'Operating system'],
      ['notes', 'Notes'],
    ],
    extrasLabel: 'Also kept in Notes, as "column: value"',
  },
  employees: {
    label: 'Employees',
    noun: ['employee', 'employees'],
    map: mapEmployees,
    send: importEmployees,
    columns: [
      { key: 'full_name', header: 'Full name', code: true, value: (r) => r.full_name },
      { key: 'email', header: 'Email', value: (r) => r.email },
      { key: 'department', header: 'Department', value: (r) => r.department },
    ],
    fields: [['full_name', 'Full name'], ['email', 'Email'], ['department', 'Department']],
    extrasLabel: 'Not saved (employees have no field for these)',
  },
}

const CHIPS = Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))

/** Which column fills each field - stated, never asked. A field no column
 *  fills either says how it is worked out (`workedOut(mapped)`) or that it
 *  is not in the file. */
function ColumnUse({ kind, mapped }) {
  const { fields, extrasLabel } = KINDS[kind]
  const { sources, extras } = mapped
  return (
    <ul aria-label="How your columns are used" className="flex flex-col gap-1 text-sm text-slate-600">
      {fields.map(([field, label, workedOut]) => (
        <li key={field}>
          <span className="font-medium text-slate-900">{label}</span>
          {sources[field]
            ? <> from <strong className="font-medium text-slate-900">{sources[field]}</strong></>
            : <>: {workedOut?.(mapped) ?? 'not in this file'}</>}
        </li>
      ))}
      {extras.length > 0 && (
        <li>
          <span className="font-medium text-slate-900">{extrasLabel}:</span> {extras.join(', ')}
        </li>
      )}
    </ul>
  )
}

export default function ImportPage() {
  const [kind, setKind] = useState('devices')
  const [fileName, setFileName] = useState('')
  const [mapped, setMapped] = useState(null)
  const [check, setCheck] = useState(null)
  const [committed, setCommitted] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // Bumped by every reset, so a request still in flight for a file (or kind)
  // the user has since replaced never lands on the new one.
  const attempt = useRef(0)

  const config = KINDS[kind]
  const count = (n) => `${n} ${config.noun[n === 1 ? 0 : 1]}`

  function reset() {
    attempt.current += 1
    setFileName(''); setMapped(null); setCheck(null); setCommitted(null); setError(null); setBusy(false)
  }

  async function send(rows, commit) {
    const mine = attempt.current
    setBusy(true); setError(null)
    try {
      const { data } = await config.send(rows, commit)
      if (mine !== attempt.current) return
      if (commit) setCommitted(data)
      else setCheck(data)
    } catch (err) {
      if (mine === attempt.current) setError(err)
    } finally {
      if (mine === attempt.current) setBusy(false)
    }
  }

  async function handleFile(file) {
    reset()
    const mine = attempt.current
    setFileName(file.name)
    setBusy(true)
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const parsed = await parseSpreadsheet({ name: file.name, buffer })
      if (mine !== attempt.current) return
      const fail = (message) => { setError(localError(message)); setBusy(false) }
      if (parsed.rows.length === 0) return fail('That file has no rows.')
      if (parsed.rows.length > MAX_ROWS) {
        return fail(`That file has ${parsed.rows.length.toLocaleString('en-US')} rows. Import at most 5,000 at a time.`)
      }
      const result = config.map(parsed)
      if (result.error) return fail(result.error)
      setMapped(result)
      await send(result.rows, false)
    } catch (err) {
      if (mine === attempt.current) { setError(err); setBusy(false) }
    }
  }

  return (
    <>
      <PageHeader
        title="Import"
        subtitle="Load your existing spreadsheet as it is. Nothing is saved until you approve it."
      />

      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        <div className="panel p-5">
          <p className="mb-3 text-sm font-semibold text-slate-900">1 · What are you importing?</p>
          <FilterChips label="Import type" options={CHIPS} value={kind}
                       onChange={(v) => { setKind(v); reset() }} />
        </div>

        <div className="panel p-5">
          <p className="mb-3 text-sm font-semibold text-slate-900">2 · Choose a spreadsheet</p>
          {mapped ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{fileName}</span> · {mapped.rows.length} rows
              </p>
              {!committed && (
                <button type="button" onClick={reset} className="text-xs font-medium text-brand-700 hover:underline">
                  Choose a different file
                </button>
              )}
            </div>
          ) : (
            <DropZone onFile={handleFile} disabled={busy} />
          )}
        </div>

        {mapped && !committed && (
          <div className="flex flex-col gap-4 panel p-5">
            <p className="text-sm font-semibold text-slate-900">3 · Check it, then import</p>
            <ColumnUse kind={kind} mapped={mapped} />

            {busy && !check && <p role="status" className="text-sm text-slate-500">Checking the file…</p>}
            {check && <ImportPreview result={check} />}

            <RecordPreview
              caption={`${config.label} in ${fileName}`}
              columns={config.columns}
              rows={mapped.rows}
              problems={check?.errors}
            />

            <div className="flex gap-2">
              {check && (
                <Button onClick={() => send(mapped.rows, true)} disabled={busy || check.created === 0}>
                  {busy ? 'Importing…' : `Import ${count(check.created)}`}
                </Button>
              )}
              {!check && !busy && <Button onClick={() => send(mapped.rows, false)}>Try again</Button>}
            </div>
          </div>
        )}

        {committed && (
          <div className="rounded-lg border border-ok-200 bg-ok-50 p-5">
            <p className="text-sm font-semibold text-ok-700">
              Imported {count(committed.created)}.
              {committed.skipped > 0 && ` ${committed.skipped} skipped as duplicates.`}
            </p>
            <div className="mt-3">
              <Button variant="secondary" onClick={reset}>Import another file</Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
