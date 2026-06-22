import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Commentaires from '../components/ui/Commentaires'
import { useAuth } from '../context/AuthContext'
import { Search, X, FileText, Receipt, ChevronDown, Plus, Loader2, Trash2, CheckCheck } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const fmt = n => Number(n || 0).toFixed(2) + ' €'
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_COLORS = {
  brouillon: 'bg-gray-100 text-gray-600',
  publie:    'bg-blue-100 text-blue-700',
  archive:   'bg-orange-100 text-orange-700',
}
const FACT_COLORS = {
  en_attente: 'bg-orange-100 text-orange-700',
  a_facturer: 'bg-yellow-100 text-yellow-700',
  facture:              'bg-green-100 text-green-700',
  partiellement_facture: 'bg-blue-100 text-blue-700',
  non_payant:           'bg-gray-100 text-gray-500',
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
  montant_total: '', pop: '',
  statut: 'brouillon', statut_facturation: 'en_attente',
  gare_depart: '', gare_arrivee: '', pmr: '', ligne_tec: '',
  responsable_id: null,
  accompagnateur_ids: [],
  eleves_exclus: [],
  classes_incluses: [],
  groupes_inclus: [],   // text[] format "col:valeur"
  classes_exclues: [],
  groupes_exclus: [],   // text[] format "col:valeur"
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
              <input autoFocus
                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
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
                  {/* Radio pour single, checkbox pour multi */}
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
  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${badge === 'add' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
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

// ── Staged file upload avec drag & drop ────────────────────────────────────
function AvisGenerator({ activiteId, intitule }) {
  const { supabase } = useAuth()
  const [loading, setLoading] = React.useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session?.access_token) { alert('Session expirée, veuillez vous reconnecter.'); return }
      const token = encodeURIComponent(session.access_token)
      const url = `/.netlify/functions/activite-avis-pdf?id=${activiteId}&token=${token}`
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${session.access_token}` } })
      if (!resp.ok) { alert(`Erreur ${resp.status}: ${await resp.text()}`); return }
      const html = await resp.text()
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch(e) { alert("Erreur lors de la génération de l'avis.") }
    finally { setLoading(false) }
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-800 border border-orange-200 hover:border-orange-400 bg-orange-50 hover:bg-orange-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
        {loading ? <Loader2 size={12} className="animate-spin" /> : '📄'}
        {loading ? 'Génération…' : "Générer l'avis"}
      </button>
      <p className="text-xs text-gray-400 mt-1.5 leading-tight">
        Ouvre un PDF imprimable à destination des parents.
      </p>
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
          ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => ref.current.click()}
      >
        <input ref={ref} type="file" accept="application/pdf" multiple className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = '' }} />
        {files.length === 0
          ? <p className="text-xs text-gray-400">Glisser-déposer ou <span className="text-primary underline">parcourir</span></p>
          : <div className="flex flex-wrap gap-1.5 justify-center" onClick={e => e.stopPropagation()}>
              {files.map(f => (
                <span key={f.name} className="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">
                  {f.name}
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setFiles(p => p.filter(x => x.name !== f.name)) }}
                    className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Activity form modal ────────────────────────────────────────────────────
function ActivityModal({ editRow, isFinancier, isAdmin, userId, allEleves, staffList, groupOptions, allClasses, onClose, onSaved, allowedTypes, defaultType }) {
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

  const f = (k, v) => setForm(p => {
    const next = { ...p, [k]: v }
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

  const hasSelection = form.classes_incluses.length > 0 || form.groupes_inclus.length > 0
  const nbEleves = useMemo(() => calcNbEleves(allEleves, form),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEleves, form.classes_incluses, form.groupes_inclus, form.classes_exclues, form.groupes_exclus, form.eleves_exclus])

  const eleveOptions = useMemo(() =>
    allEleves
      .map(e => ({ value: e.id, label: `${e.nom || ''} ${e.prenom || ''} (${e.classe || ''})`.trim() }))
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
    statut: 'Statut', description: 'Description', nb_eleves: 'Nb élèves',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleBackdropClose} />
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-800 text-lg">{modalTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT — Commentaires (mode édition uniquement) */}
          {editRow?.id && (
            <div className="w-[26rem] shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
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
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              Champs manquants : {errors.map(e => FIELD_LABELS[e] || e).join(', ')}
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              Erreur : {saveError}
            </div>
          )}

          {/* Infos générales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Intitulé *</label>
              <input className="input" value={form.intitule} onChange={e => f('intitule', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.type} onChange={e => f('type', e.target.value)}
                disabled={allowedTypes && allowedTypes.length === 1}>
                {(!allowedTypes || allowedTypes.includes('extramuros')) && <option value="extramuros">Extramuros</option>}
                {(!allowedTypes || allowedTypes.includes('intramuros')) && <option value="intramuros">Intramuros</option>}
                {(!allowedTypes || allowedTypes.includes('voyage')) && <option value="voyage">Voyage scolaire</option>}
              </select>
            </div>
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
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Personnel</h3>
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
                <div className="input bg-gray-50 text-gray-600 text-sm py-2">
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
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Participants</h3>
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

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="label">
                    Nb d'élèves
                    {hasSelection && <span className="ml-2 text-xs text-green-600 font-normal">(calculé auto.)</span>}
                  </label>
                  {hasSelection
                    ? <div className="input bg-green-50 text-green-700 font-semibold">{nbEleves} élève{nbEleves !== 1 ? 's' : ''}</div>
                    : <input className="input" type="number" value={form.nb_eleves || ''} onChange={e => f('nb_eleves', e.target.value)} />
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Logistique extramuros / voyage */}
          {(form.type === 'extramuros' || form.type === 'voyage') && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Logistique</h3>
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
                          className="rounded border-gray-300"
                          checked={(form.type_transport_list || []).includes(opt.value)}
                          onChange={e => {
                            const cur = form.type_transport_list || []
                            f('type_transport_list', e.target.checked
                              ? [...cur, opt.value]
                              : cur.filter(v => v !== opt.value))
                          }} />
                        <span className="text-sm text-gray-700">{opt.label}</span>
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
                    <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">SNCB</p>
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
                              <span className="text-sm capitalize">{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TEC — gares + heure retour + ligne */}
                  {(form.type_transport_list || []).includes('tec') && (
                    <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200 space-y-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">TEC</p>
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
                    <div className="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200 flex items-start gap-2">
                      <span className="text-yellow-600 text-base mt-0.5">ℹ️</span>
                      <p className="text-sm text-yellow-800">
                        Contacter l'économe pour réserver les tickets sur l'application De Lijn.
                      </p>
                    </div>
                  )}

                  {/* Flixbus — gares + heure retour */}
                  {(form.type_transport_list || []).includes('flixbus') && (
                    <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-300 space-y-3">
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
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Logistique</h3>
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
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Finances</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Montant total (€)</label>
                <input className="input" type="number" step="0.01" value={form.montant_total} onChange={e => f('montant_total', e.target.value)} />
              </div>
              <div>
                <label className="label">POP (€)</label>
                {isFinancier
                  ? <input className="input" type="number" step="0.01" value={form.pop} onChange={e => f('pop', e.target.value)} />
                  : <div className="input bg-gray-50 text-gray-600">{form.pop ? fmt(parseFloat(form.pop)) : '—'}</div>
                }
              </div>
              <div><label className="label">Montant par élève (calculé)</label>
                <div className="input bg-gray-50 text-gray-600">{montantParEleve !== null ? fmt(montantParEleve) : '—'}</div>
              </div>


              {isFinancier && (
                <div className="col-span-2"><label className="label">Statut facturation</label>
                  {form.statut_facturation === 'non_payant' ? (
                    <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">Non payant</span>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { val: 'en_attente', label: 'En attente', active: 'bg-orange-50 border-orange-400 text-orange-700', idle: 'border-gray-200 text-gray-400' },
                        { val: 'a_facturer', label: 'À facturer', active: 'bg-yellow-50 border-yellow-400 text-yellow-700', idle: 'border-gray-200 text-gray-400' },
                        { val: 'facture',    label: 'Facturé',    active: 'bg-green-50 border-green-500 text-green-700',  idle: 'border-gray-200 text-gray-400' },
                      ].map(({ val, label, active, idle }) => {
                        const locked = form.statut === 'brouillon' && val !== 'en_attente'
                        return (
                          <button key={val} type="button"
                            onClick={() => !locked && f('statut_facturation', val)}
                            title={locked ? "Publiez l'activité pour modifier ce statut" : undefined}
                            className={`px-4 py-1.5 text-sm rounded-lg border font-medium transition-all
                              ${locked
                                ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400'
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

          {/* Documents & Factures */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Documents & Factures</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <FileStage label="Documents (PDF)" files={pendingDocs} setFiles={setPendingDocs} />
                {savedDocs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {savedDocs.map(d => (
                      <li key={d.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="flex-1 truncate">{d.nom_fichier}</span>
                        <button type="button" onClick={() => viewDoc(d)} className="text-primary hover:underline shrink-0">Voir</button>
                        <button type="button" onClick={() => delSavedDoc(d)} className="text-red-400 hover:underline shrink-0">Suppr.</button>
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
                      <li key={d.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="flex-1 truncate">{d.nom_fichier}</span>
                        <button type="button" onClick={() => viewDoc(d)} className="text-primary hover:underline shrink-0">Voir</button>
                        <button type="button" onClick={() => delSavedDoc(d)} className="text-red-400 hover:underline shrink-0">Suppr.</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Générer avis</p>
                {editRow?.id && (form.type === 'extramuros' || form.type === 'intramuros') ? (
                  <AvisGenerator activiteId={editRow.id} intitule={form.intitule} />
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    {editRow?.id ? 'Non disponible pour les voyages.' : 'Disponible après sauvegarde.'}
                  </p>
                )}
              </div>
            </div>
            {(pendingDocs.length > 0 || pendingFactures.length > 0) && (
              <p className="text-xs text-gray-400 mt-2">Uploadés automatiquement après sauvegarde.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0 flex-wrap">
          <button onClick={() => save('publie')} disabled={saving}
            className="btn-primary py-1.5 px-5 text-sm disabled:opacity-50 flex items-center gap-2">
            {saving && savingAs === 'publie' && <Loader2 size={14} className="animate-spin" />}
            {saving && savingAs === 'publie' ? 'Publication…' : '✓ Publier'}
          </button>
          <button onClick={() => save('brouillon')} disabled={saving}
            className="py-1.5 px-4 text-sm rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5 font-medium">
            {saving && savingAs === 'brouillon' && <Loader2 size={14} className="animate-spin" />}
            {saving && savingAs === 'brouillon' ? 'Enregistrement…' : '✎ Brouillon'}
          </button>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
          <div className="flex-1" />

          {isFinancier && editRow?.id && (
            <button type="button" onClick={async () => {
              if (!confirm('Supprimer définitivement cette activité ? Cette action est irréversible.')) return
              await supabase.from('activites').delete().eq('id', editRow.id)
              onSaved(); onClose()
            }} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors">
              <Trash2 size={13} /> Supprimer
            </button>
          )}
        </div>
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{label} — {row.intitule}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={upload} />
          <div
            className={`rounded-xl border-2 border-dashed mb-4 p-4 text-center cursor-pointer transition-colors
              ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current.click()}
          >
            {uploading
              ? <p className="text-sm text-primary">Upload en cours…</p>
              : <p className="text-sm text-gray-400">Glisser-déposer ou <span className="text-primary underline">parcourir</span></p>
            }
          </div>
          {docs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun document</p>}
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
              <span className="truncate text-gray-700 flex-1">{d.nom_fichier}</span>
              <div className="flex gap-2 ml-2">
                <button onClick={() => view(d)} className="text-primary text-xs hover:underline">Voir</button>
                <button onClick={() => del(d)} className="text-red-500 text-xs hover:underline">Suppr.</button>
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
        'id, classe, obs_d2, ac_d2, math_d3, sciences_d3, bio_physique_d3, obs1_d3, obs2_d3, ac_d3, philosophie, groupe_choix_philo'
      ).eq('actif', true),
      // Staff
      supabase.from('profiles').select('id, nom, prenom, role').in('role', ['mdp', 'admin', 'financier']).order('nom'),
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



  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

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
    <>
    <PageHeader
      title="Activités"
      subtitle="Gestion des activités scolaires et extrascolaires"
      leftActions={
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
            {mainTabs.map(t => (
              <button key={t.key} onClick={() => { setMainTab(t.key); setQuickFilter(null) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mainTab === t.key ? 'bg-white text-green-700 shadow-sm' : 'text-white/60 hover:text-white/90'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="w-px self-stretch" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          {quickTabs.map(t => (
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
        (isAdmin || isFinancier) || canCreate ? (
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
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="grid gap-3">
        {displayed.length === 0 && <div className="card p-8 text-center text-gray-400">Aucune activité</div>}
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
                    <span className="font-semibold text-gray-800">{row.intitule}</span>
                    {unreadByActivity[row.id] > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                        bg-red-500 text-white text-[10px] font-bold rounded-full leading-none"
                        title={`${unreadByActivity[row.id]} message${unreadByActivity[row.id] > 1 ? 's' : ''} non lu${unreadByActivity[row.id] > 1 ? 's' : ''}`}>
                        {unreadByActivity[row.id] > 9 ? '9+' : unreadByActivity[row.id]}
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[row.statut] || 'bg-gray-100 text-gray-600'}`}>
                      {row.statut === 'brouillon' ? 'Brouillon' : row.statut === 'publie' ? 'Publié' : 'Archivé'}
                    </span>
                    {(isFinancier || isAdmin) && row.statut_facturation && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FACT_COLORS[row.statut_facturation] || 'bg-gray-100'}`}>
                        {FACT_LABELS[row.statut_facturation] || row.statut_facturation}
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                      {TYPE_LABELS[row.type] || row.type}
                    </span>
                  </div>

                  {/* Ligne 2 — Classes + Groupes */}
                  {allChips.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {allChips.slice(0, MAX_CHIPS).map((chip, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 leading-tight">{chip}</span>
                      ))}
                      {allChips.length > MAX_CHIPS && (
                        <span className="text-xs text-gray-400 py-0.5 pl-0.5">+{allChips.length - MAX_CHIPS}</span>
                      )}
                    </div>
                  )}

                  {/* Ligne 3 — Date, lieu, élèves, montant, POP */}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 mb-1">
                    <span>📅 {fmtDate(row.date_debut)}{row.date_fin ? ` → ${fmtDate(row.date_fin)}` : ''}
                      {dayHint && (
                        <span className={`ml-1.5 font-medium ${past ? 'text-red-400' : upcoming ? 'text-green-600' : 'text-amber-500'}`}>
                          · {dayHint}
                        </span>
                      )}
                    </span>
                    {(row.local || row.lieu) && <span>📍 {row.local || row.lieu}</span>}
                    {row.nb_eleves && <span>👥 {row.nb_eleves} élève{row.nb_eleves !== 1 ? 's' : ''}</span>}
                    {row.montant_total && <span>💶 {fmt(row.montant_total)} total{row.montant_par_eleve ? ` · ${fmt(row.montant_par_eleve)}/élève` : ''}</span>}
                    {row.pop && <span className="text-orange-500">🏛 POP : {fmt(row.pop)}</span>}
                  </div>

                  {/* Ligne 4 — Personnel */}
                  {(responsableLabel || accompagnateurLabels.length > 0) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      {responsableLabel && (
                        <span className="text-primary/80">👤 {responsableLabel}</span>
                      )}
                      {accompagnateurLabels.length > 0 && (
                        <span className="text-teal-600">🤝 {accompagnateurLabels.join(' · ')}</span>
                      )}
                    </div>
                  )}

                </div>
                <div className="flex gap-2 flex-shrink-0 items-start flex-wrap justify-end">
                <button onClick={e => { e.stopPropagation(); openDocs(row, 'document') }}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors border ${
                    activitiesWithDocs.has(row.id)
                      ? 'text-primary border-primary/40 bg-primary/5 font-medium hover:bg-primary/10'
                      : 'text-gray-500 hover:text-primary border-gray-200 hover:border-primary'
                  }`}>
                  <FileText size={12} /> Docs
                </button>
                <button onClick={e => { e.stopPropagation(); openDocs(row, 'facture') }}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors border ${
                    activitiesWithFactures.has(row.id)
                      ? 'text-emerald-600 border-emerald-300 bg-emerald-50 font-medium hover:bg-emerald-100'
                      : 'text-gray-500 hover:text-primary border-gray-200 hover:border-primary'
                  }`}>
                  <Receipt size={12} /> Factures
                </button>

                {(isFinancier || isAdmin) && row.statut !== 'brouillon' && row.statut_facturation && row.statut_facturation !== 'non_payant' && row.statut_facturation !== 'facture' && row.statut_facturation !== 'partiellement_facture' && (
                  <button onClick={e => toggleFacturation(e, row)}
                    title={row.statut_facturation === 'en_attente' ? 'Marquer À facturer' : 'Revenir En attente'}
                    className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors border font-medium ${
                      row.statut_facturation === 'a_facturer'
                        ? 'text-yellow-700 border-yellow-300 bg-yellow-50 hover:bg-yellow-100'
                        : 'text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100'
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

      {showModal && (
        <ActivityModal
          editRow={editRow}
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
    </>
  )
}
