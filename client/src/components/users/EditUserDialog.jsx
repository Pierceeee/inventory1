import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useUpdateUser } from '../../hooks/useUsers.js'
import { useDepartmentList } from '../../hooks/useDepartments.js'
import { ROLES, ROLE_LABELS } from '../../lib/roles.js'
import { fieldErrorsOf } from '../../lib/errors.js'
import { useToast } from '../ui/Toast.jsx'

export default function EditUserDialog({ user, open, onClose }) {
  const update = useUpdateUser()
  const { data: departments = [] } = useDepartmentList()
  const { notify } = useToast()

  const [role, setRole] = useState('scanner')
  const [departmentId, setDepartmentId] = useState('')

  useEffect(() => {
    if (!open) return
    setRole(user?.role ?? 'scanner')
    setDepartmentId(user?.department_id ?? '')
    update.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = fieldErrorsOf(update.error)

  function handleSubmit(e) {
    e.preventDefault()
    update.mutate(
      { id: user.id, role, department_id: departmentId || null },
      {
        onSuccess: (saved) => {
          notify(`Updated ${saved.full_name ?? saved.email}.`)
          onClose()
        },
      },
    )
  }

  if (!user) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${user.full_name ?? user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!Object.keys(errors).length && <ErrorBanner error={update.error} />}

        <Field id="edit-user-role" label="Role" required error={errors.role}>
          <select id="edit-user-role" className={inputClass} value={role}
                  onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>

        <Field id="edit-user-department" label="Department" error={errors.department_id}>
          <select id="edit-user-department" className={inputClass} value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  )
}
