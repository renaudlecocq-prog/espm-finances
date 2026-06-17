import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Utilitaires ──────────────────────────────────────────────────────────────
const fmt = n => Number(n || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtShort = n => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'k €'
  return v.toFixed(2) + ' €'
}

function anneeScolaire() {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// ── Composants ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, to, color = 'primary', icon }) {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    red: 'from-red-500 to-red-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    yellow: 'from-yellow-400 to-yellow-500',
    blue: 'from-blue-500 to-blue-600',
    indigo: 'from-indigo-500 to-indigo-600',
  }
  const inner = (
    <div className={`card p-5 bg-gradient-to-br ${colors[color]} text-white ${to ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {to && <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
      </div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-sm font-medium opacity-90 mt-1">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
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
  const colors = { gray: 'bg-gray-50 text-gray-700', blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700', orange: 'bg-orange-50 text-orange-700', yellow: 'bg-yellow-50 text-yellow-700' }
  const inner = (
    <div className={`rounded-xl p-4 ${colors[color]} ${to ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name} : {fmt(p.value)}</p>
      ))}
    </div>
  )
}

// ── Vue MdP ──────────────────────────────────────────────────────────────────
function HomeMdp() {
  const { user } = useAuth()
  const [activites, setActivites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('activites').select('*').eq('created_by', user?.id).neq('statut','archive').order('date_debut').then(({ data }) => {
      setActivites(data || [])
      setLoading(false)
    })
  }, [user])

  const sansFact = activites.filter(a => !a.statut_facturation || a.statut_facturation === 'a_facturer')
  const nonLiees = activites.filter(a => a.statut === 'publie' && (!a.montant_total || a.montant_total == 0))

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bonjour 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">Année scolaire {anneeScolaire()}</p>
        </div>
        <Link to="/activites" className="btn-primary">Mes activités</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard icon="🎯" label="Mes activités" value={activites.length} to="/activites" color="primary" />
        <StatCard icon="⚠️" label="Sans facture liée" value={nonLiees.length} to="/activites" color="orange" sub="Activités publiées sans montant" />
      </div>

      {sansFact.length > 0 && (
        <div>
          <SectionTitle icon="📋" title="Activités à facturer" subtitle="Ces activités sont publiées mais pas encore facturées" />
          <div className="grid gap-3">
            {sansFact.map(a => (
              <div key={a.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{a.intitule}</div>
                  <div className="text-sm text-gray-500">{a.date_debut} · {a.type} · {a.nb_eleves || '?'} élèves</div>
                </div>
                <div className="flex items-center gap-3">
                  {a.montant_total && <span className="text-sm font-semibold text-gray-700">{fmt(a.montant_total)}</span>}
                  <span className="badge bg-yellow-100 text-yellow-700">à facturer</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vue Admin/Financier ───────────────────────────────────────────────────────
function HomeFinancier() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [impayes, setImpayes] = useState(0)
  const [enReserve, setEnReserve] = useState(0)
  const [monthlyData, setMonthlyData] = useState([])
  const [aFacturer, setAFacturer] = useState({ frais: 0, materiel: 0, activites: 0, autres: 0 })
  const [facture, setFacture] = useState({ frais: 0, materiel: 0, activites: 0, autres: 0 })
  const [echStats, setEchStats] = useState({ en_cours: 0, non_respecte: 0, termine: 0 })
  const [orgStats, setOrgStats] = useState({ CPAS: 0, ULB: 0, SPJ: 0, Autre: 0 })
  const as = anneeScolaire()

  useEffect(() => {
    Promise.all([
      // Soldes élèves
      supabase.from('eleves').select('solde').eq('actif', true),
      // Paiements mensuels (12 derniers mois)
      supabase.from('paiements').select('montant, date_paiement'),
      // Attributions d'articles
      supabase.from('article_attributions').select('prix_unitaire_applique, quantite, statut_facturation, article:article_id(categorie, prix_unitaire)'),
      // Activités
      supabase.from('activites').select('montant_total, statut, statut_facturation'),
      // Échelonnements
      supabase.from('echelonnements').select('statut'),
      // Organismes tiers
      supabase.from('organismes_tiers').select('organisme, statut'),
    ]).then(([eleves, paiements, attrs, activites, echs, orgs]) => {
      // Impayés / En réserve
      const soldes = (eleves.data || []).map(e => Number(e.solde || 0))
      setImpayes(Math.abs(soldes.filter(s => s < 0).reduce((a, b) => a + b, 0)))
      setEnReserve(soldes.filter(s => s > 0).reduce((a, b) => a + b, 0))

      // Graphique 12 mois
      const now = new Date()
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        return { mois: MOIS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), encaisse: 0 }
      })
      ;(paiements.data || []).forEach(p => {
        const d = new Date(p.date_paiement)
        const idx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth())
        if (idx >= 0) months[idx].encaisse += Number(p.montant || 0)
      })
      setMonthlyData(months.map(m => ({ name: m.mois, Encaissé: Math.round(m.encaisse) })))

      // Éléments à facturer / facturés
      const compute = (stat) => {
        const rows = (attrs.data || []).filter(a => a.statut_facturation === stat)
        const sum = (cat) => rows.filter(a => a.article?.categorie === cat).reduce((s, a) => {
          const prix = Number(a.prix_unitaire_applique || a.article?.prix_unitaire || 0)
          return s + prix * Number(a.quantite || 1)
        }, 0)
        const frais = sum('Frais obligatoires')
        const materiel = sum('Fournitures scolaires')
        const autres = sum('Vêtements') + sum('Divers')
        const act = (activites.data || []).filter(a => a.statut_facturation === stat && a.statut !== 'archive')
          .reduce((s, a) => s + Number(a.montant_total || 0), 0)
        return { frais, materiel, activites: act, autres }
      }
      setAFacturer(compute('a_facturer'))
      setFacture(compute('facture'))

      // Échelonnements
      const ec = {}
      ;(echs.data || []).forEach(e => { ec[e.statut] = (ec[e.statut] || 0) + 1 })
      setEchStats({ en_cours: ec.en_cours || 0, non_respecte: ec.non_respecte || 0, termine: ec.termine || 0 })

      // Organismes
      const og = {}
      ;(orgs.data || []).filter(o => ['en_cours','valide'].includes(o.statut)).forEach(o => {
        const k = ['CPAS','ULB','SPJ'].includes(o.organisme) ? o.organisme : 'Autre'
        og[k] = (og[k] || 0) + 1
      })
      setOrgStats({ CPAS: og.CPAS || 0, ULB: og.ULB || 0, SPJ: og.SPJ || 0, Autre: og.Autre || 0 })

      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  const totalAFacturer = aFacturer.frais + aFacturer.materiel + aFacturer.activites + aFacturer.autres
  const totalFacture = facture.frais + facture.materiel + facture.activites + facture.autres

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-10">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">Année scolaire {as}</p>
        </div>
      </div>

      {/* ── 1. Vue financière ── */}
      <section>
        <SectionTitle icon="💶" title="Vue financière" subtitle={`Année scolaire ${as}`} />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard icon="⚠️" label="Impayés" value={fmtShort(impayes)} sub="Soldes négatifs cumulés" to="/eleves?solde=negatif" color="red" />
          <StatCard icon="🏦" label="En réserve" value={fmtShort(enReserve)} sub="Soldes positifs cumulés" to="/eleves?solde=positif" color="green" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Encaissements — 12 derniers mois</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Encaissé" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── 2. Éléments à facturer ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="📤" title="Éléments à facturer" subtitle="Articles et activités avec statut « à facturer »" />
          <span className="text-lg font-bold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-lg">{fmtShort(totalAFacturer)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais obligatoires" value={fmtShort(aFacturer.frais)} to="/articles?onglet=attributions" color="blue" />
          <MiniStat label="Matériel scolaire" value={fmtShort(aFacturer.materiel)} to="/articles?onglet=attributions" color="indigo" />
          <MiniStat label="Activités" value={fmtShort(aFacturer.activites)} to="/activites" color="purple" />
          <MiniStat label="Autres (vêt. + divers)" value={fmtShort(aFacturer.autres)} to="/articles?onglet=attributions" color="gray" />
        </div>
      </section>

      {/* ── 3. Assistant social ── */}
      <section>
        <SectionTitle icon="🤝" title="Assistant social" subtitle="Situations financières particulières en cours" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Échelonnements</h3>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="En cours" value={echStats.en_cours} to="/echelonnements" color="blue" />
              <MiniStat label="Non respecté" value={echStats.non_respecte} to="/echelonnements" color="red" />
              <MiniStat label="Terminé" value={echStats.termine} to="/echelonnements" color="green" />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Organismes tiers (actifs)</h3>
            <div className="grid grid-cols-4 gap-3">
              <MiniStat label="CPAS" value={orgStats.CPAS} to="/organismes" color="blue" />
              <MiniStat label="ULB" value={orgStats.ULB} to="/organismes" color="indigo" />
              <MiniStat label="SPJ" value={orgStats.SPJ} to="/organismes" color="purple" />
              <MiniStat label="Autre" value={orgStats.Autre} to="/organismes" color="gray" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Éléments facturés ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="✅" title="Éléments facturés" subtitle="Articles et activités déjà facturés cette année" />
          <span className="text-lg font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg">{fmtShort(totalFacture)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais obligatoires" value={fmtShort(facture.frais)} to="/articles?onglet=attributions" color="green" />
          <MiniStat label="Matériel scolaire" value={fmtShort(facture.materiel)} to="/articles?onglet=attributions" color="green" />
          <MiniStat label="Activités" value={fmtShort(facture.activites)} to="/activites" color="green" />
          <MiniStat label="Autres (vêt. + divers)" value={fmtShort(facture.autres)} to="/articles?onglet=attributions" color="green" />
        </div>
      </section>

      {/* ── 5. Administration ── */}
      {isAdmin && (
        <section>
          <SectionTitle icon="⚙️" title="Administration" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin" className="card p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer border border-gray-100">
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold text-gray-800">Gérer les utilisateurs</div>
              <div className="text-sm text-gray-500 mt-1">Rôles, invitations, accès</div>
            </Link>
            <Link to="/eleves" className="card p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer border border-gray-100">
              <div className="text-2xl mb-2">🎓</div>
              <div className="font-semibold text-gray-800">Tous les élèves</div>
              <div className="text-sm text-gray-500 mt-1">Liste complète, fiche individuelle</div>
            </Link>
            <Link to="/groupes" className="card p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer border border-gray-100">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold text-gray-800">Groupes</div>
              <div className="text-sm text-gray-500 mt-1">RLMO, options, cours</div>
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Export principal ──────────────────────────────────────────────────────────
export default function Home() {
  const { role, isFinancier, isMdp, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  if (isFinancier) return <HomeFinancier />
  if (isMdp) return <HomeMdp />

  // Responsable ou autre
  return (
    <div className="p-8 text-center">
      <div className="text-4xl mb-4">🏫</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">ESPM Finances</h1>
      <p className="text-gray-500">Bienvenue. Votre espace est en cours de préparation.</p>
    </div>
  )
}
