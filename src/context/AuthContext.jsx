import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { FEATURE_KEYS } from '../lib/permissions'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [profile,     setProfile]     = useState(null)
  const [role,        setRole]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [viewAsRole,  setViewAsRole]  = useState(null)
  const [permissions, setPermissions] = useState({})   // { feature: boolean }
  const channelRef = useRef(null)

  // ── Charger les permissions depuis la DB ──────────────────────────────────
  const fetchPermissions = useCallback(async (userId, userRole) => {
    if (!userId || !userRole) return

    // Admin = tout accordé sans requête DB (source de vérité absolue)
    if (userRole === 'admin') {
      const adminPerms = {}
      FEATURE_KEYS.forEach(k => { adminPerms[k] = true })
      setPermissions(adminPerms)
      return
    }

    const [{ data: rolePerms }, { data: userPerms }] = await Promise.all([
      supabase.from('role_permissions').select('feature, enabled').eq('role', userRole),
      supabase.from('user_permissions').select('feature, enabled').eq('user_id', userId),
    ])

    const perms = {}
    // 1. Droits du rôle
    ;(rolePerms || []).forEach(p => { perms[p.feature] = p.enabled })
    // 2. Overrides individuels (écrasent le rôle)
    ;(userPerms || []).forEach(p => { perms[p.feature] = p.enabled })

    setPermissions(perms)
  }, [])

  // ── Subscription realtime ─────────────────────────────────────────────────
  const setupRealtime = useCallback((userId, userRole) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (!userId || !userRole) return

    const ch = supabase
      .channel(`perms_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'role_permissions', filter: `role=eq.${userRole}` },
        () => fetchPermissions(userId, userRole)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_permissions', filter: `user_id=eq.${userId}` },
        () => fetchPermissions(userId, userRole)
      )
      .subscribe()

    channelRef.current = ch
  }, [fetchPermissions])

  // ── Charger profil + permissions ──────────────────────────────────────────
  async function fetchRole(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role, nom, prenom, email')
        .eq('id', userId)
        .single()
      setProfile(data ?? null)
      setRole(data?.role ?? null)
      await fetchPermissions(userId, data?.role)
      setupRealtime(userId, data?.role)
    } catch (e) {
      console.error('fetchRole error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else {
        setProfile(null); setRole(null); setPermissions({})
        setLoading(false)
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      }
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  // ── can(feature) : vérifie les droits ────────────────────────────────────
  // Utilise le rôle effectif (aperçu inclus)
  const effectiveRole = viewAsRole || role

  const can = useCallback((feature) => {
    // Admin = tout
    if (role === 'admin' && !viewAsRole) return true
    // En mode aperçu : simuler les permissions du rôle aperçu (sans override user)
    if (viewAsRole) {
      // Pour l'aperçu on ne dispose que des role_permissions chargées pour notre rôle réel.
      // On retourne false pour les features non accordées au rôle aperçu — la page d'aperçu
      // utilise effectiveRole pour les guards visuels ; can() est surtout utile hors aperçu.
      return false // aperçu = vue restrictive par défaut
    }
    return permissions[feature] ?? false
  }, [role, viewAsRole, permissions])

  // ── Backward compat ───────────────────────────────────────────────────────
  const isAdmin     = effectiveRole === 'admin'
  const isFinancier = ['admin', 'financier'].includes(effectiveRole)
  const isMdp       = ['admin', 'financier', 'mdp'].includes(effectiveRole)
  const isMdpOnly   = effectiveRole === 'mdp'

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading, permissions,
      isAdmin, isFinancier, isMdp, isMdpOnly,
      can,
      viewAsRole, setViewAsRole, effectiveRole,
      previewRole: viewAsRole, setPreviewRole: setViewAsRole,
      signIn: (e, p) => supabase.auth.signInWithPassword({ email: e, password: p }).then(({ error }) => error)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
