import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FilterPill from '../components/ui/FilterPill'
import { Search, X, FileText, Pencil, Archive, Receipt, ChevronDown, Plus, Loader2 } from 'lucide-react'

const fmt = n => Number(n || 0).toFixed(2) + ' €'
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_COLORS = {
  brouillon: 'bg-gray-100 text-gray-600',
  publie:    'bg-blue-100 text-blue-700',
  archive:   'bg-orange-100 text-orange-700',
}
const FACT_COLORS = {
  a_facturer: 'bg-yellow-100 text-yellow-700',
  facture:    'bg-green-100 text-green-700',
}
const TYPE_LABELS = { extramuros: 'Extramuros', intramuros: 'Intramuros', voyage: 'Voyage' }

const EMPTY = {
  intitule: '', description: '', type: 'extramuros',
  date_debut: '', date_fin: '',
  lieu: '', heure_rdv: '', heure_depart: '', heure_retour: '',
  lieu_rdv: '', lieu_retour: '', type_transport: '', tel_organisateur: '', tel_sejour: '',
  local: '', heure_debut: '', heure_fin: '',
  montant_total: '', pop: '',
  statut: 'brouillon', statut_facturation: 'a_facturer',
  // new fields
  responsable_id: null,
  accompagnateur_ids: [],
  classes_incluses: [],
  groupes_inclus: [],
  classes_exclues: [],
  groupes_exclus: [],
}

function validate(form) {
  const miss = ['intitule', 'type', 'date_debut'].filter(k => !form[k])
  if (form.type === 'extramuros' || form.type === 'voyage') {
    if (!form.lieu) miss.push('lieu')
    if (!form.heure_depart) miss.push('heure_depart')
    if (!form.heure_retour) miss.push('heure_retour')
    if (!form.lieu_rdv) miss.push('lieu_rdv')
    if (!form.type_transport) miss.push('type_transport')
  }
  if (form.type === 'voyage' && !form.date_fin) miss.push('date_fin')
  if (form.type === 'intramuros') {
    if (!form.local) miss.push('local')
    if (!form.heure_debut) miss.push('heure_debut')
    if (!form.heure_fin) miss.push('heure_fin')
  }
  return miss
}

