import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useDeviceList } from '../../hooks/useDevices.js'
import { useEmployeeList, useEmployee } from '../../hooks/useEmployees.js'
import { useIssueDevice } from '../../hooks/useAssignments.js'
import { toLocalInput, fromLocalInput } from '../../lib/format.js'
import { fieldErrorsOf } from '../../lib/errors.js'
import { useToast } from '../ui/Toast.jsx'
import { ConditionPicker, AccessoryPicker, ACCESSORIES_FOR } from './ConditionFields.jsx'

/**
 * Reached from a device page (device pre-filled) or an employee page (employee
 * pre-filled). Both land here.
 *
 * The same-type rule in §5 is a warning, never a block: swaps and loaners create
 * legitimate overlap during handover. It shows as an inline confirm that has to
 * be ticked, so it is noticed without being in the way.
 */
export default function IssueDialog({ open, onClose, device, employee, onIssued }) {
  const issue = useIssueDevice()
  const { notify } = useToast()

  const [deviceId, setDeviceId] = useState(device?.id ?? '')
  const [employeeId, setEmployeeId] = useState(employee?.id ?? '')
  const [issuedAt, setIssuedAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [notes, setNotes] = useState('')
  const [confirmedSameType, setConfirmedSameType] = useState(false)
  const [condition, setCondition] = useState('good')
  const [accessories, setAccessories] = useState([])

  // Only devices that can actually be issued: free and lifecycle-available.
  const { data: devices = [] } = useDeviceList({ held: 'false', status: 'available' })
  const { data: employees = [] } = useEmployeeList({ status: 'active' })
  const { data: chosenEmployee } = useEmployee(employeeId)

  const chosenDevice = device ?? devices.find((d) => d.id === deviceId)

  const sameTypeHeld = useMemo(() => {
    if (!chosenDevice || !chosenEmployee?.devices_held) return null
    return chosenEmployee.devices_held.find((d) => d.type === chosenDevice.type) ?? null
  }, [chosenDevice, chosenEmployee])

  useEffect(() => {
    if (!open) return
    setDeviceId(device?.id ?? '')
    setEmployeeId(employee?.id ?? '')
    setIssuedAt(toLocalInput(new Date().toISOString()))
    setNotes('')
    setConfirmedSameType(false)
    setCondition('good')
    setAccessories([])
    issue.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setConfirmedSameType(false) }, [sameTypeHeld?.assignment_id])

  useEffect(() => {
    if (!chosenDevice) return
    const defaults = (ACCESSORIES_FOR[chosenDevice.type] ?? []).filter((a) => a !== 'box')
    setAccessories(defaults)
  }, [chosenDevice?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = fieldErrorsOf(issue.error)
  const needsConfirm = Boolean(sameTypeHeld) && !confirmedSameType
  const ready = deviceId && employeeId && issuedAt && !needsConfirm

  function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    issue.mutate(
      {
        device_id: deviceId,
        employee_id: employeeId,
        issued_at: fromLocalInput(issuedAt),
        issued_condition: condition,
        issued_accessories: accessories,
        notes: notes.trim() || null,
      },
      {
        onSuccess: (result) => {
          // The server's warning is echoed back, so a same-type handout is
          // recorded in the confirmation too - not just at the moment of doing it.
          notify(
            `${result.data.asset_tag} issued to ${result.data.employee_name}.`,
            result.warning
              ? { tone: 'warning', detail: result.warning.message }
              : { tone: 'success' },
          )
          onIssued?.(result)
          onClose()
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={device ? `Issue ${device.asset_tag}` : 'Issue a device'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!ready || issue.isPending}>
            {issue.isPending ? 'Issuing…' : 'Issue device'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!Object.keys(errors).length && <ErrorBanner error={issue.error} />}

        <Field id="issue-device" label="Device" required error={errors.device_id}>
          {device ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {device.asset_tag} · {[device.brand, device.model].filter(Boolean).join(' ')}
            </p>
          ) : (
            <select id="issue-device" className={inputClass} value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">Choose a device…</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_tag} — {[d.brand, d.model].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field id="issue-employee" label="Issue to" required error={errors.employee_id}>
          {employee ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {employee.full_name}{employee.department ? ` · ${employee.department}` : ''}
            </p>
          ) : (
            <select id="issue-employee" className={inputClass} value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Choose an employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}{e.department ? ` — ${e.department}` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          id="issue-at"
          label="Handed out on"
          required
          error={errors.issued_at}
          hint="Defaults to now. Change it to record a handout after the fact.">
          <input id="issue-at" type="datetime-local" className={inputClass} value={issuedAt}
                 max={toLocalInput(new Date().toISOString())}
                 onChange={(e) => setIssuedAt(e.target.value)}
                 aria-describedby={errors.issued_at ? 'issue-at-error' : undefined} />
        </Field>

        {sameTypeHeld && (
          <div className="rounded-lg bg-warn-50 p-3 ring-1 ring-inset ring-amber-200">
            <p className="text-sm text-warn-700">
              <strong className="font-semibold">
                {chosenEmployee?.full_name} already holds a {chosenDevice?.type}
              </strong>{' '}
              — {sameTypeHeld.asset_tag} since {new Date(sameTypeHeld.issued_at).toLocaleDateString()}.
              That is fine during a swap or handover.
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm font-medium text-warn-700">
              <input type="checkbox" checked={confirmedSameType}
                     onChange={(e) => setConfirmedSameType(e.target.checked)}
                     className="rounded border-amber-300 text-brand-600 focus:ring-brand-600" />
              Issue it anyway
            </label>
          </div>
        )}

        {chosenDevice && (
          <>
            <ConditionPicker
              id="issue-condition"
              legend="Condition going out"
              value={condition}
              onChange={setCondition}
              error={errors.issued_condition}
            />
            <AccessoryPicker
              type={chosenDevice.type}
              legend="Handed over with it"
              value={accessories}
              onChange={setAccessories}
            />
          </>
        )}

        <Field id="issue-notes" label="Notes">
          <textarea id="issue-notes" rows={2} className={inputClass} value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional — charger included, replacement for ASP-0031…" />
        </Field>
      </form>
    </Modal>
  )
}
