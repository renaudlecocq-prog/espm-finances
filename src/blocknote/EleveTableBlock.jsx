import { createBlockSpec } from '@blocknote/core'
import { createRoot } from 'react-dom/client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── Colonnes disponibles ──────────────────────────────────────────────────────
const COLUMN_DEFS = [
  { key: 'nom',     label: 'Nom' },
  { key: 'prenom',  label: 'Prénom' },
  { key: 'sexe',    label: 'Sexe' },
  { key: 'classe',  label: 'Classe' },
  { key: 'groupes', label: 'Groupes' },
]
const DEFAULT_COLUMNS = ['nom', 'prenom', 'sexe', 'classe', 'groupes']
const parse = (json, fallback) => { try { return JSON.parse(json) } catch { return fallback } }

// ── Sélecteur recherche + chips ───────────────────────────────────────────────
function MultiSelect({ label, all, selected, onToggle, color = 'blue' }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref = useRef(null)

  const filtered = query.length >= 1
    ? all.filter(v => v.toLowerCase().includes(query.toLowerCase()) && !selected.includes(v))
    : all.filter(v => !selected.includes(v)).slice(0, 12)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const chip = color === 'purple' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
  const ring = color === 'purple' ? 'ring-purple-400' : 'ring-blue-400'
  const dot  = color === 'purple' ? 'bg-purple-400' : 'bg-blue-400'

  return (
    <div className="mb-4" ref={ref}>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{label}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map(v => (
            <span key={v} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${chip}`}>
              {v}
              <button onClick={() => onToggle(v)} className="opacity-70 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={`Rechercher…`}
          className={`w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 ${ring}`}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(v => (
              <button
                key={v}
                onMouseDown={e => { e.preventDefault(); onToggle(v); setQuery('') }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────
function EleveTableConfig({ initialClasses, initialGroups, initialColumns, allClasses, allGroups, onSave }) {
  const [selClasses, setSelClasses] = useState(initialClasses)
  const [selGroups,  setSelGroups]  = useState(initialGroups)
  const [selCols,    setSelCols]    = useState(initialColumns.length > 0 ? initialColumns : DEFAULT_COLUMNS)

  const canSave = selClasses.length > 0 || selGroups.length > 0

  return (
    <div className="rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 p-4 bg-blue-50/60 dark:bg-blue-950/20 select-none" contentEditable={false} onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📋</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-white">Tableau d'élèves — configuration</span>
      </div>
      <MultiSelect label="Classes" all={allClasses} selected={selClasses} onToggle={c => setSelClasses(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])} color="blue" />
      {allGroups.length > 0 && <MultiSelect label="Groupes" all={allGroups} selected={selGroups} onToggle={g => setSelGroups(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])} color="purple" />}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Colonnes</p>
        <div className="flex flex-wrap gap-1.5">
          {COLUMN_DEFS.map(col => (
            <button key={col.key} onClick={() => setSelCols(p => p.includes(col.key) ? p.filter(x => x !== col.key) : [...p, col.key])}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${selCols.includes(col.key) ? 'bg-gray-800 dark:bg-gray-100 border-gray-800 text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400 hover:border-gray-400'}`}>
              {col.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => canSave && onSave(selClasses, selGroups, selCols)} disabled={!canSave}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
        {initialClasses.length > 0 || initialGroups.length > 0 ? 'Mettre à jour' : 'Créer le tableau'}
      </button>
    </div>
  )
}

// ── Affichage ─────────────────────────────────────────────────────────────────
function SexeBadge({ value }) {
  if (!value) return React.createElement('span', { className: 'text-gray-300 dark:text-gray-600' }, '—')
  return (
    <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${value === 'M' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : value === 'F' ? 'bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-300' : 'bg-gray-100 text-gray-500'}`}>
      {value}
    </span>
  )
}

function EleveTableDisplay({ classes, groups, columns, onEdit, editable }) {
  const [eleves,  setEleves]  = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEleves = useCallback(async () => {
    setLoading(true)
    const base = () => supabase.from('eleves').select('nom, prenom, sexe, classe, groupes_ss').eq('actif', true)
    let data = []
    if (classes.length > 0 && groups.length === 0) {
      const { data: d } = await base().in('classe', classes).order('classe').order('nom')
      data = d || []
    } else if (groups.length > 0 && classes.length === 0) {
      const { data: d } = await base().overlaps('groupes_ss', groups).order('classe').order('nom')
      data = d || []
    } else if (classes.length > 0 && groups.length > 0) {
      const [r1, r2] = await Promise.all([
        base().in('classe', classes).order('classe').order('nom'),
        base().overlaps('groupes_ss', groups).order('classe').order('nom'),
      ])
      const all = [...(r1.data || []), ...(r2.data || [])]
      const seen = new Set()
      data = all.filter(e => { const k = `${e.nom}|${e.prenom}|${e.classe}`; if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => (a.classe||'').localeCompare(b.classe||'') || (a.nom||'').localeCompare(b.nom||''))
    }
    setEleves(data)
    setLoading(false)
  }, [classes.join(','), groups.join(',')])

  useEffect(() => { fetchEleves() }, [fetchEleves])

  const visibleCols = COLUMN_DEFS.filter(c => columns.includes(c.key))
  const filterLabel = [...classes, ...groups.map(g => `Gr. ${g}`)].join(', ')

  const renderCell = (e, key) => {
    if (key === 'groupes') {
      const g = Array.isArray(e.groupes_ss) ? e.groupes_ss.filter(Boolean) : []
      return g.length ? <span className="text-xs text-gray-600 dark:text-gray-400">{g.join(', ')}</span> : <span className="text-gray-300">—</span>
    }
    if (key === 'sexe') return <SexeBadge value={e.sexe} />
    return e[key] || <span className="text-gray-300">—</span>
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" contentEditable={false} onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span>📋</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{filterLabel}</span>
          {!loading && <span className="text-xs text-gray-400">— {eleves.length} élève{eleves.length !== 1 ? 's' : ''}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchEleves} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {editable && (
            <button onClick={onEdit} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/60">
                {visibleCols.map(col => <th key={col.key} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60">{col.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {eleves.length === 0
                ? <tr><td colSpan={visibleCols.length} className="px-4 py-8 text-center text-gray-400 text-sm">Aucun élève trouvé</td></tr>
                : eleves.map((e, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-900 hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                    {visibleCols.map(col => <td key={col.key} className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{renderCell(e, col.key)}</td>)}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
function EleveTableBlockComponent({ block, editor }) {
  const classes = parse(block.props.classes, [])
  const groups  = parse(block.props.groups,  [])
  const columns = parse(block.props.columns, DEFAULT_COLUMNS)

  const isConfigured = classes.length > 0 || groups.length > 0
  const [configMode, setConfigMode] = useState(!isConfigured)
  const [allClasses, setAllClasses] = useState([])
  const [allGroups,  setAllGroups]  = useState([])

  useEffect(() => {
    if (!configMode) return
    supabase.from('eleves').select('classe, groupes_ss').eq('actif', true).then(({ data }) => {
      if (!data) return
      const cls = [...new Set(data.map(e => e.classe).filter(Boolean))].sort()
      const grpSet = new Set()
      data.forEach(e => { if (Array.isArray(e.groupes_ss)) e.groupes_ss.filter(Boolean).forEach(g => grpSet.add(g)) })
      setAllClasses(cls)
      setAllGroups([...grpSet].sort())
    })
  }, [configMode])

  const handleSave = (selClasses, selGroups, selCols) => {
    if (editor.isEditable) {
      editor.updateBlock(block, {
        type: 'eleveTable',
        props: {
          classes: JSON.stringify(selClasses),
          groups:  JSON.stringify(selGroups),
          columns: JSON.stringify(selCols),
        }
      })
    }
    setConfigMode(false)
  }

  if (configMode) {
    return (
      <EleveTableConfig
        initialClasses={classes} initialGroups={groups} initialColumns={columns}
        allClasses={allClasses} allGroups={allGroups}
        onSave={handleSave}
      />
    )
  }
  return (
    <EleveTableDisplay
      classes={classes} groups={groups} columns={columns}
      editable={editor.isEditable}
      onEdit={() => setConfigMode(true)}
    />
  )
}

// ── BlockSpec via createBlockSpec (core) + createRoot manuel ──────────────────
// On n'utilise PAS createReactBlockSpec pour éviter les problèmes de rendu en prod
export const EleveTableBlock = createBlockSpec(
  {
    type: 'eleveTable',
    propSchema: {
      classes: { default: '[]' },
      groups:  { default: '[]' },
      columns: { default: JSON.stringify(DEFAULT_COLUMNS) },
    },
    content: 'none',
  },
  () => ({
    render(block, editor) {
      const dom = document.createElement('div')
      dom.setAttribute('data-eleve-table', 'true')
      const root = createRoot(dom)
      root.render(React.createElement(EleveTableBlockComponent, { block, editor }))
      return {
        dom,
        destroy() {
          // Délai pour laisser React finir le cycle de rendu courant
          setTimeout(() => root.unmount(), 0)
        },
      }
    },
  })
)()
