import { useState } from 'react'
import Papa from 'papaparse'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import ColumnMapper from '../components/imports/ColumnMapper.jsx'
import ImportPreview from '../components/imports/ImportPreview.jsx'
import { importDevices, importEmployees } from '../api/imports.js'

const KINDS = [
  { value: 'devices', label: 'Devices' },
  { value: 'employees', label: 'Employees' },
]

const FIELDS = {
  devices: [
    { key: 'asset_tag', label: 'Asset tag', required: true },
    { key: 'type', label: 'Type', required: true, hint: 'Values must read laptop or mobile.' },
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'serial_number', label: 'Serial number' },
    { key: 'os', label: 'Operating system', hint: 'macos, windows, ios, or android.' },
    { key: 'notes', label: 'Notes' },
  ],
  employees: [
    { key: 'full_name', label: 'Full name', required: true },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
  ],
}

/** Guess a mapping by matching header names loosely against our field keys. */
function guessMapping(fields, headers) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '')
  const mapping = {}
  for (const field of fields) {
    const target = norm(field.key)
    const hit = headers.find((h) => norm(h) === target)
      ?? headers.find((h) => norm(h).includes(target) || target.includes(norm(h)))
    if (hit) mapping[field.key] = hit
  }
  return mapping
}

export default function ImportPage() {
  const [kind, setKind] = useState('devices')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const [committed, setCommitted] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const fields = FIELDS[kind]

  function reset() {
    setFileName(''); setHeaders([]); setRawRows([]); setMapping({})
    setPreview(null); setCommitted(null); setError(null)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    reset()
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = (meta.fields ?? []).filter(Boolean)
        setHeaders(cols)
        setRawRows(data)
        setMapping(guessMapping(fields, cols))
      },
      error: (err) => setError(err),
    })
  }

  const mappedRows = () =>
    rawRows.map((row) => {
      const out = {}
      for (const field of fields) {
        const column = mapping[field.key]
        const value = column ? String(row[column] ?? '').trim() : ''
        out[field.key] = field.key === 'type' || field.key === 'os' ? value.toLowerCase() : value
      }
      return out
    })

  async function run(commit) {
    setBusy(true); setError(null)
    try {
      const send = kind === 'devices' ? importDevices : importEmployees
      const { data } = await send(mappedRows(), commit)
      if (commit) { setCommitted(data); setPreview(null) } else { setPreview(data) }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const missingRequired = fields.filter((f) => f.required && !mapping[f.key])

  return (
    <>
      <PageHeader
        title="Import"
        subtitle="Load your existing spreadsheet. Nothing is saved until you commit."
        actions={rawRows.length > 0 && <Button variant="secondary" onClick={reset}>Start over</Button>}
      />

      <div className="flex flex-col gap-6">
        <ErrorBanner error={error} />

        <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <p className="mb-3 text-sm font-semibold text-slate-900">1 · What are you importing?</p>
          <FilterChips label="Import type" options={KINDS} value={kind}
                       onChange={(v) => { setKind(v); reset() }} />
        </div>

        <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <label htmlFor="csv" className="mb-3 block text-sm font-semibold text-slate-900">
            2 · Choose a CSV file
          </label>
          <input id="csv" type="file" accept=".csv,text/csv" onChange={handleFile}
                 className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
          {fileName && (
            <p className="mt-2 text-xs text-slate-500">
              {fileName} · {rawRows.length} rows · {headers.length} columns
            </p>
          )}
        </div>

        {headers.length > 0 && (
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <p className="mb-3 text-sm font-semibold text-slate-900">3 · Match your columns</p>
            <ColumnMapper fields={fields} headers={headers} mapping={mapping} onChange={setMapping} />
            {missingRequired.length > 0 && (
              <p className="mt-4 rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-700">
                Still needed: {missingRequired.map((f) => f.label).join(', ')}.
              </p>
            )}
            <div className="mt-4">
              <Button onClick={() => run(false)} disabled={busy || missingRequired.length > 0}>
                {busy ? 'Checking…' : 'Preview import'}
              </Button>
            </div>
          </div>
        )}

        {preview && (
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <p className="mb-3 text-sm font-semibold text-slate-900">4 · Check before committing</p>
            <ImportPreview result={preview} />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => run(true)} disabled={busy || preview.created === 0}>
                {busy ? 'Importing…' : `Import ${preview.created} ${kind}`}
              </Button>
              <Button variant="secondary" onClick={() => setPreview(null)}>Back</Button>
            </div>
          </div>
        )}

        {committed && (
          <div className="rounded-xl bg-ok-50 p-5 ring-1 ring-inset ring-emerald-200">
            <p className="text-sm font-semibold text-ok-700">
              Imported {committed.created} {kind}.
              {committed.skipped > 0 && ` ${committed.skipped} already existed and were skipped.`}
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
