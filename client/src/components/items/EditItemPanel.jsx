import { useEffect, useState } from 'react'
import Drawer from '../ui/Drawer.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useInventorySession } from '../../hooks/useInventorySessions.js'
import { useUpdateItem } from '../../hooks/useItems.js'
import { fieldErrorsOf } from '../../lib/errors.js'
import { useToast } from '../ui/Toast.jsx'

/** The Inventory page's slide-over edit form: item code plus one field per
 *  column the item's session was ever imported with (the FULL column list,
 *  not just display_columns - editing must reach every field, even one the
 *  session currently hides). Editing never changes scanned_at/scanned_by. */
export default function EditItemPanel({ item, open, onClose }) {
  const { data: session } = useInventorySession(item?.session_id)
  const update = useUpdateItem()
  const { notify } = useToast()

  const [itemCode, setItemCode] = useState('')
  const [data, setData] = useState({})

  useEffect(() => {
    if (!open || !item) return
    setItemCode(item.item_code)
    setData({ ...item.data })
    update.reset()
  }, [open, item]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = fieldErrorsOf(update.error)
  const columns = session?.columns ?? []

  function handleSubmit(e) {
    e.preventDefault()
    update.mutate(
      { id: item.id, item_code: itemCode, data },
      { onSuccess: (saved) => { notify(`Saved ${saved.item_code}.`); onClose() } },
    )
  }

  if (!item) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit ${item.item_code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!Object.keys(errors).length && <ErrorBanner error={update.error} />}

        <Field id="edit-item-code" label="Item Code" required error={errors.item_code}>
          <input id="edit-item-code" className={inputClass} value={itemCode}
                 onChange={(e) => setItemCode(e.target.value)} />
        </Field>

        {columns.map((name) => (
          <Field key={name} id={`edit-item-${name}`} label={name} error={errors[name]}>
            <input id={`edit-item-${name}`} className={inputClass} value={data[name] ?? ''}
                   onChange={(e) => setData((d) => ({ ...d, [name]: e.target.value }))} />
          </Field>
        ))}
      </form>
    </Drawer>
  )
}
