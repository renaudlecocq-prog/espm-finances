import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'
const fmtEur  = n => Number(n || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const CATEGORIES_ART = ['Frais obligatoires', 'Fournitures scolaires', 'Vêtements', 'Divers']

const STATUTS = {
  brouillon:       { label: 'Brouillon',       cls: 'bg-gray-100 text-gray-600' },
  facture:         { label: 'Facturé',          cls: 'bg-blue-100 text-blue-700' },
  rappel:          { label: 'Rappel',           cls: 'bg-orange-100 text-orange-700' },
  mise_en_demeure: { label: 'Mise en demeure',  cls: 'bg-red-100 text-red-700' },
}

function Badge({ statut }) {
  const s = STATUTS[statut] || { label: statut, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

function isEleveInActivite(eleve, activite) {
  const ci = activite.classes_incluses || []
  const ce = activite.classes_exclues  || []
  const fallback = activite.classes || []
  const classes = ci.length ? ci : fallback
  if (!classes.length) return false
  if (!classes.includes('__ALL__') && !classes.includes(eleve.classe)) return false
  if (ce.includes(eleve.classe)) return false
  return true
}

function prixAttribution(attr) {
  const pu  = Number(attr.prix_unitaire_applique ?? attr.article?.prix_unitaire ?? 0)
  const qty = Number(attr.quantite ?? 1)
  if (attr.quantite_par === 'groupe') return pu * qty / Math.max(Number(attr.nb_eleves || 1), 1)
  return pu * qty
}

function prixActivite(activite) {
  if (activite.montant_par_eleve) return Number(activite.montant_par_eleve)
  const nb = Math.max(Number(activite.nb_eleves || 1), 1)
  return (Number(activite.montant_total || 0) - Number(activite.pop || 0)) / nb
}

// ── Pill filtre classes ───────────────────────────────────────────────────────
function ClassFilterPill({ allClasses, excluded, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const count = excluded.length
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-medium px-3 py-1.5 whitespace-nowrap transition-colors select-none
          ${count > 0 ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'}`}>
        <span>{count > 0 ? `Ignorer ${count} classe${count > 1 ? 's' : ''}` : 'Ignorer des classes'}</span>
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
            {count}
          </span>
        )}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${count > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-52">
          <div className="px-3.5 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Exclure de ce run</span>
            {count > 0 && (
              <button onClick={() => onChange([])} className="text-[10px] text-red-400 hover:text-red-600 font-medium transition-colors">
                Effacer
              </button>
            )}
          </div>
          <div className="py-1.5 max-h-64 overflow-y-auto">
            {allClasses.map(cls => {
              const isExcluded = excluded.includes(cls)
              return (
                <label key={cls}
                  className={`flex items-center gap-2.5 px-3.5 py-1.5 cursor-pointer transition-colors
                    ${isExcluded ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={isExcluded}
                    onChange={() => onChange(isExcluded ? excluded.filter(c => c !== cls) : [...excluded, cls])}
                    className="w-3.5 h-3.5 accent-orange-500 shrink-0" />
                  <span className="text-xs font-medium">{cls}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de facturation ──────────────────────────────────────────────────────
function FacturationModal({ onClose, onDone }) {
  const { user } = useAuth()
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [done, setDone]             = useState(null)

  const [allEleves, setAllEleves]         = useState([])
  const [allClasses, setAllClasses]       = useState([])
  const [attrs, setAttrs]                 = useState([])
  const [activites, setActivites]         = useState([])
  const [selItems, setSelItems]           = useState({})
  const [classesIgnorees, setClassesIgnorees] = useState([])
  // Maps: eleve_id déjà facturé pour un item (pour items partiellement facturés)
  const [billedByAttr, setBilledByAttr]   = useState({})
  const [billedByActiv, setBilledByActiv] = useState({})

  useEffect(() => {
    const load = async () => {
      const [elevesRes, attrsRes, activRes] = await Promise.all([
        supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('classe').order('nom'),
        supabase.from('article_attributions')
          .select('*, article:article_id(nom,categorie,prix_unitaire)')
          .in('statut_facturation', ['a_facturer', 'partiellement_facture']),
        supabase.from('activites')
          .select('*')
          .in('statut_facturation', ['a_facturer', 'partiellement_facture'])
          .eq('statut', 'publie'),
      ])

      const eleves       = elevesRes.data || []
      const pendingAttrs = attrsRes.data  || []
      const pendingActiv = activRes.data  || []

      setAllEleves(eleves)
      setAllClasses([...new Set(eleves.map(e => e.classe).filter(Boolean))].sort())
      setAttrs(pendingAttrs)
      setActivites(pendingActiv)

      // Sélectionner tout par défaut
      const sel = {}
      pendingAttrs.forEach(a => { sel[`attr_${a.id}`] = true })
      pendingActiv.forEach(a => { sel[`activ_${a.id}`] = true })
      setSelItems(sel)

      // Charger les élèves déjà facturés pour les items partiels
      const partialAttrIds  = pendingAttrs.filter(a => a.statut_facturation === 'partiellement_facture').map(a => a.id)
      const partialActivIds = pendingActiv.filter(a => a.statut_facturation === 'partiellement_facture').map(a => a.id)

      if (partialAttrIds.length > 0 || partialActivIds.length > 0) {
        const filters = []
        if (partialAttrIds.length)  filters.push(`article_attribution_id.in.(${partialAttrIds.join(',')})`)
        if (partialActivIds.length) filters.push(`activite_id.in.(${partialActivIds.join(',')})`)

        const { data: lignes } = await supabase
          .from('facture_lignes')
          .select('article_attribution_id, activite_id, facture:facture_id(eleve_id)')
          .or(filters.join(','))

        const byAttr = {}, byActiv = {}
        for (const l of lignes || []) {
          if (!l.facture?.eleve_id) continue
          if (l.article_attribution_id) {
            byAttr[l.article_attribution_id] ??= new Set()
            byAttr[l.article_attribution_id].add(l.facture.eleve_id)
          }
          if (l.activite_id) {
            byActiv[l.activite_id] ??= new Set()
            byActiv[l.activite_id].add(l.facture.eleve_id)
          }
        }
        setBilledByAttr(byAttr)
        setBilledByActiv(byActiv)
      }

      setLoading(false)
    }
    load()
  }, [])

  const toggleItem = key => setSelItems(s => ({ ...s, [key]: !s[key] }))

  // Construire la map { eleveId → [lignes] } en excluant les déjà-facturés et les classes ignorées
  const eleveMap = useMemo(() => {
    const selectedAttrs = attrs.filter(a  => selItems[`attr_${a.id}`])
    const selectedActiv = activites.filter(a => selItems[`activ_${a.id}`])
    const map = {}

    const add = (eleveId, item) => {
      const e = allEleves.find(el => el.id === eleveId)
      if (!e) return
      if (classesIgnorees.includes(e.classe)) return
      if (!map[eleveId]) map[eleveId] = { eleve: e, items: [] }
      map[eleveId].items.push(item)
    }

    for (const attr of selectedAttrs) {
      const alreadyBilled = billedByAttr[attr.id] || new Set()
      const ligne = {
        type: 'article',
        libelle: attr.article?.nom || 'Article',
        categorie: attr.article?.categorie,
        montant: prixAttribution(attr),
        article_attribution_id: attr.id,
        activite_id: null,
      }
      if (attr.eleve_id) {
        if (!alreadyBilled.has(attr.eleve_id)) add(attr.eleve_id, ligne)
      } else {
        const ci = attr.classes_incluses || []
        const ce = attr.classes_exclues  || []
        const ex = new Set(attr.eleves_exclus || [])
        const allMode = ci.includes('__ALL__')
        for (const e of allEleves) {
          if (ex.has(e.id)) continue
          if (!allMode && !ci.includes(e.classe)) continue
          if (ce.includes(e.classe)) continue
          if (alreadyBilled.has(e.id)) continue  // déjà facturé dans un run précédent
          add(e.id, { ...ligne })
        }
      }
    }

    for (const activ of selectedActiv) {
      const alreadyBilled = billedByActiv[activ.id] || new Set()
      const ligne = {
        type: 'activite',
        libelle: activ.intitule,
        categorie: 'Activités',
        montant: prixActivite(activ),
        article_attribution_id: null,
        activite_id: activ.id,
      }
      for (const e of allEleves) {
        if (!isEleveInActivite(e, activ)) continue
        if (alreadyBilled.has(e.id)) continue  // déjà facturé dans un run précédent
        add(e.id, { ...ligne })
      }
    }

    return map
  }, [attrs, activites, selItems, allEleves, classesIgnorees, billedByAttr, billedByActiv])

  const nbEleves    = Object.keys(eleveMap).length
  const totalGlobal = Object.values(eleveMap).reduce((s, { items }) =>
    s + items.reduce((si, i) => si + i.montant, 0), 0)

  // Déterminer si un item est partiellement facturé (certaines classes ignorées dans ce run)
  const isItemPartial = (targetClasses) => {
    if (classesIgnorees.length === 0) return false
    const effective = targetClasses.includes('__ALL__') ? allClasses : targetClasses
    return effective.some(cls => classesIgnorees.includes(cls))
  }

  const generate = async () => {
    if (nbEleves === 0) return
    setGenerating(true)

    const eleveIds = Object.keys(eleveMap)
    const [{ data: paies }, { data: facts }] = await Promise.all([
      supabase.from('paiements').select('eleve_id,montant').in('eleve_id', eleveIds),
      supabase.from('factures').select('eleve_id,montant').in('eleve_id', eleveIds),
    ])
    const soldeMap = {}
    ;(paies || []).forEach(p => { soldeMap[p.eleve_id] = (soldeMap[p.eleve_id] || 0) + Number(p.montant) })
    ;(facts || []).forEach(f => { soldeMap[f.eleve_id] = (soldeMap[f.eleve_id] || 0) - Number(f.montant) })

    const { count } = await supabase.from('factures').select('*', { count: 'exact', head: true })
    let num = (count || 0) + 1
    const year  = new Date().getFullYear()
    const today = new Date().toISOString().slice(0, 10)

    let created = 0
    for (const [eleveId, { items }] of Object.entries(eleveMap)) {
      const total      = items.reduce((s, i) => s + i.montant, 0)
      const soldeAvant = soldeMap[eleveId] || 0
      const { data: facture } = await supabase.from('factures').insert({
        eleve_id: eleveId,
        montant: total,
        date: today,
        statut: 'brouillon',
        numero: `F-${year}-${String(num++).padStart(3, '0')}`,
        solde_avant: soldeAvant,
        solde_apres: soldeAvant - total,
        created_by: user?.id,
      }).select().single()

      if (facture) {
        await supabase.from('facture_lignes').insert(
          items.map(ligne => ({ ...ligne, facture_id: facture.id }))
        )
        created++
      }
    }

    // Marquer chaque attribution article : facturé ou partiellement facturé
    const selectedAttrs = attrs.filter(a => selItems[`attr_${a.id}`])
    for (const attr of selectedAttrs) {
      const ci = attr.eleve_id ? [] : (attr.classes_incluses || [])
      const partial = isItemPartial(ci)
      // Pour un item partiel, on vérifie aussi s'il reste des élèves non facturés
      // en combinant les déjà-facturés + ceux de ce run
      const newStatut = partial ? 'partiellement_facture' : 'facture'
      await supabase.from('article_attributions')
        .update({ statut_facturation: newStatut })
        .eq('id', attr.id)
    }

    // Marquer chaque activité : facturé ou partiellement facturé
    const selectedActiv = activites.filter(a => selItems[`activ_${a.id}`])
    for (const activ of selectedActiv) {
      const ci = activ.classes_incluses || []
      const partial = isItemPartial(ci)
      const newStatut = partial ? 'partiellement_facture' : 'facture'
      await supabase.from('activites')
        .update({ statut_facturation: newStatut })
        .eq('id', activ.id)
    }

    setGenerating(false)
    setDone(created)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={done ? undefined : onClose} />
      <div className="relative z-10 bg-white w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Facturer les éléments en attente</h2>
          <button onClick={done ? onDone : onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Chargement…</div>
          ) : done !== null ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-xl font-bold text-gray-800 mb-2">{done} facture{done !== 1 ? 's' : ''} générée{done !== 1 ? 's' : ''}</p>
              <p className="text-gray-500 text-sm">Les éléments facturés ont été mis à jour (facturé ou partiellement facturé).</p>
              <button onClick={onDone} className="btn-primary mt-6">Fermer et rafraîchir</button>
            </div>
          ) : (
            <div className="p-5 space-y-6">

              {/* Filtre classes */}
              {allClasses.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 shrink-0">Classes :</span>
                  <ClassFilterPill
                    allClasses={allClasses}
                    excluded={classesIgnorees}
                    onChange={setClassesIgnorees}
                  />
                  {classesIgnorees.length > 0 && (
                    <span className="text-xs text-orange-600 font-medium">
                      {classesIgnorees.join(', ')} ignorée{classesIgnorees.length > 1 ? 's' : ''} → items concernés seront marqués <em>Partiel</em>
                    </span>
                  )}
                </div>
              )}

              {/* Articles */}
              {attrs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Articles ({attrs.length})</p>
                    <button onClick={() => {
                      const allOn = attrs.every(a => selItems[`attr_${a.id}`])
                      setSelItems(s => { const n = {...s}; attrs.forEach(a => { n[`attr_${a.id}`] = !allOn }); return n })
                    }} className="text-xs text-primary hover:underline">
                      {attrs.every(a => selItems[`attr_${a.id}`]) ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {attrs.map(a => {
                      const key   = `attr_${a.id}`
                      const prix  = prixAttribution(a)
                      const cible = a.eleve_id
                        ? '1 élève individuel'
                        : ((a.classes_incluses || []).includes('__ALL__') ? 'Toutes classes'
                          : (a.classes_incluses || []).join(', ') || '?')
                      const isPartial = a.statut_facturation === 'partiellement_facture'
                      const alreadyN  = (billedByAttr[a.id] || new Set()).size
                      return (
                        <label key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selItems[key] ? 'border-primary/30 bg-primary/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={!!selItems[key]} onChange={() => toggleItem(key)} className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">{a.article?.nom}</p>
                              {isPartial && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">PARTIEL — {alreadyN} déjà fact.</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{a.article?.categorie} · {cible}{a.nb_eleves ? ` · ${a.nb_eleves} élèves` : ''}</p>
                          </div>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums shrink-0">{fmtEur(prix)}<span className="text-gray-400 font-normal">/élève</span></span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Activités */}
              {activites.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activités ({activites.length})</p>
                    <button onClick={() => {
                      const allOn = activites.every(a => selItems[`activ_${a.id}`])
                      setSelItems(s => { const n = {...s}; activites.forEach(a => { n[`activ_${a.id}`] = !allOn }); return n })
                    }} className="text-xs text-primary hover:underline">
                      {activites.every(a => selItems[`activ_${a.id}`]) ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {activites.map(a => {
                      const key   = `activ_${a.id}`
                      const prix  = prixActivite(a)
                      const cible = (a.classes_incluses || []).includes('__ALL__') ? 'Toutes classes'
                        : (a.classes_incluses || []).join(', ') || a.classes?.join(', ') || '?'
                      const isPartial = a.statut_facturation === 'partiellement_facture'
                      const alreadyN  = (billedByActiv[a.id] || new Set()).size
                      return (
                        <label key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selItems[key] ? 'border-primary/30 bg-primary/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={!!selItems[key]} onChange={() => toggleItem(key)} className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">{a.intitule}</p>
                              {isPartial && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">PARTIEL — {alreadyN} déjà fact.</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{cible}{a.nb_eleves ? ` · ${a.nb_eleves} élèves` : ''}</p>
                          </div>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums shrink-0">{fmtEur(prix)}<span className="text-gray-400 font-normal">/élève</span></span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {attrs.length === 0 && activites.length === 0 && (
                <div className="py-16 text-center text-gray-400">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-medium">Tout est à jour</p>
                  <p className="text-sm mt-1">Aucun article ou activité en attente de facturation.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && done === null && (attrs.length > 0 || activites.length > 0) && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-gray-500">
                {classesIgnorees.length > 0 ? `Hors ${classesIgnorees.join(', ')}` : 'Toutes les classes'}&ensp;·&ensp;
                <span className="font-medium text-gray-700">{nbEleves} élève{nbEleves !== 1 ? 's' : ''}</span>
              </span>
              <span className="font-bold text-gray-800">{fmtEur(totalGlobal)}</span>
            </div>
            {classesIgnorees.length > 0 && (
              <p className="text-xs text-orange-600 mb-3">
                ⚠ Les items qui ciblent des classes ignorées seront marqués <strong>Partiellement facturé</strong> et réapparaîtront lors du prochain run.
              </p>
            )}
            <button onClick={generate} disabled={generating || nbEleves === 0}
              className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {generating
                ? 'Génération en cours…'
                : `Générer ${nbEleves} facture${nbEleves !== 1 ? 's' : ''} · ${fmtEur(totalGlobal)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Liste des factures ────────────────────────────────────────────────────────
function ListeFactures({ onNew, onSelect }) {
  const [factures, setFactures] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('factures')
      .select('*, eleve:eleve_id(nom,prenom,classe)')
      .order('date', { ascending: false })
      .then(({ data }) => { setFactures(data || []); setLoading(false) })
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Factures</h1>
          <p className="text-gray-500 text-sm mt-0.5">{factures.length} facture{factures.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onNew} className="btn-primary">+ Facturer</button>
      </div>

      {factures.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-medium">Aucune facture</p>
          <p className="text-sm mt-1">Cliquez sur "+ Facturer" pour générer les premières factures.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['N°','Date','Élève','Classe','Montant','Solde après','Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map(f => (
                <tr key={f.id} onClick={() => onSelect(f.id)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.numero || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(f.date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{f.eleve?.prenom} {f.eleve?.nom}</td>
                  <td className="px-4 py-3 text-gray-500">{f.eleve?.classe || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmtEur(f.montant)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold tabular-nums ${Number(f.solde_apres) < 0 ? 'text-red-600' : Number(f.solde_apres) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {fmtEur(f.solde_apres)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge statut={f.statut} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Détail d'une facture ──────────────────────────────────────────────────────
function DetailFacture({ factureId, onBack }) {
  const { isFinancier } = useAuth()
  const [facture, setFacture] = useState(null)
  const [lignes, setLignes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const load = async () => {
    const [{ data: f }, { data: l }] = await Promise.all([
      supabase.from('factures').select('*, eleve:eleve_id(nom,prenom,classe,rue,code_postal,commune)').eq('id', factureId).single(),
      supabase.from('facture_lignes').select('*').eq('facture_id', factureId).order('type').order('categorie'),
    ])
    setFacture(f); setLignes(l || []); setLoading(false)
  }

  useEffect(() => { load() }, [factureId])

  const setStatut = async (statut) => {
    setSaving(true)
    await supabase.from('factures').update({ statut }).eq('id', factureId)
    await load(); setSaving(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>
  if (!facture) return <div className="p-8 text-center text-gray-400">Facture introuvable.</div>

  const articles  = lignes.filter(l => l.type === 'article')
  const activites = lignes.filter(l => l.type === 'activite')
  const artByCat  = CATEGORIES_ART.reduce((acc, cat) => {
    const items = articles.filter(l => l.categorie === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})
  const autresArt = articles.filter(l => !CATEGORIES_ART.includes(l.categorie))
  if (autresArt.length) artByCat['Autres'] = autresArt

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1">
        ← Retour aux factures
      </button>

      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-gray-800">{facture.numero || 'Facture'}</h1>
              <Badge statut={facture.statut} />
            </div>
            <p className="font-medium text-gray-700">{facture.eleve?.prenom} {facture.eleve?.nom}</p>
            <p className="text-sm text-gray-400">{facture.eleve?.classe}</p>
            {facture.eleve?.rue && (
              <p className="text-sm text-gray-400 mt-1">{facture.eleve.rue}, {facture.eleve.code_postal} {facture.eleve.commune}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 uppercase">Date</p>
            <p className="font-semibold text-gray-700">{fmtDate(facture.date)}</p>
          </div>
        </div>
        {isFinancier && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
            {facture.statut === 'brouillon' && <button onClick={() => setStatut('facture')} disabled={saving} className="btn-primary text-sm py-1.5">✓ Marquer comme facturé</button>}
            {facture.statut === 'facture' && <button onClick={() => setStatut('rappel')} disabled={saving} className="btn-secondary text-sm py-1.5 text-orange-600">⚠ Rappel</button>}
            {facture.statut === 'rappel' && <button onClick={() => setStatut('mise_en_demeure')} disabled={saving} className="btn-secondary text-sm py-1.5 text-red-600">🚨 Mise en demeure</button>}
            {facture.statut !== 'brouillon' && <button onClick={() => setStatut('brouillon')} disabled={saving} className="btn-secondary text-sm py-1.5">↩ Brouillon</button>}
          </div>
        )}
      </div>

      <div className="card p-4 mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Solde de départ</span>
        <span className={`text-lg font-bold tabular-nums ${Number(facture.solde_avant) < 0 ? 'text-red-600' : Number(facture.solde_avant) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
          {fmtEur(facture.solde_avant)}
        </span>
      </div>

      {Object.keys(artByCat).length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Articles</h2>
          {Object.entries(artByCat).map(([cat, items]) => (
            <div key={cat} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-gray-400 mb-1.5">{cat}</p>
              {items.map(l => (
                <div key={l.id} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-700">{l.libelle}</span>
                  <span className="font-medium text-gray-800 tabular-nums">{fmtEur(l.montant)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 text-xs text-gray-400">
                <span>Sous-total {cat.toLowerCase()}</span>
                <span className="tabular-nums">{fmtEur(items.reduce((s, l) => s + Number(l.montant), 0))}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activites.length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Activités</h2>
          {activites.map(l => (
            <div key={l.id} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-700">{l.libelle}</span>
              <span className="font-medium text-gray-800 tabular-nums">{fmtEur(l.montant)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1.5 text-xs text-gray-400">
            <span>Sous-total activités</span>
            <span className="tabular-nums">{fmtEur(activites.reduce((s, l) => s + Number(l.montant), 0))}</span>
          </div>
        </div>
      )}

      <div className="card p-5 bg-gray-50">
        <div className="space-y-2 text-sm">
          {Object.entries(artByCat).map(([cat, items]) => (
            <div key={cat} className="flex justify-between text-gray-500">
              <span>{cat}</span><span className="tabular-nums">{fmtEur(items.reduce((s, l) => s + Number(l.montant), 0))}</span>
            </div>
          ))}
          {activites.length > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Activités</span><span className="tabular-nums">{fmtEur(activites.reduce((s, l) => s + Number(l.montant), 0))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-2 text-base">
            <span>Total facturé</span><span className="tabular-nums">{fmtEur(facture.montant)}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-gray-600">Solde après facturation</span>
            <span className={`font-bold text-xl tabular-nums ${Number(facture.solde_apres) < 0 ? 'text-red-600' : Number(facture.solde_apres) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {fmtEur(facture.solde_apres)}
            </span>
          </div>
        </div>
        {facture.notes && <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-200 italic">{facture.notes}</p>}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Factures() {
  const { isFinancier } = useAuth()
  const [modal, setModal]           = useState(false)
  const [viewId, setViewId]         = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  if (viewId) return <DetailFacture factureId={viewId} onBack={() => setViewId(null)} />

  return (
    <>
      <ListeFactures
        key={refreshKey}
        onNew={() => isFinancier && setModal(true)}
        onSelect={setViewId}
      />
      {modal && (
        <FacturationModal
          onClose={() => setModal(false)}
          onDone={() => { setModal(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </>
  )
}
