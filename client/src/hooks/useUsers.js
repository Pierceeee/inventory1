import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listUsers, registerUser, updateUser } from '../api/users.js'

const userKeys = { all: ['users'] }

export function useUserList() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => listUsers().then((r) => r.data),
  })
}

function useUserMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      // A role/department change may be for the signed-in user themselves.
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

export const useRegisterUser = () => useUserMutation((body) => registerUser(body).then((r) => r.data))
export const useUpdateUser = () =>
  useUserMutation(({ id, ...body }) => updateUser(id, body).then((r) => r.data))
