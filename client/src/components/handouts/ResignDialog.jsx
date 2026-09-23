import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import ReturnDialog from './ReturnDialog.jsx'
import { useResignEmployee } from '../../hooks/useEmployees.js'
import { useToast } from '../ui/Toast.jsx'
import { formatDateTime } from '../../lib/format.js'

/**
 * §5: resigning does not auto-close assignments. Every device still held is
 * listed here and has to be returned explicitly, so nothing quietly disappears
 * from the record at offboarding.
 */
export default function ResignDialog({ open, onClose, employee }) {
  const resign = useResignEmployee()
  const { notify } = useToast()
  const [returning, setReturning] = useState(null)

  if (!employee) return null
  const held = employee.devices_held ?? []
  const allReturned = held.length === 0

  return (
    <>
      <Modal
        open={open && !returning}
        onClose={onClose}
        wide
        title={`Mark ${employee.full_name} as resigned`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="danger"
              disabled={resign.isPending}
              onClick={() => resign.mutate(employee.id, {
                onSuccess: () => {
                  notify(`${employee.full_name} marked as resigned.`, held.length > 0
                    ? { tone: 'warning',
                        detail: `${held.length} ${held.length === 1 ? 'device is' : 'devices are'} still outstanding.` }
                    : { tone: 'success' })
                  onClose()
                },
              })}>
              {resign.isPending ? 'Saving…' : 'Mark resigned'}
            </Button>
          </>
        }>
        <div className="flex flex-col gap-4">
          <ErrorBanner error={resign.error} />

          {allReturned ? (
            <p className="rounded-lg bg-ok-50 px-3 py-3 text-sm text-ok-700">
              {employee.full_name} holds no devices. Nothing is outstanding.
            </p>
          ) : (
            <>
              <div className="rounded-lg bg-warn-50 px-3 py-3 text-sm text-warn-700 ring-1 ring-inset ring-amber-200">
                <strong className="font-semibold">
                  {held.length} {held.length === 1 ? 'device is' : 'devices are'} still out.
                </strong>{' '}
                Resigning does not return them. Return each one here so the record stays accurate.
              </div>

              <ul className="flex flex-col gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200">
                {held.map((d) => (
                  <li key={d.assignment_id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.asset_tag}</p>
                      <p className="text-xs text-slate-500">
                        {[d.brand, d.model].filter(Boolean).join(' ')} · since {formatDateTime(d.issued_at)}
                      </p>
                    </div>
                    <Button variant="secondary"
                            onClick={() => setReturning({ ...d, full_name: employee.full_name })}>
                      Return
                    </Button>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-slate-500">
                You can still mark them resigned with devices outstanding — the employee page will
                keep flagging what is missing.
              </p>
            </>
          )}
        </div>
      </Modal>

      <ReturnDialog
        open={Boolean(returning)}
        assignment={returning}
        onClose={() => setReturning(null)}
        onReturned={() => setReturning(null)}
      />
    </>
  )
}
