import { useNavigate, useParams } from 'react-router-dom'
import PageHeader, { BackLink } from '../components/layout/PageHeader.jsx'
import EmployeeForm from '../components/employees/EmployeeForm.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { useEmployee, useCreateEmployee, useUpdateEmployee } from '../hooks/useEmployees.js'

export default function EmployeeFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const { data: employee, isPending: loading, error: loadError } = useEmployee(id)
  const create = useCreateEmployee()
  const update = useUpdateEmployee()
  const mutation = isEdit ? update : create

  if (isEdit && loading) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (isEdit && loadError) return <ErrorBanner error={loadError} />

  const handleSubmit = (values) => {
    mutation.mutate(isEdit ? { id, ...values } : values, {
      onSuccess: (saved) => navigate(`/employees/${saved.id}`),
    })
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/employees">Employees</BackLink>}
        title={isEdit ? `Edit ${employee.full_name}` : 'Add employee'}
      />
      <EmployeeForm
        employee={employee}
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
        error={mutation.error}
        onCancel={() => navigate(isEdit ? `/employees/${id}` : '/employees')}
      />
    </>
  )
}
