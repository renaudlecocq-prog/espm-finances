import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, X, ChevronDown, Loader2 } from 'lucide-react'

const CATEGORIES = ['Frais obligatoires', 'Fournitures scolaires', 'Vêtements', 'Divers']
const fmt = n => Number(n || 0).toFixed(2) + ' €'

// Colonnes groupes — identique à Activites.jsx
const GROUP_COLS = [
  { key: 'rlmo',            label: 'RLMO' },
  { key: 'obs_d2',          label: 'OBS D2' },
  { key: 'ac_d2',           label: 'AC D2' },
  { key: 'math_d3',         label: 'Math D3' },
  { key: 'sciences_d3',     label: 'Sciences D3' },
  { key: 'bio_physique_d3', label: 'Bio/Physique' },
  { key: 'obs1_d3',         label: 'OBS 1 D3' },
  { key: 'obs2_d3',         label: 'OBS 2 D3' },
  { key: 'ac_d3',           label: 'AC D3' },
]
const getRlmo = e => [e.philosophie, e.groupe_choix_philo].filter(Boolean).join(' ') || null

// ── Calcul nb élèves (même logique qu'Activites) ────────────────────────────
const ALL_CLASSES_VALUE = '__ALL__'

function calcNbEleves(allEleves, { classes_incluses, groupes_inclus, classes_exclues, groupes_exclus, eleves_exclus }) {
  if (!allEleves.length) return 0
  const allClassesMode = classes_incluses.includes('__ALL__')
  const effectiveAddC = allClassesMode ? allEleves.map(e => e.classe).filter(Boolean) : classes_incluses
  const hasAddC = effectiveAddC.length > 0 || allClassesMode
  const hasAddG = groupes_inclus.length > 0
  if (!hasAddC && !hasAddG) return 0

  const matchesGroups = (e, keys) => keys.some(key => {
    const [col, val] = key.split(':')
    return (col === 'rlmo' ? getRlmo(e) : e[col]) === val
  })

  let addSet = new Set()
  if (hasAddC && hasAddG) {
    const inC = new Set(allEleves.filter(e => allClassesMode || effectiveAddC.includes(e.classe)).map(e => e.id))
    allEleves.filter(e => inC.has(e.id) && matchesGroups(e, groupes_inclus)).forEach(e => addSet.add(e.id))
  } else if (hasAddC) {
    allEleves.filter(e => allClassesMode || effectiveAddC.includes(e.classe)).forEach(e => addSet.add(e.id))
  } else {
    allEleves.filter(e => matchesGroups(e, groupes_inclus)).forEach(e => addSet.add(e.id))
  }

  const removeSet = new Set()
  allEleves.filter(e => classes_exclues.includes(e.classe)).forEach(e => removeSet.add(e.id))
  if (groupes_exclus.length > 0) allEleves.filter(e => matchesGroups(e, groupes_exclus)).forEach(e => removeSet.add(e.id))
  ;(eleves_exclus || []).forEach(id => removeSet.add(id))

  let count = 0
  addSet.forEach(id => !removeSet.has(id) && count++)
  return count
}

