import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import SearchInput from '../components/ui/SearchInput.jsx'
import DeviceTable from '../components/devices/DeviceTable.jsx'
import IssueDialog from '../components/handouts/IssueDialog.jsx'
import { useDeviceList } from '../hooks/useDevices.js'

const TYPE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'laptop', label: 'Laptops' },
  { value: 'mobile', label: 'Mobiles' },
]

const STATE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'issued', label: 'Issued' },
  { value: 'repair', label: 'Repair' },
  { value: 'retired', label: 'Retired' },
]

/**
 * The chips are a UI vocabulary; §6 is the API vocabulary. "Issued" is not a
 * status - it is the presence of an open assignment - so it maps to `held`.
 * "Available" means both free AND lifecycle-available, otherwise a device in
 * repair would show as available simply because nobody holds it.
 */
export function deviceQueryFor(type, state, q) {
  const params = {}
  if (type !== 'all') params.type = type
  if (state === 'issued') params.held = 'true'
  else if (state === 'available') { params.held = 'false'; params.status = 'available' }
  else if (state !== 'all') params.status = state
  if (q.trim()) params.q = q.trim()
  return params
}

export default function DevicesPage() {
  const navigate = useNavigate()
  const [type, setType] = useState('all')
  const [state, setState] = useState('all')
  const [q, setQ] = useState('')
  const [issuing, setIssuing] = useState(false)

  const { data: devices, isPending, error } = useDeviceList(deviceQueryFor(type, state, q))

  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Every laptop and mobile on the register."
        actions={
          <>
            <Button variant="secondary" onClick={() => setIssuing(true)}>Issue a device</Button>
            <Button onClick={() => navigate('/devices/new')}>Add device</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SearchInput value={q} onChange={setQ} placeholder="Asset tag, serial, or model…" />
        <FilterChips label="Type" options={TYPE_CHIPS} value={type} onChange={setType} />
        <FilterChips label="Status" options={STATE_CHIPS} value={state} onChange={setState} />
      </div>

      <DeviceTable devices={devices ?? []} isLoading={isPending} error={error} />

      <IssueDialog open={issuing} onClose={() => setIssuing(false)} />
    </>
  )
}
