import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import FicheEleve from '../components/ui/FicheEleve'
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, SlidersHorizontal, X } from 'lucide-react'

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

// ── Sort icon ──────────────────────────────────────────────────────────────
function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp   size={11} className="text-primary ml-0.5 shrink-0" />
    : <ChevronDown size={11} className="text-primary ml-0.5 shrink-0" />
}

// ── Master filter dropdown ─────────────────────────────────────────────────
function MasterFilter({ filters, opts, setFilter, setFilters }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const activeCount = Object.keys(filters).length

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-medium
          px-3 py-1.5 whitespace-nowrap transition-colors select-none
          ${activeCount > 0
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'
          }`}
      >
        <SlidersHorizontal size={12} />
        Filtres
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full
            bg-primary text-white text-[10px] font-bold leading-none">
            {activeCount}
          </span>
        )}
        <ChevronDown
          size={11}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${activeCount > 0 ? 'text-primary' : 'text-gray-400'}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200
          rounded-2xl shadow-xl overflow-hidden"
          style={{ width: 440 }}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <SlidersHorizontal size={12} className="text-gray-400" />
              Filtrer par colonne
            </span>
            {activeCount > 0 && (
              <button
                onClick={() => { setFilters({}); setOpen(false) }}
                className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium flex items-center gap-1"
              >
                <X size={11} /> Tout effacer
              </button>
            )}
          </div>

          {/* Filter grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            {FILTER_COLS.map(c => {
              const active = !!filters[c.key]
              return (
                <div key={c.key}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5
                    transition-colors"
                    style={{ color: active ? 'var(--color-primary, #4f46e5)' : '#9ca3af' }}
                  >
                    {c.label}
                  </label>
                  <div className="relative">
                    <select
                      value={filters[c.key] || ''}
                      onChange={e => setFilter(c.key, e.target.value)}
                      className={`w-full rounded-lg border text-xs px-2.5 py-1.5 pr-6 outline-none
                        cursor-pointer appearance-none bg-white transition-all
                        ${active
                          ? 'border-primary/40 text-primary bg-primary/5 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <option value="">Tous</option>
                      {(opts[c.key] || []).map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={11}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none
                        ${active ? 'text-primary' : 'text-gray-400'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Panel footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {activeCount === 0
                ? 'Aucun filtre actif'
                : `${activeCount} filtre${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors
                bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
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

  const setFilter = useCallback((col, val) =>
    setFilters(f => val ? { ...f, [col]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== col)))
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
    Object.entries(filters).forEach(([col, val]) => {
      d = d.filter(r => r[col] === val)
    })
    const { col, dir } = sort
    return [...d].sort((a, b) =>
      String(a[col] || '').localeCompare(String(b[col] || ''), 'fr') * (dir === 'asc' ? 1 : -1)
    )
  }, [rows, search, filters, sort])

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  const activeFilters = Object.entries(filters)

  return (
    <div className="p-6 max-w-screen-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <h1 className="text-2xl font-bold text-primary mb-0.5 shrink-0">Groupes</h1>
      <p className="text-sm text-gray-400 mb-4 shrink-0">
        Groupes Smartschool — <strong>{rows.length}</strong> élèves actifs
      </p>

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

        {/* Master filter button */}
        <MasterFilter
          filters={filters}
          opts={opts}
          setFilter={setFilter}
          setFilters={setFilters}
        />

        {(search || activeFilters.length > 0) && (
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
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
          {activeFilters.map(([key, val]) => {
            const col = COLS.find(c => c.key === key)
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-primary/8 border border-primary/20
                  text-primary text-xs px-2.5 py-1 font-medium"
              >
                <span className="opacity-60 font-normal">{col?.label} ·</span> {val}
                <button
                  onClick={() => setFilter(key, '')}
                  className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                  aria-label={`Retirer le filtre ${col?.label}`}
                >
                  <X size={10} />
                </button>
              </span>
            )
          })}
        </div>
      )}

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
  )
}
