import { useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import DropZone from './DropZone.jsx'
import SheetPreview from './SheetPreview.jsx'
import ImportPreview from '../imports/ImportPreview.jsx'
import { useToast } from '../ui/Toast.jsx'
import { buildImportPayload, parseSpreadsheet, readFileAsArrayBuffer } from '../../lib/spreadsheet.js'
import { useImportItems } from '../../hooks/useInventorySessions.js'
import { ApiError } from '../../lib/errors.js'

// A local (never-sent-to-the-server) file problem, shaped like an ApiError so
// ErrorBanner shows its own message instead of the generic network fallback.
const localError = (message) => new ApiError({ status: 0, code: 'INVALID_FILE', message })

const plural = (n) => `${n} item${n === 1 ? '' : 's'}`

/** View, then approve: DropZone -> the file's rows plus the dry run's verdict
 *  (added / skipped / cannot be read), checked as soon as the file is read ->
 *  Import N items -> result. Nothing to set up: the scan-code column is
 *  picked automatically and every other column is kept as it is. Which
 *  columns the item table shows stays under "Choose columns" on the session
 *  page - an upload never changes it (display_columns is not sent). */
export default function UploadItemsDialog({ session, open, onClose }) {
  const [fileName, setFileName] = useState('')
  const [payload, setPayload] = useState(null)
  const [check, setCheck] = useState(null)
  const [committed, setCommitted] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()
  const importItems = useImportItems()
  // Bumped by every reset, so a dry run still in flight for a file the user
  // has since replaced (or closed) never lands on the new one.
  const attempt = useRef(0)

  function reset() {
    attempt.current += 1
    setFileName(''); setPayload(null); setCheck(null); setCommitted(null); setError(null); setBusy(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  const send = (built, commit) => importItems.mutateAsync({
    id: session.id, columns: built.columns, rows: built.rows, commit,
  })

  async function runCheck(built) {
    const mine = attempt.current
    setBusy(true); setError(null)
    try {
      const data = await send(built, false)
      if (mine === attempt.current) setCheck(data)
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
      if (parsed.rows.length === 0) { setError(localError('That file has no rows.')); setBusy(false); return }
      const built = buildImportPayload(parsed)
      if (built.error) { setError(localError(built.error)); setBusy(false); return }
      setPayload(built)
      await runCheck(built)
    } catch (err) {
      if (mine === attempt.current) { setError(err); setBusy(false) }
    }
  }

  async function handleImport() {
    const mine = attempt.current
    setBusy(true); setError(null)
    try {
      const data = await send(payload, true)
      notify(`Added ${plural(data.created)} to ${session.name}.`, {
        detail: data.skipped > 0 ? `${data.skipped} skipped.` : undefined,
      })
      if (mine === attempt.current) setCommitted(data)
    } catch (err) {
      if (mine === attempt.current) setError(err)
    } finally {
      if (mine === attempt.current) setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={session ? `Upload items — ${session.name}` : 'Upload items'}
      wide="xl"
      footer={
        committed ? (
          <>
            <Button variant="secondary" onClick={reset}>Upload another file</Button>
            <Button onClick={handleClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            {payload && !check && !busy && (
              <Button onClick={() => runCheck(payload)}>Try again</Button>
            )}
            {payload && check && (
              <Button onClick={handleImport} disabled={busy || check.created === 0}>
                {busy ? 'Importing…' : `Import ${plural(check.created)}`}
              </Button>
            )}
          </>
        )
      }>
      <div className="flex flex-col gap-4">
        <ErrorBanner error={error} />

        {!payload && <DropZone onFile={handleFile} disabled={busy} />}

        {payload && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{fileName}</span>
              {' · '}{payload.rows.length} rows · Items are scanned by <strong>{payload.codeColumn}</strong>
            </p>
            {!committed && (
              <button type="button" onClick={reset} className="text-xs font-medium text-brand-700 hover:underline">
                Choose a different file
              </button>
            )}
          </div>
        )}

        {payload?.reserved.length > 0 && !committed && (
          <p className="text-xs text-slate-500">
            Ignored columns (already used for scan results): {payload.reserved.join(', ')}
          </p>
        )}

        {payload && !check && busy && (
          <p role="status" className="text-sm text-slate-500">Checking the file…</p>
        )}

        {check && !committed && <ImportPreview result={check} />}

        {payload && !committed && (
          <SheetPreview
            fileName={fileName}
            codeColumn={payload.codeColumn}
            columns={payload.columns}
            rows={payload.rows}
            problems={check?.errors}
          />
        )}

        {committed && (
          <div className="rounded-lg bg-ok-50 p-4 ring-1 ring-inset ring-emerald-200">
            <p className="text-sm font-semibold text-ok-700">
              Added {plural(committed.created)}.
              {committed.skipped > 0 && ` ${committed.skipped} skipped.`}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
