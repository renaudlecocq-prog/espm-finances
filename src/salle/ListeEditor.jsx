/**
 * ListeEditor — Tableur collaboratif d'élèves
 * Colonnes builtin (nom/prénom/sexe/classe) + colonnes groupe (✓ membership) + colonnes custom
 * Sync temps réel via Yjs + SupabaseYjsProvider
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { SupabaseYjsProvider } from './SupabaseYjsProvider'
import { supabase } from '../lib/supabase'

// Colonnes builtin de base (hors groupes)
const BUILTIN_DEFS = [
  { key: 'nom',    name: 'Nom',    icon: '🔤' },
  { key: 'prenom', name: 'Prénom', icon: '🏷️' },
  { key: 'sexe',   name: 'Sexe',   icon: '⚧'  },
  { key: 'classe', name: 'Classe', icon: '🏫' },
]

function getEleveGroupes(e) {
  const g = e.groupes_ss
  if (!g) return []
  if (Array.isArray(g)) return g
  if (typeof g === 'string') {
    try { const p = JSON.parse(g); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function getColValue(eleve, col) {
  if (col.type === 'builtin') return eleve[col.key] ?? ''
  if (col.type === 'group')   return getEleveGroupes(eleve).includes(col.groupName) ? '✓' : ''
  return '' // custom — géré via cells map
}

// ── Cellule éditable ──────────────────────────────────────────────────────────
function EditableCell({ value, onChange, canEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    return (
      <input ref={inputRef} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
        }}
        style={{ width:'100%', border:'none', outline:'none', background:'#EFF6FF',
          padding:'6px 8px', fontSize:13, fontFamily:'inherit', borderRadius:4 }}
      />
    )
  }
  return (
    <div onClick={() => canEdit && setEditing(true)}
      style={{ padding:'6px 8px', fontSize:13, minHeight:32,
        cursor: canEdit ? 'text' : 'default',
        color: value ? '#111827' : '#D1D5DB' }}>
      {value || (canEdit ? <span style={{ color:'#D1D5DB', fontSize:11 }}>—</span> : '')}
    </div>
  )
}

// ── Modal ajout de colonne ────────────────────────────────────────────────────
function AddColumnModal({ eleves, existingCols, onAdd, onClose }) {
  const [mode, setMode]           = useState('builtin')   // 'builtin' | 'groups' | 'custom'
  const [customName, setCustomName] = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [added, setAdded]         = useState([])   // slugs ajoutés dans cette session

  // Builtins déjà dans la liste
  const existingBuiltinKeys  = existingCols.filter(c => c.type === 'builtin').map(c => c.key)
  const existingGroupNames   = existingCols.filter(c => c.type === 'group').map(c => c.groupName)

  const availableBuiltins = BUILTIN_DEFS.filter(
    d => !existingBuiltinKeys.includes(d.key) && !added.includes(`b_${d.key}`)
  )

  // Groupes uniques des élèves de la liste
  const allGroups = [...new Set(eleves.flatMap(e => getEleveGroupes(e)))].sort()
  const availableGroups = allGroups.filter(
    g => !existingGroupNames.includes(g) && !added.includes(`g_${g}`)
  )
  const filteredGroups = groupSearch
    ? availableGroups.filter(g => g.toLowerCase().includes(groupSearch.toLowerCase()))
    : availableGroups

  const doAdd = (colDef, slug) => {
    onAdd(colDef)
    setAdded(prev => [...prev, slug])
  }

  const handleBuiltin = (def) => {
    doAdd({ id:`builtin_${def.key}`, type:'builtin', key:def.key, name:def.name }, `b_${def.key}`)
  }

  const handleGroup = (groupe) => {
    // Nom court pour l'en-tête (max 28 chars)
    const shortName = groupe.length > 28 ? groupe.slice(0, 26) + '…' : groupe
    doAdd({ id:`group_${groupe}`, type:'group', groupName:groupe, name:shortName }, `g_${groupe}`)
  }

  const handleCustom = () => {
    const name = customName.trim()
    if (!name) return
    doAdd({ id:`custom_${Date.now()}`, type:'custom', name }, `c_${Date.now()}`)
    setCustomName('')
  }

  const tabs = [
    { k:'builtin', l:'Données élève' },
    { k:'groups',  l:`Groupes (${availableGroups.length})` },
    { k:'custom',  l:'Colonne libre' },
  ]

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.4)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:14, padding:24, width:340,
        maxHeight:'80vh', display:'flex', flexDirection:'column',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>Ajouter une colonne</div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:20, lineHeight:1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:5, marginBottom:14, flexWrap:'wrap' }}>
          {tabs.map(({ k, l }) => (
            <button key={k} onClick={() => setMode(k)}
              style={{ padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:11, fontWeight:600,
                background: mode === k ? '#2D1B2E' : '#F3F4F6',
                color:      mode === k ? '#fff'     : '#6B7280' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto' }}>

          {/* Données élève */}
          {mode === 'builtin' && (
            availableBuiltins.length === 0
              ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Toutes les données de base sont déjà ajoutées.</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {availableBuiltins.map(def => (
                    <button key={def.key} onClick={() => handleBuiltin(def)}
                      style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #E5E7EB',
                        background:'#fff', cursor:'pointer', textAlign:'left', fontSize:13,
                        fontWeight:500, color:'#374151', display:'flex', alignItems:'center', gap:8 }}
                      onMouseEnter={e => { e.currentTarget.style.background='#F9FAFB'; e.currentTarget.style.borderColor='#2D1B2E' }}
                      onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#E5E7EB' }}>
                      <span style={{ fontSize:16 }}>{def.icon}</span>
                      {def.name}
                      <span style={{ marginLeft:'auto', fontSize:10, color:'#9CA3AF' }}>🔒 lecture seule</span>
                    </button>
                  ))}
                </div>
          )}

          {/* Groupes spécifiques */}
          {mode === 'groups' && (
            <div>
              {allGroups.length === 0
                ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Aucun groupe trouvé pour les élèves de cette liste.</div>
                : <>
                    <input placeholder="Rechercher un groupe…"
                      value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:7, fontSize:12,
                        border:'1.5px solid #E5E7EB', outline:'none', marginBottom:10, boxSizing:'border-box' }}
                      onFocus={e => e.target.style.borderColor='#2D1B2E'}
                      onBlur={e => e.target.style.borderColor='#E5E7EB'}
                    />
                    {filteredGroups.length === 0
                      ? <div style={{ color:'#9CA3AF', fontSize:12 }}>
                          {availableGroups.length === 0 ? 'Tous les groupes ont déjà été ajoutés.' : 'Aucun résultat.'}
                        </div>
                      : <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                          {filteredGroups.map(g => (
                            <button key={g} onClick={() => handleGroup(g)}
                              style={{ padding:'8px 12px', borderRadius:7, border:'1.5px solid #E5E7EB',
                                background:'#fff', cursor:'pointer', textAlign:'left', fontSize:12,
                                color:'#374151', display:'flex', alignItems:'center', gap:8 }}
                              onMouseEnter={e => { e.currentTarget.style.background='#F0FDF4'; e.currentTarget.style.borderColor='#10B981' }}
                              onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#E5E7EB' }}>
                              <span style={{ fontSize:14 }}>👥</span>
                              <span style={{ flex:1 }}>{g}</span>
                              <span style={{ fontSize:10, color:'#9CA3AF' }}>✓/vide</span>
                            </button>
                          ))}
                        </div>
                    }
                  </>
              }
            </div>
          )}

          {/* Colonne libre */}
          {mode === 'custom' && (
            <div>
              <input placeholder="Nom de la colonne…"
                value={customName} onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustom()}
                autoFocus
                style={{ width:'100%', padding:'10px 12px', borderRadius:8,
                  border:'1.5px solid #E5E7EB', fontSize:13, outline:'none',
                  boxSizing:'border-box', marginBottom:10 }}
                onFocus={e => e.target.style.borderColor='#2D1B2E'}
                onBlur={e => e.target.style.borderColor='#E5E7EB'}
              />
              <button onClick={handleCustom} disabled={!customName.trim()}
                style={{ width:'100%', padding:'10px', borderRadius:8, border:'none',
                  background: customName.trim() ? '#2D1B2E' : '#E5E7EB',
                  color:      customName.trim() ? '#fff'     : '#9CA3AF',
                  cursor: customName.trim() ? 'pointer' : 'default',
                  fontSize:13, fontWeight:600 }}>
                Ajouter
              </button>
            </div>
          )}
        </div>

        {/* Note si des colonnes ont été ajoutées */}
        {added.length > 0 && (
          <div style={{ marginTop:12, padding:'6px 10px', background:'#F0FDF4', borderRadius:7,
            fontSize:12, color:'#15803D', textAlign:'center' }}>
            {added.length} colonne{added.length > 1 ? 's' : ''} ajoutée{added.length > 1 ? 's' : ''} ✓
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export function ListeEditor({ liste, canEdit }) {
  const ydocRef   = useRef(null)
  const provRef   = useRef(null)

  const [eleves,      setEleves]      = useState([])
  const [columns,     setColumns]     = useState([])   // [{id, type, key?, groupName?, name}]
  const [cells,       setCells]       = useState({})   // {eleveId_colId: value} pour custom uniquement
  const [synced,      setSynced]      = useState(false)
  const [addColModal, setAddColModal] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const saveTimerRef  = useRef(null)

  // ── Charger les élèves ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!liste.eleve_ids?.length) { setEleves([]); return }
    supabase.from('eleves')
      .select('id, nom, prenom, sexe, classe, groupes_ss')
      .in('id', liste.eleve_ids)
      .order('classe').order('nom').order('prenom')
      .then(({ data }) => setEleves(data || []))
  }, [liste.id])

  // ── Yjs setup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const doc = new Y.Doc()
    ydocRef.current = doc
    const prov = new SupabaseYjsProvider(doc, supabase, liste.id, {
      tableName: 'salle_listes',
      onSynced: () => setSynced(true),
    })
    provRef.current = prov

    const yCols  = doc.getArray('columns')
    const yCells = doc.getMap('cells')

    const syncCols  = () => setColumns(yCols.toArray())
    const syncCells = () => setCells(Object.fromEntries(yCells.entries()))

    yCols.observe(syncCols)
    yCells.observe(syncCells)
    syncCols(); syncCells()

    return () => {
      yCols.unobserve(syncCols)
      yCells.unobserve(syncCells)
      prov.destroy()
      doc.destroy()
    }
  }, [liste.id])

  // ── Gestion colonnes ────────────────────────────────────────────────────────
  const addColumn = useCallback((colDef) => {
    const doc = ydocRef.current; if (!doc) return
    doc.getArray('columns').push([colDef])
  }, [])

  const removeColumn = useCallback((colId) => {
    const doc = ydocRef.current; if (!doc) return
    const arr = doc.getArray('columns')
    const idx = arr.toArray().findIndex(c => c.id === colId)
    if (idx >= 0) arr.delete(idx, 1)
  }, [])

  // ── Gestion cellules (custom seulement) ─────────────────────────────────────
  const setCellValue = useCallback((eleveId, colId, value) => {
    const doc = ydocRef.current; if (!doc || !canEdit) return
    doc.getMap('cells').set(`${eleveId}_${colId}`, value)
    clearTimeout(saveTimerRef.current)
    setSaving(true)
    saveTimerRef.current = setTimeout(() => setSaving(false), 2500)
  }, [canEdit])

  // ── Valeur affichée ─────────────────────────────────────────────────────────
  const getCellValue = (eleve, col) => {
    if (col.type === 'builtin') return getColValue(eleve, col)
    if (col.type === 'group')   return getColValue(eleve, col)
    return cells[`${eleve.id}_${col.id}`] ?? ''
  }

  if (!synced) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}>
        <div style={{ color:'#9CA3AF', fontSize:14 }}>Chargement de la liste…</div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Barre info */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 16px',
        borderBottom:'1px solid #E5E7EB', backgroundColor:'#F9FAFB', flexShrink:0,
        fontSize:12, color:'#6B7280' }}>
        <span>{eleves.length} élève{eleves.length !== 1 ? 's' : ''} · {columns.length} colonne{columns.length !== 1 ? 's' : ''}</span>
        {saving  && <span style={{ color:'#9CA3AF' }}>Sauvegarde…</span>}
        {!saving && <span style={{ color:'#10B981' }}>✓ Synchronisé</span>}
      </div>

      {/* Tableau */}
      <div style={{ flex:1, overflow:'auto' }}>
        {columns.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:200, gap:12 }}>
            <div style={{ fontSize:36 }}>📊</div>
            <div style={{ color:'#6B7280', fontSize:14 }}>Aucune colonne — commencez par en ajouter une</div>
            {canEdit && (
              <button onClick={() => setAddColModal(true)}
                style={{ padding:'8px 18px', borderRadius:8, border:'none',
                  background:'#2D1B2E', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                + Colonne
              </button>
            )}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ backgroundColor:'#2D1B2E' }}>
                {columns.map(col => (
                  <th key={col.id} style={{ padding:'7px 10px', textAlign:'left',
                    color:'#fff', fontSize:11, fontWeight:600,
                    borderRight:'1px solid rgba(255,255,255,0.1)',
                    minWidth: col.type === 'group' ? 90 : col.key === 'nom' ? 140 : 110,
                    whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>
                        {(col.type === 'builtin' || col.type === 'group') && (
                          <span style={{ opacity:0.5, fontSize:9, marginRight:3 }}>🔒</span>
                        )}
                        {col.name}
                      </span>
                      {canEdit && (
                        <button onClick={() => removeColumn(col.id)}
                          title="Supprimer"
                          style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
                            borderRadius:4, width:16, height:16, cursor:'pointer', fontSize:11,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            flexShrink:0, lineHeight:1, padding:0 }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.7)'}
                          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {canEdit && (
                  <th style={{ padding:'4px', width:36 }}>
                    <button onClick={() => setAddColModal(true)}
                      title="Ajouter une colonne"
                      style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
                        borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:16,
                        display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
                      +
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {eleves.map((eleve, rowIdx) => (
                <tr key={eleve.id}
                  style={{ backgroundColor: rowIdx % 2 === 0 ? '#fff' : '#F9FAFB' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor='#EFF6FF'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor=rowIdx % 2 === 0 ? '#fff' : '#F9FAFB'}>
                  {columns.map(col => (
                    <td key={col.id} style={{ borderBottom:'1px solid #F3F4F6',
                      borderRight:'1px solid #F3F4F6', padding:0, verticalAlign:'top' }}>
                      {col.type === 'custom' ? (
                        <EditableCell
                          value={getCellValue(eleve, col)}
                          onChange={val => setCellValue(eleve.id, col.id, val)}
                          canEdit={canEdit}
                        />
                      ) : (
                        <div style={{ padding:'6px 8px', fontSize:13,
                          color: col.type === 'group'
                            ? (getCellValue(eleve, col) ? '#10B981' : '#E5E7EB')
                            : '#374151',
                          fontWeight: col.type === 'group' && getCellValue(eleve, col) ? 700 : 400,
                          textAlign: col.type === 'group' ? 'center' : 'left' }}>
                          {getCellValue(eleve, col)}
                        </div>
                      )}
                    </td>
                  ))}
                  {canEdit && <td style={{ borderBottom:'1px solid #F3F4F6' }} />}
                </tr>
              ))}
              {eleves.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1}
                    style={{ padding:40, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
                    Aucun élève dans cette liste
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {addColModal && (
        <AddColumnModal
          eleves={eleves}
          existingCols={columns}
          onAdd={addColumn}
          onClose={() => setAddColModal(false)}
        />
      )}
    </div>
  )
}
