// Compositions.jsx — Outil de composition de classes
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import {
  Settings, LayoutGrid, Plus, Trash2, Download, Upload,
  X, AlertTriangle, ChevronDown, RefreshCw, Users, Link, Unlink,
  Check, GripVertical, Eye, EyeOff,
} from 'lucide-react'

// ── Constantes ────────────────────────────────────────────────────────────────
const ANNEES = ['1', '2', '3', '4', '5', '6']
const POOL_ID = '__pool__'

const DEFAULT_FIELDS = {
  photo:       { label: 'Photo',                  enabled: true  },
  classe:      { label: 'Classe actuelle',         enabled: true  },
  groupes:     { label: 'Groupes Smartschool',     enabled: true  },
  amenagements:{ label: 'Aménagements raisonnables', enabled: true },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (prenom, nom) =>
  ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase()

const getAnneFromClasse = (classe) => {
  if (!classe) return null
  const m = classe.match(/^(\d)/)
  return m ? m[1] : null
}

// ── Composant photo avec lazy load ───────────────────────────────────────────
function ElevePhoto({ internalNumber, size = 48 }) {
  const [url, setUrl] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!internalNumber) { setErr(true); return }
    const token = sessionStorage.getItem('ss_photo_token_' + internalNumber)
    if (token) { setUrl(token); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setErr(true); return }
      const photoUrl = `/.netlify/functions/smartschool-photo?internalNumber=${internalNumber}&token=${encodeURIComponent(session.access_token)}`
      setUrl(photoUrl)
      sessionStorage.setItem('ss_photo_token_' + internalNumber, photoUrl)
    })
  }, [internalNumber])

  const sz = `${size}px`
  if (err || !url) return (
    <div style={{ width: sz, height: sz }}
      className="rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xs shrink-0">
      ?
    </div>
  )
  return (
    <img src={url} alt="" style={{ width: sz, height: sz }}
      className="rounded-full object-cover shrink-0 border-2 border-white shadow-sm"
      onError={() => setErr(true)} />
  )
}

