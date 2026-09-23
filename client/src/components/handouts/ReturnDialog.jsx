import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import { useReturnDevice } from '../../hooks/useAssignments.js'
import { toLocalInput, fromLocalInput, formatDateTime } from '../../lib/format.js'
import { fieldErrorsOf } from '../../lib/errors.js'
import { useToast } from '../ui/Toast.jsx'
import {
  ConditionPicker, AccessoryPicker, ConditionBadge, CONDITION_RANK, ACCESSORY_LABELS,
} from './ConditionFields.jsx'

const REASONS = [
  ['resignation', 'Resignation'],
  ['swap', 'Swap for another device'],
  ['repair', 'Sent for repair'],
  ['lost', 'Lost'],
  ['other', 'Other'],
]

export default function ReturnDialog({ open, onClose, assignment, onReturned }) {
  const ret = useReturnDevice()
  const { notify } = useToast()
  const [returnedAt, setReturnedAt] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [condition, setCondition] = useState('')
  const [accessories, setAccessories] = useState([])

  useEffect(() => {
    if (!open) return
    setReturnedAt(toLocalInput(new Date().toISOString()))
    setReason('')
    setNotes('')
    setCondition('')
    // Start from what went out: ticking is confirmation, unticking is the signal.
    setAccessories(assignment?.issued_accessories ?? [])
    ret.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!assignment) return null

  const errors = fieldErrorsOf(ret.error)
  const ready = Boolean(reason && returnedAt && condition)

  const issuedCondition = assignment.issued_condition ?? null
  const worse = issuedCondition && condition &&
    CONDITION_RANK[condition] > CONDITION_RANK[issuedCondition]
  const missing = (assignment.issued_accessories ?? []).filter((a) => !accessories.includes(a))

  function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    ret.mutate(
      {
        id: assignment.assignment_id ?? assignment.id,
        returned_at: fromLocalInput(returnedAt),
        return_reason: reason,
        returned_condition: condition,
        returned_accessories: accessories,
        notes: notes.trim() || null,
      },
      {
        onSuccess: (result) => {
          const problems = []
          if (worse) problems.push(`condition ${issuedCondition} → ${condition}`)
          if (missing.length) {
            problems.push(`${missing.map((a) => ACCESSORY_LABELS[a].toLowerCase()).join(' and ')} not returned`)
          }
          notify(
            `${result.asset_tag} returned.`,
            problems.length
              ? { tone: 'warning', detail: problems.join('; ') }
              : { tone: 'success', detail: 'Back on the shelf, nothing missing.' },
          )
          onReturned?.(result)
          onClose()
        },
      },
    )
  }

  const label = assignment.asset_tag ?? 'device'
  const holder = assignment.full_name ?? assignment.employee_name

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Return ${label}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!ready || ret.isPending}>
            {ret.isPending ? 'Returning…' : 'Return device'}
          </Button>
        </>
      }>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {!Object.keys(errors).length && <ErrorBanner error={ret.error} />}

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {holder ? <>Held by <strong className="text-slate-900">{holder}</strong> since </> : 'Issued '}
          {formatDateTime(assignment.issued_at)}.
        </p>

        <Field id="return-reason" label="Reason" required error={errors.return_reason}>
          <select id="return-reason" className={inputClass} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-describedby={errors.return_reason ? 'return-reason-error' : undefined}>
            <option value="">Choose a reason…</option>
            {REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>

        <ConditionPicker
          id="return-condition"
          legend="Condition coming back"
          value={condition}
          onChange={setCondition}
          error={errors.returned_condition}
        />

        {issuedCondition && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            Went out as <ConditionBadge condition={issuedCondition} />
            {worse && (
              <span className="font-medium text-warn-700">
                — coming back worse than it left. That is fine to record; it is the point.
              </span>
            )}
          </p>
        )}

        {assignment.type && (
          <AccessoryPicker
            type={assignment.type}
            legend="Coming back with it"
            value={accessories}
            onChange={setAccessories}
            expected={assignment.issued_accessories ?? []}
          />
        )}

        <Field id="return-at" label="Returned on" required error={errors.returned_at}>
          <input id="return-at" type="datetime-local" className={inputClass} value={returnedAt}
                 max={toLocalInput(new Date().toISOString())}
                 onChange={(e) => setReturnedAt(e.target.value)}
                 aria-describedby={errors.returned_at ? 'return-at-error' : undefined} />
        </Field>

        <Field id="return-notes" label="Notes">
          <textarea id="return-notes" rows={2} className={inputClass} value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional — condition, missing charger…" />
        </Field>
      </form>
    </Modal>
  )
}
