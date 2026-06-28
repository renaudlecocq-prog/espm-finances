import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FicheEleve from '../components/ui/FicheEleve'
import { ChevronDown, ChevronUp, ChevronsUpDown, Plus, FileText } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import MasterFilter, { ActiveFilterChips } from '../components/ui/MasterFilter'

// ── Column config (onglet Groupes) ─────────────────────────────────────────
const COLS = [
  { key: 'nom',             label: 'Nom',          w: 160, sticky: 0   },
  { key: 'prenom',          label: 'Prénom',        w: 160, sticky: 160 },
  { key: 'classe',          label: 'Classe',        w: 160, filter: true },
  { key: 'rlmo',            label: 'RLMO',          w: 220, filter: true },
  { key: 'obs_d2',          label: 'OBS D2',        w: 200, filter: true },
  { key: 'ac_d2',           label: 'AC D2',         w: 200, filter: true },
  { key: 'math_d3',         label: 'Math D3',       w: 170, filter: true },
  { key: 'sciences_d3',     label: 'Sciences D3',   w: 200, filter: true },
  { key: 'bio_physique_d3', label: 'Bio/Physique',  w: 200, filter: true },
  { key: 'obs1_d3',         label: 'OBS 1 D3',      w: 200, filter: true },
  { key: 'obs2_d3',         label: 'OBS 2 D3',      w: 200, filter: true },
  { key: 'ac_d3',           label: 'AC D3',         w: 200, filter: true },
]
const FILTER_COLS = COLS.filter(c => c.filter)

const NOTE_CATS = [
  { key: 'anecdotes_proclamation', label: 'Anecdotes proclamation' },
]

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 dark:text-gray-600 ml-0.5 shrink-0" />
  return sort.dir === 'asc'
    ? <ChevronUp   size={11} className="text-primary ml-0.5 shrink-0" />
    : <ChevronDown size={11} className="text-primary ml-0.5 shrink-0" />
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function NoteCard({ note, showEleve = false, canManage = false, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card p-4 space-y-1.5 hover:border-primary/30 dark:hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
          {showEleve && (
            <p className="text-xs font-semibold text-primary dark:text-accent mb-0.5">
              {note.eleve_nom} {note.eleve_prenom}
              <span className="text-gray-400 dark:text-gray-500 font-normal ml-1.5">{note.eleve_classe}</span>
            </p>
          )}
          {note.titre && (
            <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{note.titre}</p>
          )}
          <p className={`text-gray-600 dark:text-gray-300 text-sm ${open ? '' : 'line-clamp-2'}`}>
            {note.contenu}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canManage && (
            <>
              <button onClick={() => onEdit(note)} title="Modifier"
                className="p-1 rounded text-gray-400 hover:text-primary dark:hover:text-accent hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button onClick={() => onDelete(note)} title="Supprimer"
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </>
          )}
          <ChevronDown size={14} className={`text-gray-400 cursor-pointer transition-transform ${open ? 'rotate-180' : ''}`}
            onClick={() => setOpen(o => !o)} />
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span>{fmtDate(note.created_at)}</span>
        {note.auteur_nom && <><span>·</span><span>{note.auteur_nom}</span></>}
        <span>·</span>
        <span className="text-primary dark:text-accent opacity-70">{NOTE_CATS.find(c => c.key === note.categorie)?.label ?? note.categorie}</span>
      </div>
    </div>
  )
}

