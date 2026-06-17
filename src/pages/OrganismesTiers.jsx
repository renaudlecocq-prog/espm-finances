import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/ui/DataTable'
import FicheEleve from '../components/ui/FicheEleve'

const STATUT_COLORS = { en_cours:'bg-blue-100 text-blue-700', valide:'bg-green-100 text-green-700', refuse:'bg-red-100 text-red-700', cloture:'bg-gray-100 text-gray-600' }

export default function OrganismesTiers() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ficheId, setFicheId] = useState(null)
  const [form, setForm] = useState({ eleve_id:'', organisme:'CPAS', statut:'en_cours', montant_accorde:'', remarque:'' })
  const [saving, setSaving] = useState(false)

  const reload = () => supabase.from('organismes_tiers').select('*, eleve:eleve_id(nom,prenom,classe)').order('created_at',{ascending:false}).then(({data}) => setData(data||[]))

  useEffect(() => {
    Promise.all([reload(), supabase.from('eleves').select('id,nom,prenom,classe').eq('actif',true).order('nom')]).then(([,e]) => { setEleves(e.data||[]); setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('organismes_tiers').insert(form)
    await reload(); setSaving(false); setShowForm(false)
  }

  const columns = [
    { key:'nom', label:'Nom', render:(_,r) => r.eleve?.nom },
    { key:'prenom', label:'Prénom', render:(_,r) => r.eleve?.prenom },
    { key:'classe', label:'Classe', render:(_,r) => r.eleve?.classe },
    { key:'organisme', label:'Organisme' },
    { key:'montant_accorde', label:'Montant accordé', render: v => v ? Number(v).toFixed(2)+' €' : '—' },
    { key:'statut', label:'Statut', render: v => <span className={`badge ${STATUT_COLORS[v]||'bg-gray-100 text-gray-600'}`}>{v?.replace('_',' ')}</span> },
  ]

  const multiFilters = [
    { key:'organisme', label:'Organisme', options:['CPAS','ULB','SPJ','Autre'] },
    { key:'statut', label:'Statut', options:['en_cours','valide','refuse','cloture'] },
  ]

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Organismes tiers</h1>
        {isFinancier && <button onClick={() => setShowForm(true)} className="btn-primary">+ Organisme</button>}
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
              <label className="label">Organisme</label>
              <select className="input" value={form.organisme} onChange={e => setForm(f=>({...f,organisme:e.target.value}))}>
                {['CPAS','ULB','SPJ','Autre'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Montant accordé (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant_accorde} onChange={e => setForm(f=>({...f,montant_accorde:e.target.value}))} />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={e => setForm(f=>({...f,statut:e.target.value}))}>
                {['en_cours','valide','refuse','cloture'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
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
