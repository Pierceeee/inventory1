import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSession, setSession, clearSession } from '../lib/session.js'
import { signIn as signInRequest } from '../api/auth.js'
import { SIGNED_OUT_EVENT } from '../api/client.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setLocal] = useState(() => getSession())

  // The api client ends the session when it can no longer be renewed.
  useEffect(() => {
    const onSignedOut = () => setLocal(null)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data } = await signInRequest(email, password)
    setSession(data)
    setLocal(data)
    return data
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setLocal(null)
  }, [])

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, signIn, signOut }),
    [session, signIn, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider')
  return ctx
}
