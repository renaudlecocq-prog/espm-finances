/**
 * ListeEditor — Tableur collaboratif d'élèves
 * Colonnes builtin (nom/prénom/sexe/classe/groupes) + colonnes custom éditables
 * Sync temps réel via Yjs + SupabaseYjsProvider
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { SupabaseYjsProvider } from './SupabaseYjsProvider'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Colonnes builtin disponibles
const BUILTIN_DEFS = [
  { key: 'nom',        name: 'Nom',      readOnly: true },
  { key: 'prenom',     name: 'Prénom',   readOnly: true },
  { key: 'sexe',       name: 'Sexe',     readOnly: true },
  { key: 'classe',     name: 'Classe',   readOnly: true },
  { key: 'groupes_ss', name: 'Groupe(s)', readOnly: true },
]

function getEleveValue(eleve, key) {
  if (key === 'groupes_ss') {
    const g = eleve.groupes_ss
    if (!g) return ''
    if (Array.isArray(g)) return g.join(', ')
    if (typeof g === 'string') {
      try { const p = JSON.parse(g); return Array.isArray(p) ? p.join(', ') : g } catch { return g }
    }
    return ''
  }
  return eleve[key] ?? ''
}

// ── Cellule éditable ──────────────────────────────────────────────────────────
function EditableCell({ value, onChange, canEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
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
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
        style={{ width: '100%', border: 'none', outline: 'none', background: '#EFF6FF',
          padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', borderRadius: 4 }}
      />
    )
  }
  return (
    <div
      onClick={() => canEdit && setEditing(true)}
      style={{ padding: '6px 8px', fontSize: 13, minHeight: 32,
        cursor: canEdit ? 'text' : 'default',
        color: value ? '#111827' : '#D1D5DB',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {value || (canEdit ? <span style={{ color: '#D1D5DB', fontSize: 11 }}>—</span> : '')}
    </div>
  )
}

// ── Modal ajout de colonne ────────────────────────────────────────────────────
function AddColumnModal({ existingKeys, onAdd, onClose }) {
  const [mode, setMode] = useState('builtin') // 'builtin' | 'custom'
  const [customName, setCustomName] = useState('')
  const available = BUILTIN_DEFS.filter(d => !existingKeys.includes(d.key))

  const handleBuiltin = (def) => {
    onAdd({ id: `builtin_${def.key}`, type: 'builtin', key: def.key, name: def.name })
    onClose()
  }
  const handleCustom = () => {
    const name = customName.trim()
    if (!name) return
    onAdd({ id: `custom_${Date.now()}`, type: 'custom', name })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 320,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Ajouter une colonne</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[['builtin','Données élève'],['custom','Colonne libre']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: mode === k ? '#2D1B2E' : '#F3F4F6',
                color: mode === k ? '#fff' : '#6B7280' }}>
              {l}
            </button>
          ))}
        </div>

        {mode === 'builtin' ? (
          available.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: '8px 0' }}>
              Toutes les données élève sont déjà ajoutées.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {available.map(def => (
                <button key={def.key} onClick={() => handleBuiltin(def)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E5E7EB',
                    background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#2D1B2E' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E5E7EB' }}>
                  <span style={{ fontSize: 16 }}>
                    {def.key === 'nom' ? '🔤' : def.key === 'prenom' ? '🏷️' : def.key === 'sexe' ? '⚧' : def.key === 'classe' ? '🏫' : '👥'}
                  </span>
                  {def.name}
                </button>
              ))}
            </div>
          )
        ) : (
          <div>
            <input
              placeholder="Nom de la colonne…"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustom()}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid #E5E7EB', fontSize: 13, outline: 'none',
                boxSizing: 'border-box', marginBottom: 12 }}
              onFocus={e => e.target.style.borderColor = '#2D1B2E'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
            <button onClick={handleCustom}
              disabled={!customName.trim()}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: customName.trim() ? '#2D1B2E' : '#E5E7EB',
                color: customName.trim() ? '#fff' : '#9CA3AF',
                cursor: customName.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 600 }}>
              Ajouter
            </button>
          </div>
        )}

        <button onClick={onClose}
          style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB',
            background: '#fff', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export function ListeEditor({ liste, onBack, onTitleChange, canEdit }) {
  const { user } = useAuth()
  const ydocRef   = useRef(null)
  const provRef   = useRef(null)

  const [eleves,      setEleves]      = useState([])
  const [columns,     setColumns]     = useState([])   // [{id, type, key?, name}]
  const [cells,       setCells]       = useState({})   // {eleveId_colId: value}
  const [synced,      setSynced]      = useState(false)
  const [addColModal, setAddColModal] = useState(false)
  const [saveTick,    setSaveTick]    = useState(0)    // force re-render pour indicator
  const saveTimerRef  = useRef(null)
  const [saving,      setSaving]      = useState(false)

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

    const yCols = doc.getArray('columns')
    const yCells = doc.getMap('cells')

    const syncCols  = () => setColumns(yCols.toArray())
    const syncCells = () => setCells(Object.fromEntries(yCells.entries()))

    yCols.observe(syncCols)
    yCells.observe(syncCells)

    // Init state
    syncCols(); syncCells()

    return () => {
      yCols.unobserve(syncCols)
      yCells.unobserve(syncCells)
      prov.destroy()
      doc.destroy()
    }
  }, [liste.id])

  // ── Colonnes ────────────────────────────────────────────────────────────────
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

  // ── Cellules ────────────────────────────────────────────────────────────────
  const setCellValue = useCallback((eleveId, colId, value) => {
    const doc = ydocRef.current; if (!doc || !canEdit) return
    doc.getMap('cells').set(`${eleveId}_${colId}`, value)
    clearTimeout(saveTimerRef.current)
    setSaving(true)
    saveTimerRef.current = setTimeout(() => setSaving(false), 2500)
  }, [canEdit])

  const getCellValue = useCallback((eleve, col) => {
    if (col.type === 'builtin') return getEleveValue(eleve, col.key)
    return cells[`${eleve.id}_${col.id}`] ?? ''
  }, [cells])

  // ── Colonnes existantes (keys builtin déjà ajoutées) ────────────────────────
  const existingBuiltinKeys = columns.filter(c => c.type === 'builtin').map(c => c.key)

  // ── Renommer la liste ────────────────────────────────────────────────────────
  const [renamingListe, setRenamingListe] = useState(false)
  const [newName, setNewName] = useState(liste.name)

  const saveName = async () => {
    const name = newName.trim() || 'Sans titre'
    const { data } = await supabase.from('salle_listes').update({ name }).eq('id', liste.id).select().single()
    if (data) onTitleChange?.(data)
    setRenamingListe(false)
  }

  if (!synced) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Chargement de la liste…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Barre info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          {eleves.length} élève{eleves.length !== 1 ? 's' : ''}
          {' · '}
          {columns.length} colonne{columns.length !== 1 ? 's' : ''}
        </span>
        {saving && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sauvegarde…</span>}
        {!saving && synced && <span style={{ fontSize: 11, color: '#10B981' }}>✓ Synchronisé</span>}
      </div>

      {/* Tableau */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {columns.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 200, gap: 12 }}>
            <div style={{ fontSize: 36 }}>📊</div>
            <div style={{ color: '#6B7280', fontSize: 14 }}>Aucune colonne — commencez par en ajouter une</div>
            {canEdit && (
              <button onClick={() => setAddColModal(true)}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#2D1B2E', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                + Colonne
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
            <colgroup>
              {columns.map(col => (
                <col key={col.id} style={{ width: col.type === 'builtin' && col.key === 'nom' ? 160
                  : col.type === 'builtin' ? 120 : 180 }} />
              ))}
              {canEdit && <col style={{ width: 44 }} />}
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#2D1B2E' }}>
                {columns.map(col => (
                  <th key={col.id} style={{ padding: '8px 10px', textAlign: 'left',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    borderRight: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {col.type === 'builtin' && (
                          <span style={{ marginRight: 4, opacity: 0.6, fontSize: 10 }}>🔒</span>
                        )}
                        {col.name}
                      </span>
                      {canEdit && (
                        <button onClick={() => removeColumn(col.id)}
                          title="Supprimer la colonne"
                          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                            borderRadius: 4, width: 18, height: 18, cursor: 'pointer', fontSize: 11,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            lineHeight: 1, padding: 0 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.7)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {canEdit && (
                  <th style={{ padding: '4px', textAlign: 'center', borderRight: 'none' }}>
                    <button onClick={() => setAddColModal(true)}
                      title="Ajouter une colonne"
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                        borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
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
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? '#fff' : '#F9FAFB'}>
                  {columns.map(col => (
                    <td key={col.id} style={{ borderBottom: '1px solid #F3F4F6',
                      borderRight: '1px solid #F3F4F6', padding: 0, verticalAlign: 'top' }}>
                      {col.type === 'builtin' ? (
                        <div style={{ padding: '6px 8px', fontSize: 13, color: '#374151',
                          backgroundColor: 'transparent' }}>
                          {getCellValue(eleve, col)}
                        </div>
                      ) : (
                        <EditableCell
                          value={getCellValue(eleve, col)}
                          onChange={val => setCellValue(eleve.id, col.id, val)}
                          canEdit={canEdit}
                        />
                      )}
                    </td>
                  ))}
                  {canEdit && <td style={{ borderBottom: '1px solid #F3F4F6' }} />}
                </tr>
              ))}
              {eleves.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1}
                    style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
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
          existingKeys={existingBuiltinKeys}
          onAdd={addColumn}
          onClose={() => setAddColModal(false)}
        />
      )}
    </div>
  )
}