// ── MultiSearchSelect ───────────────────────────────────────────────────────
function MultiSearchSelect({ options, value, onChange, placeholder, single = false }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const getVal = o => typeof o === 'string' ? o : o.value
  const getLbl = o => typeof o === 'string' ? o : o.label

  const filtered = useMemo(() =>
    options.filter(o => getLbl(o).toLowerCase().includes(q.toLowerCase())), [options, q])

  const isSelected = v => single ? value === v : (Array.isArray(value) && value.includes(v))

  const toggle = v => {
    if (single) { onChange(value === v ? null : v); setOpen(false) }
    else {
      const arr = Array.isArray(value) ? value : []
      onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
    }
  }

  const selectedOptions = options.filter(o => isSelected(getVal(o)))

  return (
    <div ref={ref} className="relative">
      <div className="input cursor-pointer flex flex-wrap gap-1 items-center min-h-[38px]"
        onClick={() => setOpen(o => !o)}>
        {selectedOptions.length === 0 && <span className="text-gray-400 text-sm">{placeholder}</span>}
        {single && selectedOptions.length > 0 && <span className="text-gray-700 text-sm">{getLbl(selectedOptions[0])}</span>}
        {!single && selectedOptions.map(o => (
          <span key={getVal(o)} className="flex items-center gap-1 bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
            {getLbl(o)}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(getVal(o)) }} className="hover:text-red-500">×</button>
          </span>
        ))}
        <ChevronDown size={14} className="ml-auto text-gray-400 shrink-0" />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus className="w-full pl-6 pr-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)}
                onClick={e => e.stopPropagation()} />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>}
            {filtered.map(o => {
              const v = getVal(o); const l = getLbl(o); const sel = isSelected(v)
              return (
                <button key={v} type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${sel ? 'text-primary font-medium' : 'text-gray-700'}`}
                  onClick={() => toggle(v)}>
                  {single
                    ? <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${sel ? 'border-primary' : 'border-gray-300'}`}>
                        {sel && <span className="w-2 h-2 rounded-full bg-primary block" />}
                      </span>
                    : <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                        {sel && <span className="text-white text-xs leading-none">✓</span>}
                      </span>
                  }
                  {l}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section sélection classes + groupes ────────────────────────────────────
function SelectionEleves({ badge, classes, setClasses, groupes, setGroupes, allClasses, groupOptions }) {
  const classOptions = [
    { value: ALL_CLASSES_VALUE, label: '— Toutes les classes —' },
    ...allClasses.map(c => ({ value: c, label: c })),
  ]

  const handleClassChange = vals => {
    if (vals.includes(ALL_CLASSES_VALUE)) {
      // Si "Toutes" vient d'être sélectionné, on remplace tout par la valeur spéciale
      if (!classes.includes(ALL_CLASSES_VALUE)) {
        setClasses([ALL_CLASSES_VALUE])
      } else {
        // On retire "Toutes" si l'utilisateur sélectionne une classe spécifique en plus
        setClasses(vals.filter(v => v !== ALL_CLASSES_VALUE))
      }
    } else {
      setClasses(vals)
    }
  }

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${badge === 'add' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
        {badge === 'add' ? '+ Ajouter élèves de' : '− Retirer élèves de'}
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Classes</label>
          <MultiSearchSelect options={classOptions} value={classes} onChange={handleClassChange} placeholder="Choisir des classes…" />
        </div>
        <div>
          <label className="label">Groupes</label>
          <MultiSearchSelect options={groupOptions} value={groupes} onChange={setGroupes} placeholder="Choisir des groupes…" />
        </div>
      </div>
    </div>
  )
}

// ── Modal Article ─────────────────────────────────────────────────────────
function ArticleModal({ editRow, onClose, onSaved }) {
  const [form, setForm] = useState(editRow
    ? { ...editRow }
    : { nom: '', description: '', categorie: 'Frais obligatoires', prix_unitaire: '', statut: 'actif' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.nom.trim()) { setError('Le nom est requis'); return }
    setSaving(true); setError(null)
    const payload = { ...form, prix_unitaire: form.prix_unitaire || 0 }
    const { error: err } = editRow
      ? await supabase.from('articles').update(payload).eq('id', editRow.id)
      : await supabase.from('articles').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">{editRow ? 'Modifier' : 'Nouvel'} article</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={form.nom} onChange={e => f('nom', e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.categorie} onChange={e => f('categorie', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prix unitaire (€)</label>
              <input className="input" type="number" step="0.01" value={form.prix_unitaire} onChange={e => f('prix_unitaire', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description || ''} onChange={e => f('description', e.target.value)} />
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={e => f('statut', e.target.value)}>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-5 text-sm disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Attribution ─────────────────────────────────────────────────────
function AttributionModal({ articles, allEleves, allClasses, groupOptions, eleveOptions, editRow, onClose, onSaved }) {
  const EMPTY = {
    article_id: '', type_attribution: 'groupe',
    classes_incluses: [], groupes_inclus: [],
    classes_exclues: [], groupes_exclus: [],
    eleves_exclus: [], eleve_id: null,
    quantite: 1, prix_unitaire_applique: '', notes: '',
  }
  const [form, setForm] = useState(editRow
    ? { ...EMPTY, ...editRow,
        article_id: editRow.article_id || '',
        classes_incluses: editRow.classes_incluses || [],
        groupes_inclus: editRow.groupes_inclus || [],
        classes_exclues: editRow.classes_exclues || [],
        groupes_exclus: editRow.groupes_exclus || [],
        eleves_exclus: editRow.eleves_exclus || [],
        prix_unitaire_applique: editRow.prix_unitaire_applique || '',
      }
    : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const selectedArticle = articles.find(a => a.id === form.article_id)
  const hasSelection = form.classes_incluses.length > 0 || form.groupes_inclus.length > 0
  const nbEleves = useMemo(() =>
    form.type_attribution === 'individuel' ? (form.eleve_id ? 1 : 0)
    : calcNbEleves(allEleves, form),
    [allEleves, form.type_attribution, form.eleve_id,
     form.classes_incluses, form.groupes_inclus, form.classes_exclues, form.groupes_exclus, form.eleves_exclus]
  )

  const prixApplique = form.prix_unitaire_applique || selectedArticle?.prix_unitaire || 0
  const montantTotal = nbEleves * Number(prixApplique) * Number(form.quantite || 1)

  const save = async () => {
    if (!form.article_id) { setError('Choisir un article'); return }
    if (form.type_attribution === 'individuel' && !form.eleve_id) { setError('Choisir un élève'); return }
    if (form.type_attribution === 'groupe' && !hasSelection) { setError('Sélectionner au moins une classe ou un groupe'); return }
    setSaving(true); setError(null)
    // Exclure les jointures Supabase (article, eleve) du payload DB
    const DB_COLS = ['id','article_id','type_attribution','classes_incluses','groupes_inclus',
      'classes_exclues','groupes_exclus','eleves_exclus','eleve_id','quantite',
      'prix_unitaire_applique','notes','nb_eleves','date_attribution','statut_facturation',
      'created_by','created_at']
    const payload = Object.fromEntries(
      Object.entries({
        ...form,
        nb_eleves: nbEleves,
        date_attribution: editRow?.date_attribution || new Date().toISOString().slice(0, 10),
        statut_facturation: editRow?.statut_facturation || 'a_facturer',
      })
      .filter(([k]) => DB_COLS.includes(k))
      .map(([k, v]) => [k, v === '' ? null : v])
    )
    const { error: err } = editRow
      ? await supabase.from('article_attributions').update(payload).eq('id', editRow.id)
      : await supabase.from('article_attributions').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  // Article options triés par ordre CATEGORIES puis par nom
  const articleOptions = [...articles]
    .sort((a, b) => {
      const ci = CATEGORIES.indexOf(a.categorie)
      const cj = CATEGORIES.indexOf(b.categorie)
      if (ci !== cj) return ci - cj
      return a.nom.localeCompare(b.nom)
    })
    .map(a => ({
      value: a.id,
      label: `${a.nom} — ${a.categorie} (${fmt(a.prix_unitaire)})`,
    }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-bold text-gray-800 text-lg">{editRow ? "Modifier l'attribution" : 'Nouvelle attribution'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Article */}
          <div>
            <label className="label">Article *</label>
            <MultiSearchSelect options={articleOptions} value={form.article_id}
              onChange={v => { f('article_id', v); if (v) { const a = articles.find(x => x.id === v); if (a) f('prix_unitaire_applique', '') } }}
              placeholder="Rechercher un article…" single />
          </div>

          {/* Type */}
          <div>
            <label className="label">Mode d'attribution</label>
            <div className="flex gap-3">
              {[['groupe', 'Par classes / groupes'], ['individuel', 'Élève individuel']].map(([v, l]) => (
                <button key={v} type="button"
                  onClick={() => f('type_attribution', v)}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-medium transition-colors
                    ${form.type_attribution === v ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Sélection groupe */}
          {form.type_attribution === 'groupe' && (
            <div className="space-y-3">
              <SelectionEleves badge="add"
                classes={form.classes_incluses} setClasses={v => f('classes_incluses', v)}
                groupes={form.groupes_inclus}   setGroupes={v => f('groupes_inclus', v)}
                allClasses={allClasses} groupOptions={groupOptions} />
              <SelectionEleves badge="remove"
                classes={form.classes_exclues} setClasses={v => f('classes_exclues', v)}
                groupes={form.groupes_exclus}  setGroupes={v => f('groupes_exclus', v)}
                allClasses={allClasses} groupOptions={groupOptions} />
              {/* Exclure des élèves spécifiques */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  − Retirer spécifiquement
                </span>
                <div className="mt-3">
                  <label className="label">Élèves à exclure</label>
                  <MultiSearchSelect options={eleveOptions} value={form.eleves_exclus}
                    onChange={v => f('eleves_exclus', v)}
                    placeholder="Rechercher des élèves à exclure…" />
                </div>
              </div>
            </div>
          )}

          {/* Sélection individuelle */}
          {form.type_attribution === 'individuel' && (
            <div>
              <label className="label">Élève *</label>
              <MultiSearchSelect options={eleveOptions} value={form.eleve_id}
                onChange={v => f('eleve_id', v)}
                placeholder="Rechercher un élève…" single />
            </div>
          )}

          {/* Nb élèves calculé */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-500">Élèves concernés :</span>
            <span className={`font-bold text-lg ${nbEleves > 0 ? 'text-primary' : 'text-gray-300'}`}>{nbEleves}</span>
          </div>

          {/* Quantité + prix */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Quantité / élève</label>
              <input className="input" type="number" min="1" value={form.quantite}
                onChange={e => f('quantite', e.target.value)} />
            </div>
            <div>
              <label className="label">
                Prix appliqué (€)
                {selectedArticle && <span className="ml-1 text-gray-400 font-normal">— article : {fmt(selectedArticle.prix_unitaire)}</span>}
              </label>
              <input className="input" type="number" step="0.01" value={form.prix_unitaire_applique}
                placeholder={selectedArticle ? String(selectedArticle.prix_unitaire) : '0'}
                onChange={e => f('prix_unitaire_applique', e.target.value)} />
            </div>
            <div>
              <label className="label">Montant total estimé</label>
              <div className="input bg-gray-50 text-gray-700 font-semibold">{nbEleves > 0 ? fmt(montantTotal) : '—'}</div>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => f('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-5 text-sm disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ── Onglet Attributions ─────────────────────────────────────────────────────
function AttributionsTab({ articles, allEleves, allClasses, groupOptions, eleveOptions, isFinancier }) {
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow]     = useState(null)
  const [search, setSearch]       = useState('')

  const reload = useCallback(() =>
    supabase.from('article_attributions')
      .select('*, article:article_id(nom, categorie, prix_unitaire), eleve:eleve_id(nom, prenom, classe)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setData(data || []); setLoading(false) })
  , [])

  useEffect(() => { reload() }, [reload])

  const openNew  = () => { setEditRow(null); setShowModal(true) }
  const openEdit = r => { setEditRow(r); setShowModal(true) }
  const deleteAttribution = async r => {
    if (!confirm('Supprimer cette attribution ? Cette action est irréversible.')) return
    await supabase.from('article_attributions').delete().eq('id', r.id)
    reload()
  }

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(r =>
      (r.article?.nom || '').toLowerCase().includes(q) ||
      (r.article?.categorie || '').toLowerCase().includes(q) ||
      (r.eleve ? `${r.eleve.nom} ${r.eleve.prenom}`.toLowerCase().includes(q) : false) ||
      (r.notes || '').toLowerCase().includes(q)
    )
  }, [data, search])

  const getAttributionLabel = r => {
    if (r.type_attribution === 'individuel' && r.eleve)
      return `${r.eleve.nom} ${r.eleve.prenom} (${r.eleve.classe})`
    if (r.classes_incluses?.includes('__ALL__')) return 'Tous les élèves'
    const parts = []
    if (r.classes_incluses?.length) parts.push(r.classes_incluses.join(', '))
    if (r.groupes_inclus?.length) parts.push(r.groupes_inclus.map(g => g.split(':')[1]).join(', '))
    return parts.join(' + ') || (r.classes?.join(', ') || '—')
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {isFinancier && (
          <button onClick={openNew} className="btn-primary text-sm py-1.5 px-4">+ Attribution</button>
        )}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-56 focus:border-primary transition-colors"
            placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search && (
          <button onClick={() => setSearch('')}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-full px-2.5 py-1">
            <span className="text-sm leading-none">✕</span> Tout effacer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} attribution{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div style={{ height: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr>
                {['Article', 'Catégorie', 'Attribution', 'Nb élèves', 'Qté', 'Prix / élève', 'Total', 'Statut', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Aucune attribution</td></tr>
              )}
              {filtered.map(r => {
                const prix = r.prix_unitaire_applique ?? r.article?.prix_unitaire ?? 0
                const total = (r.nb_eleves || 0) * Number(prix) * (r.quantite || 1)
                return (
                  <tr key={r.id} className="border-b border-gray-200 odd:bg-white even:bg-gray-50/60 hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.article?.nom || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.article?.categorie || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={getAttributionLabel(r)}>{getAttributionLabel(r)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-primary">{r.nb_eleves ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.quantite || 1}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(prix)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.nb_eleves ? fmt(total) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${r.statut_facturation === 'facture' ? 'bg-green-100 text-green-700' : r.statut_facturation === 'partiellement_facture' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.statut_facturation === 'facture' ? 'Facturé' : r.statut_facturation === 'partiellement_facture' ? 'Partiel' : 'À facturer'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isFinancier && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(r)} disabled={r.statut_facturation === 'facture'}
                            title="Modifier"
                            className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => deleteAttribution(r)} disabled={r.statut_facturation === 'facture'}
                            title="Supprimer"
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AttributionModal
          articles={articles} allEleves={allEleves}
          allClasses={allClasses} groupOptions={groupOptions} eleveOptions={eleveOptions}
          editRow={editRow}
          onClose={() => setShowModal(false)} onSaved={reload}
        />
      )}
    </div>
  )
}

// ── Onglet Catalogue ────────────────────────────────────────────────────────
function CatalogueTab({ isFinancier }) {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow]   = useState(null)
  const [search, setSearch]     = useState('')

  const reload = useCallback(() =>
    supabase.from('articles').select('*').order('categorie').order('nom')
      .then(({ data }) => { setData(data || []); setLoading(false) })
  , [])

  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(r =>
      (r.nom || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.categorie || '').toLowerCase().includes(q)
    )
  }, [data, search])

  const byCategorie = CATEGORIES.map(cat => ({
    cat,
    items: filtered.filter(d => d.categorie === cat),
  })).filter(g => g.items.length > 0)

  const openEdit = row => { setEditRow(row); setShowModal(true) }
  const openNew  = () => { setEditRow(null); setShowModal(true) }
  const deleteArticle = async a => {
    if (!confirm(`Supprimer « ${a.nom} » ? Cette action est irréversible.`)) return
    await supabase.from('articles').delete().eq('id', a.id)
    reload()
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {isFinancier && (
          <button onClick={openNew} className="btn-primary text-sm py-1.5 px-4">+ Article</button>
        )}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-56 focus:border-primary transition-colors"
            placeholder="Rechercher par nom, catégorie…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search && (
          <button onClick={() => setSearch('')}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-full px-2.5 py-1">
            <span className="text-sm leading-none">✕</span> Tout effacer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 && (
        <div className="card p-8 text-center text-gray-400">Aucun article trouvé</div>
      )}

      {filtered.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{width:'30%'}} />
              <col style={{width:'30%'}} />
              <col style={{width:'12%'}} />
              <col style={{width:'12%'}} />
              <col style={{width:'16%'}} />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {['Nom', 'Description', 'Prix unit.', 'Statut', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byCategorie.map(({ cat, items }) => (
                <>
                  <tr key={`cat-${cat}`}>
                    <td colSpan={5} className="px-4 pt-4 pb-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cat}</span>
                    </td>
                  </tr>
                  {items.map((a, idx) => (
                    <tr key={a.id} className={`border-b border-gray-200 transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-800 truncate">{a.nom}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs truncate">{a.description || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-mono">{fmt(a.prix_unitaire)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.statut === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {a.statut}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isFinancier && (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(a)}
                              className="text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary rounded-full px-3 py-1 transition-colors">
                              Modifier
                            </button>
                            <button onClick={() => deleteArticle(a)}
                              className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-3 py-1 transition-colors">
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ArticleModal editRow={editRow} onClose={() => setShowModal(false)} onSaved={reload} />
      )}
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function Articles() {
  const { isFinancier, isAdmin } = useAuth()
  const fin = isFinancier || isAdmin
  const [tab, setTab] = useState('attributions')
  const [searchParams] = useSearchParams()

  // Données partagées entre les onglets
  const [articles, setArticles]       = useState([])
  const [allEleves, setAllEleves]     = useState([])
  const [allClasses, setAllClasses]   = useState([])
  const [groupOptions, setGroupOptions] = useState([])
  const [eleveOptions, setEleveOptions] = useState([])

  useEffect(() => {
    if (searchParams.get('onglet') === 'catalogue') setTab('catalogue')
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      supabase.from('articles').select('id, nom, categorie, prix_unitaire').eq('statut', 'actif').order('categorie').order('nom'),
      supabase.from('eleves').select(
        'id, nom, prenom, classe, obs_d2, ac_d2, math_d3, sciences_d3, bio_physique_d3, obs1_d3, obs2_d3, ac_d3, philosophie, groupe_choix_philo'
      ).eq('actif', true).order('nom'),
    ]).then(([artRes, elevRes]) => {
      setArticles(artRes.data || [])
      const eleves = (elevRes.data || []).map(e => ({ ...e, rlmo: getRlmo(e) }))
      setAllEleves(eleves)
      setAllClasses([...new Set(eleves.map(e => e.classe).filter(Boolean))].sort())
      setEleveOptions(eleves.map(e => ({
        value: e.id,
        label: `${e.nom} ${e.prenom} (${e.classe})`,
      })))
      const opts = []
      GROUP_COLS.forEach(({ key, label }) => {
        const vals = [...new Set(eleves.map(e => e[key]).filter(Boolean))].sort()
        vals.forEach(val => opts.push({ value: `${key}:${val}`, label: `${label} : ${val}` }))
      })
      setGroupOptions(opts)
    })
  }, [])

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Articles</h1>
      <p className="text-sm text-gray-400 mb-5">Catalogue et attributions aux élèves</p>

      {/* Onglets — Attributions en premier */}
      <div className="flex gap-2 mb-6">
        {[['attributions', 'Attributions'], ['catalogue', 'Catalogue']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === v ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'attributions'
        ? <AttributionsTab articles={articles} allEleves={allEleves} allClasses={allClasses}
            groupOptions={groupOptions} eleveOptions={eleveOptions} isFinancier={fin} />
        : <CatalogueTab isFinancier={fin} />
      }
    </div>
  )
}
