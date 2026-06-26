import { createBlockSpec } from '@blocknote/core'
import { createRoot } from 'react-dom/client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── Colonnes standard ─────────────────────────────────────────────────────────
const COLUMN_DEFS = [
  { key: 'nom',     label: 'Nom' },
  { key: 'prenom',  label: 'Prénom' },
  { key: 'sexe',    label: 'Sexe' },
  { key: 'classe',  label: 'Classe' },
  { key: 'groupes', label: 'Groupes' },
]
const DEFAULT_COLUMNS = ['nom', 'prenom', 'sexe', 'classe', 'groupes']
const parse = (json, fallback) => { try { return JSON.parse(json) } catch { return fallback } }

function truncateList(items, max = 2) {
  if (items.length <= max) return items.join(', ')
  return items.slice(0, max).join(', ') + ` +${items.length - max} autres`
}

// ── Sélecteur recherche + chips ───────────────────────────────────────────────
function MultiSelect({ label, all, selected, onToggle, color = 'blue' }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref = useRef(null)

  const filtered = query.length >= 1
    ? all.filter(v => v.toLowerCase().includes(query.toLowerCase()) && !selected.includes(v))
    : all.filter(v => !selected.includes(v)).slice(0, 12)

  // Capture phase → fonctionne même avec stopPropagation dans les parents
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h, true)
    return () => document.removeEventListener('mousedown', h, true)
  }, [])

  const chip = color === 'purple' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
  const ring = color === 'purple' ? 'ring-purple-400' : 'ring-blue-400'
  const dot  = color === 'purple' ? 'bg-purple-400' : 'bg-blue-400'

  return (
    <div className="mb-4" ref={ref}>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{label}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 max-h-24 overflow-y-auto pr-1">
          {selected.map(v => (
            <span key={v} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${chip} flex-shrink-0`}>
              {v}
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onToggle(v) }}
                className="opacity-70 hover:opacity-100 leading-none"
              >×</button>
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
          onClick={() => setOpen(true)}
          placeholder={`Rechercher…`}
          className={`w-full text-xs px-3 py-1.5 pr-8 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 ${ring}`}
        />
        <button
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(v => (
              <button
                key={v}
                onMouseDown={e => { e.preventDefault(); onToggle(v); setQuery(''); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Colonnes libres ───────────────────────────────────────────────────────────
function FreeColumnsEditor({ freeCols, setFreeCols }) {
  const [input, setInput] = useState('')
  const add = () => {
    const label = input.trim()
    if (!label) return
    setFreeCols(p => [...p, { key: `free_${Date.now()}`, label }])
    setInput('')
  }
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Colonnes libres</p>
      {freeCols.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {freeCols.map(c => (
            <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 flex-shrink-0">
              {c.label}
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setFreeCols(p => p.filter(x => x.key !== c.key)) }}
                className="opacity-70 hover:opacity-100"
              >×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Nom de colonne…"
          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 ring-amber-400"
        />
        <button
          onMouseDown={e => { e.preventDefault(); add() }}
          disabled={!input.trim()}
          className="px-3 py-1 text-xs rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Ajouter
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">Colonnes vides (utiles pour impression / annotations)</p>
    </div>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────
function EleveTableConfig({ initialClasses, initialGroups, initialColumns, initialFree, allClasses, allGroups, onSave }) {
  const [selClasses, setSelClasses] = useState(initialClasses)
  const [selGroups,  setSelGroups]  = useState(initialGroups)
  const [selCols,    setSelCols]    = useState(initialColumns.length > 0 ? initialColumns : DEFAULT_COLUMNS)
  const [freeCols,   setFreeCols]   = useState(initialFree)

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
      <MultiSelect
        label="Classes"
        all={allClasses}
        selected={selClasses}
        onToggle={c => setSelClasses(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
        color="blue"
      />
      {allGroups.length > 0 && (
        <MultiSelect
          label="Groupes"
          all={allGroups}
          selected={selGroups}
          onToggle={g => setSelGroups(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])}
          color="purple"
        />
      )}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Colonnes à afficher</p>
        <div className="flex flex-wrap gap-1.5">
          {COLUMN_DEFS.map(col => (
            <button
              key={col.key}
              onClick={() => setSelCols(p => p.includes(col.key) ? p.filter(x => x !== col.key) : [...p, col.key])}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                selCols.includes(col.key)
                  ? 'bg-gray-800 dark:bg-gray-100 border-gray-800 text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>
      </div>
      <FreeColumnsEditor freeCols={freeCols} setFreeCols={setFreeCols} />
      <button
        onClick={() => canSave && onSave(selClasses, selGroups, selCols, freeCols)}
        disabled={!canSave}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
      >
        {initialClasses.length > 0 || initialGroups.length > 0 ? 'Mettre à jour' : 'Créer le tableau'}
      </button>
    </div>
  )
}

// ── Affichage ─────────────────────────────────────────────────────────────────
function SexeBadge({ value }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600">—</span>
  return (
    <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${
      value === 'M'
        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
        : value === 'F'
          ? 'bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-300'
          : 'bg-gray-100 text-gray-500'
    }`}>
      {value}
    </span>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return (
    <svg className="w-3 h-3 text-gray-300 dark:text-gray-600 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
  return dir === 'asc'
    ? <svg className="w-3 h-3 text-blue-500 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
    : <svg className="w-3 h-3 text-blue-500 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
}

function EleveTableDisplay({ classes, groups, columns, freeColumns, onEdit, onRemoveColumn, editable }) {
  const [eleves,    setEleves]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [sortField, setSortField] = useState('classe')
  const [sortDir,   setSortDir]   = useState('asc')
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const fetchEleves = useCallback(async () => {
    if (!isMounted.current) return
    setLoading(true)
    try {
      // groupes_ss est stocké en JSONB → .overlaps() ne fonctionne pas (jsonb && unknown)
      // On filtre côté client pour les groupes, ce qui est correct pour une école (~400 élèves max)
      let query = supabase.from('eleves').select('nom, prenom, sexe, classe, groupes_ss').eq('actif', true)

      // Filtre DB uniquement sur les classes (text column → .in() fonctionne)
      if (classes.length > 0 && groups.length === 0) {
        query = query.in('classe', classes)
      }
      // Si on a des groupes (seuls ou combinés), on fetch tous les actifs et on filtre en JS
      // (pour classes+groupes : on veut UNION, pas intersection)

      const { data: raw, error } = await query.order('classe').order('nom')
      if (error) throw error

      let data = raw || []

      if (groups.length > 0) {
        const groupSet = new Set(groups)
        if (classes.length === 0) {
          // Groupes seuls : garder uniquement les élèves appartenant à au moins un des groupes
          data = data.filter(e => Array.isArray(e.groupes_ss) && e.groupes_ss.some(g => groupSet.has(g)))
        } else {
          // Classes + groupes : UNION — élèves de ces classes OU de ces groupes
          // On a déjà filtré par classe côté DB ; on ajoute les élèves des groupes manquants
          const { data: allForGroups, error: e2 } = await supabase
            .from('eleves').select('nom, prenom, sexe, classe, groupes_ss').eq('actif', true)
          if (e2) throw e2
          const byGroup = (allForGroups || []).filter(e =>
            Array.isArray(e.groupes_ss) && e.groupes_ss.some(g => groupSet.has(g))
          )
          const seen = new Set(data.map(e => `${e.nom}|${e.prenom}|${e.classe}`))
          byGroup.forEach(e => {
            const k = `${e.nom}|${e.prenom}|${e.classe}`
            if (!seen.has(k)) { seen.add(k); data.push(e) }
          })
          data.sort((a, b) =>
            (a.classe||'').localeCompare(b.classe||'') || (a.nom||'').localeCompare(b.nom||'')
          )
        }
      }

      if (isMounted.current) {
        setEleves(data)
        setLoading(false)
      }
    } catch (err) {
      console.error('[EleveTable] fetch error:', err)
      if (isMounted.current) setLoading(false)
    }
  }, [classes.join(','), groups.join(',')])

  useEffect(() => { fetchEleves() }, [fetchEleves])

  const toggleSort = (key) => {
    setSortField(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return key }
      setSortDir('asc')
      return key
    })
  }

  const sorted = [...eleves].sort((a, b) => {
    let va = '', vb = ''
    if (sortField === 'groupes') {
      va = (Array.isArray(a.groupes_ss) ? a.groupes_ss[0] : '') || ''
      vb = (Array.isArray(b.groupes_ss) ? b.groupes_ss[0] : '') || ''
    } else {
      va = (a[sortField] || '').toString()
      vb = (b[sortField] || '').toString()
    }
    const cmp = va.localeCompare(vb, 'fr', { sensitivity: 'base' })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const standardCols = COLUMN_DEFS.filter(c => columns.includes(c.key))
  const allCols = [
    ...standardCols,
    ...(freeColumns || []),
  ]

  const filterParts = [
    ...classes,
    ...groups.map(g => `Gr. ${g}`),
  ]
  const headerLabel = truncateList(filterParts, 2)

  const renderCell = (e, key) => {
    if (key === 'groupes') {
      const g = Array.isArray(e.groupes_ss) ? e.groupes_ss.filter(Boolean) : []
      return g.length
        ? <span className="text-xs text-gray-600 dark:text-gray-400">{g.join(', ')}</span>
        : <span className="text-gray-300 dark:text-gray-600">—</span>
    }
    if (key === 'sexe') return <SexeBadge value={e[key]} />
    return e[key] || <span className="text-gray-300 dark:text-gray-600">—</span>
  }

  return (
    <div
      className="rounded-xl border border-gray-200 dark:border-gray-700"
      style={{ overflow: 'clip' }}
      contentEditable={false}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0">📋</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{headerLabel}</span>
          {!loading && (
            <span className="text-xs text-gray-400 flex-shrink-0">— {eleves.length} élève{eleves.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchEleves}
            title="Rafraîchir"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
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

      {/* Corps */}
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
                {allCols.map(col => (
                  <th
                    key={col.key}
                    onClick={() => !col.key.startsWith('free_') && toggleSort(col.key)}
                    className={`px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60 whitespace-nowrap group/col ${
                      !col.key.startsWith('free_') ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {!col.key.startsWith('free_') && (
                        <SortIcon active={sortField === col.key} dir={sortDir} />
                      )}
                      {editable && allCols.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveColumn(col.key) }}
                          title={`Retirer la colonne "${col.label}"`}
                          className="opacity-0 group-hover/col:opacity-100 ml-1 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-opacity leading-none font-normal normal-case text-sm"
                        >×</button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {sorted.length === 0
                ? (
                  <tr>
                    <td colSpan={allCols.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                      Aucun élève trouvé
                    </td>
                  </tr>
                )
                : sorted.map((e, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-900 hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                    {allCols.map(col => (
                      <td key={col.key} className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        {col.key.startsWith('free_')
                          ? <span className="text-gray-200 dark:text-gray-700">·</span>
                          : renderCell(e, col.key)
                        }
                      </td>
                    ))}
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
  const classes     = parse(block.props.classes,     [])
  const groups      = parse(block.props.groups,      [])
  const columns     = parse(block.props.columns,     DEFAULT_COLUMNS)
  const freeColumns = parse(block.props.freeColumns, [])

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
      data.forEach(e => {
        if (Array.isArray(e.groupes_ss)) e.groupes_ss.filter(Boolean).forEach(g => grpSet.add(g))
      })
      setAllClasses(cls)
      setAllGroups([...grpSet].sort())
    })
  }, [configMode])

  const handleRemoveColumn = (key) => {
    if (!editor.isEditable) return
    let newColumns = columns
    let newFree = freeColumns
    if (key.startsWith('free_')) {
      newFree = freeColumns.filter(c => c.key !== key)
    } else {
      newColumns = columns.filter(c => c !== key)
    }
    editor.updateBlock(block, {
      type: 'eleveTable',
      props: {
        classes:     block.props.classes,
        groups:      block.props.groups,
        columns:     JSON.stringify(newColumns),
        freeColumns: JSON.stringify(newFree),
      }
    })
  }

  const handleSave = (selClasses, selGroups, selCols, selFree) => {
    if (editor.isEditable) {
      editor.updateBlock(block, {
        type: 'eleveTable',
        props: {
          classes:     JSON.stringify(selClasses),
          groups:      JSON.stringify(selGroups),
          columns:     JSON.stringify(selCols),
          freeColumns: JSON.stringify(selFree),
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
        initialFree={freeColumns}
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
      freeColumns={freeColumns}
      editable={editor.isEditable}
      onEdit={() => setConfigMode(true)}
      onRemoveColumn={handleRemoveColumn}
    />
  )
}

// ── BlockSpec via createBlockSpec + createRoot ────────────────────────────────
export const EleveTableBlock = createBlockSpec(
  {
    type: 'eleveTable',
    propSchema: {
      classes:     { default: '[]' },
      groups:      { default: '[]' },
      columns:     { default: JSON.stringify(DEFAULT_COLUMNS) },
      freeColumns: { default: '[]' },
    },
    content: 'none',
  },
  () => ({
    render(block, editor) {
      const dom = document.createElement('div')
      dom.setAttribute('data-eleve-table', 'true')
      dom.style.width = '100%'
      dom.style.overflow = 'hidden'
      // Empêche le plugin table de ProseMirror de traiter notre <table> HTML
      // comme un nœud ProseMirror (évite l'erreur "Cannot read .rows of undefined")
      const stopPM = e => e.stopPropagation()
      dom.addEventListener('mouseover', stopPM)
      dom.addEventListener('mousemove', stopPM)
      const root = createRoot(dom)
      root.render(React.createElement(EleveTableBlockComponent, { block, editor }))
      return {
        dom,
        destroy() {
          setTimeout(() => root.unmount(), 0)
        },
      }
    },
  })
)()
