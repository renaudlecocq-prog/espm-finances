// Compositions.jsx — v4 : liste projets + modal création + modal config
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
import PageHeader from '../components/ui/PageHeader'
import MasterFilter from '../components/ui/MasterFilter'
import {
  LayoutGrid, Plus, Trash2, Download, Upload, X, AlertTriangle,
  RefreshCw, Users, Link, Unlink, Check, FolderOpen, Settings,
  Maximize2, Minimize2, Search, ArrowLeft, Calendar, ChevronRight,
  FileDown, FileUp, Table2, PlusCircle, MinusCircle, CheckCircle2,
} from 'lucide-react'

// ── Constantes ────────────────────────────────────────────────────────────────
const POOL_ID = '__pool__'
const DEFAULT_FIELDS = {
  photo:    { label: 'Photo',             enabled: true },
  classe:   { label: 'Classe actuelle',   enabled: true },
  groupes:  { label: 'Groupes SS',        enabled: true },
  troubles: { label: 'Troubles attestés', enabled: true },
  sexe:     { label: 'Sexe',               enabled: true },
}

const getAnneFromClasse = c => { const m = c?.match(/^(\d)/); return m ? m[1] : null }



// ── ElevePhoto ─────────────────────────────────────────────────────────────────
// photoUrl  : URL stockée en DB (priorité absolue, pas d'appel Smartschool)
// onUpload  : callback(url) optionnel — si fourni, clic sur la photo ouvre un file picker
function ElevePhoto({ username, internalNumber, photoUrl = null, eleveId = null, onUpload = null, size = 40 }) {
  const [src, setSrc]             = useState(photoUrl || null)
  const [err, setErr]             = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef                  = useRef(null)
  const cacheKey                  = internalNumber ? 'ssp_n_' + internalNumber : 'ssp_u_' + username

  // Si une photo DB est fournie, l'utiliser directement (pas d'appel Smartschool)
  useEffect(() => {
    if (photoUrl) { setSrc(photoUrl); setErr(false); return }
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
  }, [username, internalNumber, photoUrl, cacheKey])

  // Resize + upload vers Supabase storage
  const handleFile = useCallback(async (file) => {
    if (!file || !eleveId) return
    setUploading(true)
    try {
      const resized = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const MAX = 300
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
          const canvas = document.createElement('canvas')
          canvas.width  = Math.round(img.width  * ratio)
          canvas.height = Math.round(img.height * ratio)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.85)
        }
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })
      const path = `${eleveId}.jpg`
      const { error: upErr } = await supabase.storage
        .from('eleve-photos')
        .upload(path, resized, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('eleve-photos').getPublicUrl(path)
      const urlWithTs = `${publicUrl}?t=${Date.now()}`
      await supabase.from('eleves').update({ photo_url: urlWithTs }).eq('id', eleveId)
      setSrc(urlWithTs)
      setErr(false)
      if (onUpload) onUpload(urlWithTs)
    } catch (e) {
      console.error('Photo upload error:', e)
    } finally {
      setUploading(false)
    }
  }, [eleveId, onUpload])

  const sz = `${size}px`
  const canUpload = !!onUpload && !!eleveId

  const placeholder = (
    <div
      style={{ width: sz, height: sz }}
      onClick={canUpload ? () => inputRef.current?.click() : undefined}
      className={`rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xs shrink-0${canUpload ? ' cursor-pointer hover:bg-indigo-200 transition-colors' : ''}`}
      title={canUpload ? 'Cliquer pour uploader une photo' : ''}>
      {uploading
        ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        : '?'}
    </div>
  )

  return (
    <>
      {canUpload && (
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      )}
      {(err || !src)
        ? placeholder
        : <div style={{ width: sz, height: sz }}
            onClick={canUpload ? () => inputRef.current?.click() : undefined}
            className={`relative rounded-full shrink-0${canUpload ? ' cursor-pointer group' : ''}`}
            title={canUpload ? 'Cliquer pour changer la photo' : ''}>
            <img src={src} alt="" style={{ width: sz, height: sz }}
              className="rounded-full object-cover border-2 border-white shadow-sm"
              onError={() => setErr(true)} />
            {canUpload && (
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="text-white text-[9px] font-bold">PHOTO</span>}
              </div>
            )}
          </div>
      }
    </>
  )
}

