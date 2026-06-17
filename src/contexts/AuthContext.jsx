import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (profile !== null || !user) setLoading(false)
  }, [profile, user])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role ?? null
  const isAdmin     = role === 'admin'
  const isFinancier = role === 'financier' || role === 'admin'
  const isMdp       = role === 'mdp' || role === 'financier' || role === 'admin'
  const isStaff     = role !== 'responsable' && role !== null

  return (
    <AuthContext.Provider value={{ user, profile, loading, role, isAdmin, isFinancier, isMdp, isStaff, signIn, signUp, signOut, loadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
