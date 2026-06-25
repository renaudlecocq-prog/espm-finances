import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import {
  Upload, X, Check, ChevronDown, Search, AlertTriangle, Loader2,
  RefreshCw, PlusCircle, Trash2, ChevronUp, ChevronsUpDown,
  FileText, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

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
    <span className="text-xs text-gray-500 italic">{selected?.libelle || '—'}</span>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setQ('') }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:border-indigo-400 bg-white max-w-[180px] truncate"
      >
        <span className={`flex-1 truncate text-left ${selected ? 'text-gray-800' : 'text-gray-400 italic'}`}>
          {selected?.libelle || 'Choisir…'}
        </span>
        <ChevronDown size={10} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col max-h-72">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left text-xs px-3 py-1.5 text-gray-400 italic hover:bg-gray-50"
            >
              — Non classé
            </button>
            {filtered
              ? filtered.map(n => (
                <button key={n.id}
                  onClick={() => { onChange(n.id); setOpen(false) }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-indigo-50 ${value === n.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                >
                  {n.libelle}
                </button>
              ))
              : Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    {cat}
                  </div>
                  {items.map(n => (
                    <button key={n.id}
                      onClick={() => { onChange(n.id); setOpen(false) }}
                      className={`w-full text-left text-xs px-4 py-1.5 hover:bg-indigo-50 ${value === n.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
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
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">
              Import CSV — {compte === 'fonctionnement' ? 'Fonctionnement' : 'Élèves'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Fichier d'export Belfius (.csv)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
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
              ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
            onClick={() => document.getElementById('csv-input').click()}
          >
            <Upload size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-600">
              {filename || 'Glisser le CSV ou cliquer pour choisir'}
            </p>
            {filename && <p className="text-xs text-gray-400 mt-1">{rows.length} lignes lues</p>}
            <input id="csv-input" type="file" accept=".csv" className="hidden"
              onChange={e => parseFile(e.target.files[0])} />
          </div>

          {/* Stats + aperçu */}
          {rows.length > 0 && (
            <>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-green-600 font-medium">Nouvelles lignes</p>
                  <p className="text-2xl font-bold text-green-700">{newRows.length}</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 font-medium">Déjà importées</p>
                  <p className="text-2xl font-bold text-gray-400">{dupRows.length}</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 font-medium">Année détectée</p>
                  <p className="text-2xl font-bold text-gray-700">{annee}</p>
                </div>
              </div>

              {/* Aperçu 5 premières lignes nouvelles */}
              {newRows.length > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Libellé</th>
                        <th className="text-right px-3 py-2">Entrée</th>
                        <th className="text-right px-3 py-2">Sortie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newRows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-3 py-1.5 text-gray-500">{fmtDate(r.date_operation)}</td>
                          <td className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">{r.libelle || r.communication || '—'}</td>
                          <td className="px-3 py-1.5 text-right text-green-600 font-medium">{r.montant_entree ? fmtEur(r.montant_entree) : ''}</td>
                          <td className="px-3 py-1.5 text-right text-red-500 font-medium">{r.montant_sortie ? fmtEur(r.montant_sortie) : ''}</td>
                        </tr>
                      ))}
                      {newRows.length > 8 && (
                        <tr className="border-t border-gray-50">
                          <td colSpan={4} className="px-3 py-2 text-center text-gray-400 italic">
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
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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
    if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5" />
    return sort.dir === 'asc'
      ? <ChevronUp size={11} className="text-indigo-500 ml-0.5" />
      : <ChevronDown size={11} className="text-indigo-500 ml-0.5" />
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
    <div className="text-center py-16 text-gray-400">
      <FileText size={32} className="mx-auto mb-3 text-gray-300" />
      <p className="text-sm">Aucune transaction pour cette période</p>
      <p className="text-xs mt-1">Importez un CSV Belfius pour commencer</p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-100">
            {/* Checkbox select all */}
            <th className="w-8 px-2 py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleAll}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer whitespace-nowrap"
              onClick={() => toggleSort('date_operation')}>
              Date <SortIcon col="date_operation" />
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Libellé / Communication</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 min-w-[180px]">Nature comptable</th>
            {compte === 'eleves' && (
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Statut</th>
            )}
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer"
              onClick={() => toggleSort('montant_entree')}>
              Entrée <SortIcon col="montant_entree" />
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer"
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
              className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer
                ${selected.has(tx.id) ? 'bg-indigo-50/60' : tx.confirme ? '' : 'bg-amber-50/30'}`}
            >
              <td className="w-8 px-2 py-2.5" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(tx.id)}
                  onChange={() => toggleOne(tx.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                {fmtDate(tx.date_operation)}
              </td>
              <td className="px-3 py-2.5 max-w-xs">
                <p className="text-gray-800 truncate text-xs font-medium">{tx.libelle || '—'}</p>
                {tx.communication && (
                  <p className="text-gray-400 truncate text-[11px]">{tx.communication}</p>
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
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      <Check size={9} /> Importé
                    </span>
                  )}
                  {tx.statut_paiement === 'pending' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      En attente
                    </span>
                  )}
                  {tx.statut_paiement === 'ignored' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      Ignoré
                    </span>
                  )}
                </td>
              )}
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {tx.montant_entree ? (
                  <span className="text-green-600 font-semibold text-xs">{fmtEur(tx.montant_entree)}</span>
                ) : <span className="text-gray-300 text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {tx.montant_sortie ? (
                  <span className="text-red-500 font-semibold text-xs">{fmtEur(tx.montant_sortie)}</span>
                ) : <span className="text-gray-300 text-xs">—</span>}
              </td>
              <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onDelete(tx.id)}
                  className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors"
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
      <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5 min-w-[150px]">
        <TrendingUp size={16} className="text-green-500 shrink-0" />
        <div>
          <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Entrées</p>
          <p className="text-sm font-bold text-green-700">{fmtEur(totalEntree)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 min-w-[150px]">
        <TrendingDown size={16} className="text-red-400 shrink-0" />
        <div>
          <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Sorties</p>
          <p className="text-sm font-bold text-red-600">{fmtEur(totalSortie)}</p>
        </div>
      </div>
      <div className={`flex items-center gap-2.5 border rounded-lg px-4 py-2.5 min-w-[150px]
        ${solde >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
        <Minus size={16} className={solde >= 0 ? 'text-indigo-500' : 'text-orange-500'} />
        <div>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${solde >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>Solde</p>
          <p className={`text-sm font-bold ${solde >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>{fmtEur(solde)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5">
        <FileText size={16} className="text-gray-400 shrink-0" />
        <div>
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Transactions</p>
          <p className="text-sm font-bold text-gray-700">{transactions.length}</p>
        </div>
      </div>
      {nonClasses > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Non classé</p>
            <p className="text-sm font-bold text-amber-700">{nonClasses}</p>
          </div>
        </div>
      )}

      {/* ── Bulk action (inline) ── */}
      {selected && selected.size > 0 && (
        <>
          <div className="w-px h-8 bg-gray-200 self-center mx-1" />
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">
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
              className="p-1 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-600"
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
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-indigo-400"
        >
          {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Mois */}
        <select
          value={moisFilter}
          onChange={e => setMoisFilter(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-indigo-400"
        >
          <option value={0}>Tous les mois</option>
          {MOIS_LABELS.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher libellé, communication…"
            className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
          />
        </div>

        {compte === 'eleves' && (
          <button
            onClick={() => setPendingOnly(!pendingOnly)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${pendingOnly
              ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            En attente seulement
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Actualiser">
          <RefreshCw size={15} />
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
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
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
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-600 mb-1">{label}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{desc}</p>
      <span className="mt-3 text-xs font-medium px-3 py-1 bg-amber-100 text-amber-600 rounded-full">
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
    <div className="flex items-center justify-center h-64 text-gray-400">
      Accès réservé à l'administrateur
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Économe"
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
        {activeTab === 'projets' && (
          <PlaceholderTab
            label="Petits projets"
            icon={<PlusCircle size={24} className="text-gray-400" />}
            desc="Pâtes, Fancy Fair, Rhétos… Modèle universel avec sous-totaux par catégorie. En cours de développement."
          />
        )}
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
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-400">
          {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={moisFilter} onChange={e => setMoisFilter(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-400">
          <option value={0}>Tous les mois</option>
          {MOIS_LABELS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher fournisseur, pièce, nature…"
            className="w-full text-sm pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="flex-1" />
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <RefreshCw size={15} />
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
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
            <TrendingDown size={16} className="text-red-400 shrink-0" />
            <div>
              <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Total transmis au POP</p>
              <p className="text-sm font-bold text-red-600">{fmtEur(totalMontant)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5">
            <FileText size={16} className="text-gray-400 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Lignes</p>
              <p className="text-sm font-bold text-gray-700">{filtered.length}</p>
            </div>
          </div>
          {nonClasses > 0 && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
              <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Non classé</p>
                <p className="text-sm font-bold text-amber-700">{nonClasses}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Aucune note de frais pour cette période</p>
            <p className="text-xs mt-1">Cliquez sur "Ajouter une ligne" pour encoder une facture</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Fournisseur</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">N° pièce</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 min-w-[180px]">Nature comptable</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Montant</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Commentaire</th>
                <th className="w-16 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.date_transmission)}</td>
                  <td className="px-3 py-2.5 text-gray-800 text-xs font-medium max-w-[160px] truncate">{l.fournisseur || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{l.numero_piece || '—'}</td>
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
                    <span className="text-red-500 font-semibold text-xs">{fmtEur(l.montant)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[200px] truncate">{l.commentaire || ''}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditItem({ ...l })}
                        className="p-1.5 hover:bg-indigo-50 rounded text-gray-300 hover:text-indigo-500 transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteLigne(l.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors">
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
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            {item.id ? 'Modifier' : 'Nouvelle'} note de frais / facture POP
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date de transmission *</label>
              <input type="date" value={form.date_transmission}
                onChange={e => set('date_transmission', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N° pièce / référence</label>
              <input value={form.numero_piece || ''} onChange={e => set('numero_piece', e.target.value)}
                placeholder="ex: FAC-2026-001"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
            <input value={form.fournisseur || ''} onChange={e => set('fournisseur', e.target.value)}
              placeholder="Nom du fournisseur ou prestataire"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nature comptable</label>
              <NatureSelect value={form.nature_id} natures={natures} onChange={v => set('nature_id', v)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant (€) *</label>
              <input type="number" step="0.01" min="0" value={form.montant || ''}
                onChange={e => set('montant', e.target.value)}
                placeholder="0.00"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire</label>
            <textarea value={form.commentaire || ''} onChange={e => set('commentaire', e.target.value)}
              rows={2} placeholder="Description, contexte…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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

function BilanTab({ natures }) {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)   // { produits, charges, nonClasses }

  // Map nature_id → { type_flux, libelle, categorie }
  const naturesMap = useMemo(() => {
    const m = {}
    for (const n of natures) m[n.id] = n
    return m
  }, [natures])

  const load = useCallback(async () => {
    setLoading(true)

    // Fetch transactions de toutes les comptes pour l'année
    const [{ data: txs }, { data: pop }] = await Promise.all([
      supabase.from('comptable_transactions')
        .select('date_operation, nature_id, nature_libelle, montant_entree, montant_sortie')
        .gte('date_operation', `${annee}-01-01`)
        .lte('date_operation', `${annee}-12-31`),
      supabase.from('comptable_pop_lignes')
        .select('date_transmission, nature_id, nature_libelle, montant')
        .eq('annee', annee),
    ])

    // ── Agrégation ────────────────────────────────────────────────────────────
    // key = nature_id, value = { libelle, categorie, type_flux, mois: [0..12] }
    const agg = {}      // { [nature_id]: { libelle, categorie, type_flux, mois: Array(13) } }
    let nonClasses = 0

    const ensureNature = (nature_id, nature_libelle) => {
      if (!agg[nature_id]) {
        const nat = naturesMap[nature_id]
        agg[nature_id] = {
          libelle: nat?.libelle || nature_libelle || nature_id,
          categorie: nat?.categorie || '—',
          type_flux: nat?.type_flux || 'neutre',
          mois: Array(13).fill(0),   // index 1..12 = mois, index 0 unused
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
        // charge: on prend montant_sortie (positif dans DB) ou montant_entree si inattendu
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
      // Les POP sont toujours des charges
      entry.mois[m] += Number(pl.montant || 0)
    }

    // Calculer totaux par ligne
    for (const e of Object.values(agg)) {
      e.total = e.mois.slice(1).reduce((s, v) => s + v, 0)
    }

    // Séparer produits / charges, trier par catégorie puis libellé
    const sort = arr => arr.sort((a, b) =>
      a.categorie.localeCompare(b.categorie) || a.libelle.localeCompare(b.libelle)
    )
    const produits = sort(Object.values(agg).filter(e => e.type_flux === 'produit'))
    const charges  = sort(Object.values(agg).filter(e => e.type_flux === 'charge'))

    setData({ produits, charges, nonClasses })
    setLoading(false)
  }, [annee, naturesMap])

  useEffect(() => { load() }, [load])

  // ── Mois actifs (au moins une valeur non nulle dans produits+charges) ───────
  const moisActifs = useMemo(() => {
    if (!data) return []
    const actifs = []
    for (let m = 1; m <= 12; m++) {
      const hasData = [...data.produits, ...data.charges].some(e => e.mois[m] !== 0)
      actifs.push({ m, hasData })
    }
    return actifs
  }, [data])

  const totalProduitsMois = m => data?.produits.reduce((s, e) => s + e.mois[m], 0) || 0
  const totalChargesMois  = m => data?.charges.reduce((s, e) => s + e.mois[m], 0) || 0
  const soldeMois         = m => totalProduitsMois(m) - totalChargesMois(m)

  const totalProduitsAnnee = data?.produits.reduce((s, e) => s + e.total, 0) || 0
  const totalChargesAnnee  = data?.charges.reduce((s, e) => s + e.total, 0) || 0
  const soldeAnnee = totalProduitsAnnee - totalChargesAnnee

  const anneOptions = []
  for (let y = 2024; y <= new Date().getFullYear() + 1; y++) anneOptions.push(y)

  const cell = (val, cls = '') =>
    <td className={`px-2 py-2 text-right text-xs tabular-nums whitespace-nowrap ${cls}`}>
      {val !== 0 ? fmtEur(val) : <span className="text-gray-200">—</span>}
    </td>

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <select value={annee} onChange={e => { setAnnee(Number(e.target.value)) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-400">
          {anneOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
          <RefreshCw size={15} />
        </button>
        {data?.nonClasses > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
            <AlertTriangle size={13} />
            {data.nonClasses} transaction{data.nonClasses > 1 ? 's' : ''} sans nature — non comptabilisée{data.nonClasses > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : !data ? null : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="sticky left-0 bg-white text-left px-4 py-3 text-xs font-semibold text-gray-600 min-w-[220px] z-10">
                  Nature comptable
                </th>
                {moisActifs.map(({ m, hasData }) => (
                  <th key={m} className={`px-2 py-3 text-right text-xs font-semibold w-24
                    ${hasData ? 'text-gray-600' : 'text-gray-300'}`}>
                    {MOIS_LABELS[m]}
                  </th>
                ))}
                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 border-l border-gray-100 w-28">
                  Total {annee}
                </th>
              </tr>
            </thead>
            <tbody>

              {/* ── SECTION PRODUITS ── */}
              <tr className="bg-green-50 border-b border-green-100">
                <td colSpan={moisActifs.length + 2}
                  className="sticky left-0 px-4 py-2 text-xs font-bold text-green-700 uppercase tracking-wide">
                  Produits
                </td>
              </tr>

              {data.produits.length === 0 ? (
                <tr><td colSpan={moisActifs.length + 2} className="px-4 py-3 text-xs text-gray-400 italic">
                  Aucune transaction classée en Produit pour {annee}
                </td></tr>
              ) : (() => {
                // Grouper par catégorie
                const cats = {}
                for (const e of data.produits) {
                  if (!cats[e.categorie]) cats[e.categorie] = []
                  cats[e.categorie].push(e)
                }
                return Object.entries(cats).map(([cat, lignes]) => (
                  <BilanSection key={cat} categorie={cat} lignes={lignes}
                    moisActifs={moisActifs} colorClass="text-green-600" />
                ))
              })()}

              {/* Total produits */}
              <tr className="border-t-2 border-green-200 bg-green-50/50">
                <td className="sticky left-0 bg-green-50/50 px-4 py-2.5 text-xs font-bold text-green-700 z-10">
                  TOTAL PRODUITS
                </td>
                {moisActifs.map(({ m }) => (
                  <td key={m} className="px-2 py-2.5 text-right text-xs font-bold tabular-nums whitespace-nowrap text-green-600">
                    {totalProduitsMois(m) ? fmtEur(totalProduitsMois(m)) : <span className="text-gray-200">—</span>}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right text-xs font-bold text-green-700 border-l border-gray-100 tabular-nums">
                  {fmtEur(totalProduitsAnnee)}
                </td>
              </tr>

              {/* ── SECTION CHARGES ── */}
              <tr className="bg-red-50 border-t-4 border-gray-100 border-b border-red-100">
                <td colSpan={moisActifs.length + 2}
                  className="sticky left-0 px-4 py-2 text-xs font-bold text-red-600 uppercase tracking-wide">
                  Charges
                </td>
              </tr>

              {data.charges.length === 0 ? (
                <tr><td colSpan={moisActifs.length + 2} className="px-4 py-3 text-xs text-gray-400 italic">
                  Aucune transaction classée en Charge pour {annee}
                </td></tr>
              ) : (() => {
                const cats = {}
                for (const e of data.charges) {
                  if (!cats[e.categorie]) cats[e.categorie] = []
                  cats[e.categorie].push(e)
                }
                return Object.entries(cats).map(([cat, lignes]) => (
                  <BilanSection key={cat} categorie={cat} lignes={lignes}
                    moisActifs={moisActifs} colorClass="text-red-500" negative />
                ))
              })()}

              {/* Total charges */}
              <tr className="border-t-2 border-red-200 bg-red-50/50">
                <td className="sticky left-0 bg-red-50/50 px-4 py-2.5 text-xs font-bold text-red-600 z-10">
                  TOTAL CHARGES
                </td>
                {moisActifs.map(({ m }) => (
                  <td key={m} className="px-2 py-2.5 text-right text-xs font-bold tabular-nums whitespace-nowrap text-red-500">
                    {totalChargesMois(m) ? <>−{fmtEur(totalChargesMois(m))}</> : <span className="text-gray-200">—</span>}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right text-xs font-bold text-red-600 border-l border-gray-100 tabular-nums">
                  −{fmtEur(totalChargesAnnee)}
                </td>
              </tr>

              {/* ── SOLDE ── */}
              <tr className="border-t-4 border-gray-300 bg-gray-50">
                <td className="sticky left-0 bg-gray-50 px-4 py-3 z-10">
                  <div className="text-xs font-bold text-gray-800">SOLDE {annee}</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${soldeAnnee >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {soldeAnnee >= 0 ? '✓ Sur couverture' : '⚠ Sous couverture'}
                  </div>
                </td>
                {moisActifs.map(({ m }) => {
                  const s = soldeMois(m)
                  return (
                    <td key={m} className={`px-2 py-3 text-right text-xs font-bold tabular-nums whitespace-nowrap
                      ${s > 0 ? 'text-green-600' : s < 0 ? 'text-red-500' : 'text-gray-200'}`}>
                      {s !== 0
                        ? <>{s > 0 ? '+' : '−'}{fmtEur(Math.abs(s))}</>
                        : '—'}
                    </td>
                  )
                })}
                <td className={`px-2 py-3 text-right text-sm font-extrabold border-l border-gray-200 tabular-nums
                  ${soldeAnnee >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {soldeAnnee >= 0 ? '+' : '−'}{fmtEur(Math.abs(soldeAnnee))}
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Ligne de section avec en-tête catégorie + lignes natures
function BilanSection({ categorie, lignes, moisActifs, colorClass, negative = false }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {/* En-tête catégorie */}
      <tr className="border-b border-gray-50 cursor-pointer hover:bg-gray-50/40 select-none"
        onClick={() => setOpen(o => !o)}>
        <td className="sticky left-0 bg-white px-4 py-1.5 z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400">{open ? '▾' : '▸'}</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{categorie}</span>
          </div>
        </td>
        {moisActifs.map(({ m }) => {
          const tot = lignes.reduce((s, e) => s + e.mois[m], 0)
          return (
            <td key={m} className={`px-2 py-1.5 text-right text-xs font-semibold tabular-nums whitespace-nowrap
              ${tot ? colorClass : 'text-gray-200'}`}>
              {tot ? (negative ? <>−{fmtEur(tot)}</> : fmtEur(tot)) : '—'}
            </td>
          )
        })}
        <td className={`px-2 py-1.5 text-right text-xs font-semibold border-l border-gray-100 tabular-nums ${colorClass}`}>
          {(() => { const t = lignes.reduce((s, e) => s + e.total, 0); return t ? (negative ? <>−{fmtEur(t)}</> : fmtEur(t)) : '—' })()}
        </td>
      </tr>
      {/* Lignes natures */}
      {open && lignes.map(e => (
        <tr key={e.libelle} className="border-b border-gray-50 hover:bg-gray-50/30">
          <td className="sticky left-0 bg-white px-4 py-1.5 z-10 pl-8 text-xs text-gray-600">{e.libelle}</td>
          {moisActifs.map(({ m }) => (
            <td key={m} className={`px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap
              ${e.mois[m] ? colorClass : 'text-gray-200'}`}>
              {e.mois[m] ? (negative ? <>−{fmtEur(e.mois[m])}</> : fmtEur(e.mois[m])) : '—'}
            </td>
          ))}
          <td className={`px-2 py-1.5 text-right text-xs border-l border-gray-100 tabular-nums font-medium ${colorClass}`}>
            {e.total ? (negative ? <>−{fmtEur(e.total)}</> : fmtEur(e.total)) : '—'}
          </td>
        </tr>
      ))}
    </>
  )
}
