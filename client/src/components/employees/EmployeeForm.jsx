import { useState } from 'react'
import Field, { inputClass } from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { fieldErrorsOf } from '../../lib/errors.js'

export default function EmployeeForm({ employee, onSubmit, isPending, error, onCancel }) {
  const [values, setValues] = useState({
    full_name: employee?.full_name ?? '',
    email: employee?.email ?? '',
    department: employee?.department ?? '',
  })
  const [localErrors, setLocalErrors] = useState({})

  const serverErrors = fieldErrorsOf(error)
  const errors = { ...serverErrors, ...localErrors }
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const described = (key) => (errors[key] ? `${key}-error` : undefined)

  function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!values.full_name.trim()) found.full_name = 'Full name is required.'
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
      found.email = 'Enter a valid email address.'
    }
    setLocalErrors(found)
    if (Object.keys(found).length) return
    onSubmit({
      full_name: values.full_name.trim(),
      email: values.email.trim() || null,
      department: values.department.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      {!Object.keys(serverErrors).length && <ErrorBanner error={error} />}

      <Field id="full_name" label="Full name" required error={errors.full_name}>
        <input id="full_name" className={inputClass} value={values.full_name}
               onChange={set('full_name')} placeholder="Maria Santos"
               aria-describedby={described('full_name')} />
      </Field>

      <Field id="email" label="Email" error={errors.email}>
        <input id="email" type="email" className={inputClass} value={values.email}
               onChange={set('email')} placeholder="maria.santos@adspark.ph"
               aria-describedby={described('email')} />
      </Field>

      <Field id="department" label="Department" error={errors.department}>
        <input id="department" className={inputClass} value={values.department}
               onChange={set('department')} placeholder="Creative"
               aria-describedby={described('department')} />
      </Field>

      {/* Status is deliberately absent. Resignation is a flow with consequences
          for the devices someone holds (§5), not a dropdown. */}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save employee'}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
