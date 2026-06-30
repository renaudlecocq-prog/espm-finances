import { useIsMobile } from "../hooks/useIsMobile"
import MobileUnavailable from "../components/layout/MobileUnavailable"
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'

// ── Utilitaires ───────────────────────────────────────────────────────────────
function anneeScolaireAuto() {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Icônes ────────────────────────────────────────────────────────────────────
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/><path d="M6 15h2M10 15h4"/>
    </svg>
  )
}

function DiplomaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
    </svg>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Generateur() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileUnavailable pageName="Générateur de documents" />

  const { token } = (() => { try { return { token: null } } catch { return { token: null } } })()

  const [docType, setDocType]           = useState('cartes')
  const [eleves, setEleves]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterClasse, setFilterClasse] = useState('all')
  const [selected, setSelected]         = useState(new Set())
  const [generating, setGenerating]     = useState(false)

  const [anneeScolaire, setAnneeScolaire]       = useState(anneeScolaireAuto())
  const [dateProclamation, setDateProclamation] = useState('')

  // Auth token depuis Supabase session
  const [authToken, setAuthToken] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthToken(data.session?.access_token || null))
  }, [])

  useEffect(() => { loadEleves() }, [])
  useEffect(() => { setSelected(new Set()) }, [filterClasse, docType])

  async function loadEleves() {
    setLoading(true)
    const { data, error } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, classe, photo_url, sortie_midi, licenciement')
      .eq('actif', true)
      .order('nom').order('prenom')
    if (!error && data) setEleves(data)
    setLoading(false)
  }

  const classes = [...new Set(eleves.map(e => e.classe).filter(Boolean))].sort()
  const classeSelectionnee = filterClasse !== 'all'

  const filtered = eleves.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      e.nom?.toLowerCase().includes(q) ||
      e.prenom?.toLowerCase().includes(q) ||
      e.matricule?.includes(q)
    const matchClasse = filterClasse === 'all' || e.classe === filterClasse
    return matchSearch && matchClasse
  })

  const allFilteredIds      = filtered.map(e => e.id)
  const allFilteredSelected = classeSelectionnee && allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))
  const selectedCount       = selected.size
  const pageCount           = selectedCount * 2

  function toggleOne(id) {
    if (!classeSelectionnee) return
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    if (!classeSelectionnee) return
    const allSel = allFilteredIds.every(id => selected.has(id))
    setSelected(prev => {
      const n = new Set(prev)
      allSel ? allFilteredIds.forEach(id => n.delete(id)) : allFilteredIds.forEach(id => n.add(id))
      return n
    })
  }

  // ── Génération cartes (Netlify function) ─────────────────────────────────────
  async function genererCartes() {
    if (selected.size === 0 || !classeSelectionnee) return
    setGenerating(true)
    try {
      const res = await fetch('/.netlify/functions/carte-etudiant-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], token: authToken }),
      })
      if (!res.ok) { alert('Erreur génération PDF : ' + res.status); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `cartes-${filterClasse.replace(/\s+/g, '-')}.pdf`
      a.click(); URL.revokeObjectURL(url)
    } finally { setGenerating(false) }
  }

  // ── Génération diplômes (client-side via fetch template + window.print) ──────
  async function genererDiplomes() {
    if (selected.size === 0 || !classeSelectionnee) return
    setGenerating(true)
    try {
      // Récupérer le gabarit HTML (servi en statique)
      const res = await fetch('/gabarit-diplome-espm.html')
      if (!res.ok) throw new Error('Impossible de charger le gabarit')
      const templateHtml = await res.text()

      // Extraire head et body du gabarit
      const headMatch = templateHtml.match(/<head>([\s\S]*?)<\/head>/)
      const headInner = headMatch ? headMatch[1] : ''
      const bodyStart    = templateHtml.indexOf('<body>') + '<body>'.length
      const bodyEnd      = templateHtml.lastIndexOf('</body>')
      const pageTemplate = templateHtml.slice(bodyStart, bodyEnd).trim()

      // Récupérer les élèves sélectionnés (dans l'ordre)
      const selectedEleves = eleves.filter(e => selected.has(e.id))

      // Générer une page par élève
      const pages = selectedEleves.map((e, idx) => {
        const pageHtml = pageTemplate
          .replaceAll('{{PRENOM}}', escapeHtml(e.prenom || ''))
          .replaceAll('{{NOM}}',    escapeHtml(e.nom || ''))
          .replaceAll('{{ANNEE_SCOLAIRE}}',    escapeHtml(anneeScolaire))
          .replaceAll('{{DATE_PROCLAMATION}}', escapeHtml(dateProclamation))
        if (idx === 0) return pageHtml
        return pageHtml.replace('<div class="d-page">', '<div class="d-page" style="page-break-before:always;">')
      })

      // CSS supplémentaire impression
      const printCss = `<style>
        body { background:#fff!important; display:block!important; min-height:0!important; padding:0; margin:0; }
        .d-page { box-shadow:none!important; margin:0!important; }
        @page { size:A4 landscape; margin:0; }
      </style>`

      const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>${headInner}${printCss}</head>
<body>${pages.join('\n')}</body>
</html>`

      // Ouvrir dans un nouvel onglet et déclencher l'impression
      const win = window.open('', '_blank')
      if (!win) { alert('Veuillez autoriser les pop-ups pour cette page.'); return }
      win.document.write(fullHtml)
      win.document.close()

      // Attendre que les fonts Google soient chargées avant d'imprimer
      win.onload = () => {
        // Délai supplémentaire pour Google Fonts
        setTimeout(() => win.print(), 1200)
      }
      // Fallback si onload ne se déclenche pas
      setTimeout(() => { if (!win.closed) win.print() }, 3500)

    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const selectStyle = {
    height: '28px', fontSize: '12px', borderRadius: '8px',
    backgroundColor: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.11)',
    color: 'white', padding: '0 8px', outline: 'none', cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none', minWidth: '150px',
  }

  const inputStyle = {
    height: '28px', fontSize: '12px', borderRadius: '8px',
    backgroundColor: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.11)',
    color: 'white', padding: '0 8px', outline: 'none',
  }

  const isDiplomes  = docType === 'diplomes'
  const canGenerate = selectedCount > 0 && classeSelectionnee
  const btnLabel    = generating ? 'Génération…'
    : isDiplomes ? 'Imprimer les diplômes' : 'Imprimer les cartes'

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Générateur"
        subtitle="Documents et impressions"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Rechercher un élève…"
        filters={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)} style={selectStyle}>
              <option value="all" style={{ background: '#2D1B2E' }}>— Choisir une classe —</option>
              {classes.map(c => (
                <option key={c} value={c} style={{ background: '#2D1B2E' }}>{c}</option>
              ))}
            </select>
            {isDiplomes && (
              <>
                <input type="text" value={anneeScolaire}
                  onChange={e => setAnneeScolaire(e.target.value)}
                  placeholder="ex. 2025-2026"
                  style={{ ...inputStyle, width: '110px' }}
                  title="Année scolaire" />
                <input type="text" value={dateProclamation}
                  onChange={e => setDateProclamation(e.target.value)}
                  placeholder="ex. 27 juin 2026"
                  style={{ ...inputStyle, width: '150px' }}
                  title="Date de proclamation" />
              </>
            )}
          </div>
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {classeSelectionnee && selectedCount > 0 && (
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'white' }}>{selectedCount}</strong> élève{selectedCount > 1 ? 's' : ''}
                {!isDiplomes && (
                  <> · <strong style={{ color: 'white' }}>{pageCount}</strong> page{pageCount > 1 ? 's' : ''}</>
                )}
              </span>
            )}
            <button
              onClick={isDiplomes ? genererDiplomes : genererCartes}
              disabled={!canGenerate || generating}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                height: '28px', padding: '0 12px', borderRadius: '8px',
                fontSize: '12px', fontWeight: '600',
                cursor: !canGenerate ? 'default' : 'pointer',
                backgroundColor: !canGenerate ? 'rgba(255,255,255,0.1)' : '#F16410',
                color: !canGenerate ? 'rgba(255,255,255,0.35)' : 'white',
                border: 'none', transition: 'background 0.15s',
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              {btnLabel}
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Panneau gauche */}
        <aside className="w-52 flex-none border-r border-gray-200 bg-gray-50 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-2">Documents</p>

          <button onClick={() => setDocType('cartes')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left mb-1.5 transition-colors ${
              docType === 'cartes' ? 'bg-[#2D1B2E] text-white' : 'hover:bg-gray-100 text-gray-700'
            }`}>
            <span style={{ color: docType === 'cartes' ? '#F16410' : '#9ca3af' }}><CardIcon /></span>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight">Carte d'étudiant</div>
              <div className={`text-xs mt-0.5 ${docType === 'cartes' ? 'text-gray-300' : 'text-gray-400'}`}>Dymo LabelWriter</div>
            </div>
          </button>

          <button onClick={() => setDocType('diplomes')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
              docType === 'diplomes' ? 'bg-[#2D1B2E] text-white' : 'hover:bg-gray-100 text-gray-700'
            }`}>
            <span style={{ color: docType === 'diplomes' ? '#F16410' : '#9ca3af' }}><DiplomaIcon /></span>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight">Diplôme</div>
              <div className={`text-xs mt-0.5 ${docType === 'diplomes' ? 'text-gray-300' : 'text-gray-400'}`}>Proclamation A4 paysage</div>
            </div>
          </button>
        </aside>

        {/* Panneau droit */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!classeSelectionnee ? (
            <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-blue-100 flex-none">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-blue-700">Sélectionnez une classe dans le filtre ci-dessus pour pouvoir choisir des élèves.</span>
            </div>
          ) : isDiplomes ? (
            <div className="flex items-center gap-2 px-5 py-2 bg-purple-50 border-b border-purple-100 flex-none">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-purple-700">
                Format A4 paysage · Impression via le navigateur · Assurez-vous que l'accès aux pop-ups est autorisé
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100 flex-none">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-amber-700">
                Format 69,8 × 54 mm — Dymo LabelWriter monochrome · 2 pages par carte (recto + verso)
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <svg className="animate-spin mr-2" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Chargement…
              </div>
            ) : !classeSelectionnee ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                </svg>
                <p className="text-sm font-medium text-gray-500">Choisissez une classe pour commencer</p>
                <p className="text-xs text-gray-400">Les documents sont générés classe par classe</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <p className="mt-3 text-sm">Aucun élève trouvé</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                  <tr>
                    <th className="w-12 py-2.5 px-4 text-center">
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}
                        disabled={!classeSelectionnee} className="accent-[#2D1B2E] w-4 h-4 cursor-pointer"/>
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Élève</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Classe</th>
                    {!isDiplomes && (
                      <>
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Matricule</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Sortie midi</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Licenc.</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => {
                    const isSel = selected.has(e.id)
                    return (
                      <tr key={e.id} onClick={() => toggleOne(e.id)}
                        className={`border-b border-gray-50 transition-colors ${
                          classeSelectionnee ? 'cursor-pointer' : 'cursor-default opacity-50'
                        } ${isSel ? 'bg-[#2D1B2E]/5' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/60'}`}>
                        <td className="py-2 px-4 text-center">
                          <input type="checkbox" checked={isSel} disabled={!classeSelectionnee}
                            onChange={() => toggleOne(e.id)} onClick={ev => ev.stopPropagation()}
                            className="accent-[#2D1B2E] w-4 h-4 cursor-pointer"/>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-gray-900">{e.nom}</span>
                          <span className="text-gray-500 ml-1">{e.prenom}</span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 text-sm">{e.classe || '—'}</td>
                        {!isDiplomes && (
                          <>
                            <td className="py-2 px-3 text-gray-500 font-mono text-xs">{e.matricule || '—'}</td>
                            <td className="py-2 px-3 text-center">
                              {e.sortie_midi === null || e.sortie_midi === undefined
                                ? <span className="text-gray-300 text-xs">—</span>
                                : e.sortie_midi
                                  ? <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Oui</span>
                                  : <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Non</span>}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {e.licenciement === null || e.licenciement === undefined
                                ? <span className="text-gray-300 text-xs">—</span>
                                : e.licenciement
                                  ? <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Oui</span>
                                  : <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Non</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
