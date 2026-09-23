import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, resignEmployee,
} from '../api/employees.js'

export const employeeKeys = {
  all: ['employees'],
  list: (params) => ['employees', 'list', params ?? {}],
  detail: (id) => ['employees', 'detail', id],
}

export function useEmployeeList(params) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => listEmployees(params).then((r) => r.data),
  })
}

export function useEmployee(id) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => getEmployee(id).then((r) => r.data),
    enabled: Boolean(id),
  })
}

function useEmployeeMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCreateEmployee = () =>
  useEmployeeMutation((body) => createEmployee(body).then((r) => r.data))
export const useUpdateEmployee = () =>
  useEmployeeMutation(({ id, ...body }) => updateEmployee(id, body).then((r) => r.data))
export const useResignEmployee = () =>
  useEmployeeMutation((id) => resignEmployee(id).then((r) => r.data))
