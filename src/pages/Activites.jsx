import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Commentaires from '../components/ui/Commentaires'
import { useAuth } from '../context/AuthContext'
import { Search, X, FileText, Receipt, ChevronDown, Plus, Loader2, Trash2, CheckCheck, ChevronLeft } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useIsMobile } from '../hooks/useIsMobile'

const fmt = n => Number(n || 0).toFixed(2) + ' €'
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_COLORS = {
  brouillon: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  publie:    'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  archive:   'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
}
const FACT_COLORS = {
  en_attente: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
  a_facturer: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  facture:              'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  partiellement_facture: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  non_payant:           'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}
const FACT_LABELS = {
  en_attente: 'En attente',
  a_facturer: 'À facturer',
  facture:              'Facturé',
  partiellement_facture: 'Partiel',
  non_payant:           'Non payant',
}
const TYPE_LABELS = { extramuros: 'Extramuros', intramuros: 'Intramuros', voyage: 'Voyage' }

const TRANSPORT_OPTIONS = [
  { value: 'stib',        label: 'STIB' },
  { value: 'sncb',        label: 'SNCB' },
  { value: 'de_lijn',     label: 'De Lijn' },
  { value: 'tec',         label: 'TEC' },
  { value: 'flixbus',     label: 'Flixbus' },
  { value: 'societe_car', label: 'Société de car' },
  { value: 'a_pied',      label: 'À pied' },
  { value: 'autre',       label: 'Autre' },
]
const TRANSPORT_KNOWN = TRANSPORT_OPTIONS.map(o => o.value)

const VOYAGE_TIERS = [
  { value: '150', label: 'D1 — 150 €' },
  { value: '350', label: 'D2 — 350 €' },
  { value: '550', label: 'D3 — 550 €' },
]
const TRANSPORT_LEGACY = { bus_scolaire: 'societe_car', train: 'sncb' }

const parseTransport = str => {
  if (!str) return { list: [], autre: '' }
  const parts = str.split(',').map(s => s.trim()).filter(Boolean)
  const list = []; let autre = ''
  for (const p of parts) {
    if (p.startsWith('autre:')) { list.push('autre'); autre = p.slice(6) }
    else if (TRANSPORT_KNOWN.includes(p)) list.push(p)
    else if (TRANSPORT_LEGACY[p]) list.push(TRANSPORT_LEGACY[p])
    else { list.push('autre'); autre = p }
  }
  return { list: [...new Set(list)], autre }
}

// Colonnes de groupes — synchronisé avec Groupes.jsx
const DEPENSES_CATEGORIES = [
  { value: 'activite',    label: 'Activité' },
  { value: 'hebergement', label: 'Hébergement' },
  { value: 'nourriture',  label: 'Nourriture' },
  { value: 'transport',   label: 'Transport' },
  { value: 'urgences',    label: 'Urgences' },
  { value: 'autres',      label: 'Autres' },
]

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
// Calcule la valeur RLMO exactement comme Groupes.jsx
const getRlmo = e => [e.philosophie, e.groupe_choix_philo].filter(Boolean).join(' ') || null

const EMPTY = {
  intitule: '', description: '', type: 'extramuros',
  date_debut: '', date_fin: '',
  lieu: '', heure_depart: '', heure_retour: '',
  lieu_rdv: '', lieu_retour: '', type_transport: '', type_transport_list: [], transport_autre_texte: '', heure_depart_retour: '', tel_organisateur: '', tel_sejour: '',
  local: '', heure_debut: '', heure_fin: '',
  montant_total: '', pop: '', montant_par_eleve_annonce: '', informations_supplementaires: '',
  statut: 'brouillon', statut_facturation: 'en_attente',
  gare_depart: '', gare_arrivee: '', pmr: '', ligne_tec: '',
  responsable_id: null,
  accompagnateur_ids: [],
  eleves_exclus: [],
  classes_incluses: [],
  groupes_inclus: [],   // text[] format "col:valeur"
  classes_exclues: [],
  groupes_exclus: [],   // text[] format "col:valeur"
  acomptes_config: [],
}

function validate(form) {
  const miss = ['intitule', 'type', 'date_debut'].filter(k => !form[k])
  if (form.type === 'extramuros' || form.type === 'voyage') {
    if (!form.lieu) miss.push('lieu')
    if (!form.heure_depart) miss.push('heure_depart')
    if (!form.heure_retour) miss.push('heure_retour')
    if (!form.lieu_rdv) miss.push('lieu_rdv')
    if (!form.type_transport_list?.length) miss.push('type_transport')
    if (!form.tel_organisateur) miss.push('tel_organisateur')
  }
  if (form.type === 'extramuros' && !form.lieu_retour) miss.push('lieu_retour')
  if (form.type === 'voyage' && !form.date_fin) miss.push('date_fin')
  if (form.type === 'intramuros') {
    if (!form.local) miss.push('local')
    if (!form.heure_debut) miss.push('heure_debut')
    if (!form.heure_fin) miss.push('heure_fin')
  }
  return miss
}

