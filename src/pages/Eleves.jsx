import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FicheEleve from '../components/ui/FicheEleve'
import { Link2, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react'

const fmt = n => Number(n || 0).toFixed(2) + ' €'

const fmtSolde = v => {
  const n = Number(v || 0)
  if (n < 0) return <span className="font-semibold text-red-600">{fmt(n)}</span>
  if (n > 0) return <span className="font-semibold text-orange-500">{fmt(n)}</span>
  return <span className="text-gray-400">{fmt(n)}</span>
}

const fmtMoney = v => {
  const n = Number(v || 0)
  return n === 0
    ? <span className="text-gray-400">{fmt(0)}</span>
    : <span className="text-gray-700">{fmt(n)}</span>
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="text-gray-300 ml-1 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp size={13} className="text-primary ml-1 shrink-0" />
    : <ChevronDown size={13} className="text-primary ml-1 shrink-0" />
}

export default function Eleves() {
  const { isAdmin, isFinancier } = useAuth()
  const canEdit = isAdmin || isFinancier

  const [searchParams] = useSearchParams()
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [deleteRow, setDeleteRow] = useState(null)
  const [saving, setSaving]   = useState(false)

  // Filters & sort
  const [search, setSearch]       = useState('')
  const [filterSolde, setFilterSolde] = useState('tous')
  const [filterClasse, setFilterClasse] = useState('')
  const [sort, setSort]           = useState({ col: 'nom', dir: 'asc' })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [elevesRes, facturesRes, paiementsRes, echRes] = await Promise.all([
      supabase.from('eleves').select('*').eq('actif', true).order('nom'),
      supabase.from('factures').select('eleve_id, montant'),
      supabase.from('paiements').select('eleve_id, montant'),
      supabase.from('echelonnements').select('eleve_id, montant'),
    ])
    const eleves = elevesRes.data || []

    const sumBy = (data) => {
      const m = new Map()
      for (const r of (data || [])) {
        m.set(r.eleve_id, (m.get(r.eleve_id) || 0) + Number(r.montant || 0))
      }
      return m
    }
    const mFact = sumBy(facturesRes.data)
    const mPaie = sumBy(paiementsRes.data)
    const mEch  = sumBy(echRes.data)

    setRows(eleves.map(e => ({
      ...e,
      _factures:  mFact.get(e.id) || 0,
      _paiements: mPaie.get(e.id) || 0,
      _ech:       mEch.get(e.id)  || 0,
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    // Honour URL param from dashboard links
    const solde = searchParams.get('solde')
    if (solde === 'negatif') setFilterSolde('negatif')
    else if (solde === 'positif') setFilterSolde('positif')
    loadData()
  }, [loadData, searchParams])

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        (r.nom    || '').toLowerCase().includes(q) ||
        (r.prenom || '').toLowerCase().includes(q)
      )
    }
    if (filterClasse) d = d.filter(r => r.classe === filterClasse)
    if (filterSolde === 'negatif') d = d.filter(r => Number(r.solde || 0) < 0)
    if (filterSolde === 'positif') d = d.filter(r => Number(r.solde || 0) > 0)

    const { col, dir } = sort
    const sign = dir === 'asc' ? 1 : -1
    d = [...d].sort((a, b) => {
      const va = col.startsWith('_') ? Number(a[col] || 0) : (a[col] || '')
      const vb = col.startsWith('_') ? Number(b[col] || 0) : (b[col] || '')
      if (col === 'solde' || col.startsWith('_')) return (Number(va) - Number(vb)) * sign
      return String(va).localeCompare(String(vb), 'fr') * sign
    })
    return d
  }, [rows, search, filterClasse, filterSolde, sort])

  const classes = useMemo(() => [...new Set(rows.map(r => r.classe).filter(Boolean))].sort(), [rows])

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  // Edit
  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('eleves').update({
      nom:    editRow.nom,
      prenom: editRow.prenom,
      classe: editRow.classe,
    }).eq('id', editRow.id)
    setSaving(false)
    setEditRow(null)
    loadData()
  }

  // Delete
  const confirmDelete = async () => {
    await supabase.from('eleves').update({ actif: false }).eq('id', deleteRow.id)
    setDeleteRow(null)
    loadData()
  }

  const TH = ({ col, label, className = '' }) => (
    <th
      onClick={() => col && toggleSort(col)}
      className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase select-none
        ${col ? 'cursor-pointer hover:text-primary' : ''} ${className}`}>
      <span className="flex items-center">
        {label}
        {col && <SortIcon col={col} sort={sort} />}
      </span>
    </th>
  )

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Élèves</h1>
      <p className="text-sm text-gray-400 mb-5">Liste des élèves et leurs soldes</p>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-64 text-sm py-2"
            placeholder="Rechercher par nom, prénom…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Solde filter */}
        <select className="input text-sm py-2 pr-8" value={filterSolde} onChange={e => setFilterSolde(e.target.value)}>
          <option value="tous">Solde — Tous</option>
          <option value="negatif">Solde négatif</option>
          <option value="positif">Solde positif</option>
        </select>

        {/* Classe filter */}
        <select className="input text-sm py-2 pr-8" value={filterClasse} onChange={e => setFilterClasse(e.target.value)}>
          <option value="">Classe — Toutes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <span className="ml-auto text-sm text-gray-400">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <TH col="nom"        label="Nom"        className="w-40" />
                <TH col="prenom"     label="Prénom"     className="w-40" />
                <TH col="classe"     label="Classe"     className="w-36" />
                <TH col="solde"      label="Solde"      className="w-28 text-right" />
                <TH col="_factures"  label="Factures"   className="w-28 text-right" />
                <TH col="_paiements" label="Paiements"  className="w-28 text-right" />
                <TH col="_ech"       label="ÉCH."       className="w-24 text-right" />
                <TH col={null}       label="AS"         className="w-12 text-center" />
                <TH col={null}       label="Actions"    className="w-24 text-center" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Aucun élève</td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 font-medium text-gray-800">{row.nom}</td>
                  <td className="px-3 py-2.5 text-gray-700">{row.prenom}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{row.classe || '—'}</td>
                  <td className="px-3 py-2.5 text-right">{fmtSolde(row.solde)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtMoney(row._factures)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtMoney(row._paiements)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtMoney(row._ech)}</td>
                  <td className="px-3 py-2.5 text-center text-gray-300 text-xs">—</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setFicheId(row.id)}
                        title="Fiche élève"
                        className="text-gray-400 hover:text-primary transition-colors">
                        <Link2 size={15} />
                      </button>
                      {canEdit && (
                        <button onClick={() => setEditRow({ ...row })}
                          title="Modifier"
                          className="text-gray-400 hover:text-blue-500 transition-colors">
                          <Pencil size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setDeleteRow(row)}
                          title="Désactiver"
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fiche élève */}
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />

      {/* Modal édition */}
      {editRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-primary mb-4">Modifier l'élève</h3>
            <div className="space-y-3">
              <div><label className="label">Nom</label>
                <input className="input" value={editRow.nom || ''} onChange={e => setEditRow(r => ({ ...r, nom: e.target.value }))} />
              </div>
              <div><label className="label">Prénom</label>
                <input className="input" value={editRow.prenom || ''} onChange={e => setEditRow(r => ({ ...r, prenom: e.target.value }))} />
              </div>
              <div><label className="label">Classe</label>
                <input className="input" value={editRow.classe || ''} onChange={e => setEditRow(r => ({ ...r, classe: e.target.value }))} />
              </div>
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

      {/* Modal suppression */}
      {deleteRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-primary mb-2">Désactiver l'élève ?</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{deleteRow.nom} {deleteRow.prenom}</strong> sera marqué comme inactif (non supprimé).
            </p>
            <div className="flex gap-2">
              <button onClick={confirmDelete} className="btn-primary bg-red-600 hover:bg-red-700 flex-1 py-2 flex justify-center">
                Désactiver
              </button>
              <button onClick={() => setDeleteRow(null)} className="btn-secondary flex-1 py-2 flex justify-center">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
