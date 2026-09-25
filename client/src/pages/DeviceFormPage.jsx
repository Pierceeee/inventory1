import { useNavigate, useParams } from 'react-router-dom'
import PageHeader, { BackLink } from '../components/layout/PageHeader.jsx'
import DeviceForm from '../components/devices/DeviceForm.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import { useDevice, useCreateDevice, useUpdateDevice } from '../hooks/useDevices.js'

export default function DeviceFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const { data: device, isPending: loading, error: loadError } = useDevice(id)
  const create = useCreateDevice()
  const update = useUpdateDevice()
  const mutation = isEdit ? update : create

  if (isEdit && loading) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  if (isEdit && loadError) return <ErrorBanner error={loadError} />

  const handleSubmit = (values) => {
    mutation.mutate(isEdit ? { id, ...values } : values, {
      onSuccess: (saved) => navigate(`/devices/${saved.id}`),
    })
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/devices">Devices</BackLink>}
        title={isEdit ? `Edit ${device.asset_tag}` : 'Add device'}
      />
      <DeviceForm
        device={device}
        isEdit={isEdit}
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
        error={mutation.error}
        onCancel={() => navigate(isEdit ? `/devices/${id}` : '/devices')}
      />
    </>
  )
}
