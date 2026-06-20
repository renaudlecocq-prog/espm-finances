import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, UserPlus, Shield } from "lucide-react"
import { useDemo } from "../context/DemoContext"

const ROLES = ['admin','financier','mdp','responsable']

const ROLE_META = {
  admin:       { label:'Admin',       color:'bg-red-100 text-red-700 border border-red-200',       desc:'Accès total — gestion des utilisateurs, toutes les données.' },
  financier:   { label:'Financier',   color:'bg-blue-100 text-blue-700 border border-blue-200',    desc:'Accès financier complet — factures, paiements, élèves, organismes.' },
  mdp:         { label:'MdP',         color:'bg-green-100 text-green-700 border border-green-200', desc:'Membres du personnel — saisie et suivi des activités.' },
  responsable: { label:'Responsable', color:'bg-gray-100 text-gray-600 border border-gray-200',    desc:"Parents / élèves majeurs — consultation de leurs propres soldes." },
}

const DROITS = [
  { label:'Tableau de bord',             admin:true,  financier:true,  mdp:true,  responsable:true  },
  { label:'Liste des élèves',            admin:true,  financier:true,  mdp:true,  responsable:false },
  { label:'Gestion des paiements',       admin:true,  financier:true,  mdp:false, responsable:false },
  { label:'Gestion des factures',        admin:true,  financier:true,  mdp:false, responsable:false },
  { label:'Gestion des activités',       admin:true,  financier:true,  mdp:true,  responsable:false },
  { label:'Gestion des articles',        admin:true,  financier:true,  mdp:false, responsable:false },
  { label:'Échelonnements',              admin:true,  financier:true,  mdp:true,  responsable:false },
  { label:'Organismes tiers',            admin:true,  financier:true,  mdp:true,  responsable:false },
  { label:"Groupes & options",           admin:true,  financier:true,  mdp:true,  responsable:false },
  { label:'Fiche financière enfant',     admin:false, financier:false, mdp:false, responsable:true  },
  { label:'Administration',              admin:true,  financier:false, mdp:false, responsable:false },
  { label:'Synchronisation Smartschool', admin:true,  financier:false, mdp:false, responsable:false },
]

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
  const [protectModal, setProtectModal] = useState(null) // {type:'blocked'|'confirm', newRole, targetId, otherEmail}

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
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Administration</h1>
      <p className="text-sm text-gray-400 mb-6">Gestion des utilisateurs et synchronisation Smartschool</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[['utilisateurs','Utilisateurs'], ['droits','Droits'], ['synchronisation','Synchronisation']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px border border-b-0 transition-colors
              ${tab === k ? 'bg-white border-gray-200 text-primary' : 'text-gray-500 border-transparent hover:text-primary'}`}>
            {l}
          </button>
        ))}
      </div>

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
          {/* ── Mode démo ── */}
          <div className={`card p-4 border ${demoMode ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎭</span>
                  <span className="text-sm font-semibold text-gray-800">Mode démo</span>
                  {demoMode && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{background:'#E86C00'}}>ACTIF</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {demoMode
                    ? 'Les données fictives (Billie Eilish, Taylor Swift…) remplacent la base réelle. Aucune donnée réelle n&apos;est affectée.'
                    : 'Active des données fictives pour présenter la plateforme à des tiers sans exposer les données réelles.'}
                </p>
              </div>
              <button
                onClick={toggleDemo}
                className="ml-4 shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={demoMode
                  ? { background: '#E86C00', color: 'white' }
                  : { background: '#2D1B2E', color: 'white' }}>
                {demoMode ? 'Quitter le mode démo' : 'Activer le mode démo'}
              </button>
            </div>
          </div>
          {/* Aperçu — déplacé ici car lié aux droits */}
          <div className="card p-4 bg-orange-50 border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                Aperçu — Voir le site en tant que
              </span>
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
                  Mode aperçu actif —{' '}
                  <button onClick={() => setPreviewRole(null)} className="underline">Quitter</button>
                </span>
              )}
            </div>
          </div>
          <div className="card p-0">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <Shield size={16} /> Matrice des droits d'accès
            </h2>
            <p className="text-xs text-gray-400 mt-1">Droits attribués par rôle dans l'application.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-64">Fonctionnalité</th>
                {ROLES.map(r => (
                  <th key={r} className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_META[r].color}`}>
                      {ROLE_META[r].label.toUpperCase()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DROITS.map((row, i) => (
                <tr key={i} className={`border-b border-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-4 py-3 text-gray-700">{row.label}</td>
                  {ROLES.map(r => (
                    <td key={r} className="px-4 py-3 text-center">
                      {row[r]
                        ? <span className="text-green-500 font-bold text-base">✓</span>
                        : <span className="text-gray-300 text-base">✗</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  )
}
