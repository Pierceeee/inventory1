import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDepartment, listDepartments, updateDepartment } from '../api/departments.js'

const departmentKeys = { all: ['departments'] }

export function useDepartmentList({ enabled = true } = {}) {
  return useQuery({
    queryKey: departmentKeys.all,
    queryFn: () => listDepartments().then((r) => r.data),
    enabled,
  })
}

function useDepartmentMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.all }),
  })
}

export const useCreateDepartment = () => useDepartmentMutation((body) => createDepartment(body).then((r) => r.data))
export const useUpdateDepartment = () =>
  useDepartmentMutation(({ id, ...body }) => updateDepartment(id, body).then((r) => r.data))
