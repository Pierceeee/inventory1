import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChips from '../components/ui/FilterChips.jsx'
import SearchInput from '../components/ui/SearchInput.jsx'
import EmployeeTable from '../components/employees/EmployeeTable.jsx'
import { useEmployeeList } from '../hooks/useEmployees.js'

const STATUS_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'resigned', label: 'Resigned' },
]

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  const params = {}
  if (status !== 'all') params.status = status
  if (q.trim()) params.q = q.trim()

  const { data: employees, isPending, error } = useEmployeeList(params)

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Everyone who can be issued a device."
        actions={<Button onClick={() => navigate('/employees/new')}>Add employee</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SearchInput value={q} onChange={setQ} placeholder="Name, email, or department…" />
        <FilterChips label="Status" options={STATUS_CHIPS} value={status} onChange={setStatus} />
      </div>

      <EmployeeTable employees={employees ?? []} isLoading={isPending} error={error} />
    </>
  )
}