// ── Composant générique multi-select avec recherche ────────────────────────
function MultiSearchSelect({ options, value, onChange, placeholder, labelKey = 'label', valueKey = 'value', single = false }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() =>
    options.filter(o => {
      const lbl = typeof o === 'string' ? o : o[labelKey]
      return lbl.toLowerCase().includes(q.toLowerCase())
    }), [options, q, labelKey])

  const getVal = o => typeof o === 'string' ? o : o[valueKey]
  const getLbl = o => typeof o === 'string' ? o : o[labelKey]

  const isSelected = v => single
    ? value === v
    : (Array.isArray(value) && value.includes(v))

  const toggle = v => {
    if (single) {
      onChange(value === v ? null : v)
      setOpen(false)
    } else {
      const arr = Array.isArray(value) ? value : []
      onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
    }
  }

  const selectedOptions = options.filter(o => isSelected(getVal(o)))

  return (
    <div ref={ref} className="relative">
      {/* Tags / selected */}
      <div
        className="input cursor-pointer flex flex-wrap gap-1 items-center min-h-[38px]"
        onClick={() => setOpen(o => !o)}
      >
        {selectedOptions.length === 0 && (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        )}
        {single && selectedOptions.length > 0 && (
          <span className="text-gray-700 text-sm">{getLbl(selectedOptions[0])}</span>
        )}
        {!single && selectedOptions.map(o => (
          <span key={getVal(o)} className="flex items-center gap-1 bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
            {getLbl(o)}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(getVal(o)) }}
              className="hover:text-red-500">×</button>
          </span>
        ))}
        <ChevronDown size={14} className="ml-auto text-gray-400 shrink-0" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-56 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus
                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                placeholder="Rechercher…"
                value={q} onChange={e => setQ(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>}
            {filtered.map(o => {
              const v = getVal(o); const l = getLbl(o)
              const sel = isSelected(v)
              return (
                <button key={v} type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${sel ? 'text-primary font-medium' : 'text-gray-700'}`}
                  onClick={() => toggle(v)}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                    {sel && <span className="text-white text-xs">✓</span>}
                  </span>
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
function SelectionEleves({ label, classes, setClasses, groupes, setGroupes, allClasses, allGroupes, badge }) {
  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${badge === 'add' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {badge === 'add' ? '+ Ajouter élèves de' : '− Retirer élèves de'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Classes</label>
          <MultiSearchSelect
            options={allClasses}
            value={classes}
            onChange={setClasses}
            placeholder="Choisir des classes…"
          />
        </div>
        <div>
          <label className="label">Groupes</label>
          <MultiSearchSelect
            options={allGroupes}
            value={groupes}
            onChange={setGroupes}
            placeholder="Choisir des groupes…"
            labelKey="nom" valueKey="id"
          />
        </div>
      </div>
    </div>
  )
}

// ── Calcul nb élèves ────────────────────────────────────────────────────────
function calcNbEleves(allEleves, elevesParGroupe, form) {
  const { classes_incluses, groupes_inclus, classes_exclues, groupes_exclus } = form
  if (!allEleves.length) return 0

  const hasAddClasses = classes_incluses.length > 0
  const hasAddGroupes = groupes_inclus.length > 0

  if (!hasAddClasses && !hasAddGroupes) return 0

  // Build add set
  let addSet = new Set()
  if (hasAddClasses && hasAddGroupes) {
    // Intersection : élèves dans les classes ET dans les groupes
    const inClasses = new Set(allEleves.filter(e => classes_incluses.includes(e.classe)).map(e => e.id))
    const inGroupes = new Set()
    groupes_inclus.forEach(gid => (elevesParGroupe[gid] || []).forEach(eid => inGroupes.add(eid)))
    inClasses.forEach(id => inGroupes.has(id) && addSet.add(id))
  } else if (hasAddClasses) {
    allEleves.filter(e => classes_incluses.includes(e.classe)).forEach(e => addSet.add(e.id))
  } else {
    groupes_inclus.forEach(gid => (elevesParGroupe[gid] || []).forEach(eid => addSet.add(eid)))
  }

  // Build remove set (union)
  const removeSet = new Set()
  allEleves.filter(e => classes_exclues.includes(e.classe)).forEach(e => removeSet.add(e.id))
  groupes_exclus.forEach(gid => (elevesParGroupe[gid] || []).forEach(eid => removeSet.add(eid)))

  // Final count
  let count = 0
  addSet.forEach(id => !removeSet.has(id) && count++)
  return count
}

// ── Staged file upload ──────────────────────────────────────────────────────
function FileStage({ label, files, setFiles, accept = 'application/pdf' }) {
  const ref = useRef()
  const add = e => {
    const f = Array.from(e.target.files)
    setFiles(prev => [...prev, ...f.filter(nf => !prev.some(pf => pf.name === nf.name))])
    e.target.value = ''
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="label mb-0">{label}</label>
        <button type="button" onClick={() => ref.current.click()}
          className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus size={11} /> Ajouter
        </button>
      </div>
      <input ref={ref} type="file" accept={accept} multiple className="hidden" onChange={add} />
      {files.length === 0
        ? <p className="text-xs text-gray-400 italic">Aucun fichier sélectionné</p>
        : <div className="flex flex-wrap gap-1.5 mt-1">
            {files.map(f => (
              <span key={f.name} className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2.5 py-1">
                {f.name}
                <button type="button" onClick={() => setFiles(p => p.filter(x => x.name !== f.name))}
                  className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
      }
    </div>
  )
}

// ── Activity form modal ────────────────────────────────────────────────────
function ActivityModal({ editRow, isFinancier, userId, allEleves, allGroupes, elevesParGroupe, onClose, onSaved }) {
  const allClasses = useMemo(() => [...new Set(allEleves.map(e => e.classe).filter(Boolean))].sort(), [allEleves])
  const staffOptions = useMemo(() => allGroupes.__staff__ || [], [allGroupes])

  const initForm = editRow ? {
    ...EMPTY, ...editRow,
    accompagnateur_ids: editRow.accompagnateur_ids || [],
    classes_incluses: editRow.classes_incluses || [],
    groupes_inclus: editRow.groupes_inclus || [],
    classes_exclues: editRow.classes_exclues || [],
    groupes_exclus: editRow.groupes_exclus || [],
  } : { ...EMPTY }

  const [form, setForm] = useState(initForm)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [pendingDocs, setPendingDocs] = useState([])
  const [pendingFactures, setPendingFactures] = useState([])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const nbEleves = useMemo(() =>
    calcNbEleves(allEleves, elevesParGroupe, form),
    [allEleves, elevesParGroupe, form.classes_incluses, form.groupes_inclus, form.classes_exclues, form.groupes_exclus]
  )
  const hasSelection = form.classes_incluses.length > 0 || form.groupes_inclus.length > 0

  const montantParEleve = hasSelection && nbEleves > 0 && form.montant_total
    ? ((parseFloat(form.montant_total || 0) - parseFloat(form.pop || 0)) / nbEleves)
    : (form.montant_total && form.nb_eleves
        ? ((parseFloat(form.montant_total || 0) - parseFloat(form.pop || 0)) / Math.max(parseInt(form.nb_eleves || 1), 1))
        : null)

  const displayedNbEleves = hasSelection ? nbEleves : (form.nb_eleves || '')

  const FIELD_LABELS = {
    intitule: 'Intitulé', type: 'Type', date_debut: 'Date de début',
    lieu: 'Lieu', heure_depart: 'Heure de départ', heure_retour: 'Heure de retour',
    lieu_rdv: 'Lieu de RDV', type_transport: 'Type de transport',
    date_fin: 'Date de retour', local: 'Local',
    heure_debut: 'Heure de début', heure_fin: 'Heure de fin',
  }

  const uploadStagedFiles = async (activiteId) => {
    const uploadFiles = async (files, categorie) => {
      for (const file of files) {
        const path = `${categorie}/${activiteId}/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('activite-factures').upload(path, file)
        if (!error) {
          await supabase.from('activite_documents').insert({
            activite_id: activiteId, nom: file.name, chemin: path, taille: file.size, categorie
          })
        }
      }
    }
    await uploadFiles(pendingDocs, 'document')
    await uploadFiles(pendingFactures, 'facture')
  }

  const save = async () => {
    const miss = validate(form)
    if (miss.length > 0) { setErrors(miss); return }
    setSaving(true); setSaveError(null)

    const payload = Object.fromEntries(
      Object.entries({
        ...form,
        nb_eleves: hasSelection ? nbEleves : (form.nb_eleves || null),
        montant_par_eleve: montantParEleve ? montantParEleve.toFixed(2) : null,
      }).map(([k, v]) => [k, v === '' ? null : v])
    )
    if (!isFinancier) delete payload.pop

    let error, data
    if (editRow) {
      ;({ error } = await supabase.from('activites').update(payload).eq('id', editRow.id))
      if (!error) await uploadStagedFiles(editRow.id)
    } else {
      payload.created_by = userId
      ;({ error, data } = await supabase.from('activites').insert(payload).select('id').single())
      if (!error && data?.id) await uploadStagedFiles(data.id)
    }
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-bold text-gray-800 text-lg">{editRow ? 'Modifier' : 'Nouvelle'} activité</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
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
              <select className="input" value={form.type} onChange={e => f('type', e.target.value)}>
                <option value="extramuros">Extramuros</option>
                <option value="intramuros">Intramuros</option>
                <option value="voyage">Voyage</option>
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

          {/* Responsable + Accompagnateurs */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Personnel</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Responsable</label>
                <MultiSearchSelect
                  options={staffOptions}
                  value={form.responsable_id}
                  onChange={v => f('responsable_id', v)}
                  placeholder="Choisir un·e responsable…"
                  labelKey="label" valueKey="id"
                  single
                />
              </div>
              <div>
                <label className="label">Accompagnateur·rice·s</label>
                <MultiSearchSelect
                  options={staffOptions}
                  value={form.accompagnateur_ids}
                  onChange={v => f('accompagnateur_ids', v)}
                  placeholder="Choisir des accompagnateur·rices…"
                  labelKey="label" valueKey="id"
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Participants</h3>
            <div className="space-y-3">
              <SelectionEleves
                label="add" badge="add"
                classes={form.classes_incluses} setClasses={v => f('classes_incluses', v)}
                groupes={form.groupes_inclus} setGroupes={v => f('groupes_inclus', v)}
                allClasses={allClasses} allGroupes={allGroupes.__groupes__ || []}
              />
              <SelectionEleves
                label="remove" badge="remove"
                classes={form.classes_exclues} setClasses={v => f('classes_exclues', v)}
                groupes={form.groupes_exclus} setGroupes={v => f('groupes_exclus', v)}
                allClasses={allClasses} allGroupes={allGroupes.__groupes__ || []}
              />

              {/* Nb élèves */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Nb d'élèves
                    {hasSelection && <span className="ml-2 text-xs text-green-600 font-normal">(calculé automatiquement)</span>}
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
                <div><label className="label">Heure RDV</label>
                  <input className="input" type="time" value={form.heure_rdv} onChange={e => f('heure_rdv', e.target.value)} />
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
                <div><label className="label">Lieu de retour</label>
                  <input className="input" value={form.lieu_retour} onChange={e => f('lieu_retour', e.target.value)} />
                </div>
                <div><label className="label">Type de transport *</label>
                  <select className="input" value={form.type_transport} onChange={e => f('type_transport', e.target.value)}>
                    <option value="">— Choisir —</option>
                    <option value="bus_scolaire">Bus scolaire</option>
                    <option value="train">Train</option>
                    <option value="a_pied">À pied</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div><label className="label">Tél. organisateur</label>
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
              {isFinancier && (
                <div><label className="label">POP (€)</label>
                  <input className="input" type="number" step="0.01" value={form.pop} onChange={e => f('pop', e.target.value)} />
                </div>
              )}
              <div><label className="label">Montant par élève (calculé)</label>
                <div className="input bg-gray-50 text-gray-600">
                  {montantParEleve !== null ? fmt(montantParEleve) : '—'}
                </div>
              </div>
              <div><label className="label">Statut</label>
                <select className="input" value={form.statut} onChange={e => f('statut', e.target.value)}>
                  <option value="brouillon">Brouillon</option>
                  <option value="publie">Publié</option>
                  {isFinancier && <option value="archive">Archivé</option>}
                </select>
              </div>
              {isFinancier && (
                <div><label className="label">Statut facturation</label>
                  <select className="input" value={form.statut_facturation} onChange={e => f('statut_facturation', e.target.value)}>
                    <option value="a_facturer">À facturer</option>
                    <option value="facture">Facturé</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Documents & Factures */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Documents & Factures</h3>
            <div className="grid grid-cols-2 gap-4">
              <FileStage label="Documents (PDF)" files={pendingDocs} setFiles={setPendingDocs} />
              <FileStage label="Factures (PDF)" files={pendingFactures} setFiles={setPendingFactures} />
            </div>
            {(pendingDocs.length > 0 || pendingFactures.length > 0) && (
              <p className="text-xs text-gray-400 mt-2">Les fichiers seront uploadés après la sauvegarde de l'activité.</p>
            )}
          </div>
        </div>

        {/* Footer */}
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

// ── Docs / Factures modal ─────────────────────────────────────────────────
function DocsModal({ row, categorie, onClose }) {
  const isFacture = categorie === 'facture'
  const label = isFacture ? 'Factures' : 'Documents'
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('activite_documents').select('*')
      .eq('activite_id', row.id).eq('categorie', categorie)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data || []))
  }, [row.id, categorie])

  const reload = () => supabase.from('activite_documents').select('*')
    .eq('activite_id', row.id).eq('categorie', categorie)
    .order('created_at', { ascending: false })
    .then(({ data }) => setDocs(data || []))

  const upload = async e => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const path = `${categorie}/${row.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('activite-factures').upload(path, file)
    if (!error) {
      await supabase.from('activite_documents').insert({ activite_id: row.id, nom: file.name, chemin: path, taille: file.size, categorie })
      await reload()
    }
    setUploading(false); e.target.value = ''
  }

  const view = async doc => {
    const { data } = await supabase.storage.from('activite-factures').createSignedUrl(doc.chemin, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const del = async doc => {
    await supabase.storage.from('activite-factures').remove([doc.chemin])
    await supabase.from('activite_documents').delete().eq('id', doc.id)
    await reload()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{label} — {row.intitule}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={upload} />
          <button onClick={() => fileRef.current.click()} disabled={uploading}
            className="btn-primary w-full justify-center text-sm py-1.5 mb-4">
            {uploading ? 'Upload…' : `+ Ajouter un ${isFacture ? 'PDF de facture' : 'document PDF'}`}
          </button>
          {docs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun document</p>}
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
              <span className="truncate text-gray-700 flex-1">{d.nom}</span>
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
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [docsRow, setDocsRow] = useState(null)
  const [docsCategorie, setDocsCategorie] = useState('document')
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFact, setFilterFact] = useState('')

  // Data for form
  const [allEleves, setAllEleves] = useState([])
  const [groupesList, setGroupesList] = useState([])
  const [elevesParGroupe, setElevesParGroupe] = useState({})
  const [staffList, setStaffList] = useState([])

  // Combined object for ActivityModal
  const formData = useMemo(() => ({
    __groupes__: groupesList,
    __staff__: staffList,
  }), [groupesList, staffList])

  useEffect(() => {
    // Load eleves, groupes, staff in parallel
    Promise.all([
      supabase.from('eleves').select('id, classe').eq('actif', true),
      supabase.from('groupes').select('id, nom').order('nom'),
      supabase.from('eleve_groupes').select('groupe_id, eleve_id'),
      supabase.from('profiles').select('id, nom, prenom, role').in('role', ['mdp', 'admin', 'financier']).order('nom'),
    ]).then(([elevesRes, groupesRes, egRes, staffRes]) => {
      setAllEleves(elevesRes.data || [])
      setGroupesList((groupesRes.data || []).map(g => ({ ...g, label: g.nom })))
      // Build elevesParGroupe map
      const map = {}
      ;(egRes.data || []).forEach(({ groupe_id, eleve_id }) => {
        if (!map[groupe_id]) map[groupe_id] = []
        map[groupe_id].push(eleve_id)
      })
      setElevesParGroupe(map)
      setStaffList((staffRes.data || []).map(p => ({
        ...p,
        id: p.id,
        label: `${p.prenom} ${p.nom}`.trim() || p.email || p.id,
      })))
    })
  }, [])

  const reload = useCallback(() =>
    supabase.from('activites').select('*').order('date_debut', { ascending: false })
      .then(({ data }) => setData(data || []))
  , [])

  useEffect(() => { reload().then(() => setLoading(false)) }, [reload])

  const openNew = () => { setEditRow(null); setShowModal(true) }
  const openEdit = row => { setEditRow(row); setShowModal(true) }
  const openDocs = (row, cat) => { setDocsRow(row); setDocsCategorie(cat) }

  const archive = async id => {
    if (!confirm('Archiver cette activité ?')) return
    await supabase.from('activites').update({ statut: 'archive' }).eq('id', id)
    await reload()
  }

  const canEdit = row => isAdmin || isFinancier || (isMdp && row.created_by === user?.id && row.statut !== 'archive')
  const canCreate = isAdmin || isFinancier || isMdp

  // Resolve responsable name from staffList
  const staffById = useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s.label])), [staffList])

  const displayed = data
    .filter(r => showArchived ? true : r.statut !== 'archive')
    .filter(r => isAdmin || isFinancier || r.created_by === user?.id || r.statut === 'publie')
    .filter(r => !search || `${r.intitule} ${r.description || ''} ${r.responsable || ''}`.toLowerCase().includes(search.toLowerCase()))
    .filter(r => !filterType || r.type === filterType)
    .filter(r => !filterFact || r.statut_facturation === filterFact)

  const hasFilters = search || filterType || filterFact

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-primary">Activités</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestion des activités scolaires et extrascolaires</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
            Archives
          </label>
          {canCreate && <button onClick={openNew} className="btn-primary text-sm py-1.5 px-4">+ Activité</button>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-56 focus:border-primary transition-colors"
            placeholder="Rechercher par intitulé, responsable…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <FilterPill label="Type" value={filterType}
          options={Object.values(TYPE_LABELS)}
          onChange={v => setFilterType(Object.entries(TYPE_LABELS).find(([, l]) => l === v)?.[0] || '')} />
        <FilterPill label="Facturation" value={filterFact}
          options={['À facturer', 'Facturé']}
          onChange={v => setFilterFact(v === 'À facturer' ? 'a_facturer' : v === 'Facturé' ? 'facture' : '')} />
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterType(''); setFilterFact('') }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors">
            <span className="text-sm leading-none">✕</span> Tout effacer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{displayed.length} résultat{displayed.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Cards */}
      <div className="grid gap-3">
        {displayed.length === 0 && (
          <div className="card p-8 text-center text-gray-400">Aucune activité</div>
        )}
        {displayed.map(row => {
          const responsableLabel = row.responsable_id ? staffById[row.responsable_id] : row.responsable
          const nbEl = row.nb_eleves
          return (
          <div key={row.id} className="card p-5 flex items-start justify-between gap-4 hover:shadow-md transition-shadow">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-semibold text-gray-800">{row.intitule}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[row.statut] || 'bg-gray-100 text-gray-600'}`}>
                  {row.statut === 'brouillon' ? 'Brouillon' : row.statut === 'publie' ? 'Publié' : 'Archivé'}
                </span>
                {isFinancier && row.statut_facturation && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FACT_COLORS[row.statut_facturation] || 'bg-gray-100'}`}>
                    {row.statut_facturation === 'a_facturer' ? 'À facturer' : 'Facturé'}
                  </span>
                )}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                  {TYPE_LABELS[row.type] || row.type}
                </span>
              </div>
              {row.description && <p className="text-sm text-gray-500 mb-2 line-clamp-1">{row.description}</p>}
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <span>📅 {fmtDate(row.date_debut)}{row.date_fin ? ` → ${fmtDate(row.date_fin)}` : ''}</span>
                {row.lieu && <span>📍 {row.lieu}</span>}
                {nbEl && <span>👥 {nbEl} élève{nbEl !== 1 ? 's' : ''}</span>}
                {row.montant_total && <span>💶 {fmt(row.montant_total)} total{row.montant_par_eleve ? ` · ${fmt(row.montant_par_eleve)}/élève` : ''}</span>}
                {responsableLabel && <span>👤 {responsableLabel}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0 items-center">
              <button onClick={() => openDocs(row, 'document')}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary rounded-full px-3 py-1.5 transition-colors">
                <FileText size={12} /> Docs
              </button>
              <button onClick={() => openDocs(row, 'facture')}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary rounded-full px-3 py-1.5 transition-colors">
                <Receipt size={12} /> Factures
              </button>
              {canEdit(row) && (
                <button onClick={() => openEdit(row)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary rounded-full px-3 py-1.5 transition-colors">
                  <Pencil size={12} /> Modifier
                </button>
              )}
              {isFinancier && row.statut !== 'archive' && (
                <button onClick={() => archive(row.id)}
                  className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-700 border border-orange-200 hover:border-orange-400 rounded-full px-3 py-1.5 transition-colors">
                  <Archive size={12} /> Archiver
                </button>
              )}
            </div>
          </div>
          )
        })}
      </div>

      {/* Modals */}
      {showModal && (
        <ActivityModal
          editRow={editRow}
          isFinancier={isFinancier || isAdmin}
          userId={user?.id}
          allEleves={allEleves}
          allGroupes={formData}
          elevesParGroupe={elevesParGroupe}
          onClose={() => setShowModal(false)}
          onSaved={reload}
        />
      )}
      {docsRow && <DocsModal row={docsRow} categorie={docsCategorie} onClose={() => setDocsRow(null)} />}
    </div>
  )
}
