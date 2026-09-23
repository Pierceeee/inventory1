import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useUndoScan } from '../../hooks/useInventorySessions.js'

/** Admin-only confirmation before reversing a scan (§7). */
export default function UndoScanDialog({ session, item, open, onClose }) {
  const undo = useUndoScan(session?.id)
  const { notify } = useToast()

  if (!item) return null

  function handleUndo() {
    undo.mutate(item.id, {
      onSuccess: () => { notify(`${item.item_code} is pending again.`); onClose() },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Undo this scan?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleUndo} disabled={undo.isPending}>
            {undo.isPending ? 'Undoing…' : 'Undo scan'}
          </Button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <ErrorBanner error={undo.error} />
        <p className="text-sm text-slate-600">
          <strong className="font-medium text-slate-900">{item.item_code}</strong> will be marked pending again.
        </p>
      </div>
    </Modal>
  )
}
