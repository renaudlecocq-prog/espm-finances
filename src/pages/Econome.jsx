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
      {!loading && <SummaryBar transactions={filtered} compte={compte} />}

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
        {activeTab === 'pop' && (
          <PlaceholderTab
            label="POP — Notes de frais"
            icon={<FileText size={24} className="text-gray-400" />}
            desc="Encodage manuel des factures transmises au Pouvoir Organisateur Pluriel. En cours de développement."
          />
        )}
        {activeTab === 'bilan' && (
          <PlaceholderTab
            label="Bilan mensuel"
            icon={<TrendingUp size={24} className="text-gray-400" />}
            desc="Récapitulatif mensuel automatique — Produits / Charges / Couverture. En cours de développement."
          />
        )}
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
