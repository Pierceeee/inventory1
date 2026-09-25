import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useDeleteItem } from '../../hooks/useItems.js'

export default function DeleteItemDialog({ item, open, onClose }) {
  const del = useDeleteItem()
  const { notify } = useToast()

  if (!item) return null

  function handleDelete() {
    del.mutate({ id: item.id, session_id: item.session_id }, {
      onSuccess: () => { notify(`Deleted ${item.item_code}.`); onClose() },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete ${item.item_code}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={del.isPending}>
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <ErrorBanner error={del.error} />
        <p className="text-sm text-slate-600">
          <strong className="font-medium text-slate-900">{item.item_code}</strong> will be permanently deleted.
          This cannot be undone.
        </p>
      </div>
    </Modal>
  )
}
