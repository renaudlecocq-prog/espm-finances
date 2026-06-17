import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import FicheEleve from '../components/ui/FicheEleve'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'

// ── Column definitions ──────────────────────────────────────────────────────
const COLS = [
  { key: 'nom',              label: 'Nom',          fixed: true  },
  { key: 'prenom',           label: 'Prénom',       fixed: true  },
  { key: 'classe',           label: 'Classe',       filter: true },
  { key: 'rlmo',             label: 'RLMO',         filter: true },
  { key: 'obs_d2',           label: 'OBS D2',       filter: true },
  { key: 'ac_d2',            label: 'AC D2',        filter: true },
  { key: 'math_d3',          label: 'Math D3',      filter: true },
  { key: 'sciences_d3',      label: 'Sciences D3',  filter: true },
  { key: 'bio_physique_d3',  label: 'Bio/Physique', filter: true },
  { key: 'obs1_d3',          label: 'OBS 1 D3',     filter: true },
  { key: 'obs2_d3',          label: 'OBS 2 D3',     filter: true },
  { key: 'ac_d3',            label: 'AC D3',        filter: true },
]

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={12} className="text-gray-300 ml-0.5 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp size={12} className="text-primary ml-0.5 shrink-0" />
    : <ChevronDown size={12} className="text-primary ml-0.5 shrink-0" />
}

export default function Groupes() {
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)
  const [search, setSearch]   = useState('')
  const [sort, setSort]       = useState({ col: 'nom', dir: 'asc' })
  const [filters, setFilters] = useState({})   // { col: value }

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

  // Unique values per filterable column
  const opts = useMemo(() => {
    const o = {}
    COLS.filter(c => c.filter).forEach(c => {
      o[c.key] = [...new Set(rows.map(r => r[c.key]).filter(Boolean))].sort()
    })
    return o
  }, [rows])

  const toggleSort = col =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const setFilter = (col, val) =>
    setFilters(f => val ? { ...f, [col]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== col)))

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.nom || '').toLowerCase().includes(q) || (r.prenom || '').toLowerCase().includes(q))
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

  const activeFilters = Object.keys(filters)

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Groupes</h1>
      <p className="text-sm text-gray-400 mb-5">
        Groupes Smartschool — <strong>{rows.length}</strong> élèves actifs
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 text-sm py-1.5 w-52"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Column filter dropdowns */}
        {COLS.filter(c => c.filter).map(c => (
          <div key={c.key} className="relative">
            <select
              className={`input text-sm py-1.5 pr-7 ${filters[c.key] ? 'border-primary text-primary font-medium' : ''}`}
              value={filters[c.key] || ''}
              onChange={e => setFilter(c.key, e.target.value)}
            >
              <option value="">{c.label}</option>
              {(opts[c.key] || []).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {filters[c.key] && (
              <button
                onClick={() => setFilter(c.key, '')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary hover:text-red-500 z-10"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}

        <span className="ml-auto text-sm text-gray-400 whitespace-nowrap">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeFilters.map(col => {
            const label = COLS.find(c => c.key === col)?.label || col
            return (
              <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {label}: {filters[col]}
                <button onClick={() => setFilter(col, '')} className="hover:text-red-500"><X size={10} /></button>
              </span>
            )
          })}
          <button onClick={() => setFilters({})} className="text-xs text-gray-400 underline ml-1">Tout effacer</button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {COLS.map(c => (
                  <th key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-primary select-none whitespace-nowrap">
                    <span className="flex items-center">
                      {c.label}
                      <SortIcon col={c.key} sort={sort} />
                    </span>
                  </th>
                ))}
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
                  className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                >
                  {COLS.map(c => (
                    <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.fixed ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                      {row[c.key] || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}
