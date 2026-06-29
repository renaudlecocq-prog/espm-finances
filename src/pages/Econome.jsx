import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import {
  Upload, X, Check, ChevronDown, Search, AlertTriangle, Loader2,
  RefreshCw, PlusCircle, Trash2, ChevronUp, ChevronsUpDown,
  FileText, TrendingUp, TrendingDown, Minus, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtEur = n => n == null ? '—' : Number(n).toFixed(2).replace('.', ',') + ' €'
const fmtDate = d => {
  if (!d) return '—'
  const [y, m, j] = d.split('-')
  return `${j}/${m}/${y}`
}
const MOIS_LABELS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// ── CSV parsing ───────────────────────────────────────────────────────────────
const parseBelfiusDate = s => {
  if (!s) return null
  const p = s.trim().split('/')
  if (p.length !== 3) return null
  return `${p[2]}-${p[1]}-${p[0]}`
}

const splitCsvRow = line => {
  const cols = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ';' && !inQ) { cols.push(cur.trim()); cur = '' }
    else cur += ch
  }
  cols.push(cur.trim())
  return cols
}

const parseBelfiusCompte = (text, compte) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let headerIdx = lines.findIndex(l =>
    l.includes('Date de comptabilisation') || l.includes('Numéro de séquence')
  )
  if (headerIdx === -1) headerIdx = 13

  const dataLines = lines.slice(headerIdx + 1)
  const results = []

  for (const line of dataLines) {
    const cols = splitCsvRow(line)
    if (cols.length < 9) continue

    const refOp    = cols[1]?.trim() || ''
    const dateCompta = parseBelfiusDate(cols[3])
    const libelle  = (cols[5] || '').replace(/\s+/g, ' ').trim()
    const comm     = (cols[8] || '').replace(/\s+/g, ' ').trim()
    const montantRaw = parseFloat((cols[10] || '0').replace(',', '.')) || 0
    const solde    = parseFloat((cols[9] || '0').replace(',', '.')) || null

    if (!dateCompta) continue

    const montant_entree = montantRaw > 0 ? montantRaw : null
    const montant_sortie = montantRaw < 0 ? Math.abs(montantRaw) : null
    const dateparts = dateCompta.split('-')

    results.push({
      date_operation: dateCompta,
      annee: parseInt(dateparts[0]),
      mois: parseInt(dateparts[1]),
      libelle,
      communication: comm,
      montant_entree,
      montant_sortie,
      solde_compte: solde,
      reference_belfius: refOp,
    })
  }
  return results
}

