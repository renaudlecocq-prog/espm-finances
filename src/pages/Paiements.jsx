import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FilterPill from '../components/ui/FilterPill'
import FicheEleve from '../components/ui/FicheEleve'
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
    const refBelfius = cols[1] ? cols[1].trim() : `${dateCompta}|${montant}|${communication.slice(0, 20)}`
    const modeRaw = (cols[12] || '').toLowerCase()
    const mode = modeRaw.includes('virement') ? 'virement' : modeRaw.includes('versement') ? 'versement' : 'autre'
    const isWorldline = payerName.toUpperCase().includes('WORLDLINE') || (cols[4] || '').includes('666-0000000')

    return {
      date: dateCompta,
      paye_par: payerName,
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
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5" />
  return sort.dir === 'asc'
    ? <ChevronUp size={11} className="text-primary ml-0.5" />
    : <ChevronDown size={11} className="text-primary ml-0.5" />
}

// ── Import modal ───────────────────────────────────────────────────────────
function ImportModal({ eleves, existingRefs, onClose, onImported }) {
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
  const newRows = visibleRows.filter(r => !existingRefs.has(r.reference_belfius))
  const alreadyRows = visibleRows.filter(r => existingRefs.has(r.reference_belfius))
  const worldlineCount = rows.filter(r => r.isWorldline).length

  const updateEleve = (idx, eleve_id) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const el = eleves.find(e => e.id === eleve_id)
      return { ...r, eleve_id, matchedEleve: el || null }
    }))
  }

  const doImport = async () => {
    setImporting(true)
    const toInsert = newRows.filter(r => r.eleve_id).map(({ isWorldline, matchedEleve, ...r }) => r)
    if (toInsert.length > 0) {
      await supabase.from('paiements').insert(toInsert)
    }
    setImporting(false)
    onImported()
    onClose()
  }

  const importable = newRows.filter(r => r.eleve_id).length
  const unmatched = newRows.filter(r => !r.eleve_id).length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Import CSV Belfius</h2>
            <p className="text-xs text-gray-400 mt-0.5">Glissez votre extrait de compte Belfius (.csv)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Drop zone */}
          {rows.length === 0 ? (
            <div ref={dropRef}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}`}>
              <Upload size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium mb-1">Glissez votre CSV ici</p>
              <p className="text-xs text-gray-400 mb-4">ou</p>
              <label className="btn-primary cursor-pointer text-sm py-1.5 px-4">
                Parcourir…
                <input type="file" accept=".csv" className="hidden" onChange={onFileInput} />
              </label>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">{rows.length} ligne{rows.length > 1 ? 's' : ''} détectée{rows.length > 1 ? 's' : ''}</span>
                {worldlineCount > 0 && (
                  <button onClick={() => setHideWorldline(h => !h)}
                    className={`flex items-center gap-1.5 text-xs rounded-full border px-3 py-1 transition-colors ${hideWorldline ? 'bg-orange-500 border-orange-500 text-white' : 'border-orange-300 text-orange-600 hover:bg-orange-50'}`}>
                    {hideWorldline ? '✓' : ''} Ignorer Worldline ({worldlineCount})
                  </button>
                )}
                {unmatched > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                    <AlertTriangle size={11} /> {unmatched} élève{unmatched > 1 ? 's' : ''} non identifié{unmatched > 1 ? 's' : ''}
                  </span>
                )}
                {alreadyRows.length > 0 && (
                  <span className="text-xs text-gray-400">{alreadyRows.length} déjà importé{alreadyRows.length > 1 ? 's' : ''}</span>
                )}
                <button onClick={() => setRows([])} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">Changer de fichier</button>
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">Payé par</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">Communication</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold uppercase">Montant</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">Élève</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, i) => {
                      const already = existingRefs.has(r.reference_belfius)
                      const origIdx = rows.indexOf(r)
                      return (
                        <tr key={i} className={`border-b border-gray-50 ${already ? 'opacity-40' : r.isWorldline && !hideWorldline ? 'bg-orange-50/50' : ''}`}>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate">{r.paye_par}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{r.communication}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600 whitespace-nowrap">{r.montant.toFixed(2)} €</td>
                          <td className="px-3 py-2 min-w-[160px]">
                            {already ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <select
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-full bg-white outline-none focus:border-primary"
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
                              <span className="bg-gray-100 text-gray-500 text-xs rounded-full px-2 py-0.5">Déjà importé</span>
                            ) : r.isWorldline ? (
                              <span className="bg-orange-100 text-orange-600 text-xs rounded-full px-2 py-0.5">Worldline</span>
                            ) : r.eleve_id ? (
                              <span className="bg-green-100 text-green-700 text-xs rounded-full px-2 py-0.5">✓ Identifié</span>
                            ) : (
                              <span className="bg-amber-100 text-amber-700 text-xs rounded-full px-2 py-0.5">Non identifié</span>
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
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-primary">{importable}</span> paiement{importable > 1 ? 's' : ''} à importer
              {unmatched > 0 && <span className="text-amber-600 ml-2">({unmatched} sans élève — ignoré{unmatched > 1 ? 's' : ''})</span>}
            </p>
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
    paye_par: paiement.paye_par || '',
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Modifier le paiement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
            <input className="input" value={form.paye_par} onChange={e => setForm(f => ({ ...f, paye_par: e.target.value }))} />
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

export default function Paiements() {
  const { isFinancier } = useAuth()
  const [data, setData] = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  const [showImport, setShowImport] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editPaiement, setEditPaiement] = useState(null)
  const [ficheId, setFicheId] = useState(null)
  const [form, setForm] = useState({
    eleve_id: '', date: new Date().toISOString().slice(0, 10),
    montant: '', paye_par: '', mode: 'virement', communication: '', remarque: '',
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

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })

  const filtered = useMemo(() => {
    let d = data
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        `${r.eleve?.nom || ''} ${r.eleve?.prenom || ''} ${r.paye_par || ''} ${r.communication || ''} ${r.remarque || ''}`.toLowerCase().includes(q)
      )
    }
    if (filterMode) d = d.filter(r => r.mode === filterMode)
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      let va, vb
      if (col === 'eleve') { va = `${a.eleve?.nom || ''} ${a.eleve?.prenom || ''}`; vb = `${b.eleve?.nom || ''} ${b.eleve?.prenom || ''}` }
      else if (col === 'classe') { va = a.eleve?.classe || ''; vb = b.eleve?.classe || '' }
      else if (col === 'montant') return (Number(a.montant) - Number(b.montant)) * (dir === 'asc' ? 1 : -1)
      else { va = a[col] || ''; vb = b[col] || '' }
      return String(va).localeCompare(String(vb), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [data, search, filterMode, sort])

  const saveManual = async () => {
    setSaving(true)
    await supabase.from('paiements').insert(form)
    await reload(); setSaving(false); setShowForm(false)
    setForm({ eleve_id: '', date: new Date().toISOString().slice(0, 10), montant: '', paye_par: '', mode: 'virement', communication: '', remarque: '' })
  }

  const del = async id => {
    if (!confirm('Supprimer ce paiement ?')) return
    await supabase.from('paiements').delete().eq('id', id)
    await reload()
  }

  const TH = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-primary whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      <span className={`flex items-center gap-0.5 ${right ? 'justify-end' : ''}`}>
        {label}<SortIcon col={col} sort={sort} />
      </span>
    </th>
  )

  const hasFilters = search || filterMode

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-primary">Paiements</h1>
          <p className="text-sm text-gray-400 mt-0.5">Historique des paiements reçus</p>
        </div>
        {isFinancier && (
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors">
              <Upload size={14} /> Import CSV Belfius
            </button>
            <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm py-1.5 px-4">
              + Paiement
            </button>
          </div>
        )}
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="card p-5 mb-4 bg-gray-50 flex-shrink-0">
          <h3 className="font-semibold text-gray-700 mb-3">Nouveau paiement</h3>
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
              <input className="input" value={form.paye_par} onChange={e => setForm(f => ({ ...f, paye_par: e.target.value }))} />
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

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-52 focus:border-primary transition-colors"
            placeholder="Rechercher par nom, prénom, payeur…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <FilterPill label="Mode" value={filterMode}
          options={Object.values(MODE_LABELS)}
          onChange={v => setFilterMode(Object.entries(MODE_LABELS).find(([, lbl]) => lbl === v)?.[0] || '')} />
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterMode('') }}
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
        <table className="w-full text-sm">
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }} className="bg-gray-50 border-b border-gray-100">
            <tr>
              <TH col="date" label="Date" />
              <TH col="eleve" label="Élève" />
              <TH col="classe" label="Classe" />
              <TH col="montant" label="Montant" right />
              <TH col="paye_par" label="Payé par" />
              <TH col="remarque" label="Remarque" />
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun paiement</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => setFicheId(r.eleve_id)} className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer">
                <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.eleve?.nom} {r.eleve?.prenom}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.eleve?.classe || '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-green-600 whitespace-nowrap">{fmt(r.montant)}</td>
                <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate">{r.paye_par || '—'}</td>
                <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[220px] truncate">{r.remarque || r.communication || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                    {isFinancier && <>
                      <button onClick={() => setEditPaiement(r)} className="text-gray-400 hover:text-primary"><Pencil size={14} /></button>
                      <button onClick={() => del(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showImport && (
        <ImportModal eleves={eleves} existingRefs={existingRefs} onClose={() => setShowImport(false)} onImported={reload} />
      )}
      {editPaiement && (
        <EditModal paiement={editPaiement} eleves={eleves} onClose={() => setEditPaiement(null)} onSaved={reload} />
      )}
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}
