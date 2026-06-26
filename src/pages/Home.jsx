import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDemo } from '../context/DemoContext'
import demoData from '../data/demoData'

const fmt = n => Number(n || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtShort = n => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'k €'
  return v.toFixed(2) + ' €'
}
function anneeScolaire() {
  const now = new Date(), m = now.getMonth() + 1, y = now.getFullYear()
  return m >= 8 ? y + '-' + (y + 1) : (y - 1) + '-' + y
}
function Sparkline({ data, labels }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 0.01), min = 0, range = max - min || 0.01
  const W = 200, H = 34
  const pts = data.map((v, i) =>
    ((i / (data.length - 1)) * W).toFixed(1) + ',' +
    (H - ((v - min) / range) * (H - 4) - 2).toFixed(1)
  )
  const line = 'M' + pts.join(' L')
  const area = line + ` L${W},${H} L0,${H} Z`
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 30 }}>
        <path d={area} fill="white" fillOpacity="0.15" />
        <path d={line} fill="none" stroke="white" strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.85" />
      </svg>
      {labels && (
        <div className="flex justify-between mt-1"
          style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '-0.01em' }}>
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  )
}
function StatCard({ label, value, sub, to, color = 'primary', icon, chart, chartLabels }) {
  const colors = {
    primary: 'from-purple-700 to-purple-900',
    red: 'from-red-500 to-red-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    amber:  'from-amber-400 to-amber-500',
    blue: 'from-blue-500 to-blue-600',
  }
  const cls = `card p-5 bg-gradient-to-br ${colors[color] || colors.primary} text-white${to ? ' cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all' : ''}`
  const inner = (
    <div className={cls}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-2xl">{icon}</span>
        {to && (
          <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        )}
      </div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-sm font-medium opacity-90 mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
      {chart && chart.length >= 2 && <Sparkline data={chart} labels={chartLabels} />}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}
function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}
function MiniStat({ label, value, to, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 dark:bg-green-900 text-green-800',
    orange: 'bg-orange-100 text-orange-800',
    indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-800',
  }
  const inner = (
    <div className={`rounded-xl p-4 ${colors[color] || colors.gray}${to ? ' cursor-pointer hover:brightness-95 transition-all' : ''}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}
function HomeMdp() {
  const { user } = useAuth()
  const [activites, setActivites] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('activites').select('*')
      .eq('created_by', user?.id).neq('statut', 'archive').order('date_debut')
      .then(({ data }) => { setActivites(data || []); setLoading(false) })
  }, [user])
  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement...</div>
  const nonLiees = activites.filter(a => a.statut === 'publie' && (!a.montant_total || a.montant_total == 0))
  return (
    <>
    <PageHeader title="Bonjour" subtitle={`Année scolaire ${anneeScolaire()}`} />
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link to="/activites" className="btn-primary">Mes activités</Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon="📅" label="Mes activités" value={activites.length} to="/activites" color="primary" />
        <StatCard icon="⚠️" label="Sans facture liée" value={nonLiees.length} to="/activites" color="orange" sub="Activités publiées sans montant" />
      </div>
    </div>
    </>
  )
}
function HomeFinancier() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [impayes, setImpayes] = useState(0)
  const [enReserve, setEnReserve] = useState(0)
  const [aFacturer, setAFacturer] = useState({ frais: 0, materiel: 0, activites: 0, autres: 0 })
  const [facture, setFacture] = useState({ frais: 0, materiel: 0, activites: 0, autres: 0 })
  const [echStats, setEchStats] = useState({ en_cours: 0, non_respecte: 0, termine: 0 })
  const [orgStats, setOrgStats] = useState({ CPAS: 0, ULB: 0, SPJ: 0, Autre: 0 })
  const [echMontant, setEchMontant] = useState(0)
  const [orgMontant, setOrgMontant]   = useState(0)
  const as = anneeScolaire()

  useEffect(() => {
    Promise.all([
      supabase.from('eleves').select('id').eq('actif', true),
      supabase.from('factures').select('eleve_id, montant, date'),
      supabase.from('paiements').select('eleve_id, montant, date'),
      supabase.from('article_attributions').select('prix_unitaire_applique, quantite, nb_eleves, statut_facturation, article:article_id(categorie, prix_unitaire)'),
      supabase.from('activites').select('montant_total, pop, statut, statut_facturation'),
      supabase.from('echelonnements').select('statut, montant'),
      supabase.from('organismes_tiers').select('id, organisme, statut'),
      supabase.from('organismes_tiers_articles').select('montant, ot_id'),
    ]).then(([eleves, factures, paiements, attrs, activites, echs, orgs, otArts]) => {
      // Calcul soldes par élève
      const mPaie = {}, mFact = {}
      for (const p of (paiements.data || [])) {
        mPaie[p.eleve_id] = (mPaie[p.eleve_id] || 0) + Number(p.montant || 0)
      }
      for (const f of (factures.data || [])) {
        mFact[f.eleve_id] = (mFact[f.eleve_id] || 0) + Number(f.montant || 0)
      }
      const soldes = (eleves.data || []).map(e => (mPaie[e.id] || 0) - (mFact[e.id] || 0))
      setImpayes(Math.abs(soldes.filter(s => s < 0).reduce((a, b) => a + b, 0)))
      setEnReserve(soldes.filter(s => s > 0).reduce((a, b) => a + b, 0))

      function compute(stat) {
        const rows = (attrs.data || []).filter(a => a.statut_facturation === stat)
        const sum = cat => rows.filter(a => a.article?.categorie === cat)
          .reduce((s, a) => s + Number(a.prix_unitaire_applique || a.article?.prix_unitaire || 0) * Number(a.nb_eleves || 1) * Number(a.quantite || 1), 0)
        const act = (activites.data || [])
          .filter(a => a.statut_facturation === stat && a.statut !== 'archive')
          .reduce((s, a) => s + Number(a.montant_total || 0) - Number(a.pop || 0), 0)
        return { frais: sum('Frais obligatoires'), materiel: sum('Fournitures scolaires'), activites: act, autres: sum('Vêtements') + sum('Divers') }
      }
      setAFacturer(compute('a_facturer'))
      setFacture(compute('facture'))

      const ec = {}
      ;(echs.data || []).forEach(e => { ec[e.statut] = (ec[e.statut] || 0) + 1 })
      setEchStats({ en_cours: ec.en_cours || 0, non_respecte: ec.non_respecte || 0, termine: ec.termine || 0 })
      setEchMontant((echs.data || [])
        .filter(e => ['en_cours', 'non_respecte'].includes(e.statut))
        .reduce((s, e) => s + Number(e.montant || 0), 0))

      const og = {}
      ;(orgs.data || []).filter(o => ['en_cours', 'valide'].includes(o.statut))
        .forEach(o => { const org = (o.organisme || '').toUpperCase(); const k = ['CPAS', 'ULB', 'SPJ'].includes(org) ? org : 'Autre'; og[k] = (og[k] || 0) + 1 })
      setOrgStats({ CPAS: og.CPAS || 0, ULB: og.ULB || 0, SPJ: og.SPJ || 0, Autre: og.Autre || 0 })
      const activeOtIds = new Set((orgs.data || []).filter(o => ['en_cours', 'valide'].includes(o.statut)).map(o => o.id))
      setOrgMontant((otArts.data || []).filter(a => activeOtIds.has(a.ot_id)).reduce((s, a) => s + Number(a.montant || 0), 0))

      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement...</div>
  const totA = aFacturer.frais + aFacturer.materiel + aFacturer.activites + aFacturer.autres
  const totF = facture.frais + facture.materiel + facture.activites + facture.autres
  return (
    <>
    <PageHeader title="Tableau de bord" subtitle={`Année scolaire ${as}`} />
    <div className="p-6 max-w-screen-xl mx-auto space-y-10">
      <section>
        <SectionTitle icon="💰" title="Vue financière" subtitle={`Année scolaire ${as}`} />
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="⚠️" label="Impayés" value={fmtShort(impayes)}
            sub="Soldes négatifs cumulés" to="/eleves?solde=negatif" color="red" />
          <StatCard icon="📋" label="Échelonnements" value={fmtShort(echMontant)}
            sub="Montant en cours / non respecté" to="/eleves?suivi=echelonnement" color="orange" />
          <StatCard icon="🤝" label="Organismes tiers" value={fmtShort(orgMontant)}
            sub="Demandes actives (en cours / validé)" to="/eleves?suivi=organisme" color="amber" />
          <StatCard icon="🏦" label="En réserve" value={fmtShort(enReserve)}
            sub="Soldes positifs cumulés" to="/eleves?solde=positif" color="green" />
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="📦" title="Éléments à facturer" subtitle="Articles et activités avec statut à facturer" />
          <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950 px-3 py-1 rounded-lg">{fmtShort(totA)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais obligatoires" value={fmtShort(aFacturer.frais)} to="/articles?onglet=attributions" color="blue" />
          <MiniStat label="Matériel scolaire" value={fmtShort(aFacturer.materiel)} to="/articles?onglet=attributions" color="indigo" />
          <MiniStat label="Activités" value={fmtShort(aFacturer.activites)} to="/activites" color="purple" />
          <MiniStat label="Autres" value={fmtShort(aFacturer.autres)} to="/articles?onglet=attributions" color="gray" />
        </div>
      </section>
      <section>
        <SectionTitle icon="🤝" title="Suivi social" subtitle="Situations financières particulières en cours" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Échelonnements</h3>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="En cours" value={echStats.en_cours} to="/assistant-social" color="blue" />
              <MiniStat label="Non respecté" value={echStats.non_respecte} to="/assistant-social" color="red" />
              <MiniStat label="Terminé" value={echStats.termine} to="/assistant-social" color="green" />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Organismes tiers (actifs)</h3>
            <div className="grid grid-cols-4 gap-3">
              <MiniStat label="CPAS" value={orgStats.CPAS} to="/assistant-social" color="blue" />
              <MiniStat label="ULB" value={orgStats.ULB} to="/assistant-social" color="indigo" />
              <MiniStat label="SPJ" value={orgStats.SPJ} to="/assistant-social" color="purple" />
              <MiniStat label="Autre" value={orgStats.Autre} to="/assistant-social" color="gray" />
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="✔️" title="Éléments facturés" subtitle="Articles et activités déjà facturés cette année" />
          <span className="text-lg font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 px-3 py-1 rounded-lg">{fmtShort(totF)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais obligatoires" value={fmtShort(facture.frais)} to="/articles?onglet=attributions" color="green" />
          <MiniStat label="Matériel scolaire" value={fmtShort(facture.materiel)} to="/articles?onglet=attributions" color="green" />
          <MiniStat label="Activités" value={fmtShort(facture.activites)} to="/activites" color="green" />
          <MiniStat label="Autres" value={fmtShort(facture.autres)} to="/articles?onglet=attributions" color="green" />
        </div>
      </section>
      {isAdmin && (
        <section>
          <SectionTitle icon="⚙️" title="Administration" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin?onglet=utilisateurs" className="card p-5 hover:shadow-md transition-all bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold">Personnes &amp; accès</div>
              <div className="text-sm opacity-80 mt-1">Utilisateurs, droits, photos élèves</div>
            </Link>
            <Link to="/admin?onglet=synchronisation" className="card p-5 hover:shadow-md transition-all bg-gradient-to-br from-amber-400 to-orange-500 text-white">
              <div className="text-2xl mb-2">🏫</div>
              <div className="font-semibold">École</div>
              <div className="text-sm opacity-80 mt-1">Synchronisation Smartschool, paramètres</div>
            </Link>
            <Link to="/admin?onglet=helpdesk" className="card p-5 hover:shadow-md transition-all bg-gradient-to-br from-orange-500 to-red-500 text-white">
              <div className="text-2xl mb-2">🧩</div>
              <div className="font-semibold">Modules</div>
              <div className="text-sm opacity-80 mt-1">Helpdesk, natures comptables, guidance</div>
            </Link>
          </div>
        </section>
      )}
    </div>
    </>
  )
}
export default function Home() {
  const { isFinancier, isMdp, role, effectiveRole, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement...</div>
  if (isFinancier) return <HomeFinancier />
  if (isMdp) return <HomeMdp />
  if (effectiveRole === 'responsable' || role === 'responsable') return <HomeResponsable />
  return (
    <div className="p-8 text-center">
      <div className="text-4xl mb-4">🏫</div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">ESPM+</h1>
      <p className="text-gray-500 dark:text-gray-400">Bienvenue.</p>
    </div>
  )
}

// ── HomeResponsable ────────────────────────────────────────────────────────
const fmtDateR = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : null
const fmtEurR  = n => new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + ' €'

function isMajeurR(dateNaissance) {
  if (!dateNaissance) return false
  const dob = new Date(dateNaissance)
  const now = new Date()
  const age = now.getFullYear() - dob.getFullYear() -
    (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
  return age >= 18
}

const STATUT_ECH_R = {
  en_cours:     { label: 'En cours',     cls: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  attente:      { label: 'En attente',   cls: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
  non_respecte: { label: 'Non respecté', cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  termine:      { label: 'Terminé',      cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
}
const STATUT_OT_R = {
  en_cours: { label: 'En cours',  cls: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  valide:   { label: 'Validé',    cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  refuse:   { label: 'Refusé',    cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  cloture:  { label: 'Clôturé',   cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
}

function RBadge({ val, map }) {
  const m = map[val] || { label: val, cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
}

function RSection({ icon, title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
        <span>{icon}</span>{title}
      </h2>
      {children}
    </div>
  )
}

function RField({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-3 py-1.5 text-sm border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-gray-400 dark:text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  )
}
function generateEcheancier(ech) {
  if (!ech.date_debut || !ech.nombre_echeances) return []
  const today = new Date(); today.setHours(0,0,0,0)
  const base = new Date(ech.date_debut)
  return Array.from({ length: ech.nombre_echeances }, (_, i) => {
    const due = new Date(base.getFullYear(), base.getMonth() + i, base.getDate())
    const isPast = due < today
    const daysAgo = (today - due) / 86400000
    let paiement
    if (ech.statut === 'termine') paiement = 'paye'
    else if (ech.statut === 'en_cours') paiement = isPast ? 'paye' : 'a_venir'
    else if (ech.statut === 'non_respecte') {
      if (!isPast) paiement = 'a_venir'
      else if (daysAgo <= 45) paiement = 'en_retard'
      else paiement = 'paye'
    } else paiement = 'a_venir'
    return { num: i+1, date: due, montant: ech.mensualite || (ech.montant/ech.nombre_echeances), paiement }
  })
}
const ECH_PAY = {
  paye:      { label:'Payé',      cls:'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300', icon:'✓' },
  en_retard: { label:'En retard', cls:'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',     icon:'⚠' },
  a_venir:   { label:'À venir',   cls:'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',   icon:'◌' },
}
function HomeResponsable() {
  const { user } = useAuth()
  const { demoMode } = useDemo()
  const [eleves, setEleves]         = useState([])
  const [activeId, setActiveId]     = useState(null)
  const [eleve, setEleve]           = useState(null)
  const [echs, setEchs]             = useState([])
  const [orgs, setOrgs]             = useState([])
  const [photo, setPhoto]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [loadingFiche, setLoadingFiche] = useState(false)
  const [activeTabR, setActiveTabR] = useState('info')

  // Données démo pour l'aperçu responsable (mode démo OU aucun élève lié)
  const DEMO_ELEVES = demoData.responsable_eleve.map(r => r.eleve).filter(Boolean)

  // Charger les enfants liés au compte
  useEffect(() => {
    if (!user) return
    // En mode démo : utiliser directement les données fictives
    if (demoMode) {
      setEleves(DEMO_ELEVES)
      if (DEMO_ELEVES.length > 0) setActiveId(DEMO_ELEVES[0].id)
      setLoading(false)
      return
    }
    supabase
      .from('responsable_eleve')
      .select('eleve:eleve_id(id, prenom, nom, classe, date_naissance)')
      .eq('responsable_id', user.id)
      .then(({ data }) => {
        const list = (data || []).map(r => r.eleve).filter(Boolean)
        // Fallback démo si aucun élève lié (ex : admin en aperçu responsable)
        if (list.length === 0) {
          setEleves(DEMO_ELEVES)
          if (DEMO_ELEVES.length > 0) setActiveId(DEMO_ELEVES[0].id)
        } else {
          setEleves(list)
          if (list.length > 0) setActiveId(list[0].id)
        }
        setLoading(false)
      })
  }, [user, demoMode])

  // Charger la fiche complète de l'enfant sélectionné
  useEffect(() => {
    if (!activeId) return
    setLoadingFiche(true)
    setPhoto(null)
    Promise.all([
      supabase.from('eleves').select('*').eq('id', activeId).single(),
      supabase.from('echelonnements')
        .select('id,montant,nombre_echeances,date_debut,mensualite,statut')
        .eq('eleve_id', activeId),
      supabase.from('organismes_tiers')
        .select('id,organisme,statut,montant_accorde')
        .eq('eleve_id', activeId),
    ]).then(([eRes, ecRes, oRes]) => {
      const e = eRes.data
      setEleve(e)
      setEchs(ecRes.data || [])
      setOrgs(oRes.data || [])
      setLoadingFiche(false)
      if (e?.smartschool_internal_number) {
        fetch('/.netlify/functions/smartschool-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: e.smartschool_internal_number }),
        })
          .then(r => r.json())
          .then(({ photo: p }) => { if (p) setPhoto(p) })
          .catch(() => {})
      }
    })
  }, [activeId])

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>

  if (eleves.length === 0) return (
    <div className="p-8 text-center">
      <div className="text-4xl mb-4">🏫</div>
      <h1 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Bienvenue sur ESPM+</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Aucun élève lié à votre compte.<br />Contactez l'école si vous pensez que c'est une erreur.
      </p>
    </div>
  )

  const responsables = eleve
    ? [1, 2, 3].map(n => ({
        idx: n,
        nom: `${eleve[`nom_responsable_${n}`] || ''} ${eleve[`prenom_responsable_${n}`] || ''}`.trim(),
        tel: eleve[`tel_responsable_${n}`] || '',
      })).filter(r => r.nom || r.tel)
    : []

  const hasGroupes = eleve && [
    eleve.philosophie, eleve.groupe_choix_philo,
    eleve.obs_d2, eleve.ac_d2,
    eleve.math_d3, eleve.sciences_d3, eleve.bio_physique_d3,
    eleve.obs1_d3, eleve.obs2_d3, eleve.ac_d3,
  ].some(Boolean)

  const hasAS = echs.length > 0 || orgs.length > 0
  const majeur = eleve ? isMajeurR(eleve.date_naissance) : false
  const solde = eleve ? (eleve.solde || 0) : 0

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">

      {/* Sélecteur enfant si plusieurs */}
      {eleves.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {eleves.map(e => (
            <button
              key={e.id}
              onClick={() => setActiveId(e.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeId === e.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {e.prenom} {e.nom}
            </button>
          ))}
        </div>
      )}

      {loadingFiche ? (
        <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 gap-2">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          Chargement…
        </div>
      ) : eleve ? (
        <div className="space-y-3">

          {/* ── Hero : identité principale ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-5">
            {photo ? (
              <img src={photo} alt="" className="w-20 h-20 rounded-full object-cover shrink-0 border-2 border-gray-100 dark:border-gray-700 shadow-sm" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-2xl font-bold select-none">
                {(eleve.prenom?.[0] || '') + (eleve.nom?.[0] || '')}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">{eleve.prenom} {eleve.nom}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {eleve.classe && <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{eleve.classe}</span>}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${majeur ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>
                  {majeur ? 'Majeur·e' : 'Mineur·e'}
                </span>
                {!eleve.actif && <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Inactif</span>}
              </div>
            </div>
          </div>

          {/* ── Onglets ── */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-0.5 flex">
            <button onClick={() => setActiveTabR('info')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTabR === 'info' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              Informations
            </button>
            <button onClick={() => setActiveTabR('social')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTabR === 'social' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              Suivi social {hasAS && <span className="ml-1 text-xs text-orange-400">●</span>}
            </button>
            <button onClick={() => setActiveTabR('financier')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTabR === 'financier' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              Financier
            </button>
          </div>

          {/* ══ TAB : Informations ══ */}
          {activeTabR === 'info' && (<>
          {/* ── 1. Identité ── */}
          <RSection icon="👤" title="Identité">
            <RField label="Date de naissance" value={fmtDateR(eleve.date_naissance)} />
            <RField label="Nationalité"       value={eleve.nationalite} />
            {(eleve.rue || eleve.commune) && (
              <RField label="Adresse" value={[
                eleve.rue,
                [eleve.code_postal, eleve.commune].filter(Boolean).join(' '),
                eleve.pays && eleve.pays !== 'Belgique' ? eleve.pays : null,
              ].filter(Boolean).join(', ')} />
            )}
            <RField label="Email"     value={eleve.email} />
            <RField label="Téléphone" value={eleve.telephone} />
            <RField label="Mobile"    value={eleve.mobile} />
          </RSection>

          {/* ── 2. Groupes scolaires ── */}
          {hasGroupes && (
            <RSection icon="📚" title="Groupes scolaires">
              {eleve.philosophie && (
                <RField label="RLMO" value={eleve.groupe_choix_philo ? `${eleve.philosophie} ${eleve.groupe_choix_philo}` : eleve.philosophie} />
              )}
              <RField label="OBS D2"          value={eleve.obs_d2} />
              <RField label="AC D2"           value={eleve.ac_d2} />
              <RField label="Math D3"         value={eleve.math_d3} />
              <RField label="Sciences D3"     value={eleve.sciences_d3} />
              <RField label="Bio/Physique D3" value={eleve.bio_physique_d3} />
              <RField label="OBS 1 D3"        value={eleve.obs1_d3} />
              <RField label="OBS 2 D3"        value={eleve.obs2_d3} />
              <RField label="AC D3"           value={eleve.ac_d3} />
            </RSection>
          )}

          {/* ── 3. Responsables légaux ── */}
          {responsables.length > 0 && (
            <RSection icon="👪" title="Responsables légaux">
              <div className="space-y-2">
                {responsables.map((r, i) => (
                  <div key={r.idx} className={`flex items-center justify-between py-1.5 text-sm ${i > 0 ? 'border-t border-gray-50 dark:border-gray-800' : ''}`}>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{r.nom || `Responsable ${r.idx}`}</span>
                    {r.tel && <span className="text-gray-500 dark:text-gray-400">{r.tel}</span>}
                  </div>
                ))}
              </div>
            </RSection>
          )}
          </>)}

          {/* ══ TAB : Suivi social ══ */}
          {activeTabR === 'social' && (hasAS ? (
            <RSection icon="🤝" title="Suivi social">
              {echs.length > 0 && (
                <div className={orgs.length > 0 ? 'mb-4' : ''}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Échelonnements</p>
                  <div className="space-y-3">
                    {echs.map(e => {
                      const cal = generateEcheancier(e)
                      const nbPayes    = cal.filter(c => c.paiement === 'paye').length
                      const nbRetard   = cal.filter(c => c.paiement === 'en_retard').length
                      return (
                        <div key={e.id} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                          {/* En-tête échelonnement */}
                          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 px-3 py-2.5 gap-3">
                            <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                              {fmtEurR(e.montant)}
                              {e.nombre_echeances ? ` · ${e.nombre_echeances} mensualités` : ''}
                              {e.mensualite ? ` de ${fmtEurR(e.mensualite)}` : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              {nbRetard > 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                                  {nbRetard} en retard
                                </span>
                              )}
                              <RBadge val={e.statut} map={STATUT_ECH_R} />
                            </div>
                          </div>
                          {/* Calendrier mois par mois */}
                          {cal.length > 0 && (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                              {cal.map(({ num, date, montant, paiement }) => {
                                const p = ECH_PAY[paiement] || ECH_PAY.a_venir
                                const dateStr = date.toLocaleDateString('fr-BE', { day:'2-digit', month:'2-digit', year:'numeric' })
                                return (
                                  <div key={num} className="flex items-center justify-between px-3 py-2 text-sm">
                                    <div className="flex items-center gap-3">
                                      <span className="w-5 text-center font-semibold text-gray-400 dark:text-gray-500 text-xs">{num}</span>
                                      <span className="text-gray-600 dark:text-gray-300">{dateStr}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-700 dark:text-gray-200 font-medium tabular-nums">{fmtEurR(montant)}</span>
                                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${p.cls}`}>
                                        <span>{p.icon}</span> {p.label}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {orgs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Organismes tiers</p>
                  <div className="space-y-1.5">
                    {orgs.map(o => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2 text-sm gap-3">
                        <span className="text-gray-700 dark:text-gray-200 capitalize truncate">
                          {o.organisme}
                          {o.montant_accorde ? ` · ${fmtEurR(o.montant_accorde)} accordé·s` : ''}
                        </span>
                        <RBadge val={o.statut} map={STATUT_OT_R} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </RSection>
          ) : (
            <div className="py-10 text-center text-gray-400 dark:text-gray-500">
              <div className="text-3xl mb-2">🤝</div>
              <p className="text-sm">Aucun suivi social pour cet élève.</p>
            </div>
          ))}

          {/* ══ TAB : Financier ══ */}
          {activeTabR === 'financier' && <RSection icon="💶" title="Financier">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">Solde actuel</span>
              <span className={`text-xl font-bold ${
                solde < 0 ? 'text-red-600' : solde > 0 ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {fmtEurR(solde)}
              </span>
            </div>
            {solde < 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">
                Un solde négatif indique un montant dû à l'école. Contactez-nous pour plus d'informations.
              </p>
            )}
            {solde > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">
                Un solde positif signifie qu'un crédit est disponible sur le compte de votre enfant.
              </p>
            )}
          </RSection>}

        </div>
      ) : null}
    </div>
  )
}