// ── EleveCard ──────────────────────────────────────────────────────────────────
function EleveCard({ eleve, fields, customFields, onCFChange, selected, onSelect, linked, cardMode, isDragging }) {
  const hasAR  = eleve.amenagements_raisonnables?.trim()
  const groupes = Array.isArray(eleve.groupes_ss) ? eleve.groupes_ss.filter(Boolean) : []
  const compact = cardMode === 'compact'

  return (
    <div className={`relative rounded-xl border bg-white transition-all select-none cursor-grab active:cursor-grabbing overflow-hidden
      ${selected ? 'border-indigo-400 shadow-md ring-2 ring-indigo-300/60'
        : isDragging ? 'border-indigo-200 shadow-lg opacity-80'
        : 'border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md'}`}>
      {linked && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-violet-100 rounded-full p-0.5">
          <Link size={10} className="text-violet-500" />
        </div>
      )}
      <div className={`p-2.5 pt-2 w-full min-w-0 ${compact ? '' : 'pb-3'}`}>
        <div className="flex items-center gap-2">
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onSelect(eleve.id) }}
            className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
              ${selected ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-400 hover:border-indigo-400 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]'}`}>
            {selected && <Check size={9} className="text-white" strokeWidth={3} />}
          </button>
          {fields.photo && <ElevePhoto
              username={eleve.smartschool_username}
              internalNumber={eleve.smartschool_internal_number}
              photoUrl={eleve.photo_url || null}
              eleveId={eleve.id}
              onUpload={null}
              size={compact ? 32 : 40} />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">{eleve.nom?.toUpperCase()}</p>
            <p className="text-xs text-gray-500 leading-tight truncate">{eleve.prenom}</p>
            {compact && fields.classe && eleve.classe && (
              <span className="text-[10px] text-blue-500 font-medium">{eleve.classe}</span>
            )}
            {compact && fields.sexe && eleve.sexe && (
              <span className={`text-[10px] font-bold ml-0.5 ${eleve.sexe === 'M' ? 'text-green-500' : eleve.sexe === 'F' ? 'text-red-400' : 'text-gray-400'}`}>{eleve.sexe}</span>
            )}
          </div>
        </div>
        {!compact && (
          <>
            <div className="flex flex-wrap gap-1 mt-2">
              {fields.classe && eleve.classe && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{eleve.classe}</span>
              )}
              {fields.sexe && eleve.sexe && (
                <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${eleve.sexe === 'M' ? 'bg-green-50 text-green-600' : eleve.sexe === 'F' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>{eleve.sexe === 'M' ? 'G' : eleve.sexe === 'F' ? 'F' : eleve.sexe}</span>
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
                <div className="flex items-center gap-1.5 w-full min-w-0 overflow-hidden">
                  <span className="text-[10px] text-gray-400 shrink-0 truncate max-w-[70px]">{cf.label}:</span>
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
  const arCount     = eleves.filter(e => e.amenagements_raisonnables?.trim()).length
  const garconCount = eleves.filter(e => e.sexe === 'M').length
  const filleCount  = eleves.filter(e => e.sexe === 'F').length
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
        {!isPool && garconCount > 0 && (
          <span className="text-[10px] font-semibold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">{garconCount}G</span>
        )}
        {!isPool && filleCount > 0 && (
          <span className="text-[10px] font-semibold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">{filleCount}F</span>
        )}
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
    includedIds, setIncludedIds,
    fields, setFields, customFields, setCustomFields, compositionName, setCompositionName, showName = true,
    onExport, onImport }) {

  const [eleveSearch, setEleveSearch]   = useState('')
  const [includeSearch, setIncludeSearch] = useState('')
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
    const baseIds = new Set(list.map(e => e.id))
    return allEleves.filter(e =>
      includedIds.has(e.id) || (baseIds.has(e.id) && !excludedIds.has(e.id))
    ).length
  }, [allEleves, filters, excludedIds, includedIds])

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

        {/* Filtres */}
        <div className="mb-2">
          <MasterFilter filters={filters} filterDefs={filterDefs} onChange={toggleFilter} onClearAll={() => setFilters({})} />
        </div>

        {/* Exclure */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <MinusCircle size={11} className="text-red-400" />
            <span className="text-xs font-medium text-gray-500">Exclure un élève</span>
            {excludedIds.size > 0 && (
              <button onClick={() => setExcludedIds(new Set())}
                className="ml-auto text-xs text-red-400 hover:text-red-600">Tout retirer</button>
            )}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={eleveSearch} onChange={e => setEleveSearch(e.target.value)}
              placeholder="Rechercher un élève à exclure…"
              className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-red-300" />
          </div>
          {/* Résultats recherche exclusion */}
          {eleveSearch && (
            <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
              {allEleves.filter(e =>
                `${e.nom} ${e.prenom}`.toLowerCase().includes(eleveSearch.toLowerCase()) && !includedIds.has(e.id)
              ).slice(0, 20).map(e => (
                <button key={e.id} onClick={() => {
                  setExcludedIds(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })
                  setEleveSearch('')
                }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors
                    ${excludedIds.has(e.id) ? 'bg-red-50 border-red-200 text-red-500' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'}`}>
                  {excludedIds.has(e.id) ? <CheckCircle2 size={9} className="text-red-400" /> : <MinusCircle size={9} className="text-gray-300" />}
                  {e.nom} {e.prenom} <span className="text-gray-400">· {e.classe}</span>
                </button>
              ))}
            </div>
          )}
          {/* Chips exclus actifs */}
          {excludedIds.size > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {allEleves.filter(e => excludedIds.has(e.id)).map(e => (
                <span key={e.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-50 border border-red-200 text-red-600">
                  {e.nom} {e.prenom} · {e.classe}
                  <button onClick={() => setExcludedIds(prev => { const n = new Set(prev); n.delete(e.id); return n })}
                    className="ml-0.5 hover:text-red-800"><X size={9} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ajouter hors filtre */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <PlusCircle size={11} className="text-emerald-500" />
            <span className="text-xs font-medium text-gray-500">Ajouter un élève hors filtre</span>
            {includedIds.size > 0 && (
              <button onClick={() => setIncludedIds(new Set())}
                className="ml-auto text-xs text-emerald-600 hover:text-emerald-800">Tout retirer</button>
            )}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={includeSearch} onChange={e => setIncludeSearch(e.target.value)}
              placeholder="Rechercher un élève à ajouter…"
              className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-emerald-300" />
          </div>
          {/* Résultats recherche inclusion */}
          {includeSearch && (
            <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
              {allEleves.filter(e =>
                `${e.nom} ${e.prenom}`.toLowerCase().includes(includeSearch.toLowerCase()) && !excludedIds.has(e.id)
              ).slice(0, 20).map(e => (
                <button key={e.id} onClick={() => {
                  setIncludedIds(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })
                  setIncludeSearch('')
                }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors
                    ${includedIds.has(e.id) ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                  {includedIds.has(e.id) ? <CheckCircle2 size={9} className="text-emerald-500" /> : <PlusCircle size={9} className="text-gray-300" />}
                  {e.nom} {e.prenom} <span className="text-gray-400">· {e.classe}</span>
                </button>
              ))}
            </div>
          )}
          {/* Chips inclus actifs */}
          {includedIds.size > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {allEleves.filter(e => includedIds.has(e.id)).map(e => (
                <span key={e.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 border border-emerald-200 text-emerald-700">
                  {e.nom} {e.prenom} · {e.classe}
                  <button onClick={() => setIncludedIds(prev => { const n = new Set(prev); n.delete(e.id); return n })}
                    className="ml-0.5 hover:text-emerald-900"><X size={9} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Compteur */}
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-indigo-400" />
          <span className="text-xs text-gray-600">
            <span className="font-bold text-indigo-600">{filteredCount}</span> élève{filteredCount !== 1 ? 's' : ''} sélectionné{filteredCount !== 1 ? 's' : ''}
          </span>
          {includedIds.size > 0 && <span className="text-xs text-emerald-600">+{includedIds.size} ajouté{includedIds.size > 1 ? 's' : ''}</span>}
          {excludedIds.size > 0 && <span className="text-xs text-red-500">−{excludedIds.size} exclus</span>}
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

        {/* Export / Import Excel */}
        {(onExport || onImport) && (
          <div className="flex gap-2 pt-1 border-t border-gray-100 mt-2">
            {onExport && (
              <button onClick={onExport}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors flex-1 justify-center">
                <FileDown size={12} /> Exporter vers Excel
              </button>
            )}
            {onImport && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors flex-1 justify-center cursor-pointer">
                <FileUp size={12} /> Importer depuis Excel
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onImport} />
              </label>
            )}
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
  // ── Navigation ────────────────────────────────────────────────────────────
  const [view, setView] = useState('list') // 'list' | 'board'

  // ── Données ───────────────────────────────────────────────────────────────
  const [allEleves, setAllEleves] = useState([])
  const [loading, setLoading]     = useState(false)

  // ── Config composition active ─────────────────────────────────────────────
  const [compositionName, setCompositionName] = useState('Nouvelle composition')
  const [filters, setFilters]                 = useState({})
  const [excludedIds, setExcludedIds]         = useState(new Set())
  const [includedIds, setIncludedIds]         = useState(new Set())
  const [importToast, setImportToast]         = useState(null) // { ok, msg }
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
  const [savedList, setSavedList]   = useState([])
  const [dbLoading, setDbLoading]    = useState(true)
  const [lastSaved, setLastSaved]         = useState(null)
  const [lastSavedBy, setLastSavedBy]     = useState(null)  // null = moi-même
  const [hasPendingChanges, setHasPending] = useState(false)
  const autoSaveTimer               = useRef(null)

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfigModal, setShowConfigModal]  = useState(false)
  const [showImportModal, setShowImportModal]  = useState(false)

  // État temporaire pour la modal de création
  const [draftName,         setDraftName]         = useState('Nouvelle composition')
  const [draftFilters,      setDraftFilters]       = useState({})
  const [draftExcludedIds,  setDraftExcludedIds]   = useState(new Set())
  const [draftIncludedIds,  setDraftIncludedIds]   = useState(new Set())
  const [draftFields,       setDraftFields]        = useState(DEFAULT_FIELDS)
  const [draftCustomFields, setDraftCustomFields]  = useState([])

  // ── Chargement élèves ─────────────────────────────────────────────────────
  const loadEleves = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('eleves')
      .select('id, nom, prenom, classe, sexe, smartschool_username, smartschool_internal_number, groupes_ss, amenagements_raisonnables, philosophie, groupe_choix_philo, photo_url')
      .eq('actif', true).order('nom')
    setAllEleves(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEleves() }, [loadEleves])

  // ── Chargement projets depuis Supabase ────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setDbLoading(true)
    const { data } = await supabase.from('compositions_projets')
      .select('id, nom, updated_at, data')
      .order('updated_at', { ascending: false })
    setSavedList((data || []).map(r => ({ id: r.id, name: r.nom, date: r.updated_at, data: r.data })))
    setDbLoading(false)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  // ── Migration localStorage → Supabase ─────────────────────────────────────
  const [migrating, setMigrating] = useState(false)
  const hasLocalData = (() => { try { const d = JSON.parse(localStorage.getItem('espm_compositions_v1') || '[]'); return d.length > 0 } catch { return false } })()

  const migrateFromLocalStorage = async () => {
    setMigrating(true)
    try {
      const old = JSON.parse(localStorage.getItem('espm_compositions_v1') || '[]')
      for (const entry of old) {
        const now = entry.date || new Date().toISOString()
        await supabase.from('compositions_projets')
          .insert({ nom: entry.name || entry.data?.name || 'Sans titre', updated_at: now, data: entry.data || {} })
      }
      localStorage.removeItem('espm_compositions_v1')
      await loadProjects()
    } finally {
      setMigrating(false)
    }
  }

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
    const baseIds = new Set(list.map(e => e.id))
    return allEleves.filter(e =>
      includedIds.has(e.id) || (baseIds.has(e.id) && !excludedIds.has(e.id))
    )
  }, [allEleves, filters, excludedIds, includedIds])

  // ── Sync assignments ──────────────────────────────────────────────────────
  useEffect(() => {
    setAssignments(prev => {
      const next = { ...prev }
      for (const e of filteredEleves) { if (!(e.id in next)) next[e.id] = POOL_ID }
      return next
    })
  }, [filteredEleves])

  // ── currentProjectId : UUID du projet en cours d'édition ────────────────
  const currentProjectId = useRef(null)
  const lastNonce        = useRef(null)   // nonce unique par save — évite que notre propre update realtime écrase l'état courant
  const realtimeRef      = useRef(null)   // canal Supabase Realtime actif
  const pendingSave      = useRef(false)  // true = changements non encore sauvegardés

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const doSave = useCallback((immediate = false) => {
    const save = async () => {
      const now  = new Date().toISOString()
      const data = {
        name: compositionName, date: now, filters, excludedIds: [...excludedIds], includedIds: [...includedIds],
        fields: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.enabled])),
        customFields, groups, assignments, linkedSets: linkedSets.map(s => [...s]), cardMode,
      }
      const pid = currentProjectId.current
      if (!pid) return // pas encore de projet créé
      const nonce = Math.random().toString(36).slice(2)
      lastNonce.current = nonce
      const dataWithNonce = { ...data, _nonce: nonce }
      const myName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.email || 'Moi'
      const { error } = await supabase.from('compositions_projets')
        .update({ nom: compositionName, updated_at: now, data: dataWithNonce, updated_by: myName })
        .eq('id', pid)
      if (!error) {
        pendingSave.current = false
        setHasPending(false)
        setSavedList(prev => prev.map(p => p.id === pid ? { ...p, name: compositionName, date: now, data: dataWithNonce } : p))
        setLastSaved(now)
        setLastSavedBy(null) // null = c'est moi
      }
    }
    if (immediate) { clearTimeout(autoSaveTimer.current); save() }
    else {
      clearTimeout(autoSaveTimer.current)
      pendingSave.current = true
      setHasPending(true)
      autoSaveTimer.current = setTimeout(save, 500)
    }
  }, [compositionName, filters, excludedIds, includedIds, fields, customFields, groups, assignments, linkedSets, cardMode])

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

  // ── Export / Import XLSX ────────────────────────────────────────────────────
  const exportXLSX = useCallback(() => {
    // Colonnes Groupes SS — on calcule le max de groupes parmi tous les élèves
    const maxGS = Math.max(0, ...filteredEleves.map(e => (e.groupes_ss || []).length))
    const gsHeaders = maxGS > 0 ? Array.from({ length: maxGS }, (_, i) => `Groupe SS ${i + 1}`) : []
    const cfLabels  = customFields.map(cf => cf.label)

    // Header — __id__ en dernier pour décourager de le modifier
    const headers = ['Nom', 'Prénom', 'Classe', 'Sexe', 'Groupe composition', ...gsHeaders, ...cfLabels, '!!! id (ne pas modifier) !!!']

    const rows = filteredEleves.map(e => {
      const gid       = assignments[e.id] ?? POOL_ID
      const groupeNom = gid === POOL_ID ? '(Pool)' : (groups.find(g => g.id === gid)?.name || '(Pool)')
      const gsValues  = Array.from({ length: maxGS }, (_, i) => (e.groupes_ss || [])[i] || '')
      return [
        e.nom, e.prenom, e.classe || '', e.sexe || '', groupeNom,
        ...gsValues,
        ...customFields.map(cf => cf.values?.[e.id] || ''),
        e.id,
      ]
    })

    const wsData = [headers, ...rows]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Largeurs colonnes
    const idColIdx = headers.length - 1
    ws['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 6 }, { wch: 22 },
      ...gsHeaders.map(() => ({ wch: 28 })),
      ...cfLabels.map(() => ({ wch: 22 })),
      { wch: 38 },
    ]

    // Colorer l'en-tête de la colonne id en rouge
    const idCellRef = XLSX.utils.encode_cell({ r: 0, c: idColIdx })
    if (ws[idCellRef]) {
      ws[idCellRef].s = { font: { color: { rgb: 'CC0000' }, bold: true } }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Composition')
    XLSX.writeFile(wb, `composition_${compositionName.replace(/\s+/g, '_')}.xlsx`)
  }, [filteredEleves, assignments, groups, customFields, compositionName])

  const importXLSX = useCallback((e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
        if (data.length < 2) {
          setImportToast({ ok: false, msg: 'Fichier vide ou invalide' })
          setTimeout(() => setImportToast(null), 4000)
          return
        }
        // Normaliser pour éviter les divergences d'encodage Unicode (è vs e + combining)
        const norm = s => String(s || '').normalize('NFC').trim()
        const headers = data[0].map(norm)
        const idIdx   = headers.findIndex(h => h.includes('id (ne pas') || h === '__id__')
        if (idIdx === -1) {
          setImportToast({ ok: false, msg: 'Colonne id introuvable — assurez-vous de ne pas avoir renommé la dernière colonne' })
          setTimeout(() => setImportToast(null), 5000)
          return
        }
        let totalUpdated = 0
        let fieldsUpdated = 0
        const updated = customFields.map(cf => {
          const colIdx = headers.findIndex(h => norm(h) === norm(cf.label))
          if (colIdx === -1) return cf
          const newValues = { ...cf.values }
          let count = 0
          for (let i = 1; i < data.length; i++) {
            const row = data[i]
            const id  = norm(row[idIdx])
            const val = row[colIdx] !== undefined && row[colIdx] !== null ? norm(row[colIdx]) : ''
            if (id && val) { newValues[id] = val; count++ }
          }
          if (count > 0) { totalUpdated += count; fieldsUpdated++ }
          return { ...cf, values: newValues }
        })
        setCustomFields(updated)
        if (totalUpdated === 0) {
          setImportToast({ ok: false, msg: 'Aucune valeur importée — les colonnes de champs personnalisés ne correspondent pas ou sont vides' })
        } else {
          setImportToast({ ok: true, msg: `${totalUpdated} valeur${totalUpdated > 1 ? 's' : ''} importée${totalUpdated > 1 ? 's' : ''} sur ${fieldsUpdated} champ${fieldsUpdated > 1 ? 's' : ''}` })
        }
        setTimeout(() => setImportToast(null), 4000)
      } catch (err) {
        setImportToast({ ok: false, msg: 'Erreur : ' + err.message })
        setTimeout(() => setImportToast(null), 5000)
      }
    }
    reader.readAsBinaryString(file); e.target.value = ''
  }, [customFields])

  // ── Realtime collaboration ────────────────────────────────────────────────
  const applyCompositionData = useCallback((d) => {
    if (d.name)         setCompositionName(d.name)
    if (d.filters)      setFilters(d.filters)
    if (d.excludedIds)  setExcludedIds(new Set(d.excludedIds))
    if (d.includedIds)  setIncludedIds(new Set(d.includedIds))
    if (d.fields)       setFields(prev => Object.fromEntries(
      Object.entries(prev).map(([k,v]) => [k, { ...v, enabled: d.fields[k] ?? v.enabled }])
    ))
    if (d.customFields) setCustomFields(d.customFields)
    if (d.groups)       setGroups(d.groups)
    if (d.assignments)  setAssignments(d.assignments)
    if (d.linkedSets)   setLinkedSets(d.linkedSets.map(s => new Set(s)))
    if (d.cardMode)     setCardMode(d.cardMode)
  }, [])

  const subscribeToProject = useCallback((pid) => {
    try {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
      if (!pid) return
      const ch = supabase.channel(`comp_${pid}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'compositions_projets', filter: `id=eq.${pid}` },
          (payload) => {
            // Ignorer nos propres sauvegardes pour éviter une boucle
            if (payload.new.updated_at === lastSaveTs.current) return
            applyCompositionData(payload.new.data || {})
            setLastSaved(payload.new.updated_at)
            setLastSavedBy(payload.new.updated_by || 'Quelqu\'un')
          })
        .subscribe()
      realtimeRef.current = ch
    } catch(e) {
      console.warn('Realtime subscribe error:', e)
    }
  }, [applyCompositionData])

  // ── Désérialisation ───────────────────────────────────────────────────────
  const loadComposition = entry => {
    currentProjectId.current = entry.id
    pendingSave.current = false   // rien à sauvegarder au chargement
    setHasPending(false)
    applyCompositionData(entry.data)
    setLastSaved(entry.date || null)
    setLastSavedBy(null)
    setView('board')          // navigate first — realtime is best-effort
    subscribeToProject(entry.id)
  }

  const deleteComposition = async id => {
    await supabase.from('compositions_projets').delete().eq('id', id)
    setSavedList(prev => prev.filter(c => c.id !== id))
    if (currentProjectId.current === id) { currentProjectId.current = null; subscribeToProject(null); setView('list') }
  }

  // ── Créer nouvelle composition ────────────────────────────────────────────
  const openCreateModal = () => {
    setDraftName('Nouvelle composition'); setDraftFilters({}); setDraftExcludedIds(new Set())
    setDraftFields(DEFAULT_FIELDS); setDraftCustomFields([])
    setShowCreateModal(true)
  }

  const confirmCreate = async () => {
    const now = new Date().toISOString()
    const data = {
      name: draftName, date: now, filters: draftFilters,
      excludedIds: [...draftExcludedIds], includedIds: [...draftIncludedIds],
      fields: Object.fromEntries(Object.entries(draftFields).map(([k,v]) => [k,v.enabled])),
      customFields: draftCustomFields, groups: [], assignments: {}, linkedSets: [], cardMode: 'etendu',
    }
    const { data: rows, error } = await supabase.from('compositions_projets')
      .insert({ nom: draftName, updated_at: now, data })
      .select('id, nom, updated_at, data')
      .single()
    if (error || !rows) { console.error('Erreur création projet:', error); return }
    const entry = { id: rows.id, name: rows.nom, date: rows.updated_at, data: rows.data }
    currentProjectId.current = rows.id
    subscribeToProject(rows.id)
    setSavedList(prev => [entry, ...prev])
    setCompositionName(draftName); setFilters(draftFilters); setExcludedIds(draftExcludedIds); setIncludedIds(draftIncludedIds)
    setFields(draftFields); setCustomFields(draftCustomFields)
    setGroups([]); setAssignments({}); setLinkedSets([]); setSelectedIds(new Set())
    setLastSaved(now); setLastSavedBy(null)
    setShowCreateModal(false)
    setView('board')
  }

  // ── Import JSON ───────────────────────────────────────────────────────────
  const exportJSON = () => {
    const date = new Date().toISOString()
    const data = { name: compositionName, date, filters, excludedIds: [...excludedIds], includedIds: [...includedIds],
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
        {!dbLoading && hasLocalData && (
          <div className="mb-4 flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <span className="text-base">📦</span>
              <span>Des projets de l'ancienne version (stockage local) ont été détectés. Importer vers Supabase pour les retrouver partout ?</span>
            </div>
            <button onClick={migrateFromLocalStorage} disabled={migrating}
              className="shrink-0 text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {migrating ? 'Migration…' : 'Importer'}
            </button>
          </div>
        )}
        {dbLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chargement…</div>
        ) : savedList.length === 0 ? (
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
                includedIds={draftIncludedIds} setIncludedIds={setDraftIncludedIds}
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
        <button onClick={() => { doSave(true); subscribeToProject(null); setView('list') }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={13} /> Mes projets
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">{filteredEleves.length} élèves · {groups.length} groupe{groups.length !== 1 ? 's' : ''}</span>
        {hasPendingChanges
          ? <span className="text-xs text-amber-500 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Enregistrement…
            </span>
          : lastSaved && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <Check size={11} />
                {lastSavedBy
                  ? <><span className="font-medium">{lastSavedBy}</span> a sauvegardé à {new Date(lastSaved).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>
                  : <>Sauvegardé {new Date(lastSaved).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>
                }
              </span>
            )
        }
        {realtimeRef.current && (
          <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            En direct
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

      {/* Toast import */}
      {importToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${importToast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {importToast.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
          {importToast.msg}
        </div>
      )}

      {/* ── Modal Configuration ──────────────────────────────────────── */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-800">Configuration — {compositionName}</h3>

                <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ConfigForm
                allEleves={allEleves} loading={loading} onReload={loadEleves}
                filters={filters} setFilters={setFilters}
                excludedIds={excludedIds} setExcludedIds={setExcludedIds}
                includedIds={includedIds} setIncludedIds={setIncludedIds}
                fields={fields} setFields={setFields}
                customFields={customFields} setCustomFields={setCustomFields}
                compositionName={compositionName} setCompositionName={setCompositionName}
                showName onExport={exportXLSX} onImport={importXLSX}
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
