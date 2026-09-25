import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Field, { inputClass } from '../components/ui/Field.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { useSession } from '../hooks/useSession.jsx'
import { LogoPlaceholder } from '../components/layout/Sidebar.jsx'

const ZONE_SIGNS = [
  ['bg-zone-audits', 'Audits', 'scan each session against its list'],
  ['bg-zone-custody', 'Custody', 'devices, handouts and returns'],
  ['bg-zone-admin', 'Admin', 'staff accounts and departments'],
]

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
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* The sign panel: what this is and which zones it covers. */}
      <aside className="flex flex-col gap-8 bg-ink-900 px-6 py-6 text-ink-300 sm:px-10 lg:w-[26rem] lg:justify-between lg:py-10 xl:w-[30rem]">
        <div className="flex items-center gap-3">
          <LogoPlaceholder />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-white">Adspark</p>
            <p className="text-[13px] font-medium">IT Inventory</p>
          </div>
        </div>

        <div className="hidden lg:block">
          <p className="max-w-xs text-[26px] font-semibold leading-tight tracking-[-0.01em] text-white">
            Every device, who has it, and whether it was found in the last audit.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm">
            {ZONE_SIGNS.map(([key, label, detail]) => (
              <li key={label} className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[2px] ${key}`} />
                <span><span className="font-semibold text-white">{label}</span> · {detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-xs text-ink-400 lg:block">For Adspark IT staff</p>
      </aside>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 lg:items-center">
        <div className="w-full max-w-sm">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink-900">Sign in</h1>
        <p className="mb-6 mt-1 text-[15px] text-slate-500">Adspark IT Inventory</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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

          <Button type="submit" disabled={busy} className="mt-1 w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        </div>
      </main>
    </div>
  )
}
