// Compositions.jsx — v4 : liste projets + modal création + modal config
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import MasterFilter from '../components/ui/MasterFilter'
import {
  LayoutGrid, Plus, Trash2, Download, Upload, X, AlertTriangle,
  RefreshCw, Users, Link, Unlink, Check, FolderOpen, Settings,
  Maximize2, Minimize2, Search, ArrowLeft, Calendar, ChevronRight,
} from 'lucide-react'

// ── Constantes ────────────────────────────────────────────────────────────────
const POOL_ID = '__pool__'
const LS_KEY  = 'espm_compositions_v1'

const DEFAULT_FIELDS = {
  photo:    { label: 'Photo',             enabled: true },
  classe:   { label: 'Classe actuelle',   enabled: true },
  groupes:  { label: 'Groupes SS',        enabled: true },
  troubles: { label: 'Troubles attestés', enabled: true },
}

const getAnneFromClasse = c => { const m = c?.match(/^(\d)/); return m ? m[1] : null }

// ── LocalStorage ──────────────────────────────────────────────────────────────
function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
function writeSaved(list) { try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch {} }

// ── ElevePhoto ─────────────────────────────────────────────────────────────────
function ElevePhoto({ username, internalNumber, size = 40 }) {
  const [src, setSrc] = useState(null)
  const [err, setErr] = useState(false)
  const cacheKey = internalNumber ? 'ssp_n_' + internalNumber : 'ssp_u_' + username

  useEffect(() => {
    if (!internalNumber && !username) { setErr(true); return }
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { if (cached === 'null') setErr(true); else setSrc(cached); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setErr(true); return }
      try {
        const r = await fetch('/.netlify/functions/smartschool-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ internalNumber, username }),
        })
        const d = await r.json()
        if (d.photo) { setSrc(d.photo); sessionStorage.setItem(cacheKey, d.photo) }
        else { setErr(true); sessionStorage.setItem(cacheKey, 'null') }
      } catch { setErr(true) }
    })
  }, [username, internalNumber, cacheKey])

  const sz = `${size}px`
  if (err || !src)
    return <div style={{ width: sz, height: sz }} className="rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xs shrink-0">?</div>
  return <img src={src} alt="" style={{ width: sz, height: sz }} className="rounded-full object-cover shrink-0 border-2 border-white shadow-sm" onError={() => setErr(true)} />
}

