import { useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Icon from '../components/ui/Icon.jsx'
import DepartmentDialog from '../components/departments/DepartmentDialog.jsx'
import { useDepartmentList } from '../hooks/useDepartments.js'

export default function DepartmentsPage() {
  const { data: departments, isPending, error } = useDepartmentList()
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)

  const columns = [
    { key: 'name', header: 'Name', sortValue: (d) => d.name, render: (d) => d.name },
    { key: 'users', header: 'Users', sortValue: (d) => d.user_count, render: (d) => d.user_count },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (d) => (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setEditing(d)}>
            <Icon name="pencil" size={16} /> Rename
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Who belongs to which department, and how many people are in it."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> Add Department
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={departments ?? []}
        getRowKey={(d) => d.id}
        isLoading={isPending}
        error={error}
        emptyMessage="No departments yet."
      />

      <DepartmentDialog department={null} open={adding} onClose={() => setAdding(false)} />
      <DepartmentDialog department={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
    </>
  )
}
