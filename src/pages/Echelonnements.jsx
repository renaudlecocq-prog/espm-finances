import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/ui/DataTable'
import FicheEleve from '../components/ui/FicheEleve'

const fmt = n => Number(n||0).toFixed(2) + ' €'
const STATUT_COLORS = { en_cours:'bg-blue-100 text-blue-700', non_respecte:'bg-red-100 text-red-700', termine:'bg-green-100 text-green-700' }

export default function Echelonnements() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ficheId, setFicheId] = useState(null)
  const [form, setForm] = useState({ eleve_id:'', montant:'', nombre_echeances:3, date_debut: new Date().toISOString().slice(0,10), remarque:'', statut:'en_cours' })
  const [saving, setSaving] = useState(false)

  const reload = () => supabase.from('echelonnements').select('*, eleve:eleve_id(nom,prenom,classe)').order('created_at',{ascending:false}).then(({data}) => setData(data||[]))

  useEffect(() => {
    Promise.all([reload(), supabase.from('eleves').select('id,nom,prenom,classe').eq('actif',true).order('nom')]).then(([,e]) => { setEleves(e.data||[]); setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('echelonnements').insert(form)
    await reload(); setSaving(false); setShowForm(false)
  }

  const columns = [
    { key: 'nom', label: 'Nom', render:(_,r) => r.eleve?.nom },
    { key: 'prenom', label: 'Prénom', render:(_,r) => r.eleve?.prenom },
    { key: 'classe', label: 'Classe', render:(_,r) => r.eleve?.classe },
    { key: 'montant', label: 'Montant', render: v => fmt(v) },
    { key: 'nombre_echeances', label: 'Échéances' },
    { key: 'date_debut', label: 'Début' },
    { key: 'statut', label: 'Statut', render: v => <span className={`badge ${STATUT_COLORS[v]||'bg-gray-100 text-gray-600'}`}>{v?.replace('_',' ')}</span> },
  ]

  const uniq = key => [...new Set(data.map(r => String(r[key]??'')))].sort()
  const multiFilters = [{ key:'statut', label:'Statut', options:['en_cours','non_respecte','termine'] }]

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Échelonnements</h1>
        {isFinancier && <button onClick={() => setShowForm(true)} className="btn-primary">+ Échelonnement</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id} onChange={e => setForm(f=>({...f,eleve_id:e.target.value}))}>
                <option value="">— Choisir —</option>
                {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Montant total (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant} onChange={e => setForm(f=>({...f,montant:e.target.value}))} />
            </div>
            <div>
              <label className="label">Nombre d'échéances</label>
              <input className="input" type="number" min="1" value={form.nombre_echeances} onChange={e => setForm(f=>({...f,nombre_echeances:e.target.value}))} />
            </div>
            <div>
              <label className="label">Date de début</label>
              <input className="input" type="date" value={form.date_debut} onChange={e => setForm(f=>({...f,date_debut:e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Remarque</label>
              <input className="input" value={form.remarque} onChange={e => setForm(f=>({...f,remarque:e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Sauvegarde…':'Enregistrer'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={data} multiFilters={multiFilters} onRowClick={row => setFicheId(row.eleve_id)} />
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}
