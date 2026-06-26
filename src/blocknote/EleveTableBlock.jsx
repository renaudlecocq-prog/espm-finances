import { createReactBlockSpec } from '@blocknote/react'
import { useState, useEffect, useCallback } from 'react'
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const parse = (json, fallback) => { try { return JSON.parse(json) } catch { return fallback } }

// ── UI config ─────────────────────────────────────────────────────────────────
function EleveTableConfig({ initialClasses, initialGroups, initialColumns, allClasses, allGroups, onSave }) {
  const [selClasses, setSelClasses] = useState(initialClasses)
  const [selGroups,  setSelGroups]  = useState(initialGroups)
  const [selCols,    setSelCols]    = useState(initialColumns.length > 0 ? initialColumns : DEFAULT_COLUMNS)

  const toggleClass = c => setSelClasses(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])
  const toggleGroup = g => setSelGroups(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])
  const toggleCol   = k => setSelCols(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])

  const canSave = selClasses.length > 0 || selGroups.length > 0

  return (
    <div
      className="rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 p-4 bg-blue-50/60 dark:bg-blue-950/20 select-none"
      contentEditable={false}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📋</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-white">Tableau d'élèves — configuration</span>
      </div>

      {/* Classes */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Classes</p>
        {allClasses.length === 0 ? (
          <p className="text-xs text-gray-400">Chargement…</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allClasses.map(c => (
              <button
                key={c}
                onClick={() => toggleClass(c)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  selClasses.includes(c)
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Groupes */}
      {allGroups.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Groupes</p>
          <div className="flex flex-wrap gap-1.5">
            {allGroups.map(g => (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  selGroups.includes(g)
                    ? 'bg-purple-500 border-purple-500 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colonnes */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Colonnes à afficher</p>
        <div className="flex flex-wrap gap-1.5">
          {COLUMN_DEFS.map(col => (
            <button
              key={col.key}
              onClick={() => toggleCol(col.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                selCols.includes(col.key)
                  ? 'bg-gray-800 dark:bg-gray-100 border-gray-800 dark:border-gray-100 text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => canSave && onSave(selClasses, selGroups, selCols)}
        disabled={!canSave}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
      >
        {initialClasses.length > 0 || initialGroups.length > 0 ? 'Mettre à jour' : 'Créer le tableau'}
      </button>
    </div>
  )
}

// ── Cellule sexe ──────────────────────────────────────────────────────────────
function SexeBadge({ value }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const isM = value === 'M'
  const isF = value === 'F'
  return (
    <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${
      isM ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
      : isF ? 'bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-300'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
    }`}>
      {value}
    </span>
  )
}

// ── Affichage tableau ─────────────────────────────────────────────────────────
function EleveTableDisplay({ classes, groups, columns, onEdit, editable }) {
  const [eleves,  setEleves]  = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEleves = useCallback(async () => {
    setLoading(true)
    const base = () => supabase.from('eleves')
      .select('nom, prenom, sexe, classe, groupes_ss')
      .eq('actif', true)

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
      const all  = [...(r1.data || []), ...(r2.data || [])]
      const seen = new Set()
      data = all.filter(e => {
        const k = `${e.nom}|${e.prenom}|${e.classe}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      }).sort((a, b) => (a.classe || '').localeCompare(b.classe || '') || (a.nom || '').localeCompare(b.nom || ''))
    }

    setEleves(data)
    setLoading(false)
  }, [classes.join(','), groups.join(',')])

  useEffect(() => { fetchEleves() }, [fetchEleves])

  const visibleCols = COLUMN_DEFS.filter(c => columns.includes(c.key))
  const filterLabel = [...classes, ...groups.map(g => `Gr. ${g}`)].join(', ')

  const renderCell = (eleve, key) => {
    if (key === 'groupes') {
      const g = Array.isArray(eleve.groupes_ss) ? eleve.groupes_ss.filter(Boolean) : []
      return g.length ? <span className="text-xs text-gray-600 dark:text-gray-400">{g.join(', ')}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
    }
    if (key === 'sexe') return <SexeBadge value={eleve.sexe} />
    return eleve[key] || <span className="text-gray-300 dark:text-gray-600">—</span>
  }

  return (
    <div
      className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      contentEditable={false}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{filterLabel}</span>
          {!loading && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              — {eleves.length} élève{eleves.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEleves}
            title="Actualiser"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {editable && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-sm gap-2">
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
                {visibleCols.map(col => (
                  <th key={col.key} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {eleves.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                    Aucun élève trouvé pour ce filtre
                  </td>
                </tr>
              ) : eleves.map((e, i) => (
                <tr key={i} className="bg-white dark:bg-gray-900 hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                  {visibleCols.map(col => (
                    <td key={col.key} className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                      {renderCell(e, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Composant principal du bloc ───────────────────────────────────────────────
function EleveTableBlockComponent({ block, editor }) {
  const classes = parse(block.props.classes, [])
  const groups  = parse(block.props.groups,  [])
  const columns = parse(block.props.columns, DEFAULT_COLUMNS)

  const isConfigured  = classes.length > 0 || groups.length > 0
  const [configMode, setConfigMode] = useState(!isConfigured)
  const [allClasses,  setAllClasses] = useState([])
  const [allGroups,   setAllGroups]  = useState([])

  // Charger classes + groupes disponibles en mode config
  useEffect(() => {
    if (!configMode) return
    const load = async () => {
      const { data } = await supabase.from('eleves').select('classe, groupes_ss').eq('actif', true)
      if (!data) return
      const cls = [...new Set(data.map(e => e.classe).filter(Boolean))].sort()
      const grpSet = new Set()
      data.forEach(e => { if (Array.isArray(e.groupes_ss)) e.groupes_ss.filter(Boolean).forEach(g => grpSet.add(g)) })
      setAllClasses(cls)
      setAllGroups([...grpSet].sort())
    }
    load()
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
        initialClasses={classes}
        initialGroups={groups}
        initialColumns={columns}
        allClasses={allClasses}
        allGroups={allGroups}
        onSave={handleSave}
      />
    )
  }

  return (
    <EleveTableDisplay
      classes={classes}
      groups={groups}
      columns={columns}
      editable={editor.isEditable}
      onEdit={() => setConfigMode(true)}
    />
  )
}

// ── Export du bloc spec ───────────────────────────────────────────────────────
export const EleveTableBlock = createReactBlockSpec(
  {
    type: 'eleveTable',
    propSchema: {
      classes: { default: '[]' },
      groups:  { default: '[]' },
      columns: { default: JSON.stringify(DEFAULT_COLUMNS) },
    },
    content: 'none',
  },
  {
    render: EleveTableBlockComponent,
  }
)
