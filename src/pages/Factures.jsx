import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'
const fmtEur  = n => Number(n || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const CATEGORIES_ART = ['Frais obligatoires', 'Fournitures scolaires', 'Vêtements', 'Divers']

const STATUTS = {
  brouillon:       { label: 'En attente',      cls: 'bg-orange-100 text-orange-700' },
  ignore:          { label: 'Ignoré',           cls: 'bg-gray-100 text-gray-400' },
  facture:         { label: 'Validé',           cls: 'bg-green-100 text-green-700' },
  rappel:          { label: 'Rappel',           cls: 'bg-orange-200 text-orange-800' },
  mise_en_demeure: { label: 'Mise en demeure',  cls: 'bg-red-100 text-red-700' },
}

function Badge({ statut }) {
  const s = STATUTS[statut] || { label: statut, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

// Calcul des impayés par facture (priorité chronologique par élève)
// allFactures : [{id, eleve_id, montant, date, created_at}]
// paiementsMap : {eleve_id -> totalPaiements}
// Retourne : {factureId -> montantImpayé}
function calcImpayes(allFactures, paiementsMap) {
  // Grouper par élève
  const byEleve = {}
  for (const f of allFactures) {
    if (!byEleve[f.eleve_id]) byEleve[f.eleve_id] = []
    byEleve[f.eleve_id].push(f)
  }
  const result = {}
  for (const [eleveId, facs] of Object.entries(byEleve)) {
    // Tri chronologique (date puis created_at)
    facs.sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date)
      return d !== 0 ? d : new Date(a.created_at) - new Date(b.created_at)
    })
    let credit = paiementsMap[eleveId] || 0
    for (const f of facs) {
      const montant = Number(f.montant)
      if (credit >= montant) {
        result[f.id] = 0
        credit -= montant
      } else {
        result[f.id] = montant - credit
        credit = 0
      }
    }
  }
  return result
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
  const [progress, setProgress]     = useState(null)  // { step, current, total }
  const [done, setDone]             = useState(null)  // { count, batchId }
  const [nomBatch, setNomBatch]     = useState('')

  const [allEleves, setAllEleves]         = useState([])
  const [allClasses, setAllClasses]       = useState([])
  const [attrs, setAttrs]                 = useState([])
  const [activites, setActivites]         = useState([])
  const [selItems, setSelItems]           = useState({})
  const [classesIgnorees, setClassesIgnorees] = useState([])
  const [billedByAttr, setBilledByAttr]   = useState({})
  const [billedByActiv, setBilledByActiv] = useState({})

  useEffect(() => {
    const load = async () => {
      const chunkFn = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i) => arr.slice(i*n,(i+1)*n))

      const [elevesRes, attrsRes, activRes] = await Promise.all([
        supabase.from('eleves').select('id,nom,prenom,classe,matricule').eq('actif', true).order('classe').order('nom'),
        supabase.from('article_attributions')
          .select('*, article:article_id(nom,categorie,prix_unitaire)')
          .eq('statut_facturation', 'a_facturer'),
        supabase.from('activites')
          .select('*')
          .eq('statut_facturation', 'a_facturer')
          .eq('statut', 'publie'),
      ])
      const eleves = elevesRes.data || []
      let pendingAttrs = attrsRes.data || []
      let pendingActiv = activRes.data || []

      setAllEleves(eleves)
      setAllClasses([...new Set(eleves.map(e => e.classe).filter(Boolean))].sort())

      // Exclure les items déjà dans un batch en brouillon → évite double facturation
      const { data: brouillonFacs } = await supabase.from('factures').select('id').eq('statut', 'brouillon')
      const bfIds = (brouillonFacs || []).map(f => f.id)
      if (bfIds.length > 0) {
        const attrsBilled = new Set(), activBilled = new Set()
        for (const slice of chunkFn(bfIds, 50)) {
          const { data: ls } = await supabase.from('facture_lignes')
            .select('article_attribution_id, activite_id').in('facture_id', slice)
          for (const l of (ls || [])) {
            if (l.article_attribution_id) attrsBilled.add(l.article_attribution_id)
            if (l.activite_id) activBilled.add(l.activite_id)
          }
        }
        pendingAttrs = pendingAttrs.filter(a => !attrsBilled.has(a.id))
        pendingActiv = pendingActiv.filter(a => !activBilled.has(a.id))
      }

      setAttrs(pendingAttrs)
      setActivites(pendingActiv)
      const sel = {}
      pendingAttrs.forEach(a => { sel[`attr_${a.id}`]  = true })
      pendingActiv.forEach(a => { sel[`activ_${a.id}`] = true })
      setSelItems(sel)
      setLoading(false)
    }
    load()
  }, [])

  const toggleItem = key => setSelItems(s => ({ ...s, [key]: !s[key] }))

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
      const ligne = { type: 'article', libelle: attr.article?.nom || 'Article', categorie: attr.article?.categorie,
        montant: prixAttribution(attr), article_attribution_id: attr.id, activite_id: null }
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
          if (alreadyBilled.has(e.id)) continue
          add(e.id, { ...ligne })
        }
      }
    }
    for (const activ of selectedActiv) {
      const alreadyBilled = billedByActiv[activ.id] || new Set()
      const ligne = { type: 'activite', libelle: activ.intitule, categorie: 'Activités',
        montant: prixActivite(activ), article_attribution_id: null, activite_id: activ.id }
      for (const e of allEleves) {
        if (!isEleveInActivite(e, activ)) continue
        if (alreadyBilled.has(e.id)) continue
        add(e.id, { ...ligne })
      }
    }
    return map
  }, [attrs, activites, selItems, allEleves, classesIgnorees, billedByAttr, billedByActiv])

  const nbEleves    = Object.keys(eleveMap).length
  const totalGlobal = Object.values(eleveMap).reduce((s, { items }) =>
    s + items.reduce((si, i) => si + i.montant, 0), 0)

  const isItemPartial = (targetClasses) => {
    if (classesIgnorees.length === 0) return false
    const effective = targetClasses.includes('__ALL__') ? allClasses : targetClasses
    return effective.some(cls => classesIgnorees.includes(cls))
  }

  const generate = async () => {
    if (nbEleves === 0) return
    setGenerating(true)
    const chunk = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i) => arr.slice(i*n,(i+1)*n))

    // 1. Créer le batch (format F-AAMMJJ-NN)
    setProgress({ step: 'Création du batch…', current: 0, total: 0 })
    const now = new Date()
    const y = now.getFullYear().toString().slice(2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const baseNumero = `F-${y}${m}${d}`
    const { data: existing } = await supabase.from('facture_batches').select('numero').like('numero', `${baseNumero}%`)
    const runNumber = (existing?.length || 0) + 1
    const batchNumero = `${baseNumero}-${String(runNumber).padStart(2, '0')}`
    const { data: batch } = await supabase.from('facture_batches')
      .insert({ numero: batchNumero, date: now.toISOString().slice(0, 10), statut: 'brouillon', created_by: user?.id, nom: nomBatch.trim() || null })
      .select().single()
    if (!batch) { setGenerating(false); setProgress(null); return }

    // 2. Calculer soldes (query globale — pas de .in() pour éviter la limite URL)
    setProgress({ step: 'Calcul des soldes…', current: 0, total: 0 })
    const [{ data: paies }, { data: facts }] = await Promise.all([
      supabase.from('paiements').select('eleve_id,montant'),
      supabase.from('factures').select('eleve_id,montant'),
    ])
    const soldeMap = {}
    ;(paies || []).forEach(p => { soldeMap[p.eleve_id] = (soldeMap[p.eleve_id] || 0) + Number(p.montant) })
    ;(facts || []).forEach(f => { soldeMap[f.eleve_id] = (soldeMap[f.eleve_id] || 0) - Number(f.montant) })

    // 3. Préparer toutes les données factures (numérotation matricule)
    const today = now.toISOString().slice(0, 10)

    const entries = Object.entries(eleveMap)
    const allFactureData = entries.map(([eleveId, { eleve, items }], idx) => {
      const total      = items.reduce((s, i) => s + i.montant, 0)
      const soldeAvant = soldeMap[eleveId] || 0
      const matricule  = eleve.matricule || String(idx + 1).padStart(6, '0')
      const numero     = `${batchNumero}-${matricule}`
      return { eleveId, items, numero, insertData: {
        eleve_id: eleveId, montant: total, date: today,
        statut: 'brouillon', numero,
        solde_avant: soldeAvant, solde_apres: soldeAvant - total,
        created_by: user?.id, batch_id: batch.id,
      }}
    })

    // 4. Insérer les factures par lots de 50
    const factureChunks = chunk(allFactureData, 50)
    const insertedFactures = []
    for (let i = 0; i < factureChunks.length; i++) {
      setProgress({ step: 'Génération des factures…', current: i + 1, total: factureChunks.length })
      const { data } = await supabase.from('factures')
        .insert(factureChunks[i].map(e => e.insertData)).select()
      insertedFactures.push(...(data || []))
    }

    // 5. Construire et insérer toutes les lignes par lots de 100
    const factureByNumero = Object.fromEntries(insertedFactures.map(f => [f.numero, f]))
    const allLignes = []
    for (const entry of allFactureData) {
      const facture = factureByNumero[entry.numero]
      if (facture) entry.items.forEach(ligne => allLignes.push({ ...ligne, facture_id: facture.id }))
    }
    const ligneChunks = chunk(allLignes, 100)
    for (let i = 0; i < ligneChunks.length; i++) {
      setProgress({ step: 'Enregistrement des lignes…', current: i + 1, total: ligneChunks.length })
      await supabase.from('facture_lignes').insert(ligneChunks[i])
    }

    setGenerating(false)
    setProgress(null)
    setDone({ count: insertedFactures.length, batchId: batch.id })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={(generating || done) ? undefined : onClose} />
      <div className="relative z-10 bg-white w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Facturer les éléments en attente</h2>
          <button onClick={done ? () => onDone(done.batchId) : (generating ? undefined : onClose)} disabled={generating} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg disabled:opacity-30">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Chargement…</div>
          ) : generating ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-5" />
              <p className="font-semibold text-gray-700 mb-1">{progress?.step || 'Génération en cours…'}</p>
              {progress?.total > 0 && (
                <div className="mt-3 max-w-xs mx-auto">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-1.5 bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 tabular-nums">{progress.current} / {progress.total}</p>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-5">⚠ Ne pas fermer ni recharger la page</p>
            </div>
          ) : done !== null ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-xl font-bold text-gray-800 mb-2">{done.count} facture{done.count !== 1 ? 's' : ''} générée{done.count !== 1 ? 's' : ''}</p>
              <p className="text-gray-500 text-sm mb-6">Les éléments facturés ont été mis à jour (facturé ou partiellement facturé).</p>
              <button onClick={() => onDone(done.batchId)} className="btn-primary">Voir les factures générées →</button>
            </div>
          ) : (
            <div className="p-5 space-y-6">
              {/* Nom du batch */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 shrink-0 w-20">Nom :</label>
                <input
                  type="text"
                  placeholder="Ex : Photocopies 1H, Voyage scolaire 3A…"
                  value={nomBatch}
                  onChange={e => setNomBatch(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {allClasses.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 shrink-0">Classes :</span>
                  <ClassFilterPill allClasses={allClasses} excluded={classesIgnorees} onChange={setClassesIgnorees} />
                  {classesIgnorees.length > 0 && (
                    <span className="text-xs text-orange-600 font-medium">
                      {classesIgnorees.join(', ')} ignorée{classesIgnorees.length > 1 ? 's' : ''} → items concernés seront marqués <em>Partiel</em>
                    </span>
                  )}
                </div>
              )}
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
                      const cible = a.eleve_id ? '1 élève individuel'
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
        {!loading && !generating && done === null && (attrs.length > 0 || activites.length > 0) && (
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
                ⚠ Les éléments qui ciblent des classes ignorées seront marqués <strong>Partiellement facturé</strong>.
              </p>
            )}
            <button onClick={generate} disabled={generating || nbEleves === 0}
              className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {`Générer ${nbEleves} facture${nbEleves !== 1 ? 's' : ''} · ${fmtEur(totalGlobal)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Liste des batches (niveau 1) ──────────────────────────────────────────────
function ListeBatches({ onNew, onSelect }) {
  const { isFinancier } = useAuth()
  const [batches, setBatches]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeTab, setActiveTab]     = useState('attente') // 'attente' | 'valide' | 'impaye'
  const [impayesParBatch, setImpayesParBatch] = useState({}) // batchId -> montant impayé

  const load = async () => {
    setLoading(true)
    const [{ data }, { data: allFacs }, { data: allPaies }] = await Promise.all([
      supabase.from('facture_batches')
        .select('*, factures(id, montant, statut, eleve:eleves(nom, prenom, classe))')
        .order('created_at', { ascending: false }),
      supabase.from('factures')
        .select('id, eleve_id, montant, date, created_at, batch_id')
        .eq('statut', 'facture'),
      supabase.from('paiements').select('eleve_id, montant'),
    ])
    setBatches(data || [])
    const hasAttente = (data || []).some(b => (b.factures || []).some(f => f.statut !== 'facture'))
    if ((data || []).length > 0 && !hasAttente) setActiveTab('valide')

    // Calcul impayés
    const pMap = {}
    for (const p of (allPaies || [])) pMap[p.eleve_id] = (pMap[p.eleve_id] || 0) + Number(p.montant)
    const impayes = calcImpayes(allFacs || [], pMap)
    const byBatch = {}
    for (const f of (allFacs || [])) {
      if (!byBatch[f.batch_id]) byBatch[f.batch_id] = 0
      byBatch[f.batch_id] += impayes[f.id] || 0
    }
    setImpayesParBatch(byBatch)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const stats = b => {
    const facs = b.factures || []
    const total     = facs.reduce((s, f) => s + Number(f.montant || 0), 0)
    const nbTotal   = facs.length
    const nbAttente = facs.filter(f => f.statut !== 'facture').length
    const nbValide  = facs.filter(f => f.statut === 'facture').length
    const termine   = nbAttente === 0
    return { total, nbTotal, nbAttente, nbValide, termine }
  }

  const totalFacs = batches.reduce((s, b) => s + (b.factures?.length || 0), 0)
  const nbAttenteTot = batches.filter(b => !stats(b).termine).length
  const nbValideTot  = batches.filter(b =>  stats(b).termine).length
  const nbImpayeTot  = batches.filter(b => (impayesParBatch[b.id] || 0) > 0).length

  const filtered = batches.filter(b => {
    // Filtre onglet
    const s = stats(b)
    if (activeTab === 'attente' && s.termine) return false
    if (activeTab === 'valide'  && !s.termine) return false
    if (activeTab === 'impaye'  && !((impayesParBatch[b.id] || 0) > 0)) return false
    // Filtre recherche : numéro batch, ou élève/classe dans les factures
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (b.numero?.toLowerCase().includes(q)) return true
    if (b.nom?.toLowerCase().includes(q)) return true
    return (b.factures || []).some(f => {
      const e = f.eleve
      if (!e) return false
      return (e.nom + ' ' + e.prenom).toLowerCase().includes(q) || e.classe?.toLowerCase().includes(q)
    })
  })

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-1 flex-wrap justify-between">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-800">Factures</h1>
          <p className="text-sm text-gray-400">
            {totalFacs} facture{totalFacs !== 1 ? 's' : ''} générée{totalFacs !== 1 ? 's' : ''}
            <span className="mx-1.5">·</span>
            <span className="font-semibold text-primary">
              {fmtEur(batches.reduce((s, b) => s + stats(b).total, 0))}
            </span>
          </p>
        </div>
        {isFinancier && (
          <button onClick={onNew} className="btn-primary">+ Facturer</button>
        )}
      </div>

      {/* Barre : Tabs + Recherche */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
          <button onClick={() => setActiveTab('attente')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-all
              ${activeTab === 'attente'
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200'
                : 'text-gray-500 hover:text-gray-700'}`}>
            En attente
            <span className={`text-xs font-semibold tabular-nums
              ${activeTab === 'attente' ? 'text-orange-500' : 'text-gray-400'}`}>
              {nbAttenteTot}
            </span>
          </button>
          <button onClick={() => setActiveTab('valide')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all
              ${activeTab === 'valide'
                ? 'bg-white text-green-700 shadow-sm ring-1 ring-green-200'
                : 'text-gray-500 hover:text-gray-700'}`}>
            Facturé
          </button>
          <button onClick={() => setActiveTab('impaye')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-all
              ${activeTab === 'impaye'
                ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200'
                : 'text-gray-500 hover:text-gray-700'}`}>
            Impayés
            <span className={`text-xs font-semibold tabular-nums
              ${activeTab === 'impaye' ? 'text-red-500' : 'text-gray-400'}`}>
              {nbImpayeTot}
            </span>
          </button>
        </div>
        <input
          type="text" placeholder="Rechercher un élève, une classe ou un N°…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {batches.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-medium">Aucune facturation</p>
          <p className="text-sm mt-1">Cliquez sur "+ Facturer" pour générer le premier batch.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Aucun résultat pour cette recherche.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['N° Facturation','Date','Élèves','Total','Impayés','Répartition','Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const s = stats(b)
                return (
                  <tr key={b.id} onClick={() => onSelect(b.id)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-800">{b.nom || b.numero}</p>
                      {b.nom && <p className="font-mono text-xs text-gray-400 mt-0.5">{b.numero}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(b.date)}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{s.nbTotal}</td>
                    <td className="px-4 py-3 font-semibold text-primary">{fmtEur(s.total)}</td>
                    <td className="px-4 py-3">
                      {(impayesParBatch[b.id] || 0) > 0
                        ? <span className="font-semibold text-red-600 tabular-nums">{fmtEur(impayesParBatch[b.id])}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {s.nbValide > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            {s.nbValide} facturé{s.nbValide > 1 ? 's' : ''}
                          </span>
                        )}
                        {s.nbAttente > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            {s.nbAttente} en attente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${s.termine ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {s.termine ? 'Terminé' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Détail d'un batch (niveau 2) ──────────────────────────────────────────────
function DetailBatch({ batchId, onSelectFacture, onBack }) {
  const { isFinancier } = useAuth()
  const [batch, setBatch]     = useState(null)
  const [factures, setFactures] = useState([])
  const [search, setSearch]   = useState('')
  const [activeTab, setActiveTab] = useState('attente') // 'attente' | 'valide'
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // { facture }
  const [busy, setBusy]       = useState(false)
  const [impayes, setImpayes] = useState({}) // factureId -> montant impayé

  const load = async () => {
    const [{ data: b }, { data: facs }] = await Promise.all([
      supabase.from('facture_batches').select('*').eq('id', batchId).single(),
      supabase.from('factures')
        .select('*, eleve:eleve_id(nom,prenom,classe)')
        .eq('batch_id', batchId)
        .order('eleve_id'),
    ])
    setBatch(b)
    setFactures(facs || [])
    if ((facs || []).length > 0 && (facs || []).every(f => f.statut === 'facture')) setActiveTab('valide')

    // Calcul des impayés pour les élèves de ce batch
    const eleveIds = [...new Set((facs || []).map(f => f.eleve_id).filter(Boolean))]
    if (eleveIds.length > 0) {
      const chunkL = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i) => arr.slice(i*n,(i+1)*n))
      const allFacsArr = []
      const allPaiesArr = []
      for (const slice of chunkL(eleveIds, 50)) {
        const [{ data: fs }, { data: ps }] = await Promise.all([
          supabase.from('factures').select('id, eleve_id, montant, date, created_at').eq('statut', 'facture').in('eleve_id', slice),
          supabase.from('paiements').select('eleve_id, montant').in('eleve_id', slice),
        ])
        allFacsArr.push(...(fs || []))
        allPaiesArr.push(...(ps || []))
      }
      const pMap = {}
      for (const p of allPaiesArr) pMap[p.eleve_id] = (pMap[p.eleve_id] || 0) + Number(p.montant)
      setImpayes(calcImpayes(allFacsArr, pMap))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [batchId])

  // Met à jour les statuts articles/activités après approbation de factures
  const mettreAJourItemsApresApprobation = async (factureIds) => {
    if (!factureIds.length) return
    // chunk helper — réutilisé partout pour éviter les limites URL PostgREST
    const chunk = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i) => arr.slice(i*n,(i+1)*n))

    // Requête initiale chunked — factureIds peut contenir 600+ UUIDs
    const allLignes = []
    for (const slice of chunk(factureIds, 50)) {
      const { data } = await supabase.from('facture_lignes')
        .select('article_attribution_id, activite_id').in('facture_id', slice)
      allLignes.push(...(data || []))
    }
    const lignes = allLignes
    const attrIds  = [...new Set((lignes||[]).filter(l=>l.article_attribution_id).map(l=>l.article_attribution_id))]
    const activIds = [...new Set((lignes||[]).filter(l=>l.activite_id).map(l=>l.activite_id))]

    // calcStatut : binaire — 'facture' seulement si 0 élève non-facturé (brouillon ou ignore)
    // 1 seule query par chunk, early exit dès qu'un non-facturé est trouvé
    const calcStatut = async (fkCol, id) => {
      const { data: lignesItem } = await supabase.from('facture_lignes')
        .select('facture_id').eq(fkCol, id)
      const ids = [...new Set((lignesItem || []).map(l => l.facture_id))]
      if (!ids.length) return 'a_facturer'

      for (const slice of chunk(ids, 50)) {
        const { data: pending } = await supabase.from('factures')
          .select('id').in('id', slice).neq('statut', 'facture').limit(1)
        if ((pending || []).length > 0) return 'a_facturer'
      }
      return 'facture'
    }

    for (const id of attrIds) {
      const statut = await calcStatut('article_attribution_id', id)
      await supabase.from('article_attributions').update({ statut_facturation: statut }).eq('id', id)
    }
    for (const id of activIds) {
      const statut = await calcStatut('activite_id', id)
      await supabase.from('activites').update({ statut_facturation: statut }).eq('id', id)
    }
  }

  const validerFacture = async (f) => {
    setBusy(true)
    setFactures(prev => prev.map(ff => ff.id === f.id ? { ...ff, statut: 'facture' } : ff))
    await supabase.from('factures').update({ statut: 'facture' }).eq('id', f.id)
    await mettreAJourItemsApresApprobation([f.id])
    setBusy(false)
  }

  const ignorerFacture = async (f) => {
    const newStatut = f.statut === 'ignore' ? 'brouillon' : 'ignore'
    setBusy(true)
    // Mise à jour locale immédiate (pas de flash de rechargement)
    setFactures(prev => prev.map(ff => ff.id === f.id ? { ...ff, statut: newStatut } : ff))
    await supabase.from('factures').update({ statut: newStatut }).eq('id', f.id)
    setBusy(false)
  }

  const supprimerFacture = async (f) => {
    setBusy(true)

    // Récupérer et supprimer les lignes
    const { data: lignes } = await supabase.from('facture_lignes').select('*').eq('facture_id', f.id)
    await supabase.from('facture_lignes').delete().eq('facture_id', f.id)

    // Recalculer statut des items via calcStatut (logique binaire, même que mettreAJour…)
    const attrIds  = [...new Set((lignes || []).filter(l => l.article_attribution_id).map(l => l.article_attribution_id))]
    const activIds = [...new Set((lignes || []).filter(l => l.activite_id).map(l => l.activite_id))]
    const chunkS = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i) => arr.slice(i*n,(i+1)*n))
    const calcStatutSuppr = async (fkCol, id) => {
      const { data: lignesItem } = await supabase.from('facture_lignes').select('facture_id').eq(fkCol, id)
      const ids = [...new Set((lignesItem || []).map(l => l.facture_id))]
      if (!ids.length) return 'a_facturer'
      for (const slice of chunkS(ids, 50)) {
        const { data: pending } = await supabase.from('factures')
          .select('id').in('id', slice).neq('statut', 'facture').limit(1)
        if ((pending || []).length > 0) return 'a_facturer'
      }
      return 'facture'
    }
    for (const id of attrIds) {
      const statut = await calcStatutSuppr('article_attribution_id', id)
      await supabase.from('article_attributions').update({ statut_facturation: statut }).eq('id', id)
    }
    for (const id of activIds) {
      const statut = await calcStatutSuppr('activite_id', id)
      await supabase.from('activites').update({ statut_facturation: statut }).eq('id', id)
    }

    // Supprimer la facture + mise à jour locale immédiate
    await supabase.from('factures').delete().eq('id', f.id)
    setFactures(prev => prev.filter(ff => ff.id !== f.id))
    setConfirm(null)
    setBusy(false)
  }

  const toutApprouver = async () => {
    // On prend les IDs depuis l'état LOCAL (pas depuis la DB) :
    // ainsi les élèves ignorés sont DÉJÀ exclus grâce à l'optimistic update de ignorerFacture,
    // même si leur save Supabase est encore en cours (race condition impossible).
    const ids = factures.filter(f => f.statut === 'brouillon').map(f => f.id)
    if (!ids.length) return
    setBusy(true)
    const chunk = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i) => arr.slice(i*n,(i+1)*n))
    // Chunked .in('id', ...) pour éviter la limite URL PostgREST (~50 IDs max)
    for (const slice of chunk(ids, 50)) {
      await supabase.from('factures').update({ statut: 'facture' }).in('id', slice)
    }
    await mettreAJourItemsApresApprobation(ids)
    // Mise à jour locale immédiate — pas de rechargement complet
    setFactures(prev => prev.map(f => f.statut === 'brouillon' ? { ...f, statut: 'facture' } : f))
    setBusy(false)
  }

  const nbAttente  = factures.filter(f => f.statut === 'brouillon').length
  const nbValide   = factures.filter(f => f.statut === 'facture').length
  const nbImpaye   = factures.filter(f => f.statut === 'facture' && (impayes[f.id] || 0) > 0).length

  const filtered = factures.filter(f => {
    if (activeTab === 'impaye') return f.statut === 'facture' && (impayes[f.id] || 0) > 0
    const tabMatch = activeTab === 'attente' ? f.statut !== 'facture' : f.statut === 'facture'
    if (!tabMatch) return false
    if (!search) return true
    const q = search.toLowerCase()
    return `${f.eleve?.prenom} ${f.eleve?.nom}`.toLowerCase().includes(q)
      || (f.eleve?.classe || '').toLowerCase().includes(q)
      || (f.numero || '').toLowerCase().includes(q)
  })

  const totalBatch = factures.reduce((s, f) => s + Number(f.montant || 0), 0)

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800">
          Factures <span className="text-gray-400 font-medium">{batch?.numero}</span>
          {batch?.nom && <span className="text-xl font-normal text-gray-500 ml-2">— {batch.nom}</span>}
        </h1>
        <p className="text-sm text-gray-400">
          {factures.length} facture{factures.length !== 1 ? 's' : ''} au total
          <span className="mx-1.5">·</span>{fmtDate(batch?.date)}
          <span className="mx-1.5">·</span><span className="font-semibold text-primary">{fmtEur(totalBatch)}</span>
        </p>
      </div>

      {/* Retour + Tabs + Recherche + Tout approuver sur une ligne */}
      <div className="flex items-center gap-3 my-4">
        {/* Bouton Retour */}
        <button onClick={onBack}
          className="flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">
          ← Retour
        </button>
        {/* Segmented control */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
          <button onClick={() => setActiveTab('attente')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-all
              ${activeTab === 'attente'
                ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200'
                : 'text-gray-500 hover:text-gray-700'}`}>
            En attente
            <span className={`text-xs font-semibold tabular-nums
              ${activeTab === 'attente' ? 'text-orange-500' : 'text-gray-400'}`}>
              {nbAttente + factures.filter(f => f.statut === 'ignore').length}
            </span>
          </button>
          <button onClick={() => setActiveTab('valide')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all
              ${activeTab === 'valide'
                ? 'bg-white text-green-700 shadow-sm ring-1 ring-green-200'
                : 'text-gray-500 hover:text-gray-700'}`}>
            Facturé
          </button>
          <button onClick={() => setActiveTab('impaye')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-all
              ${activeTab === 'impaye'
                ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200'
                : 'text-gray-500 hover:text-gray-700'}`}>
            Impayés
            <span className={`text-xs font-semibold tabular-nums
              ${activeTab === 'impaye' ? 'text-red-500' : 'text-gray-400'}`}>
              {nbImpaye}
            </span>
          </button>
        </div>
        <input
          type="text" placeholder="Rechercher un élève ou un numéro…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {isFinancier && nbAttente > 0 && (
          <button onClick={toutApprouver} disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors shrink-0 disabled:opacity-50">
            ✓ {factures.some(f => f.statut === 'ignore')
              ? `Approuver ${nbAttente} élève${nbAttente > 1 ? 's' : ''}`
              : `Tout approuver (${nbAttente})`}
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">N° Facture</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Classe</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Solde après</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-red-400 uppercase tracking-wide">Impayé</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
              {isFinancier && (activeTab === 'attente') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id}
                onClick={() => onSelectFacture(f.id)}
                className={`border-b border-gray-50 transition-colors cursor-pointer ${f.statut === 'ignore' ? 'opacity-40' : 'hover:bg-primary/5'}`}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-primary underline">
                    {f.numero || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {f.eleve?.prenom} {f.eleve?.nom}
                </td>
                <td className="px-4 py-3 text-gray-500">{f.eleve?.classe || '—'}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{fmtEur(f.montant)}</td>
                <td className="px-4 py-3">
                  <span className={`font-semibold tabular-nums
                    ${Number(f.solde_apres) < 0 ? 'text-orange-500' : Number(f.solde_apres) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {fmtEur(f.solde_apres)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {(impayes[f.id] || 0) > 0
                    ? <span className="font-semibold text-red-600 tabular-nums">{fmtEur(impayes[f.id])}</span>
                    : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3"><Badge statut={f.statut} /></td>
                {isFinancier && (activeTab === 'attente') && (
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {f.statut !== 'facture' && (
                        <button onClick={() => validerFacture(f)} disabled={busy}
                          className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-40">
                          ✓ Valider
                        </button>
                      )}
                      {f.statut !== 'facture' && (
                        <button onClick={() => ignorerFacture(f)} disabled={busy}
                          className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-40
                            ${f.statut === 'ignore'
                              ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {f.statut === 'ignore' ? '↩ Réactiver' : '⏭ Ignorer'}
                        </button>
                      )}
                      <button onClick={() => setConfirm({ facture: f })} disabled={busy}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-40">
                        × Suppr.
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            {search ? 'Aucun élève trouvé.' : 'Aucune facture dans ce batch.'}
          </div>
        )}
      </div>

      {isFinancier && factures.length > 0 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span><strong className="text-gray-500">Valider</strong> = approuver la facture</span>
          <span><strong className="text-gray-500">Ignorer</strong> = exclure du "Tout approuver"</span>
          <span><strong className="text-gray-500">Suppr.</strong> = supprimer définitivement (items remis en "à facturer")</span>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Supprimer cette facture ?</h3>
            <p className="text-gray-600 text-sm mb-1">
              <strong>{confirm.facture.eleve?.prenom} {confirm.facture.eleve?.nom}</strong> — {fmtEur(confirm.facture.montant)}
            </p>
            <p className="text-gray-400 text-xs mb-5">
              Les articles et activités concernés seront remis en "à facturer".
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={() => supprimerFacture(confirm.facture)} disabled={busy}
                className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {busy ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Détail d'une facture (niveau 3) ──────────────────────────────────────────
function LigneRow({ ligne, onRemove, isFinancier }) {
  const [confirming, setConfirming] = useState(null)

  if (confirming) return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50 border border-amber-100 my-1 text-sm gap-3">
      <span className="text-gray-600 text-xs leading-tight">
        {confirming === 'reporter'
          ? 'Reporter cette ligne dans la prochaine facturation ?'
          : 'Supprimer définitivement cette ligne ?'}
      </span>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setConfirming(null)}
          className="text-xs text-gray-400 hover:text-gray-600 font-medium">Annuler</button>
        <button onClick={() => { onRemove(ligne, confirming === 'reporter'); setConfirming(null) }}
          className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg font-medium transition-colors">
          Confirmer
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 group">
      <span className="text-sm text-gray-700">{ligne.libelle}</span>
      <div className="flex items-center gap-2">
        {isFinancier && (
          <div className="hidden group-hover:flex items-center gap-1">
            <button onClick={() => setConfirming('reporter')}
              className="text-xs px-2 py-0.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium transition-colors">
              ↩ Reporter
            </button>
            <button onClick={() => setConfirming('supprimer')}
              className="text-xs px-2 py-0.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors">
              × Suppr.
            </button>
          </div>
        )}
        <span className="text-sm font-medium text-gray-800 tabular-nums">{fmtEur(ligne.montant)}</span>
      </div>
    </div>
  )
}

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

  const removeLigne = async (ligne, putBack) => {
    await supabase.from('facture_lignes').delete().eq('id', ligne.id)
    if (putBack) {
      // Remet l'article/activité à 'a_facturer' (sera re-facturé au prochain batch)
      if (ligne.article_attribution_id) {
        await supabase.from('article_attributions')
          .update({ statut_facturation: 'a_facturer' })
          .eq('id', ligne.article_attribution_id)
      }
      if (ligne.activite_id) {
        await supabase.from('activites')
          .update({ statut_facturation: 'a_facturer' })
          .eq('id', ligne.activite_id)
      }
    }
    const { data: remaining } = await supabase.from('facture_lignes').select('*').eq('facture_id', factureId)
    if (!remaining?.length) {
      await supabase.from('factures').delete().eq('id', factureId)
      onBack(); return
    }
    const newTotal = remaining.reduce((s, l) => s + Number(l.montant), 0)
    await supabase.from('factures').update({
      montant: newTotal,
      solde_apres: Number(facture.solde_avant) - newTotal,
    }).eq('id', factureId)
    await load()
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
        ← Retour au batch
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
            {facture.statut === 'brouillon' && <button onClick={() => setStatut('facture')} disabled={saving} className="btn-primary text-sm py-1.5">✓ Valider</button>}
            {facture.statut === 'ignore'    && <button onClick={() => setStatut('brouillon')} disabled={saving} className="btn-secondary text-sm py-1.5">↩ Réactiver</button>}
            {facture.statut === 'facture'   && <button onClick={() => setStatut('rappel')} disabled={saving} className="btn-secondary text-sm py-1.5 text-orange-600">⚠ Rappel</button>}
            {facture.statut === 'rappel'    && <button onClick={() => setStatut('mise_en_demeure')} disabled={saving} className="btn-secondary text-sm py-1.5 text-red-600">🚨 Mise en demeure</button>}
            {!['brouillon','ignore'].includes(facture.statut) && <button onClick={() => setStatut('brouillon')} disabled={saving} className="btn-secondary text-sm py-1.5">↩ Brouillon</button>}
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
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Articles
            {isFinancier && <span className="ml-2 text-gray-300 font-normal normal-case">— survolez une ligne pour Reporter ou Supprimer</span>}
          </h2>
          {Object.entries(artByCat).map(([cat, items]) => (
            <div key={cat} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-gray-400 mb-1.5">{cat}</p>
              {items.map(l => <LigneRow key={l.id} ligne={l} onRemove={removeLigne} isFinancier={isFinancier} />)}
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
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Activités
            {isFinancier && <span className="ml-2 text-gray-300 font-normal normal-case">— survolez une ligne pour Reporter ou Supprimer</span>}
          </h2>
          {activites.map(l => <LigneRow key={l.id} ligne={l} onRemove={removeLigne} isFinancier={isFinancier} />)}
          <div className="flex justify-between pt-1.5 text-xs text-gray-400">
            <span>Sous-total activités</span>
            <span className="tabular-nums">{fmtEur(activites.reduce((s, l) => s + Number(l.montant), 0))}</span>
          </div>
        </div>
      )}

      <div className="card p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Total facture</span>
        <span className="text-lg font-bold text-gray-800 tabular-nums">{fmtEur(facture.montant)}</span>
      </div>
      <div className="card p-4 mt-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Solde après facturation</span>
        <span className={`text-lg font-bold tabular-nums ${Number(facture.solde_apres) < 0 ? 'text-red-600' : Number(facture.solde_apres) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
          {fmtEur(facture.solde_apres)}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────
export default function Factures() {
  const [view, setView]         = useState('batches')  // 'batches' | 'batch' | 'facture'
  const [batchId, setBatchId]     = useState(null)
  const [factureId, setFactureId] = useState(null)
  const [showModal, setShowModal] = useState(false)

  if (view === 'facture') return (
    <DetailFacture
      factureId={factureId}
      onBack={() => setView('batch')}
    />
  )
  if (view === 'batch') return (
    <DetailBatch
      batchId={batchId}
      onSelectFacture={id => { setFactureId(id); setView('facture') }}
      onBack={() => setView('batches')}
    />
  )
  return (
    <>
      <ListeBatches
        onNew={() => setShowModal(true)}
        onSelect={id => { setBatchId(id); setView('batch') }}
      />
      {showModal && (
        <FacturationModal
          onClose={() => setShowModal(false)}
          onDone={(newBatchId) => {
            setShowModal(false)
            if (newBatchId) { setBatchId(newBatchId); setView('batch') }
          }}
        />
      )}
    </>
  )
}
