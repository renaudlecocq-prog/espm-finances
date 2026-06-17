import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const fmt = n => Number(n||0).toFixed(2) + ' €'
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'

export default function Paiements() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ eleve_id: '', montant: '', date: new Date().toISOString().slice(0,10), communication: '', mode: 'virement', remarque: '' })
  const [saving, setSaving] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    Promise.all([
      supabase.from('paiements').select('*, eleve:eleve_id(nom,prenom,classe)').order('date', { ascending: false }),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom'),
    ]).then(([p, e]) => { setData(p.data || []); setEleves(e.data || []); setLoading(false) })
  }, [])

  const reload = () => supabase.from('paiements').select('*, eleve:eleve_id(nom,prenom,classe)').order('date', { ascending: false }).then(({ data }) => setData(data || []))

  const save = async () => {
    setSaving(true)
    await supabase.from('paiements').insert(form)
    await reload(); setSaving(false); setShowForm(false)
    setForm({ eleve_id: '', montant: '', date: new Date().toISOString().slice(0,10), communication: '', mode: 'virement', remarque: '' })
  }

  const handleCsv = async e => {
    const file = e.target.files[0]; if (!file) return
    setCsvLoading(true)
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    // Format Belfius : Date;Numéro de compte;Nom;Contrepartie;Nom contrepartie;Communication 1;Communication 2;Communication 3;Montant;Devise;...
    const rows = lines.slice(1).map(l => {
      const cols = l.split(';').map(c => c.replace(/"/g,'').trim())
      const montant = parseFloat((cols[8] || cols[2] || '0').replace(',','.') || 0)
      const communication = [cols[5], cols[6], cols[7]].filter(Boolean).join(' ').trim() || cols[1] || ''
      return { date: cols[0], communication, montant, mode: 'virement' }
    }).filter(r => r.montant > 0)
    if (rows.length > 0) { await supabase.from('paiements').insert(rows); await reload() }
    setCsvLoading(false); e.target.value = ''
  }

  const rows = search ? data.filter(r => {
    const q = search.toLowerCase()
    return `${r.eleve?.nom||''} ${r.eleve?.prenom||''} ${r.communication||''}`.toLowerCase().includes(q)
  }) : data

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Paiements</h1>
        {isFinancier && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
            <button onClick={() => fileRef.current.click()} className="btn-secondary" disabled={csvLoading}>{csvLoading ? 'Import…' : 'Import CSV Belfius'}</button>
            <button onClick={() => setShowForm(true)} className="btn-primary">+ Paiement</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Nouveau paiement</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id} onChange={e => setForm(f => ({...f, eleve_id: e.target.value}))}>
                <option value="">— Choisir —</option>
                {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant} onChange={e => setForm(f => ({...f, montant: e.target.value}))} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={form.mode} onChange={e => setForm(f => ({...f, mode: e.target.value}))}>
                <option value="virement">Virement</option>
                <option value="cash">Cash</option>
                <option value="bancontact">Bancontact</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Communication</label>
              <input className="input" value={form.communication} onChange={e => setForm(f => ({...f, communication: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Remarque</label>
              <input className="input" value={form.remarque} onChange={e => setForm(f => ({...f, remarque: e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Sauvegarde…' : 'Enregistrer'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card p-0">
        <div className="p-4 border-b border-gray-100">
          <input className="input max-w-xs" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          <span className="ml-4 text-xs text-gray-400">{rows.length} résultat{rows.length!==1?'s':''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date','Élève','Classe','Montant','Communication','Mode','Remarque'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length===0?<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun paiement</td></tr>:rows.map(r=>(
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3">{r.eleve?.nom} {r.eleve?.prenom}</td>
                  <td className="px-4 py-3">{r.eleve?.classe}</td>
                  <td className="px-4 py-3 font-medium text-green-600">{fmt(r.montant)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.communication||'—'}</td>
                  <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600">{r.mode||'—'}</span></td>
                  <td className="px-4 py-3 text-gray-500">{r.remarque||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
