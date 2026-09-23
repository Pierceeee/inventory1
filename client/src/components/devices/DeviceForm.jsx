import { useState } from 'react'
import Field, { inputClass } from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { fieldErrorsOf } from '../../lib/errors.js'

// "issued" is deliberately absent - it is derived, never stored (§4).
const STATUSES = [['available', 'Available'], ['repair', 'In repair'], ['retired', 'Retired']]
const OSES = [['macos', 'macOS'], ['windows', 'Windows'], ['ios', 'iOS'], ['android', 'Android']]

export default function DeviceForm({ device, isEdit, onSubmit, isPending, error, onCancel }) {
  const [values, setValues] = useState({
    asset_tag: device?.asset_tag ?? '',
    type: device?.type ?? 'laptop',
    brand: device?.brand ?? '',
    model: device?.model ?? '',
    serial_number: device?.serial_number ?? '',
    os: device?.os ?? 'macos',
    status: device?.status ?? 'available',
    notes: device?.notes ?? '',
  })
  const [localErrors, setLocalErrors] = useState({})

  const serverErrors = fieldErrorsOf(error)
  const errors = { ...serverErrors, ...localErrors }
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const described = (key) => (errors[key] ? `${key}-error` : undefined)

  function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!values.asset_tag.trim()) found.asset_tag = 'Asset tag is required.'
    setLocalErrors(found)
    if (Object.keys(found).length) return
    onSubmit({
      ...values,
      asset_tag: values.asset_tag.trim(),
      brand: values.brand.trim() || null,
      model: values.model.trim() || null,
      serial_number: values.serial_number.trim() || null,
      notes: values.notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-5">
      {!Object.keys(serverErrors).length && <ErrorBanner error={error} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="asset_tag" label="Asset tag" required error={errors.asset_tag}>
          <input id="asset_tag" className={inputClass} value={values.asset_tag}
                 onChange={set('asset_tag')} placeholder="ASP-0042"
                 aria-describedby={described('asset_tag')} />
        </Field>

        <Field id="type" label="Type" required error={errors.type}>
          <select id="type" className={inputClass} value={values.type} onChange={set('type')}
                  aria-describedby={described('type')}>
            <option value="laptop">Laptop</option>
            <option value="mobile">Mobile</option>
          </select>
        </Field>

        <Field id="brand" label="Brand" error={errors.brand}>
          <input id="brand" className={inputClass} value={values.brand} onChange={set('brand')}
                 placeholder="Apple" aria-describedby={described('brand')} />
        </Field>

        <Field id="model" label="Model" error={errors.model}>
          <input id="model" className={inputClass} value={values.model} onChange={set('model')}
                 placeholder="MacBook Air M2" aria-describedby={described('model')} />
        </Field>

        <Field id="serial_number" label="Serial number" error={errors.serial_number}>
          <input id="serial_number" className={inputClass} value={values.serial_number}
                 onChange={set('serial_number')} aria-describedby={described('serial_number')} />
        </Field>

        <Field id="os" label="Operating system" error={errors.os}>
          <select id="os" className={inputClass} value={values.os} onChange={set('os')}
                  aria-describedby={described('os')}>
            {OSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>

        {isEdit && (
          <Field id="status" label="Lifecycle status" error={errors.status}
                 hint="Whether the device is currently issued is derived from its handouts.">
            <select id="status" className={inputClass} value={values.status} onChange={set('status')}
                    aria-describedby={described('status')}>
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        )}
      </div>

      <Field id="notes" label="Notes" error={errors.notes}>
        <textarea id="notes" rows={3} className={inputClass} value={values.notes}
                  onChange={set('notes')} aria-describedby={described('notes')} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Save device'}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
