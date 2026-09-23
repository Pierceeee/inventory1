import { useState } from 'react'
import { inputClass } from './Field.jsx'
import Icon from './Icon.jsx'

/** A password field with a show/hide toggle - registering someone else's
 *  account is exactly when you want to check what you typed. */
export default function PasswordInput({ id, value, onChange, autoComplete = 'current-password', ...rest }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={`${inputClass} pr-10`}
        value={value}
        onChange={onChange}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600">
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  )
}
