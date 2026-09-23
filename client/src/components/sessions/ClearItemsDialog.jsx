import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import Icon from '../ui/Icon.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useClearItems } from '../../hooks/useInventorySessions.js'

/** Empties every item from a session - the next upload brings its own
 *  columns. Typing the word CLEAR (not just a click) guards against clearing
 *  a session by mistake, since it cannot be undone. */
export default function ClearItemsDialog({ session, open, onClose }) {
  const [confirm, setConfirm] = useState('')
  const clear = useClearItems()
  const { notify } = useToast()

  useEffect(() => {
    if (!open) return
    setConfirm('')
    clear.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e) {
    e.preventDefault()
    if (confirm !== 'CLEAR') return
    clear.mutate(session.id, {
      onSuccess: (result) => {
        notify(`Cleared ${result.deleted} item${result.deleted === 1 ? '' : 's'} from ${session.name}.`)
        onClose()
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Clear all items"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleSubmit} disabled={confirm !== 'CLEAR' || clear.isPending}>
            <Icon name="eraser" size={16} /> {clear.isPending ? 'Clearing…' : 'Clear All Items'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <ErrorBanner error={clear.error} />
        <p className="text-sm text-slate-600">
          This removes every item from <strong>{session?.name}</strong> and resets its columns.
          Scan history is kept. This cannot be undone.
        </p>
        <Field id="clear-confirm" label="Type CLEAR to confirm">
          <input id="clear-confirm" className={inputClass} value={confirm}
                 onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </form>
    </Modal>
  )
}
