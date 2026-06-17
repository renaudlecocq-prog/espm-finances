import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import FicheEleve from '../components/ui/FicheEleve'
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

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

// ── Custom dropdown pill ───────────────────────────────────────────────────
function FilterPill({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const active = !!value

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 rounded-full border text-xs font-medium
          px-3 py-1.5 whitespace-nowrap transition-colors select-none
          ${active
            ? 'border-primary bg-primary/8 text-primary'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'
          }`}
      >
        {active ? <><span className="opacity-60">{label}</span> · {value}</> : label}
        <ChevronDown size={11} className={active ? 'text-primary' : 'text-gray-400'} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200
          rounded-xl shadow-lg min-w-[180px] max-h-56 overflow-y-auto py-1">
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
          >
            Tous
          </button>
          {options.map(v => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 leading-snug
                ${value === v ? 'text-primary font-semibold' : 'text-gray-700'}`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
    COLS.filter(c => c.filter).forEach(c => {
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

  return (
    <div className="p-6 max-w-screen-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <h1 className="text-2xl font-bold text-primary mb-0.5 shrink-0">Groupes</h1>
      <p className="text-sm text-gray-400 mb-4 shrink-0">
        Groupes Smartschool — <strong>{rows.length}</strong> élèves actifs
      </p>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
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

        {/* Filter pills */}
        {COLS.filter(c => c.filter).map(c => (
          <FilterPill
            key={c.key}
            label={c.label}
            value={filters[c.key] || ''}
            options={opts[c.key] || []}
            onChange={val => setFilter(c.key, val)}
          />
        ))}

        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

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
