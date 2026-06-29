import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'

// ── Utilitaires ───────────────────────────────────────────────────────────────
function getAnneeEtude(classe) {
  if (!classe) return '—'
  const m = classe.match(/^(\d)/)
  if (!m) return classe
  const n = parseInt(m[1])
  return `${n}${n === 1 ? 'ère' : 'ème'} année`
}

// ── Icône Carte ───────────────────────────────────────────────────────────────
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
      <path d="M6 15h2M10 15h4"/>
    </svg>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Generateur() {
  const { token } = useAuth()

  // Sélection du générateur actif
  const [activeGenerator, setActiveGenerator] = useState('carte-etudiant')

  // Données élèves
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtres + sélection
  const [search, setSearch]     = useState('')
  const [filterClasse, setFilterClasse] = useState('all')
  const [selected, setSelected] = useState(new Set())

  // Génération en cours
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadEleves()
  }, [])

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

  // ── Dérivés ─────────────────────────────────────────────────────────────────
  const classes = [...new Set(eleves.map(e => e.classe).filter(Boolean))].sort()

  const filtered = eleves.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      e.nom?.toLowerCase().includes(q) ||
      e.prenom?.toLowerCase().includes(q) ||
      e.matricule?.includes(q)
    const matchClasse = filterClasse === 'all' || e.classe === filterClasse
    return matchSearch && matchClasse
  })

  const allFilteredIds  = filtered.map(e => e.id)
  const selectedCount   = selected.size
  const pageCount       = selectedCount * 2  // recto + verso

  // ── Sélection ───────────────────────────────────────────────────────────────
  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const allSelected = allFilteredIds.every(id => selected.has(id))
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  // ── Génération ───────────────────────────────────────────────────────────────
  async function genererCartes() {
    if (selected.size === 0) return
    setGenerating(true)
    try {
      const ids = [...selected].join(',')
      const base = window.location.origin
      const url = `${base}/.netlify/functions/carte-etudiant-pdf?ids=${encodeURIComponent(ids)}&token=${encodeURIComponent(token)}`
      window.open(url, '_blank')
    } finally {
      setGenerating(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Générateur"
        subtitle="Documents et impressions"
        icon={
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        }
      />

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Panneau gauche — liste des générateurs disponibles */}
        <aside className="w-56 flex-none border-r border-gray-200 bg-gray-50 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-2">Documents</p>
          <button
            onClick={() => setActiveGenerator('carte-etudiant')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
              activeGenerator === 'carte-etudiant'
                ? 'bg-[#2D1B2E] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className={activeGenerator === 'carte-etudiant' ? 'text-[#F16410]' : 'text-gray-400'}>
              <CardIcon />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight">Carte d'étudiant</div>
              <div className={`text-xs mt-0.5 ${activeGenerator === 'carte-etudiant' ? 'text-gray-300' : 'text-gray-400'}`}>
                Dymo LabelWriter
              </div>
            </div>
          </button>
        </aside>

        {/* Panneau droit — configuration + liste */}
        {activeGenerator === 'carte-etudiant' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Barre d'outils */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-40 max-w-72">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24"
                  width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un élève…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input pl-9 h-9 text-sm w-full"
                />
              </div>

              {/* Filtre classe */}
              <select
                value={filterClasse}
                onChange={e => setFilterClasse(e.target.value)}
                className="input h-9 text-sm pr-8 min-w-32"
              >
                <option value="all">Toutes les classes</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Sélectionner tout (filtré) */}
              <button
                onClick={toggleAll}
                className="btn-ghost text-sm h-9 px-3 flex items-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  {allFilteredSelected
                    ? <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>
                    : <rect x="3" y="3" width="18" height="18" rx="2"/>}
                </svg>
                {allFilteredSelected ? 'Désélectionner tout' : 'Sélectionner tout'}
              </button>

              <div className="flex-1" />

              {/* Compteur */}
              <div className="text-sm text-gray-500 whitespace-nowrap">
                {selectedCount === 0 ? (
                  <span>Aucun élève sélectionné</span>
                ) : (
                  <span>
                    <strong className="text-[#2D1B2E]">{selectedCount}</strong> élève{selectedCount > 1 ? 's' : ''} ·{' '}
                    <strong className="text-[#2D1B2E]">{pageCount}</strong> page{pageCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Bouton Générer */}
              <button
                onClick={genererCartes}
                disabled={selectedCount === 0 || generating}
                className="btn-primary h-9 px-4 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Imprimer les cartes
              </button>
            </div>

            {/* Légende format */}
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                stroke="#b45309" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-xs text-amber-700">
                Format 69,8 × 54 mm — Dymo LabelWriter monochrome · 2 pages par carte (recto + verso)
              </span>
            </div>

            {/* Liste des élèves */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <svg className="animate-spin mr-2" viewBox="0 0 24 24" width="20" height="20"
                    fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Chargement…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none"
                    stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <p className="mt-3 text-sm">Aucun élève trouvé</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                    <tr>
                      <th className="w-12 py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAll}
                          className="accent-[#2D1B2E] w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Élève</th>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Classe</th>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Matricule</th>
                      <th className="py-2.5 px-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Sortie midi</th>
                      <th className="py-2.5 px-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Licenc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, i) => {
                      const isSelected = selected.has(e.id)
                      return (
                        <tr
                          key={e.id}
                          onClick={() => toggleOne(e.id)}
                          className={`cursor-pointer border-b border-gray-50 transition-colors ${
                            isSelected
                              ? 'bg-[#2D1B2E]/5'
                              : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/60'
                          }`}
                        >
                          <td className="py-2.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(e.id)}
                              onClick={ev => ev.stopPropagation()}
                              className="accent-[#2D1B2E] w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-900">{e.nom}</span>
                            <span className="text-gray-500 ml-1">{e.prenom}</span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">{e.classe || '—'}</td>
                          <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{e.matricule || '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            {e.sortie_midi === null || e.sortie_midi === undefined ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : e.sortie_midi ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Oui</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Non</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {e.licenciement === null || e.licenciement === undefined ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : e.licenciement ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Oui</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Non</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
