import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import FicheEleve from '../components/ui/FicheEleve'
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import MasterFilter, { ActiveFilterChips } from '../components/ui/MasterFilter'

// ── Column config ──────────────────────────────────────────────────────────
const COLS = [
  { key: 'nom',             label: 'Nom',          w: 160, sticky: 0   },
  { key: 'prenom',          label: 'Prénom',        w: 160, sticky: 160 },
  { key: 'classe',          label: 'Classe',        w: 160, filter: true },
  { key: 'rlmo',            label: 'RLMO',          w: 220, filter: true },
  { key: 'obs_d2',          label: 'OBS D2',        w: 200, filter: true },
  { key: 'ac_d2',           label: 'AC D2',         w: 200, filter: true },
  { key: 'math_d3',         label: 'Math D3',       w: 170, filter: true },
  { key: 'sciences_d3',     label: 'Sciences D3',   w: 200, filter: true },
  { key: 'bio_physique_d3', label: 'Bio/Physique',  w: 200, filter: true },
  { key: 'obs1_d3',         label: 'OBS 1 D3',      w: 200, filter: true },
  { key: 'obs2_d3',         label: 'OBS 2 D3',      w: 200, filter: true },
  { key: 'ac_d3',           label: 'AC D3',         w: 200, filter: true },
]

const FILTER_COLS = COLS.filter(c => c.filter)
const FILTER_DEFS = FILTER_COLS.map(c => ({ key: c.key, label: c.label, options: [] })) // options filled dynamically

// ── Sort icon ──────────────────────────────────────────────────────────────
function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp   size={11} className="text-primary ml-0.5 shrink-0" />
    : <ChevronDown size={11} className="text-primary ml-0.5 shrink-0" />
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Groupes() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)
  const [search, setSearch]   = useState('')
  const [sort, setSort]       = useState({ col: 'nom', dir: 'asc' })
  const [filters, setFilters] = useState({})

  useEffect(() => {
    supabase.from('eleves').select('*').eq('actif', true).order('nom')
      .then(({ data }) => {
        setRows((data || []).map(r => ({
          ...r,
          rlmo: [r.philosophie, r.groupe_choix_philo].filter(Boolean).join(' ') || null,
        })))
        setLoading(false)
      })
  }, [])

  const opts = useMemo(() => {
    const o = {}
    FILTER_COLS.forEach(c => {
      o[c.key] = [...new Set(rows.map(r => r[c.key]).filter(Boolean))].sort()
    })
    return o
  }, [rows])

  const toggleFilter = useCallback((col, val) =>
    setFilters(f => {
      const cur  = Array.isArray(f[col]) ? f[col] : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return next.length === 0
        ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== col))
        : { ...f, [col]: next }
    })
  , [])

  const toggleSort = col =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        (r.nom || '').toLowerCase().includes(q) ||
        (r.prenom || '').toLowerCase().includes(q)
      )
    }
    Object.entries(filters).forEach(([col, vals]) => {
      if (Array.isArray(vals) && vals.length > 0) d = d.filter(r => vals.includes(r[col]))
    })
    const { col, dir } = sort
    return [...d].sort((a, b) =>
      String(a[col] || '').localeCompare(String(b[col] || ''), 'fr') * (dir === 'asc' ? 1 : -1)
    )
  }, [rows, search, filters, sort])

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>


  return (
    <>
    <PageHeader title="Groupes" subtitle={`Groupes Smartschool — ${rows.length} élèves actifs`} />
    <div className="p-6 max-w-screen-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 88px)' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        {/* Search */}
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5
              outline-none w-36 focus:border-primary transition-colors"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Master filter */}
        <MasterFilter
          filters={filters}
          filterDefs={FILTER_COLS.map(c => ({ key: c.key, label: c.label, options: opts[c.key] || [] }))}
          onChange={toggleFilter}
          onClearAll={() => setFilters({})}
        />

        {(search || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v)) && (
          <button
            onClick={() => { setSearch(''); setFilters({}) }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600
              border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap"
          >
            <X size={11} /> Tout effacer
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active filter chips */}
      <ActiveFilterChips
        filters={filters}
        filterDefs={FILTER_COLS.map(c => ({ key: c.key, label: c.label, options: opts[c.key] || [] }))}
        onChange={toggleFilter}
      />

      {/* Scrollable table container — fills remaining height */}
      <div className="card p-0 flex-1 overflow-auto min-h-0">
        <table className="text-sm border-collapse" style={{ minWidth: `${COLS.reduce((s, c) => s + c.w, 0)}px` }}>

          {/* Sticky header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLS.map((c, i) => {
                const isSticky = c.sticky !== undefined
                return (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    style={{
                      width: c.w, minWidth: c.w,
                      position: isSticky ? 'sticky' : undefined,
                      left: isSticky ? c.sticky : undefined,
                      zIndex: isSticky ? 30 : undefined,
                    }}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase
                      cursor-pointer select-none whitespace-nowrap bg-gray-50
                      hover:text-primary border-r border-gray-100 last:border-r-0"
                  >
                    <span className="flex items-center gap-0.5">
                      {c.label}
                      <SortIcon col={c.key} sort={sort} />
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-10 text-center text-gray-400">
                  Aucun élève
                </td>
              </tr>
            ) : filtered.map(row => (
              <tr
                key={row.id}
                onClick={() => setFicheId(row.id)}
                className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer group"
              >
                {COLS.map((c, i) => {
                  const isSticky = c.sticky !== undefined
                  return (
                    <td
                      key={c.key}
                      style={{
                        width: c.w, minWidth: c.w,
                        position: isSticky ? 'sticky' : undefined,
                        left: isSticky ? c.sticky : undefined,
                        zIndex: isSticky ? 10 : undefined,
                      }}
                      className={`px-3 py-2 whitespace-nowrap border-r border-gray-50 last:border-r-0
                        bg-white group-hover:bg-primary/5
                        ${i < 2 ? 'font-medium text-gray-800' : 'text-gray-600 text-sm'}`}
                    >
                      {row[c.key] ?? <span className="text-gray-300 select-none">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
    </>
  )
}
