import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ROLES = ['admin','financier','mdp','responsable']
const ROLE_COLORS = { admin:'bg-red-100 text-red-700', financier:'bg-blue-100 text-blue-700', mdp:'bg-green-100 text-green-700', responsable:'bg-gray-100 text-gray-600' }

export default function Admin() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('mdp')
  const [inviting, setInviting] = useState(false)
  const [tab, setTab] = useState('users')
  const [stats, setStats] = useState({})

  const reload = () => supabase.from('users').select('*').order('created_at').then(({data}) => setUsers(data||[]))

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      reload(),
      supabase.from('eleves').select('id', {count:'exact'}).eq('actif',true),
      supabase.from('activites').select('id', {count:'exact'}),
      supabase.from('paiements').select('montant'),
    ]).then(([,e,a,p]) => {
      setStats({
        eleves: e.count||0,
        activites: a.count||0,
        paiements: (p.data||[]).reduce((s,r) => s + Number(r.montant||0), 0)
      })
      setLoading(false)
    })
  }, [isAdmin])

  const updateRole = async (id, role) => {
    await supabase.from('users').update({role}).eq('id', id)
    await reload()
  }

  const invite = async () => {
    setInviting(true)
    const { error } = await supabase.auth.admin?.inviteUserByEmail?.(inviteEmail) || {}
    if (!error) { setInviteEmail(''); setShowInvite(false) }
    setInviting(false)
  }

  if (!isAdmin) return <div className="p-8 text-center text-gray-400">Accès réservé aux administrateurs.</div>
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Administration</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{stats.eleves}</div>
          <div className="text-sm text-gray-500 mt-1">Élèves actifs</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{stats.activites}</div>
          <div className="text-sm text-gray-500 mt-1">Activités</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{Number(stats.paiements||0).toFixed(0)} €</div>
          <div className="text-sm text-gray-500 mt-1">Total encaissé</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('users')} className={`btn ${tab==='users'?'btn-primary':'btn-secondary'}`}>Utilisateurs</button>
      </div>

      {tab === 'users' && (
        <div className="card p-0">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Utilisateurs ({users.length})</h2>
            <button onClick={() => setShowInvite(s=>!s)} className="btn-primary btn-sm">+ Inviter</button>
          </div>
          {showInvite && (
            <div className="p-4 border-b border-gray-100 bg-blue-50 flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">Email</label>
                <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="prenom.nom@ecole.be" />
              </div>
              <div>
                <label className="label">Rôle</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button className="btn-primary" onClick={invite} disabled={inviting}>{inviting?'Envoi…':'Envoyer'}</button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Email','Rôle','Créé le','Modifier rôle'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.length===0?<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun utilisateur</td></tr>:users.map(u=>(
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3"><span className={`badge ${ROLE_COLORS[u.role]||'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-BE') : '—'}</td>
                  <td className="px-4 py-3">
                    <select className="input max-w-[140px]" value={u.role||''} onChange={e => updateRole(u.id, e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
