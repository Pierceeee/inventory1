import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAssignments, issueDevice, returnDevice } from '../api/assignments.js'
import { deviceKeys } from './useDevices.js'
import { employeeKeys } from './useEmployees.js'

export const assignmentKeys = {
  all: ['assignments'],
  list: (params) => ['assignments', 'list', params ?? {}],
}

export function useAssignmentList(params) {
  return useQuery({
    queryKey: assignmentKeys.list(params),
    queryFn: () => listAssignments(params).then((r) => r.data),
  })
}

function useHandoutMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // A handout changes the device, the employee, the log, and the counts.
      qc.invalidateQueries({ queryKey: deviceKeys.all })
      qc.invalidateQueries({ queryKey: employeeKeys.all })
      qc.invalidateQueries({ queryKey: assignmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// Resolves to { data, warning } - the dialog reads the warning.
export const useIssueDevice = () => useHandoutMutation((body) => issueDevice(body))
export const useReturnDevice = () =>
  useHandoutMutation(({ id, ...body }) => returnDevice(id, body).then((r) => r.data))
