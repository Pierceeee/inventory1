import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import PasswordInput from '../ui/PasswordInput.jsx'
import Field from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import Icon from '../ui/Icon.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useDeleteSession, useDownloadSessionExport } from '../../hooks/useInventorySessions.js'
import { fieldErrorsOf } from '../../lib/errors.js'

/**
 * Two required steps before Delete Session is even clickable (X2/X3): a
 * backup download, then the admin's own password. A wrong password shows an
 * inline error and leaves the dialog open - it never signs anyone out (the
 * server answers 422 WRONG_PASSWORD, never 401).
 */
export default function DeleteSessionDialog({ session, open, onClose, onDeleted }) {
  const [backedUp, setBackedUp] = useState(false)
  const [password, setPassword] = useState('')
  const download = useDownloadSessionExport()
  const del = useDeleteSession()
  const { notify } = useToast()

  // security LOW: reset on EVERY open/close transition, not only when
  // opening - a typed password must not linger in memory once the dialog is
  // dismissed (Cancel, the backdrop, Escape), waiting for whatever session
  // is opened next to flush it.
  useEffect(() => {
    setBackedUp(false)
    setPassword('')
    download.reset()
    del.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null

  function handleDownload() {
    download.mutate(session, { onSuccess: () => setBackedUp(true) })
  }

  function handleDelete(e) {
    e.preventDefault()
    if (!backedUp || !password) return
    del.mutate({ id: session.id, password }, {
      onSuccess: (result) => {
        notify(`Deleted ${result.name} and its ${result.items} item${result.items === 1 ? '' : 's'}.`)
        onDeleted?.()
        onClose()
      },
    })
  }

  const passwordError = fieldErrorsOf(del.error).password
  const showBanner = del.error && !passwordError

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete ${session.name}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={!backedUp || !password || del.isPending}>
            {del.isPending ? 'Deleting…' : 'Delete Session'}
          </Button>
        </>
      }>
      <form onSubmit={handleDelete} noValidate className="flex flex-col gap-4">
        {showBanner && <ErrorBanner error={del.error} />}
        <p className="text-sm text-slate-600">
          This permanently deletes <strong className="font-medium text-slate-900">{session.name}</strong> and every
          item inside it. This cannot be undone.
        </p>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-700">Step 1 — Download a backup</p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownload}
            disabled={download.isPending}
            className={backedUp ? 'bg-ok-50 text-ok-700 ring-1 ring-inset ring-emerald-200 hover:bg-ok-50' : ''}>
            {backedUp ? <Icon name="check" size={16} /> : <Icon name="download" size={16} />}
            {download.isPending ? 'Downloading…' : backedUp ? 'Backup downloaded' : 'Download Excel Backup'}
          </Button>
          {download.error && <ErrorBanner error={download.error} />}
        </div>

        <Field id="delete-session-password" label="Your password" required error={passwordError}>
          <PasswordInput
            id="delete-session-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
