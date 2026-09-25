import { useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import DeleteSessionDialog from '../components/sessions/DeleteSessionDialog.jsx'
import { useSessionList, useDownloadSessionExport } from '../hooks/useInventorySessions.js'
import { formatDate } from '../lib/format.js'
import { messageFor } from '../lib/errors.js'

/**
 * Admin only (the sidebar link and the route are both gated; R1 keeps the
 * PAGE admin-only even though heads may read their own department's archived
 * sessions via the API). Every row is already read-only everywhere else -
 * this page only adds Export and Delete.
 */
export default function ArchivePage() {
  const { data: sessions, isPending, error } = useSessionList({ status: 'archived' })
  const download = useDownloadSessionExport()
  const { notify } = useToast()
  const [deleting, setDeleting] = useState(null)

  const columns = [
    { key: 'name', header: 'Name', render: (s) => s.name, sortValue: (s) => s.name.toLowerCase() },
    { key: 'department', header: 'Department', render: (s) => s.department_name },
    {
      key: 'completed', header: 'Completed', render: (s) => formatDate(s.completed_at),
      sortValue: (s) => s.completed_at,
    },
    { key: 'items', header: 'Items', render: (s) => `${s.scanned_count} of ${s.item_count} scanned` },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => download.mutate(s, {
              // The real reason (e.g. EXPORT_BUSY, a 403) rather than a flat
              // "Export failed." - and clicking Export again simply retries;
              // nothing here needs to be reset first (Group 5 review).
              onError: (error) => notify(messageFor(error), { tone: 'warning' }),
            })}
            disabled={download.isPending}>
            <Icon name="download" size={16} /> Export
          </Button>
          <button
            type="button"
            title={`Delete ${s.name}`}
            aria-label={`Delete ${s.name}`}
            onClick={() => setDeleting(s)}
            className="rounded p-2 text-slate-400 transition-colors hover:bg-bad-50 hover:text-bad-700">
            <Icon name="trash" size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Archive"
        subtitle="Sessions completed more than 7 days ago. Fully read-only."
      />

      <DataTable
        columns={columns}
        rows={sessions ?? []}
        getRowKey={(s) => s.id}
        isLoading={isPending}
        error={error}
        emptyMessage="Nothing archived yet. Sessions move here 7 days after they are completed."
      />

      <DeleteSessionDialog session={deleting} open={Boolean(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}
