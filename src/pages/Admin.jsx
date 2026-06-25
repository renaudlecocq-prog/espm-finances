import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, UserPlus, Shield, Lock } from "lucide-react"
import PageHeader from "../components/ui/PageHeader"
import { useDemo } from "../context/DemoContext"
import { FEATURES, ROLES, ROLE_META, FEATURE_GROUPS } from '../lib/permissions'
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
  const { user, isAdmin, role: myRole, previewRole, setPreviewRole } = useAuth()
  const { demoMode, toggleDemo } = useDemo()
  const [searchParams] = useSearchParams()
  const [tab, setTab]             = useState(searchParams.get('onglet') || 'utilisateurs')
  const [users, setUsers]         = useState([])
  const [syncLogs, setSyncLogs]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('mdp')
  const [inviteMsg, setInviteMsg]     = useState('')
  const [roleFilter, setRoleFilter]   = useState(null)
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
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => setUsers(data || []))
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

  const updateRole = async (id, newRole) => {
    // Protection : empêcher de se retirer son propre rôle admin
    if (id === user?.id && myRole === 'admin' && newRole !== 'admin') {
      const otherAdmins = users.filter(u => u.role === 'admin' && u.id !== id)
      if (otherAdmins.length === 0) {
        setProtectModal({ type: 'blocked', newRole, targetId: id })
        return
      }
      setProtectModal({ type: 'confirm', newRole, targetId: id, otherEmail: otherAdmins[0].email })
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

  if (!isAdmin) return <div className="p-8 text-center text-gray-400">Accès réservé aux administrateurs.</div>
  if (loading)  return <div className="p-8 text-center text-gray-400">Chargement…</div>

  const countByRole = r => users.filter(u => u.role === r).length

  return (
    <>
    <PageHeader
      title="Administration"
      subtitle="Gestion des utilisateurs et synchronisation Smartschool"
      tabs={[
        { key: 'utilisateurs',  label: 'Utilisateurs' },
        { key: 'droits',        label: 'Droits' },
        { key: 'synchronisation', label: 'Synchronisation' },
        { key: 'helpdesk', label: 'Helpdesk' },
        { key: 'natures', label: 'Natures comptables' },
        { key: 'photos',  label: 'Photos élèves' },
      ]}
      activeTab={tab}
      onTabChange={setTab}
    />
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── UTILISATEURS ─────────────────────────────── */}
      {tab === 'utilisateurs' && (
        <div className="space-y-6">

          {/* Role cards — cliquables pour filtrer */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ROLES.map(r => {
              const m = ROLE_META[r]
              const active = roleFilter === r
              return (
                <button key={r} onClick={() => setRoleFilter(active ? null : r)}
                  className={`card p-4 text-left transition-all ${active ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
                    <span className="text-2xl font-bold text-primary">{countByRole(r)}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">{m.desc}</p>
                  {active && <p className="text-xs text-primary font-semibold mt-1">▲ filtre actif</p>}
                </button>
              )
            })}
          </div>

          {/* Users table */}
          <div className="card p-0">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">
                {roleFilter
                  ? <>Utilisateurs — <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_META[roleFilter].color}`}>{ROLE_META[roleFilter].label}</span> ({users.filter(u => u.role === roleFilter).length})</>
                  : <>Tous les utilisateurs ({users.length})</>}
              </h2>
              <button onClick={() => setInviteModal(true)}
                className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3">
                <UserPlus size={15} /> + Inviter
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Email','Nom','Rôle','Dernière connexion','Changer le rôle'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(roleFilter ? users.filter(u => u.role === roleFilter) : users).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucun utilisateur</td></tr>
                ) : (roleFilter ? users.filter(u => u.role === roleFilter) : users).map(u => {
                  const m = ROLE_META[u.role] || ROLE_META.responsable
                  return (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {u.email}
                        {u.role === 'admin' && myRole === 'admin' && (
                          <span className="ml-1 text-xs text-gray-400">(vous)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {[u.nom, u.prenom].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.color}`}>{m.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {u.last_connexion ? new Date(u.last_connexion).toLocaleString('fr-BE', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select className="input text-sm max-w-[140px] py-1"
                          value={u.role || ''} onChange={e => updateRole(u.id, e.target.value)}>
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DROITS ───────────────────────────────────── */}
      {tab === 'droits' && (
        <div className="space-y-6">

          {/* Mode démo */}
          <div className={`card p-4 border ${demoMode ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎭</span>
                  <span className="text-sm font-semibold text-gray-800">Mode démo</span>
                  {demoMode && <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{background:'#E86C00'}}>ACTIF</span>}
                </div>
                <p className="text-xs text-gray-500">
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
          <div className="card p-4 bg-orange-50 border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Aperçu — Voir le site en tant que</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {['financier','mdp','responsable'].map(r => {
                const m = ROLE_META[r]
                return (
                  <button key={r} onClick={() => setPreviewRole(previewRole === r ? null : r)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                      ${previewRole === r ? m.color : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {m.label}
                  </button>
                )
              })}
              {previewRole && (
                <span className="text-xs text-orange-600 ml-2">
                  Mode aperçu actif — <button onClick={() => setPreviewRole(null)} className="underline">Quitter</button>
                </span>
              )}
            </div>
          </div>

          {/* Matrice interactive */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Shield size={16} /> Droits par rôle
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Modifiez les droits — les utilisateurs concernés voient le changement en temps réel.</p>
              </div>
              {droitsLoading && <RefreshCw size={14} className="animate-spin text-gray-400" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase" style={{minWidth:260}}>Fonctionnalité</th>
                    {ROLES.map(r => (
                      <th key={r} className="px-4 py-3 text-center" style={{minWidth:100}}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_META[r].color}`}>{ROLE_META[r].label}</span>
                          {r === 'admin' && <Lock size={10} className="text-gray-400" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_GROUPS.map(group => (
                    <>
                      <tr key={`grp-${group}`} className="bg-gray-50/70 border-y border-gray-100">
                        <td colSpan={ROLES.length + 1} className="px-5 py-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{group}</span>
                        </td>
                      </tr>
                      {FEATURES.filter(f => f.group === group).map(feat => (
                        <tr key={feat.key} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-700 text-sm">{feat.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{feat.desc}</div>
                          </td>
                          {ROLES.map(r => {
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
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-2">
              <Lock size={11} /> La colonne Admin est verrouillée — un administrateur dispose toujours de tous les droits.
            </div>
          </div>

          {/* Exceptions individuelles */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <UserPlus size={16} /> Exceptions individuelles
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Accordez ou révoquez un droit pour une personne, indépendamment de son rôle.</p>
              </div>
              <button onClick={() => { setOverrideModal(true); setOverrideUser(''); setOverrideFeature(''); setOverrideEnabled(true) }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{backgroundColor:'#2D1B2E', color:'#fff'}}>
                <UserPlus size={14} /> Ajouter
              </button>
            </div>
            {userOverrides.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Aucune exception — tous les utilisateurs suivent les droits de leur rôle.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Utilisateur','Rôle','Fonctionnalité','Override',''].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userOverrides.map(ov => {
                    const feat = FEATURES.find(f => f.key === ov.feature)
                    const rm = ROLE_META[ov.profiles?.role] || ROLE_META.responsable
                    return (
                      <tr key={`${ov.user_id}-${ov.feature}`} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">{ov.profiles?.prenom} {ov.profiles?.nom}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rm.color}`}>{rm.label}</span></td>
                        <td className="px-4 py-3 text-gray-600">{feat?.label ?? ov.feature}</td>
                        <td className="px-4 py-3">
                          {ov.enabled
                            ? <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Accordé</span>
                            : <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">✗ Révoqué</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeUserOverride(ov.user_id, ov.feature)}
                            className="text-gray-400 hover:text-red-500 text-xs font-medium transition-colors">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">Ajouter une exception</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Utilisateur</label>
                <select value={overrideUser} onChange={e => setOverrideUser(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {users.filter(u => u.role !== 'admin').map(u => (
                    <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({ROLE_META[u.role]?.label ?? u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Fonctionnalité</label>
                <select value={overrideFeature} onChange={e => setOverrideFeature(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
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
                <label className="block text-xs font-semibold text-gray-600 mb-2">Type</label>
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
                <p className="text-xs text-gray-400 mt-2">
                  {overrideEnabled
                    ? "Accès accordé même si son rôle ne l'y autorise pas."
                    : "Accès révoqué même si son rôle l'y autorise."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOverrideModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600">Annuler</button>
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
                <h3 className="font-semibold text-gray-800">Synchronisation Smartschool</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
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
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Historique des synchronisations
              </h2>
              <button onClick={loadSyncLogs}
                className="text-xs text-gray-400 hover:text-primary flex items-center gap-1">
                <RefreshCw size={12} /> Rafraîchir
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date','Statut','Élèves','Personnel','Message'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucune synchronisation enregistrée</td></tr>
                ) : syncLogs.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
                    <td className="px-4 py-2">
                      {(l.status === 'success' || l.success)
                        ? <span className="text-green-500 text-base font-bold">✓</span>
                        : <span className="text-red-500 text-base font-bold">✗</span>}
                    </td>
                    <td className="px-4 py-2 font-medium">{l.eleves_upserted ?? l.nb_eleves ?? 0}</td>
                    <td className="px-4 py-2 font-medium">{l.personnel_upserted ?? l.nb_personnel ?? 0}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate">{l.details ?? l.message ?? '—'}</td>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            {protectModal.type === 'blocked' ? (
              <>
                <div className="text-3xl mb-3 text-center">🔒</div>
                <h3 className="font-bold text-red-600 mb-2 text-center">Action impossible</h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Vous êtes le seul administrateur. Vous ne pouvez pas retirer votre propre rôle Admin tant qu'aucun autre admin n'existe.
                </p>
                <button onClick={() => setProtectModal(null)} className="btn-primary w-full py-2">Compris</button>
              </>
            ) : (
              <>
                <div className="text-3xl mb-3 text-center">⚠️</div>
                <h3 className="font-bold text-orange-600 mb-2 text-center">Confirmer le changement</h3>
                <p className="text-sm text-gray-600 mb-1 text-center">
                  Vous allez retirer votre propre rôle <strong>Admin</strong>.
                </p>
                <p className="text-xs text-gray-400 text-center mb-4">
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

      {inviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
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
                  {ROLES.filter(r => r !== 'admin').map(r => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
              </div>
              {inviteMsg && (
                <p className={`text-sm px-3 py-2 rounded-lg ${inviteMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
      {tab === 'photos' && <PhotosAdmin />}
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
          form_fields:[], rapporteur_roles:['admin','financier','mdp'], agent_roles:['admin'] })}
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
    produit: 'bg-green-100 text-green-700',
    charge:  'bg-red-100 text-red-600',
    neutre:  'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-700">Natures comptables</h2>
          <p className="text-xs text-gray-400 mt-0.5">{natures.length} natures · {natures.filter(n => !n.actif).length} désactivées</p>
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
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Libellé</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Bilan</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Actif</th>
                <th className="w-20 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(n => (
                <tr key={n.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${!n.actif ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-700">{n.libelle}</p>
                    <p className="text-xs text-gray-400">{n.categorie} › {n.sous_categorie}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[n.type_flux]}`}>
                      {n.type_flux === 'produit' ? 'Produit' : n.type_flux === 'charge' ? 'Charge' : 'Neutre'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {n.in_bilan
                      ? <span className="text-green-500 text-xs">✓</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => toggleActif(n)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors
                        ${n.actif ? 'bg-green-400' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5
                        ${n.actif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setEditItem({ ...n })}
                        className="p-1.5 hover:bg-indigo-50 rounded text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Modifier">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteNature(n.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors"
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
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
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
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{item.id ? 'Modifier' : 'Nouvelle'} nature comptable</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
            <input
              value={form.categorie}
              onChange={e => set('categorie', e.target.value)}
              list="cat-list"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              placeholder="ex: Frais pédagogiques"
            />
            <datalist id="cat-list">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sous-catégorie</label>
            <input
              value={form.sous_categorie}
              onChange={e => {
                const sc = e.target.value
                set('sous_categorie', sc)
                if (form.categorie) set('libelle', `${form.categorie} - ${sc}`)
              }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              placeholder="ex: Anglais"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Libellé complet</label>
            <input
              value={form.libelle}
              onChange={e => set('libelle', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type de flux</label>
              <select
                value={form.type_flux}
                onChange={e => set('type_flux', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              >
                <option value="charge">Charge (sortie)</option>
                <option value="produit">Produit (entrée)</option>
                <option value="neutre">Neutre (transfert)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.in_bilan} onChange={e => set('in_bilan', e.target.checked)}
                  className="rounded" />
                Inclus au bilan
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.actif} onChange={e => set('actif', e.target.checked)}
                  className="rounded" />
                Actif
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" title="Cette charge est compensée par les encaissements élèves (Extramuros, Voyages, Frais péda…)">
                <input type="checkbox" checked={form.in_couverture ?? false} onChange={e => set('in_couverture', e.target.checked)}
                  className="rounded accent-indigo-500" />
                <span>Couverture élèves</span>
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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
      <div className="bg-white rounded-2xl p-6 w-[360px]" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-800 mb-0.5">{eleve.prenom} {eleve.nom}</h3>
        <p className="text-xs text-gray-400 mb-4">Glisse pour recadrer · Curseur pour zoomer</p>

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
          <span className="text-xs text-gray-400">−</span>
          <input
            type="range" min={minZoom} max={minZoom * 3} step={0.01} value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs text-gray-400">+</span>
        </div>

        {cropError && <p className="text-xs text-red-500 mb-3">{cropError}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
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
//  PhotosGrid — grille filtrée des photos importées
// ══════════════════════════════════════════════════════════
function PhotosGrid({ eleves, search, onSearchChange, filters, onFiltersChange, onCrop }) {
  const withPhotos = useMemo(() => eleves.filter(e => e.photo_url), [eleves])
  const classes    = useMemo(() => [...new Set(withPhotos.map(e => e.classe).filter(Boolean))].sort(), [withPhotos])
  const filterDefs = useMemo(() => [{ key: 'classe', label: 'Classe', options: classes }], [classes])

  const filtered = useMemo(() => {
    let d = withPhotos
    if (search.trim()) d = d.filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase()))
    if (filters.classe?.length) d = d.filter(e => filters.classe.includes(e.classe))
    return d
  }, [withPhotos, search, filters])

  if (!withPhotos.length) return null

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-700 text-sm">
          {filtered.length !== withPhotos.length
            ? `${filtered.length} / ${withPhotos.length} photos`
            : `${withPhotos.length} photos importées`}
        </h4>
        <div className="flex items-center gap-2">
          <MasterFilter filterDefs={filterDefs} filters={filters} onChange={onFiltersChange} />
          <input
            type="text" placeholder="Rechercher…" value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-44 outline-none focus:border-indigo-300"
          />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {filtered.map(e => (
          <div key={e.id} className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => onCrop(e)}>
            <div className="relative">
              <img src={e.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border border-gray-200" />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0H3m4 0l-4 4M17 8v12m0 0h4m-4 0l4-4" />
                </svg>
              </div>
            </div>
            <span className="text-[10px] text-gray-500 text-center leading-tight">{e.prenom}<br/>{e.nom}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Photos Admin — import en masse
// ══════════════════════════════════════════════════════════
function PhotosAdmin() {
  const [eleves, setEleves]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [dragging, setDragging]   = useState(false)
  const [results, setResults]     = useState(null)   // { ok: [], ko: [] }
  const [progress, setProgress]   = useState(null)   // { done, total }
  const inputRef                  = useRef(null)
  const [cropEleve, setCropEleve] = useState(null)
  const [gridSearch, setGridSearch] = useState('')
  const [gridFilters, setGridFilters] = useState({})

  // Charger tous les élèves (id, username, internal_number)
  useEffect(() => {
    supabase
      .from('eleves')
      .select('id, nom, prenom, classe, smartschool_username, smartschool_internal_number, photo_url')
      .eq('actif', true)
      .then(({ data }) => { setEleves(data || []); setLoading(false) })
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

  if (loading) return <div className="p-6 text-gray-400 text-sm">Chargement des élèves…</div>

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-1">Import de photos en masse</h3>
        <p className="text-sm text-gray-500">
          Dépose des images dont le nom correspond au <strong>numéro interne</strong> ou au <strong>nom d'utilisateur Smartschool</strong> de l'élève.<br />
          Exemples : <code className="bg-gray-100 px-1 rounded text-xs">4849.jpg</code> ou <code className="bg-gray-100 px-1 rounded text-xs">elif.kaplaner.jpg</code>
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}>
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">
          {dragging ? 'Dépose ici' : 'Glisse-dépose des photos ou clique pour sélectionner'}
        </p>
        <p className="text-xs text-gray-400">JPEG, PNG, WebP — redimensionnés automatiquement à 300×300</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { processFiles(e.target.files); e.target.value = '' }} />
      </div>

      {/* Progress */}
      {progress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Import en cours…</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: pct + '%' }} />
          </div>
        </div>
      )}

      {/* Résultats */}
      {results && (
        <div className="mt-6 space-y-4">
          {results.ok.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-2">
                ✓ {results.ok.length} photo{results.ok.length > 1 ? 's' : ''} importée{results.ok.length > 1 ? 's' : ''}
              </p>
              <div className="text-xs text-emerald-600 space-y-0.5 max-h-40 overflow-y-auto">
                {results.ok.map((r, i) => (
                  <div key={i}><span className="font-medium">{r.name}</span> <span className="text-emerald-400">({r.filename})</span></div>
                ))}
              </div>
            </div>
          )}
          {results.ko.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">
                ✗ {results.ko.length} fichier{results.ko.length > 1 ? 's' : ''} non importé{results.ko.length > 1 ? 's' : ''}
              </p>
              <div className="text-xs text-red-500 space-y-0.5 max-h-40 overflow-y-auto">
                {results.ko.map((r, i) => (
                  <div key={i}><span className="font-medium">{r.filename}</span> — {r.reason}</div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setResults(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Effacer les résultats
          </button>
        </div>
      )}

      {/* Grille des photos existantes */}
      <PhotosGrid
        eleves={eleves}
        search={gridSearch}
        onSearchChange={setGridSearch}
        filters={gridFilters}
        onFiltersChange={setGridFilters}
        onCrop={setCropEleve}
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
