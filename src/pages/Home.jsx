import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
function Sparkline({ data }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1, W = 200, H = 36
  const pts = data.map((v, i) => ((i / (data.length - 1)) * W).toFixed(1) + ',' + (H - ((v - min) / range) * (H - 6) - 3).toFixed(1))
  const line = 'M' + pts.join(' L'), area = line + ' L' + W + ',' + H + ' L0,' + H + ' Z'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3 opacity-25" preserveAspectRatio="none" style={{ height: 36 }}>
      <path d={area} fill="white" />
      <path d={line} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function StatCard({ label, value, sub, to, color = 'primary', icon, chart }) {
  const colors = {
    primary: 'from-purple-700 to-purple-900',
    red: 'from-red-500 to-red-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
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
      {chart && chart.length >= 2 && <Sparkline data={chart} />}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}
function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}
function MiniStat({ label, value, to, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
    orange: 'bg-orange-100 text-orange-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    purple: 'bg-purple-100 text-purple-800',
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
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement...</div>
  const nonLiees = activites.filter(a => a.statut === 'publie' && (!a.montant_total || a.montant_total == 0))
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bonjour</h1>
          <p className="text-gray-500 text-sm mt-0.5">Année scolaire {anneeScolaire()}</p>
        </div>
        <Link to="/activites" className="btn-primary">Mes activités</Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon="📅" label="Mes activités" value={activites.length} to="/activites" color="primary" />
        <StatCard icon="⚠️" label="Sans facture liée" value={nonLiees.length} to="/activites" color="orange" sub="Activités publiées sans montant" />
      </div>
    </div>
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
  const [sparkData, setSparkData] = useState([])
  const [impChart, setImpChart]   = useState([])
  const [resChart, setResChart]   = useState([])
  const as = anneeScolaire()
  useEffect(() => {
    const d6 = new Date(); d6.setMonth(d6.getMonth() - 5); d6.setDate(1)
    Promise.all([
      supabase.from('paiements').select('eleve_id, montant, date').not('eleve_id', 'is', null),
      supabase.from('factures').select('eleve_id, montant').not('eleve_id', 'is', null),
      supabase.from('article_attributions').select('prix_unitaire_applique, quantite, nb_eleves, statut_facturation, article:article_id(categorie, prix_unitaire)'),
      supabase.from('activites').select('montant_total, pop, statut, statut_facturation'),
      supabase.from('echelonnements').select('statut'),
      supabase.from('organismes_tiers').select('organisme, statut'),
      supabase.from('paiements').select('date, montant').gte('date', d6.toISOString().split('T')[0]),
    ]).then(([paiesAll, factAll, attrs, activites, echs, orgs, paies6m]) => {
      // Impayés / En réserve — calculés dynamiquement (paiements − factures par élève)
      const sumByEleve = rows => {
        const m = new Map()
        for (const r of (rows || [])) {
          if (r.eleve_id) m.set(r.eleve_id, (m.get(r.eleve_id) || 0) + Number(r.montant || 0))
        }
        return m
      }
      const mP = sumByEleve(paiesAll.data)
      const mF = sumByEleve(factAll.data)
      const allIds = new Set([...mP.keys(), ...mF.keys()])
      let imp = 0, res = 0
      allIds.forEach(id => {
        const s = (mP.get(id) || 0) - (mF.get(id) || 0)
        if (s < 0) imp += Math.abs(s)
        else if (s > 0) res += s
      })
      setImpayes(imp)
      setEnReserve(res)

      // Sparkline — tendance impayés / réserve mois par mois
      const now = new Date()
      const monthEnds = []
      for (let i = 5; i >= 0; i--) {
        // dernier jour du mois (now.getMonth() - i + 1, jour 0 = dernier du mois précédent)
        const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        monthEnds.push(d.toISOString().split('T')[0])
      }
      const impTrend = [], resTrend = []
      monthEnds.forEach(endDate => {
        // Paiements cumulés jusqu'à cette date
        const mPm = new Map()
        for (const r of (paiesAll.data || [])) {
          if (r.eleve_id && r.date && r.date <= endDate)
            mPm.set(r.eleve_id, (mPm.get(r.eleve_id) || 0) + Number(r.montant || 0))
        }
        const ids = new Set([...mPm.keys(), ...mF.keys()])
        let im = 0, re = 0
        ids.forEach(id => {
          const s = (mPm.get(id) || 0) - (mF.get(id) || 0)
          if (s < 0) im += Math.abs(s)
          else if (s > 0) re += s
        })
        impTrend.push(im)
        resTrend.push(re)
      })
      setImpChart(impTrend)
      setResChart(resTrend)
      // Sparkline secondaire — paiements bruts 6 mois (gardé pour référence)
      const byM = {}
      monthEnds.forEach(e => { byM[e.substring(0, 7)] = 0 })
      ;(paies6m.data || []).forEach(p => {
        const k = p.date?.substring(0, 7)
        if (k && byM[k] !== undefined) byM[k] += Number(p.montant || 0)
      })
      setSparkData(Object.values(byM))

      // Éléments à facturer / facturés
      function compute(stat) {
        const rows = (attrs.data || []).filter(a => a.statut_facturation === stat)
        // Articles : prix × quantité × nb_élèves
        const sum = cat => rows.filter(a => a.article?.categorie === cat)
          .reduce((s, a) => s
            + Number(a.prix_unitaire_applique || a.article?.prix_unitaire || 0)
            * Number(a.quantite || 1)
            * Number(a.nb_eleves || 1), 0)
        // Activités : montant_total − intervention POP
        const act = (activites.data || [])
          .filter(a => a.statut_facturation === stat && a.statut !== 'archive')
          .reduce((s, a) => s + Math.max(0, Number(a.montant_total || 0) - Number(a.pop || 0)), 0)
        return { frais: sum('Frais obligatoires'), materiel: sum('Fournitures scolaires'), activites: act, autres: sum('Vêtements') + sum('Divers') }
      }
      setAFacturer(compute('a_facturer'))
      setFacture(compute('facture'))

      const ec = {}
      ;(echs.data || []).forEach(e => { ec[e.statut] = (ec[e.statut] || 0) + 1 })
      setEchStats({ en_cours: ec.en_cours || 0, non_respecte: ec.non_respecte || 0, termine: ec.termine || 0 })
      const og = {}
      ;(orgs.data || []).filter(o => ['en_cours', 'valide'].includes(o.statut))
        .forEach(o => { const k = ['CPAS', 'ULB', 'SPJ'].includes(o.organisme) ? o.organisme : 'Autre'; og[k] = (og[k] || 0) + 1 })
      setOrgStats({ CPAS: og.CPAS || 0, ULB: og.ULB || 0, SPJ: og.SPJ || 0, Autre: og.Autre || 0 })
      setLoading(false)
    })
  }, [])
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement...</div>
  const totA = aFacturer.frais + aFacturer.materiel + aFacturer.activites + aFacturer.autres
  const totF = facture.frais + facture.materiel + facture.activites + facture.autres
  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-0.5">Année scolaire {as}</p>
      </div>
      <section>
        <SectionTitle icon="💰" title="Vue financière" subtitle={`Année scolaire ${as}`} />
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon="⚠️" label="Impayés" value={fmtShort(impayes)}
            sub="Soldes négatifs cumulés" to="/eleves?solde=negatif" color="red" chart={impChart} />
          <StatCard icon="🏦" label="En réserve" value={fmtShort(enReserve)}
            sub="Soldes positifs cumulés" to="/eleves?solde=positif" color="green" chart={resChart} />
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="📦" title="Éléments à facturer" subtitle="Articles et activités avec statut à facturer" />
          <span className="text-lg font-bold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-lg">{fmtShort(totA)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais obligatoires" value={fmtShort(aFacturer.frais)} to="/articles?onglet=attributions" color="blue" />
          <MiniStat label="Matériel scolaire" value={fmtShort(aFacturer.materiel)} to="/articles?onglet=attributions" color="indigo" />
          <MiniStat label="Activités" value={fmtShort(aFacturer.activites)} to="/activites" color="purple" />
          <MiniStat label="Autres" value={fmtShort(aFacturer.autres)} to="/articles?onglet=attributions" color="gray" />
        </div>
      </section>
      <section>
        <SectionTitle icon="🤝" title="Assistant social" subtitle="Situations financières particulières en cours" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Échelonnements</h3>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="En cours" value={echStats.en_cours} to="/assistant-social" color="blue" />
              <MiniStat label="Non respecté" value={echStats.non_respecte} to="/assistant-social" color="red" />
              <MiniStat label="Terminé" value={echStats.termine} to="/assistant-social" color="green" />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Organismes tiers (actifs)</h3>
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
          <span className="text-lg font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg">{fmtShort(totF)}</span>
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
            <Link to="/admin" className="card p-5 hover:shadow-md transition-all bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold">Gérer les utilisateurs</div>
              <div className="text-sm opacity-80 mt-1">Rôles, invitations, accès</div>
            </Link>
            <Link to="/admin" className="card p-5 hover:shadow-md transition-all bg-gradient-to-br from-amber-400 to-orange-500 text-white">
              <div className="text-2xl mb-2">🔒</div>
              <div className="font-semibold">Gérer les droits</div>
              <div className="text-sm opacity-80 mt-1">Permissions par rôle</div>
            </Link>
            <Link to="/admin" className="card p-5 hover:shadow-md transition-all bg-gradient-to-br from-orange-500 to-red-500 text-white">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/20 font-bold text-xl mb-2">S</div>
              <div className="font-semibold">Synchronisation Smartschool</div>
              <div className="text-sm opacity-80 mt-1">Importer élèves et personnel</div>
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
export default function Home() {
  const { isFinancier, isMdp, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement...</div>
  if (isFinancier) return <HomeFinancier />
  if (isMdp) return <HomeMdp />
  return (
    <div className="p-8 text-center">
      <div className="text-4xl mb-4">🏫</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">ESPM Finances</h1>
      <p className="text-gray-500">Bienvenue.</p>
    </div>
  )
}
