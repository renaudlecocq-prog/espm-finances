import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FilterPill from '../components/ui/FilterPill'
import FicheEleve from '../components/ui/FicheEleve'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react'

const fmt = n => Number(n || 0).toFixed(2) + ' €'

const STATUT_ECH = {
  en_cours:     { label: 'En cours',      cls: 'bg-blue-100 text-blue-700'  },
  non_respecte: { label: 'Non respecté',  cls: 'bg-red-100 text-red-700'   },
  termine:      { label: 'Terminé',       cls: 'bg-green-100 text-green-700'},
}
const STATUT_OT = {
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700'  },
  valide:   { label: 'Validé',   cls: 'bg-green-100 text-green-700'},
  refuse:   { label: 'Refusé',   cls: 'bg-red-100 text-red-700'   },
  cloture:  { label: 'Clôturé',  cls: 'bg-gray-100 text-gray-600' },
}

function Badge({ val, map }) {
  const m = map[val] || { label: val, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5" />
  return sort.dir === 'asc'
    ? <ChevronUp   size={11} className="text-primary ml-0.5" />
    : <ChevronDown size={11} className="text-primary ml-0.5" />
}

// ── Échelonnements tab ─────────────────────────────────────────────────────
function TabEchelonnements({ isFinancier }) {
  const [rows, setRows]     = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ficheId, setFicheId]   = useState(null)
  const [search, setSearch]     = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [sort, setSort] = useState({ col: 'nom', dir: 'asc' })
  const [form, setForm] = useState({
    eleve_id: '', montant: '', nombre_echeances: 3,
    date_debut: new Date().toISOString().slice(0, 10),
    remarque: '', statut: 'en_cours',
  })
  const [saving, setSaving] = useState(false)

  const reload = () =>
    supabase.from('echelonnements')
      .select('*, eleve:eleve_id(nom,prenom,classe)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []))

  useEffect(() => {
    Promise.all([reload(),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom')
    ]).then(([, e]) => { setEleves(e.data || []); setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('echelonnements').insert(form)
    await reload(); setSaving(false); setShowForm(false)
  }

  const del = async (id) => {
    if (!confirm('Supprimer cet échelonnement ?')) return
    await supabase.from('echelonnements').delete().eq('id', id)
    await reload()
  }

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.eleve?.nom || '').toLowerCase().includes(q) || (r.eleve?.prenom || '').toLowerCase().includes(q))
    }
    if (filterStatut) d = d.filter(r => r.statut === filterStatut)
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      const va = col === 'nom' ? (a.eleve?.nom || '') : col === 'prenom' ? (a.eleve?.prenom || '') : col === 'classe' ? (a.eleve?.classe || '') : (a[col] ?? '')
      const vb = col === 'nom' ? (b.eleve?.nom || '') : col === 'prenom' ? (b.eleve?.prenom || '') : col === 'classe' ? (b.eleve?.classe || '') : (b[col] ?? '')
      if (col === 'montant') return (Number(a.montant) - Number(b.montant)) * (dir === 'asc' ? 1 : -1)
      return String(va).localeCompare(String(vb), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [rows, search, filterStatut, sort])

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  const TH = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-primary whitespace-nowrap"
      style={{ textAlign: right ? 'right' : 'left' }}>
      <span className={`flex items-center gap-0.5 ${right ? 'justify-end' : ''}`}>
        {label}<SortIcon col={col} sort={sort} />
      </span>
    </th>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-48 focus:border-primary transition-colors"
              placeholder="Rechercher par nom, prénom…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <FilterPill label="Statut" value={filterStatut}
            options={Object.entries(STATUT_ECH).map(([k, v]) => v.label)}
            onChange={v => setFilterStatut(Object.entries(STATUT_ECH).find(([, m]) => m.label === v)?.[0] || '')} />
          {(search || filterStatut) && (
            <button onClick={() => { setSearch(''); setFilterStatut('') }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap">
              <span className="text-sm leading-none">✕</span> Tout effacer
            </button>
          )}
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {isFinancier && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-1.5 px-4">
            + Échelonnement
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 mb-4 bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-3">Nouvel échelonnement</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id} onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
                <option value="">— Choisir —</option>
                {eleves.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.classe}</option>)}
              </select>
            </div>
            <div><label className="label">Montant total (€)</label>
              <input className="input" type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
            </div>
            <div><label className="label">Nb échéances</label>
              <input className="input" type="number" min="1" value={form.nombre_echeances} onChange={e => setForm(f => ({ ...f, nombre_echeances: e.target.value }))} />
            </div>
            <div><label className="label">Date début</label>
              <input className="input" type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div><label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                {Object.entries(STATUT_ECH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Remarque</label>
              <input className="input" value={form.remarque} onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving || !form.eleve_id} className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <TH col="nom" label="Nom" />
              <TH col="prenom" label="Prénom" />
              <TH col="classe" label="Classe" />
              <TH col="montant" label="Montant" right />
              <TH col="nombre_echeances" label="Nb échéances" />
              <TH col="date_debut" label="Date début" />
              <TH col="statut" label="Statut" />
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucun échelonnement</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => setFicheId(r.eleve_id)} className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer group">
                <td className="px-3 py-2 font-medium text-gray-800">{r.eleve?.nom}</td>
                <td className="px-3 py-2 text-gray-700">{r.eleve?.prenom}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.eleve?.classe}</td>
                <td className="px-3 py-2 text-right font-medium text-orange-500">{fmt(r.montant)}</td>
                <td className="px-3 py-2 text-center text-gray-600">{r.nombre_echeances}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.date_debut}</td>
                <td className="px-3 py-2"><Badge val={r.statut} map={STATUT_ECH} /></td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                    {isFinancier && <button onClick={() => del(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}

// ── Organismes tiers tab ───────────────────────────────────────────────────
function TabOrganismesTiers({ isFinancier }) {
  const [rows, setRows]     = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ficheId, setFicheId]   = useState(null)
  const [search, setSearch]     = useState('')
  const [filterStatut, setFilterStatut]     = useState('')
  const [filterOrganisme, setFilterOrganisme] = useState('')
  const [sort, setSort] = useState({ col: 'nom', dir: 'asc' })
  const [form, setForm] = useState({ eleve_id: '', organisme: 'CPAS', statut: 'en_cours', montant_accorde: '', remarque: '' })
  const [saving, setSaving] = useState(false)

  const reload = () =>
    supabase.from('organismes_tiers')
      .select('*, eleve:eleve_id(nom,prenom,classe)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []))

  useEffect(() => {
    Promise.all([reload(),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom')
    ]).then(([, e]) => { setEleves(e.data || []); setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('organismes_tiers').insert(form)
    await reload(); setSaving(false); setShowForm(false)
  }

  const del = async (id) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('organismes_tiers').delete().eq('id', id)
    await reload()
  }

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.eleve?.nom || '').toLowerCase().includes(q) || (r.eleve?.prenom || '').toLowerCase().includes(q))
    }
    if (filterStatut)    d = d.filter(r => r.statut === filterStatut)
    if (filterOrganisme) d = d.filter(r => r.organisme === filterOrganisme)
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      const va = col === 'nom' ? (a.eleve?.nom || '') : col === 'prenom' ? (a.eleve?.prenom || '') : col === 'classe' ? (a.eleve?.classe || '') : (a[col] ?? '')
      const vb = col === 'nom' ? (b.eleve?.nom || '') : col === 'prenom' ? (b.eleve?.prenom || '') : col === 'classe' ? (b.eleve?.classe || '') : (b[col] ?? '')
      return String(va).localeCompare(String(vb), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [rows, search, filterStatut, filterOrganisme, sort])

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  const TH = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-primary whitespace-nowrap text-left">
      <span className="flex items-center gap-0.5">{label}<SortIcon col={col} sort={sort} /></span>
    </th>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-48 focus:border-primary transition-colors"
              placeholder="Rechercher par nom, prénom…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <FilterPill label="Organisme" value={filterOrganisme} options={['CPAS','ULB','SPJ','Autre']} onChange={setFilterOrganisme} />
          <FilterPill label="Statut" value={filterStatut}
            options={Object.entries(STATUT_OT).map(([k, v]) => v.label)}
            onChange={v => setFilterStatut(Object.entries(STATUT_OT).find(([, m]) => m.label === v)?.[0] || '')} />
          {(search || filterStatut || filterOrganisme) && (
            <button onClick={() => { setSearch(''); setFilterStatut(''); setFilterOrganisme('') }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap">
              <span className="text-sm leading-none">✕</span> Tout effacer
            </button>
          )}
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {isFinancier && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-1.5 px-4">
            + Organisme
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5 mb-4 bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-3">Nouvel organisme tiers</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id} onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
                <option value="">— Choisir —</option>
                {eleves.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.classe}</option>)}
              </select>
            </div>
            <div><label className="label">Organisme</label>
              <select className="input" value={form.organisme} onChange={e => setForm(f => ({ ...f, organisme: e.target.value }))}>
                {['CPAS','ULB','SPJ','Autre'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                {Object.entries(STATUT_OT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className="label">Montant accordé (€)</label>
              <input className="input" type="number" value={form.montant_accorde} onChange={e => setForm(f => ({ ...f, montant_accorde: e.target.value }))} />
            </div>
            <div className="col-span-2"><label className="label">Remarque</label>
              <input className="input" value={form.remarque} onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving || !form.eleve_id} className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
          </div>
        </div>
      )}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <TH col="nom" label="Nom" />
              <TH col="prenom" label="Prénom" />
              <TH col="classe" label="Classe" />
              <TH col="organisme" label="Organisme" />
              <TH col="montant_accorde" label="Montant accordé" />
              <TH col="statut" label="Statut" />
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun organisme tiers</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => setFicheId(r.eleve_id)} className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer group">
                <td className="px-3 py-2 font-medium text-gray-800">{r.eleve?.nom}</td>
                <td className="px-3 py-2 text-gray-700">{r.eleve?.prenom}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.eleve?.classe}</td>
                <td className="px-3 py-2"><span className="font-semibold text-primary">{r.organisme}</span></td>
                <td className="px-3 py-2 text-gray-700">{r.montant_accorde ? Number(r.montant_accorde).toFixed(2)+' €' : '—'}</td>
                <td className="px-3 py-2"><Badge val={r.statut} map={STATUT_OT} /></td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                    {isFinancier && <button onClick={() => del(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AssistantSocial() {
  const { isFinancier, isMdp } = useAuth()
  const [tab, setTab] = useState('echelonnements')

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Assistant social</h1>
      <p className="text-sm text-gray-400 mb-5">Échelonnements et organismes tiers de prise en charge</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[['echelonnements','Échelonnements'],['organismes','Organismes tiers']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px border border-b-0 transition-colors
              ${tab === k ? 'bg-white border-gray-200 text-primary' : 'text-gray-500 border-transparent hover:text-primary'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'echelonnements' && <TabEchelonnements isFinancier={isFinancier || isMdp} />}
      {tab === 'organismes'     && <TabOrganismesTiers isFinancier={isFinancier || isMdp} />}
    </div>
  )
}
