import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import FicheEleve from '../components/ui/FicheEleve'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronDown as Caret } from 'lucide-react'

const COLS = [
  { key: 'nom',             label: 'Nom',          filter: false },
  { key: 'prenom',          label: 'Prénom',        filter: false },
  { key: 'classe',          label: 'Classe',        filter: true  },
  { key: 'rlmo',            label: 'RLMO',          filter: true  },
  { key: 'obs_d2',          label: 'OBS D2',        filter: true  },
  { key: 'ac_d2',           label: 'AC D2',         filter: true  },
  { key: 'math_d3',         label: 'Math D3',       filter: true  },
  { key: 'sciences_d3',     label: 'Sciences D3',   filter: true  },
  { key: 'bio_physique_d3', label: 'Bio/Physique',  filter: true  },
  { key: 'obs1_d3',         label: 'OBS 1 D3',      filter: true  },
  { key: 'obs2_d3',         label: 'OBS 2 D3',      filter: true  },
  { key: 'ac_d3',           label: 'AC D3',         filter: true  },
]

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp size={11} className="text-primary ml-0.5 shrink-0" />
    : <ChevronDown size={11} className="text-primary ml-0.5 shrink-0" />
}

/** Pill-shaped dropdown filter — mimics the original compact style */
function PillSelect({ label, value, options, onChange }) {
  const active = !!value
  return (
    <div className="relative inline-flex shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`
          appearance-none cursor-pointer rounded-full border text-xs font-medium
          pl-3 pr-6 py-1.5 outline-none transition-colors
          ${active
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
        `}
      >
        <option value="">{label}</option>
        {options.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      {/* Custom chevron overlay */}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <ChevronDown size={11} className={active ? 'text-primary' : 'text-gray-400'} />
      </span>
    </div>
  )
}

export default function Groupes() {
  const [rows, setRows]     = useState([])
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

  const setFilter = (col, val) =>
    setFilters(f => val ? { ...f, [col]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== col)))

  const toggleSort = col =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

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

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Groupes</h1>
      <p className="text-sm text-gray-400 mb-5">
        Groupes Smartschool — <strong>{rows.length}</strong> élèves actifs
      </p>

      {/* Toolbar — all on one scrollable line */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {/* Search */}
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-40 focus:border-primary transition-colors"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Pill filters */}
        {COLS.filter(c => c.filter).map(c => (
          <PillSelect
            key={c.key}
            label={c.label}
            value={filters[c.key] || ''}
            options={opts[c.key] || []}
            onChange={val => setFilter(c.key, val)}
          />
        ))}

        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap pl-4">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse" style={{ minWidth: '1300px' }}>
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {COLS.map(c => (
                  <th key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-primary select-none whitespace-nowrap">
                    <span className="flex items-center gap-0.5">
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
                  <td colSpan={COLS.length} className="px-4 py-10 text-center text-gray-400">Aucun élève</td>
                </tr>
              ) : filtered.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setFicheId(row.id)}
                  className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                >
                  {COLS.map((c, i) => (
                    <td key={c.key}
                      className={`px-3 py-2 whitespace-nowrap text-sm
                        ${i < 2 ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
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
