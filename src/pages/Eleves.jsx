import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FicheEleve from '../components/ui/FicheEleve'
import FilterPill from '../components/ui/FilterPill'
import { Link2, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react'

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
  { key: '_actions',   label: 'Actions',   w: 90,  align: 'center', noSort: true },
]

export default function Eleves() {
  const { isAdmin, isFinancier } = useAuth()
  const canEdit = isAdmin || isFinancier

  const [searchParams] = useSearchParams()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [deleteRow, setDeleteRow] = useState(null)
  const [saving, setSaving]   = useState(false)

  const [search, setSearch]         = useState('')
  const [filterSolde, setFilterSolde]   = useState('')
  const [filterClasse, setFilterClasse] = useState('')
  const [sort, setSort]             = useState({ col: 'nom', dir: 'asc' })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [elevesRes, facturesRes, paiementsRes, echRes] = await Promise.all([
      supabase.from('eleves').select('*').eq('actif', true).order('nom'),
      supabase.from('factures').select('eleve_id, montant'),
      supabase.from('paiements').select('eleve_id, montant'),
      supabase.from('echelonnements').select('eleve_id, montant'),
    ])
    const sumBy = (data) => {
      const m = new Map()
      for (const r of (data || [])) m.set(r.eleve_id, (m.get(r.eleve_id) || 0) + Number(r.montant || 0))
      return m
    }
    const mF = sumBy(facturesRes.data), mP = sumBy(paiementsRes.data), mE = sumBy(echRes.data)
    setRows((elevesRes.data || []).map(e => {
      const factures  = mF.get(e.id) || 0
      const paiements = mP.get(e.id) || 0
      const ech       = mE.get(e.id) || 0
      return {
        ...e,
        solde: paiements - factures,   // calculé dynamiquement
        _factures:  factures,
        _paiements: paiements,
        _ech:       ech,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    const solde = searchParams.get('solde')
    if (solde === 'negatif') setFilterSolde('Négatif')
    else if (solde === 'positif') setFilterSolde('Positif')
    loadData()
  }, [loadData, searchParams])

  const classes = useMemo(() => [...new Set(rows.map(r => r.classe).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.nom || '').toLowerCase().includes(q) || (r.prenom || '').toLowerCase().includes(q))
    }
    if (filterClasse) d = d.filter(r => r.classe === filterClasse)
    if (filterSolde === 'Négatif') d = d.filter(r => Number(r.solde || 0) < 0)
    if (filterSolde === 'Neutre')  d = d.filter(r => Number(r.solde || 0) === 0)
    if (filterSolde === 'Positif') d = d.filter(r => Number(r.solde || 0) > 0)
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      const va = a[col], vb = b[col]
      if (typeof va === 'number' || col.startsWith('_')) return (Number(va || 0) - Number(vb || 0)) * (dir === 'asc' ? 1 : -1)
      return String(va || '').localeCompare(String(vb || ''), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [rows, search, filterClasse, filterSolde, sort])

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('eleves').update({ nom: editRow.nom, prenom: editRow.prenom, classe: editRow.classe }).eq('id', editRow.id)
    setSaving(false); setEditRow(null); loadData()
  }

  const confirmDelete = async () => {
    await supabase.from('eleves').update({ actif: false }).eq('id', deleteRow.id)
    setDeleteRow(null); loadData()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  const totalW = COLS.reduce((s, c) => s + c.w, 0)

  return (
    <div className="p-6 max-w-screen-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      <h1 className="text-2xl font-bold text-primary mb-0.5 shrink-0">Élèves</h1>
      <p className="text-sm text-gray-400 mb-4 shrink-0">Liste des élèves et leurs soldes</p>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
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

        <FilterPill
          label="Solde"
          value={filterSolde}
          options={['Négatif', 'Neutre', 'Positif']}
          onChange={setFilterSolde}
        />
        <FilterPill
          label="Classe"
          value={filterClasse}
          options={classes}
          onChange={setFilterClasse}
        />

        {(search || filterSolde || filterClasse) && (
          <button onClick={() => { setSearch(''); setFilterSolde(''); setFilterClasse('') }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap">
            <span className="text-sm leading-none">✕</span> Tout effacer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

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
                      {c.label}
                      {!c.noSort && <SortIcon col={c.key} sort={sort} />}
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
              <tr key={row.id} className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer group">
                {COLS.map((c, i) => {
                  const isSticky = c.sticky !== undefined
                  let content
                  if (c.key === 'solde')      content = fmtSolde(row.solde)
                  else if (c.key === '_factures')  content = fmtMoney(row._factures)
                  else if (c.key === '_paiements') content = fmtMoney(row._paiements)
                  else if (c.key === '_ech')       content = fmtMoney(row._ech)
                  else if (c.key === '_as')        content = <span className="text-gray-300">—</span>
                  else if (c.key === '_actions')   content = (
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={e => { e.stopPropagation(); setFicheId(row.id) }}
                        title="Fiche" className="text-gray-400 hover:text-primary"><Link2 size={14} /></button>
                      {canEdit && <button onClick={e => { e.stopPropagation(); setEditRow({ ...row }) }}
                        title="Modifier" className="text-gray-400 hover:text-blue-500"><Pencil size={13} /></button>}
                      {isAdmin && <button onClick={e => { e.stopPropagation(); setDeleteRow(row) }}
                        title="Désactiver" className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>}
                    </div>
                  )
                  else content = row[c.key] ?? <span className="text-gray-300">—</span>

                  return (
                    <td key={c.key}
                      style={{
                        width: c.w, minWidth: c.w, textAlign: c.align || 'left',
                        ...(isSticky ? { position: 'sticky', left: c.sticky, zIndex: 10 } : {}),
                      }}
                      className={`px-3 py-2 border-r border-gray-50 last:border-r-0
                        bg-white group-hover:bg-primary/5
                        ${i < 2 ? 'font-medium text-gray-800' : 'text-gray-600'}`}
                      onClick={() => c.key !== '_actions' && setFicheId(row.id)}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />

      {editRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-primary mb-4">Modifier l'élève</h3>
            <div className="space-y-3">
              {['nom','prenom','classe'].map(k => (
                <div key={k}><label className="label capitalize">{k}</label>
                  <input className="input" value={editRow[k] || ''} onChange={e => setEditRow(r => ({ ...r, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 py-2 flex justify-center">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditRow(null)} className="btn-secondary flex-1 py-2 flex justify-center">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-primary mb-2">Désactiver l'élève ?</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{deleteRow.nom} {deleteRow.prenom}</strong> sera marqué comme inactif.
            </p>
            <div className="flex gap-2">
              <button onClick={confirmDelete} className="btn-primary bg-red-600 hover:bg-red-700 flex-1 py-2 flex justify-center">Désactiver</button>
              <button onClick={() => setDeleteRow(null)} className="btn-secondary flex-1 py-2 flex justify-center">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