// ── Multi-select avec recherche ────────────────────────────────────────────
function MultiSearchSelect({ options, value, onChange, placeholder, single = false }) {
  // options: [{ value, label }]  — ou string[]
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
    options.filter(o => getLbl(o).toLowerCase().includes(q.toLowerCase())),
    [options, q]
  )

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
    <div ref={ref} className="relative w-full min-w-0">
      <div className="input cursor-pointer flex flex-wrap gap-1 items-center min-h-[38px]"
        onClick={() => setOpen(o => !o)}>
        {selectedOptions.length === 0 && <span className="text-gray-400 dark:text-gray-500 text-sm">{placeholder}</span>}
        {single && selectedOptions.length > 0 && <span className="text-gray-700 dark:text-gray-200 text-sm">{getLbl(selectedOptions[0])}</span>}
        {!single && selectedOptions.map(o => (
          <span key={getVal(o)} className="flex items-center gap-1 bg-primary/10 dark:bg-accent/20 text-primary dark:text-accent text-xs rounded-full px-2 py-0.5">
            {getLbl(o)}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(getVal(o)) }} className="hover:text-red-500">×</button>
          </span>
        ))}
        <ChevronDown size={14} className="ml-auto text-gray-400 dark:text-gray-500 shrink-0" />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-50 max-h-60 flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input autoFocus
                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary"
                placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)}
                onClick={e => e.stopPropagation()} />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">Aucun résultat</p>}
            {filtered.map(o => {
              const v = getVal(o); const l = getLbl(o); const sel = isSelected(v)
              return (
                <button key={v} type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 ${sel ? 'text-primary font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                  onClick={() => toggle(v)}>
                  {/* Radio pour single, checkbox pour multi */}
                  {single
                    ? <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${sel ? 'border-primary' : 'border-gray-300 dark:border-gray-500'}`}>
                        {sel && <span className="w-2 h-2 rounded-full bg-primary block" />}
                      </span>
                    : <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-500'}`}>
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
  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${badge === 'add' ? 'border-green-200 dark:border-green-800 bg-green-50/30' : 'border-red-200 dark:border-red-800 bg-red-50/30'}`}>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge === 'add' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'}`}>
        {badge === 'add' ? '+ Ajouter élèves de' : '− Retirer élèves de'}
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Classes</label>
          <MultiSearchSelect options={allClasses} value={classes} onChange={setClasses} placeholder="Choisir des classes…" />
        </div>
        <div>
          <label className="label">Groupes</label>
          <MultiSearchSelect options={groupOptions} value={groupes} onChange={setGroupes} placeholder="Choisir des groupes…" />
        </div>
      </div>
    </div>
  )
}

// ── Calcul nb élèves ────────────────────────────────────────────────────────
function calcNbEleves(allEleves, form) {
  const { classes_incluses, groupes_inclus, classes_exclues, groupes_exclus, eleves_exclus } = form
  if (!allEleves.length) return 0
  const hasAddC = classes_incluses.length > 0
  const hasAddG = groupes_inclus.length > 0
  if (!hasAddC && !hasAddG) return 0

  const matchesGroups = (eleve, groupKeys) =>
    groupKeys.some(key => {
      const [col, val] = key.split(':')
      const eleveVal = col === 'rlmo' ? getRlmo(eleve) : eleve[col]
      return eleveVal === val
    })

  // Build add set
  let addSet = new Set()
  if (hasAddC && hasAddG) {
    // Intersection : élèves dans les classes ET dans les groupes
    const inC = new Set(allEleves.filter(e => classes_incluses.includes(e.classe)).map(e => e.id))
    allEleves.filter(e => inC.has(e.id) && matchesGroups(e, groupes_inclus)).forEach(e => addSet.add(e.id))
  } else if (hasAddC) {
    allEleves.filter(e => classes_incluses.includes(e.classe)).forEach(e => addSet.add(e.id))
  } else {
    allEleves.filter(e => matchesGroups(e, groupes_inclus)).forEach(e => addSet.add(e.id))
  }

  // Build remove set (union)
  const removeSet = new Set()
  allEleves.filter(e => classes_exclues.includes(e.classe)).forEach(e => removeSet.add(e.id))
  if (groupes_exclus.length > 0) allEleves.filter(e => matchesGroups(e, groupes_exclus)).forEach(e => removeSet.add(e.id))
  ;(eleves_exclus || []).forEach(id => removeSet.add(id))

  let count = 0
  addSet.forEach(id => !removeSet.has(id) && count++)
  return count
}

function getParticipantEleves(allEleves, form) {
  const { classes_incluses, groupes_inclus, classes_exclues, groupes_exclus, eleves_exclus } = form
  if (!allEleves.length) return []
  const hasAddC = classes_incluses.length > 0
  const hasAddG = groupes_inclus.length > 0
  if (!hasAddC && !hasAddG) return []

  const matchesGroups = (eleve, groupKeys) =>
    groupKeys.some(key => {
      const [col, val] = key.split(':')
      const eleveVal = col === 'rlmo' ? getRlmo(eleve) : eleve[col]
      return eleveVal === val
    })

  let addSet = new Set()
  if (hasAddC && hasAddG) {
    const inC = new Set(allEleves.filter(e => classes_incluses.includes(e.classe)).map(e => e.id))
    allEleves.filter(e => inC.has(e.id) && matchesGroups(e, groupes_inclus)).forEach(e => addSet.add(e.id))
  } else if (hasAddC) {
    allEleves.filter(e => classes_incluses.includes(e.classe)).forEach(e => addSet.add(e.id))
  } else {
    allEleves.filter(e => matchesGroups(e, groupes_inclus)).forEach(e => addSet.add(e.id))
  }
  const removeSet = new Set()
  allEleves.filter(e => classes_exclues.includes(e.classe)).forEach(e => removeSet.add(e.id))
  if (groupes_exclus.length > 0) allEleves.filter(e => matchesGroups(e, groupes_exclus)).forEach(e => removeSet.add(e.id))
  ;(eleves_exclus || []).forEach(id => removeSet.add(id))

  return allEleves
    .filter(e => addSet.has(e.id) && !removeSet.has(e.id))
    .map(e => ({ value: e.id, label: `${e.nom || ''} ${e.prenom || ''} (${e.classe || ''})`.trim(), id: e.id, matricule: e.matricule, nom: e.nom, prenom: e.prenom, classe: e.classe }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// ── Staged file upload avec drag & drop ────────────────────────────────────
function AvisGenerator({ activiteId, intitule, isVoyage = false, montantParEleve }) {
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session?.access_token) { alert('Session expirée, veuillez vous reconnecter.'); setLoading(false); return }
      let url = `/.netlify/functions/activite-avis-pdf?id=${encodeURIComponent(activiteId)}`
      if (isVoyage) url += '&mode=voyage'
      if (montantParEleve) url += `&mpe=${encodeURIComponent(montantParEleve)}`
      const resp = await fetch(url,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
      const body = await resp.text()
      if (!resp.ok) { alert(`Erreur ${resp.status}: ${body}`); setLoading(false); return }
      const blob = new Blob([body], { type: 'text/html; charset=utf-8' })
      const win = window.open(URL.createObjectURL(blob), '_blank')
      if (!win) alert("Le navigateur a bloqué l'ouverture du PDF. Autorisez les popups pour ce site.")
    } catch(e) {
      console.error('[AvisGenerator]', e)
      alert('Erreur : ' + (e?.message || String(e)))
    }
    finally { setLoading(false) }
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800 border border-orange-200 hover:border-orange-400 bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
        {loading ? <Loader2 size={12} className="animate-spin" /> : '📄'}
        {loading ? 'Génération…' : "Générer l'avis"}
      </button>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 leading-tight">
        Ouvre un PDF imprimable à destination des parents.
      </p>
    </div>
  )
}

function AvanceGenerator({ activiteId, depenses, intitule }) {
  const [loading, setLoading] = useState(false)
  const avanceDeps = depenses.filter(d => d.avance)

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session?.access_token) { alert('Session expirée.'); setLoading(false); return }
      const resp = await fetch(
        `/.netlify/functions/activite-avance-pdf?id=${encodeURIComponent(activiteId)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
      const body = await resp.text()
      if (!resp.ok) { alert(`Erreur ${resp.status}: ${body}`); setLoading(false); return }
      const blob = new Blob([body], { type: 'text/html; charset=utf-8' })
      const win = window.open(URL.createObjectURL(blob), '_blank')
      if (!win) alert("Le navigateur a bloqué l'ouverture. Autorisez les popups.")
    } catch(e) { alert('Erreur : ' + (e?.message || String(e))) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <button type="button" onClick={generate} disabled={loading || avanceDeps.length === 0}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-40">
        {loading ? <Loader2 size={12} className="animate-spin" /> : '💳'}
        {loading ? 'Génération…' : "Demande d'avance"}
      </button>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 leading-tight">
        {avanceDeps.length === 0 ? 'Aucune dépense marquée "Avance".' : `${avanceDeps.length} dépense(s) cochée(s).`}
      </p>
    </div>
  )
}

function RapportVoyageGenerator({ activiteId }) {
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!session?.access_token) { alert('Session expirée.'); setLoading(false); return }
      const resp = await fetch(
        `/.netlify/functions/activite-voyage-rapport-pdf?id=${encodeURIComponent(activiteId)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
      const body = await resp.text()
      if (!resp.ok) { alert(`Erreur ${resp.status}: ${body}`); setLoading(false); return }
      const blob = new Blob([body], { type: 'text/html; charset=utf-8' })
      const win = window.open(URL.createObjectURL(blob), '_blank')
      if (!win) alert("Le navigateur a bloqué l'ouverture. Autorisez les popups.")
    } catch(e) { alert('Erreur : ' + (e?.message || String(e))) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <button type="button" onClick={generate} disabled={loading}
        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-400 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
        {loading ? <Loader2 size={12} className="animate-spin" /> : '📊'}
        {loading ? 'Génération…' : 'Générer rapport'}
      </button>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 leading-tight">Rapport complet du voyage.</p>
    </div>
  )
}

function FileStage({ label, files, setFiles }) {
  const ref = useRef()
  const [dragging, setDragging] = useState(false)

  const addFiles = newFiles => {
    setFiles(prev => [...prev, ...newFiles.filter(nf => !prev.some(pf => pf.name === nf.name))])
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'))
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer p-3 text-center
          ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => ref.current.click()}
      >
        <input ref={ref} type="file" accept="application/pdf" multiple className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = '' }} />
        {files.length === 0
          ? <p className="text-xs text-gray-400 dark:text-gray-500">Glisser-déposer ou <span className="text-primary dark:text-accent underline">parcourir</span></p>
          : <div className="flex flex-wrap gap-1.5 justify-center" onClick={e => e.stopPropagation()}>
              {files.map(f => (
                <span key={f.name} className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full px-2.5 py-1">
                  {f.name}
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setFiles(p => p.filter(x => x.name !== f.name)) }}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Activity form modal ────────────────────────────────────────────────────

// ── VoyageAcomptesSection ────────────────────────────────────────────────────
function chunkArr(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function VoyageAcomptesSection({ activiteId, acomptesConfig, participantEleves, depenses, absents, nbTotalEleves, intitule, userId }) {
  const [acompteBatches, setAcompteBatches] = useState([])
  const [soldeBatch, setSoldeBatch]         = useState(null)
  const [loading, setLoading]               = useState(true)
  const [generating, setGenerating]         = useState(null) // index or 'solde'

  const loadBatches = async () => {
    const { data } = await supabase.from('facture_batches')
      .select('id, nom, date, statut, voyage_batch_type, voyage_acompte_index')
      .eq('voyage_activite_id', activiteId)
      .order('created_at')
    const ab = (data || []).filter(b => b.voyage_batch_type === 'acompte')
    const sb = (data || []).find(b => b.voyage_batch_type === 'solde') || null
    setAcompteBatches(ab)
    setSoldeBatch(sb)
    setLoading(false)
  }

  useEffect(() => { if (activiteId) loadBatches() }, [activiteId]) // eslint-disable-line

  const generatedIndexes = new Set(acompteBatches.map(b => b.voyage_acompte_index))

  // Calcul montant réel présents / absents à partir des dépenses
  const absentsSet = new Set(absents)
  const nbTotal    = participantEleves.length || nbTotalEleves
  const nbPresents = Math.max(0, nbTotal - absentsSet.size)

  let realPresent = 0
  let realAbsent  = 0
  depenses.forEach(d => {
    const effNb = d.nb_eleves_override != null ? d.nb_eleves_override
      : (d.incompressible ? nbTotal : nbPresents)
    const mpe = effNb > 0 ? parseFloat(d.montant_total || 0) / effNb : 0
    realPresent += mpe
    if (d.incompressible) realAbsent += mpe
  })

  const totalAcomptes = acomptesConfig.reduce((s, a) => s + parseFloat(a.montant || 0), 0)
  const soldePresent  = realPresent  - totalAcomptes
  const soldeAbsent   = realAbsent   - totalAcomptes

  async function getBatchNumero() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const base = `F-${y}${m}${d}`
    const { data: existing } = await supabase.from('facture_batches').select('numero').like('numero', `${base}%`)
    const run = String((existing?.length || 0) + 1).padStart(2, '0')
    return `${base}-${run}`
  }

  async function computeSoldeMap() {
    const [{ data: paies }, { data: facts }] = await Promise.all([
      supabase.from('paiements').select('eleve_id,montant'),
      supabase.from('factures').select('eleve_id,montant'),
    ])
    const map = {}
    ;(paies || []).forEach(p => { map[p.eleve_id] = (map[p.eleve_id] || 0) + Number(p.montant) })
    ;(facts || []).forEach(f => { map[f.eleve_id] = (map[f.eleve_id] || 0) - Number(f.montant) })
    return map
  }

  async function genererAcompte(index) {
    const acompte = acomptesConfig[index]
    const montant = parseFloat(acompte.montant)
    if (!montant || !participantEleves.length) return
    setGenerating(index)
    try {
      const batchNumero = await getBatchNumero()
      const today       = new Date().toISOString().slice(0, 10)
      const soldeMap    = await computeSoldeMap()

      const { data: batch } = await supabase.from('facture_batches').insert({
        numero: batchNumero, date: today, statut: 'brouillon',
        created_by: userId,
        nom: `${intitule} — ${acompte.label}`,
        voyage_activite_id: activiteId,
        voyage_batch_type: 'acompte',
        voyage_acompte_index: index,
      }).select().single()
      if (!batch) throw new Error('Batch non créé')

      const factData = participantEleves.map((e, i) => {
        const sv = soldeMap[e.id] || 0
        return {
          eleve_id: e.id, montant, date: today, statut: 'brouillon',
          numero: `${batchNumero}-${e.matricule || String(i + 1).padStart(6, '0')}`,
          solde_avant: sv, solde_apres: sv - montant,
          created_by: userId, batch_id: batch.id,
        }
      })
      const { data: insertedFacs } = await supabase.from('factures').insert(factData).select('id, numero')
      const facByNum = Object.fromEntries((insertedFacs || []).map(f => [f.numero, f.id]))

      const lignes = factData.map(fd => ({
        facture_id: facByNum[fd.numero],
        type: 'activite', libelle: acompte.label,
        categorie: 'Activités', montant,
        activite_id: activiteId,
      })).filter(l => l.facture_id)
      for (const chunk of chunkArr(lignes, 100)) {
        await supabase.from('facture_lignes').insert(chunk)
      }
      await loadBatches()
    } finally { setGenerating(null) }
  }

  async function genererSolde() {
    if (!participantEleves.length) return
    setGenerating('solde')
    try {
      // Récupérer les acomptes déjà facturés par élève
      const acompteBatchIds = acompteBatches.map(b => b.id)
      const acompteParEleve = {}
      if (acompteBatchIds.length > 0) {
        for (const slice of chunkArr(acompteBatchIds, 50)) {
          const { data: facs } = await supabase.from('factures')
            .select('eleve_id, montant').in('batch_id', slice)
          ;(facs || []).forEach(f => {
            acompteParEleve[f.eleve_id] = (acompteParEleve[f.eleve_id] || 0) + Number(f.montant)
          })
        }
      }

      const batchNumero = await getBatchNumero()
      const today       = new Date().toISOString().slice(0, 10)
      const soldeMap    = await computeSoldeMap()

      const { data: batch } = await supabase.from('facture_batches').insert({
        numero: batchNumero, date: today, statut: 'brouillon',
        created_by: userId,
        nom: `${intitule} — Solde`,
        voyage_activite_id: activiteId,
        voyage_batch_type: 'solde',
      }).select().single()
      if (!batch) throw new Error('Batch non créé')

      const factData = participantEleves.map((e, i) => {
        const isAbsent   = absentsSet.has(e.id)
        const real       = isAbsent ? realAbsent : realPresent
        const deja       = acompteParEleve[e.id] || 0
        const montant    = parseFloat((real - deja).toFixed(2))
        const sv         = soldeMap[e.id] || 0
        const libelle    = montant < 0
          ? `${intitule} — Solde (avoir)`
          : `${intitule} — Solde`
        return {
          eleve_id: e.id, montant, date: today, statut: 'brouillon',
          numero: `${batchNumero}-${e.matricule || String(i + 1).padStart(6, '0')}`,
          solde_avant: sv, solde_apres: sv - montant,
          created_by: userId, batch_id: batch.id,
          _libelle: libelle, _isAbsent: isAbsent, _real: real, _deja: deja,
        }
      })
      const toInsert = factData.map(({ _libelle, _isAbsent, _real, _deja, ...fd }) => fd)
      const { data: insertedFacs } = await supabase.from('factures').insert(toInsert).select('id, numero')
      const facByNum = Object.fromEntries((insertedFacs || []).map(f => [f.numero, f.id]))

      const lignes = factData.map(fd => {
        const isAbsent = absentsSet.has(fd.eleve_id)
        return {
          facture_id: facByNum[fd.numero],
          type: 'activite',
          libelle: isAbsent ? `${intitule} — Solde (absent)` : `${intitule} — Solde`,
          categorie: 'Activités', montant: fd.montant,
          activite_id: activiteId,
        }
      }).filter(l => l.facture_id)
      for (const chunk of chunkArr(lignes, 100)) {
        await supabase.from('facture_lignes').insert(chunk)
      }
      await loadBatches()
    } finally { setGenerating(null) }
  }

  if (!acomptesConfig.length) return null

  const canSolde = depenses.length > 0 && !soldeBatch

  return (
    <div className="border-b border-gray-100 dark:border-gray-700">
      <div className="px-3 py-2.5">
        <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
          Acomptes &amp; Solde
        </h4>

        {loading ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Chargement…</p>
        ) : (
          <div className="space-y-1">
            {acomptesConfig.map((a, i) => {
              const batch = acompteBatches.find(b => b.voyage_acompte_index === i)
              const isGen = !!batch
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isGen ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="flex-1 text-gray-700 dark:text-gray-200 truncate">{a.label || `Acompte ${i+1}`}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">{fmt(parseFloat(a.montant||0))}</span>
                  {isGen ? (
                    <span className="text-green-600 dark:text-green-400 font-medium shrink-0 text-[10px]">✓ {fmtDate(batch.date)}</span>
                  ) : (
                    <button
                      onClick={() => genererAcompte(i)}
                      disabled={!!generating}
                      className="btn-primary text-[10px] py-0.5 px-2 shrink-0 disabled:opacity-50">
                      {generating === i ? <Loader2 size={10} className="animate-spin" /> : 'Générer'}
                    </button>
                  )}
                </div>
              )
            })}

            {/* Ligne solde */}
            <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${soldeBatch ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="flex-1 text-gray-700 dark:text-gray-200 font-medium">Solde final</span>
              {depenses.length > 0 && (
                <span className="text-gray-500 dark:text-gray-400 shrink-0">
                  présents {fmt(soldePresent)} / absents {fmt(soldeAbsent)}
                </span>
              )}
              {soldeBatch ? (
                <span className="text-green-600 dark:text-green-400 font-medium shrink-0 text-[10px]">✓ {fmtDate(soldeBatch.date)}</span>
              ) : (
                <button
                  onClick={genererSolde}
                  disabled={!!generating || !canSolde}
                  title={!depenses.length ? 'Saisir les dépenses réelles avant de générer le solde' : ''}
                  className="btn-primary text-[10px] py-0.5 px-2 shrink-0 disabled:opacity-50">
                  {generating === 'solde' ? <Loader2 size={10} className="animate-spin" /> : 'Générer solde'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DepensesPanel ────────────────────────────────────────────────────────
function DepensesPanel({ activiteId, type, nbTotalEleves, staffPeople, participantEleves,
                         pendingDocs, setPendingDocs, savedDocs, viewDoc, delSavedDoc,
                         pendingFactures, setPendingFactures, savedFactures,
                         intitule, formType, montantParEleveAnnonce,
                         acomptesConfig = [], userId }) {
  const [depenses, setDepenses]     = useState([])
  const [absents, setAbsents]       = useState([])
  const [loadingDep, setLoadingDep] = useState(true)
  const [uploadingRow, setUploadingRow] = useState(null)
  const fileRefs = useRef({})

  useEffect(() => {
    if (!activiteId) return
    Promise.all([
      supabase.from('activite_depenses').select('*').eq('activite_id', activiteId).order('ordre').order('created_at'),
      supabase.from('activite_absents').select('eleve_id').eq('activite_id', activiteId),
    ]).then(([depRes, absRes]) => {
      setDepenses(depRes.data || [])
      setAbsents((absRes.data || []).map(r => r.eleve_id))
      setLoadingDep(false)
    })
  }, [activiteId])

  const nbPresents = Math.max(0, nbTotalEleves - absents.length)

  const effectiveNb = dep => {
    if (dep.nb_eleves_override != null) return dep.nb_eleves_override
    return dep.incompressible ? nbTotalEleves : nbPresents
  }

  const addDepense = async () => {
    const { data, error } = await supabase.from('activite_depenses').insert({
      activite_id: activiteId, categorie: 'autres', intitule: '',
      montant_total: 0, incompressible: true, paye_par: '', ordre: depenses.length,
    }).select().single()
    if (!error && data) setDepenses(prev => [...prev, data])
  }

  const updateDepense = async (id, updates) => {
    setDepenses(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    await supabase.from('activite_depenses').update(updates).eq('id', id)
  }

  const deleteDepense = async (id) => {
    if (!confirm('Supprimer cette dépense ?')) return
    setDepenses(prev => prev.filter(d => d.id !== id))
    await supabase.from('activite_depenses').delete().eq('id', id)
  }

  const toggleAbsent = async (eleveId) => {
    const isAbsent = absents.includes(eleveId)
    if (isAbsent) {
      setAbsents(prev => prev.filter(id => id !== eleveId))
      await supabase.from('activite_absents').delete().eq('activite_id', activiteId).eq('eleve_id', eleveId)
    } else {
      setAbsents(prev => [...prev, eleveId])
      await supabase.from('activite_absents').insert({ activite_id: activiteId, eleve_id: eleveId })
    }
  }

  const uploadDepenseDoc = async (depId, file) => {
    if (!file || file.type !== 'application/pdf') return
    setUploadingRow(depId)
    try {
      const path = `${activiteId}/${depId}/${file.name}`
      const { error: upErr } = await supabase.storage.from('activite-depenses').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      await updateDepense(depId, { document_path: path })
    } catch(e) { alert('Erreur upload: ' + (e?.message || e)) }
    finally { setUploadingRow(null) }
  }

  const viewDepenseDoc = async (path) => {
    const { data } = await supabase.storage.from('activite-depenses').createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const montantTotalReel = depenses.reduce((s, d) => s + parseFloat(d.montant_total || 0), 0)
  const montantParEleveReel = nbTotalEleves > 0 ? montantTotalReel / nbTotalEleves : 0
  const montantIncompressibleTotal = depenses.filter(d => d.incompressible).reduce((s, d) => s + parseFloat(d.montant_total || 0), 0)
  const montantAbsentsReel = nbTotalEleves > 0 ? montantIncompressibleTotal / nbTotalEleves : 0

  const PAYE_PAR_OPTIONS = [
    ...staffPeople.map(p => p.label),
    'Econome', 'POP',
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Documents & Factures</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Top row: 4 sections */}
        <div className="grid grid-cols-4 gap-0 border-b border-gray-100 dark:border-gray-700">
          <div className="p-3 border-r border-gray-100 dark:border-gray-700">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Documents PDF</p>
            <FileStage label="Documents (PDF)" files={pendingDocs} setFiles={setPendingDocs} compact />
            {savedDocs.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {savedDocs.map(d => (
                  <li key={d.id} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1">
                    <span className="flex-1 truncate text-[11px]">{d.nom_fichier}</span>
                    <button onClick={() => viewDoc(d)} className="text-primary hover:underline text-[11px] shrink-0">Voir</button>
                    <button onClick={() => delSavedDoc(d)} className="text-red-400 dark:text-red-300 hover:underline text-[11px] shrink-0">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-3 border-r border-gray-100 dark:border-gray-700">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Générer avis</p>
            {formType === 'extramuros' || formType === 'intramuros' ? (
              <AvisGenerator activiteId={activiteId} intitule={intitule} />
            ) : (
              <AvisGenerator activiteId={activiteId} intitule={intitule} isVoyage montantParEleve={montantParEleveAnnonce} />
            )}
          </div>
          <div className="p-3 border-r border-gray-100 dark:border-gray-700">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Demande d'avance</p>
            <AvanceGenerator activiteId={activiteId} depenses={depenses} intitule={intitule} />
          </div>
          <div className="p-3">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Générer rapport</p>
            <RapportVoyageGenerator activiteId={activiteId} />
          </div>
        </div>

        {/* Acomptes voyage */}
        {formType === 'voyage' && (
          <VoyageAcomptesSection
            activiteId={activiteId}
            acomptesConfig={acomptesConfig}
            participantEleves={participantEleves}
            depenses={depenses}
            absents={absents}
            nbTotalEleves={nbTotalEleves}
            intitule={intitule}
            userId={userId}
          />
        )}

        {/* Factures section — masqué pour les voyages (factures dans dépenses) */}
        {formType !== 'voyage' && (
          <>
            {savedFactures.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Factures PDF</p>
                <ul className="space-y-1">
                  {savedFactures.map(d => (
                    <li key={d.id} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1">
                      <span className="flex-1 truncate text-[11px]">{d.nom_fichier}</span>
                      <button onClick={() => viewDoc(d)} className="text-primary hover:underline text-[11px] shrink-0">Voir</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pendingFactures.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <FileStage label="Factures (PDF)" files={pendingFactures} setFiles={setPendingFactures} compact />
              </div>
            )}
            {pendingFactures.length === 0 && savedFactures.length === 0 && (
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Factures PDF</p>
                <FileStage label="Factures (PDF)" files={pendingFactures} setFiles={setPendingFactures} compact />
              </div>
            )}
          </>
        )}

        {/* Dépenses (voyages only) */}
        {type === 'voyage' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Dépenses</h4>
              <button onClick={addDepense}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium">
                <Plus size={12} /> Ajouter
              </button>
            </div>

            {loadingDep ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">Chargement…</p>
            ) : depenses.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">Aucune dépense enregistrée</p>
            ) : (
              <div className="space-y-2">
                {depenses.map(dep => {
                  const effNb = effectiveNb(dep)
                  const mpe   = effNb > 0 ? parseFloat(dep.montant_total || 0) / effNb : 0
                  return (
                    <div key={dep.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-2 text-xs bg-gray-50/50">
                      {/* Row 1: Catégorie + Intitulé */}
                      <div className="grid grid-cols-2 gap-1 mb-1.5">
                        <select className="input text-xs py-1 px-2" value={dep.categorie}
                          onChange={e => updateDepense(dep.id, { categorie: e.target.value })}>
                          {DEPENSES_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <input className="input text-xs py-1 px-2" placeholder="Intitulé"
                          defaultValue={dep.intitule}
                          onBlur={e => { if (e.target.value !== dep.intitule) updateDepense(dep.id, { intitule: e.target.value }) }} />
                      </div>
                      {/* Row 2: Montant + Nb élèves + Par élève */}
                      <div className="grid grid-cols-3 gap-1 mb-1.5">
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Montant (€)</p>
                          <input className="input text-xs py-1 px-2" type="number" step="0.01" min="0"
                            defaultValue={dep.montant_total}
                            onBlur={e => {
                              const v = parseFloat(e.target.value) || 0
                              if (v !== parseFloat(dep.montant_total || 0)) updateDepense(dep.id, { montant_total: v })
                            }} />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Nb élèves</p>
                          <input className="input text-xs py-1 px-2" type="number" min="0"
                            value={dep.nb_eleves_override != null ? dep.nb_eleves_override : effNb}
                            onChange={e => {
                              const raw = e.target.value
                              const v = raw === '' ? null : (parseInt(raw) || 0)
                              updateDepense(dep.id, { nb_eleves_override: v })
                            }} />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Par élève</p>
                          <div className="input text-xs py-1 px-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 select-none">
                            {mpe > 0 ? `${mpe.toFixed(2)} €` : '—'}
                          </div>
                        </div>
                      </div>
                      {/* Row 3: Incompressible + Avance + Payé par */}
                      <div className="flex items-center gap-3 mb-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input type="checkbox" checked={!!dep.incompressible}
                            onChange={e => updateDepense(dep.id, { incompressible: e.target.checked })}
                            className="rounded" />
                          <span className="text-[11px] text-gray-600 dark:text-gray-300">Incompressible</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input type="checkbox" checked={!!dep.avance}
                            onChange={e => updateDepense(dep.id, { avance: e.target.checked })}
                            className="rounded accent-blue-600" />
                          <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">Avance</span>
                        </label>
                        <select className="input text-xs py-1 px-2 flex-1" value={dep.paye_par || ''}
                          onChange={e => updateDepense(dep.id, { paye_par: e.target.value })}>
                          <option value="">— Payé par —</option>
                          {PAYE_PAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      {/* Row 4: Doc + Delete */}
                      <div className="flex items-center justify-between">
                        <div>
                          <input type="file" accept="application/pdf" className="hidden"
                            ref={el => { if (el) fileRefs.current[dep.id] = el }}
                            onChange={e => { const f = e.target.files[0]; e.target.value=''; if(f) uploadDepenseDoc(dep.id, f) }} />
                          {dep.document_path ? (
                            <button onClick={() => viewDepenseDoc(dep.document_path)}
                              className="text-primary dark:text-accent text-[11px] hover:underline">
                              📎 Voir justificatif
                            </button>
                          ) : (
                            <button onClick={() => fileRefs.current[dep.id]?.click()}
                              disabled={uploadingRow === dep.id}
                              className="text-gray-400 dark:text-gray-500 text-[11px] hover:text-primary transition-colors disabled:opacity-50">
                              {uploadingRow === dep.id ? 'Upload…' : '📎 Joindre justificatif'}
                            </button>
                          )}
                        </div>
                        <button onClick={() => deleteDepense(dep.id)}
                          className="text-red-300 hover:text-red-500 transition-colors p-0.5 rounded">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Totals */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Montant total réel</p>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{fmt(montantTotalReel)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Facturé aux élèves présents</p>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{fmt(montantParEleveReel)}</p>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-center ${absents.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 opacity-40'}`}>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Facturé aux élèves absents</p>
                  <p className={`font-bold text-sm ${absents.length > 0 ? 'text-amber-700' : 'text-gray-400 dark:text-gray-500'}`}>
                    {absents.length > 0 ? fmt(montantAbsentsReel) : '—'}
                  </p>
                </div>
              </div>

              {/* Élèves absents */}
              {participantEleves.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    Élèves absents {absents.length > 0 && <span className="text-orange-500 dark:text-orange-400 normal-case font-normal">({absents.length} absent{absents.length > 1 ? 's' : ''}, {nbPresents} présents)</span>}
                  </p>
                  <MultiSearchSelect
                    options={participantEleves}
                    value={absents}
                    onChange={ids => {
                      const toAdd    = ids.filter(id => !absents.includes(id))
                      const toRemove = absents.filter(id => !ids.includes(id))
                      toAdd.forEach(id => toggleAbsent(id))
                      toRemove.forEach(id => toggleAbsent(id))
                    }}
                    placeholder="Rechercher des élèves absents…"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityModal({ editRow, isFinancier, isAdmin, userId, allEleves, staffList, groupOptions, allClasses, onClose, onSaved, allowedTypes, defaultType, isPage = false }) {
  const { user, profile } = useAuth()
  const canChooseResponsable = isAdmin || isFinancier
  const { list: initTransportList, autre: initTransportAutre } = parseTransport(editRow?.type_transport || '')
  const initForm = editRow ? {
    ...EMPTY, ...editRow,
    accompagnateur_ids: editRow.accompagnateur_ids || [],
    eleves_exclus:    editRow.eleves_exclus    || [],
    classes_incluses: editRow.classes_incluses || [],
    groupes_inclus:   editRow.groupes_inclus   || [],
    classes_exclues:  editRow.classes_exclues  || [],
    groupes_exclus:   editRow.groupes_exclus   || [],
    type_transport_list: initTransportList,
    transport_autre_texte: initTransportAutre,
  } : {
    ...EMPTY,
    type: defaultType || EMPTY.type,
    responsable_id: canChooseResponsable ? null : (userId || null),
  }

  const [form, setForm]             = useState(initForm)
  const [errors, setErrors]         = useState([])
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState(null)
  const [pendingDocs, setPendingDocs]         = useState([])
  const [pendingFactures, setPendingFactures] = useState([])
  const [savedDocs, setSavedDocs]           = useState([])
  const [savedFactures, setSavedFactures]   = useState([])

  const loadSaved = useCallback(async () => {
    if (!editRow?.id) return
    const { data } = await supabase.from('activite_documents')
      .select('*').eq('activite_id', editRow.id).order('created_at', { ascending: false })
    setSavedDocs((data || []).filter(d => d.categorie === 'document'))
    setSavedFactures((data || []).filter(d => d.categorie === 'facture'))
  }, [editRow?.id])

  useEffect(() => { loadSaved() }, [loadSaved])

  const viewDoc = async doc => {
    const { data } = await supabase.storage.from('activite-factures').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const delSavedDoc = async doc => {
    await supabase.storage.from('activite-factures').remove([doc.storage_path])
    await supabase.from('activite_documents').delete().eq('id', doc.id)
    try { await logEvent(editRow.id, { action: 'doc_del', filename: doc.nom_fichier, categorie: doc.categorie }) } catch {}
    loadSaved()
  }

  const hasSelection = form.classes_incluses.length > 0 || form.groupes_inclus.length > 0
  const nbEleves = useMemo(() => calcNbEleves(allEleves, form),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEleves, form.classes_incluses, form.groupes_inclus, form.classes_exclues, form.groupes_exclus, form.eleves_exclus])

  const f = (k, v) => setForm(p => {
    const next = { ...p, [k]: v }
    // Pour les voyages : auto-calculer montant_total depuis le tier sélectionné
    if (next.type === 'voyage' && (k === 'montant_par_eleve_annonce' || k === 'nb_eleves')) {
      const effectiveNb = hasSelection ? nbEleves : parseInt(next.nb_eleves || 0)
      const tier        = parseFloat(next.montant_par_eleve_annonce || 0)
      next.montant_total = effectiveNb > 0 && tier > 0 ? (effectiveNb * tier).toFixed(2) : ''
      if (next.montant_total) {
        if (p.statut_facturation === 'non_payant') next.statut_facturation = 'en_attente'
      } else {
        next.statut_facturation = 'non_payant'
      }
    }
    if (k === 'montant_total') {
      const montant = parseFloat(v)
      if (!v || montant === 0) {
        next.statut_facturation = 'non_payant'
      } else if (p.statut_facturation === 'non_payant') {
        next.statut_facturation = 'en_attente'
      }
    }
    return next
  })

  // Voyage : recalculer montant_total quand nbEleves change (ex: ajout/retrait de classe)
  useEffect(() => {
    if (form.type === 'voyage' && form.montant_par_eleve_annonce) {
      const effectiveNb = hasSelection ? nbEleves : parseInt(form.nb_eleves || 0)
      const tier        = parseFloat(form.montant_par_eleve_annonce || 0)
      const newTotal    = effectiveNb > 0 && tier > 0 ? (effectiveNb * tier).toFixed(2) : ''
      if (newTotal !== (form.montant_total || '')) {
        setForm(p => ({
          ...p,
          montant_total: newTotal,
          statut_facturation: newTotal ? (p.statut_facturation === 'non_payant' ? 'en_attente' : p.statut_facturation) : 'non_payant',
        }))
      }
    }
  }, [nbEleves, form.type, form.montant_par_eleve_annonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const participantEleves = useMemo(() => getParticipantEleves(allEleves, form),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEleves, form.classes_incluses, form.groupes_inclus, form.classes_exclues, form.groupes_exclus, form.eleves_exclus])

  const staffPeopleForDepenses = useMemo(() => {
    const people = []
    if (form.responsable_id) {
      const s = staffList.find(s => s.value === form.responsable_id)
      if (s) people.push(s)
    }
    ;(form.accompagnateur_ids || []).forEach(id => {
      const s = staffList.find(s => s.value === id)
      if (s && !people.find(p => p.value === id)) people.push(s)
    })
    return people
  }, [form.responsable_id, form.accompagnateur_ids, staffList])

  const eleveOptions = useMemo(() =>
    allEleves
      .map(e => ({ value: e.id, label: `${e.nom || ''} ${e.prenom || ''} (${e.classe || ''})`.trim(), id: e.id, matricule: e.matricule, nom: e.nom, prenom: e.prenom, classe: e.classe }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [allEleves]
  )

  const nb = hasSelection ? nbEleves : (parseInt(form.nb_eleves) || 0)
  const montantParEleve = nb > 0 && form.montant_total
    ? ((parseFloat(form.montant_total || 0) - parseFloat(form.pop || 0)) / nb)
    : null

  const FIELD_LABELS = {
    intitule: 'Intitulé', type: 'Type', date_debut: 'Date de début',
    lieu: 'Lieu', heure_depart: 'Heure de départ', heure_retour: 'Heure de retour',
    lieu_rdv: 'Lieu de RDV', lieu_retour: 'Lieu de retour', type_transport: 'Type de transport', tel_organisateur: 'Tél. organisateur.trice',
    date_fin: 'Date de retour', local: 'Local',
    heure_debut: 'Heure de début', heure_fin: 'Heure de fin',
    statut: 'Statut', description: 'Description', nb_eleves: 'Nb élèves', acomptes_config: 'Acomptes',
    montant_total: 'Montant total', pop: 'POP',
    responsable_id: 'Responsable', accompagnateur_ids: 'Accompagnateurs',
  }
  const TRACKED_FIELDS = [
    'intitule', 'description', 'type', 'statut', 'date_debut', 'date_fin',
    'lieu', 'local', 'heure_debut', 'heure_fin', 'heure_depart', 'heure_retour',
    'lieu_rdv', 'type_transport', 'responsable_id', 'nb_eleves', 'montant_total', 'pop',
  ]

  const logEvent = async (activiteId, meta) => {
    const auteurNom = profile
      ? `${profile.prenom || ''} ${profile.nom || ''}`.trim()
      : (user?.email || 'Inconnu')
    await supabase.from('commentaires').insert({
      entity_type: 'activite', entity_id: activiteId,
      auteur_id: user?.id, auteur_nom: auteurNom,
      message: '', type: 'system', meta,
    })
  }

  const uploadStagedFiles = async (activiteId) => {
    const uploadErrors = []
    const up = async (files, categorie) => {
      for (const file of files) {
        const uid = crypto.randomUUID()
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${categorie}/${activiteId}/${uid}_${safeName}`
        const { error: storeErr } = await supabase.storage.from('activite-factures').upload(
          storagePath, file, { contentType: 'application/pdf' }
        )
        if (storeErr) { uploadErrors.push(`${file.name} : ${storeErr.message}`); continue }
        const { error: dbErr } = await supabase.from('activite_documents').insert({
          activite_id: activiteId, nom_fichier: file.name, storage_path: storagePath, taille: file.size, categorie
        })
        if (dbErr) { uploadErrors.push(`${file.name} (DB) : ${dbErr.message}`); continue }
        try { await logEvent(activiteId, { action: 'doc_add', filename: file.name, categorie }) } catch {}
      }
    }
    await up(pendingDocs, 'document')
    await up(pendingFactures, 'facture')
    if (uploadErrors.length > 0) alert('Erreur(s) lors de l\'upload :\n' + uploadErrors.join('\n'))
  }

  const [savingAs, setSavingAs] = useState(null) // 'publie' | 'brouillon'

  const save = async (targetStatut = null) => {
    const miss = validate(form)
    if (miss.length > 0) { setErrors(miss); return }
    setSaving(true); setSaveError(null)
    if (targetStatut) setSavingAs(targetStatut)

    const transportStr = form.type_transport_list.length
      ? form.type_transport_list.map(v => v === 'autre' ? 'autre:' + (form.transport_autre_texte || '') : v).join(',')
      : ''
    const payload = Object.fromEntries(
      Object.entries({
        ...form,
        ...(targetStatut ? { statut: targetStatut } : {}),
        nb_eleves: hasSelection ? nbEleves : (form.nb_eleves || null),
        montant_par_eleve: montantParEleve ? montantParEleve.toFixed(2) : null,
        type_transport: transportStr,
        type_transport_list: undefined,
        transport_autre_texte: undefined,
      }).map(([k, v]) => [k, v === '' ? null : v === undefined ? undefined : v])
      .filter(([, v]) => v !== undefined)
    )
    if (!isFinancier) delete payload.pop
    if (!isFinancier) delete payload.statut_facturation

    let error, data
    if (editRow) {
      ;({ error } = await supabase.from('activites').update(payload).eq('id', editRow.id))
      if (!error) {
        await uploadStagedFiles(editRow.id)
        await loadSaved()
        // Logger les champs modifiés
        const changed = TRACKED_FIELDS.filter(k => {
          const before = editRow[k] ?? ''
          const after  = payload[k] ?? ''
          return String(before) !== String(after)
        })
        if (changed.length > 0) {
          await logEvent(editRow.id, { action: 'edit', fields: changed.map(k => FIELD_LABELS[k] || k) })
        }
      }
    } else {
      payload.created_by = userId
      ;({ error, data } = await supabase.from('activites').insert(payload).select('id').single())
      if (!error && data?.id) await uploadStagedFiles(data.id)
    }
    setSaving(false); setSavingAs(null)
    if (error) { setSaveError(error.message); return }
    // Notification Smartschool si première publication (fire-and-forget)
    const isFirstPublish = targetStatut === 'publie' && (!editRow || editRow.statut !== 'publie')
    if (isFirstPublish) {
      const responsableLabel = staffList.find(s => s.value === form.responsable_id)?.label || 'Un membre du personnel'
      const activiteId = editRow?.id || data?.id || null
      fetch('/.netlify/functions/smartschool-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'activite', intitule: form.intitule, responsableNom: responsableLabel, activiteId }),
      }).catch(e => console.warn('[notify] erreur activité:', e.message))
    }
    onSaved(); onClose()
  }

  // Fermeture par clic sur le fond — auto-sauvegarde brouillon si nouvelle activité avec intitulé
  const handleBackdropClose = async () => {
    const isNew = !editRow?.id
    if (isNew && form.intitule?.trim()) {
      const bkTransportStr = form.type_transport_list.length
        ? form.type_transport_list.map(v => v === 'autre' ? 'autre:' + (form.transport_autre_texte || '') : v).join(',')
        : ''
      const payload = Object.fromEntries(
        Object.entries({
          ...form,
          statut: 'brouillon',
          created_by: userId,
          nb_eleves: hasSelection ? nbEleves : (form.nb_eleves || null),
          montant_par_eleve: montantParEleve ? montantParEleve.toFixed(2) : null,
          type_transport: bkTransportStr,
          type_transport_list: undefined,
          transport_autre_texte: undefined,
        }).map(([k, v]) => [k, v === '' ? null : v === undefined ? undefined : v])
        .filter(([, v]) => v !== undefined)
      )
      if (!isFinancier) delete payload.pop
    if (!isFinancier) delete payload.statut_facturation
      const { error, data } = await supabase.from('activites').insert(payload).select('id').single()
      if (!error && data?.id) await uploadStagedFiles(data.id)
      onSaved()
    }
    onClose()
  }

  const modalTitle = editRow
    ? (form.type === 'voyage' ? 'Modifier le voyage' : "Modifier l'activité")
    : (form.type === 'voyage' ? 'Nouveau voyage' : 'Nouvelle activité')

  const formFields = (
    <>


          {/* Infos générales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Intitulé *</label>
              <input className="input" value={form.intitule} onChange={e => f('intitule', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={5} value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            {(!allowedTypes || allowedTypes.length > 1) && (
              <div>
                <label className="label">Type *</label>
                <select className="input" value={form.type} onChange={e => f('type', e.target.value)}>
                  {(!allowedTypes || allowedTypes.includes('extramuros')) && <option value="extramuros">Extramuros</option>}
                  {(!allowedTypes || allowedTypes.includes('intramuros')) && <option value="intramuros">Intramuros</option>}
                </select>
              </div>
            )}
            <div>
              <label className="label">{form.type === 'voyage' ? 'Date de départ' : 'Date'} *</label>
              <input className="input" type="date" value={form.date_debut} onChange={e => f('date_debut', e.target.value)} />
            </div>
            {form.type === 'voyage' && (
              <div>
                <label className="label">Date de retour *</label>
                <input className="input" type="date" value={form.date_fin} onChange={e => f('date_fin', e.target.value)} />
              </div>
            )}
          </div>

          {/* Personnel */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Personnel</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="label">Responsable</label>
                {canChooseResponsable ? (
                <MultiSearchSelect
                  options={staffList}
                  value={form.responsable_id}
                  onChange={v => {
                    f('responsable_id', v)
                    if (v && (form.accompagnateur_ids || []).includes(v))
                      f('accompagnateur_ids', (form.accompagnateur_ids || []).filter(id => id !== v))
                  }}
                  placeholder="Choisir un·e responsable…" single />
                ) : (
                <div className="input bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-sm py-2">
                  {staffList.find(s => s.value === form.responsable_id)?.label || '—'}
                </div>
                )}
              </div>
              <div className="min-w-0">
                <label className="label">Accompagnants</label>
                <MultiSearchSelect
                  options={staffList.filter(s => s.value !== form.responsable_id)}
                  value={form.accompagnateur_ids}
                  onChange={v => f('accompagnateur_ids', v)}
                  placeholder="Choisir des accompagnants…" />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Participants</h3>
            <div className="space-y-3">
              <SelectionEleves badge="add"
                classes={form.classes_incluses} setClasses={v => f('classes_incluses', v)}
                groupes={form.groupes_inclus}  setGroupes={v => f('groupes_inclus', v)}
                allClasses={allClasses} groupOptions={groupOptions} />
              <SelectionEleves badge="remove"
                classes={form.classes_exclues} setClasses={v => f('classes_exclues', v)}
                groupes={form.groupes_exclus}  setGroupes={v => f('groupes_exclus', v)}
                allClasses={allClasses} groupOptions={groupOptions} />

              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                  − Retirer spécifiquement
                </span>
                <div className="mt-3">
                  <label className="label">Élèves à exclure</label>
                  <MultiSearchSelect options={eleveOptions} value={form.eleves_exclus}
                    onChange={v => f('eleves_exclus', v)}
                    placeholder="Rechercher des élèves à exclure…" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="label">
                    Nb d'élèves
                    {hasSelection && <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(calculé auto.)</span>}
                  </label>
                  {hasSelection
                    ? <div className="input bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-semibold">{nbEleves} élève{nbEleves !== 1 ? 's' : ''}</div>
                    : <input className="input" type="number" value={form.nb_eleves || ''} onChange={e => f('nb_eleves', e.target.value)} />
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Logistique extramuros / voyage */}
          {(form.type === 'extramuros' || form.type === 'voyage') && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Logistique</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Lieu *</label>
                  <input className="input" value={form.lieu} onChange={e => f('lieu', e.target.value)} />
                </div>
                <div><label className="label">Heure de départ *</label>
                  <input className="input" type="time" value={form.heure_depart} onChange={e => f('heure_depart', e.target.value)} />
                </div>
                <div><label className="label">Heure de retour *</label>
                  <input className="input" type="time" value={form.heure_retour} onChange={e => f('heure_retour', e.target.value)} />
                </div>
                <div><label className="label">Lieu de RDV *</label>
                  <input className="input" value={form.lieu_rdv} onChange={e => f('lieu_rdv', e.target.value)} />
                </div>
                <div><label className="label">Lieu de retour{form.type === 'extramuros' ? ' *' : ''}</label>
                  <input className="input" value={form.lieu_retour} onChange={e => f('lieu_retour', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Type de transport *</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                    {TRANSPORT_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox"
                          className="rounded border-gray-300 dark:border-gray-500"
                          checked={(form.type_transport_list || []).includes(opt.value)}
                          onChange={e => {
                            const cur = form.type_transport_list || []
                            f('type_transport_list', e.target.checked
                              ? [...cur, opt.value]
                              : cur.filter(v => v !== opt.value))
                          }} />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {(form.type_transport_list || []).includes('autre') && (
                    <input className="input mt-2" placeholder="Préciser le transport…"
                      value={form.transport_autre_texte || ''}
                      onChange={e => f('transport_autre_texte', e.target.value)} />
                  )}

                  {/* SNCB — gares + heure retour + PMR */}
                  {(form.type_transport_list || []).includes('sncb') && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">SNCB</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Gare de départ</label>
                          <input className="input" value={form.gare_depart || ''} onChange={e => f('gare_depart', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Gare d'arrivée</label>
                          <input className="input" value={form.gare_arrivee || ''} onChange={e => f('gare_arrivee', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Heure de départ (retour)</label>
                          <input className="input" type="time" value={form.heure_depart_retour || ''} onChange={e => f('heure_depart_retour', e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Accessibilité PMR</label>
                        <div className="flex gap-4 mt-1">
                          {['oui', 'non'].map(v => (
                            <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="radio" name="pmr" checked={form.pmr === v} onChange={() => f('pmr', v)} />
                              <span className="text-sm capitalize text-gray-700 dark:text-gray-200">{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TEC — gares + heure retour + ligne */}
                  {(form.type_transport_list || []).includes('tec') && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800 space-y-3">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">TEC</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Gare de départ</label>
                          <input className="input" value={form.gare_depart || ''} onChange={e => f('gare_depart', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Gare d'arrivée</label>
                          <input className="input" value={form.gare_arrivee || ''} onChange={e => f('gare_arrivee', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Heure de départ (retour)</label>
                          <input className="input" type="time" value={form.heure_depart_retour || ''} onChange={e => f('heure_depart_retour', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Ligne empruntée</label>
                          <input className="input" value={form.ligne_tec || ''} onChange={e => f('ligne_tec', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* De Lijn — message informatif */}
                  {(form.type_transport_list || []).includes('de_lijn') && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl border border-yellow-200 flex items-start gap-2">
                      <span className="text-yellow-600 dark:text-yellow-400 text-base mt-0.5">ℹ️</span>
                      <p className="text-sm text-yellow-800">
                        Contacter l'économe pour réserver les tickets sur l'application De Lijn.
                      </p>
                    </div>
                  )}

                  {/* Flixbus — gares + heure retour */}
                  {(form.type_transport_list || []).includes('flixbus') && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 rounded-xl border border-green-300 space-y-3">
                      <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Flixbus</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Gare de départ</label>
                          <input className="input" value={form.gare_depart || ''} onChange={e => f('gare_depart', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Gare d'arrivée</label>
                          <input className="input" value={form.gare_arrivee || ''} onChange={e => f('gare_arrivee', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Heure de départ (retour)</label>
                          <input className="input" type="time" value={form.heure_depart_retour || ''} onChange={e => f('heure_depart_retour', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div><label className="label">Tél. organisateur.trice *</label>
                  <input className="input" value={form.tel_organisateur} onChange={e => f('tel_organisateur', e.target.value)} />
                </div>
                {form.type === 'voyage' && (
                  <div><label className="label">Tél. séjour</label>
                    <input className="input" value={form.tel_sejour || ''} onChange={e => f('tel_sejour', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logistique intramuros */}
          {form.type === 'intramuros' && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Logistique</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Local *</label>
                  <input className="input" value={form.local} onChange={e => f('local', e.target.value)} />
                </div>
                <div><label className="label">Heure de début *</label>
                  <input className="input" type="time" value={form.heure_debut} onChange={e => f('heure_debut', e.target.value)} />
                </div>
                <div><label className="label">Heure de fin *</label>
                  <input className="input" type="time" value={form.heure_fin} onChange={e => f('heure_fin', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Finances */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Finances</h3>
            <div className="grid grid-cols-2 gap-4">
              {form.type === 'voyage' ? (<>
                {/* Voyage : tier par élève → calcul montant total */}
                <div><label className="label">Montant par élève (annoncé)</label>
                  <select className="input" value={form.montant_par_eleve_annonce || ''} onChange={e => f('montant_par_eleve_annonce', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {VOYAGE_TIERS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div><label className="label">Montant total annoncé</label>
                  <div className="input bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                    {form.montant_par_eleve_annonce && (hasSelection ? nbEleves : parseInt(form.nb_eleves || 0)) > 0
                      ? fmt(parseFloat(form.montant_par_eleve_annonce) * (hasSelection ? nbEleves : parseInt(form.nb_eleves || 0)))
                      : '—'}
                  </div>
                </div>
                {/* Acomptes config */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Acomptes</label>
                    <button type="button"
                      onClick={() => f('acomptes_config', [...(form.acomptes_config||[]), {label:'', montant:''}])}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium flex items-center gap-1">
                      + Ajouter un acompte
                    </button>
                  </div>
                  {(form.acomptes_config||[]).length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">Aucun acompte configuré — les élèves seront facturés en une seule fois.</p>
                  )}
                  {(form.acomptes_config||[]).map((a, i) => (
                    <div key={i} className="flex gap-2 mb-1.5 items-center">
                      <input
                        className="input flex-1 py-1.5 text-sm"
                        placeholder="Label (ex: Acompte septembre)"
                        value={a.label}
                        onChange={e => {
                          const next = [...(form.acomptes_config||[])]
                          next[i] = {...next[i], label: e.target.value}
                          f('acomptes_config', next)
                        }}
                      />
                      <input
                        className="input w-28 py-1.5 text-sm"
                        type="number" step="0.01" min="0"
                        placeholder="Montant €"
                        value={a.montant}
                        onChange={e => {
                          const next = [...(form.acomptes_config||[])]
                          next[i] = {...next[i], montant: e.target.value}
                          f('acomptes_config', next)
                        }}
                      />
                      <button type="button"
                        onClick={() => f('acomptes_config', (form.acomptes_config||[]).filter((_,j)=>j!==i))}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-500 text-lg leading-none flex-shrink-0">&times;</button>
                    </div>
                  ))}
                  {(form.acomptes_config||[]).length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Total acomptes : {fmt((form.acomptes_config||[]).reduce((s,a)=>s+parseFloat(a.montant||0),0))}
                      {form.montant_par_eleve_annonce && <span className="ml-2 text-blue-500 dark:text-blue-400">/ {fmt(parseFloat(form.montant_par_eleve_annonce))} annoncé</span>}
                    </p>
                  )}
                </div>
              </>) : (<>
                {/* Intramuros / Extramuros : montant total + POP → calcul par élève */}
                <div><label className="label">Montant total (€)</label>
                  <input className="input" type="number" step="0.01" value={form.montant_total} onChange={e => f('montant_total', e.target.value)} />
                </div>
                <div>
                  <label className="label">POP (€)</label>
                  {isFinancier
                    ? <input className="input" type="number" step="0.01" value={form.pop} onChange={e => f('pop', e.target.value)} />
                    : <div className="input bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">{form.pop ? fmt(parseFloat(form.pop)) : '—'}</div>
                  }
                </div>
                <div><label className="label">Montant par élève (calculé)</label>
                  <div className="input bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">{montantParEleve !== null ? fmt(montantParEleve) : '—'}</div>
                </div>
              </>)}


              {isFinancier && (
                <div className="col-span-2"><label className="label">Statut facturation</label>
                  {form.statut_facturation === 'non_payant' ? (
                    <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Non payant</span>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { val: 'en_attente', label: 'En attente', active: 'bg-orange-50 dark:bg-orange-950 border-orange-400 text-orange-700 dark:text-orange-300', idle: 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500' },
                        { val: 'a_facturer', label: 'À facturer', active: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-400 text-yellow-700 dark:text-yellow-300', idle: 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500' },
                        { val: 'facture',    label: 'Facturé',    active: 'bg-green-50 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300',  idle: 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500' },
                      ].map(({ val, label, active, idle }) => {
                        const locked = form.statut === 'brouillon' && val !== 'en_attente'
                        return (
                          <button key={val} type="button"
                            onClick={() => !locked && f('statut_facturation', val)}
                            title={locked ? "Publiez l'activité pour modifier ce statut" : undefined}
                            className={`px-4 py-1.5 text-sm rounded-lg border font-medium transition-all
                              ${locked
                                ? 'opacity-30 cursor-not-allowed border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                                : form.statut_facturation === val ? active : idle + ' hover:border-gray-300 hover:text-gray-500'}`}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Informations supplémentaires */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Informations supplémentaires</h3>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Informations complémentaires à destination des parents (matériel, consignes, …)"
              value={form.informations_supplementaires || ''}
              onChange={e => f('informations_supplementaires', e.target.value)}
            />
          </div>

          {/* Documents & Factures — uniquement en mode modal */}
          {!isPage && editRow?.id && <div>
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">Documents & Factures</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <FileStage label="Documents (PDF)" files={pendingDocs} setFiles={setPendingDocs} />
                {savedDocs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {savedDocs.map(d => (
                      <li key={d.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
                        <span className="flex-1 truncate">{d.nom_fichier}</span>
                        <button type="button" onClick={() => viewDoc(d)} className="text-primary hover:underline shrink-0">Voir</button>
                        <button type="button" onClick={() => delSavedDoc(d)} className="text-red-400 dark:text-red-300 hover:underline shrink-0">Suppr.</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <FileStage label="Factures (PDF)" files={pendingFactures} setFiles={setPendingFactures} />
                {savedFactures.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {savedFactures.map(d => (
                      <li key={d.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
                        <span className="flex-1 truncate">{d.nom_fichier}</span>
                        <button type="button" onClick={() => viewDoc(d)} className="text-primary hover:underline shrink-0">Voir</button>
                        <button type="button" onClick={() => delSavedDoc(d)} className="text-red-400 dark:text-red-300 hover:underline shrink-0">Suppr.</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Générer avis</p>
                {editRow?.id && (form.type === 'extramuros' || form.type === 'intramuros') ? (
                  <AvisGenerator activiteId={editRow.id} intitule={form.intitule} />
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    {editRow?.id ? 'Non disponible pour les voyages.' : 'Disponible après sauvegarde.'}
                  </p>
                )}
              </div>
            </div>
            {(pendingDocs.length > 0 || pendingFactures.length > 0) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Uploadés automatiquement après sauvegarde.</p>
            )}
          </div>}

    </>
  )

  // ── Shared: footer buttons ──────────────────────────────────────────────
  const formFooter = (
    <div className="flex gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex-wrap">
      <button onClick={() => save('publie')} disabled={saving}
        className="btn-primary py-1.5 px-5 text-sm disabled:opacity-50 flex items-center gap-2">
        {saving && savingAs === 'publie' && <Loader2 size={14} className="animate-spin" />}
        {saving && savingAs === 'publie' ? 'Publication…' : editRow?.id ? '✓ Sauvegarder les modifications' : '✓ Publier'}
      </button>
      <button onClick={() => save('brouillon')} disabled={saving}
        className="py-1.5 px-4 text-sm rounded-xl border border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 font-medium">
        {saving && savingAs === 'brouillon' && <Loader2 size={14} className="animate-spin" />}
        {saving && savingAs === 'brouillon' ? 'Enregistrement…' : editRow?.id ? '✎ Repasser en brouillon' : '✎ Brouillon'}
      </button>
      {!isPage && <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>}
      <div className="flex-1" />
      {isFinancier && editRow?.id && (
        <button type="button" onClick={async () => {
          if (!confirm('Supprimer définitivement cette activité ? Cette action est irréversible.')) return
          await supabase.from('activites').delete().eq('id', editRow.id)
          onSaved(); onClose()
        }} className="flex items-center gap-1.5 text-xs text-red-400 dark:text-red-300 hover:text-red-600 border border-red-200 dark:border-red-800 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors">
          <Trash2 size={13} /> Supprimer
        </button>
      )}
    </div>
  )

  // ── PAGE MODE (3 colonnes pleine page) ────────────────────────────────
  if (isPage) {
    const nbForPanel = hasSelection ? nbEleves : (parseInt(form.nb_eleves) || 0)
    return (
      <div className="flex h-full overflow-hidden">
        {/* Col 1/5 — Messagerie */}
        <div className="w-1/5 shrink-0 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
          <Commentaires
            entityType="activite"
            entityId={editRow.id}
            entityLabel={editRow.intitule || 'Activité'}
          />
        </div>

        {/* Col 2-3/5 — Documents & Factures */}
        <div className="w-2/5 shrink-0 overflow-hidden flex flex-col border-r border-gray-100 dark:border-gray-700">
          <DepensesPanel
            activiteId={editRow.id}
            type={form.type}
            nbTotalEleves={nbForPanel}
            staffPeople={staffPeopleForDepenses}
            participantEleves={participantEleves}
            pendingDocs={pendingDocs}
            setPendingDocs={setPendingDocs}
            savedDocs={savedDocs}
            viewDoc={viewDoc}
            delSavedDoc={delSavedDoc}
            pendingFactures={pendingFactures}
            setPendingFactures={setPendingFactures}
            savedFactures={savedFactures}
            intitule={form.intitule}
            formType={form.type}
            montantParEleveAnnonce={form.montant_par_eleve_annonce}
            acomptesConfig={form.acomptes_config || []}
            userId={userId}
          />
        </div>

        {/* Col 4-5/5 — Formulaire */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
          <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
                Champs manquants : {errors.map(e => FIELD_LABELS[e] || e).join(', ')}
              </div>
            )}
            {saveError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
                Erreur : {saveError}
              </div>
            )}
            {formFields}
          </div>
          {formFooter}
        </div>
      </div>
    )
  }

  // ── MODAL MODE (overlay classique) ────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleBackdropClose} />
      <div className="relative z-10 w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="font-bold text-gray-800 dark:text-gray-100 text-lg">{modalTitle}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT — Commentaires (mode édition uniquement) */}
          {editRow?.id && (
            <div className="w-[26rem] shrink-0 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
              <Commentaires
                entityType="activite"
                entityId={editRow.id}
                entityLabel={editRow.intitule || 'Activité'}
              />
            </div>
          )}

          {/* RIGHT — Formulaire */}
          <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
              Champs manquants : {errors.map(e => FIELD_LABELS[e] || e).join(', ')}
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
              Erreur : {saveError}
            </div>
          )}
          {formFields}
        </div>

        {formFooter}
          </div>{/* end RIGHT */}
        </div>{/* end two-column */}
      </div>
    </div>
  )
}

// ── Docs / Factures modal ─────────────────────────────────────────────────
function DocsModal({ row, categorie, onClose, onDocsChanged }) {
  const { user, profile } = useAuth()
  const isFacture = categorie === 'facture'
  const label = isFacture ? 'Factures' : 'Documents'
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const logDocEvent = async (action, filename) => {
    const auteurNom = profile
      ? `${profile.prenom || ''} ${profile.nom || ''}`.trim()
      : (user?.email || 'Inconnu')
    await supabase.from('commentaires').insert({
      entity_type: 'activite', entity_id: row.id,
      auteur_id: user?.id, auteur_nom: auteurNom,
      message: '', type: 'system',
      meta: { action, filename, categorie },
    })
  }

  const reload = useCallback(() =>
    supabase.from('activite_documents').select('*')
      .eq('activite_id', row.id).eq('categorie', categorie)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data || []))
  , [row.id, categorie])

  useEffect(() => { reload() }, [reload])

  const uploadFile = async file => {
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Seuls les fichiers PDF sont acceptés.'); return }
    setUploading(true)
    const uid = crypto.randomUUID()
    const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${categorie}/${row.id}/${uid}_${safeName}`
    const { error: storeErr } = await supabase.storage.from('activite-factures').upload(storagePath, file, { contentType: 'application/pdf' })
    if (storeErr) { alert('Erreur upload : ' + storeErr.message); setUploading(false); return }
    const { error: dbErr } = await supabase.from('activite_documents').insert({
      activite_id: row.id, nom_fichier: file.name, storage_path: storagePath, taille: file.size, categorie
    })
    if (dbErr) { alert('Erreur base de données : ' + dbErr.message); setUploading(false); return }
    try { await logDocEvent('doc_add', file.name) } catch {}
    await reload()
    if (onDocsChanged) onDocsChanged()
    setUploading(false)
  }
  const upload = async e => { await uploadFile(e.target.files[0]); e.target.value = '' }

  const view = async doc => {
    const { data } = await supabase.storage.from('activite-factures').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const del = async doc => {
    await supabase.storage.from('activite-factures').remove([doc.storage_path])
    await supabase.from('activite_documents').delete().eq('id', doc.id)
    try { await logDocEvent('doc_del', doc.nom_fichier) } catch {}
    await reload()
    if (onDocsChanged) onDocsChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{label} — {row.intitule}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={upload} />
          <div
            className={`rounded-xl border-2 border-dashed mb-4 p-4 text-center cursor-pointer transition-colors
              ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current.click()}
          >
            {uploading
              ? <p className="text-sm text-primary">Upload en cours…</p>
              : <p className="text-sm text-gray-400 dark:text-gray-500">Glisser-déposer ou <span className="text-primary dark:text-accent underline">parcourir</span></p>
            }
          </div>
          {docs.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Aucun document</p>}
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 text-sm">
              <span className="truncate text-gray-700 dark:text-gray-200 flex-1">{d.nom_fichier}</span>
              <div className="flex gap-2 ml-2">
                <button onClick={() => view(d)} className="text-primary text-xs hover:underline">Voir</button>
                <button onClick={() => del(d)} className="text-red-500 dark:text-red-400 text-xs hover:underline">Suppr.</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Activites() {
  const isMobile = useIsMobile()
  const { user, isAdmin, isFinancier, isMdp } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow]     = useState(null)
  const [unreadByActivity, setUnreadByActivity] = useState({}) // entity_id → count
  const [activitiesWithDocs, setActivitiesWithDocs] = useState(new Set())
  const [activitiesWithFactures, setActivitiesWithFactures] = useState(new Set())
  const [docsRow, setDocsRow]     = useState(null)
  const [docsCategorie, setDocsCategorie] = useState('document')
  const [quickFilter, setQuickFilter]     = useState(null) // null | 'passees' | 'avenir' | 'mes'
  const [mainTab, setMainTab]               = useState('intra_extra') // 'intra_extra' | 'voyages'
  const isEditPage = !!(editRow?.id && showModal)

  // Bloquer le scroll + supprimer padding/maxWidth de main en mode page
  useEffect(() => {
    const scrollEl = document.getElementById('page-content-scroll')
    const mainEl   = document.getElementById('page-main-content')
    if (!scrollEl) return
    if (isEditPage) {
      scrollEl.style.overflow = 'hidden'
      if (mainEl) {
        mainEl.style.padding  = '0'
        mainEl.style.maxWidth = 'none'
        mainEl.style.margin   = '0'
        mainEl.style.width    = '100%'
      }
    } else {
      scrollEl.style.overflow = ''
      if (mainEl) {
        mainEl.style.padding  = ''
        mainEl.style.maxWidth = ''
        mainEl.style.margin   = ''
        mainEl.style.width    = ''
      }
    }
    return () => {
      if (scrollEl) scrollEl.style.overflow = ''
      if (mainEl) {
        mainEl.style.padding  = ''
        mainEl.style.maxWidth = ''
        mainEl.style.margin   = ''
        mainEl.style.width    = ''
      }
    }
  }, [isEditPage])
  const [search, setSearch] = useState('')

  // Données pour le formulaire
  const [allEleves, setAllEleves]     = useState([])
  const [staffList, setStaffList]     = useState([])
  const [groupOptions, setGroupOptions] = useState([])
  const [allClasses, setAllClasses]   = useState([])

  useEffect(() => {
    Promise.all([
      // Eleves avec toutes les colonnes de groupes
      supabase.from('eleves').select(
        'id, nom, prenom, classe, obs_d2, ac_d2, math_d3, sciences_d3, bio_physique_d3, obs1_d3, obs2_d3, ac_d3, philosophie, groupe_choix_philo'
      ).eq('actif', true),
      // Staff
      supabase.from('profiles').select('id, nom, prenom, role').in('role', ['pedagogique', 'educatif', 'admin', 'direction']).order('nom'),
    ]).then(([elevesRes, staffRes]) => {
      const eleves = (elevesRes.data || []).map(e => ({ ...e, rlmo: getRlmo(e) }))
      setAllEleves(eleves)
      setAllClasses([...new Set(eleves.map(e => e.classe).filter(Boolean))].sort())

      // Générer les options de groupes depuis les colonnes
      const opts = []
      GROUP_COLS.forEach(({ key, label }) => {
        const vals = [...new Set(eleves.map(e => e[key]).filter(Boolean))].sort()
        vals.forEach(val => opts.push({ value: `${key}:${val}`, label: `${label} : ${val}` }))
      })
      setGroupOptions(opts)

      setStaffList((staffRes.data || []).map(p => ({
        value: p.id,
        label: `${p.prenom || ''} ${p.nom || ''}`.trim() || p.id,
      })))
    })
  }, [])

  const reloadDocsSets = useCallback(async () => {
    const { data } = await supabase.from('activite_documents').select('activite_id, categorie')
    const docs = data || []
    setActivitiesWithDocs(new Set(docs.filter(d => d.categorie === 'document').map(d => d.activite_id)))
    setActivitiesWithFactures(new Set(docs.filter(d => d.categorie === 'facture').map(d => d.activite_id)))
  }, [])

  const reload = useCallback(async () => {
    const [activitesRes, docsRes] = await Promise.all([
      supabase.from('activites').select('*').order('date_debut', { ascending: false }),
      supabase.from('activite_documents').select('activite_id, categorie'),
    ])
    setData(activitesRes.data || [])
    const docs = docsRes.data || []
    setActivitiesWithDocs(new Set(docs.filter(d => d.categorie === 'document').map(d => d.activite_id)))
    setActivitiesWithFactures(new Set(docs.filter(d => d.categorie === 'facture').map(d => d.activite_id)))
  }, [])

  useEffect(() => { reload().then(() => setLoading(false)) }, [reload])

  // ── Notifications non-lues par activité ────────────────────────────────
  const loadUnread = useCallback(async () => {
    if (!user) return
    const { data: notifs } = await supabase
      .from('notifications')
      .select('entity_id')
      .eq('destinataire_id', user.id)
      .eq('entity_type', 'activite')
      .eq('lu', false)
    const counts = {}
    for (const n of (notifs || [])) {
      counts[n.entity_id] = (counts[n.entity_id] || 0) + 1
    }
    setUnreadByActivity(counts)
  }, [user])

  useEffect(() => { loadUnread() }, [loadUnread])

  // Realtime : recharger les non-lus quand une notif arrive/est lue
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel(`activites-notifs:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `destinataire_id=eq.${user.id}`,
      }, () => loadUnread())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, loadUnread])

  // ── Deep-link ?open=<id> depuis une notification ────────────────────────
  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || !data.length) return
    const row = data.find(r => r.id === openId)
    if (row && canView(row)) {
      setEditRow(row)
      setShowModal(true)
      // Nettoyer le param URL sans rechargement
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('open'); return next }, { replace: true })
    }
  }, [searchParams, data]) // eslint-disable-line

  const openNew  = () => { setEditRow(null); setShowModal(true) }
  const openEdit = async row => {
    setEditRow(row)
    setShowModal(true)
    // Marquer les notifs de cette activité comme lues
    if (unreadByActivity[row.id] && user) {
      await supabase.from('notifications')
        .update({ lu: true })
        .eq('destinataire_id', user.id)
        .eq('entity_type', 'activite')
        .eq('entity_id', row.id)
        .eq('lu', false)
      setUnreadByActivity(prev => { const n = { ...prev }; delete n[row.id]; return n })
    }
  }
  const openDocs = (row, cat) => { setDocsRow(row); setDocsCategorie(cat) }


  const toggleFacturation = async (e, row) => {
    e.stopPropagation()
    const next = row.statut_facturation === 'en_attente' ? 'a_facturer' : 'en_attente'
    await supabase.from('activites').update({ statut_facturation: next }).eq('id', row.id)
    reload()
  }

  const canEdit   = row => isAdmin || isFinancier || (isMdp && row.created_by === user?.id)
  const canView   = row => isAdmin || isFinancier || (isMdp && (
    row.created_by === user?.id ||
    row.responsable_id === user?.id ||
    (row.accompagnateur_ids || []).includes(user?.id)
  ))
  const canCreate = isAdmin || isFinancier || isMdp

  const staffById = useMemo(() => Object.fromEntries(staffList.map(s => [s.value, s.label])), [staffList])

  // Helpers date
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const isPast    = r => r.date_debut && new Date(r.date_fin || r.date_debut) < today
  const isUpcoming = r => r.date_debut && new Date(r.date_debut) >= today
  const daysLabel = r => {
    if (!r.date_debut) return null
    const ref = isPast(r) ? new Date(r.date_fin || r.date_debut) : new Date(r.date_debut)
    const diff = Math.round((ref - today) / 86400000)
    if (diff === 0) return "Aujourd'hui"
    if (diff > 0)   return `Dans ${diff} jour${diff > 1 ? 's' : ''}`
    return `Il y a ${Math.abs(diff)} jour${Math.abs(diff) > 1 ? 's' : ''}`
  }

  const mainTypes = mainTab === 'intra_extra' ? ['extramuros', 'intramuros'] : ['voyage']

  const displayed = data
    .filter(r => mainTypes.includes(r.type))
    .filter(r => r.statut !== 'archive')
    .filter(r => isAdmin || isFinancier || r.created_by === user?.id || r.responsable_id === user?.id || (r.accompagnateur_ids || []).includes(user?.id) || r.statut === 'publie')
    .filter(r => {
      if (!search) return true
      const q = search.toLowerCase()
      if ((r.intitule || '').toLowerCase().includes(q)) return true
      const staffIds = [r.responsable_id, ...(r.accompagnateur_ids || [])].filter(Boolean)
      if (staffIds.some(id => (staffById[id] || '').toLowerCase().includes(q))) return true
      if ((r.classes_incluses || []).some(c => c.toLowerCase().includes(q))) return true
      if ((r.groupes_inclus || []).some(g => {
        const opt = groupOptions.find(o => o.value === g)
        return opt?.label.toLowerCase().includes(q)
      })) return true
      return allEleves.some(e => {
        const name = `${e.nom || ''} ${e.prenom || ''}`.toLowerCase().trim()
        if (!name.includes(q)) return false
        if ((r.classes_incluses || []).includes(e.classe)) return true
        return (r.groupes_inclus || []).some(g => {
          const [col, val] = g.split(':')
          return (col === 'rlmo' ? getRlmo(e) : e[col]) === val
        })
      })
    })
    .filter(r => {
      if (quickFilter === 'passees')  return isPast(r)
      if (quickFilter === 'avenir')   return isUpcoming(r)
      if (quickFilter === 'mes')      return r.responsable_id === user?.id || (r.accompagnateur_ids || []).includes(user?.id)
      return true
    })



  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>

  const generatePDF = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session?.access_token) { alert('Session expirée, veuillez vous reconnecter.'); return }
    try {
      const resp = await fetch('/.netlify/functions/activites-rapport-pdf', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!resp.ok) { alert(`Erreur ${resp.status}: ${await resp.text()}`); return }
      const html = await resp.text()
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch(e) { alert('Erreur lors de la génération du rapport.') }
  }

  const mainTabs = [
    { key: 'intra_extra', label: 'Intra-Extramuros' },
    { key: 'voyages',     label: 'Voyages' },
  ]
  const quickTabs = [
    { key: 'avenir',  label: 'À venir',       color: '#22c55e' },
    { key: 'passees', label: 'Passées',        color: '#ef4444' },
    ...(isAdmin || isFinancier ? [{ key: 'mes', label: 'Mes activités', color: '#f97316' }] : []),
  ]

  return (
    <div className={isEditPage ? 'flex flex-col h-full overflow-hidden' : ''}
    >
    <PageHeader
      title="Activités"
      subtitle="Gestion des activités scolaires et extrascolaires"
      leftActions={
        <div className="flex items-center gap-2">
          {isEditPage && (
            <>
              <button
                onClick={() => { setShowModal(false); setEditRow(null) }}
                className="flex items-center gap-1 text-white/80 hover:text-white text-xs font-medium transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
                <ChevronLeft size={15} /> Retour
              </button>
              <div className="w-px self-stretch" style={{ backgroundColor: 'rgba(255,255,255,0.20)' }} />
            </>
          )}
          <div className="flex items-center p-0.5 rounded-lg shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
            {mainTabs.map(t => (
              <button key={t.key} onClick={() => { if (!isEditPage) { setMainTab(t.key); setQuickFilter(null) } }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mainTab === t.key ? 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 shadow-sm' : 'text-white/60 hover:text-white/90'} ${isEditPage ? 'opacity-50 cursor-default' : ''}`}>
                {t.label}
              </button>
            ))}
          </div>
          {!isEditPage && <div className="w-px self-stretch" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />}
          {!isEditPage && quickTabs.map(t => (
            <button key={t.key}
              onClick={() => setQuickFilter(q => q === t.key ? null : t.key)}
              className="text-xs cursor-pointer select-none transition-all"
              style={{
                color: quickFilter === t.key ? t.color : 'rgba(255,255,255,0.50)',
                fontWeight: quickFilter === t.key ? 600 : 400,
                background: 'none', border: 'none', padding: 0
              }}>
              {t.label}
            </button>
          ))}
        </div>
      }
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Rechercher par titre, staff, classe, groupe, élève…"
      info={`${displayed.length} résultat${displayed.length !== 1 ? 's' : ''}`}
      actions={
        !isMobile && ((isAdmin || isFinancier) || canCreate) ? (
          <>
            {(isAdmin || isFinancier) && (
              <button onClick={generatePDF}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
                📄 Rapport PDF
              </button>
            )}
            {canCreate && (
              <button onClick={openNew} className="btn-primary text-xs py-1.5 px-3">
                {mainTab === 'voyages' ? 'Nouveau voyage' : 'Nouvelle activité'}
              </button>
            )}
          </>
        ) : null
      }
    />
    {isEditPage ? (
      <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ActivityModal
          isPage={true}
          editRow={editRow}
          isAdmin={isAdmin}
          isFinancier={isFinancier || isAdmin}
          userId={user?.id}
          allEleves={allEleves}
          staffList={staffList}
          groupOptions={groupOptions}
          allClasses={allClasses}
          onClose={() => { setShowModal(false); setEditRow(null); reload() }}
          onSaved={reload}
          allowedTypes={mainTab === 'intra_extra' ? ['extramuros', 'intramuros'] : ['voyage']}
          defaultType={mainTab === 'intra_extra' ? 'extramuros' : 'voyage'}
        />
      </div>
    ) : (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="grid gap-3">
        {displayed.length === 0 && <div className="card p-8 text-center text-gray-400 dark:text-gray-500">Aucune activité</div>}
        {displayed.map(row => {
          const responsableLabel = row.responsable_id ? staffById[row.responsable_id] : row.responsable
          const accompagnateurLabels = (row.accompagnateur_ids || [])
            .filter(id => id !== row.responsable_id)
            .map(id => staffById[id]).filter(Boolean)
          const classChips = row.classes_incluses || []
          const groupChips = (row.groupes_inclus || []).map(g => {
            const opt = groupOptions.find(o => o.value === g)
            return opt ? (opt.label.split(' : ')[1] || opt.label) : (g.split(':')[1] || g)
          })
          const allChips = [...classChips, ...groupChips]
          const MAX_CHIPS = 6
          const past    = isPast(row)
          const upcoming = isUpcoming(row)
          const dayHint  = daysLabel(row)
          const cardAccent = past
            ? 'border-l-4 border-l-red-300 bg-red-50/40'
            : upcoming
              ? 'border-l-4 border-l-green-400 bg-green-50/30'
              : ''

          return (
            <div key={row.id}
              className={`card p-5 hover:shadow-md transition-shadow ${canView(row) ? 'cursor-pointer' : ''} ${cardAccent}`}
              onClick={() => canView(row) && openEdit(row)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">

                  {/* Ligne 1 — Titre + badges statut */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{row.intitule}</span>
                    {unreadByActivity[row.id] > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                        bg-red-500 text-white text-[10px] font-bold rounded-full leading-none"
                        title={`${unreadByActivity[row.id]} message${unreadByActivity[row.id] > 1 ? 's' : ''} non lu${unreadByActivity[row.id] > 1 ? 's' : ''}`}>
                        {unreadByActivity[row.id] > 9 ? '9+' : unreadByActivity[row.id]}
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[row.statut] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                      {row.statut === 'brouillon' ? 'Brouillon' : row.statut === 'publie' ? 'Publié' : 'Archivé'}
                    </span>
                    {(isFinancier || isAdmin) && row.statut_facturation && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FACT_COLORS[row.statut_facturation] || 'bg-gray-100 dark:bg-gray-700'}`}>
                        {FACT_LABELS[row.statut_facturation] || row.statut_facturation}
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                      {TYPE_LABELS[row.type] || row.type}
                    </span>
                  </div>

                  {/* Ligne 2 — Classes + Groupes */}
                  {allChips.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {allChips.slice(0, MAX_CHIPS).map((chip, i) => (
                        <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-2 py-0.5 leading-tight">{chip}</span>
                      ))}
                      {allChips.length > MAX_CHIPS && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 py-0.5 pl-0.5">+{allChips.length - MAX_CHIPS}</span>
                      )}
                    </div>
                  )}

                  {/* Ligne 3 — Date, lieu, élèves, montant, POP */}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 dark:text-gray-500 mb-1">
                    <span>📅 {fmtDate(row.date_debut)}{row.date_fin ? ` → ${fmtDate(row.date_fin)}` : ''}
                      {dayHint && (
                        <span className={`ml-1.5 font-medium ${past ? 'text-red-400' : upcoming ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`}>
                          · {dayHint}
                        </span>
                      )}
                    </span>
                    {(row.local || row.lieu) && <span>📍 {row.local || row.lieu}</span>}
                    {row.nb_eleves && <span>👥 {row.nb_eleves} élève{row.nb_eleves !== 1 ? 's' : ''}</span>}
                    {row.montant_total && <span>💶 {fmt(row.montant_total)} total{row.montant_par_eleve ? ` · ${fmt(row.montant_par_eleve)}/élève` : ''}</span>}
                    {row.pop && <span className="text-orange-500 dark:text-orange-400">🏛 POP : {fmt(row.pop)}</span>}
                  </div>

                  {/* Ligne 4 — Personnel */}
                  {(responsableLabel || accompagnateurLabels.length > 0) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      {responsableLabel && (
                        <span className="text-primary/80 dark:text-accent/80">👤 {responsableLabel}</span>
                      )}
                      {accompagnateurLabels.length > 0 && (
                        <span className="text-teal-600 dark:text-teal-400">🤝 {accompagnateurLabels.join(' · ')}</span>
                      )}
                    </div>
                  )}

                </div>
                <div className="flex gap-2 flex-shrink-0 items-start flex-wrap justify-end">
                <button onClick={e => { e.stopPropagation(); openDocs(row, 'document') }}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors border ${
                    activitiesWithDocs.has(row.id)
                      ? 'text-primary border-primary/40 bg-primary/5 font-medium hover:bg-primary/10'
                      : 'text-gray-500 dark:text-gray-400 hover:text-primary border-gray-200 dark:border-gray-600 hover:border-primary'
                  }`}>
                  <FileText size={12} /> Docs
                </button>
                <button onClick={e => { e.stopPropagation(); openDocs(row, 'facture') }}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors border ${
                    activitiesWithFactures.has(row.id)
                      ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950 font-medium hover:bg-emerald-100'
                      : 'text-gray-500 dark:text-gray-400 hover:text-primary border-gray-200 dark:border-gray-600 hover:border-primary'
                  }`}>
                  <Receipt size={12} /> Factures
                </button>

                {(isFinancier || isAdmin) && row.statut !== 'brouillon' && row.statut_facturation && row.statut_facturation !== 'non_payant' && row.statut_facturation !== 'facture' && row.statut_facturation !== 'partiellement_facture' && (
                  <button onClick={e => toggleFacturation(e, row)}
                    title={row.statut_facturation === 'en_attente' ? 'Marquer À facturer' : 'Revenir En attente'}
                    className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors border font-medium ${
                      row.statut_facturation === 'a_facturer'
                        ? 'text-yellow-700 dark:text-yellow-300 border-yellow-300 bg-yellow-50 dark:bg-yellow-950 hover:bg-yellow-100'
                        : 'text-orange-600 dark:text-orange-400 border-orange-200 bg-orange-50 dark:bg-orange-950 hover:bg-orange-100'
                    }`}>
                    <CheckCheck size={12} />
                    {row.statut_facturation === 'a_facturer' ? 'À facturer' : 'En attente'}
                  </button>
                )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && !editRow?.id && (
        <ActivityModal
          isPage={false}
          editRow={editRow}
          isAdmin={isAdmin}
          isFinancier={isFinancier || isAdmin}
          userId={user?.id}
          allEleves={allEleves}
          staffList={staffList}
          groupOptions={groupOptions}
          allClasses={allClasses}
          onClose={() => setShowModal(false)}
          onSaved={reload}
          allowedTypes={mainTab === 'intra_extra' ? ['extramuros', 'intramuros'] : ['voyage']}
          defaultType={mainTab === 'intra_extra' ? 'extramuros' : 'voyage'}
        />
      )}
      {docsRow && <DocsModal row={docsRow} categorie={docsCategorie} onClose={() => setDocsRow(null)} onDocsChanged={reloadDocsSets} />}
    </div>
    )}
    </div>
  )
}
