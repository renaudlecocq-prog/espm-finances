import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, UserPlus, Shield, Lock } from "lucide-react"
import PageHeader from "../components/ui/PageHeader"
import { useDemo } from "../context/DemoContext"
import { FEATURES, ROLES, ROLE_META, FEATURE_GROUPS } from '../lib/permissions'
import { useSettings } from '../contexts/SettingsContext'
import MasterFilter from '../components/ui/MasterFilter'

// ── Toggle de permission ──────────────────────────────────────────────────────
function PermToggle({ value, onChange, disabled, saving }) {
  return (
    <button type="button"
      onClick={() => !disabled && !saving && onChange(!value)}
      disabled={disabled || saving}
      title={disabled ? 'Admin dispose toujours de tous les droits' : undefined}
      style={{
        width: 40, height: 22, borderRadius: 11,
        backgroundColor: saving ? '#93C5FD' : disabled ? '#6B7280' : value ? '#059669' : '#D1D5DB',
        border: 'none', cursor: disabled || saving ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background-color 0.15s', flexShrink: 0,
      }}>
      <div style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

const fmtDate = d => d ? new Date(d).toLocaleString('fr-BE', {
  day:'2-digit', month:'2-digit', year:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit'
}).replace(',','') : '—'

export default function Admin() {
  const { user, isAdmin, isSuperAdmin, role: myRole, previewRole, setPreviewRole } = useAuth()
  const { demoMode, toggleDemo } = useDemo()
  const [searchParams] = useSearchParams()
  const [tab, setTab]             = useState(searchParams.get('onglet') || 'utilisateurs')
  const SECTION_TABS = {
    personnes: [
      { key: 'utilisateurs', label: 'Utilisateurs' },
      { key: 'droits',       label: 'Droits' },
      { key: 'photos',       label: 'Photos élèves' },
    ],
    ecole: [
      { key: 'synchronisation', label: 'Synchronisation' },
      { key: 'parametres',      label: 'Paramètres école' },
    ],
    modules: [
      { key: 'helpdesk', label: 'Helpdesk' },
      { key: 'natures',  label: 'Natures comptables' },
      { key: 'guidance', label: 'Conseils de guidance' },
    ],
  }
  const sectionOfTab = Object.entries(SECTION_TABS).find(([, tabs]) => tabs.some(t => t.key === tab))?.[0] || 'personnes'
  const setSection = (s) => { setTab(SECTION_TABS[s][0].key); setUserSearch('') }
  const [photosSearch, setPhotosSearch]   = useState('')
  const [photosFilters, setPhotosFilters] = useState({})
  const [photosClasses, setPhotosClasses] = useState([])
  const [users, setUsers]         = useState([])
  const [syncLogs, setSyncLogs]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('mdp')
  const [inviteMsg, setInviteMsg]     = useState('')
  const [roleFilter, setRoleFilter]   = useState(null)
  const [userSearch, setUserSearch]   = useState('')
  // ── État permissions ─────────────────────────────────────────────────────
  const [rolePermsData,   setRolePermsData]   = useState([])
  const [userOverrides,   setUserOverrides]   = useState([])
  const [droitsLoading,   setDroitsLoading]   = useState(false)
  const [permSaving,      setPermSaving]      = useState(null)
  const [overrideModal,   setOverrideModal]   = useState(false)
  const [overrideUser,    setOverrideUser]    = useState('')
  const [overrideFeature, setOverrideFeature] = useState('')
  const [overrideEnabled, setOverrideEnabled] = useState(true)
  const [protectModal, setProtectModal] = useState(null) // {type:'blocked'|'confirm', newRole, targetId, otherEmail}
  const [transferModal, setTransferModal] = useState(null) // {newRole, targetId, recipientId}

  // ── Gestion des droits ───────────────────────────────────────────────────
  const loadDroits = useCallback(async () => {
    setDroitsLoading(true)
    const [{ data: rp }, { data: up }] = await Promise.all([
      supabase.from('role_permissions').select('role, feature, enabled').order('role').order('feature'),
      supabase.from('user_permissions').select('user_id, feature, enabled, profiles!user_permissions_user_id_fkey(prenom, nom, role)')
        .order('updated_at', { ascending: false }),
    ])
    setRolePermsData(rp || [])
    setUserOverrides(up || [])
    setDroitsLoading(false)
  }, [])

  useEffect(() => { if (tab === 'droits') loadDroits() }, [tab, loadDroits])

  const toggleRolePerm = async (role, feature, newVal) => {
    const key = `${role}:${feature}`
    setPermSaving(key)
    await supabase.from('role_permissions')
      .upsert({ role, feature, enabled: newVal, updated_at: new Date().toISOString() }, { onConflict: 'role,feature' })
    setRolePermsData(prev => prev.map(p => p.role === role && p.feature === feature ? { ...p, enabled: newVal } : p))
    setPermSaving(null)
  }

  const addUserOverride = async () => {
    if (!overrideUser || !overrideFeature) return
    await supabase.from('user_permissions')
      .upsert({ user_id: overrideUser, feature: overrideFeature, enabled: overrideEnabled, updated_at: new Date().toISOString() },
               { onConflict: 'user_id,feature' })
    await loadDroits()
    setOverrideModal(false)
    setOverrideUser(''); setOverrideFeature('')
  }

  const removeUserOverride = async (userId, feature) => {
    await supabase.from('user_permissions').delete().eq('user_id', userId).eq('feature', feature)
    setUserOverrides(prev => prev.filter(o => !(o.user_id === userId && o.feature === feature)))
  }

  const getRolePerm = (role, feature) => {
    const row = rolePermsData.find(p => p.role === role && p.feature === feature)
    return row?.enabled ?? false
  }

  const loadUsers = useCallback(() =>
    supabase.from('profiles').select('*').then(({ data }) => setUsers((data || []).sort((a,b) => (a.nom||'').localeCompare(b.nom||'', 'fr') || (a.prenom||'').localeCompare(b.prenom||'', 'fr'))))
  , [])

  const loadSyncLogs = useCallback(() =>
    supabase.from('sync_log').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setSyncLogs(data || []))
  , [])

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([loadUsers(), loadSyncLogs()]).then(() => setLoading(false))
  }, [isAdmin, loadUsers, loadSyncLogs])

  const confirmUpdateRole = async () => {
    if (!protectModal) return
    await supabase.from('profiles').update({ role: protectModal.newRole }).eq('id', protectModal.targetId)
    await loadUsers()
    setProtectModal(null)
  }

  const confirmTransfer = async () => {
    if (!transferModal?.recipientId) return
    // Atomique : 1. promouvoir le destinataire en super_admin, 2. changer le rôle du super_admin actuel
    await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', transferModal.recipientId)
    await supabase.from('profiles').update({ role: transferModal.newRole }).eq('id', transferModal.targetId)
    await loadUsers()
    setTransferModal(null)
  }

  const updateRole = async (id, newRole) => {
    const targetUser = users.find(u => u.id === id)
    // Protections super_admin
    if (!isSuperAdmin) {
      if (targetUser?.role === 'super_admin') return // un admin normal ne peut pas toucher un super_admin
      if (newRole === 'super_admin') return // un admin normal ne peut pas promouvoir en super_admin
    }
    // Protection super_admin : transfert obligatoire avant auto-démote
    if (id === user?.id && myRole === 'super_admin' && newRole !== 'super_admin') {
      setTransferModal({ newRole, targetId: id, recipientId: '' })
      return
    }
    // Protection admin : empêcher de se retirer le dernier rang privilégié
    if (id === user?.id && myRole === 'admin' && !['admin', 'super_admin'].includes(newRole)) {
      const otherPrivileged = users.filter(u => ['admin', 'super_admin'].includes(u.role) && u.id !== id)
      if (otherPrivileged.length === 0) {
        setProtectModal({ type: 'blocked', newRole, targetId: id })
        return
      }
      setProtectModal({ type: 'confirm', newRole, targetId: id, otherEmail: otherPrivileged[0].email })
      return
    }
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    await loadUsers()
  }

  const doSync = async () => {
    setSyncing(true)
    try {
      await fetch('/.netlify/functions/smartschool-sync', { method: 'POST' })
    } catch (_) {}
    await loadSyncLogs()
    setSyncing(false)
  }

  const doInvite = async () => {
    setInviteMsg('')
    const res  = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const data = await res.json()
    if (res.ok) { setInviteMsg('✅ Invitation envoyée à ' + inviteEmail); setInviteEmail('') }
    else         setInviteMsg('❌ ' + (data.error || 'Erreur'))
  }

  if (!isAdmin) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Accès réservé aux administrateurs.</div>
  if (loading)  return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>

  const countByRole = r => users.filter(u => u.role === r).length

  return (
    <>
    <PageHeader
      title="Administration"
      subtitle="Gestion des utilisateurs et synchronisation Smartschool"
      tabs={[
        { key: 'personnes', label: 'Personnes & accès' },
        { key: 'ecole',     label: 'École' },
        { key: 'modules',   label: 'Modules' },
      ]}
      activeTab={sectionOfTab}
      onTabChange={setSection}
      search={tab === 'photos' ? photosSearch : tab === 'utilisateurs' ? userSearch : undefined}
      onSearch={tab === 'photos' ? setPhotosSearch : tab === 'utilisateurs' ? setUserSearch : undefined}
      searchPlaceholder={tab === 'photos' ? 'Rechercher un élève…' : 'Rechercher un utilisateur…'}
      actions={tab === 'utilisateurs' ? (
        <button onClick={() => setInviteModal(true)}
          className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3">
          <UserPlus size={15} /> + Inviter
        </button>
      ) : null}
      filters={tab === 'photos' && photosClasses.length > 0 ? (
        <MasterFilter
          filterDefs={[{ key: 'classe', label: 'Classe', options: photosClasses }]}
          filters={photosFilters}
          onChange={(key, val) => setPhotosFilters(prev => {
            const cur = Array.isArray(prev[key]) ? prev[key] : []
            const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
            return next.length === 0
              ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key))
              : { ...prev, [key]: next }
          })}
          onClearAll={() => setPhotosFilters({})}
          dark
        />
      ) : null}
    />
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── Sous-navigation ──────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-700 pb-0">
        {SECTION_TABS[sectionOfTab].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── UTILISATEURS ─────────────────────────────── */}
      {tab === 'utilisateurs' && (() => {
        const q = userSearch.toLowerCase().trim()
        const displayed = users.filter(u => {
          if (roleFilter && u.role !== roleFilter) return false
          if (!q) return true
          return (u.email || '').toLowerCase().includes(q)
            || (u.nom || '').toLowerCase().includes(q)
            || (u.prenom || '').toLowerCase().includes(q)
        })
        return (
        <div className="space-y-4">

          {/* Chips rôles — compacts */}
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => setRoleFilter(null)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                !roleFilter ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
              }`}>
              Tous <span className="ml-1 opacity-70">{users.length}</span>
            </button>
            {ROLES.map(r => {
              const m = ROLE_META[r]
              const n = countByRole(r)
              const active = roleFilter === r
              return (
                <button key={r} onClick={() => setRoleFilter(active ? null : r)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                    active ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${active ? 'bg-white dark:bg-gray-800' : m.dot}`} />
                  {m.label}
                  <span className={`${active ? 'opacity-70' : 'text-gray-400 dark:text-gray-500'}`}>{n}</span>
                </button>
              )
            })}
          </div>

          {/* Table dense */}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Rôle</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Dernière connexion</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Changer le rôle</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Aucun utilisateur</td></tr>
                ) : displayed.map(u => {
                  const m = ROLE_META[u.role] || ROLE_META.responsable
                  const nom = [u.prenom, u.nom].filter(Boolean).join(' ')
                  const initiales = [(u.prenom||'')[0], (u.nom||'')[0]].filter(Boolean).join('').toUpperCase() || '?'
                  return (
                    <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white`}
                            style={{background: m.avatarBg || '#6366f1'}}>
                            {initiales}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                              {nom || '—'}
                              {u.id === user?.id && <span className="ml-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-normal">(vous)</span>}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.color}`}>{m.label}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                        {u.last_connexion ? new Date(u.last_connexion).toLocaleString('fr-BE', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {(!isSuperAdmin && u.role === 'super_admin') ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">Non modifiable</span>
                        ) : (
                          <select className="input text-xs max-w-[140px] py-1"
                            value={u.role || ''} onChange={e => updateRole(u.id, e.target.value)}>
                            {ROLES
                              .filter(r => isSuperAdmin || r !== 'super_admin')
                              .map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {displayed.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50">
                {displayed.length} utilisateur{displayed.length > 1 ? 's' : ''}
                {(roleFilter || userSearch) ? ` sur ${users.length}` : ''}
              </div>
            )}
          </div>
        </div>
        )
      })()}

      {/* ── DROITS ───────────────────────────────────── */}
      {tab === 'droits' && (
        <div className="space-y-6">

          {/* Mode démo */}
          <div className={`card p-4 border ${demoMode ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎭</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Mode démo</span>
                  {demoMode && <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{background:'#E86C00'}}>ACTIF</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {demoMode
                    ? "Les données fictives (Billie Eilish, Taylor Swift…) remplacent la base réelle. Aucune donnée réelle n'est affectée."
                    : "Active des données fictives pour présenter la plateforme à des tiers sans exposer les données réelles."}
                </p>
              </div>
              <button onClick={toggleDemo} className="ml-4 shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={demoMode ? {background:'#E86C00',color:'white'} : {background:'#2D1B2E',color:'white'}}>
                {demoMode ? 'Quitter le mode démo' : 'Activer le mode démo'}
              </button>
            </div>
          </div>

          {/* Aperçu de rôle */}
          <div className="card p-4 bg-orange-50 dark:bg-orange-950 border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">Aperçu — Voir le site en tant que</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {['direction','mdp','responsable'].map(r => {
                const m = ROLE_META[r]
                return (
                  <button key={r} onClick={() => setPreviewRole(previewRole === r ? null : r)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                      ${previewRole === r ? m.color : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}>
                    {m.label}
                  </button>
                )
              })}
              {previewRole && (
                <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">
                  Mode aperçu actif — <button onClick={() => setPreviewRole(null)} className="underline">Quitter</button>
                </span>
              )}
            </div>
          </div>

          {/* Matrice interactive */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Shield size={16} /> Droits par rôle
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Modifiez les droits — les utilisateurs concernés voient le changement en temps réel.</p>
              </div>
              {droitsLoading && <RefreshCw size={14} className="animate-spin text-gray-400 dark:text-gray-500" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase" style={{minWidth:260}}>Fonctionnalité</th>
                    {ROLES.filter(r => r !== 'admin' && r !== 'super_admin').map(r => (
                      <th key={r} className="px-4 py-3 text-center" style={{minWidth:100}}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_META[r].color}`}>{ROLE_META[r].label}</span>
                          {r === 'admin' && <Lock size={10} className="text-gray-400 dark:text-gray-500" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_GROUPS.map(group => (
                    <>
                      <tr key={`grp-${group}`} className="bg-gray-50/70 border-y border-gray-100 dark:border-gray-700">
                        <td colSpan={ROLES.filter(r => r !== 'admin' && r !== 'super_admin').length + 1} className="px-5 py-2">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{group}</span>
                        </td>
                      </tr>
                      {FEATURES.filter(f => f.group === group).map(feat => (
                        <tr key={feat.key} className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-700 dark:text-gray-200 text-sm">{feat.label}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{feat.desc}</div>
                          </td>
                          {ROLES.filter(r => r !== 'admin' && r !== 'super_admin').map(r => {
                            const isLocked = r === 'admin'
                            const val = isLocked ? true : getRolePerm(r, feat.key)
                            const saving = permSaving === `${r}:${feat.key}`
                            return (
                              <td key={r} className="px-4 py-3 text-center">
                                <div className="flex justify-center">
                                  <PermToggle value={val} disabled={isLocked} saving={saving}
                                    onChange={nv => toggleRolePerm(r, feat.key, nv)} />
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <Lock size={11} /> La colonne Admin est verrouillée — un administrateur dispose toujours de tous les droits.
            </div>
          </div>

          {/* Exceptions individuelles */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <UserPlus size={16} /> Exceptions individuelles
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Accordez ou révoquez un droit pour une personne, indépendamment de son rôle.</p>
              </div>
              <button onClick={() => { setOverrideModal(true); setOverrideUser(''); setOverrideFeature(''); setOverrideEnabled(true) }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{backgroundColor:'#2D1B2E', color:'#fff'}}>
                <UserPlus size={14} /> Ajouter
              </button>
            </div>
            {userOverrides.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                Aucune exception — tous les utilisateurs suivent les droits de leur rôle.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    {['Utilisateur','Rôle','Fonctionnalité','Override',''].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userOverrides.map(ov => {
                    const feat = FEATURES.find(f => f.key === ov.feature)
                    const rm = ROLE_META[ov.profiles?.role] || ROLE_META.responsable
                    return (
                      <tr key={`${ov.user_id}-${ov.feature}`} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">{ov.profiles?.prenom} {ov.profiles?.nom}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rm.color}`}>{rm.label}</span></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{feat?.label ?? ov.feature}</td>
                        <td className="px-4 py-3">
                          {ov.enabled
                            ? <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">✓ Accordé</span>
                            : <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">✗ Révoqué</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeUserOverride(ov.user_id, ov.feature)}
                            className="text-gray-400 dark:text-gray-500 hover:text-red-500 text-xs font-medium transition-colors">
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal exception individuelle */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Ajouter une exception</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Utilisateur</label>
                <select value={overrideUser} onChange={e => setOverrideUser(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {users.filter(u => u.role !== 'admin').map(u => (
                    <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({ROLE_META[u.role]?.label ?? u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Fonctionnalité</label>
                <select value={overrideFeature} onChange={e => setOverrideFeature(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {FEATURE_GROUPS.map(g => (
                    <optgroup key={g} label={g}>
                      {FEATURES.filter(f => f.group === g).map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Type</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setOverrideEnabled(true)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors"
                    style={{borderColor: overrideEnabled ? '#059669' : '#E5E7EB', backgroundColor: overrideEnabled ? '#D1FAE5' : '#fff', color: overrideEnabled ? '#065F46' : '#6B7280'}}>
                    ✓ Accorder
                  </button>
                  <button type="button" onClick={() => setOverrideEnabled(false)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors"
                    style={{borderColor: !overrideEnabled ? '#DC2626' : '#E5E7EB', backgroundColor: !overrideEnabled ? '#FEE2E2' : '#fff', color: !overrideEnabled ? '#991B1B' : '#6B7280'}}>
                    ✗ Révoquer
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {overrideEnabled
                    ? "Accès accordé même si son rôle ne l'y autorise pas."
                    : "Accès révoqué même si son rôle l'y autorise."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOverrideModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={addUserOverride} disabled={!overrideUser || !overrideFeature}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{backgroundColor:'#2D1B2E', opacity:(!overrideUser||!overrideFeature)?0.5:1}}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ── SYNCHRONISATION ──────────────────────────── */}
      {tab === 'synchronisation' && (
        <div className="space-y-6">

          {/* Sync card */}
          <div className="card p-5 flex items-start justify-between gap-4">
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                S
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Synchronisation Smartschool</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
                  Importe tous les élèves et membres du personnel depuis Smartschool via l'API Web Services V3.<br />
                  Les comptes existants sont mis à jour ; les nouveaux sont créés automatiquement.
                </p>
              </div>
            </div>
            <button onClick={doSync} disabled={syncing}
              className="btn-primary flex items-center gap-2 text-sm py-2 px-4 shrink-0 disabled:opacity-60">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </button>
          </div>

          {/* Sync history */}
          <div className="card p-0">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">
                Historique des synchronisations
              </h2>
              <button onClick={loadSyncLogs}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-primary flex items-center gap-1">
                <RefreshCw size={12} /> Rafraîchir
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Date','Statut','Élèves','Personnel','Message'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Aucune synchronisation enregistrée</td></tr>
                ) : syncLogs.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
                    <td className="px-4 py-2">
                      {(l.status === 'success' || l.success)
                        ? <span className="text-green-500 dark:text-green-400 text-base font-bold">✓</span>
                        : <span className="text-red-500 dark:text-red-400 text-base font-bold">✗</span>}
                    </td>
                    <td className="px-4 py-2 font-medium">{l.eleves_upserted ?? l.nb_eleves ?? 0}</td>
                    <td className="px-4 py-2 font-medium">{l.personnel_upserted ?? l.nb_personnel ?? 0}</td>
                    <td className="px-4 py-2 text-gray-400 dark:text-gray-500 text-xs max-w-xs truncate">{l.details ?? l.message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL INVITATION ─────────────────────────── */}
      {/* ── MODAL PROTECTION ADMIN ─────────────────── */}
      {protectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            {protectModal.type === 'blocked' ? (
              <>
                <div className="text-3xl mb-3 text-center">🔒</div>
                <h3 className="font-bold text-red-600 dark:text-red-400 mb-2 text-center">Action impossible</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
                  Vous êtes le seul administrateur. Vous ne pouvez pas retirer votre propre rôle Admin tant qu'aucun autre admin n'existe.
                </p>
                <button onClick={() => setProtectModal(null)} className="btn-primary w-full py-2">Compris</button>
              </>
            ) : (
              <>
                <div className="text-3xl mb-3 text-center">⚠️</div>
                <h3 className="font-bold text-orange-600 dark:text-orange-400 mb-2 text-center">Confirmer le changement</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1 text-center">
                  Vous allez retirer votre propre rôle <strong>Admin</strong>.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4">
                  Un autre admin existe ({protectModal.otherEmail}) — l'accès admin sera préservé.
                </p>
                <div className="flex gap-2">
                  <button onClick={confirmUpdateRole} className="btn-primary flex-1 py-2 bg-red-500 hover:bg-red-600">
                    Confirmer
                  </button>
                  <button onClick={() => setProtectModal(null)} className="btn-secondary flex-1 py-2">
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL TRANSFERT SUPER ADMIN ─────────────── */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-3xl mb-3 text-center">👑</div>
            <h3 className="font-bold text-purple-700 dark:text-purple-300 mb-2 text-center">Transférer le grade Super Admin</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1 text-center">
              Le grade <strong>Super Admin</strong> doit toujours être attribué à quelqu'un.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center">
              Choisissez à qui le transférer avant de changer votre propre rôle.
            </p>
            <div className="mb-4">
              <label className="label mb-1">Nouveau Super Admin</label>
              <select className="input" value={transferModal.recipientId}
                onChange={e => setTransferModal(m => ({ ...m, recipientId: e.target.value }))}>
                <option value="">— Sélectionner un utilisateur —</option>
                {users.filter(u => u.id !== user?.id).map(u => (
                  <option key={u.id} value={u.id}>
                    {[u.prenom, u.nom].filter(Boolean).join(' ')} ({ROLE_META[u.role]?.label ?? u.role})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4">
              Votre rôle deviendra : <strong>{ROLE_META[transferModal.newRole]?.label ?? transferModal.newRole}</strong>
            </p>
            <div className="flex gap-2">
              <button onClick={confirmTransfer} disabled={!transferModal.recipientId}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{background:'#7c3aed'}}>
                Transférer et changer
              </button>
              <button onClick={() => setTransferModal(null)} className="btn-secondary flex-1 py-2">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-primary mb-4 text-lg">Inviter un utilisateur</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Adresse e-mail</label>
                <input className="input" type="email" value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)} placeholder="nom@exemple.be" />
              </div>
              <div>
                <label className="label">Rôle</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {ROLES.filter(r => r !== 'admin' && r !== 'super_admin').map(r => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
              </div>
              {inviteMsg && (
                <p className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith('✅') ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                  {inviteMsg}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={doInvite} disabled={!inviteEmail}
                  className="btn-primary flex-1 py-2 flex justify-center disabled:opacity-50">
                  Envoyer l'invitation
                </button>
                <button onClick={() => { setInviteModal(false); setInviteMsg(''); setInviteEmail('') }}
                  className="btn-secondary flex-1 py-2 flex justify-center">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HELPDESK ─────────────────────────────────── */}
      {tab === 'helpdesk' && <HelpdeskAdmin />}

      {/* ── NATURES COMPTABLES ───────────────────────── */}
      {tab === 'natures' && <NaturesAdmin />}

      {/* ── PHOTOS ÉLÈVES ────────────────────────────── */}
      {tab === 'photos' && <PhotosAdmin search={photosSearch} filters={photosFilters} onClassesReady={setPhotosClasses} />}

      {/* ── PARAMÈTRES ÉCOLE ─────────────────────────── */}
      {tab === 'parametres' && <ParametresEcole />}

      {/* ── CONSEILS DE GUIDANCE ─────────────────────── */}
      {tab === 'guidance' && <GuidanceAdmin />}
    </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════
//  Helpdesk Admin — composant inline
// ══════════════════════════════════════════════════════════
export function HelpdeskAdmin() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [editCat, setEditCat]       = useState(null) // null | 'new' | {category object}
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [purgeInfo, setPurgeInfo]   = useState(null)

  const loadCats = async () => {
    setLoading(true)
    const { data } = await supabase.from('helpdesk_categories').select('*').order('ordre')
    setCategories(data || [])
    setLoading(false)
  }
  useEffect(() => { loadCats() }, [])

  const saveCat = async (cat) => {
    setSaving(true); setError('')
    try {
      if (cat.id) {
        const { error: e } = await supabase.from('helpdesk_categories').update(cat).eq('id', cat.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('helpdesk_categories')
          .insert({ ...cat, ordre: categories.length + 1 })
        if (e) throw e
      }
      setEditCat(null); await loadCats()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const toggleActif = async (cat) => {
    await supabase.from('helpdesk_categories').update({ actif: !cat.actif }).eq('id', cat.id)
    await loadCats()
  }

  const getPurgeStats = async () => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6)
    const { data } = await supabase.from('helpdesk_tickets')
      .select('id').eq('statut', 'ferme').lt('closed_at', cutoff.toISOString())
    setPurgeInfo({ count: data?.length || 0, cutoff: cutoff.toLocaleDateString('fr-BE') })
  }

  const executePurge = async () => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6)
    const { data: tickets } = await supabase.from('helpdesk_tickets')
      .select('id').eq('statut', 'ferme').lt('closed_at', cutoff.toISOString())
    if (!tickets?.length) { setPurgeInfo({ done: true, count: 0 }); return }
    const ticketIds = tickets.map(t => t.id)
    // Récupérer tous les attachments
    const { data: msgs } = await supabase.from('helpdesk_messages')
      .select('attachments').in('ticket_id', ticketIds)
    const allPaths = (msgs || []).flatMap(m =>
      (m.attachments || []).map(a => {
        const url = a.url || ''; const idx = url.indexOf('helpdesk-attachments/')
        return idx >= 0 ? url.slice(idx + 'helpdesk-attachments/'.length) : null
      }).filter(Boolean)
    )
    if (allPaths.length) {
      await supabase.storage.from('helpdesk-attachments').remove(allPaths)
    }
    setPurgeInfo({ done: true, count: tickets.length })
  }

  const label_style = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }
  const input_style = { width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
    border: '1.5px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '24px 0' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Catégories</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Gérez les catégories de tickets et leurs formulaires</div>
        </div>
        <button onClick={() => setEditCat({ nom:'', description:'', icone:'ticket', couleur:'#6B4A73',
          form_fields:[], rapporteur_roles:['admin','direction','mdp'], agent_roles:['admin'] })}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#2D1B2E',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + Nouvelle catégorie
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 14,
              backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px',
              opacity: cat.actif ? 1 : 0.5 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: cat.couleur + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>
                  {{'package':'📦','calendar':'📅','building':'🏗️','monitor':'💻','ticket':'🎫'}[cat.icone] || '🎫'}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{cat.nom}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {(cat.form_fields || []).length} champ{(cat.form_fields || []).length !== 1 ? 's' : ''} dans le formulaire
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditCat(cat)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #E5E7EB',
                    background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  Modifier
                </button>
                <button onClick={() => toggleActif(cat)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #E5E7EB',
                    background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
                  {cat.actif ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section purge */}
      <div style={{ marginTop: 32, padding: '20px', backgroundColor: '#FFF7ED',
        border: '1px solid #FED7AA', borderRadius: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 6 }}>
          🗑️ Purge des pièces jointes
        </div>
        <div style={{ fontSize: 13, color: '#78350F', marginBottom: 14, lineHeight: 1.5 }}>
          Supprime les fichiers attachés aux tickets fermés depuis plus de 6 mois.
          Les messages et l'historique sont conservés.
        </div>
        {!purgeInfo ? (
          <button onClick={getPurgeStats}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #D97706',
              background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#D97706' }}>
            Analyser
          </button>
        ) : purgeInfo.done ? (
          <div style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>
            ✅ Purge terminée — {purgeInfo.count} ticket(s) traité(s)
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#92400E' }}>
              {purgeInfo.count} ticket(s) fermé(s) avant le {purgeInfo.cutoff}
            </span>
            <button onClick={executePurge} disabled={purgeInfo.count === 0}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none',
                backgroundColor: purgeInfo.count === 0 ? '#E5E7EB' : '#D97706',
                cursor: purgeInfo.count === 0 ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 600, color: '#fff' }}>
              Purger {purgeInfo.count} ticket(s)
            </button>
          </div>
        )}
      </div>

      {/* Modal édition catégorie */}
      {editCat && (
        <CategoryModal cat={editCat} onClose={() => setEditCat(null)}
          onSave={saveCat} saving={saving} error={error} />
      )}
    </div>
  )
}

// ── Modal édition/création catégorie ─────────────────────────────────────────
function CategoryModal({ cat, onClose, onSave, saving, error }) {
  const [form, setForm] = useState({ ...cat })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const addField = () => set('form_fields', [...(form.form_fields || []), {
    id: `field_${Date.now()}`, type: 'text_short', label: '', required: false, options: []
  }])

  const updateField = (idx, k, v) => {
    const flds = [...(form.form_fields || [])]
    flds[idx] = { ...flds[idx], [k]: v }
    set('form_fields', flds)
  }

  const removeField = (idx) => set('form_fields', form.form_fields.filter((_, i) => i !== idx))

  const moveField = (idx, dir) => {
    const flds = [...(form.form_fields || [])]
    const swp = idx + dir
    if (swp < 0 || swp >= flds.length) return;
    [flds[idx], flds[swp]] = [flds[swp], flds[idx]]
    set('form_fields', flds)
  }

  const inp = { width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12,
    border: '1.5px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 640,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>
            {cat.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#6B7280' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
            borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {/* Infos de base */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Nom *
              </label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} style={inp}
                placeholder="ex: Problème bâtiment" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Couleur
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.couleur} onChange={e => set('couleur', e.target.value)}
                  style={{ width: 40, height: 36, borderRadius: 6, border: '1.5px solid #e5e7eb',
                    padding: 2, cursor: 'pointer' }} />
                <input value={form.couleur} onChange={e => set('couleur', e.target.value)}
                  style={{ ...inp, width: 'auto', flex: 1 }} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <input value={form.description || ''} onChange={e => set('description', e.target.value)}
              style={inp} placeholder="Courte description de la catégorie" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Icône
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['ticket','🎫'],['building','🏗️'],['monitor','💻'],['package','📦'],['calendar','📅']].map(([k,e]) => (
                <button key={k} type="button" onClick={() => set('icone', k)}
                  style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 18,
                    border: form.icone === k ? `2px solid ${form.couleur}` : '2px solid #E5E7EB',
                    backgroundColor: form.icone === k ? form.couleur + '15' : '#fff' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Form builder */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                Champs du formulaire
              </div>
              <button onClick={addField}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none',
                  backgroundColor: '#2D1B2E', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                + Ajouter un champ
              </button>
            </div>
            {(form.form_fields || []).length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '20px 0' }}>
                Aucun champ. Le formulaire contiendra seulement un titre et une priorité.
              </div>
            )}
            {(form.form_fields || []).map((fld, idx) => (
              <div key={fld.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8,
                padding: 14, marginBottom: 10, backgroundColor: '#FAFAFA' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                  <input value={fld.label} onChange={e => updateField(idx, 'label', e.target.value)}
                    placeholder="Libellé du champ" style={{ ...inp, flex: 1 }} />
                  <select value={fld.type} onChange={e => updateField(idx, 'type', e.target.value)}
                    style={{ ...inp, width: 'auto' }}>
                    <option value="text_short">Texte court</option>
                    <option value="text_long">Texte long</option>
                    <option value="select_single">Choix unique</option>
                    <option value="select_multiple">Choix multiple</option>
                    <option value="number">Nombre</option>
                    <option value="date">Date</option>
                  </select>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                    whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input type="checkbox" checked={fld.required}
                      onChange={e => updateField(idx, 'required', e.target.checked)} />
                    Requis
                  </label>
                </div>
                {(fld.type === 'select_single' || fld.type === 'select_multiple') && (
                  <div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                      Options (une par ligne)
                    </div>
                    <textarea value={(fld.options || []).join('\n')}
                      onChange={e => updateField(idx, 'options', e.target.value.split('\n').filter(Boolean))}
                      rows={4} placeholder="Option 1&#10;Option 2&#10;Option 3"
                      style={{ ...inp, resize: 'vertical' }} />
                  </div>
                )}
                {(fld.type === 'text_short' || fld.type === 'text_long' || fld.type === 'number') && (
                  <input value={fld.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)}
                    placeholder="Texte d'aide (optionnel)" style={inp} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => moveField(idx, -1)} disabled={idx === 0}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB',
                        background: '#fff', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 12,
                        color: idx === 0 ? '#D1D5DB' : '#374151' }}>↑</button>
                    <button onClick={() => moveField(idx, 1)} disabled={idx === (form.form_fields || []).length - 1}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB',
                        background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' }}>↓</button>
                  </div>
                  <button onClick={() => removeField(idx)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5',
                      background: '#FFF', cursor: 'pointer', fontSize: 12, color: '#DC2626' }}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8,
            border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: '#374151' }}>Annuler</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.nom}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
              backgroundColor: saving || !form.nom ? '#9CA3AF' : '#2D1B2E',
              color: '#fff', cursor: saving || !form.nom ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Natures Comptables Admin
// ══════════════════════════════════════════════════════════
export function NaturesAdmin() {
  const [natures, setNatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null) // null | 'new' | nature object
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('Toutes')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('comptable_natures').select('*').order('position')
    if (data) setNatures(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = ['Toutes', ...new Set(natures.map(n => n.categorie))]

  const filtered = filterCat === 'Toutes'
    ? natures
    : natures.filter(n => n.categorie === filterCat)

  const toggleActif = async (n) => {
    await supabase.from('comptable_natures').update({ actif: !n.actif }).eq('id', n.id)
    setNatures(prev => prev.map(x => x.id === n.id ? { ...x, actif: !n.actif } : x))
  }

  const saveNature = async (form) => {
    setSaving(true)
    const payload = {
      libelle: form.libelle,
      categorie: form.categorie,
      sous_categorie: form.sous_categorie,
      type_flux: form.type_flux,
      in_bilan: form.in_bilan,
      in_couverture: form.in_couverture ?? false,
      actif: form.actif,
    }
    if (form.id) {
      await supabase.from('comptable_natures').update(payload).eq('id', form.id)
    } else {
      const maxPos = natures.length ? Math.max(...natures.map(n => n.position)) + 1 : 0
      await supabase.from('comptable_natures').insert({ ...payload, position: maxPos })
    }
    setSaving(false)
    setEditItem(null)
    load()
  }

  const deleteNature = async (id) => {
    if (!confirm('Supprimer cette nature comptable ?')) return
    await supabase.from('comptable_natures').delete().eq('id', id)
    setNatures(prev => prev.filter(n => n.id !== id))
  }

  const TYPE_COLORS = {
    produit: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    charge:  'bg-red-100 text-red-600 dark:text-red-400',
    neutre:  'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Natures comptables</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{natures.length} natures · {natures.filter(n => !n.actif).length} désactivées</p>
        </div>
        <button
          onClick={() => setEditItem({ libelle: '', categorie: '', sous_categorie: '', type_flux: 'charge', in_bilan: true, in_couverture: false, actif: true })}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Nouvelle nature
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button key={cat}
            onClick={() => setFilterCat(cat)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterCat === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {cat}
            {cat !== 'Toutes' && (
              <span className="ml-1.5 opacity-60">{natures.filter(n => n.categorie === cat).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">Chargement…</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Libellé</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Type</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Bilan</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Actif</th>
                <th className="w-20 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(n => (
                <tr key={n.id} className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 ${!n.actif ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-700 dark:text-gray-200">{n.libelle}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{n.categorie} › {n.sous_categorie}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[n.type_flux]}`}>
                      {n.type_flux === 'produit' ? 'Produit' : n.type_flux === 'charge' ? 'Charge' : 'Neutre'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {n.in_bilan
                      ? <span className="text-green-500 dark:text-green-400 text-xs">✓</span>
                      : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => toggleActif(n)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors
                        ${n.actif ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-gray-800 shadow transform transition-transform mt-0.5
                        ${n.actif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setEditItem({ ...n })}
                        className="p-1.5 hover:bg-indigo-50 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 transition-colors"
                        title="Modifier">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteNature(n.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
                        title="Supprimer">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                    Aucune nature dans cette catégorie
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <NatureModal
          item={editItem}
          categories={categories.filter(c => c !== 'Toutes')}
          saving={saving}
          onSave={saveNature}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  )
}

function NatureModal({ item, categories, saving, onSave, onClose }) {
  const [form, setForm] = useState({ ...item })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{item.id ? 'Modifier' : 'Nouvelle'} nature comptable</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Catégorie</label>
            <input
              value={form.categorie}
              onChange={e => set('categorie', e.target.value)}
              list="cat-list"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              placeholder="ex: Frais pédagogiques"
            />
            <datalist id="cat-list">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Sous-catégorie</label>
            <input
              value={form.sous_categorie}
              onChange={e => {
                const sc = e.target.value
                set('sous_categorie', sc)
                if (form.categorie) set('libelle', `${form.categorie} - ${sc}`)
              }}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              placeholder="ex: Anglais"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Libellé complet</label>
            <input
              value={form.libelle}
              onChange={e => set('libelle', e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type de flux</label>
              <select
                value={form.type_flux}
                onChange={e => set('type_flux', e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              >
                <option value="charge">Charge (sortie)</option>
                <option value="produit">Produit (entrée)</option>
                <option value="neutre">Neutre (transfert)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                <input type="checkbox" checked={form.in_bilan} onChange={e => set('in_bilan', e.target.checked)}
                  className="rounded" />
                Inclus au bilan
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                <input type="checkbox" checked={form.actif} onChange={e => set('actif', e.target.checked)}
                  className="rounded" />
                Actif
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer" title="Cette charge est compensée par les encaissements élèves (Extramuros, Voyages, Frais péda…)">
                <input type="checkbox" checked={form.in_couverture ?? false} onChange={e => set('in_couverture', e.target.checked)}
                  className="rounded accent-indigo-500" />
                <span>Couverture élèves</span>
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.libelle || !form.categorie || saving}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : (item.id ? 'Enregistrer' : 'Créer')}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════
//  CropModal — recadrage circulaire d'une photo
// ══════════════════════════════════════════════════════════
function CropModal({ eleve, onClose, onSaved }) {
  const DISPLAY = 260
  const OUTPUT  = 300
  const [offset, setOffset]   = useState({ x: 0, y: 0 })
  const [zoom, setZoom]       = useState(1)
  const [natSize, setNatSize] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [cropError, setCropError] = useState(null)
  const dragRef = useRef(null)

  const minZoom = natSize ? Math.max(DISPLAY / natSize.w, DISPLAY / natSize.h) : 1

  const handleLoad = (e) => {
    const w = e.target.naturalWidth, h = e.target.naturalHeight
    setNatSize({ w, h })
    setZoom(Math.max(DISPLAY / w, DISPLAY / h))
    setOffset({ x: 0, y: 0 })
  }

  const onMouseDown = (e) => {
    dragRef.current = { sx: e.clientX - offset.x, sy: e.clientY - offset.y }
    e.preventDefault()
  }
  const onMouseMove = (e) => {
    if (!dragRef.current) return
    setOffset({ x: e.clientX - dragRef.current.sx, y: e.clientY - dragRef.current.sy })
  }
  const stopDrag = () => { dragRef.current = null }

  const handleSave = async () => {
    if (!natSize) return
    setSaving(true); setCropError(null)
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const baseUrl = eleve.photo_url.split('?')[0]
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = baseUrl + '?t=' + Date.now() })

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT; canvas.height = OUTPUT
      const ctx = canvas.getContext('2d')
      const s = OUTPUT / DISPLAY
      const scaledW = natSize.w * zoom * s
      const scaledH = natSize.h * zoom * s
      const dx = (OUTPUT - scaledW) / 2 + offset.x * s
      const dy = (OUTPUT - scaledH) / 2 + offset.y * s
      ctx.drawImage(img, dx, dy, scaledW, scaledH)

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.88))
      const path = `${eleve.id}.jpg`
      await supabase.storage.from('eleve-photos').remove([path])
      const { error: upErr } = await supabase.storage.from('eleve-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('eleve-photos').getPublicUrl(path)
      const urlWithTs = `${publicUrl}?t=${Date.now()}`
      await supabase.from('eleves').update({ photo_url: urlWithTs }).eq('id', eleve.id)
      onSaved(eleve.id, urlWithTs)
      onClose()
    } catch (e) {
      setCropError(e.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-[360px]" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-0.5">{eleve.prenom} {eleve.nom}</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Glisse pour recadrer · Curseur pour zoomer</p>

        <div className="flex justify-center mb-4">
          <div
            className="relative cursor-grab active:cursor-grabbing select-none"
            style={{ width: DISPLAY, height: DISPLAY, borderRadius: '50%', overflow: 'hidden', border: '2px solid #818CF8', background: '#f3f4f6' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <img
              src={eleve.photo_url}
              alt=""
              onLoad={handleLoad}
              draggable={false}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none', userSelect: 'none', pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-gray-400 dark:text-gray-500">−</span>
          <input
            type="range" min={minZoom} max={minZoom * 3} step={0.01} value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
        </div>

        {cropError && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{cropError}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════
//  PhotosGrid — grille tous élèves (avec ou sans photo)
// ══════════════════════════════════════════════════════════
function PhotosGrid({ eleves, search, filters, onCrop, onUploadFor }) {
  const [photoFilter, setPhotoFilter] = useState('tous') // 'tous' | 'avec' | 'sans'
  const uploadRef = useRef(null)
  const [uploadTarget, setUploadTarget] = useState(null)

  const filtered = useMemo(() => {
    let d = eleves
    if (search?.trim()) d = d.filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase()))
    if (filters?.classe?.length) d = d.filter(e => filters.classe.includes(e.classe))
    if (photoFilter === 'avec') d = d.filter(e => e.photo_url)
    if (photoFilter === 'sans') d = d.filter(e => !e.photo_url)
    return d
  }, [eleves, search, filters, photoFilter])

  const nbAvec = useMemo(() => eleves.filter(e => e.photo_url).length, [eleves])

  const handleClickSansPhoto = (e) => {
    setUploadTarget(e)
    uploadRef.current?.click()
  }

  const handleFileChange = (ev) => {
    if (!uploadTarget || !ev.target.files?.length) return
    onUploadFor(uploadTarget, ev.target.files[0])
    ev.target.value = ''
    setUploadTarget(null)
  }

  const initials = (e) => `${(e.prenom||'')[0]||''}${(e.nom||'')[0]||''}`.toUpperCase()

  if (!eleves.length) return null

  return (
    <div className="mt-8">
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {/* Header compteur + filtre local */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm shrink-0">
          {nbAvec} / {eleves.length} élèves avec photo
          {filtered.length < eleves.length && ` — ${filtered.length} affichés`}
        </h4>
        <div className="flex gap-1">
          {[['tous','Tous'],['avec','Avec photo'],['sans','Sans photo']].map(([val,label]) => (
            <button key={val} onClick={() => setPhotoFilter(val)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                photoFilter === val
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {filtered.map(e => (
          <div key={e.id}
            className="flex flex-col items-center gap-1 group cursor-pointer"
            onClick={() => e.photo_url ? onCrop(e) : handleClickSansPhoto(e)}>
            <div className="relative">
              {e.photo_url ? (
                <>
                  <img src={e.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0H3m4 0l-4 4M17 8v12m0 0h4m-4 0l4-4" />
                    </svg>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-500 flex items-center justify-center">
                    <span className="text-gray-400 dark:text-gray-500 font-semibold text-lg">{initials(e)}</span>
                  </div>
                  <div className="absolute inset-0 rounded-full bg-indigo-500/10 border-2 border-indigo-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <svg className="w-6 h-6 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </>
              )}
            </div>
            <span className={`text-xs text-center leading-tight ${e.photo_url ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {e.prenom}<br/>{e.nom}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Photos Admin — import en masse
// ══════════════════════════════════════════════════════════
function PhotosAdmin({ search, filters, onClassesReady }) {
  const [eleves, setEleves]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [dragging, setDragging]   = useState(false)
  const [results, setResults]     = useState(null)   // { ok: [], ko: [] }
  const [progress, setProgress]   = useState(null)   // { done, total }
  const inputRef                  = useRef(null)
  const [cropEleve, setCropEleve] = useState(null)

  // Charger tous les élèves (id, username, internal_number)
  useEffect(() => {
    supabase
      .from('eleves')
      .select('id, nom, prenom, classe, smartschool_username, smartschool_internal_number, photo_url')
      .eq('actif', true)
      .then(({ data }) => {
        const loaded = data || []
        setEleves(loaded)
        setLoading(false)
        const classes = [...new Set(loaded.filter(e => e.photo_url && e.classe).map(e => e.classe))].sort()
        if (onClassesReady) onClassesReady(classes)
      })
  }, [])

  // Index de matching : internnumber → élève, username → élève
  const index = useMemo(() => {
    const m = new Map()
    for (const e of eleves) {
      if (e.smartschool_internal_number) m.set(e.smartschool_internal_number.toLowerCase(), e)
      if (e.smartschool_username) m.set(e.smartschool_username.toLowerCase(), e)
    }
    return m
  }, [eleves])

  const resizeImage = (file) => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 300
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })

  const processFiles = useCallback(async (files) => {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!list.length) return
    setResults(null)
    setProgress({ done: 0, total: list.length })
    const ok = [], ko = []
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      // Extraire la clé depuis le nom de fichier (sans extension)
      const key = file.name.replace(/\.[^.]+$/, '').toLowerCase().trim()
      const eleve = index.get(key)
      if (!eleve) {
        ko.push({ filename: file.name, reason: 'Aucun élève trouvé pour "' + key + '"' })
        setProgress({ done: i + 1, total: list.length })
        continue
      }
      try {
        const blob = await resizeImage(file)
        const path = `${eleve.id}.jpg`
        const { error: upErr } = await supabase.storage
          .from('eleve-photos')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('eleve-photos').getPublicUrl(path)
        const urlWithTs = `${publicUrl}?t=${Date.now()}`
        await supabase.from('eleves').update({ photo_url: urlWithTs }).eq('id', eleve.id)
        ok.push({ filename: file.name, name: `${eleve.prenom} ${eleve.nom}` })
        // Mettre à jour photo_url dans le state local pour la grille
        setEleves(prev => prev.map(el => el.id === eleve.id ? { ...el, photo_url: urlWithTs } : el))
      } catch (e) {
        ko.push({ filename: file.name, reason: e.message || 'Erreur upload' })
      }
      setProgress({ done: i + 1, total: list.length })
    }
    setResults({ ok, ko })
    setProgress(null)
  }, [index])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const uploadForEleve = useCallback(async (eleve, file) => {
    try {
      const blob = await resizeImage(file)
      const path = `${eleve.id}.jpg`
      await supabase.storage.from('eleve-photos').remove([path])
      const { error: upErr } = await supabase.storage.from('eleve-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('eleve-photos').getPublicUrl(path)
      const urlWithTs = `${publicUrl}?t=${Date.now()}`
      await supabase.from('eleves').update({ photo_url: urlWithTs }).eq('id', eleve.id)
      setEleves(prev => prev.map(el => el.id === eleve.id ? { ...el, photo_url: urlWithTs } : el))
    } catch (e) {
      console.error('uploadForEleve', e)
    }
  }, [resizeImage])

  if (loading) return <div className="p-6 text-gray-400 dark:text-gray-500 text-sm">Chargement des élèves…</div>

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Import de photos en masse</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Dépose des images dont le nom correspond au <strong>numéro interne</strong> ou au <strong>nom d'utilisateur Smartschool</strong> de l'élève.<br />
          Exemples : <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">4849.jpg</code> ou <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">elif.kaplaner.jpg</code>
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
          <svg className="w-6 h-6 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {dragging ? 'Dépose ici' : 'Glisse-dépose des photos ou clique pour sélectionner'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">JPEG, PNG, WebP — redimensionnés automatiquement à 300×300</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { processFiles(e.target.files); e.target.value = '' }} />
      </div>

      {/* Progress */}
      {progress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Import en cours…</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: pct + '%' }} />
          </div>
        </div>
      )}

      {/* Résultats */}
      {results && (
        <div className="mt-6 space-y-4">
          {results.ok.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                ✓ {results.ok.length} photo{results.ok.length > 1 ? 's' : ''} importée{results.ok.length > 1 ? 's' : ''}
              </p>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 space-y-0.5 max-h-40 overflow-y-auto">
                {results.ok.map((r, i) => (
                  <div key={i}><span className="font-medium">{r.name}</span> <span className="text-emerald-400">({r.filename})</span></div>
                ))}
              </div>
            </div>
          )}
          {results.ko.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
                ✗ {results.ko.length} fichier{results.ko.length > 1 ? 's' : ''} non importé{results.ko.length > 1 ? 's' : ''}
              </p>
              <div className="text-xs text-red-500 dark:text-red-400 space-y-0.5 max-h-40 overflow-y-auto">
                {results.ko.map((r, i) => (
                  <div key={i}><span className="font-medium">{r.filename}</span> — {r.reason}</div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setResults(null)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Effacer les résultats
          </button>
        </div>
      )}

      {/* Grille des photos existantes */}
      <PhotosGrid
        eleves={eleves}
        search={search}
        filters={filters}
        onCrop={setCropEleve}
        onUploadFor={uploadForEleve}
      />

      {cropEleve && (
        <CropModal
          eleve={cropEleve}
          onClose={() => setCropEleve(null)}
          onSaved={(id, url) => setEleves(prev => prev.map(el => el.id === id ? { ...el, photo_url: url } : el))}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// PARAMÈTRES ÉCOLE
// ══════════════════════════════════════════════════════════

const SETTINGS_DEFS = [
  {
    category: 'identite',
    label: 'Identité de l\'école',
    icon: '🏫',
    fields: [
      { key: 'school_nom',           label: 'Nom de l\'école',    type: 'text', placeholder: 'École Secondaire Plurielle Maritime' },
      { key: 'school_adresse_rue',   label: 'Adresse (rue)',       type: 'text', placeholder: 'Avenue Jean Dubrucq 175' },
      { key: 'school_adresse_cp',    label: 'Code postal',         type: 'text', placeholder: '1080', half: true },
      { key: 'school_adresse_ville', label: 'Ville',               type: 'text', placeholder: 'Molenbeek-Saint-Jean', half: true },
      { key: 'school_bce',           label: 'Numéro BCE / TVA',    type: 'text', placeholder: 'Optionnel' },
    ],
  },
  {
    category: 'contacts',
    label: 'Contacts généraux',
    icon: '📞',
    fields: [
      { key: 'school_email_general', label: 'E-mail général',      type: 'email', placeholder: 'info@espmaritime.be', half: true },
      { key: 'school_tel_general',   label: 'Téléphone général',   type: 'text',  placeholder: '02/210.20.91', half: true },
    ],
  },
  {
    category: 'economat',
    label: 'Économat',
    icon: '💼',
    fields: [
      { key: 'school_nom_eco',       label: 'Nom de l\'économe',   type: 'text',  placeholder: 'Monsieur Lecocq' },
      { key: 'school_email_eco',     label: 'E-mail économat',     type: 'email', placeholder: 'economat@espmaritime.be', half: true },
      { key: 'school_tel_eco',       label: 'Téléphone économat',  type: 'text',  placeholder: '02/210.20.96', half: true },
    ],
  },
  {
    category: 'suivi_social',
    label: 'Suivi social',
    icon: '🤝',
    fields: [
      { key: 'school_nom_as',        label: 'Nom de l\'assistant social', type: 'text',  placeholder: 'Jérôme Mignolet' },
      { key: 'school_email_as',      label: 'E-mail assistant social',    type: 'email', placeholder: 'as@espmaritime.be', half: true },
      { key: 'school_tel_as',        label: 'Téléphone assistant social', type: 'text',  placeholder: '02/210.20.91', half: true },
    ],
  },
  {
    category: 'facturation',
    label: 'Facturation',
    icon: '🏦',
    fields: [
      { key: 'school_iban',          label: 'IBAN',                type: 'text',  placeholder: 'BE17 0910 2167 8721' },
      { key: 'school_beneficiaire',  label: 'Bénéficiaire',        type: 'text',  placeholder: 'École Secondaire Plurielle Maritime' },
    ],
  },
]

function ParametresEcole() {
  const { settings, reload } = useSettings()
  const [values, setValues]   = useState({})
  const [showMap, setShowMap] = useState(false)
  const [dirty, setDirty]     = useState({})
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [logoFile, setLogoFile]   = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoRef = useRef()

  // Initialiser les valeurs depuis le context
  useEffect(() => {
    const initial = {}
    SETTINGS_DEFS.forEach(cat => cat.fields.forEach(f => {
      initial[f.key] = settings[f.key] ?? ''
    }))
    setValues(initial)
    setLogoPreview(settings.school_logo_url || '')
  }, [settings])

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
    setDirty(prev => ({ ...prev, [key]: true }))
  }

  const handleSave = async () => {
    setSaving(true)
    const toUpdate = Object.keys(dirty).filter(k => dirty[k])
    const { error } = await supabase.from('app_settings')
      .upsert(toUpdate.map(k => ({
        key: k,
        value: values[k],
        label: SETTINGS_DEFS.flatMap(c => c.fields).find(f => f.key === k)?.label || k,
        category: SETTINGS_DEFS.find(c => c.fields.some(f => f.key === k))?.category || 'autre',
        updated_at: new Date().toISOString(),
      })), { onConflict: 'key' })
    if (!error) {
      setDirty({})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await reload()
    }
    setSaving(false)
  }

  const handleLogoSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setDirty(prev => ({ ...prev, school_logo_url: true }))
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return
    setLogoUploading(true)
    const ext = logoFile.name.split('.').pop()
    const path = `logo/logo-ecole.${ext}`
    const { error: upErr } = await supabase.storage.from('eleve-photos').upload(path, logoFile, { upsert: true, contentType: logoFile.type })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('eleve-photos').getPublicUrl(path)
      handleChange('school_logo_url', publicUrl)
      setLogoFile(null)
    }
    setLogoUploading(false)
  }

  const hasDirty = Object.values(dirty).some(Boolean)

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">

      {/* Carte d'impact */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <button onClick={() => setShowMap(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <span>🗺️</span> Où ces variables sont-elles utilisées ?
          </span>
          <span className="text-gray-400 dark:text-gray-500 text-xs">{showMap ? '▲ Réduire' : '▼ Afficher'}</span>
        </button>
        {showMap && (
          <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex gap-3 flex-wrap mt-4 mb-5">
              {[['tag-site','bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Site React'],['tag-pdf','bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','PDF généré'],['tag-hdr','bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300','Header / Footer']].map(([,cls,lbl]) => (
                <span key={lbl} className={`text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>{lbl}</span>
              ))}
            </div>
            {[
              { cat:'🏫 Identité', rows:[
                { key:"Nom de l'école",     tags:[['bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300','Footer site'],['bg-emerald-100 text-emerald-700 dark:text-emerald-300','Page connexion'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Tous les PDFs (header + footer)']] },
                { key:'Adresse (rue · CP · ville)', tags:[['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Voyages PDF']] },
                { key:'Numéro BCE / TVA',    tags:[['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF (footer si renseigné)']] },
                { key:'Logo',                tags:[['bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300','Sidebar'],['bg-emerald-100 text-emerald-700 dark:text-emerald-300','Header mobile'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Tous les PDFs (coin supérieur gauche)']] },
              ]},
              { cat:'📞 Contacts généraux', rows:[
                { key:"E-mail général",      tags:[['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Activités PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Articles PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Voyages PDF']] },
                { key:"Téléphone général",   tags:[['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Activités PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Articles PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Voyages PDF']] },
              ]},
              { cat:'💼 Économat', rows:[
                { key:"Nom économe",         tags:[['bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Factures (bloc paiement)'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF']] },
                { key:"E-mail économat",     tags:[['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Articles PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Bilan économe PDF']] },
                { key:"Téléphone économat",  tags:[['bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Factures (bloc paiement)'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Bilan économe PDF']] },
              ]},
              { cat:'🤝 Suivi social', rows:[
                { key:"Nom assistant social",tags:[['bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Factures (bloc paiement)'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Échelonnements PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Organismes tiers PDF']] },
                { key:"E-mail AS",           tags:[['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Échelonnements PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Organismes tiers PDF']] },
                { key:"Téléphone AS",        tags:[['bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Factures (bloc paiement)'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Échelonnements PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Organismes tiers PDF']] },
              ]},
              { cat:'🏦 Facturation', rows:[
                { key:'IBAN',                tags:[['bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Factures (bloc paiement)'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Organismes tiers PDF']] },
                { key:'Bénéficiaire',        tags:[['bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300','Factures (bloc paiement)'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Factures PDF'],['bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300','Organismes tiers PDF']] },
              ]},
            ].map(section => (
              <div key={section.cat} className="mb-4">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{section.cat}</div>
                <div className="space-y-1.5">
                  {section.rows.map(row => (
                    <div key={row.key} className="flex items-start gap-2 text-xs">
                      <span className="font-medium text-gray-700 dark:text-gray-200 w-44 shrink-0 pt-0.5">{row.key}</span>
                      <div className="flex flex-wrap gap-1">
                        {row.tags.map(([cls,lbl]) => (
                          <span key={lbl} className={`px-2 py-0.5 rounded font-medium ${cls}`}>{lbl}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
          <span>🖼️</span> Logo de l'école
        </h3>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900">
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
              : <span className="text-gray-300 dark:text-gray-600 text-xs text-center">Aucun logo</span>
            }
          </div>
          <div className="flex flex-col gap-2">
            <input ref={logoRef} type="file" accept="image/svg+xml,image/png,image/jpeg" className="hidden" onChange={handleLogoSelect} />
            <button onClick={() => logoRef.current.click()}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-400 text-gray-700 dark:text-gray-200 transition-colors">
              Choisir un fichier…
            </button>
            {logoFile && (
              <button onClick={handleLogoUpload} disabled={logoUploading}
                className="text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                {logoUploading ? 'Upload…' : 'Uploader le logo'}
              </button>
            )}
            {values.school_logo_url && (
              <button onClick={() => { handleChange('school_logo_url', ''); setLogoPreview('') }}
                className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 transition-colors">
                Supprimer (revenir au logo par défaut)
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Format recommandé : SVG ou PNG transparent. Si vide, le fichier /logo-ecole.svg est utilisé.</p>
      </div>

      {/* Sections par catégorie */}
      {SETTINGS_DEFS.map(cat => (
        <div key={cat.category} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
            <span>{cat.icon}</span> {cat.label}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {cat.fields.map(field => (
              <div key={field.key} className={field.half ? 'col-span-1' : 'col-span-2'}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{field.label}</label>
                <input
                  type={field.type || 'text'}
                  value={values[field.key] ?? ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                    dirty[field.key] ? 'border-primary/50 bg-primary/5' : 'border-gray-200 dark:border-gray-600'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Bouton de sauvegarde */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">Les modifications s'appliquent immédiatement sur le site et dans les prochains PDFs générés.</p>
        <button onClick={handleSave} disabled={!hasDirty || saving}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saved ? 'bg-green-500 text-white' : hasDirty ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}>
          {saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// GuidanceAdmin — Configuration du module Conseils de guidance
// ══════════════════════════════════════════════════════════
function GuidanceAdmin() {
  const [subTab, setSubTab] = useState('matieres')
  const DEGREES = ['D1','D2','D3']
  const DEGREE_LABELS = { D1: '1er degré (1ère-2ème)', D2: '2ème degré (3ème-4ème)', D3: '3ème degré (5ème-6ème)' }
  const PERIODS = ['P1','P2','P3']
  const CAS_LABELS = { 1: 'Cas 1 — Bonne situation', 2: 'Cas 2 — Difficultés', 3: 'Cas 3 — Préoccupant' }

  const TEMPLATE_VARS = [
    { key: '{{prenom}}',             desc: 'Prénom de l\'élève' },
    { key: '{{il_elle}}',            desc: 'il / elle (genre)' },
    { key: '{{Il_Elle}}',            desc: 'Il / Elle (début de phrase)' },
    { key: '{{son_sa}}',             desc: 'son / sa' },
    { key: '{{le_la}}',              desc: 'le / la' },
    { key: '{{matiere_echec}}',      desc: 'Matières en échec (liste)' },
    { key: '{{matiere_difficulte}}', desc: 'Matières en difficulté (liste)' },
    { key: '{{matiere_ne}}',         desc: 'Matières non évaluées (liste)' },
    { key: '{{competences}}',        desc: 'Compétences problématiques (liste)' },
    { key: '{{ta_forces}}',          desc: 'TA : force (texte)' },
    { key: '{{ta_faiblesses}}',      desc: 'TA : faiblesse (texte)' },
    { key: '{{freins}}',             desc: 'Champ libre : freins' },
    { key: '{{forces}}',             desc: 'Champ libre : forces' },
    { key: '{{conseils}}',           desc: 'Champ libre : conseils' },
    { key: '{{#if clé}}...{{/if}}',  desc: 'Bloc conditionnel (affiché si clé non vide)' },
    { key: '{{suivi_necessaire}}',   desc: 'Non vide si suivi nécessaire' },
  ]

  // ── Matières ──────────────────────────────────────────────────────────────
  const [subjects, setSubjects] = useState([])
  const [newSubjectDegree, setNewSubjectDegree] = useState('D1')
  const [newSubjectName, setNewSubjectName] = useState('')

  useEffect(() => {
    supabase.from('guidance_subjects').select('*').order('degree').order('position')
      .then(({ data }) => setSubjects(data || []))
  }, [])

  const addSubject = async () => {
    if (!newSubjectName.trim()) return
    const { data } = await supabase.from('guidance_subjects')
      .insert({ degree: newSubjectDegree, name: newSubjectName.trim(), position: subjects.filter(s => s.degree === newSubjectDegree).length })
      .select().single()
    if (data) { setSubjects(prev => [...prev, data]); setNewSubjectName('') }
  }

  const deleteSubject = async (id) => {
    await supabase.from('guidance_subjects').delete().eq('id', id)
    setSubjects(prev => prev.filter(s => s.id !== id))
  }

  // ── Compétences ───────────────────────────────────────────────────────────
  const [comps, setComps] = useState([])
  const [newCompDegree, setNewCompDegree] = useState('D1')
  const [newCompName, setNewCompName] = useState('')

  useEffect(() => {
    supabase.from('guidance_competencies').select('*').order('degree').order('position')
      .then(({ data }) => setComps(data || []))
  }, [])

  const addComp = async () => {
    if (!newCompName.trim()) return
    const { data } = await supabase.from('guidance_competencies')
      .insert({ degree: newCompDegree, name: newCompName.trim(), position: comps.filter(c => c.degree === newCompDegree).length })
      .select().single()
    if (data) { setComps(prev => [...prev, data]); setNewCompName('') }
  }

  const deleteComp = async (id) => {
    await supabase.from('guidance_competencies').delete().eq('id', id)
    setComps(prev => prev.filter(c => c.id !== id))
  }

  // ── Personnes ressource ───────────────────────────────────────────────────
  const [persons, setPersons] = useState([])
  const [newPersonName, setNewPersonName] = useState('')

  useEffect(() => {
    supabase.from('guidance_resource_persons').select('*').order('position')
      .then(({ data }) => setPersons(data || []))
  }, [])

  const addPerson = async () => {
    if (!newPersonName.trim()) return
    const { data } = await supabase.from('guidance_resource_persons')
      .insert({ name: newPersonName.trim(), position: persons.length })
      .select().single()
    if (data) { setPersons(prev => [...prev, data]); setNewPersonName('') }
  }

  const deletePerson = async (id) => {
    await supabase.from('guidance_resource_persons').delete().eq('id', id)
    setPersons(prev => prev.filter(p => p.id !== id))
  }

  // ── Statuts ───────────────────────────────────────────────────────────────
  const [statuses, setStatuses] = useState([])
  const [newStatusLabel, setNewStatusLabel] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#6B7280')

  useEffect(() => {
    supabase.from('guidance_task_statuses').select('*').order('position')
      .then(({ data }) => setStatuses(data || []))
  }, [])

  const addStatus = async () => {
    if (!newStatusLabel.trim()) return
    const { data } = await supabase.from('guidance_task_statuses')
      .insert({ label: newStatusLabel.trim(), color: newStatusColor, position: statuses.length })
      .select().single()
    if (data) { setStatuses(prev => [...prev, data]); setNewStatusLabel('') }
  }

  const deleteStatus = async (id) => {
    await supabase.from('guidance_task_statuses').delete().eq('id', id)
    setStatuses(prev => prev.filter(s => s.id !== id))
  }

  // ── Templates ─────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState([])
  const [tplDegree, setTplDegree] = useState('D1')
  const [tplPeriod, setTplPeriod] = useState('P1')
  const [tplCas, setTplCas] = useState(1)
  const [tplBody, setTplBody] = useState('')
  const [tplSaving, setTplSaving] = useState(false)
  const [tplSaved, setTplSaved] = useState(false)

  useEffect(() => {
    supabase.from('guidance_templates').select('*')
      .then(({ data }) => setTemplates(data || []))
  }, [])

  useEffect(() => {
    const tpl = templates.find(t => t.cas === tplCas && t.degree === tplDegree && t.period === tplPeriod)
    setTplBody(tpl?.body || '')
  }, [templates, tplCas, tplDegree, tplPeriod])

  const saveTpl = async () => {
    setTplSaving(true)
    const existing = templates.find(t => t.cas === tplCas && t.degree === tplDegree && t.period === tplPeriod)
    if (existing) {
      await supabase.from('guidance_templates').update({ body: tplBody }).eq('id', existing.id)
      setTemplates(prev => prev.map(t => t.id === existing.id ? { ...t, body: tplBody } : t))
    } else {
      const { data } = await supabase.from('guidance_templates')
        .insert({ cas: tplCas, degree: tplDegree, period: tplPeriod, body: tplBody })
        .select().single()
      if (data) setTemplates(prev => [...prev, data])
    }
    setTplSaving(false)
    setTplSaved(true)
    setTimeout(() => setTplSaved(false), 2000)
  }

  const subtabs = [
    { key: 'matieres', label: 'Matières' },
    { key: 'competences', label: 'Compétences' },
    { key: 'personnes', label: 'Personnes ressource' },
    { key: 'statuts', label: 'Statuts' },
    { key: 'templates', label: 'Templates de commentaires' },
  ]

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-600 pb-0">
        {subtabs.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === st.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {st.label}
          </button>
        ))}
      </div>

      {/* ── MATIÈRES ─────────────────────────────────────────────────────── */}
      {subTab === 'matieres' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Les matières sont organisées par degré. Elles apparaissent dans le formulaire d'encodage selon la classe de l'élève.</p>
          {DEGREES.map(deg => (
            <div key={deg} className="card p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{DEGREE_LABELS[deg]}</h4>
              <div className="space-y-1 mb-3">
                {subjects.filter(s => s.degree === deg).map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm">
                    <span>{s.name}</span>
                    <button onClick={() => deleteSubject(s.id)} className="text-red-400 dark:text-red-300 hover:text-red-600 text-xs">Supprimer</button>
                  </div>
                ))}
              </div>
              {newSubjectDegree === deg ? (
                <div className="flex gap-2">
                  <input value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubject()}
                    placeholder="Nom de la matière…" className="input text-sm flex-1" autoFocus />
                  <button onClick={addSubject} className="btn-primary text-sm px-3">Ajouter</button>
                  <button onClick={() => { setNewSubjectDegree(''); setNewSubjectName('') }} className="btn-ghost text-sm px-3">✕</button>
                </div>
              ) : (
                <button onClick={() => setNewSubjectDegree(deg)} className="text-xs text-primary hover:underline">+ Ajouter une matière</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── COMPÉTENCES ──────────────────────────────────────────────────── */}
      {subTab === 'competences' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Les compétences transversales sont organisées par degré. Elles peuvent différer selon le niveau.</p>
          {DEGREES.map(deg => (
            <div key={deg} className="card p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{DEGREE_LABELS[deg]}</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {comps.filter(c => c.degree === deg).map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">
                    <span>{c.name}</span>
                    <button onClick={() => deleteComp(c.id)} className="text-red-400 dark:text-red-300 hover:text-red-600 text-xs ml-1">✕</button>
                  </div>
                ))}
              </div>
              {newCompDegree === deg ? (
                <div className="flex gap-2">
                  <input value={newCompName} onChange={e => setNewCompName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addComp()}
                    placeholder="Nom de la compétence…" className="input text-sm flex-1" autoFocus />
                  <button onClick={addComp} className="btn-primary text-sm px-3">Ajouter</button>
                  <button onClick={() => { setNewCompDegree(''); setNewCompName('') }} className="btn-ghost text-sm px-3">✕</button>
                </div>
              ) : (
                <button onClick={() => setNewCompDegree(deg)} className="text-xs text-primary hover:underline">+ Ajouter une compétence</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PERSONNES RESSOURCE ──────────────────────────────────────────── */}
      {subTab === 'personnes' && (
        <div className="card p-4 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Personnes ou services vers lesquels l'élève peut être orienté en cas de suivi nécessaire.</p>
          <div className="space-y-1">
            {persons.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm">
                <span>{p.name}</span>
                <button onClick={() => deletePerson(p.id)} className="text-red-400 dark:text-red-300 hover:text-red-600 text-xs">Supprimer</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <input value={newPersonName} onChange={e => setNewPersonName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPerson()}
              placeholder="Nom de la personne ressource…" className="input text-sm flex-1" />
            <button onClick={addPerson} className="btn-primary text-sm px-3">Ajouter</button>
          </div>
        </div>
      )}

      {/* ── STATUTS ──────────────────────────────────────────────────────── */}
      {subTab === 'statuts' && (
        <div className="card p-4 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Statuts d'avancement de l'encodage pour chaque élève.</p>
          <div className="space-y-1">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.label}</span>
                </div>
                <button onClick={() => deleteStatus(s.id)} className="text-red-400 dark:text-red-300 hover:text-red-600 text-xs">Supprimer</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <input value={newStatusLabel} onChange={e => setNewStatusLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStatus()}
              placeholder="Libellé du statut…" className="input text-sm flex-1" />
            <input type="color" value={newStatusColor} onChange={e => setNewStatusColor(e.target.value)}
              className="w-10 h-10 rounded border border-gray-200 dark:border-gray-600 cursor-pointer p-0.5" />
            <button onClick={addStatus} className="btn-primary text-sm px-3">Ajouter</button>
          </div>
        </div>
      )}

      {/* ── TEMPLATES ────────────────────────────────────────────────────── */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Un template par combinaison Cas × Degré × Période. Utilisez les variables ci-dessous entre doubles accolades.
          </p>

          {/* Sélecteurs */}
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="label">Cas</label>
              <select value={tplCas} onChange={e => setTplCas(Number(e.target.value))} className="input text-sm">
                {[1,2,3].map(c => <option key={c} value={c}>{CAS_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Degré</label>
              <select value={tplDegree} onChange={e => setTplDegree(e.target.value)} className="input text-sm">
                {DEGREES.map(d => <option key={d} value={d}>{DEGREE_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Période</label>
              <select value={tplPeriod} onChange={e => setTplPeriod(e.target.value)} className="input text-sm">
                {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Éditeur */}
          <div className="card p-4 space-y-3">
            <label className="label">Corps du template</label>
            <textarea value={tplBody} onChange={e => setTplBody(e.target.value)} rows={8}
              className="input resize-y text-sm font-mono"
              placeholder="Ex: {{prenom}} présente {{#if matiere_echec}}des échecs en {{matiere_echec}}.{{/if}}…" />
            <button onClick={saveTpl} disabled={tplSaving}
              className={`btn-primary text-sm ${tplSaved ? 'bg-green-500' : ''}`}>
              {tplSaving ? 'Sauvegarde…' : tplSaved ? '✓ Sauvegardé' : 'Sauvegarder'}
            </button>
          </div>

          {/* Variables disponibles */}
          <div className="card p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Variables disponibles</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['{{prenom}}',             'Prénom de l\'élève'],
                ['{{il_elle}}',            'il / elle'],
                ['{{Il_Elle}}',            'Il / Elle (début de phrase)'],
                ['{{son_sa}}',             'son / sa'],
                ['{{le_la}}',             'le / la'],
                ['{{matiere_echec}}',      'Matières en échec (liste)'],
                ['{{matiere_difficulte}}', 'Matières en difficulté (liste)'],
                ['{{matiere_ne}}',         'Matières non évaluées (liste)'],
                ['{{competences}}',        'Compétences problématiques (liste)'],
                ['{{freins}}',             'Champ libre : freins'],
                ['{{forces}}',             'Champ libre : forces'],
                ['{{conseils}}',           'Recommandations du conseil'],
                ['{{suivi_necessaire}}',   'Non vide si suivi nécessaire'],
                ['{{#if clé}}…{{/if}}',    'Bloc affiché si clé non vide'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-start gap-2 text-xs py-1">
                  <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-primary font-mono flex-shrink-0">{key}</code>
                  <span className="text-gray-500 dark:text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