// ── EleveCard ──────────────────────────────────────────────────────────────────
function EleveCard({ eleve, fields, customFields, onCFChange, selected, onSelect, linked, cardMode, isDragging }) {
  const hasAR  = eleve.amenagements_raisonnables?.trim()
  const groupes = Array.isArray(eleve.groupes_ss) ? eleve.groupes_ss.filter(Boolean) : []
  const compact = cardMode === 'compact'

  return (
    <div className={`relative rounded-xl border bg-white transition-all select-none cursor-grab active:cursor-grabbing
      ${selected ? 'border-indigo-400 shadow-md ring-2 ring-indigo-300/60'
        : isDragging ? 'border-indigo-200 shadow-lg opacity-80'
        : 'border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md'}`}>
      <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onSelect(eleve.id) }}
        className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
          ${selected ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
        {selected && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>
      {linked && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-violet-100 rounded-full p-0.5">
          <Link size={10} className="text-violet-500" />
        </div>
      )}
      <div className={`p-2.5 pt-2 ${compact ? '' : 'pb-3'}`}>
        <div className="flex items-center gap-2">
          {fields.photo && <ElevePhoto username={eleve.smartschool_username} internalNumber={eleve.smartschool_internal_number} size={compact ? 32 : 40} />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">{eleve.nom?.toUpperCase()}</p>
            <p className="text-xs text-gray-500 leading-tight truncate">{eleve.prenom}</p>
            {compact && fields.classe && eleve.classe && (
              <span className="text-[10px] text-blue-500 font-medium">{eleve.classe}</span>
            )}
          </div>
        </div>
        {!compact && (
          <>
            <div className="flex flex-wrap gap-1 mt-2">
              {fields.classe && eleve.classe && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{eleve.classe}</span>
              )}
              {fields.troubles && hasAR && (
                <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                  <AlertTriangle size={9} /> Troubles
                </span>
              )}
              {fields.groupes && groupes.map((g, i) => (
                <span key={i} className="text-[10px] bg-gray-50 text-gray-500 rounded px-1.5 py-0.5">{g}</span>
              ))}
            </div>
            {fields.troubles && hasAR && (
              <div className="mt-1.5 text-[10px] text-orange-700 bg-orange-50 rounded px-2 py-1 border border-orange-100 leading-snug">
                {eleve.amenagements_raisonnables}
              </div>
            )}
            {customFields?.map(cf => (
              <div key={cf.id} className="mt-1" onPointerDown={e => e.stopPropagation()}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 shrink-0">{cf.label}:</span>
                  <input value={cf.values?.[eleve.id] || ''} onChange={e => onCFChange?.(cf.id, eleve.id, e.target.value)}
                    onClick={e => e.stopPropagation()} placeholder="—"
                    className="text-[10px] flex-1 min-w-0 border-b border-gray-200 bg-transparent focus:outline-none focus:border-indigo-400 text-gray-700" />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── SortableEleveCard ──────────────────────────────────────────────────────────
function SortableEleveCard({ eleve, fields, customFields, onCFChange, selected, onSelect, linked, cardMode, groupId, selectedIds }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: eleve.id, data: { type: 'card', eleveId: eleve.id, groupId, selectedIds },
  })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      <EleveCard eleve={eleve} fields={fields} customFields={customFields} onCFChange={onCFChange}
        selected={selected} onSelect={onSelect} linked={linked} cardMode={cardMode} isDragging={isDragging} />
    </div>
  )
}

// ── GroupColumn ────────────────────────────────────────────────────────────────
function GroupColumn({ group, eleves, fields, customFields, onCFChange, selectedIds, onSelect, linkedSets, onRename, onDelete, cardMode, isPool }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id, data: { type: 'column', groupId: group.id } })
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(group.name)
  const inputRef              = useRef(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  const arCount  = eleves.filter(e => e.amenagements_raisonnables?.trim()).length
  const isLinked = id => linkedSets.some(s => s.has(id))
  const colW     = cardMode === 'compact' ? 170 : 240

  return (
    <div className={`flex flex-col rounded-2xl border-2 transition-colors shrink-0
      ${isPool ? 'border-gray-200 bg-gray-50/80' : isOver ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100 bg-white'}`}
      style={{ width: colW, minHeight: 300 }}>
      <div className={`px-3 py-2 border-b flex items-center gap-2 ${isPool ? 'border-gray-200' : 'border-gray-100'}`}>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
              onBlur={() => { setEditing(false); onRename(group.id, name) }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onRename(group.id, name) } }}
              className="w-full text-xs font-semibold border-b border-indigo-400 outline-none bg-transparent" />
          ) : (
            <button onClick={() => !isPool && setEditing(true)}
              className={`text-xs font-bold truncate text-left w-full ${isPool ? 'text-gray-500 cursor-default' : 'text-gray-700 hover:text-indigo-600'}`}>
              {group.name}
            </button>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isPool ? 'bg-gray-200 text-gray-600' : 'bg-indigo-100 text-indigo-600'}`}>
          {eleves.length}
        </span>
        {arCount > 0 && (
          <span className="text-[10px] font-semibold bg-orange-100 text-orange-600 px-1 py-0.5 rounded-full">{arCount}AR</span>
        )}
        {!isPool && (
          <button onClick={() => onDelete(group.id)} className="text-gray-300 hover:text-red-400 ml-0.5"><X size={12} /></button>
        )}
      </div>
      <div ref={setNodeRef} className={`flex-1 flex flex-col gap-1.5 p-1.5 overflow-y-auto transition-colors ${isOver ? 'bg-indigo-50/60' : ''}`}
        style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <SortableContext items={eleves.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {eleves.map(eleve => (
            <SortableEleveCard key={eleve.id} eleve={eleve} fields={fields} customFields={customFields} onCFChange={onCFChange}
              selected={selectedIds.has(eleve.id)} onSelect={onSelect} linked={isLinked(eleve.id)}
              cardMode={cardMode} groupId={group.id} selectedIds={selectedIds} />
          ))}
        </SortableContext>
        {eleves.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-6">
            <p className="text-xs text-gray-300">{isPool ? 'Tous placés ✓' : 'Déposer ici'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ConfigForm (réutilisé dans Create + Config modal) ─────────────────────────
function ConfigForm({ allEleves, loading, onReload, filters, setFilters, excludedIds, setExcludedIds,
    fields, setFields, customFields, setCustomFields, compositionName, setCompositionName, showName = true }) {

  const [eleveSearch, setEleveSearch]   = useState('')
  const [newCFLabel, setNewCFLabel]     = useState('')

  const availableClasses = useMemo(() =>
    [...new Set(allEleves.map(e => e.classe).filter(Boolean))].sort()
  , [allEleves])

  const filterDefs = useMemo(() => [
    {
      key: 'annee', label: 'Année',
      options: [...new Set(allEleves.map(e => getAnneFromClasse(e.classe)).filter(Boolean))].sort().map(a => `${a}e`),
    },
    { key: 'classe', label: 'Classe', options: availableClasses },
  ], [allEleves, availableClasses])

  const toggleFilter = (key, val) => setFilters(prev => {
    const cur = prev[key] || []
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
    return { ...prev, [key]: next }
  })

  const filteredCount = useMemo(() => {
    let list = allEleves
    const hasAnnee = filters.annee?.length > 0
    const hasClasse = filters.classe?.length > 0
    if (hasAnnee || hasClasse) {
      list = list.filter(e => {
        const matchAnnee = hasAnnee && (() => { const a = getAnneFromClasse(e.classe); return a && filters.annee.includes(`${a}e`) })()
        const matchClasse = hasClasse && filters.classe.includes(e.classe)
        return matchAnnee || matchClasse
      })
    }
    return list.filter(e => !excludedIds.has(e.id)).length
  }, [allEleves, filters, excludedIds])

  const addCustomField = () => {
    if (!newCFLabel.trim()) return
    setCustomFields(prev => [...prev, { id: 'cf_' + Date.now(), label: newCFLabel.trim(), values: {} }])
    setNewCFLabel('')
  }

  return (
    <div className="space-y-4">
      {/* Nom */}
      {showName && (
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nom de la composition</label>
          <input value={compositionName} onChange={e => setCompositionName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
            placeholder="Ex : Classes de 3e — 2026-2027" />
        </div>
      )}

      {/* Source */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-600">Source — Élèves</label>
          <button onClick={onReload} className="p-1 hover:bg-gray-100 rounded text-gray-400">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <MasterFilter filters={filters} filterDefs={filterDefs} onChange={toggleFilter} onClearAll={() => setFilters({})} />
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={eleveSearch} onChange={e => setEleveSearch(e.target.value)}
              placeholder="Exclure un élève…"
              className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-indigo-400" />
          </div>
          {excludedIds.size > 0 && (
            <button onClick={() => setExcludedIds(new Set())} className="text-xs text-red-400 hover:text-red-600 shrink-0">
              ✕ {excludedIds.size}
            </button>
          )}
        </div>
        {eleveSearch && (
          <div className="flex flex-wrap gap-1 mb-2 max-h-28 overflow-y-auto">
            {allEleves.filter(e => `${e.nom} ${e.prenom}`.toLowerCase().includes(eleveSearch.toLowerCase())).slice(0, 25).map(e => (
              <button key={e.id} onClick={() => setExcludedIds(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors
                  ${excludedIds.has(e.id) ? 'bg-red-50 border-red-200 text-red-500 line-through' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {excludedIds.has(e.id) && <X size={8} />}
                {e.nom} {e.prenom} {e.classe && <span className="text-gray-400">· {e.classe}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-indigo-400" />
          <span className="text-xs text-gray-600"><span className="font-bold text-indigo-600">{filteredCount}</span> élève{filteredCount !== 1 ? 's' : ''} sélectionné{filteredCount !== 1 ? 's' : ''}</span>
          {!filters.annee?.length && !filters.classe?.length && <span className="text-xs text-gray-400">— tous les élèves actifs</span>}
        </div>
      </div>

      {/* Champs vignettes */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">Champs affichés sur les vignettes</label>
        <div className="space-y-2">
          {Object.entries(fields).map(([key, field]) => (
            <div key={key} className="flex items-center gap-2.5">
              <button onClick={() => setFields(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))}
                className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${field.enabled ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${field.enabled ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <span className={`text-sm ${field.enabled ? 'text-gray-700' : 'text-gray-400'}`}>{field.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Champs personnalisés */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">Champs personnalisés</label>
        <div className="flex gap-2 mb-2">
          <input value={newCFLabel} onChange={e => setNewCFLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomField()}
            placeholder="Nom du champ…"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-400" />
          <button onClick={addCustomField} className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-700">
            <Plus size={12} />
          </button>
        </div>
        {customFields.length > 0 && (
          <div className="space-y-1">
            {customFields.map(cf => (
              <div key={cf.id} className="flex items-center justify-between bg-gray-50 rounded px-2.5 py-1.5 border border-gray-100">
                <span className="text-xs font-medium text-gray-700">{cf.label}</span>
                <button onClick={() => setCustomFields(prev => prev.filter(f => f.id !== cf.id))} className="text-gray-300 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        {customFields.length === 0 && <p className="text-xs text-gray-400">Aucun champ personnalisé.</p>}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  Page principale
// ══════════════════════════════════════════════════════════════════════════════
export default function Compositions() {
  // ── Navigation ────────────────────────────────────────────────────────────
  const [view, setView] = useState('list') // 'list' | 'board'

  // ── Données ───────────────────────────────────────────────────────────────
  const [allEleves, setAllEleves] = useState([])
  const [loading, setLoading]     = useState(false)

  // ── Config composition active ─────────────────────────────────────────────
  const [compositionName, setCompositionName] = useState('Nouvelle composition')
  const [filters, setFilters]                 = useState({})
  const [excludedIds, setExcludedIds]         = useState(new Set())
  const [fields, setFields]                   = useState(DEFAULT_FIELDS)
  const [customFields, setCustomFields]       = useState([])

  // ── Board ─────────────────────────────────────────────────────────────────
  const [groups, setGroups]           = useState([])
  const [assignments, setAssignments] = useState({})
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [linkedSets, setLinkedSets]   = useState([])
  const [activeId, setActiveId]       = useState(null)
  const [dragging, setDragging]       = useState(null)
  const [cardMode, setCardMode]       = useState('etendu')

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const [savedList, setSavedList]   = useState(() => loadSaved())
  const [lastSaved, setLastSaved]   = useState(null)
  const autoSaveTimer               = useRef(null)

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfigModal, setShowConfigModal]  = useState(false)
  const [showImportModal, setShowImportModal]  = useState(false)

  // État temporaire pour la modal de création
  const [draftName,         setDraftName]         = useState('Nouvelle composition')
  const [draftFilters,      setDraftFilters]       = useState({})
  const [draftExcludedIds,  setDraftExcludedIds]   = useState(new Set())
  const [draftFields,       setDraftFields]        = useState(DEFAULT_FIELDS)
  const [draftCustomFields, setDraftCustomFields]  = useState([])

  // ── Chargement élèves ─────────────────────────────────────────────────────
  const loadEleves = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('eleves')
      .select('id, nom, prenom, classe, smartschool_username, smartschool_internal_number, groupes_ss, amenagements_raisonnables, philosophie, groupe_choix_philo')
      .eq('actif', true).order('nom')
    setAllEleves(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEleves() }, [loadEleves])

  // ── Élèves filtrés ────────────────────────────────────────────────────────
  const filteredEleves = useMemo(() => {
    let list = allEleves
    const hasAnnee = filters.annee?.length > 0
    const hasClasse = filters.classe?.length > 0
    if (hasAnnee || hasClasse) {
      list = list.filter(e => {
        const matchAnnee = hasAnnee && (() => { const a = getAnneFromClasse(e.classe); return a && filters.annee.includes(`${a}e`) })()
        const matchClasse = hasClasse && filters.classe.includes(e.classe)
        return matchAnnee || matchClasse
      })
    }
    return list.filter(e => !excludedIds.has(e.id))
  }, [allEleves, filters, excludedIds])

  // ── Sync assignments ──────────────────────────────────────────────────────
  useEffect(() => {
    setAssignments(prev => {
      const next = { ...prev }
      for (const e of filteredEleves) { if (!(e.id in next)) next[e.id] = POOL_ID }
      return next
    })
  }, [filteredEleves])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const doSave = useCallback((immediate = false) => {
    const save = () => {
      const date    = new Date().toISOString()
      const entryId = 'comp_' + compositionName.replace(/\W+/g, '_').toLowerCase()
      const data    = {
        name: compositionName, date, filters, excludedIds: [...excludedIds],
        fields: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.enabled])),
        customFields, groups, assignments, linkedSets: linkedSets.map(s => [...s]), cardMode,
      }
      const entry = { id: entryId, name: compositionName, date, data }
      setSavedList(prev => { const list = [entry, ...prev.filter(c => c.id !== entryId)]; writeSaved(list); return list })
      setLastSaved(date)
    }
    if (immediate) { clearTimeout(autoSaveTimer.current); save() }
    else {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(save, 1500)
    }
  }, [compositionName, filters, excludedIds, fields, customFields, groups, assignments, linkedSets, cardMode])

  useEffect(() => {
    if (view === 'board') doSave()
    return () => clearTimeout(autoSaveTimer.current)
  }, [compositionName, filters, excludedIds, fields, customFields, groups, assignments, linkedSets, cardMode]) // eslint-disable-line

  // ── DnD ───────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  )
  const getGroupEleves = useCallback(gid =>
    filteredEleves.filter(e => (assignments[e.id] ?? POOL_ID) === gid)
  , [filteredEleves, assignments])

  const toggleSelect = useCallback(id => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  // ── Groupes ───────────────────────────────────────────────────────────────
  const addGroup = () => {
    const id = 'g_' + Date.now()
    setGroups(prev => [...prev, { id, name: `Groupe ${prev.length + 1}` }])
  }
  const renameGroup = (id, name) => setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g))
  const deleteGroup = id => {
    setGroups(prev => prev.filter(g => g.id !== id))
    setAssignments(prev => { const n = { ...prev }; for (const [k,v] of Object.entries(n)) { if (v === id) n[k] = POOL_ID }; return n })
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => { setActiveId(active.id); setDragging(filteredEleves.find(e => e.id === active.id)) }
  const handleDragEnd   = ({ active, over }) => {
    setActiveId(null); setDragging(null)
    if (!over) return
    const targetGroupId = over.data?.current?.groupId ?? over.id
    if (!targetGroupId) return
    let ids = [active.id]
    if (selectedIds.has(active.id) && selectedIds.size > 1) ids = [...selectedIds]
    const linked = new Set(ids)
    for (const id of ids) for (const s of linkedSets) { if (s.has(id)) s.forEach(x => linked.add(x)) }
    setAssignments(prev => { const n = { ...prev }; for (const id of linked) { if (id in n) n[id] = targetGroupId }; return n })
  }

  // ── Lier/délier ───────────────────────────────────────────────────────────
  const linkSelection   = () => {
    if (selectedIds.size < 2) return
    const ns = new Set(selectedIds)
    const rest = linkedSets.filter(s => { for (const id of s) { if (ns.has(id)) { s.forEach(x => ns.add(x)); return false } } return true })
    setLinkedSets([...rest, ns]); setSelectedIds(new Set())
  }
  const unlinkSelection = () => {
    setLinkedSets(prev => prev.filter(s => { for (const id of selectedIds) { if (s.has(id)) return false } return true }))
    setSelectedIds(new Set())
  }

  // ── CF ────────────────────────────────────────────────────────────────────
  const handleCFChange = useCallback((fieldId, eleveId, value) => {
    setCustomFields(prev => prev.map(cf => cf.id === fieldId ? { ...cf, values: { ...cf.values, [eleveId]: value } } : cf))
  }, [])

  // ── Désérialisation ───────────────────────────────────────────────────────
  const loadComposition = entry => {
    const d = entry.data
    if (d.name)           setCompositionName(d.name)
    if (d.filters)        setFilters(d.filters)
    if (d.excludedIds)    setExcludedIds(new Set(d.excludedIds))
    if (d.fields)         setFields(prev => Object.fromEntries(
      Object.entries(prev).map(([k,v]) => [k, { ...v, enabled: d.fields[k] ?? v.enabled }])
    ))
    if (d.customFields)   setCustomFields(d.customFields)
    if (d.groups)         setGroups(d.groups)
    if (d.assignments)    setAssignments(d.assignments)
    if (d.linkedSets)     setLinkedSets(d.linkedSets.map(s => new Set(s)))
    if (d.cardMode)       setCardMode(d.cardMode)
    setView('board')
  }

  const deleteComposition = id => {
    const list = savedList.filter(c => c.id !== id)
    setSavedList(list); writeSaved(list)
  }

  // ── Créer nouvelle composition ────────────────────────────────────────────
  const openCreateModal = () => {
    setDraftName('Nouvelle composition'); setDraftFilters({}); setDraftExcludedIds(new Set())
    setDraftFields(DEFAULT_FIELDS); setDraftCustomFields([])
    setShowCreateModal(true)
  }

  const confirmCreate = () => {
    setCompositionName(draftName); setFilters(draftFilters); setExcludedIds(draftExcludedIds)
    setFields(draftFields); setCustomFields(draftCustomFields)
    setGroups([]); setAssignments({}); setLinkedSets([]); setSelectedIds(new Set())
    setShowCreateModal(false)
    setView('board')
  }

  // ── Import JSON ───────────────────────────────────────────────────────────
  const exportJSON = () => {
    const date = new Date().toISOString()
    const data = { name: compositionName, date, filters, excludedIds: [...excludedIds],
      fields: Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.enabled])),
      customFields, groups, assignments, linkedSets: linkedSets.map(s=>[...s]), cardMode }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `composition_${compositionName.replace(/\s+/g,'_')}_${date.split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(a.href)
  }
  const importJSON = e => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { try { loadComposition({ data: JSON.parse(ev.target.result) }) } catch { alert('JSON invalide') } }
    reader.readAsText(file); e.target.value = ''
  }

  // ── Colonnes board ────────────────────────────────────────────────────────
  const allColumns    = useMemo(() => [{ id: POOL_ID, name: 'Pool — Élèves à placer', isPool: true }, ...groups], [groups])
  const enabledFields = useMemo(() => Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.enabled])), [fields])
  const isLinked      = useCallback(id => linkedSets.some(s => s.has(id)), [linkedSets])

  // ══ RENDER ════════════════════════════════════════════════════════════════

  // ── VUE LISTE ─────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Compositions"
        subtitle="Projets de composition de classes"
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
              <Upload size={13} /> Importer JSON
              <input type="file" accept=".json" className="hidden" onChange={importJSON} />
            </label>
            <button onClick={openCreateModal}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
              <Plus size={13} /> Nouveau projet
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {savedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <LayoutGrid size={28} className="text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun projet de composition</h3>
            <p className="text-sm text-gray-400 mb-6">Créez votre premier projet pour commencer à composer les classes.</p>
            <button onClick={openCreateModal}
              className="flex items-center gap-2 bg-indigo-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> Créer un projet
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {/* Carte + Nouveau */}
              <button onClick={openCreateModal}
                className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition-all">
                <Plus size={24} />
                <span className="text-sm font-semibold">Nouveau projet</span>
              </button>

              {savedList.map(entry => {
                const d = entry.data || {}
                const groupCount = d.groups?.length || 0
                const eleveCount = d.excludedIds ? (allEleves.length - d.excludedIds.length) : allEleves.length
                const placed = Object.values(d.assignments || {}).filter(v => v !== POOL_ID).length
                return (
                  <div key={entry.id}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group cursor-pointer flex flex-col"
                    onClick={() => loadComposition(entry)}>
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                          <LayoutGrid size={18} className="text-indigo-500" />
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteComposition(entry.id) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 mb-1 leading-tight">{entry.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                        <Calendar size={11} />
                        {new Date(entry.date).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[11px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          {groupCount} groupe{groupCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {placed} placé{placed !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Ouvrir le board</span>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal Créer ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-800">Nouveau projet de composition</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ConfigForm
                allEleves={allEleves} loading={loading} onReload={loadEleves}
                filters={draftFilters} setFilters={setDraftFilters}
                excludedIds={draftExcludedIds} setExcludedIds={setDraftExcludedIds}
                fields={draftFields} setFields={setDraftFields}
                customFields={draftCustomFields} setCustomFields={setDraftCustomFields}
                compositionName={draftName} setCompositionName={setDraftName}
                showName
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end shrink-0">
              <button onClick={() => setShowCreateModal(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">Annuler</button>
              <button onClick={confirmCreate}
                className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 flex items-center gap-2">
                <LayoutGrid size={14} /> Créer la composition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── VUE BOARD ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={compositionName}
        subtitle="Composition de classes"
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.size >= 2 && (
              <button onClick={linkSelection} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
                <Link size={13} /> Lier
              </button>
            )}
            {selectedIds.size >= 1 && (
              <>
                <button onClick={unlinkSelection} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
                  <Unlink size={13} /> Délier
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
                  <X size={13} /> {selectedIds.size} sél.
                </button>
              </>
            )}
            <button onClick={() => setShowConfigModal(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
              <Settings size={13} /> Configuration
            </button>
          </div>
        }
      />

      {/* Barre info */}
      <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-3 shrink-0">
        <button onClick={() => { doSave(true); setView('list') }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={13} /> Mes projets
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">{filteredEleves.length} élèves · {groups.length} groupe{groups.length !== 1 ? 's' : ''}</span>
        {lastSaved && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <Check size={11} /> Sauvegardé {new Date(lastSaved).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setCardMode(m => m === 'compact' ? 'etendu' : 'compact')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-indigo-300 transition-colors">
            {cardMode === 'compact' ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            {cardMode === 'compact' ? 'Étendu' : 'Compact'}
          </button>
          <button onClick={addGroup}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-300 px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Nouveau groupe
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 p-4 h-full items-start" style={{ minWidth: 'max-content' }}>
            {allColumns.map(col => (
              <GroupColumn key={col.id} group={col} eleves={getGroupEleves(col.id)}
                fields={enabledFields} customFields={customFields} onCFChange={handleCFChange}
                selectedIds={selectedIds} onSelect={toggleSelect} linkedSets={linkedSets}
                onRename={renameGroup} onDelete={deleteGroup} cardMode={cardMode} isPool={col.id === POOL_ID} />
            ))}
            <button onClick={addGroup}
              className="shrink-0 w-[170px] h-20 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors flex flex-col items-center justify-center gap-1">
              <Plus size={18} /><span className="text-xs font-medium">Nouveau groupe</span>
            </button>
          </div>
          <DragOverlay>
            {dragging && (
              <div style={{ width: cardMode === 'compact' ? 150 : 220 }} className="rotate-2 shadow-2xl">
                <EleveCard eleve={dragging} fields={enabledFields} customFields={customFields}
                  onCFChange={() => {}} selected={selectedIds.has(dragging.id)} onSelect={() => {}}
                  linked={isLinked(dragging.id)} cardMode={cardMode} isDragging />
                {selectedIds.has(dragging.id) && selectedIds.size > 1 && (
                  <div className="mt-1 text-center">
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow">
                      +{selectedIds.size - 1} autre{selectedIds.size > 2 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Modal Configuration ──────────────────────────────────────── */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-800">Configuration — {compositionName}</h3>
              <div className="flex items-center gap-3">
                <button onClick={exportJSON} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <Download size={12} /> Exporter JSON
                </button>
                <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ConfigForm
                allEleves={allEleves} loading={loading} onReload={loadEleves}
                filters={filters} setFilters={setFilters}
                excludedIds={excludedIds} setExcludedIds={setExcludedIds}
                fields={fields} setFields={setFields}
                customFields={customFields} setCustomFields={setCustomFields}
                compositionName={compositionName} setCompositionName={setCompositionName}
                showName
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
              <button onClick={() => setShowConfigModal(false)}
                className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
