import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MasterFilter, { ActiveFilterChips } from '../components/ui/MasterFilter'
import FicheEleve from '../components/ui/FicheEleve'
import PageHeader from '../components/ui/PageHeader'
import { Search, Upload, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'

const fmt = n => Number(n || 0).toFixed(2) + ' €'
const fmtDate = d => {
  if (!d) return '—'
  const [y, m, j] = d.split('-')
  return `${j}/${m}/${y}`
}

// Parse Belfius date DD/MM/YYYY → YYYY-MM-DD
const parseBelfiusDate = s => {
  if (!s) return null
  const p = s.trim().split('/')
  if (p.length !== 3) return null
  return `${p[2]}-${p[1]}-${p[0]}`
}

// Normalize string for fuzzy matching
const norm = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Try to match communication text to an eleve
const matchEleve = (comm, eleves) => {
  const c = norm(comm)
  let best = null, bestScore = 0
  for (const el of eleves) {
    const n = norm(el.nom)
    const p = norm(el.prenom)
    let score = 0
    if (c.includes(n) && n.length > 2) score += n.length * 2
    if (c.includes(p) && p.length > 2) score += p.length * 2
    if (c.includes(norm(el.classe))) score += 5
    if (score > bestScore) { bestScore = score; best = el }
  }
  return bestScore >= 6 ? best : null
}

// Parse Belfius CSV text → array of row objects
const parseBelfiusCSV = (text, eleves) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  // Find header line (contains "Date de comptabilisation")
  let headerIdx = lines.findIndex(l => l.includes('Date de comptabilisation') && l.includes('Montant'))
  if (headerIdx === -1) headerIdx = 13 // fallback
  const dataLines = lines.slice(headerIdx + 1)

  return dataLines.map(line => {
    // Split on ; respecting quoted fields
    const cols = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ';' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())

    const montant = parseFloat((cols[10] || '0').replace(',', '.') || 0)
    if (montant <= 0) return null // ignore outgoing / zero

    const payerName = (cols[5] || '').replace(/\s+/g, ' ').trim()
    const communication = (cols[8] || '').replace(/\s+/g, ' ').trim()
    const dateCompta = parseBelfiusDate(cols[3])
    const refBelfius = cols[1]?.trim() || `${dateCompta}|${(montant+'').replace('.','_')}|${norm(communication).slice(0, 25)}`
    const modeRaw = (cols[12] || '').toLowerCase()
    const mode = modeRaw.includes('virement') ? 'virement' : modeRaw.includes('versement') ? 'versement' : 'autre'
    const isWorldline = payerName.toUpperCase().includes('WORLDLINE') || (cols[4] || '').includes('666-0000000')

    return {
      date: dateCompta,
      paye_par: 'responsable',
      communication,
      montant,
      mode,
      reference_belfius: refBelfius,
      isWorldline,
      matchedEleve: matchEleve(communication, eleves),
      eleve_id: matchEleve(communication, eleves)?.id || '',
    }
  }).filter(Boolean)
}

// ── Sort icon ──────────────────────────────────────────────────────────────
function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 dark:text-gray-600 ml-0.5" />
  return sort.dir === 'asc'
    ? <ChevronUp size={11} className="text-primary ml-0.5" />
    : <ChevronDown size={11} className="text-primary ml-0.5" />
}

