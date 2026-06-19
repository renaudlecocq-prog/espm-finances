import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import FicheEleve from '../components/ui/FicheEleve'
import MasterFilter, { ActiveFilterChips } from '../components/ui/MasterFilter'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react'

const fmt = n => Number(n || 0).toFixed(2) + ' €'

const fmtSolde = v => {
  const n = Number(v || 0)
  if (n < 0) return <span className="font-semibold text-red-600">{fmt(n)}</span>
  if (n > 0) return <span className="font-semibold text-green-600">{fmt(n)}</span>
  return <span className="text-gray-400">{fmt(0)}</span>
}

const fmtMoney = v => {
  const n = Number(v || 0)
  return n === 0
    ? <span className="text-gray-400">{fmt(0)}</span>
    : <span className="text-gray-700">{fmt(n)}</span>
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp   size={11} className="text-primary ml-0.5 shrink-0" />
    : <ChevronDown size={11} className="text-primary ml-0.5 shrink-0" />
}

const COLS = [
  { key: 'nom',        label: 'Nom',       w: 160, sticky: 0   },
  { key: 'prenom',     label: 'Prénom',    w: 160, sticky: 160 },
  { key: 'classe',     label: 'Classe',    w: 140 },
  { key: 'solde',      label: 'Solde',     w: 120, align: 'right' },
  { key: '_factures',  label: 'Factures',  w: 120, align: 'right' },
  { key: '_paiements', label: 'Paiements', w: 120, align: 'right' },
  { key: '_ech',       label: 'ÉCH.',      w: 110, align: 'right' },
  { key: '_as',        label: 'AS',        w: 60,  align: 'center' },
]

