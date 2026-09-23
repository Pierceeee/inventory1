import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, setSession, clearSession } from '../lib/session.js'
import { signIn as signInRequest, getCurrentUser } from '../api/auth.js'
import { SIGNED_OUT_EVENT } from '../api/client.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setLocal] = useState(() => getSession())
  const queryClient = useQueryClient()

  // The api client ends the session when it can no longer be renewed.
  useEffect(() => {
    const onSignedOut = () => { setLocal(null); queryClient.clear() }
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [queryClient])

  // The role never comes from the login response, localStorage or the token -
  // only from here, so a demotion or deactivation is picked up on the next
  // fetch rather than baked into a stale session.
  const me = useQuery({
    queryKey: ['me', session?.user?.id],
    queryFn: () => getCurrentUser().then((r) => r.data),
    enabled: Boolean(session),
    staleTime: 60_000,
  })

  const signIn = useCallback(async (email, password) => {
    const { data } = await signInRequest(email, password)
    setSession(data)
    setLocal(data)
    queryClient.clear()
    return data
  }, [queryClient])

  const signOut = useCallback(() => {
    clearSession()
    setLocal(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile: me.data ?? null,
      role: me.data?.role ?? null,
      profileLoading: Boolean(session) && me.isPending,
      profileError: me.error,
      signIn,
      signOut,
    }),
    [session, me.data, me.isPending, me.error, signIn, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider')
  return ctx
}
