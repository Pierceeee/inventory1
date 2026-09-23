import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useCreateDepartment, useUpdateDepartment } from '../../hooks/useDepartments.js'
import { fieldErrorsOf } from '../../lib/errors.js'
import { useToast } from '../ui/Toast.jsx'

/** Add (no `department`) or rename (`department` given) - one dialog either way. */
export default function DepartmentDialog({ department, open, onClose }) {
  const isEdit = Boolean(department)
  const create = useCreateDepartment()
  const update = useUpdateDepartment()
  const mutation = isEdit ? update : create
  const { notify } = useToast()

  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    setName(department?.name ?? '')
    mutation.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = fieldErrorsOf(mutation.error)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate(isEdit ? { id: department.id, name: name.trim() } : { name: name.trim() }, {
      onSuccess: (saved) => {
        notify(isEdit ? `Renamed to ${saved.name}.` : `Added ${saved.name}.`)
        onClose()
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Rename department' : 'Add department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add department'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!errors.name && <ErrorBanner error={mutation.error} />}
        <Field id="department-name" label="Name" required error={errors.name}>
          <input id="department-name" className={inputClass} value={name}
                 onChange={(e) => setName(e.target.value)} placeholder="Creative"
                 aria-describedby={errors.name ? 'department-name-error' : undefined} />
        </Field>
      </form>
    </Modal>
  )
}