export default function Eleves() {
  const [searchParams] = useSearchParams()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort]     = useState({ col: 'nom', dir: 'asc' })

  const toggleFilter = useCallback((key, val) =>
    setFilters(f => {
      const cur  = Array.isArray(f[key]) ? f[key] : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return next.length === 0
        ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key))
        : { ...f, [key]: next }
    })
  , [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [elevesRes, facturesRes, paiementsRes, echRes, otRes] = await Promise.all([
      supabase.from('eleves').select('*').eq('actif', true).order('nom'),
      supabase.from('factures').select('eleve_id, montant'),
      supabase.from('paiements').select('eleve_id, montant'),
      supabase.from('echelonnements').select('eleve_id, montant'),
      supabase.from('organismes_tiers').select('eleve_id, organisme, statut').in('statut', ['en_cours', 'valide']),
    ])
    const sumBy = (data) => {
      const m = new Map()
      for (const r of (data || [])) m.set(r.eleve_id, (m.get(r.eleve_id) || 0) + Number(r.montant || 0))
      return m
    }
    const mF = sumBy(facturesRes.data), mP = sumBy(paiementsRes.data), mE = sumBy(echRes.data)
    // Map eleve_id → liste d'organismes actifs (en_cours ou valide)
    const mAS = new Map()
    for (const r of (otRes.data || [])) {
      if (!mAS.has(r.eleve_id)) mAS.set(r.eleve_id, [])
      mAS.get(r.eleve_id).push(r.organisme)
    }
    setRows((elevesRes.data || []).map(e => {
      const factures  = mF.get(e.id) || 0
      const paiements = mP.get(e.id) || 0
      const ech       = mE.get(e.id) || 0
      return {
        ...e,
        solde: paiements - factures,
        _factures:  factures,
        _paiements: paiements,
        _ech:       ech,
        _asOrganismes: mAS.get(e.id) || [],
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    const solde = searchParams.get('solde')
    if (solde === 'negatif') setFilters(f => ({ ...f, solde: ['Négatif'] }))
    else if (solde === 'positif') setFilters(f => ({ ...f, solde: ['Positif'] }))
    loadData()
  }, [loadData, searchParams])  // eslint-disable-line react-hooks/exhaustive-deps

  const classes = useMemo(() => [...new Set(rows.map(r => r.classe).filter(Boolean))].sort(), [rows])

  const filterDefs = useMemo(() => [
    { key: 'classe', label: 'Classe',  options: classes },
    { key: 'solde',  label: 'Solde',   options: ['Négatif', 'Neutre', 'Positif'] },
  ], [classes])

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.nom || '').toLowerCase().includes(q) || (r.prenom || '').toLowerCase().includes(q))
    }
    if (filters.classe?.length) d = d.filter(r => filters.classe.includes(r.classe))
    if (filters.solde?.length) {
      d = d.filter(r => {
        const n = Number(r.solde || 0)
        return filters.solde.some(s => s === 'Négatif' ? n < 0 : s === 'Neutre' ? n === 0 : n > 0)
      })
    }
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      const va = a[col], vb = b[col]
      if (typeof va === 'number' || col.startsWith('_')) return (Number(va || 0) - Number(vb || 0)) * (dir === 'asc' ? 1 : -1)
      return String(va || '').localeCompare(String(vb || ''), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [rows, search, filters, sort])

  const toggleSort = col =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  const totalW = COLS.reduce((s, c) => s + c.w, 0)
  const hasFilters = search || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v)

  return (
    <div className="p-6 max-w-screen-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      <h1 className="text-2xl font-bold text-primary mb-0.5 shrink-0">Élèves</h1>
      <p className="text-sm text-gray-400 mb-4 shrink-0">Liste des élèves et leurs soldes</p>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5
              outline-none w-48 focus:border-primary transition-colors"
            placeholder="Rechercher par nom, prénom…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={11} />
            </button>
          )}
        </div>

        <MasterFilter
          filters={filters}
          filterDefs={filterDefs}
          onChange={toggleFilter}
          onClearAll={() => setFilters({})}
        />

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilters({}) }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600
              border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap">
            <X size={11} /> Tout effacer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active filter chips */}
      <ActiveFilterChips filters={filters} filterDefs={filterDefs} onChange={toggleFilter} />

      {/* Table */}
      <div className="card p-0 flex-1 overflow-auto min-h-0">
        <table className="text-sm border-collapse" style={{ minWidth: totalW + 'px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLS.map(c => {
                const isSticky = c.sticky !== undefined
                return (
                  <th key={c.key}
                    onClick={() => !c.noSort && toggleSort(c.key)}
                    style={{
                      width: c.w, minWidth: c.w,
                      ...(isSticky ? { position: 'sticky', left: c.sticky, zIndex: 30 } : {}),
                      textAlign: c.align || 'left',
                    }}
                    className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase
                      bg-gray-50 border-r border-gray-100 last:border-r-0 whitespace-nowrap
                      ${!c.noSort ? 'cursor-pointer select-none hover:text-primary' : ''}`}
                  >
                    <span className={`flex items-center gap-0.5 ${c.align === 'right' ? 'justify-end' : c.align === 'center' ? 'justify-center' : ''}`}>
                      {c.label}{!c.noSort && <SortIcon col={c.key} sort={sort} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-gray-400">Aucun élève</td></tr>
            ) : filtered.map(row => (
              <tr key={row.id}
                onClick={() => setFicheId(row.id)}
                className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer group">
                {COLS.map((c, i) => {
                  const isSticky = c.sticky !== undefined
                  let cell
                  if (c.key === 'solde')      cell = fmtSolde(row.solde)
                  else if (c.key === '_factures') cell = fmtMoney(row._factures)
                  else if (c.key === '_paiements') cell = fmtMoney(row._paiements)
                  else if (c.key === '_ech')   cell = fmtMoney(row._ech)
                  else if (c.key === '_as') {
                    const ORG_COLORS = {
                      cpas:  'bg-purple-100 text-purple-700',
                      ulb:   'bg-blue-100 text-blue-700',
                      spj:   'bg-green-100 text-green-700',
                      autre: 'bg-red-100 text-red-700',
                    }
                    const orgs = row._asOrganismes || []
                    cell = orgs.length > 0
                      ? <span className="inline-flex flex-wrap gap-1">{orgs.map(o => (
                          <span key={o} className={`inline-block rounded-full text-xs px-1.5 py-0.5 font-medium leading-none ${ORG_COLORS[o] || 'bg-gray-100 text-gray-600'}`}>
                            {o.toUpperCase()}
                          </span>
                        ))}</span>
                      : null
                  }

                  else cell = row[c.key]
                  return (
                    <td key={c.key}
                      style={{
                        width: c.w, minWidth: c.w,
                        ...(isSticky ? { position: 'sticky', left: c.sticky, zIndex: 10 } : {}),
                        textAlign: c.align || 'left',
                      }}
                      className={`px-3 py-2 whitespace-nowrap border-r border-gray-50 last:border-r-0
                        bg-white group-hover:bg-primary/5
                        ${i < 2 ? 'font-medium text-gray-800' : 'text-gray-600 text-sm'}`}
                    >
                      {cell ?? <span className="text-gray-300 select-none">—</span>}
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