function NotesPanel({ eleves, onOpenFiche, setSelectedIdUp, search, userId, userRole }) {
  const [selectedId, setSelectedId] = useState(null)
  const [notes, setNotes]           = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [activeCat, setActiveCat]   = useState('anecdotes_proclamation')

  const loadNotes = useCallback(async () => {
    setNotesLoading(true)
    const { data } = await supabase
      .from('eleve_notes')
      .select('*, eleves(nom, prenom, classe)')
      .order('created_at', { ascending: false })
    setNotes((data || []).map(n => ({
      ...n,
      eleve_nom:    n.eleves?.nom,
      eleve_prenom: n.eleves?.prenom,
      eleve_classe: n.eleves?.classe,
    })))
    setNotesLoading(false)
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const [editNote, setEditNote] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleDelete = useCallback(async (note) => {
    if (!window.confirm('Supprimer cette note ?')) return
    await supabase.from('eleve_notes').delete().eq('id', note.id)
    loadNotes()
  }, [loadNotes])

  const openPdf = useCallback(async () => {
    if (!selectedId) return
    setPdfLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { alert('Session expirée, veuillez vous reconnecter.'); return }
      const resp = await fetch(
        `/.netlify/functions/eleve-notes-pdf?eleveId=${encodeURIComponent(selectedId)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
      const body = await resp.text()
      if (!resp.ok) { alert(`Erreur ${resp.status}: ${body}`); return }
      const blob = new Blob([body], { type: 'text/html' })
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } finally {
      setPdfLoading(false)
    }
  }, [selectedId])

  const canManageNote = useCallback((note) => {
    if (userRole === 'direction' || userRole === 'admin' || userRole === 'super_admin') return true
    return note.auteur_id === userId
  }, [userId, userRole])

  const selectEleve = useCallback((id) => {
    const next = id === selectedId ? null : id
    setSelectedId(next)
    setSelectedIdUp(next)
  }, [selectedId, setSelectedIdUp])

  const filteredEleves = useMemo(() => {
    if (!search) return eleves
    const q = search.toLowerCase()
    return eleves.filter(e =>
      (e.nom || '').toLowerCase().includes(q) ||
      (e.prenom || '').toLowerCase().includes(q) ||
      (e.classe || '').toLowerCase().includes(q)
    )
  }, [eleves, search])

  const rightNotes = useMemo(() => {
    if (!selectedId) return notes
    return notes.filter(n => n.eleve_id === selectedId && n.categorie === activeCat)
  }, [notes, selectedId, activeCat])

  const selectedEleve = useMemo(() => eleves.find(e => e.id === selectedId), [eleves, selectedId])

  // Expose reload pour le parent
  NotesPanel._reload = loadNotes

  return (
    <>
    <div className="flex flex-1 gap-0 overflow-hidden min-h-0">
      {/* Colonne gauche */}
      <div className="w-72 flex-shrink-0 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900
          text-xs text-gray-500 dark:text-gray-400 font-medium">
          {filteredEleves.length} élève{filteredEleves.length !== 1 ? 's' : ''}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredEleves.map(e => {
            const noteCount = notes.filter(n => n.eleve_id === e.id).length
            return (
              <button key={e.id}
                onClick={() => selectEleve(e.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center gap-3
                  ${selectedId === e.id
                    ? 'bg-primary/10 border-primary/30 text-primary dark:text-white dark:bg-primary/20'
                    : 'bg-white dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                <div className="relative flex-shrink-0">
                  {e.photo_url ? (
                    <img src={e.photo_url} alt={e.prenom}
                      className={`w-8 h-8 rounded-full object-cover ring-2 ${selectedId === e.id ? 'ring-primary dark:ring-accent' : 'ring-transparent'}`} />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                      ${selectedId === e.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {e.prenom?.charAt(0)}{e.nom?.charAt(0)}
                    </div>
                  )}
                  {noteCount > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-0.5
                      bg-accent text-white text-[10px] font-bold rounded-full
                      flex items-center justify-center leading-none ring-1 ring-gray-800">
                      {noteCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{e.nom} {e.prenom}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{e.classe}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Colonne droite */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedId ? (
          <div className="flex-1 overflow-y-auto p-4">
            {notesLoading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Chargement…</p>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-gray-500 py-16">
                <FileText size={48} className="text-gray-200 dark:text-gray-700" />
                <p className="text-sm">Aucune note pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-2">
                  Toutes les notes — {notes.length} au total
                </p>
                {notes.map(n => (
                  <NoteCard key={n.id} note={n} showEleve
                    canManage={canManageNote(n)}
                    onEdit={setEditNote}
                    onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 pt-4 pb-0 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => onOpenFiche(selectedId)}
                  className="text-sm font-semibold text-primary dark:text-accent hover:underline">
                  {selectedEleve?.nom} {selectedEleve?.prenom}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">{selectedEleve?.classe}</span>
                <button
                  onClick={openPdf}
                  disabled={pdfLoading}
                  title="Générer PDF des notes"
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
                    bg-primary/5 dark:bg-accent/10 text-primary dark:text-accent
                    hover:bg-primary/10 dark:hover:bg-accent/20 transition-colors disabled:opacity-50">
                  <FileText size={13} />
                  {pdfLoading ? 'Génération…' : 'PDF'}
                </button>
              </div>
              <div className="flex gap-1">
                {NOTE_CATS.map(cat => (
                  <button key={cat.key}
                    onClick={() => setActiveCat(cat.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-all
                      ${activeCat === cat.key
                        ? 'border-primary dark:border-accent text-primary dark:text-accent bg-primary/5 dark:bg-accent/10'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                    {cat.label}
                    <span className="ml-1.5 text-xs opacity-60">
                      {notes.filter(n => n.eleve_id === selectedId && n.categorie === cat.key).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {rightNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-gray-500 py-12">
                  <FileText size={36} className="text-gray-200 dark:text-gray-700" />
                  <p className="text-sm">Aucune note dans cette catégorie</p>
                </div>
              ) : (
                <div className="space-y-3 max-w-2xl">
                  {rightNotes.map(n => (
                    <NoteCard key={n.id} note={n}
                      canManage={canManageNote(n)}
                      onEdit={setEditNote}
                      onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {editNote && (
      <NoteModal note={editNote} eleve={{ id: editNote.eleve_id, nom: editNote.eleve_nom, prenom: editNote.eleve_prenom }}
        onClose={() => setEditNote(null)}
        onSaved={() => { setEditNote(null); loadNotes() }} />
    )}
    </>
  )
}

function NoteModal({ eleve, user, profile, note: editingNote, onClose, onSaved }) {
  const [titre,   setTitre]   = useState(editingNote?.titre ?? '')
  const [contenu, setContenu] = useState(editingNote?.contenu ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const isEdit = !!editingNote

  const handleSave = async () => {
    if (!contenu.trim()) { setError('Le contenu est obligatoire.'); return }
    setSaving(true)
    const auteurNom = profile
      ? `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim() || profile.email
      : (user?.email ?? null)
    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('eleve_notes')
        .update({ titre: titre.trim() || null, contenu: contenu.trim() })
        .eq('id', editingNote.id))
    } else {
      ;({ error: err } = await supabase.from('eleve_notes').insert({
        eleve_id:  eleve.id,
        categorie: 'anecdotes_proclamation',
        titre:     titre.trim() || null,
        contenu:   contenu.trim(),
        auteur_id: user?.id ?? null,
        auteur_nom: auteurNom,
      }))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">{isEdit ? 'Modifier la note' : 'Nouvelle note'}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {eleve.nom} {eleve.prenom} · <span className="text-primary/80">Anecdotes proclamation</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Titre <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input value={titre} onChange={e => setTitre(e.target.value)}
              placeholder="Ex : Discours de remise de diplôme…" className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Note <span className="text-red-400">*</span>
            </label>
            <textarea value={contenu} onChange={e => { setContenu(e.target.value); setError(null) }}
              rows={6} placeholder="Décrivez l'anecdote ou la remarque…" className="input w-full resize-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Groupes() {
  const { user, profile, role } = useAuth()
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('groupes')

  // Onglet Groupes
  const [ficheId,  setFicheId]  = useState(null)
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState({ col: 'nom', dir: 'asc' })
  const [filters,  setFilters]  = useState({})

  // Onglet Notes
  const [notesSearch,     setNotesSearch]     = useState('')
  const [notesSelectedId, setNotesSelectedId] = useState(null)
  const [noteModalOpen,   setNoteModalOpen]   = useState(false)
  const [notesPanelKey,   setNotesPanelKey]   = useState(0)
  const [notesClassFilter, setNotesClassFilter] = useState([])

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
    FILTER_COLS.forEach(c => { o[c.key] = [...new Set(rows.map(r => r[c.key]).filter(Boolean))].sort() })
    return o
  }, [rows])

  const classOpts = useMemo(() =>
    [...new Set(rows.map(r => r.classe).filter(Boolean))].sort()
  , [rows])

  const toggleNotesClass = useCallback((cls) =>
    setNotesClassFilter(f => f.includes(cls) ? f.filter(v => v !== cls) : [...f, cls])
  , [])

  const toggleFilter = useCallback((col, val) =>
    setFilters(f => {
      const cur  = Array.isArray(f[col]) ? f[col] : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return next.length === 0
        ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== col))
        : { ...f, [col]: next }
    })
  , [])

  const toggleSort = col =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.nom || '').toLowerCase().includes(q) || (r.prenom || '').toLowerCase().includes(q))
    }
    Object.entries(filters).forEach(([col, vals]) => {
      if (Array.isArray(vals) && vals.length > 0) d = d.filter(r => vals.includes(r[col]))
    })
    const { col, dir } = sort
    return [...d].sort((a, b) =>
      String(a[col] || '').localeCompare(String(b[col] || ''), 'fr') * (dir === 'asc' ? 1 : -1)
    )
  }, [rows, search, filters, sort])

  const notesEleves = useMemo(() => {
    if (notesClassFilter.length === 0) return rows
    return rows.filter(r => notesClassFilter.includes(r.classe))
  }, [rows, notesClassFilter])

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>

  const selectedNoteEleve = rows.find(e => e.id === notesSelectedId)

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Élèves"
        subtitle={activeTab === 'groupes'
          ? `Groupes Smartschool — ${rows.length} élèves actifs`
          : 'Notes par élève'}
        tabs={[
          { key: 'groupes', label: 'Groupes' },
          { key: 'notes',   label: 'Notes'   },
        ]}
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab)
          setSearch('')
          setNotesSearch('')
          setNotesSelectedId(null)
        }}
        search={activeTab === 'groupes' ? search : notesSearch}
        onSearch={activeTab === 'groupes' ? setSearch : setNotesSearch}
        searchPlaceholder="Rechercher…"
        filters={activeTab === 'groupes' ? (
          <MasterFilter dark
            filters={filters}
            filterDefs={FILTER_COLS.map(c => ({ key: c.key, label: c.label, options: opts[c.key] || [] }))}
            onChange={toggleFilter}
            onClearAll={() => setFilters({})}
          />
        ) : (
          <MasterFilter dark
            filters={{ classe: notesClassFilter }}
            filterDefs={[{ key: 'classe', label: 'Classe', options: classOpts }]}
            onChange={(col, val) => toggleNotesClass(val)}
            onClearAll={() => setNotesClassFilter([])}
          />
        )}
        info={activeTab === 'groupes'
          ? `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''}`
          : `${notesEleves.length} élève${notesEleves.length !== 1 ? 's' : ''}`}
        actions={activeTab === 'notes' && notesSelectedId ? (
          <button onClick={() => setNoteModalOpen(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold">
            <Plus size={13} /> Nouvelle note
          </button>
        ) : null}
      />

      {activeTab === 'groupes' ? (
        <div className="flex-1 min-h-0 p-6 max-w-screen-xl mx-auto w-full flex flex-col">
          <ActiveFilterChips
            filters={filters}
            filterDefs={FILTER_COLS.map(c => ({ key: c.key, label: c.label, options: opts[c.key] || [] }))}
            onChange={toggleFilter}
          />
          <div className="card p-0 flex-1 overflow-auto min-h-0">
            <table className="text-sm border-collapse"
              style={{ minWidth: `${COLS.reduce((s, c) => s + c.w, 0)}px` }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-600">
                  {COLS.map(c => {
                    const isSticky = c.sticky !== undefined
                    return (
                      <th key={c.key} onClick={() => toggleSort(c.key)}
                        style={{
                          width: c.w, minWidth: c.w,
                          position: isSticky ? 'sticky' : undefined,
                          left: isSticky ? c.sticky : undefined,
                          zIndex: isSticky ? 30 : undefined,
                        }}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400
                          uppercase cursor-pointer select-none whitespace-nowrap bg-gray-50 dark:bg-gray-900
                          hover:text-primary border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                        <span className="flex items-center gap-0.5">
                          {c.label}<SortIcon col={c.key} sort={sort} />
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">Aucun élève</td></tr>
                ) : filtered.map(row => (
                  <tr key={row.id} onClick={() => setFicheId(row.id)}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-primary/5 cursor-pointer group">
                    {COLS.map((c, i) => {
                      const isSticky = c.sticky !== undefined
                      return (
                        <td key={c.key}
                          style={{
                            width: c.w, minWidth: c.w,
                            position: isSticky ? 'sticky' : undefined,
                            left: isSticky ? c.sticky : undefined,
                            zIndex: isSticky ? 10 : undefined,
                          }}
                          className={`px-3 py-2 whitespace-nowrap border-r border-gray-50 dark:border-gray-800
                            last:border-r-0 bg-white dark:bg-gray-800 group-hover:bg-primary/5
                            ${i < 2 ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300 text-sm'}`}>
                          {row[c.key] ?? <span className="text-gray-300 dark:text-gray-600 select-none">—</span>}
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
      ) : (
        <NotesPanel
          key={notesPanelKey}
          eleves={notesEleves}
          onOpenFiche={id => setFicheId(id)}
          setSelectedIdUp={setNotesSelectedId}
          search={notesSearch}
          userId={user?.id}
          userRole={role}
        />
      )}

      {activeTab === 'notes' && ficheId && (
        <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
      )}

      {noteModalOpen && selectedNoteEleve && (
        <NoteModal
          eleve={selectedNoteEleve}
          user={user}
          profile={profile}
          onClose={() => setNoteModalOpen(false)}
          onSaved={() => {
            setNoteModalOpen(false)
            setNotesPanelKey(k => k + 1)
          }}
        />
      )}
    </div>
  )
}