// ── NatureSelect inline ───────────────────────────────────────────────────────
function NatureSelect({ value, natures, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const grouped = natures.reduce((acc, n) => {
    if (!acc[n.categorie]) acc[n.categorie] = []
    acc[n.categorie].push(n)
    return acc
  }, {})

  const filtered = q.trim()
    ? natures.filter(n => n.libelle.toLowerCase().includes(q.toLowerCase()))
    : null

  const selected = natures.find(n => n.id === value)

  if (disabled) return (
    <span className="text-xs text-gray-500 dark:text-gray-400 italic">{selected?.libelle || '—'}</span>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setQ('') }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:border-indigo-400 bg-white dark:bg-gray-800 max-w-[180px] truncate"
      >
        <span className={`flex-1 truncate text-left ${selected ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 italic'}`}>
          {selected?.libelle || 'Choisir…'}
        </span>
        <ChevronDown size={10} className="text-gray-400 dark:text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl flex flex-col max-h-72">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left text-xs px-3 py-1.5 text-gray-400 dark:text-gray-500 italic hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              — Non classé
            </button>
            {filtered
              ? filtered.map(n => (
                <button key={n.id}
                  onClick={() => { onChange(n.id); setOpen(false) }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-indigo-50 ${value === n.id ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  {n.libelle}
                </button>
              ))
              : Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-900">
                    {cat}
                  </div>
                  {items.map(n => (
                    <button key={n.id}
                      onClick={() => { onChange(n.id); setOpen(false) }}
                      className={`w-full text-left text-xs px-4 py-1.5 hover:bg-indigo-50 ${value === n.id ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      {n.sous_categorie}
                    </button>
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Import modal ──────────────────────────────────────────────────────────────
function ImportModal({ compte, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [existingRefs, setExistingRefs] = useState(new Set())
  const dropRef = useRef()
  const { profile } = useAuth()

  useEffect(() => {
    supabase.from('comptable_transactions')
      .select('reference_belfius')
      .eq('compte', compte)
      .then(({ data }) => {
        if (data) setExistingRefs(new Set(data.map(d => d.reference_belfius).filter(Boolean)))
      })
  }, [compte])

  const parseFile = async file => {
    if (!file) return
    setFilename(file.name)
    const text = await file.text()
    const parsed = parseBelfiusCompte(text, compte)
    setRows(parsed)
    // Détecter l'année depuis les données
    if (parsed.length > 0) setAnnee(parsed[0].annee)
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    parseFile(e.dataTransfer.files[0])
  }

  const isNew = r => !existingRefs.has(r.reference_belfius)
  const newRows = rows.filter(isNew)
  const dupRows = rows.filter(r => !isNew(r))

  const handleImport = async () => {
    if (!newRows.length) return
    setLoading(true)
    try {
      // Créer l'import
      const { data: imp, error: impErr } = await supabase
        .from('comptable_imports')
        .insert({ compte, filename, annee, ligne_count: newRows.length, statut: 'pending', imported_by: profile?.id })
        .select('id').single()
      if (impErr) throw impErr

      // Insérer les transactions
      const payload = newRows.map(r => ({
        import_id: imp.id,
        compte,
        annee: r.annee,
        mois: r.mois,
        date_operation: r.date_operation,
        libelle: r.libelle,
        communication: r.communication,
        montant_entree: r.montant_entree,
        montant_sortie: r.montant_sortie,
        solde_compte: r.solde_compte,
        nature_id: null,
        created_by: profile?.id,
        ...(compte === 'eleves' && r.montant_entree ? { statut_paiement: 'pending' } : {}),
      }))

      // Insérer par lots de 200
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200)
        const { error } = await supabase.from('comptable_transactions').insert(chunk)
        if (error) throw error
      }

      onImported(newRows.length)
    } catch (err) {
      console.error(err)
      alert('Erreur import : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
              Import CSV — {compte === 'fonctionnement' ? 'Fonctionnement' : 'Élèves'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fichier d'export Belfius (.csv)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            onClick={() => document.getElementById('csv-input').click()}
          >
            <Upload size={28} className="mx-auto text-gray-400 dark:text-gray-500 mb-2" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {filename || 'Glisser le CSV ou cliquer pour choisir'}
            </p>
            {filename && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{rows.length} lignes lues</p>}
            <input id="csv-input" type="file" accept=".csv" className="hidden"
              onChange={e => parseFile(e.target.files[0])} />
          </div>

          {/* Stats + aperçu */}
          {rows.length > 0 && (
            <>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 dark:bg-green-950 rounded-lg px-4 py-3">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Nouvelles lignes</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{newRows.length}</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Déjà importées</p>
                  <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">{dupRows.length}</p>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Année détectée</p>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{annee}</p>
                </div>
              </div>

              {/* Aperçu 5 premières lignes nouvelles */}
              {newRows.length > 0 && (
                <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Libellé</th>
                        <th className="text-right px-3 py-2">Entrée</th>
                        <th className="text-right px-3 py-2">Sortie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newRows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-gray-50 dark:border-gray-800">
                          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{fmtDate(r.date_operation)}</td>
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-200 max-w-[200px] truncate">{r.libelle || r.communication || '—'}</td>
                          <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400 font-medium">{r.montant_entree ? fmtEur(r.montant_entree) : ''}</td>
                          <td className="px-3 py-1.5 text-right text-red-500 dark:text-red-400 font-medium">{r.montant_sortie ? fmtEur(r.montant_sortie) : ''}</td>
                        </tr>
                      ))}
                      {newRows.length > 8 && (
                        <tr className="border-t border-gray-50 dark:border-gray-800">
                          <td colSpan={4} className="px-3 py-2 text-center text-gray-400 dark:text-gray-500 italic">
                            + {newRows.length - 8} autres lignes…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={!newRows.length || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Importer {newRows.length > 0 ? `${newRows.length} lignes` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Transaction table ─────────────────────────────────────────────────────────
function TransactionTable({ transactions, natures, compte, onNatureChange, onDelete, selected, setSelected }) {
  const [sort, setSort] = useState({ col: 'date_operation', dir: 'desc' })

  const allIds = transactions.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }
  const toggleOne = id => setSelected(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const toggleSort = col => setSort(s =>
    s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }
  )

  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 dark:text-gray-600 ml-0.5" />
    return sort.dir === 'asc'
      ? <ChevronUp size={11} className="text-indigo-500 dark:text-indigo-400 ml-0.5" />
      : <ChevronDown size={11} className="text-indigo-500 dark:text-indigo-400 ml-0.5" />
  }

  const sorted = [...transactions].sort((a, b) => {
    let va = a[sort.col] ?? '', vb = b[sort.col] ?? ''
    if (sort.col === 'montant_entree' || sort.col === 'montant_sortie') {
      va = Number(va) || 0; vb = Number(vb) || 0
    }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sort.dir === 'asc' ? cmp : -cmp
  })

  if (!sorted.length) return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
      <FileText size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
      <p className="text-sm">Aucune transaction pour cette période</p>
      <p className="text-xs mt-1">Importez un CSV Belfius pour commencer</p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-100 dark:border-gray-700">
            {/* Checkbox select all */}
            <th className="w-8 px-2 py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleAll}
                className="rounded border-gray-300 dark:border-gray-500 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 cursor-pointer"
              />
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer whitespace-nowrap"
              onClick={() => toggleSort('date_operation')}>
              Date <SortIcon col="date_operation" />
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Libellé / Communication</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[180px]">Nature comptable</th>
            {compte === 'eleves' && (
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Statut</th>
            )}
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer"
              onClick={() => toggleSort('montant_entree')}>
              Entrée <SortIcon col="montant_entree" />
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer"
              onClick={() => toggleSort('montant_sortie')}>
              Sortie <SortIcon col="montant_sortie" />
            </th>
            <th className="w-8 px-2 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tx, i) => (
            <tr key={tx.id || i}
              onClick={() => tx.id && toggleOne(tx.id)}
              className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 transition-colors cursor-pointer
                ${selected.has(tx.id) ? 'bg-indigo-50/60' : tx.confirme ? '' : 'bg-amber-50/30'}`}
            >
              <td className="w-8 px-2 py-2.5" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(tx.id)}
                  onChange={() => toggleOne(tx.id)}
                  className="rounded border-gray-300 dark:border-gray-500 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 cursor-pointer"
                />
              </td>
              <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                {fmtDate(tx.date_operation)}
              </td>
              <td className="px-3 py-2.5 max-w-xs">
                <p className="text-gray-800 dark:text-gray-100 truncate text-xs font-medium">{tx.libelle || '—'}</p>
                {tx.communication && (
                  <p className="text-gray-400 dark:text-gray-500 truncate text-[11px]">{tx.communication}</p>
                )}
              </td>
              <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                <NatureSelect
                  value={tx.nature_id}
                  natures={natures}
                  onChange={natureId => onNatureChange(tx.id, natureId)}
                />
              </td>
              {compte === 'eleves' && (
                <td className="px-3 py-2.5 text-center">
                  {tx.statut_paiement === 'imported' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                      <Check size={9} /> Importé
                    </span>
                  )}
                  {tx.statut_paiement === 'pending' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full">
                      En attente
                    </span>
                  )}
                  {tx.statut_paiement === 'ignored' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                      Ignoré
                    </span>
                  )}
                </td>
              )}
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {tx.montant_entree ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold text-xs">{fmtEur(tx.montant_entree)}</span>
                ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {tx.montant_sortie ? (
                  <span className="text-red-500 dark:text-red-400 font-semibold text-xs">{fmtEur(tx.montant_sortie)}</span>
                ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
              </td>
              <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onDelete(tx.id)}
                  className="p-1 hover:bg-red-50 rounded text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ transactions, compte, selected, bulkNature, setBulkNature, applyBulk, deselectAll, natures }) {
  const totalEntree = transactions.reduce((s, t) => s + Number(t.montant_entree || 0), 0)
  const totalSortie = transactions.reduce((s, t) => s + Number(t.montant_sortie || 0), 0)
  const solde = totalEntree - totalSortie
  const nonClasses = transactions.filter(t => !t.nature_id).length

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-lg px-4 py-2.5 min-w-[150px]">
        <TrendingUp size={16} className="text-green-500 dark:text-green-400 shrink-0" />
        <div>
          <p className="text-[10px] text-green-600 dark:text-green-400 font-medium uppercase tracking-wide">Entrées</p>
          <p className="text-sm font-bold text-green-700 dark:text-green-300">{fmtEur(totalEntree)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-2.5 min-w-[150px]">
        <TrendingDown size={16} className="text-red-400 dark:text-red-300 shrink-0" />
        <div>
          <p className="text-[10px] text-red-500 dark:text-red-400 font-medium uppercase tracking-wide">Sorties</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtEur(totalSortie)}</p>
        </div>
      </div>
      <div className={`flex items-center gap-2.5 border rounded-lg px-4 py-2.5 min-w-[150px]
        ${solde >= 0 ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-100 dark:border-indigo-900' : 'bg-orange-50 dark:bg-orange-950 border-orange-100'}`}>
        <Minus size={16} className={solde >= 0 ? 'text-indigo-500 dark:text-indigo-400' : 'text-orange-500 dark:text-orange-400'} />
        <div>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${solde >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>Solde</p>
          <p className={`text-sm font-bold ${solde >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-orange-600 dark:text-orange-400'}`}>{fmtEur(solde)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-4 py-2.5">
        <FileText size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
        <div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Transactions</p>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{transactions.length}</p>
        </div>
      </div>
      {nonClasses > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950 border border-amber-100 rounded-lg px-4 py-2.5">
          <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Non classé</p>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{nonClasses}</p>
          </div>
        </div>
      )}

      {/* ── Bulk action (inline) ── */}
      {selected && selected.size > 0 && (
        <>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 self-center mx-1" />
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
              {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
            </span>
            <div className="w-44">
              <NatureSelect value={bulkNature} natures={natures} onChange={setBulkNature} />
            </div>
            <button
              onClick={applyBulk}
              disabled={!bulkNature}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg
                hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Check size={11} /> Appliquer ({selected.size})
            </button>
            <button
              onClick={deselectAll}
              className="p-1 hover:bg-indigo-100 rounded text-indigo-400 dark:text-indigo-300 hover:text-indigo-600"
              title="Désélectionner tout"
            >
              <X size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab content ───────────────────────────────────────────────────────────────
function CompteTab({ compte, natures }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [bulkNature, setBulkNature] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [moisFilter, setMoisFilter] = useState(0) // 0 = tous
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('comptable_transactions')
      .select('*')
      .eq('compte', compte)
      .eq('annee', annee)
      .order('date_operation', { ascending: false })

    if (moisFilter > 0) q = q.eq('mois', moisFilter)
    const { data, error } = await q
    if (!error) setTransactions(data || [])
    setLoading(false)
  }, [compte, annee, moisFilter])

  useEffect(() => { load() }, [load])

  const handleNatureChange = async (txId, natureId) => {
    const nature = natures.find(n => n.id === natureId)
    await supabase.from('comptable_transactions')
      .update({ nature_id: natureId, nature_libelle: nature?.libelle || null })
      .eq('id', txId)
    setTransactions(prev => prev.map(t =>
      t.id === txId ? { ...t, nature_id: natureId, nature_libelle: nature?.libelle } : t
    ))
  }

  const handleDelete = async txId => {
    if (!confirm('Supprimer cette transaction ?')) return
    await supabase.from('comptable_transactions').delete().eq('id', txId)
    setTransactions(prev => prev.filter(t => t.id !== txId))
  }

  const handleBulkNatureChange = async (ids, natureId) => {
    const nature = natures.find(n => n.id === natureId)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      await supabase.from('comptable_transactions')
        .update({ nature_id: natureId, nature_libelle: nature?.libelle || null })
        .in('id', chunk)
    }
    setTransactions(prev => prev.map(t =>
      ids.includes(t.id) ? { ...t, nature_id: natureId, nature_libelle: nature?.libelle } : t
    ))
    setSelected(new Set())
    setBulkNature(null)
  }

  const applyBulk = () => handleBulkNatureChange([...selected], bulkNature)
  const deselectAll = () => { setSelected(new Set()); setBulkNature(null) }

  const filtered = useMemo(() => transactions.filter(t => {
    if (pendingOnly && t.statut_paiement !== 'pending') return false
    if (!search) return true
    const s = search.toLowerCase()
    return (t.libelle || '').toLowerCase().includes(s)
      || (t.communication || '').toLowerCase().includes(s)
      || (t.nature_libelle || '').toLowerCase().includes(s)
  }), [transactions, pendingOnly, search])

  const anneOptions = []
  for (let y = 2024; y <= new Date().getFullYear() + 1; y++) anneOptions.push(y)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Année */}
        <select
          value={annee}
          onChange={e => setAnnee(Number(e.target.value))}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
        >
          {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Mois */}
        <select
          value={moisFilter}
          onChange={e => setMoisFilter(Number(e.target.value))}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
        >
          <option value={0}>Tous les mois</option>
          {MOIS_LABELS.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher libellé, communication…"
            className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-indigo-400"
          />
        </div>

        {compte === 'eleves' && (
          <button
            onClick={() => setPendingOnly(!pendingOnly)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${pendingOnly
              ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 text-amber-700 dark:text-amber-300 font-medium'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            En attente seulement
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        <button onClick={load} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400" title="Actualiser">
          <RefreshCw size={15} />
        </button>
        <button
          onClick={() => {
            const label = compte === 'fonctionnement' ? 'Fonctionnement' : 'Eleves'
            const header = ['Date', 'Libellé', 'Nature', 'Catégorie', 'Entrée (€)', 'Sortie (€)', 'Solde cumulé (€)']
            let solde = 0
            const rows = [header, ...filtered.map(t => {
              const e = Number(t.montant_entree || 0), s = Number(t.montant_sortie || 0)
              solde += e - s
              const nat = natures.find(n => n.id === t.nature_id)
              return [
                t.date_operation || '', t.libelle || '', t.nature_libelle || '',
                nat?.categorie || '', e || '', s || '', Math.round(solde * 100) / 100
              ]
            })]
            exportToExcel(rows, `ESPM_${label}_${annee}.xlsx`)
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          title="Exporter en Excel"
        >
          <Download size={13} /> Excel
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Upload size={15} /> Importer CSV
        </button>
      </div>

      {/* Summary */}
      {!loading && (
        <SummaryBar
          transactions={filtered}
          compte={compte}
          selected={selected}
          bulkNature={bulkNature}
          setBulkNature={setBulkNature}
          applyBulk={applyBulk}
          deselectAll={deselectAll}
          natures={natures}
        />
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400 dark:text-gray-500">
            <Loader2 size={18} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <TransactionTable
            transactions={filtered}
            natures={natures}
            compte={compte}
            onNatureChange={handleNatureChange}
            onDelete={handleDelete}
            selected={selected}
            setSelected={setSelected}
          />
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          compte={compte}
          onClose={() => setShowImport(false)}
          onImported={count => {
            setShowImport(false)
            load()
            alert(`${count} transactions importées avec succès.`)
          }}
        />
      )}
    </div>
  )
}

// ── Placeholder tab ───────────────────────────────────────────────────────────
function PlaceholderTab({ label, icon, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-600 dark:text-gray-300 mb-1">{label}</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">{desc}</p>
      <span className="mt-3 text-xs font-medium px-3 py-1 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 rounded-full">
        En développement
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { key: 'fonctionnement', label: 'Fonctionnement' },
  { key: 'eleves',         label: 'Élèves' },
  { key: 'pop',            label: 'POP' },
  { key: 'bilan',          label: 'Bilan' },
  { key: 'projets',        label: 'Projets' },
]

export default function Econome() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('fonctionnement')
  const [natures, setNatures] = useState([])

  useEffect(() => {
    supabase.from('comptable_natures')
      .select('*')
      .eq('actif', true)
      .order('position')
      .then(({ data }) => { if (data) setNatures(data) })
  }, [])

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      Accès réservé à l'administrateur
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Comptes"
        subtitle="Suivi comptable — Fonctionnement, Élèves, POP, Bilan, Projets"
        tabs={TABS.map(t => ({ key: t.key, label: t.label }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'fonctionnement' && (
          <CompteTab compte="fonctionnement" natures={natures} />
        )}
        {activeTab === 'eleves' && (
          <CompteTab compte="eleves" natures={natures} />
        )}
        {activeTab === 'pop' && <PopTab natures={natures} />}
        {activeTab === 'bilan' && <BilanTab natures={natures} />}
        {activeTab === 'projets' && <ProjetsTab />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Tab POP — Notes de frais / Factures transmises au POP
// ══════════════════════════════════════════════════════════
function PopTab({ natures }) {
  const { profile } = useAuth()
  const [lignes, setLignes] = useState([])
  const [loading, setLoading] = useState(true)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [moisFilter, setMoisFilter] = useState(0)
  const [editItem, setEditItem] = useState(null)   // null | 'new' | ligne object
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const chargesNatures = natures.filter(n => n.type_flux === 'charge' || n.type_flux === 'neutre')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('comptable_pop_lignes')
      .select('*')
      .eq('annee', annee)
      .order('date_transmission', { ascending: false })
    if (moisFilter > 0) q = q.eq('mois', moisFilter)
    const { data } = await q
    setLignes(data || [])
    setLoading(false)
  }, [annee, moisFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => lignes.filter(l => {
    if (!search) return true
    const s = search.toLowerCase()
    return (l.fournisseur || '').toLowerCase().includes(s)
      || (l.numero_piece || '').toLowerCase().includes(s)
      || (l.nature_libelle || '').toLowerCase().includes(s)
      || (l.commentaire || '').toLowerCase().includes(s)
  }), [lignes, search])

  const totalMontant = filtered.reduce((s, l) => s + Number(l.montant || 0), 0)
  const nonClasses = filtered.filter(l => !l.nature_id).length

  const saveLigne = async form => {
    setSaving(true)
    const nature = natures.find(n => n.id === form.nature_id)
    const dateparts = form.date_transmission.split('-')
    const payload = {
      annee: parseInt(dateparts[0]),
      mois: parseInt(dateparts[1]),
      date_transmission: form.date_transmission,
      fournisseur: form.fournisseur || null,
      numero_piece: form.numero_piece || null,
      nature_id: form.nature_id || null,
      nature_libelle: nature?.libelle || null,
      montant: parseFloat(form.montant) || 0,
      commentaire: form.commentaire || null,
      created_by: profile?.id,
    }
    if (form.id) {
      await supabase.from('comptable_pop_lignes').update(payload).eq('id', form.id)
    } else {
      await supabase.from('comptable_pop_lignes').insert(payload)
    }
    setSaving(false)
    setEditItem(null)
    load()
  }

  const deleteLigne = async id => {
    if (!confirm('Supprimer cette ligne ?')) return
    await supabase.from('comptable_pop_lignes').delete().eq('id', id)
    setLignes(prev => prev.filter(l => l.id !== id))
  }

  const anneOptions = []
  for (let y = 2024; y <= new Date().getFullYear() + 1; y++) anneOptions.push(y)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
          className="text-sm text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:border-indigo-400">
          {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={moisFilter} onChange={e => setMoisFilter(Number(e.target.value))}
          className="text-sm text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:border-indigo-400">
          <option value={0}>Tous les mois</option>
          {MOIS_LABELS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher fournisseur, pièce, nature…"
            className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="flex-1" />
        <button onClick={load} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
          <RefreshCw size={15} />
        </button>
        <button
          onClick={() => {
            const header = ['Date', 'Fournisseur', 'N° pièce', 'Nature', 'Catégorie', 'Montant (€)', 'Solde cumulé (€)']
            let solde = 0
            const rows = [header, ...filtered.map(l => {
              solde -= Number(l.montant || 0)
              const nat = chargesNatures.find(n => n.id === l.nature_id)
              return [
                l.date_transmission || '', l.fournisseur || '', l.numero_piece || '',
                l.nature_libelle || '', nat?.categorie || '',
                Number(l.montant || 0), Math.round(solde * 100) / 100
              ]
            })]
            exportToExcel(rows, `ESPM_POP_${annee}.xlsx`)
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          title="Exporter en Excel"
        >
          <Download size={13} /> Excel
        </button>
        <button
          onClick={() => setEditItem({
            date_transmission: new Date().toISOString().slice(0,10),
            fournisseur: '', numero_piece: '', nature_id: null, montant: '', commentaire: ''
          })}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <PlusCircle size={15} /> Ajouter une ligne
        </button>
      </div>

      {/* Barre de synthèse */}
      {!loading && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-2.5">
            <TrendingDown size={16} className="text-red-400 dark:text-red-300 shrink-0" />
            <div>
              <p className="text-[10px] text-red-500 dark:text-red-400 font-medium uppercase tracking-wide">Total transmis au POP</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtEur(totalMontant)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-4 py-2.5">
            <FileText size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Lignes</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{filtered.length}</p>
            </div>
          </div>
          {nonClasses > 0 && (
            <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950 border border-amber-100 rounded-lg px-4 py-2.5">
              <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Non classé</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{nonClasses}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400 dark:text-gray-500">
            <Loader2 size={18} className="animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <FileText size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">Aucune note de frais pour cette période</p>
            <p className="text-xs mt-1">Cliquez sur "Ajouter une ligne" pour encoder une facture</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Fournisseur</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">N° pièce</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[180px]">Nature comptable</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Montant</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Commentaire</th>
                <th className="w-16 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(l.date_transmission)}</td>
                  <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100 text-xs font-medium max-w-[160px] truncate">{l.fournisseur || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{l.numero_piece || '—'}</td>
                  <td className="px-3 py-2.5">
                    <NatureSelect
                      value={l.nature_id}
                      natures={natures}
                      onChange={async natureId => {
                        const nature = natures.find(n => n.id === natureId)
                        await supabase.from('comptable_pop_lignes')
                          .update({ nature_id: natureId, nature_libelle: nature?.libelle || null })
                          .eq('id', l.id)
                        setLignes(prev => prev.map(x => x.id === l.id
                          ? { ...x, nature_id: natureId, nature_libelle: nature?.libelle }
                          : x))
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="text-red-500 dark:text-red-400 font-semibold text-xs">{fmtEur(l.montant)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 dark:text-gray-500 text-xs max-w-[200px] truncate">{l.commentaire || ''}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditItem({ ...l })}
                        className="p-1.5 hover:bg-indigo-50 rounded text-gray-300 dark:text-gray-600 hover:text-indigo-500 transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteLigne(l.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal ajout/édition */}
      {editItem && (
        <PopLigneModal
          item={editItem}
          natures={natures}
          saving={saving}
          onSave={saveLigne}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  )
}

function PopLigneModal({ item, natures, saving, onSave, onClose }) {
  const [form, setForm] = useState({ ...item })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            {item.id ? 'Modifier' : 'Nouvelle'} note de frais / facture POP
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date de transmission *</label>
              <input type="date" value={form.date_transmission}
                onChange={e => set('date_transmission', e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">N° pièce / référence</label>
              <input value={form.numero_piece || ''} onChange={e => set('numero_piece', e.target.value)}
                placeholder="ex: FAC-2026-001"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Fournisseur</label>
            <input value={form.fournisseur || ''} onChange={e => set('fournisseur', e.target.value)}
              placeholder="Nom du fournisseur ou prestataire"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nature comptable</label>
              <NatureSelect value={form.nature_id} natures={natures} onChange={v => set('nature_id', v)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Montant (€) *</label>
              <input type="number" step="0.01" min="0" value={form.montant || ''}
                onChange={e => set('montant', e.target.value)}
                placeholder="0.00"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Commentaire</label>
            <textarea value={form.commentaire || ''} onChange={e => set('commentaire', e.target.value)}
              rows={2} placeholder="Description, contexte…"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.date_transmission || !form.montant || saving}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : (item.id ? 'Enregistrer' : 'Ajouter')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Tab Bilan — Tableau croisé Produits / Charges par mois
// ══════════════════════════════════════════════════════════

const MOIS_FULL = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// ══════════════════════════════════════════════════════════
//  Tab Bilan — Vue Couverture élèves + Vue Générale
// ══════════════════════════════════════════════════════════
function BilanTab({ natures }) {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [innerTab, setInnerTab] = useState('couverture')  // 'couverture' | 'general'

  // Map nature_id → nature object (inclut in_couverture)
  const naturesMap = useMemo(() => {
    const m = {}
    for (const n of natures) m[n.id] = n
    return m
  }, [natures])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: txs }, { data: pop }] = await Promise.all([
      supabase.from('comptable_transactions')
        .select('date_operation, nature_id, nature_libelle, montant_entree, montant_sortie')
        .gte('date_operation', `${annee}-01-01`)
        .lte('date_operation', `${annee}-12-31`),
      supabase.from('comptable_pop_lignes')
        .select('date_transmission, nature_id, nature_libelle, montant')
        .eq('annee', annee),
    ])

    const agg = {}
    let nonClasses = 0

    const ensureNature = (nature_id, nature_libelle) => {
      if (!agg[nature_id]) {
        const nat = naturesMap[nature_id]
        agg[nature_id] = {
          libelle: nat?.libelle || nature_libelle || nature_id,
          categorie: nat?.categorie || '—',
          type_flux: nat?.type_flux || 'neutre',
          in_couverture: nat?.in_couverture || false,
          mois: Array(13).fill(0),
        }
      }
      return agg[nature_id]
    }

    for (const tx of (txs || [])) {
      if (!tx.nature_id) { nonClasses++; continue }
      const nat = naturesMap[tx.nature_id]
      if (!nat || nat.type_flux === 'neutre') continue
      const m = parseInt((tx.date_operation || '').split('-')[1]) || 0
      if (m < 1 || m > 12) continue
      const entry = ensureNature(tx.nature_id, tx.nature_libelle)
      if (nat.type_flux === 'produit') {
        entry.mois[m] += Number(tx.montant_entree || 0)
      } else {
        entry.mois[m] += Number(tx.montant_sortie || 0)
      }
    }

    for (const pl of (pop || [])) {
      if (!pl.nature_id) { nonClasses++; continue }
      const nat = naturesMap[pl.nature_id]
      if (!nat || nat.type_flux === 'neutre') continue
      const m = parseInt((pl.date_transmission || '').split('-')[1]) || 0
      if (m < 1 || m > 12) continue
      const entry = ensureNature(pl.nature_id, pl.nature_libelle)
      entry.mois[m] += Number(pl.montant || 0)
    }

    for (const e of Object.values(agg)) {
      e.total = e.mois.slice(1).reduce((s, v) => s + v, 0)
    }

    const sortFn = arr => arr.sort((a, b) =>
      a.categorie.localeCompare(b.categorie) || a.libelle.localeCompare(b.libelle)
    )
    setData({
      produits:  sortFn(Object.values(agg).filter(e => e.type_flux === 'produit')),
      charges:   sortFn(Object.values(agg).filter(e => e.type_flux === 'charge')),
      couverture: sortFn(Object.values(agg).filter(e => e.type_flux === 'charge' && e.in_couverture)),
      nonClasses,
    })
    setLoading(false)
  }, [annee, naturesMap])

  useEffect(() => { load() }, [load])

  const moisActifs = useMemo(() => {
    if (!data) return []
    const all = [...(data.produits || []), ...(data.charges || [])]
    return Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({
      m, hasData: all.some(e => e.mois[m] !== 0)
    }))
  }, [data])

  const anneOptions = []
  for (let y = 2024; y <= new Date().getFullYear() + 1; y++) anneOptions.push(y)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
          className="text-sm text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:border-indigo-400">
          {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 dark:text-gray-500">
          <RefreshCw size={15} />
        </button>
        <button
          onClick={() => {
            const win = window.open('', '_blank')
            supabase.auth.getSession().then(({ data: { session } }) => {
              const token = session?.access_token
              if (!token) { win?.close(); return }
              if (win) win.location.href = `/.netlify/functions/econome-bilan-pdf?annee=${annee}&token=${encodeURIComponent(token)}`
            })
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <FileText size={13} /> PDF Bilan
        </button>
        {/* Inner tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 ml-2">
          {[
            { key: 'couverture', label: 'Couverture élèves' },
            { key: 'general',    label: 'Vue générale' },
          ].map(t => (
            <button key={t.key} onClick={() => setInnerTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                innerTab === t.key
                  ? 'bg-white dark:bg-gray-800 text-indigo-700 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {data?.nonClasses > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-100 rounded-lg px-3 py-1.5">
            <AlertTriangle size={13} />
            {data.nonClasses} transaction{data.nonClasses > 1 ? 's' : ''} sans nature — non comptabilisée{data.nonClasses > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400 dark:text-gray-500">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : !data ? null : innerTab === 'couverture' ? (
        <VueCouverture data={data} moisActifs={moisActifs} annee={annee} />
      ) : (
        <VueGenerale data={data} moisActifs={moisActifs} annee={annee} />
      )}
    </div>
  )
}


// ── Composant graphiques Bilan (partagé entre Couverture et Général) ──────────
function BilanCharts({ chartData, barKeys, colors, title }) {
  const [show, setShow] = useState(false)
  if (!chartData || chartData.every(d => !d.val1 && !d.val2)) return null

  const fmtTooltip = v => Number(v).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  // Solde cumulé
  let cumul = 0
  const dataWithCumul = chartData.map(d => {
    cumul += (d.val2 || 0) - (d.val1 || 0)
    return { ...d, cumul: Math.round(cumul * 100) / 100 }
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setShow(s => !s)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-400 dark:text-indigo-300" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
        </div>
        <ChevronDown size={15} className={`text-gray-400 dark:text-gray-500 transition-transform ${show ? 'rotate-180' : ''}`} />
      </button>

      {show && (
        <div className="px-4 pb-5 space-y-6">
          {/* Barres groupées */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 font-medium">Comparaison mensuelle</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                barCategoryGap="30%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v} />
                <Tooltip formatter={fmtTooltip} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="val1" name={barKeys[0]} fill={colors[0]} radius={[3,3,0,0]} />
                <Bar dataKey="val2" name={barKeys[1]} fill={colors[1]} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Courbe solde cumulé */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 font-medium">Évolution du solde cumulé</p>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={dataWithCumul} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v >= -1000 ? v : (v/1000).toFixed(1)+'k'} />
                <Tooltip formatter={fmtTooltip} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="cumul" name="Solde cumulé"
                  fill={colors[2] + '22'} stroke={colors[2]} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cumul" stroke={colors[2]} strokeWidth={2}
                  dot={{ r: 3, fill: colors[2] }} activeDot={{ r: 5 }} name="Solde cumulé" legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vue Couverture élèves ─────────────────────────────────────────────────────
function VueCouverture({ data, moisActifs, annee }) {
  const { produits, couverture } = data

  const totalDepMois  = m => couverture.reduce((s, e) => s + e.mois[m], 0)
  const totalEncMois  = m => produits.reduce((s, e) => s + e.mois[m], 0)
  const soldeMois     = m => totalEncMois(m) - totalDepMois(m)

  const totalDepAnnee = couverture.reduce((s, e) => s + e.total, 0)
  const totalEncAnnee = produits.reduce((s, e) => s + e.total, 0)
  const soldeAnnee    = totalEncAnnee - totalDepAnnee

  if (couverture.length === 0 && produits.length === 0) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-16 text-center text-gray-400 dark:text-gray-500">
      <p className="font-medium">Aucune donnée pour {annee}</p>
      <p className="text-xs mt-1">Importez des transactions et classez-les avec une nature comptable.</p>
    </div>
  )

  // Grouper les dépenses par catégorie
  const catsDep = {}
  for (const e of couverture) {
    if (!catsDep[e.categorie]) catsDep[e.categorie] = []
    catsDep[e.categorie].push(e)
  }

  return (
    <div className="space-y-4">
      {/* Carte récap */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-xl px-5 py-4">
          <p className="text-[11px] text-red-500 dark:text-red-400 font-semibold uppercase tracking-wide mb-1">Total dépenses élèves</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmtEur(totalDepAnnee)}</p>
          <p className="text-[11px] text-red-400 dark:text-red-300 mt-1">{couverture.length} natures · {Object.keys(catsDep).length} catégories</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-xl px-5 py-4">
          <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide mb-1">Total encaissé élèves</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmtEur(totalEncAnnee)}</p>
          <p className="text-[11px] text-green-500 dark:text-green-400 mt-1">{produits.length} nature{produits.length > 1 ? 's' : ''}</p>
        </div>
        <div className={`rounded-xl px-5 py-4 border ${
          soldeAnnee >= 0
            ? 'bg-indigo-50 border-indigo-100 dark:border-indigo-900'
            : 'bg-amber-50 dark:bg-amber-950 border-amber-100'
        }`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${soldeAnnee >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {soldeAnnee >= 0 ? '✓ Avance' : '⚠ Découvert'}
          </p>
          <p className={`text-xl font-bold ${soldeAnnee >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {soldeAnnee >= 0 ? '+' : ''}{fmtEur(soldeAnnee)}
          </p>
          <p className={`text-[11px] mt-1 ${soldeAnnee >= 0 ? 'text-indigo-400' : 'text-amber-500 dark:text-amber-400'}`}>
            {soldeAnnee >= 0
              ? 'Encaissements > dépenses'
              : 'Dépenses > encaissements'}
          </p>
        </div>
      </div>

      {/* Tableau mensuel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100 dark:border-gray-700">
              <th className="sticky left-0 bg-white dark:bg-gray-800 text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 min-w-[220px] z-10">
                Nature comptable
              </th>
              {moisActifs.map(({ m, hasData }) => (
                <th key={m} className={`px-2 py-3 text-right text-xs font-semibold w-24 ${hasData ? 'text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                  {MOIS_LABELS[m]}
                </th>
              ))}
              <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 border-l border-gray-100 dark:border-gray-700 w-28">
                Total {annee}
              </th>
            </tr>
          </thead>
          <tbody>

            {/* ── DÉPENSES ÉLÈVES ── */}
            <tr className="bg-red-50 dark:bg-red-950 border-b border-red-100 dark:border-red-900">
              <td colSpan={moisActifs.length + 2}
                className="sticky left-0 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                Dépenses élèves
              </td>
            </tr>
            {Object.entries(catsDep).map(([cat, lignes]) => (
              <BilanSection key={cat} categorie={cat} lignes={lignes}
                moisActifs={moisActifs} colorClass="text-red-500 dark:text-red-400" negative />
            ))}
            <tr className="border-t-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50">
              <td className="sticky left-0 bg-red-50/50 dark:bg-red-950/50 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 z-10">TOTAL DÉPENSES</td>
              {moisActifs.map(({ m }) => (
                <td key={m} className="px-2 py-2.5 text-right text-xs font-bold tabular-nums text-red-500 dark:text-red-400">
                  {totalDepMois(m) ? <>−{fmtEur(totalDepMois(m))}</> : <span className="text-gray-200 dark:text-gray-700">—</span>}
                </td>
              ))}
              <td className="px-2 py-2.5 text-right text-xs font-bold text-red-600 dark:text-red-400 border-l border-gray-100 dark:border-gray-700 tabular-nums">
                −{fmtEur(totalDepAnnee)}
              </td>
            </tr>

            {/* ── ENCAISSEMENTS ÉLÈVES ── */}
            <tr className="bg-green-50 dark:bg-green-950 border-t-4 border-gray-100 dark:border-gray-700 border-b border-green-100 dark:border-green-900">
              <td colSpan={moisActifs.length + 2}
                className="sticky left-0 px-4 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">
                Encaissements élèves
              </td>
            </tr>
            {(() => {
              const cats = {}
              for (const e of produits) {
                if (!cats[e.categorie]) cats[e.categorie] = []
                cats[e.categorie].push(e)
              }
              return Object.entries(cats).map(([cat, lignes]) => (
                <BilanSection key={cat} categorie={cat} lignes={lignes}
                  moisActifs={moisActifs} colorClass="text-green-600 dark:text-green-400" />
              ))
            })()}
            <tr className="border-t-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50">
              <td className="sticky left-0 bg-green-50/50 dark:bg-green-950/50 px-4 py-2.5 text-xs font-bold text-green-700 dark:text-green-300 z-10">TOTAL ENCAISSEMENTS</td>
              {moisActifs.map(({ m }) => (
                <td key={m} className="px-2 py-2.5 text-right text-xs font-bold tabular-nums text-green-600 dark:text-green-400">
                  {totalEncMois(m) ? fmtEur(totalEncMois(m)) : <span className="text-gray-200 dark:text-gray-700">—</span>}
                </td>
              ))}
              <td className="px-2 py-2.5 text-right text-xs font-bold text-green-700 dark:text-green-300 border-l border-gray-100 dark:border-gray-700 tabular-nums">
                {fmtEur(totalEncAnnee)}
              </td>
            </tr>

            {/* ── SOLDE ── */}
            <tr className="border-t-4 border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-900">
              <td className="sticky left-0 bg-gray-50 dark:bg-gray-900 px-4 py-3 z-10">
                <div className="text-xs font-bold text-gray-800 dark:text-gray-100">SOLDE COUVERTURE {annee}</div>
                <div className={`text-[10px] font-semibold mt-0.5 ${soldeAnnee >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {soldeAnnee >= 0 ? '✓ Avance' : '⚠ Découvert'}
                </div>
              </td>
              {moisActifs.map(({ m }) => {
                const s = soldeMois(m)
                return (
                  <td key={m} className={`px-2 py-3 text-right text-xs font-bold tabular-nums whitespace-nowrap
                    ${s > 0 ? 'text-indigo-600' : s < 0 ? 'text-amber-600' : 'text-gray-200 dark:text-gray-700'}`}>
                    {s !== 0 ? <>{s > 0 ? '+' : '−'}{fmtEur(Math.abs(s))}</> : '—'}
                  </td>
                )
              })}
              <td className={`px-2 py-3 text-right text-sm font-extrabold border-l border-gray-200 dark:border-gray-600 tabular-nums
                ${soldeAnnee >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {soldeAnnee >= 0 ? '+' : '−'}{fmtEur(Math.abs(soldeAnnee))}
              </td>
            </tr>

          </tbody>
        </table>
      </div>
      {/* Graphiques couverture */}
      <BilanCharts
        chartData={moisActifs.map(({ m }) => ({
          mois: MOIS_LABELS[m],
          val1: Math.round(totalDepMois(m) * 100) / 100,
          val2: Math.round(totalEncMois(m) * 100) / 100,
        }))}
        barKeys={['Dépenses élèves', 'Encaissements']}
        colors={['#f87171', '#4ade80', '#6366f1']}
        title="Graphiques — Couverture élèves"
      />
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        * Les charges non marquées "couverture élèves" (Achats divers, Entretien, etc.) n'apparaissent pas dans cette vue.
        Consultez la <button className="underline hover:text-gray-600 dark:hover:text-gray-300" onClick={() => {}}>Vue générale</button> pour le tableau complet.
      </p>
    </div>
  )
}

// ── Vue Générale ──────────────────────────────────────────────────────────────
function VueGenerale({ data, moisActifs, annee }) {
  const { produits, charges } = data

  const totalProduitsMois = m => produits.reduce((s, e) => s + e.mois[m], 0)
  const totalChargesMois  = m => charges.reduce((s, e) => s + e.mois[m], 0)
  const soldeMois         = m => totalProduitsMois(m) - totalChargesMois(m)
  const totalProduitsAnnee = produits.reduce((s, e) => s + e.total, 0)
  const totalChargesAnnee  = charges.reduce((s, e) => s + e.total, 0)
  const soldeAnnee = totalProduitsAnnee - totalChargesAnnee

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-100 dark:border-gray-700">
            <th className="sticky left-0 bg-white dark:bg-gray-800 text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 min-w-[220px] z-10">
              Nature comptable
            </th>
            {moisActifs.map(({ m, hasData }) => (
              <th key={m} className={`px-2 py-3 text-right text-xs font-semibold w-24 ${hasData ? 'text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                {MOIS_LABELS[m]}
              </th>
            ))}
            <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 border-l border-gray-100 dark:border-gray-700 w-28">
              Total {annee}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* PRODUITS */}
          <tr className="bg-green-50 dark:bg-green-950 border-b border-green-100 dark:border-green-900">
            <td colSpan={moisActifs.length + 2} className="sticky left-0 px-4 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">
              Produits
            </td>
          </tr>
          {produits.length === 0
            ? <tr><td colSpan={moisActifs.length + 2} className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">Aucun produit pour {annee}</td></tr>
            : (() => {
                const cats = {}
                for (const e of produits) { if (!cats[e.categorie]) cats[e.categorie] = []; cats[e.categorie].push(e) }
                return Object.entries(cats).map(([cat, lignes]) => (
                  <BilanSection key={cat} categorie={cat} lignes={lignes} moisActifs={moisActifs} colorClass="text-green-600 dark:text-green-400" />
                ))
              })()
          }
          <tr className="border-t-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50">
            <td className="sticky left-0 bg-green-50/50 dark:bg-green-950/50 px-4 py-2.5 text-xs font-bold text-green-700 dark:text-green-300 z-10">TOTAL PRODUITS</td>
            {moisActifs.map(({ m }) => (
              <td key={m} className="px-2 py-2.5 text-right text-xs font-bold tabular-nums text-green-600 dark:text-green-400">
                {totalProduitsMois(m) ? fmtEur(totalProduitsMois(m)) : <span className="text-gray-200 dark:text-gray-700">—</span>}
              </td>
            ))}
            <td className="px-2 py-2.5 text-right text-xs font-bold text-green-700 dark:text-green-300 border-l border-gray-100 dark:border-gray-700 tabular-nums">{fmtEur(totalProduitsAnnee)}</td>
          </tr>

          {/* CHARGES */}
          <tr className="bg-red-50 dark:bg-red-950 border-t-4 border-gray-100 dark:border-gray-700 border-b border-red-100 dark:border-red-900">
            <td colSpan={moisActifs.length + 2} className="sticky left-0 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
              Charges
            </td>
          </tr>
          {charges.length === 0
            ? <tr><td colSpan={moisActifs.length + 2} className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">Aucune charge pour {annee}</td></tr>
            : (() => {
                const cats = {}
                for (const e of charges) { if (!cats[e.categorie]) cats[e.categorie] = []; cats[e.categorie].push(e) }
                return Object.entries(cats).map(([cat, lignes]) => (
                  <BilanSection key={cat} categorie={cat} lignes={lignes} moisActifs={moisActifs} colorClass="text-red-500 dark:text-red-400" negative />
                ))
              })()
          }
          <tr className="border-t-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50">
            <td className="sticky left-0 bg-red-50/50 dark:bg-red-950/50 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 z-10">TOTAL CHARGES</td>
            {moisActifs.map(({ m }) => (
              <td key={m} className="px-2 py-2.5 text-right text-xs font-bold tabular-nums text-red-500 dark:text-red-400">
                {totalChargesMois(m) ? <>−{fmtEur(totalChargesMois(m))}</> : <span className="text-gray-200 dark:text-gray-700">—</span>}
              </td>
            ))}
            <td className="px-2 py-2.5 text-right text-xs font-bold text-red-600 dark:text-red-400 border-l border-gray-100 dark:border-gray-700 tabular-nums">−{fmtEur(totalChargesAnnee)}</td>
          </tr>

          {/* SOLDE */}
          <tr className="border-t-4 border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-900">
            <td className="sticky left-0 bg-gray-50 dark:bg-gray-900 px-4 py-3 z-10">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-100">SOLDE {annee}</div>
              <div className={`text-[10px] font-semibold mt-0.5 ${soldeAnnee >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {soldeAnnee >= 0 ? '✓ Sur couverture' : '⚠ Sous couverture'}
              </div>
            </td>
            {moisActifs.map(({ m }) => {
              const s = soldeMois(m)
              return (
                <td key={m} className={`px-2 py-3 text-right text-xs font-bold tabular-nums whitespace-nowrap ${s > 0 ? 'text-green-600 dark:text-green-400' : s < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-200 dark:text-gray-700'}`}>
                  {s !== 0 ? <>{s > 0 ? '+' : '−'}{fmtEur(Math.abs(s))}</> : '—'}
                </td>
              )
            })}
            <td className={`px-2 py-3 text-right text-sm font-extrabold border-l border-gray-200 dark:border-gray-600 tabular-nums ${soldeAnnee >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {soldeAnnee >= 0 ? '+' : '−'}{fmtEur(Math.abs(soldeAnnee))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BilanCharts
      chartData={moisActifs.map(({ m }) => ({
        mois: MOIS_LABELS[m],
        val1: Math.round(totalChargesMois(m) * 100) / 100,
        val2: Math.round(totalProduitsMois(m) * 100) / 100,
      }))}
      barKeys={['Charges', 'Produits']}
      colors={['#f87171', '#4ade80', '#6366f1']}
      title="Graphiques — Vue générale Produits / Charges"
    />
    </>
  )
}

// Ligne de section avec en-tête catégorie + lignes natures (partagé entre les deux vues)
function BilanSection({ categorie, lignes, moisActifs, colorClass, negative = false }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <tr className="border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50/40 select-none"
        onClick={() => setOpen(o => !o)}>
        <td className="sticky left-0 bg-white dark:bg-gray-800 px-4 py-1.5 z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{open ? '▾' : '▸'}</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{categorie}</span>
          </div>
        </td>
        {moisActifs.map(({ m }) => {
          const tot = lignes.reduce((s, e) => s + e.mois[m], 0)
          return (
            <td key={m} className={`px-2 py-1.5 text-right text-xs font-semibold tabular-nums whitespace-nowrap ${tot ? colorClass : 'text-gray-200 dark:text-gray-700'}`}>
              {tot ? (negative ? <>−{fmtEur(tot)}</> : fmtEur(tot)) : '—'}
            </td>
          )
        })}
        <td className={`px-2 py-1.5 text-right text-xs font-semibold border-l border-gray-100 dark:border-gray-700 tabular-nums ${colorClass}`}>
          {(() => { const t = lignes.reduce((s, e) => s + e.total, 0); return t ? (negative ? <>−{fmtEur(t)}</> : fmtEur(t)) : '—' })()}
        </td>
      </tr>
      {open && lignes.map(e => (
        <tr key={e.libelle} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/30">
          <td className="sticky left-0 bg-white dark:bg-gray-800 px-4 py-1.5 z-10 pl-8 text-xs text-gray-600 dark:text-gray-300">{e.libelle}</td>
          {moisActifs.map(({ m }) => (
            <td key={m} className={`px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap ${e.mois[m] ? colorClass : 'text-gray-200 dark:text-gray-700'}`}>
              {e.mois[m] ? (negative ? <>−{fmtEur(e.mois[m])}</> : fmtEur(e.mois[m])) : '—'}
            </td>
          ))}
          <td className={`px-2 py-1.5 text-right text-xs border-l border-gray-100 dark:border-gray-700 tabular-nums font-medium ${colorClass}`}>
            {e.total ? (negative ? <>−{fmtEur(e.total)}</> : fmtEur(e.total)) : '—'}
          </td>
        </tr>
      ))}
    </>
  )
}

// ══════════════════════════════════════════════════════════
//  Tab Projets — Pâtes, Fancy Fair, Rhétos…
// ══════════════════════════════════════════════════════════
function ProjetsTab() {
  const { profile } = useAuth()
  const [projets, setProjets] = useState([])
  const [projetId, setProjetId] = useState(null)
  const [lignes, setLignes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingLignes, setLoadingLignes] = useState(false)
  const [showProjetModal, setShowProjetModal] = useState(false)
  const [editProjet, setEditProjet] = useState(null)
  const [editLigne, setEditLigne] = useState(null)
  const [saving, setSaving] = useState(false)

  // ── Charger projets ────────────────────────────────────────────────────────
  const loadProjets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('comptable_projets')
      .select('*').order('annee', { ascending: false }).order('nom')
    setProjets(data || [])
    if (data?.length && !projetId) setProjetId(data[0].id)
    setLoading(false)
  }, [projetId])

  useEffect(() => { loadProjets() }, [])

  // ── Charger lignes du projet actif ─────────────────────────────────────────
  const loadLignes = useCallback(async () => {
    if (!projetId) return
    setLoadingLignes(true)
    const { data } = await supabase.from('comptable_projet_lignes')
      .select('*').eq('projet_id', projetId).order('date').order('position')
    setLignes(data || [])
    setLoadingLignes(false)
  }, [projetId])

  useEffect(() => { loadLignes() }, [projetId])

  const projet = projets.find(p => p.id === projetId)

  // ── Save projet ────────────────────────────────────────────────────────────
  const saveProjet = async (form) => {
    setSaving(true)
    try {
      const payload = {
        nom: form.nom,
        description: form.description || null,
        annee: parseInt(form.annee, 10),
        categories: form.categories || [],
        cloture: form.cloture || false,
        created_by: profile?.id || null,
      }
      let newId = form.id
      if (form.id) {
        const { error } = await supabase.from('comptable_projets').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('comptable_projets').insert(payload).select('id').single()
        if (error) throw error
        newId = data?.id
      }
      setEditProjet(null)
      setShowProjetModal(false)
      await loadProjets()
      if (newId) setProjetId(newId)
    } catch (err) {
      alert('Erreur lors de la sauvegarde : ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const deleteProjet = async () => {
    if (!projet) return
    if (!confirm(`Supprimer le projet "${projet.nom}" et toutes ses lignes ?`)) return
    await supabase.from('comptable_projets').delete().eq('id', projetId)
    setProjetId(null)
    setProjets(prev => prev.filter(p => p.id !== projetId))
    setLignes([])
  }

  // ── Save ligne ─────────────────────────────────────────────────────────────
  const saveLigne = async (form) => {
    setSaving(true)
    try {
      const payload = {
        projet_id: projetId,
        date: form.date,
        date_ligne: form.date,   // compat ancienne colonne
        intitule: form.intitule,
        categorie: form.categorie || null,
        entree: form.entree ? parseFloat(form.entree) : null,
        sortie: form.sortie ? parseFloat(form.sortie) : null,
        commentaire: form.commentaire || null,
        note: form.commentaire || null,  // compat ancienne colonne
      }
      if (form.id) {
        const { error } = await supabase.from('comptable_projet_lignes').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('comptable_projet_lignes').insert(payload)
        if (error) throw error
      }
      setEditLigne(null)
      loadLignes()
    } catch (err) {
      alert('Erreur : ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const deleteLigne = async (id) => {
    if (!confirm('Supprimer cette ligne ?')) return
    await supabase.from('comptable_projet_lignes').delete().eq('id', id)
    setLignes(prev => prev.filter(l => l.id !== id))
  }

  // ── Calculs ────────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    // Grouper lignes par catégorie (null → '—')
    const cats = {}
    for (const l of lignes) {
      const key = l.categorie || '—'
      if (!cats[key]) cats[key] = []
      cats[key].push(l)
    }
    return cats
  }, [lignes])

  const totalEntree = lignes.reduce((s, l) => s + Number(l.entree || 0), 0)
  const totalSortie = lignes.reduce((s, l) => s + Number(l.sortie || 0), 0)
  const solde = totalEntree - totalSortie

  const anneOptions = []
  for (let y = 2023; y <= new Date().getFullYear() + 1; y++) anneOptions.push(y)

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-gray-400 dark:text-gray-500">
      <Loader2 size={18} className="animate-spin" /> Chargement…
    </div>
  )

  return (
    <div>
      {/* ── Sélecteur de projet ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {projets.length > 0 ? (
          <select value={projetId || ''} onChange={e => setProjetId(e.target.value)}
            className="text-sm text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:border-indigo-400 max-w-xs">
            {projets.map(p => (
              <option key={p.id} value={p.id}>
                {p.nom} ({p.annee}){p.cloture ? ' ✓' : ''}
              </option>
            ))}
          </select>
        ) : null}
        <button
          onClick={() => { setEditProjet({ nom: '', description: '', annee: new Date().getFullYear(), categories: [], cloture: false }); setShowProjetModal(true) }}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <PlusCircle size={14} /> Nouveau projet
        </button>
        {projet && (
          <>
            <button onClick={() => { setEditProjet({ ...projet }); setShowProjetModal(true) }}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Configurer
            </button>
            <button onClick={deleteProjet}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 px-2 py-1.5 hover:bg-red-50 rounded-lg">
              <Trash2 size={13} /> Supprimer
            </button>
            <button
              onClick={() => {
                const win = window.open('', '_blank')
                supabase.auth.getSession().then(({ data: { session } }) => {
                  const token = session?.access_token
                  if (!token || !projetId) { win?.close(); return }
                  if (win) win.location.href = `/.netlify/functions/econome-projet-pdf?projetId=${projetId}&token=${encodeURIComponent(token)}`
                })
              }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <FileText size={13} /> PDF Projet
            </button>
          </>
        )}
      </div>

      {projets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-16 text-center">
          <PlusCircle size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-500 dark:text-gray-400">Aucun projet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Créez un projet pour Pâtes, Fancy Fair, Rhétos…</p>
          <button
            onClick={() => { setEditProjet({ nom: '', description: '', annee: new Date().getFullYear(), categories: [], cloture: false }); setShowProjetModal(true) }}
            className="mt-4 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Créer un premier projet
          </button>
        </div>
      ) : !projet ? null : (
        <>
          {/* ── Cartes récap ── */}
          <div className="flex flex-wrap gap-3 mb-4">
            {projet.description && (
              <div className="flex-1 min-w-[200px] bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 rounded-xl px-4 py-3">
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold uppercase tracking-wide">Description</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">{projet.description}</p>
              </div>
            )}
            <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide">Entrées</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">{fmtEur(totalEntree)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold uppercase tracking-wide">Sorties</p>
              <p className="text-base font-bold text-red-500 dark:text-red-400">{fmtEur(totalSortie)}</p>
            </div>
            <div className={`rounded-xl px-4 py-3 text-center border ${solde >= 0 ? 'bg-indigo-50 border-indigo-100 dark:border-indigo-900' : 'bg-amber-50 dark:bg-amber-950 border-amber-100'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${solde >= 0 ? 'text-indigo-500' : 'text-amber-600 dark:text-amber-400'}`}>Solde</p>
              <p className={`text-base font-bold ${solde >= 0 ? 'text-indigo-600' : 'text-amber-600 dark:text-amber-400'}`}>
                {solde >= 0 ? '+' : ''}{fmtEur(solde)}
              </p>
            </div>
            {projet.cloture && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-gray-500">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Clôturé</span>
              </div>
            )}
          </div>

          {/* ── Bouton + ligne ── */}
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setEditLigne({
                date: new Date().toISOString().slice(0,10),
                intitule: '', categorie: projet.categories[0] || '',
                entree: '', sortie: '', commentaire: ''
              })}
              disabled={projet.cloture}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              <PlusCircle size={14} /> Ajouter une ligne
            </button>
          </div>

          {/* ── Table par catégorie ── */}
          {loadingLignes ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400 dark:text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Chargement…
            </div>
          ) : lignes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center text-gray-400 dark:text-gray-500">
              <p className="text-sm">Aucune ligne pour ce projet</p>
              <p className="text-xs mt-1">Cliquez sur "Ajouter une ligne" pour commencer.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Intitulé</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 w-32">Catégorie</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Entrée</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Sortie</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Commentaire</th>
                    <th className="w-16 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([cat, catLignes]) => {
                    const catEntree = catLignes.reduce((s, l) => s + Number(l.entree || 0), 0)
                    const catSortie = catLignes.reduce((s, l) => s + Number(l.sortie || 0), 0)
                    const catSolde  = catEntree - catSortie
                    return (
                      <ProjetCatSection key={cat}
                        categorie={cat} lignes={catLignes}
                        catEntree={catEntree} catSortie={catSortie} catSolde={catSolde}
                        onEdit={l => setEditLigne({ ...l, date: l.date || l.date_ligne, commentaire: l.commentaire || l.note || '', entree: l.entree || '', sortie: l.sortie || '' })}
                        onDelete={deleteLigne}
                        cloture={projet.cloture}
                      />
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                    <td colSpan={3} className="px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">Total</td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                      {totalEntree ? fmtEur(totalEntree) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
                      {totalSortie ? fmtEur(totalSortie) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right text-sm font-extrabold tabular-nums ${solde >= 0 ? 'text-indigo-600' : 'text-amber-600 dark:text-amber-400'}`}>
                      {solde >= 0 ? '+' : '−'}{fmtEur(Math.abs(solde))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showProjetModal && editProjet && (
        <ProjetModal
          item={editProjet}
          saving={saving}
          anneOptions={anneOptions}
          onSave={saveProjet}
          onClose={() => { setShowProjetModal(false); setEditProjet(null) }}
        />
      )}
      {editLigne && (
        <LigneModal
          item={editLigne}
          categories={projet?.categories || []}
          saving={saving}
          onSave={saveLigne}
          onClose={() => setEditLigne(null)}
        />
      )}
    </div>
  )
}

// ── Section catégorie dans la table ───────────────────────────────────────────
function ProjetCatSection({ categorie, lignes, catEntree, catSortie, catSolde, onEdit, onDelete, cloture }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {/* En-tête catégorie */}
      <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 cursor-pointer select-none hover:bg-gray-100/60 dark:hover:bg-gray-700/60"
        onClick={() => setOpen(o => !o)}>
        <td colSpan={3} className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{open ? '▾' : '▸'}</span>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{categorie}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">({lignes.length})</span>
          </div>
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">
          {catEntree ? fmtEur(catEntree) : '—'}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">
          {catSortie ? fmtEur(catSortie) : '—'}
        </td>
        <td className={`px-3 py-1.5 text-right text-xs font-bold tabular-nums ${catSolde > 0 ? 'text-indigo-600 dark:text-indigo-400' : catSolde < 0 ? 'text-amber-600' : 'text-gray-400 dark:text-gray-500'}`}>
          {catSolde !== 0 ? <>{catSolde > 0 ? '+' : '−'}{fmtEur(Math.abs(catSolde))}</> : '—'}
        </td>
        <td />
      </tr>
      {/* Lignes */}
      {open && lignes.map(l => (
        <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/40">
          <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap pl-6">{fmtDate(l.date || l.date_ligne)}</td>
          <td className="px-3 py-2 text-xs text-gray-800 dark:text-gray-100 font-medium">{l.intitule}</td>
          <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{l.categorie || '—'}</td>
          <td className="px-3 py-2 text-right text-xs text-green-600 dark:text-green-400 font-medium tabular-nums">
            {l.entree ? fmtEur(l.entree) : ''}
          </td>
          <td className="px-3 py-2 text-right text-xs text-red-500 dark:text-red-400 font-medium tabular-nums">
            {l.sortie ? fmtEur(l.sortie) : ''}
          </td>
          <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 max-w-[180px] truncate">{l.commentaire || ''}</td>
          <td className="px-2 py-2">
            {!cloture && (
              <div className="flex items-center gap-1">
                <button onClick={() => onEdit(l)}
                  className="p-1.5 hover:bg-indigo-50 rounded text-gray-300 dark:text-gray-600 hover:text-indigo-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={() => onDelete(l.id)}
                  className="p-1.5 hover:bg-red-50 rounded text-gray-300 dark:text-gray-600 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}

// ── Modal création/édition projet ─────────────────────────────────────────────
function ProjetModal({ item, saving, anneOptions, onSave, onClose }) {
  const [form, setForm] = useState({ ...item, categories: item.categories ? [...item.categories] : [] })
  const [newCat, setNewCat] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addCat = () => {
    const c = newCat.trim()
    if (!c || form.categories.includes(c)) return
    set('categories', [...form.categories, c])
    setNewCat('')
  }
  const removeCat = cat => set('categories', form.categories.filter(c => c !== cat))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{item.id ? 'Modifier le projet' : 'Nouveau projet'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={16} className="text-gray-500 dark:text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom du projet *</label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)}
                placeholder="ex: Pâtes 2026, Fancy Fair…"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Année *</label>
              <select value={form.annee} onChange={e => set('annee', parseInt(e.target.value))}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400">
                {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label>
            <input value={form.description || ''} onChange={e => set('description', e.target.value)}
              placeholder="Courte description du projet"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Catégories</label>
            <div className="flex gap-2 mb-2">
              <input value={newCat} onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCat())}
                placeholder="Ajouter une catégorie…"
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400" />
              <button onClick={addCat} type="button"
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-600 dark:text-gray-300">
                Ajouter
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {form.categories.length === 0
                ? <span className="text-xs text-gray-400 dark:text-gray-500 italic">Aucune catégorie — les lignes seront non catégorisées</span>
                : form.categories.map(c => (
                  <span key={c} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900">
                    {c}
                    <button onClick={() => removeCat(c)} className="hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))
              }
            </div>
          </div>
          {item.id && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input type="checkbox" checked={form.cloture} onChange={e => set('cloture', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-500 text-indigo-600 dark:text-indigo-400" />
              Projet clôturé (lecture seule)
            </label>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Annuler</button>
          <button onClick={() => onSave(form)} disabled={!form.nom || saving}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : (item.id ? 'Enregistrer' : 'Créer le projet')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout/édition ligne ─────────────────────────────────────────────────
function LigneModal({ item, categories, saving, onSave, onClose }) {
  const [form, setForm] = useState({ ...item })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const hasCategories = categories.length > 0

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{item.id ? 'Modifier' : 'Nouvelle'} ligne</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={16} className="text-gray-500 dark:text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Catégorie</label>
              {hasCategories ? (
                <select value={form.categorie || ''} onChange={e => set('categorie', e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400">
                  <option value="">— Sans catégorie —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input value={form.categorie || ''} onChange={e => set('categorie', e.target.value)}
                  placeholder="Catégorie libre"
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Intitulé *</label>
            <input value={form.intitule} onChange={e => set('intitule', e.target.value)}
              placeholder="Description de l'opération"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Entrée (€)</label>
              <input type="number" step="0.01" min="0" value={form.entree || ''}
                onChange={e => { set('entree', e.target.value); if (e.target.value) set('sortie', '') }}
                placeholder="0.00"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Sortie (€)</label>
              <input type="number" step="0.01" min="0" value={form.sortie || ''}
                onChange={e => { set('sortie', e.target.value); if (e.target.value) set('entree', '') }}
                placeholder="0.00"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Commentaire</label>
            <input value={form.commentaire || ''} onChange={e => set('commentaire', e.target.value)}
              placeholder="Facultatif"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Annuler</button>
          <button onClick={() => onSave(form)}
            disabled={!form.date || !form.intitule || (!form.entree && !form.sortie) || saving}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : (item.id ? 'Enregistrer' : 'Ajouter')}
          </button>
        </div>
      </div>
    </div>
  )
}
