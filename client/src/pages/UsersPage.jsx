import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import Icon from '../components/ui/Icon.jsx'
import EditUserDialog from '../components/users/EditUserDialog.jsx'
import { useUserList, useUpdateUser } from '../hooks/useUsers.js'
import { useSession } from '../hooks/useSession.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { messageFor } from '../lib/errors.js'
import { ROLE_LABELS } from '../lib/roles.js'

export default function UsersPage() {
  const navigate = useNavigate()
  const { data: users, isPending, error } = useUserList()
  const { profile } = useSession()
  const toggleDisabled = useUpdateUser()
  const { notify } = useToast()
  const [editing, setEditing] = useState(null)

  function handleToggle(user) {
    const disabling = !user.disabled_at
    toggleDisabled.mutate(
      { id: user.id, disabled: disabling },
      {
        onSuccess: () => notify(disabling ? `Deactivated ${user.full_name ?? user.email}.` : `Reactivated ${user.full_name ?? user.email}.`),
        onError: (err) => notify(messageFor(err), { tone: 'warning' }),
      },
    )
  }

  const columns = [
    {
      key: 'name', header: 'Name', sortValue: (u) => u.full_name ?? u.email,
      render: (u) => (
        <div>
          <p className="font-medium text-slate-900">{u.full_name ?? '—'}</p>
          {u.disabled_at && <StatusBadge status="disabled" />}
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortValue: (u) => u.email, render: (u) => u.email },
    { key: 'role', header: 'Role', sortValue: (u) => u.role, render: (u) => ROLE_LABELS[u.role] ?? u.role },
    {
      key: 'department', header: 'Department', sortValue: (u) => u.department_name ?? '',
      render: (u) => {
        if (u.department_name) return u.department_name
        if (u.role === 'admin') return '—'
        return <span className="font-medium text-warn-700">Not assigned</span>
      },
    },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (u) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(u)}>
            <Icon name="pencil" size={16} /> Edit
          </Button>
          {u.id !== profile?.id && (
            <Button
              variant="ghost"
              disabled={toggleDisabled.isPending}
              onClick={() => handleToggle(u)}
              className={u.disabled_at ? '' : 'text-bad-700 hover:bg-bad-50'}>
              {u.disabled_at ? 'Reactivate' : 'Deactivate'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone who has signed in or been registered."
        actions={<Button onClick={() => navigate('/users/register')}>Register user</Button>}
      />

      <DataTable
        columns={columns}
        rows={users ?? []}
        getRowKey={(u) => u.id}
        isLoading={isPending}
        error={error}
        emptyMessage="No accounts yet."
      />

      <EditUserDialog user={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
    </>
  )
}
