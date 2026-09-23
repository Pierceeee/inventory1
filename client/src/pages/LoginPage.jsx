import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Field, { inputClass } from '../components/ui/Field.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { useSession } from '../hooks/useSession.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFailure(null)

    const found = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = 'Enter a valid email address.'
    if (!password) found.password = 'Enter your password.'
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await signIn(email.trim(), password)
      // Return people to whatever they were trying to reach, not a generic home.
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setFailure(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Device Handout Tracker</h1>
          <p className="text-sm text-slate-500">Adspark IT</p>
        </div>

        <form onSubmit={handleSubmit} noValidate
              className="flex flex-col gap-5 rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <ErrorBanner error={failure} />

          <Field id="email" label="Email" required error={errors.email}>
            <input id="email" type="email" autoComplete="username" className={inputClass}
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="you@adspark.ph"
                   aria-describedby={errors.email ? 'email-error' : undefined} />
          </Field>

          <Field id="password" label="Password" required error={errors.password}>
            <input id="password" type="password" autoComplete="current-password" className={inputClass}
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   aria-describedby={errors.password ? 'password-error' : undefined} />
          </Field>

          <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>

        <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Mock accounts — no real auth yet</p>
          <p className="mt-1 font-mono">allen@adspark.ph · rina@adspark.ph · kim@adspark.ph</p>
          <p className="font-mono">password: adspark</p>
        </div>
      </div>
    </div>
  )
}
