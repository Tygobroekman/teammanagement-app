import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './supabase'

type AuthState = {
  loading: boolean
  session: Session | null
  isCaptain: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isCaptain, setIsCaptain] = useState(false)
  const [loading, setLoading] = useState(isConfigured)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Controleer bij elke sessiewijziging of de gebruiker op de captains-whitelist staat.
  useEffect(() => {
    if (!isConfigured) return
    if (!session) {
      setIsCaptain(false)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase.rpc('is_captain').then(({ data }) => {
      setIsCaptain(data === true)
      setLoading(false)
    })
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ loading, session, isCaptain, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth buiten AuthProvider')
  return ctx
}
