import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader, { BackLink } from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field, { inputClass } from '../components/ui/Field.jsx'
import PasswordInput from '../components/ui/PasswordInput.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { useDepartmentList } from '../hooks/useDepartments.js'
import { useRegisterUser } from '../hooks/useUsers.js'
import { ROLES, ROLE_LABELS } from '../lib/roles.js'
import { fieldErrorsOf } from '../lib/errors.js'
import { useToast } from '../components/ui/Toast.jsx'

const EMAIL_RE = /^\S+@\S+\.\S+$/

export default function RegisterPage() {
  const navigate = useNavigate()
  const { data: departments = [] } = useDepartmentList()
  const register = useRegisterUser()
  const { notify } = useToast()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('scanner')
  const [departmentId, setDepartmentId] = useState('')
  const [localErrors, setLocalErrors] = useState({})

  const serverErrors = fieldErrorsOf(register.error)
  const errors = { ...serverErrors, ...localErrors }
  const needsDepartment = role !== 'admin'

  function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!fullName.trim()) found.full_name = 'Full name is required.'
    if (!EMAIL_RE.test(email.trim())) found.email = 'Not a valid email address.'
    if (password.length < 8) found.password = 'Use at least 8 characters.'
    if (needsDepartment && !departmentId) found.department_id = 'Heads and scanners need a department.'
    setLocalErrors(found)
    if (Object.keys(found).length) return

    register.mutate(
      {
        full_name: fullName.trim(), email: email.trim(), password, role,
        department_id: needsDepartment ? departmentId : undefined,
      },
      {
        onSuccess: (user) => {
          notify(`Registered ${user.full_name ?? user.email} as ${ROLE_LABELS[user.role]}.`)
          navigate('/users')
        },
      },
    )
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/users">Users</BackLink>}
        title="Register a user"
      />

      <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-5">
        {!Object.keys(serverErrors).length && <ErrorBanner error={register.error} />}

        <Field id="register-full-name" label="Full name" required error={errors.full_name}>
          <input id="register-full-name" className={inputClass} value={fullName}
                 onChange={(e) => setFullName(e.target.value)} placeholder="Maria Santos" />
        </Field>

        <Field id="register-email" label="Email" required error={errors.email}>
          <input id="register-email" type="email" autoComplete="username" className={inputClass}
                 value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@adspark.ph" />
        </Field>

        <Field id="register-password" label="Password" required error={errors.password}
               hint="At least 8 characters.">
          <PasswordInput id="register-password" autoComplete="new-password" value={password}
                          onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <Field id="register-role" label="Role" required error={errors.role}>
          <select id="register-role" className={inputClass} value={role}
                  onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>

        <Field id="register-department" label="Department" required={needsDepartment} error={errors.department_id}
               hint={needsDepartment ? undefined : 'Optional for admins.'}>
          <select id="register-department" className={inputClass} value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">{needsDepartment ? 'Choose a department…' : 'No department'}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>

        <div className="flex gap-2">
          <Button type="submit" disabled={register.isPending}>
            {register.isPending ? 'Registering…' : 'Register user'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/users')}>Cancel</Button>
        </div>
      </form>
    </>
  )
}