// ── Import modal ───────────────────────────────────────────────────────────
function ImportModal({ eleves, existingRefs, existingSignatures, onClose, onImported }) {
  const [rows, setRows] = useState([])        // parsed rows
  const [hideWorldline, setHideWorldline] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dropRef = useRef()

  const parseFile = async file => {
    if (!file) return
    const text = await file.text()
    setRows(parseBelfiusCSV(text, eleves))
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const onFileInput = e => parseFile(e.target.files[0])

  const visibleRows = rows.filter(r => hideWorldline ? !r.isWorldline : true)
  const isAlready = r => {
    if (existingRefs.has(r.reference_belfius)) return true
    const sig = r.eleve_id ? `${r.date}|${r.montant}|${r.eleve_id}` : null
    return sig ? (existingSignatures?.has(sig) ?? false) : false
  }
  const newRows = visibleRows.filter(r => !isAlready(r))
  const alreadyRows = visibleRows.filter(r => isAlready(r))
  const worldlineCount = rows.filter(r => r.isWorldline).length

  const updateEleve = (idx, eleve_id) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const el = eleves.find(e => e.id === eleve_id)
      return { ...r, eleve_id, matchedEleve: el || null }
    }))
  }

  const [importError, setImportError] = useState(null)

  const doImport = async () => {
    setImporting(true)
    setImportError(null)
    const toInsert = newRows.filter(r => r.eleve_id).map(({ isWorldline, matchedEleve, ...r }) => r)
    if (toInsert.length > 0) {
      const { error } = await supabase.from('paiements').upsert(toInsert, { onConflict: 'reference_belfius', ignoreDuplicates: true })
      if (error) {
        setImportError(error.message)
        setImporting(false)
        return
      }
    }
    setImporting(false)
    await onImported()   // await reload so table is fresh before modal closes
    onClose()
  }

  const importable = newRows.filter(r => r.eleve_id).length
  const unmatched = newRows.filter(r => !r.eleve_id).length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-gray-100 text-lg">Import CSV Belfius</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Glissez votre extrait de compte Belfius (.csv)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Drop zone */}
          {rows.length === 0 ? (
            <div ref={dropRef}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-600 hover:border-primary/50'}`}>
              <Upload size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Glissez votre CSV ici</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">ou</p>
              <label className="btn-primary cursor-pointer text-sm py-1.5 px-4">
                Parcourir…
                <input type="file" accept=".csv" className="hidden" onChange={onFileInput} />
              </label>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{rows.length} ligne{rows.length > 1 ? 's' : ''} détectée{rows.length > 1 ? 's' : ''}</span>
                {worldlineCount > 0 && (
                  <button onClick={() => setHideWorldline(h => !h)}
                    className={`flex items-center gap-1.5 text-xs rounded-full border px-3 py-1 transition-colors ${hideWorldline ? 'bg-orange-500 border-orange-500 text-white' : 'border-orange-300 text-orange-600 dark:text-orange-400 hover:bg-orange-50'}`}>
                    {hideWorldline ? '✓' : ''} Ignorer Worldline ({worldlineCount})
                  </button>
                )}
                {unmatched > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 rounded-full px-3 py-1">
                    <AlertTriangle size={11} /> {unmatched} élève{unmatched > 1 ? 's' : ''} non identifié{unmatched > 1 ? 's' : ''}
                  </span>
                )}
                {alreadyRows.length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{alreadyRows.length} déjà importé{alreadyRows.length > 1 ? 's' : ''}</span>
                )}
                <button onClick={() => setRows([])} className="ml-auto text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline">Changer de fichier</button>
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase">Payé par</th>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase">Communication</th>
                      <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-semibold uppercase">Montant</th>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase">Élève</th>
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, i) => {
                      const already = existingRefs.has(r.reference_belfius)
                      const origIdx = rows.indexOf(r)
                      return (
                        <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 ${already ? 'opacity-40' : r.isWorldline && !hideWorldline ? 'bg-orange-50/50' : ''}`}>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2 min-w-[120px]">
                            {already ? <span className="text-gray-400 dark:text-gray-500">{PAYE_PAR_LABELS[r.paye_par] || r.paye_par}</span> : (
                              <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 w-full bg-white dark:bg-gray-800 outline-none focus:border-primary"
                                value={r.paye_par}
                                onChange={e => setRows(prev => prev.map((row, i) => i === origIdx ? { ...row, paye_par: e.target.value } : row))}>
                                {PAYE_PAR_OPTIONS.map(o => <option key={o} value={o}>{PAYE_PAR_LABELS[o]}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-xs break-words whitespace-normal leading-snug">{r.communication}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{r.montant.toFixed(2)} €</td>
                          <td className="px-3 py-2 min-w-[160px]">
                            {already ? (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            ) : (
                              <select
                                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 w-full bg-white dark:bg-gray-800 outline-none focus:border-primary"
                                value={r.eleve_id}
                                onChange={e => updateEleve(origIdx, e.target.value)}>
                                <option value="">— Non identifié —</option>
                                {eleves.map(el => (
                                  <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {already ? (
                              <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full px-2 py-0.5">Déjà importé</span>
                            ) : r.isWorldline ? (
                              <span className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-xs rounded-full px-2 py-0.5">Worldline</span>
                            ) : r.eleve_id ? (
                              <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full px-2 py-0.5">✓ Identifié</span>
                            ) : (
                              <span className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded-full px-2 py-0.5">Non identifié</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {importError ? (
                <span className="text-red-500 dark:text-red-400 font-medium">Erreur : {importError}</span>
              ) : (
                <>
                  <span className="font-semibold text-primary">{importable}</span> paiement{importable > 1 ? 's' : ''} à importer
                  {unmatched > 0 && <span className="text-amber-600 dark:text-amber-400 ml-2">({unmatched} sans élève — ignoré{unmatched > 1 ? 's' : ''})</span>}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
              <button onClick={doImport} disabled={importing || importable === 0} className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
                {importing ? 'Import en cours…' : `Importer ${importable} paiement${importable > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Edit modal ─────────────────────────────────────────────────────────────
function EditModal({ paiement, eleves, onClose, onSaved }) {
  const [form, setForm] = useState({
    eleve_id: paiement.eleve_id || '',
    date: paiement.date || '',
    montant: paiement.montant || '',
    paye_par: paiement.paye_par || 'responsable',
    mode: paiement.mode || 'virement',
    communication: paiement.communication || '',
    remarque: paiement.remarque || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('paiements').update(form).eq('id', paiement.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">Modifier le paiement</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Élève</label>
            <select className="input" value={form.eleve_id} onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
              <option value="">— Choisir —</option>
              {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Montant (€)</label>
            <input className="input" type="number" step="0.01" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
          </div>
          <div>
            <label className="label">Payé par</label>
            <select className="input" value={form.paye_par} onChange={e => setForm(f => ({ ...f, paye_par: e.target.value }))}>
              {PAYE_PAR_OPTIONS.map(o => <option key={o} value={o}>{PAYE_PAR_LABELS[o]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mode</label>
            <select className="input" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
              <option value="virement">Virement</option>
              <option value="versement">Versement</option>
              <option value="bancontact">Bancontact</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Communication</label>
            <input className="input" value={form.communication} onChange={e => setForm(f => ({ ...f, communication: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Remarque</label>
            <input className="input" value={form.remarque} onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
const MODE_LABELS = { virement: 'Virement', versement: 'Versement', bancontact: 'Bancontact', autre: 'Autre' }
const PAYE_PAR_OPTIONS = ['responsable', 'cpas', 'ulb', 'spj', 'autre']
const PAYE_PAR_LABELS  = { responsable: 'Responsable', cpas: 'CPAS', ulb: 'ULB', spj: 'SPJ', autre: 'Autre' }

export default function Paiements() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const toggleFilter = useCallback((key, val) =>
    setFilters(f => {
      const cur  = Array.isArray(f[key]) ? f[key] : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return next.length === 0
        ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key))
        : { ...f, [key]: next }
    })
  , [])
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  const [showImport, setShowImport] = useState(false)
  const [showPending, setShowPending] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editPaiement, setEditPaiement] = useState(null)
  const [ficheId, setFicheId] = useState(null)
  const [inlineEdit, setInlineEdit] = useState({}) // { [id]: { field, value } }
  const [form, setForm] = useState({
    eleve_id: '', date: new Date().toISOString().slice(0, 10),
    montant: '', paye_par: 'responsable', mode: 'virement', communication: '', remarque: '',
  })
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() =>
    supabase.from('paiements')
      .select('*, eleve:eleve_id(nom,prenom,classe)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => setData(data || []))
  , [])

  useEffect(() => {
    Promise.all([
      reload(),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom'),
    ]).then(([, e]) => { setEleves(e.data || []); setLoading(false) })
  }, [reload])

  const existingRefs = useMemo(() => new Set(data.map(r => r.reference_belfius).filter(Boolean)), [data])
  const existingSignatures = useMemo(() => new Set(data.map(r => `${r.date}|${r.montant}|${r.eleve_id}`).filter(s => !s.includes('undefined'))), [data])

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })

  const filtered = useMemo(() => {
    let d = data
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        `${r.eleve?.nom || ''} ${r.eleve?.prenom || ''} ${r.paye_par || ''} ${r.communication || ''} ${r.remarque || ''}`.toLowerCase().includes(q)
      )
    }
    if (filters.paye_par?.length) d = d.filter(r => filters.paye_par.includes(r.paye_par))
    if (filters.classe?.length)   d = d.filter(r => filters.classe.includes(r.eleve?.classe))
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      let va, vb
      if (col === 'eleve') { va = `${a.eleve?.nom || ''} ${a.eleve?.prenom || ''}`; vb = `${b.eleve?.nom || ''} ${b.eleve?.prenom || ''}` }
      else if (col === 'classe') { va = a.eleve?.classe || ''; vb = b.eleve?.classe || '' }
      else if (col === 'montant') return (Number(a.montant) - Number(b.montant)) * (dir === 'asc' ? 1 : -1)
      else { va = a[col] || ''; vb = b[col] || '' }
      return String(va).localeCompare(String(vb), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [data, search, filters, sort])

  const saveManual = async () => {
    setSaving(true)
    await supabase.from('paiements').insert(form)
    await reload(); setSaving(false); setShowForm(false)
    setForm({ eleve_id: '', date: new Date().toISOString().slice(0, 10), montant: '', paye_par: '', mode: 'virement', communication: '', remarque: '' })
  }

  // Inline patch a single field
  const patchField = async (id, field, value) => {
    await supabase.from('paiements').update({ [field]: value }).eq('id', id)
    setData(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    setInlineEdit(e => { const n = { ...e }; delete n[id]; return n })
  }

  const startInline = (e, id, field, value) => {
    e.stopPropagation()
    setInlineEdit(prev => ({ ...prev, [id]: { field, value } }))
  }

  const del = async id => {
    if (!confirm('Supprimer ce paiement ?')) return
    await supabase.from('paiements').delete().eq('id', id)
    await reload()
  }

  const TH = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      className={`px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-primary whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      <span className={`flex items-center gap-0.5 ${right ? 'justify-end' : ''}`}>
        {label}<SortIcon col={col} sort={sort} />
      </span>
    </th>
  )

  const hasFilters = search || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v)

  const filterDefs = useMemo(() => [
    { key: 'paye_par', label: 'Payé par', options: Object.entries(PAYE_PAR_LABELS).map(([v, l]) => ({ value: v, label: l })) },
    { key: 'classe',   label: 'Classe',   options: [...new Set(data.map(r => r.eleve?.classe).filter(Boolean))].sort() },
  ], [data])

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>

  return (
    <div className="h-full flex flex-col">
    <PageHeader
      title="Paiements"
      subtitle="Historique des paiements reçus"
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Rechercher par nom, prénom, payeur…"
      filters={
        <MasterFilter dark
          filters={filters}
          filterDefs={filterDefs}
          onChange={toggleFilter}
          onClearAll={() => setFilters({})}
        />
      }
      info={`${filtered.length} résultat${filtered.length !== 1 ? 's' : ''}`}
      actions={isFinancier ? (
        <>
          <button onClick={() => setShowPending(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{display:'inline',marginRight:4}}>
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.51"/>
            </svg>
            Depuis Comptes
          </button>

          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>
            + Paiement
          </button>
        </>
      ) : null}
    />
    <div className="flex-1 min-h-0 p-6 max-w-screen-xl mx-auto w-full flex flex-col">

      {/* Manual form */}
      {showForm && (
        <div className="card p-5 mb-4 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Nouveau paiement</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id} onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
                <option value="">— Choisir —</option>
                {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>)}
              </select>
            </div>
            <div><label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div><label className="label">Montant (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
            </div>
            <div><label className="label">Payé par</label>
              <select className="input" value={form.paye_par} onChange={e => setForm(f => ({ ...f, paye_par: e.target.value }))}>
                {PAYE_PAR_OPTIONS.map(o => <option key={o} value={o}>{PAYE_PAR_LABELS[o]}</option>)}
              </select>
            </div>
            <div><label className="label">Mode</label>
              <select className="input" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1"><label className="label">Communication</label>
              <input className="input" value={form.communication} onChange={e => setForm(f => ({ ...f, communication: e.target.value }))} />
            </div>
            <div className="col-span-2"><label className="label">Remarque</label>
              <input className="input" value={form.remarque} onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveManual} disabled={saving || !form.eleve_id} className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
          </div>
        </div>
      )}

      <ActiveFilterChips filters={filters} filterDefs={filterDefs} onChange={toggleFilter} />

      {/* Table */}
      <div className="card p-0 flex-1 overflow-auto min-h-0">
        <table className="w-full text-sm">
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }} className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
            <tr>
              <TH col="date" label="Date" />
              <TH col="eleve" label="Élève" />
              <TH col="classe" label="Classe" />
              <TH col="montant" label="Montant" right />
              <TH col="paye_par" label="Payé par" />
              <TH col="remarque" label="Remarque" />
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Aucun paiement</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => setFicheId(r.eleve_id)} className="border-b border-gray-50 dark:border-gray-800 hover:bg-primary/5 cursor-pointer">
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{r.eleve?.nom} {r.eleve?.prenom}</td>
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{r.eleve?.classe || '—'}</td>
                {/* Montant — inline editable */}
                <td className="px-3 py-2.5 text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap" onClick={e => isFinancier && startInline(e, r.id, 'montant', r.montant)}>
                  {isFinancier && inlineEdit[r.id]?.field === 'montant' ? (
                    <input autoFocus type="number" step="0.01"
                      className="w-24 text-right border border-primary rounded px-1.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400 outline-none"
                      value={inlineEdit[r.id].value}
                      onChange={e => setInlineEdit(prev => ({ ...prev, [r.id]: { ...prev[r.id], value: e.target.value } }))}
                      onBlur={() => patchField(r.id, 'montant', inlineEdit[r.id]?.value)}
                      onKeyDown={e => { if (e.key === 'Enter') patchField(r.id, 'montant', inlineEdit[r.id]?.value); if (e.key === 'Escape') setInlineEdit(p => { const n={...p}; delete n[r.id]; return n }) }}
                      onClick={e => e.stopPropagation()} />
                  ) : (
                    <span className={isFinancier ? 'cursor-pointer hover:underline decoration-dotted' : ''}>{fmt(r.montant)}</span>
                  )}
                </td>
                {/* Payé par — inline editable select */}
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap" onClick={e => isFinancier && startInline(e, r.id, 'paye_par', r.paye_par || 'Responsable')}>
                  {isFinancier && inlineEdit[r.id]?.field === 'paye_par' ? (
                    <select autoFocus
                      className="border border-primary rounded px-1.5 py-0.5 text-xs outline-none bg-white dark:bg-gray-800"
                      value={inlineEdit[r.id].value}
                      onChange={e => patchField(r.id, 'paye_par', e.target.value)}
                      onBlur={() => setInlineEdit(p => { const n={...p}; delete n[r.id]; return n })}
                      onClick={e => e.stopPropagation()}>
                      {PAYE_PAR_OPTIONS.map(o => <option key={o} value={o}>{PAYE_PAR_LABELS[o]}</option>)}
                    </select>
                  ) : (
                    <span className={`${isFinancier ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}>{PAYE_PAR_LABELS[r.paye_par] || r.paye_par || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-400 dark:text-gray-500 text-xs max-w-[220px] truncate">{r.remarque || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                    {isFinancier && <>
                      <button onClick={() => setEditPaiement(r)} className="text-gray-400 dark:text-gray-500 hover:text-primary"><Pencil size={14} /></button>
                      <button onClick={() => del(r.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500"><Trash2 size={14} /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showPending && (
        <PendingEconomeModal
          eleves={eleves}
          existingRefs={existingRefs}
          onClose={() => setShowPending(false)}
          onImported={reload}
        />
      )}
      {showImport && (
        <ImportModal eleves={eleves} existingRefs={existingRefs} existingSignatures={existingSignatures} onClose={() => setShowImport(false)} onImported={reload} />
      )}
      {editPaiement && (
        <EditModal paiement={editPaiement} eleves={eleves} onClose={() => setEditPaiement(null)} onSaved={reload} />
      )}
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
    </div>
  )
}

// ── Modal "Récupérer encodages depuis Économe / onglet Élèves" ─────────────
function PendingEconomeModal({ eleves, existingRefs, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())

  // Normalisation pour matching élève
  const norm = s => (s || '').toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

  const matchEleve = comm => {
    const c = norm(comm)
    let best = null, bestScore = 0
    for (const el of eleves) {
      const n = norm(el.nom), p = norm(el.prenom)
      let score = 0
      if (c.includes(n) && n.length > 2) score += n.length * 2
      if (c.includes(p) && p.length > 2) score += p.length * 2
      if (c.includes(norm(el.classe))) score += 5
      if (score > bestScore) { bestScore = score; best = el }
    }
    return bestScore >= 6 ? best : null
  }

  useEffect(() => {
    supabase.from('comptable_transactions')
      .select('*')
      .eq('compte', 'eleves')
      .eq('statut_paiement', 'pending')
      .not('montant_entree', 'is', null)
      .order('date_operation', { ascending: false })
      .then(({ data }) => {
        const mapped = (data || []).map(tx => ({
          ...tx,
          matchedEleve: matchEleve(tx.communication || tx.libelle || ''),
          eleve_id: matchEleve(tx.communication || tx.libelle || '')?.id || '',
          alreadyImported: existingRefs.has(tx.id),
        }))
        setRows(mapped)
        // Pré-sélectionner toutes les non-importées avec un élève trouvé
        setSelected(new Set(mapped.filter(r => !r.alreadyImported && r.eleve_id).map(r => r.id)))
        setLoading(false)
      })
  }, [])

  const toggleRow = id => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const setEleveForRow = (txId, eleveId) => {
    setRows(prev => prev.map(r => r.id === txId ? { ...r, eleve_id: eleveId } : r))
  }

  const doImport = async () => {
    const toImport = rows.filter(r => selected.has(r.id) && r.eleve_id)
    if (!toImport.length) return
    setImporting(true)
    try {
      // Insérer dans paiements
      const payload = toImport.map(r => ({
        eleve_id: r.eleve_id,
        date: r.date_operation,
        montant: r.montant_entree,
        paye_par: 'responsable',
        mode: 'virement',
        communication: r.communication || r.libelle || '',
        reference_belfius: r.id, // utilise l'UUID de la transaction comme ref unique
      }))
      const { error } = await supabase.from('paiements').insert(payload)
      if (error) throw error

      // Marquer les transactions comme importées
      const ids = toImport.map(r => r.id)
      for (let i = 0; i < ids.length; i += 100) {
        await supabase.from('comptable_transactions')
          .update({ statut_paiement: 'imported' })
          .in('id', ids.slice(i, i + 100))
      }

      await onImported()
      onClose()
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const importable = rows.filter(r => selected.has(r.id) && r.eleve_id).length
  const fmtDate = d => { if (!d) return '—'; const [y,m,j] = d.split('-'); return `${j}/${m}/${y}` }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Récupérer depuis l'onglet Élèves (Comptes)</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Transactions encodées dans Comptes, non encore importées ici</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="font-medium">Aucun encodage en attente</p>
              <p className="text-sm mt-1">Importez d'abord un CSV dans l'onglet Élèves de la page Comptes.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                  <th className="w-8 px-2 py-2">
                    <input type="checkbox"
                      checked={rows.filter(r => !r.alreadyImported).every(r => selected.has(r.id))}
                      onChange={e => {
                        const ids = rows.filter(r => !r.alreadyImported).map(r => r.id)
                        setSelected(e.target.checked ? new Set(ids) : new Set())
                      }}
                      className="rounded border-gray-300 dark:border-gray-500 text-indigo-600 dark:text-indigo-400" />
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Libellé / Communication</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Élève associé</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Montant</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={`border-b border-gray-50 dark:border-gray-800 ${r.alreadyImported ? 'opacity-40' : 'hover:bg-gray-50/60'}`}>
                    <td className="px-2 py-2">
                      <input type="checkbox"
                        checked={selected.has(r.id)}
                        disabled={r.alreadyImported}
                        onChange={() => toggleRow(r.id)}
                        className="rounded border-gray-300 dark:border-gray-500 text-indigo-600 dark:text-indigo-400" />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(r.date_operation)}</td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{r.libelle || '—'}</p>
                      {r.communication && <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{r.communication}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {r.alreadyImported ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">{r.matchedEleve ? `${r.matchedEleve.prenom} ${r.matchedEleve.nom}` : '—'}</span>
                      ) : (
                        <select
                          value={r.eleve_id || ''}
                          onChange={e => setEleveForRow(r.id, e.target.value)}
                          className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 max-w-[180px] focus:outline-none focus:border-indigo-400"
                        >
                          <option value="">— Non associé —</option>
                          {eleves.map(el => (
                            <option key={el.id} value={el.id}>
                              {el.prenom} {el.nom} {el.classe ? `(${el.classe})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                        {Number(r.montant_entree).toFixed(2)} €
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.alreadyImported
                        ? <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">Importé</span>
                        : !r.eleve_id
                          ? <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Sans élève</span>
                          : <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Prêt</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {importable} paiement{importable !== 1 ? 's' : ''} à importer
            {rows.filter(r => selected.has(r.id) && !r.eleve_id).length > 0 && (
              <span className="text-amber-500 dark:text-amber-400 ml-2">
                ({rows.filter(r => selected.has(r.id) && !r.eleve_id).length} sans élève associé — seront ignorés)
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              Annuler
            </button>
            <button
              onClick={doImport}
              disabled={importable === 0 || importing}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg
                hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Import en cours…' : `Importer ${importable} paiement${importable !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
