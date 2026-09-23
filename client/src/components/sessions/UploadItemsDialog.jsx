import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import DropZone from './DropZone.jsx'
import ColumnPicker from './ColumnPicker.jsx'
import ImportPreview from '../imports/ImportPreview.jsx'
import { useToast } from '../ui/Toast.jsx'
import { buildImportPayload, parseSpreadsheet, readFileAsArrayBuffer } from '../../lib/spreadsheet.js'
import { useImportItems } from '../../hooks/useInventorySessions.js'
import { ApiError } from '../../lib/errors.js'

// A local (never-sent-to-the-server) file problem, shaped like an ApiError so
// ErrorBanner shows its own message instead of the generic network fallback.
const localError = (message) => new ApiError({ status: 0, code: 'INVALID_FILE', message })

/** DropZone -> detected item-code column + row count -> ColumnPicker ->
 *  Check file (dry run) -> ImportPreview -> Import N items -> result. */
export default function UploadItemsDialog({ session, open, onClose }) {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [selected, setSelected] = useState([])
  const [preview, setPreview] = useState(null)
  const [committed, setCommitted] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()
  const importItems = useImportItems()

  function reset() {
    setFileName(''); setParsed(null); setSelected([])
    setPreview(null); setCommitted(null); setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(file) {
    reset()
    setFileName(file.name)
    setBusy(true)
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const result = await parseSpreadsheet({ name: file.name, buffer })
      if (result.rows.length === 0) { setError(localError('That file has no rows.')); return }
      const built = buildImportPayload(result)
      if (built.error) { setError(localError(built.error)); return }
      setParsed(result)
      setSelected(built.columns)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function run(commit) {
    setBusy(true); setError(null)
    try {
      const built = buildImportPayload(parsed, selected)
      const data = await importItems.mutateAsync({
        id: session.id, columns: built.columns, display_columns: built.display_columns,
        rows: built.rows, commit,
      })
      if (commit) {
        setCommitted(data)
        setPreview(null)
        notify(`Added ${data.created} item${data.created === 1 ? '' : 's'} to ${session.name}.`, {
          detail: data.skipped > 0 ? `${data.skipped} skipped.` : undefined,
        })
      } else {
        setPreview(data)
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const built = parsed ? buildImportPayload(parsed) : null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={session ? `Upload items — ${session.name}` : 'Upload items'}
      wide
      footer={
        <>
          {committed ? (
            <Button variant="secondary" onClick={reset}>Upload another file</Button>
          ) : (
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          )}
          {parsed && !committed && !preview && (
            <Button onClick={() => run(false)} disabled={busy}>{busy ? 'Checking…' : 'Check file'}</Button>
          )}
          {preview && !committed && (
            <>
              <Button variant="secondary" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={() => run(true)} disabled={busy || preview.created === 0}>
                {busy ? 'Importing…' : `Import ${preview.created} item${preview.created === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </>
      }>
      <div className="flex flex-col gap-4">
        <ErrorBanner error={error} />

        {!parsed && <DropZone onFile={handleFile} disabled={busy} />}

        {fileName && parsed && built && !built.error && (
          <>
            <p className="text-sm text-slate-600">
              {fileName} · Item codes: column <strong>{built.codeColumn}</strong> · {parsed.rows.length} rows
            </p>
            {built.reserved.length > 0 && (
              <p className="text-xs text-slate-500">
                Ignored columns (already used for scan results): {built.reserved.join(', ')}
              </p>
            )}
            {!committed && !preview && (
              <ColumnPicker columns={built.columns} selected={selected} onChange={setSelected} />
            )}
          </>
        )}

        {preview && !committed && <ImportPreview result={preview} />}

        {committed && (
          <div className="rounded-lg bg-ok-50 p-4 ring-1 ring-inset ring-emerald-200">
            <p className="text-sm font-semibold text-ok-700">
              Added {committed.created} item{committed.created === 1 ? '' : 's'}.
              {committed.skipped > 0 && ` ${committed.skipped} skipped.`}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
