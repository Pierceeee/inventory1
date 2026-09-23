import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useCompleteSession } from '../../hooks/useInventorySessions.js'

/** Completing closes scanning and uploads for good (R6: reopening is out of
 *  scope), so the pending count is shown up front rather than discovered
 *  after the fact. */
export default function CompleteSessionDialog({ session, open, onClose }) {
  const complete = useCompleteSession()
  const { notify } = useToast()
  const pending = session ? session.item_count - session.scanned_count : 0

  function handleComplete() {
    complete.mutate(session.id, {
      onSuccess: (updated) => {
        notify(`Completed ${updated.name}.`)
        onClose()
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark session complete"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleComplete} disabled={complete.isPending}>
            {complete.isPending ? 'Completing…' : 'Mark Complete'}
          </Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <ErrorBanner error={complete.error} />
        <p className="text-sm text-slate-600">
          Scanning and uploads close for good once <strong>{session?.name}</strong> is marked complete.
          {pending > 0
            ? ` ${pending} item${pending === 1 ? ' is' : 's are'} still pending.`
            : ' Every item has been scanned.'}
        </p>
      </div>
    </Modal>
  )
}
