import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [role,    setRole]    = useState(null)
  const [previewRole, setPreviewRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else { setProfile(null); setRole(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchRole(userId) {
    try {
      const { data } = await supabase.from('profiles').select('role, nom, prenom, email').eq('id', userId).single()
      setProfile(data ?? null)
      setRole(data?.role ?? null)
    } catch (e) {
      console.error('fetchRole error:', e)
    } finally {
      setLoading(false)
    }
  }

  const viewRole    = previewRole || role
  const isAdmin     = viewRole === 'admin'
  const isFinancier = ['admin', 'financier'].includes(viewRole)
  const isMdp       = ['admin', 'financier', 'mdp'].includes(viewRole)

  return (
    <AuthContext.Provider value={{ user, profile, role, previewRole, setPreviewRole, loading, isAdmin, isFinancier, isMdp, signIn: (e, p) => supabase.auth.signInWithPassword({ email: e, password: p }).then(({ error }) => error) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
