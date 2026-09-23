import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getSession, setSession, clearSession } from '../lib/session.js'
import { signIn as signInRequest } from '../api/auth.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setLocal] = useState(() => getSession())

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
