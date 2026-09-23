import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listDevices, getDevice, createDevice, updateDevice, retireDevice } from '../api/devices.js'

export const deviceKeys = {
  all: ['devices'],
  list: (params) => ['devices', 'list', params ?? {}],
  detail: (id) => ['devices', 'detail', id],
}

export function useDeviceList(params) {
  return useQuery({
    queryKey: deviceKeys.list(params),
    queryFn: () => listDevices(params).then((r) => r.data),
  })
}

export function useDevice(id) {
  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => getDevice(id).then((r) => r.data),
    enabled: Boolean(id),
  })
}

function useDeviceMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCreateDevice = () => useDeviceMutation((body) => createDevice(body).then((r) => r.data))
export const useUpdateDevice = () =>
  useDeviceMutation(({ id, ...body }) => updateDevice(id, body).then((r) => r.data))
export const useRetireDevice = () => useDeviceMutation((id) => retireDevice(id).then((r) => r.data))
