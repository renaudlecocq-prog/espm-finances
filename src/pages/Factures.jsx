import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const fmt = n => Number(n||0).toFixed(2) + ' €'
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'

const STATUT_COLORS = {
  brouillon: 'bg-gray-100 text-gray-600',
  envoye: 'bg-blue-100 text-blue-700',
  paye: 'bg-green-100 text-green-700',
  impaye: 'bg-red-100 text-red-700',
  annule: 'bg-orange-100 text-orange-700',
}

export default function Factures() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [eleves, setEleves] = useState([])
  const [form, setForm] = useState({ eleve_id: '', montant: '', date_emission: new Date().toISOString().slice(0,10), description: '', statut: 'brouillon' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('factures').select('*, eleve:eleve_id(nom,prenom,classe)').order('date_emission', { ascending: false }),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom'),
    ]).then(([f, e]) => { setData(f.data||[]); setEleves(e.data||[]); setLoading(false) })
  }, [])

  const reload = () => supabase.from('factures').select('*, eleve:eleve_id(nom,prenom,classe)').order('date_emission', { ascending: false }).then(({ data }) => setData(data||[]))

  const save = async () => {
    setSaving(true)
    await supabase.from('factures').insert(form)
    await reload(); setSaving(false); setShowForm(false)
  }

  const updateStatut = async (id, statut) => {
    await supabase.from('factures').update({ statut }).eq('id', id)
    await reload()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Factures</h1>
        {isFinancier && <button onClick={() => setShowForm(true)} className="btn-primary">+ Facture</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Nouvelle facture</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id} onChange={e => setForm(f=>({...f,eleve_id:e.target.value}))}>
                <option value="">— Choisir —</option>
                {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant} onChange={e => setForm(f=>({...f,montant:e.target.value}))} />
            </div>
            <div>
              <label className="label">Date d'émission</label>
              <input className="input" type="date" value={form.date_emission} onChange={e => setForm(f=>({...f,date_emission:e.target.value}))} />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={e => setForm(f=>({...f,statut:e.target.value}))}>
                <option value="brouillon">Brouillon</option>
                <option value="envoye">Envoyé</option>
                <option value="paye">Payé</option>
                <option value="impaye">Impayé</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Sauvegarde…':'Enregistrer'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date','Élève','Classe','Montant','Description','Statut','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.length===0?<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucune facture</td></tr>:data.map(r=>(
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{fmtDate(r.date_emission)}</td>
                  <td className="px-4 py-3">{r.eleve?.nom} {r.eleve?.prenom}</td>
                  <td className="px-4 py-3">{r.eleve?.classe}</td>
                  <td className="px-4 py-3 font-medium">{fmt(r.montant)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.description||'—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUT_COLORS[r.statut]||'bg-gray-100 text-gray-600'}`}>{r.statut}</span></td>
                  <td className="px-4 py-3">
                    {isFinancier && r.statut !== 'paye' && <button onClick={() => updateStatut(r.id,'paye')} className="btn btn-sm btn-secondary text-green-600">✓ Payé</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
