import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useSession } from '../../hooks/useSession.jsx'
import { useDepartmentList } from '../../hooks/useDepartments.js'
import { useCreateSession } from '../../hooks/useInventorySessions.js'
import { fieldErrorsOf } from '../../lib/errors.js'
import { isAdmin } from '../../lib/roles.js'

export default function NewSessionDialog({ open, onClose }) {
  const { profile } = useSession()
  const admin = isAdmin(profile)
  const navigate = useNavigate()
  const { notify } = useToast()
  const create = useCreateSession()
  // Admin-only fetch: departments is an admin route, and a head never needs
  // the list - their own department is fixed and shown as plain text.
  const { data: departments = [] } = useDepartmentList({ enabled: open && admin })

  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setDepartmentId('')
    create.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = fieldErrorsOf(create.error)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    const body = admin ? { name: name.trim(), department_id: departmentId } : { name: name.trim() }
    create.mutate(body, {
      onSuccess: (session) => {
        notify(`Created ${session.name}.`)
        onClose()
        navigate(`/sessions/${session.id}`)
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New session"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || (admin && !departmentId) || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create session'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!errors.name && !errors.department_id && <ErrorBanner error={create.error} />}

        <Field id="session-name" label="Name" required error={errors.name}>
          <input id="session-name" className={inputClass} value={name}
                 onChange={(e) => setName(e.target.value)} placeholder="IT Laptops Q4 2026" />
        </Field>

        {admin ? (
          <Field id="session-department" label="Department" required error={errors.department_id}>
            <select id="session-department" className={inputClass} value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Choose a department…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field id="session-department" label="Department">
            <p id="session-department" className="text-sm text-slate-700">
              {profile?.department?.name ?? '—'}
            </p>
          </Field>
        )}
      </form>
    </Modal>
  )
}