// ── Vignette élève (petite, pour le board) ───────────────────────────────────
function EleveCard({ eleve, fields, selected, onSelect, linked, isDragging = false }) {
  const hasAR = eleve.amenagements_raisonnables && eleve.amenagements_raisonnables.trim()
  const groupes = Array.isArray(eleve.groupes_ss) ? eleve.groupes_ss.filter(Boolean) : []

  return (
    <div
      className={`relative rounded-xl border bg-white transition-all select-none cursor-grab active:cursor-grabbing
        ${selected
          ? 'border-indigo-400 shadow-md ring-2 ring-indigo-300/60'
          : isDragging
            ? 'border-indigo-200 shadow-lg opacity-80'
            : 'border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md'
        }`}
      style={{ userSelect: 'none' }}
    >
      {/* Checkbox sélection */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onSelect(eleve.id) }}
        className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
          ${selected
            ? 'bg-indigo-500 border-indigo-500'
            : 'bg-white border-gray-200 hover:border-indigo-300'
          }`}
      >
        {selected && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {/* Badge lien */}
      {linked && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-violet-100 rounded-full p-0.5">
          <Link size={10} className="text-violet-500" />
        </div>
      )}

      <div className="p-3 pt-2">
        <div className="flex items-start gap-2.5">
          {fields.photo && (
            <div className="shrink-0 mt-0.5">
              <ElevePhoto internalNumber={eleve.smartschool_internal_number} size={40} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">
              {eleve.nom?.toUpperCase()}
            </p>
            <p className="text-xs text-gray-500 leading-tight truncate">{eleve.prenom}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {fields.classe && eleve.classe && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                  {eleve.classe}
                </span>
              )}
              {fields.amenagements && hasAR && (
                <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                  <AlertTriangle size={9} /> AR
                </span>
              )}
              {fields.groupes && groupes.slice(0, 2).map((g, i) => (
                <span key={i} className="text-[10px] bg-gray-50 text-gray-500 rounded px-1.5 py-0.5 truncate max-w-[80px]">
                  {g}
                </span>
              ))}
              {fields.groupes && groupes.length > 2 && (
                <span className="text-[10px] text-gray-400">+{groupes.length - 2}</span>
              )}
            </div>
          </div>
        </div>

        {fields.amenagements && hasAR && (
          <div className="mt-2 text-[10px] text-orange-700 bg-orange-50 rounded px-2 py-1 leading-snug border border-orange-100">
            {eleve.amenagements_raisonnables}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Carte sortable (wrapper DnD) ──────────────────────────────────────────────
function SortableEleveCard({ eleve, fields, selected, onSelect, linked, groupId, selectedIds }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: eleve.id,
    data: { type: 'card', eleveId: eleve.id, groupId, selectedIds },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <EleveCard
        eleve={eleve}
        fields={fields}
        selected={selected}
        onSelect={onSelect}
        linked={linked}
        isDragging={isDragging}
      />
    </div>
  )
}

// ── Colonne du board ──────────────────────────────────────────────────────────
function GroupColumn({ group, eleves, fields, selectedIds, onSelect, linkedSets, onRename, onDelete, isPool }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id, data: { type: 'column', groupId: group.id } })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const inputRef = useRef(null)

  const arCount = eleves.filter(e => e.amenagements_raisonnables?.trim()).length

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const isLinked = (eleveId) =>
    linkedSets.some(set => set.has(eleveId))

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 transition-colors shrink-0
        ${isPool
          ? 'border-gray-200 bg-gray-50/80'
          : isOver
            ? 'border-indigo-300 bg-indigo-50/40'
            : 'border-gray-100 bg-white'
        }`}
      style={{ width: 220, minHeight: 300 }}
    >
      {/* Header colonne */}
      <div className={`px-3 py-2.5 border-b ${isPool ? 'border-gray-200' : 'border-gray-100'} flex items-center gap-2`}>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => { setEditing(false); onRename(group.id, name) }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onRename(group.id, name) } }}
              className="w-full text-sm font-semibold border-b border-indigo-400 outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => !isPool && setEditing(true)}
              className={`text-sm font-bold truncate text-left w-full ${isPool ? 'text-gray-500 cursor-default' : 'text-gray-700 hover:text-indigo-600'}`}
            >
              {group.name}
            </button>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isPool ? 'bg-gray-200 text-gray-600' : 'bg-indigo-100 text-indigo-600'
        }`}>
          {eleves.length}
        </span>
        {arCount > 0 && (
          <span className="text-[10px] font-semibold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
            {arCount} AR
          </span>
        )}
        {!isPool && (
          <button onClick={() => onDelete(group.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Zone de drop */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 p-2 overflow-y-auto transition-colors ${
          isOver ? 'bg-indigo-50/60' : ''
        }`}
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
        <SortableContext items={eleves.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {eleves.map(eleve => (
            <SortableEleveCard
              key={eleve.id}
              eleve={eleve}
              fields={fields}
              selected={selectedIds.has(eleve.id)}
              onSelect={onSelect}
              linked={isLinked(eleve.id)}
              groupId={group.id}
              selectedIds={selectedIds}
            />
          ))}
        </SortableContext>
        {eleves.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className={`text-xs ${isPool ? 'text-gray-300' : 'text-gray-300'}`}>
              {isPool ? 'Tous assignés ✓' : 'Déposer ici'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  Page principale
// ══════════════════════════════════════════════════════════════════════════════
export default function Compositions() {
  const { profile } = useAuth()

  // ── État global ────────────────────────────────────────────────────────────
  const [innerTab, setInnerTab]   = useState('config')   // 'config' | 'board'
  const [loading, setLoading]     = useState(false)
  const [allEleves, setAllEleves] = useState([])

  // ── Config ─────────────────────────────────────────────────────────────────
  const [selectedAnnees, setSelectedAnnees] = useState([])
  const [selectedClasses, setSelectedClasses] = useState([])
  const [fields, setFields] = useState(DEFAULT_FIELDS)
  const [compositionName, setCompositionName] = useState('Nouvelle composition')
  const [customFields, setCustomFields] = useState([]) // { id, label, values: {eleveId: val} }

  // ── Board ──────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState([])    // [{ id, name }]
  const [assignments, setAssignments] = useState({})  // { eleveId: groupId | POOL_ID }
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [linkedSets, setLinkedSets] = useState([])   // [Set<eleveId>]
  const [activeId, setActiveId] = useState(null)
  const [dragging, setDragging] = useState(null)

  // ── Classes disponibles ────────────────────────────────────────────────────
  const availableClasses = useMemo(() =>
    [...new Set(allEleves.map(e => e.classe).filter(Boolean))].sort()
  , [allEleves])

  // ── Élèves filtrés ─────────────────────────────────────────────────────────
  const filteredEleves = useMemo(() => {
    let list = allEleves
    if (selectedAnnees.length > 0) {
      list = list.filter(e => {
        const ann = getAnneFromClasse(e.classe)
        return ann && selectedAnnees.includes(ann)
      })
    }
    if (selectedClasses.length > 0) {
      list = list.filter(e => selectedClasses.includes(e.classe))
    }
    return list
  }, [allEleves, selectedAnnees, selectedClasses])

  // ── Charger les élèves ─────────────────────────────────────────────────────
  const loadEleves = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, classe, smartschool_internal_number, groupes_ss, amenagements_raisonnables')
      .eq('actif', true)
      .order('nom')
    setAllEleves(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEleves() }, [loadEleves])

  // Sync assignments quand filteredEleves change
  useEffect(() => {
    setAssignments(prev => {
      const next = { ...prev }
      // Ajouter les nouveaux élèves dans le pool
      for (const e of filteredEleves) {
        if (!(e.id in next)) next[e.id] = POOL_ID
      }
      return next
    })
  }, [filteredEleves])

  // ── DnD Sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  // ── Helpers board ──────────────────────────────────────────────────────────
  const getGroupEleves = useCallback((groupId) =>
    filteredEleves.filter(e => (assignments[e.id] ?? POOL_ID) === groupId)
  , [filteredEleves, assignments])

  const toggleSelect = useCallback((eleveId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(eleveId)) next.delete(eleveId)
      else next.add(eleveId)
      return next
    })
  }, [])

  const clearSelection = () => setSelectedIds(new Set())

  // ── Gestion groupes ────────────────────────────────────────────────────────
  const addGroup = () => {
    const id = 'g_' + Date.now()
    setGroups(prev => [...prev, { id, name: `Groupe ${prev.length + 1}` }])
  }

  const renameGroup = (id, name) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g))
  }

  const deleteGroup = (id) => {
    setGroups(prev => prev.filter(g => g.id !== id))
    setAssignments(prev => {
      const next = { ...prev }
      for (const [eleveId, gId] of Object.entries(next)) {
        if (gId === id) next[eleveId] = POOL_ID
      }
      return next
    })
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
    const eleve = filteredEleves.find(e => e.id === active.id)
    setDragging(eleve)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    setDragging(null)
    if (!over) return

    const targetGroupId = over.data?.current?.groupId ?? over.id
    if (!targetGroupId) return

    // Ids à déplacer : si sélection active ET l'élève draggé est dans la sélection
    let idsToMove = [active.id]
    if (selectedIds.has(active.id) && selectedIds.size > 1) {
      idsToMove = [...selectedIds]
    }
    // Inclure les cartes liées
    const linked = new Set(idsToMove)
    for (const id of idsToMove) {
      for (const linkSet of linkedSets) {
        if (linkSet.has(id)) linkSet.forEach(lid => linked.add(lid))
      }
    }

    setAssignments(prev => {
      const next = { ...prev }
      for (const id of linked) {
        if (id in next) next[id] = targetGroupId
      }
      return next
    })
  }

  // ── Lier/délier la sélection ───────────────────────────────────────────────
  const linkSelection = () => {
    if (selectedIds.size < 2) return
    const newSet = new Set(selectedIds)
    // Fusionner avec les ensembles existants qui se recoupent
    const merged = [newSet]
    const remaining = linkedSets.filter(s => {
      for (const id of s) {
        if (newSet.has(id)) {
          s.forEach(x => merged[0].add(x))
          return false
        }
      }
      return true
    })
    setLinkedSets([...remaining, ...merged])
    clearSelection()
  }

  const unlinkSelection = () => {
    setLinkedSets(prev => prev.filter(s => {
      for (const id of selectedIds) { if (s.has(id)) return false }
      return true
    }))
    clearSelection()
  }

  const isLinked = useCallback((eleveId) =>
    linkedSets.some(s => s.has(eleveId))
  , [linkedSets])

  // ── Import / Export JSON ───────────────────────────────────────────────────
  const exportJSON = () => {
    const data = {
      name: compositionName,
      date: new Date().toISOString(),
      selectedAnnees,
      selectedClasses,
      fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.enabled])),
      groups,
      assignments,
      linkedSets: linkedSets.map(s => [...s]),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `composition_${compositionName.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJSON = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.name)            setCompositionName(data.name)
        if (data.selectedAnnees) setSelectedAnnees(data.selectedAnnees)
        if (data.selectedClasses) setSelectedClasses(data.selectedClasses)
        if (data.fields)          setFields(prev => Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, { ...v, enabled: data.fields[k] ?? v.enabled }])
        ))
        if (data.groups)          setGroups(data.groups)
        if (data.assignments)     setAssignments(data.assignments)
        if (data.linkedSets)      setLinkedSets(data.linkedSets.map(s => new Set(s)))
      } catch { alert('Fichier JSON invalide') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Champs affichés ────────────────────────────────────────────────────────
  const enabledFields = useMemo(() =>
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.enabled]))
  , [fields])

  // ── Colonnes du board ──────────────────────────────────────────────────────
  const allColumns = useMemo(() => [
    { id: POOL_ID, name: 'Pool — Élèves à placer', isPool: true },
    ...groups,
  ], [groups])

  // ══ RENDER ══════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Compositions"
        subtitle="Outil de composition de classes"
        tabs={[
          { key: 'config', label: 'Configuration' },
          { key: 'board',  label: 'Composition' },
        ]}
        activeTab={innerTab}
        onTabChange={setInnerTab}
        actions={
          <div className="flex items-center gap-2">
            {innerTab === 'board' && selectedIds.size >= 2 && (
              <button onClick={linkSelection}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                <Link size={13} /> Lier
              </button>
            )}
            {innerTab === 'board' && selectedIds.size >= 1 && (
              <button onClick={unlinkSelection}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
                <Unlink size={13} /> Délier
              </button>
            )}
            {innerTab === 'board' && selectedIds.size >= 1 && (
              <button onClick={clearSelection}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
                <X size={13} /> {selectedIds.size} sél.
              </button>
            )}
            {innerTab === 'config' && (
              <button onClick={() => document.getElementById('import-json').click()}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
                <Upload size={13} /> Import JSON
              </button>
            )}
            <button onClick={exportJSON}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
              <Download size={13} /> Export JSON
            </button>
          </div>
        }
      />
      <input id="import-json" type="file" accept=".json" className="hidden" onChange={importJSON} />

      {/* ── TAB CONFIGURATION ─────────────────────────────────────────── */}
      {innerTab === 'config' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Nom */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Nom de la composition</h3>
            <input
              value={compositionName}
              onChange={e => setCompositionName(e.target.value)}
              className="w-full max-w-md text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
              placeholder="Ex : Composition 2026-2027 — 3e année"
            />
          </div>

          {/* Source */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Source — Élèves à composer</h3>
              <button onClick={loadEleves} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Filtrer par année */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Par année scolaire</p>
                <div className="flex flex-wrap gap-2">
                  {ANNEES.map(a => (
                    <button key={a} onClick={() => setSelectedAnnees(prev =>
                      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                    )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedAnnees.includes(a)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {a}e année
                    </button>
                  ))}
                  {selectedAnnees.length > 0 && (
                    <button onClick={() => setSelectedAnnees([])}
                      className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-500">
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Filtrer par classe */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Ou par classe précise</p>
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map(c => (
                    <button key={c} onClick={() => setSelectedClasses(prev =>
                      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                    )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedClasses.includes(c)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Résumé */}
              <div className="flex items-center gap-2 pt-1">
                <Users size={14} className="text-indigo-400" />
                <span className="text-sm text-gray-600">
                  <span className="font-bold text-indigo-600">{filteredEleves.length}</span> élève{filteredEleves.length !== 1 ? 's' : ''} sélectionné{filteredEleves.length !== 1 ? 's' : ''}
                  {filteredEleves.length === 0 && !selectedAnnees.length && !selectedClasses.length && (
                    <span className="text-gray-400 ml-1">(aucun filtre → tous les élèves actifs)</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Champs vignette */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Champs affichés sur les vignettes</h3>
            <div className="space-y-2">
              {Object.entries(fields).map(([key, field]) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    onClick={() => setFields(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                      field.enabled ? 'bg-indigo-500' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      field.enabled ? 'left-[18px]' : 'left-0.5'
                    }`} />
                  </button>
                  <span className={`text-sm ${field.enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                    {field.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Groupes cibles */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Groupes cibles</h3>
              <button onClick={addGroup}
                className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                <Plus size={13} /> Ajouter un groupe
              </button>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun groupe — cliquer "Ajouter un groupe" pour commencer.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                    <span className="text-sm font-medium text-indigo-700">{g.name}</span>
                    <span className="text-xs text-indigo-400">{getGroupEleves(g.id).length}</span>
                    <button onClick={() => deleteGroup(g.id)} className="text-indigo-300 hover:text-red-400 ml-1">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {groups.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                Double-cliquer sur le nom d'un groupe dans le board pour le renommer.
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="flex justify-end">
            <button
              onClick={() => setInnerTab('board')}
              disabled={filteredEleves.length === 0}
              className="flex items-center gap-2 bg-indigo-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LayoutGrid size={16} /> Ouvrir le board →
            </button>
          </div>
        </div>
      )}

      {/* ── TAB BOARD ─────────────────────────────────────────────────── */}
      {innerTab === 'board' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Infos bar */}
          <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-4 shrink-0">
            <span className="text-sm font-semibold text-gray-600">{compositionName}</span>
            <span className="text-xs text-gray-400">{filteredEleves.length} élèves · {groups.length} groupe{groups.length !== 1 ? 's' : ''}</span>
            {selectedIds.size > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                {' — '}
                <button onClick={clearSelection} className="underline">désélectionner</button>
              </span>
            )}
            <button onClick={addGroup} className="ml-auto flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              <Plus size={13} /> Nouveau groupe
            </button>
          </div>

          {/* Board Kanban */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 p-4 h-full items-start" style={{ minWidth: 'max-content' }}>
                {allColumns.map(col => (
                  <GroupColumn
                    key={col.id}
                    group={col}
                    eleves={getGroupEleves(col.id)}
                    fields={enabledFields}
                    selectedIds={selectedIds}
                    onSelect={toggleSelect}
                    linkedSets={linkedSets}
                    onRename={renameGroup}
                    onDelete={deleteGroup}
                    isPool={col.id === POOL_ID}
                  />
                ))}

                {/* Bouton ajouter colonne */}
                <button
                  onClick={addGroup}
                  className="shrink-0 w-[220px] h-24 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors flex flex-col items-center justify-center gap-1.5"
                >
                  <Plus size={20} />
                  <span className="text-xs font-medium">Nouveau groupe</span>
                </button>
              </div>

              {/* DragOverlay */}
              <DragOverlay>
                {dragging && (
                  <div className="w-[196px] rotate-2 shadow-2xl">
                    <EleveCard
                      eleve={dragging}
                      fields={enabledFields}
                      selected={selectedIds.has(dragging.id)}
                      onSelect={() => {}}
                      linked={isLinked(dragging.id)}
                      isDragging={true}
                    />
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
        </div>
      )}
    </div>
  )
}
