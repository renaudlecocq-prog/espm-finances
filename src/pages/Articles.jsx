import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['Frais obligatoires','Fournitures scolaires','Vêtements','Divers']
const fmt = n => Number(n||0).toFixed(2) + ' €'

function CatalogueTab() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState({ nom:'', description:'', categorie:'Frais obligatoires', prix_unitaire:'', statut:'actif' })
  const [saving, setSaving] = useState(false)

  const reload = () => supabase.from('articles').select('*').order('categorie').order('nom').then(({data}) => { setData(data||[]); setLoading(false) })
  useEffect(() => { reload() }, [])

  const openForm = (row=null) => { setEditRow(row); setForm(row ? {...row} : { nom:'', description:'', categorie:'Frais obligatoires', prix_unitaire:'', statut:'actif' }); setShowForm(true) }
  const save = async () => {
    setSaving(true)
    if (editRow) await supabase.from('articles').update(form).eq('id', editRow.id)
    else await supabase.from('articles').insert(form)
    await reload(); setSaving(false); setShowForm(false)
  }

  const byCategorie = CATEGORIES.map(cat => ({ cat, items: data.filter(d => d.categorie === cat) })).filter(g => g.items.length > 0)

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  return (
    <div>
      {isFinancier && <button onClick={() => openForm()} className="btn-primary mb-4">+ Article</button>}

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nom</label>
              <input className="input" value={form.nom} onChange={e => setForm(f=>({...f,nom:e.target.value}))} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.categorie} onChange={e => setForm(f=>({...f,categorie:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prix unitaire (€)</label>
              <input className="input" type="number" step="0.01" value={form.prix_unitaire} onChange={e => setForm(f=>({...f,prix_unitaire:e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={e => setForm(f=>({...f,statut:e.target.value}))}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Sauvegarde…':'Enregistrer'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {byCategorie.map(({ cat, items }) => (
        <div key={cat} className="mb-6">
          <h3 className="font-semibold text-gray-600 text-sm uppercase tracking-wide mb-2">{cat}</h3>
          <div className="card p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nom','Description','Prix unit.','Statut',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.nom}</td>
                    <td className="px-4 py-3 text-gray-500">{a.description||'—'}</td>
                    <td className="px-4 py-3">{fmt(a.prix_unitaire)}</td>
                    <td className="px-4 py-3"><span className={`badge ${a.statut==='actif'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{a.statut}</span></td>
                    <td className="px-4 py-3">{isFinancier && <button onClick={() => openForm(a)} className="btn btn-secondary btn-sm">Modifier</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function AttributionsTab() {
  const { isFinancier } = useAuth()
  const [articles, setArticles] = useState([])
  const [eleves, setEleves] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ article_id:'', type_attribution:'classe', classes:[], eleve_id:'', quantite:1, quantite_par:'par_eleve', prix_unitaire_applique:'', statut_facturation:'a_facturer', notes:'' })
  const [saving, setSaving] = useState(false)

  const reload = () => supabase.from('article_attributions').select('*, article:article_id(nom,categorie,prix_unitaire)').order('created_at',{ascending:false}).then(({data}) => setData(data||[]))

  useEffect(() => {
    Promise.all([
      supabase.from('articles').select('id,nom,categorie,prix_unitaire').eq('statut','actif').order('categorie').order('nom'),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif',true).order('nom'),
      reload(),
    ]).then(([a,e]) => { setArticles(a.data||[]); setEleves(e.data||[]); setLoading(false) })
  }, [])

  const byCategorie = CATEGORIES.reduce((acc, cat) => { acc[cat] = articles.filter(a => a.categorie === cat); return acc }, {})
  const save = async () => {
    setSaving(true)
    await supabase.from('article_attributions').insert({ ...form, date_attribution: new Date().toISOString().slice(0,10) })
    await reload(); setSaving(false); setShowForm(false)
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  return (
    <div>
      {isFinancier && <button onClick={() => setShowForm(true)} className="btn-primary mb-4">+ Attribution</button>}

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Article</label>
              <select className="input" value={form.article_id} onChange={e => setForm(f=>({...f,article_id:e.target.value}))}>
                <option value="">— Choisir —</option>
                {CATEGORIES.map(cat => byCategorie[cat]?.length > 0 && (
                  <optgroup key={cat} label={cat}>
                    {byCategorie[cat].map(a => <option key={a.id} value={a.id}>{a.nom} ({fmt(a.prix_unitaire)})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type d'attribution</label>
              <select className="input" value={form.type_attribution} onChange={e => setForm(f=>({...f,type_attribution:e.target.value}))}>
                <option value="classe">Par classe</option>
                <option value="individuel">Individuel</option>
              </select>
            </div>
            {form.type_attribution === 'individuel' ? (
              <div>
                <label className="label">Élève</label>
                <select className="input" value={form.eleve_id} onChange={e => setForm(f=>({...f,eleve_id:e.target.value}))}>
                  <option value="">— Choisir —</option>
                  {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Classe(s)</label>
                <input className="input" placeholder="ex: 5A, 5B" value={form.classes?.join(', ')} onChange={e => setForm(f=>({...f,classes:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} />
              </div>
            )}
            <div>
              <label className="label">Quantité</label>
              <input className="input" type="number" min="1" value={form.quantite} onChange={e => setForm(f=>({...f,quantite:e.target.value}))} />
            </div>
            <div>
              <label className="label">Quantité par</label>
              <select className="input" value={form.quantite_par} onChange={e => setForm(f=>({...f,quantite_par:e.target.value}))}>
                <option value="par_eleve">Par élève</option>
                <option value="groupe">Par groupe</option>
              </select>
            </div>
            <div>
              <label className="label">Prix appliqué (laisser vide = prix article)</label>
              <input className="input" type="number" step="0.01" value={form.prix_unitaire_applique} onChange={e => setForm(f=>({...f,prix_unitaire_applique:e.target.value}))} />
            </div>
            <div>
              <label className="label">Statut facturation</label>
              <select className="input" value={form.statut_facturation} onChange={e => setForm(f=>({...f,statut_facturation:e.target.value}))}>
                <option value="a_facturer">À facturer</option>
                <option value="facture">Facturé</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
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
                {['Article','Catégorie','Attribution','Qté','Prix appliqué','Facturation','Notes'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.length===0?<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucune attribution</td></tr>:data.map(r=>(
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.article?.nom}</td>
                  <td className="px-4 py-3 text-gray-500">{r.article?.categorie}</td>
                  <td className="px-4 py-3 text-gray-600">{r.type_attribution==='individuel'?`Élève ${r.eleve_id?.slice(0,8)}…`:(r.classes||[]).join(', ')}</td>
                  <td className="px-4 py-3">{r.quantite} / {r.quantite_par?.replace('_',' ')}</td>
                  <td className="px-4 py-3">{r.prix_unitaire_applique ? fmt(r.prix_unitaire_applique) : fmt(r.article?.prix_unitaire)}</td>
                  <td className="px-4 py-3"><span className={`badge ${r.statut_facturation==='facture'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{r.statut_facturation?.replace('_',' ')}</span></td>
                  <td className="px-4 py-3 text-gray-500">{r.notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function Articles() {
  const [tab, setTab] = useState('catalogue')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('onglet') === 'attributions') setTab('attributions')
  }, [searchParams])

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Articles</h1>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('catalogue')} className={`btn ${tab==='catalogue'?'btn-primary':'btn-secondary'}`}>Catalogue</button>
        <button onClick={() => setTab('attributions')} className={`btn ${tab==='attributions'?'btn-primary':'btn-secondary'}`}>Attributions</button>
      </div>
      {tab === 'catalogue' ? <CatalogueTab /> : <AttributionsTab />}
    </div>
  )
}
