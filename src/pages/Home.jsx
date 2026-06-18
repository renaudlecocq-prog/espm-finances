import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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
  return m >= 8 ? `${y}–${y + 1}` : `${y - 1}–${y}`
}

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// ── Composants réutilisables ─────────────────────────────────────────────────
function SectionTitle({ icon, title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        {icon && <span>{icon}</span>} {title}
      </h2>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatCard({ label, value, sub, to, color = 'red', icon }) {
  const colors = {
    red:    'from-red-500 to-red-600',
    green:  'from-green-500 to-green-600',
    blue:   'from-blue-500 to-blue-600',
    orange: 'from-orange-500 to-orange-600',
    primary:'from-primary to-primary-lighter',
  }
  const inner = (
    <div className={`card p-5 bg-gradient-to-br ${colors[color]} text-white ${to ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        {icon && <span className="text-2xl">{icon}</span>}
        {to && <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
      </div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-sm font-medium opacity-90 mt-1">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function MiniStat({ label, value, to, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-50 text-gray-700',
    blue:   'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    purple: 'bg-purple-50 text-purple-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
  }
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
      {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name} : {fmt(p.value)}</p>)}
    </div>
  )
}

// ── Vue Admin / Financier ────────────────────────────────────────────────────
function HomeFinancier() {
  const { isAdmin, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [impayes, setImpayes]     = useState(0)
  const [enReserve, setEnReserve] = useState(0)
  const [monthlyData, setMonthlyData] = useState([])
  const [aFacturer, setAFacturer] = useState({ photocopies: 0, materiel: 0, activites: 0, autres: 0 })
  const [facture, setFacture]     = useState({ photocopies: 0, materiel: 0, activites: 0, autres: 0 })
  const [echStats, setEchStats]   = useState({ en_cours: 0, non_respecte: 0, termine: 0 })
  const [orgStats, setOrgStats]   = useState({ CPAS: 0, ULB: 0, SPJ: 0, Autre: 0 })
  const as = anneeScolaire()

  useEffect(() => {
    Promise.all([
      supabase.from('eleves').select('*, factures(montant), paiements(montant)').eq('actif', true),
      supabase.from('paiements').select('montant, date'),
      supabase.from('article_attributions').select('prix_unitaire_applique, quantite, statut_facturation, article:article_id(categorie, prix_unitaire)'),
      supabase.from('activites').select('montant_total, statut, statut_facturation'),
      supabase.from('echelonnements').select('statut'),
      supabase.from('organismes_tiers').select('organisme, statut'),
    ]).then(([eleves, paiements, attrs, activites, echs, orgs]) => {
      // Soldes
      const soldes = (eleves.data || []).map(e => {
        const totalP = (e.paiements || []).reduce((s, p) => s + Number(p.montant || 0), 0)
        const totalF = (e.factures  || []).reduce((s, f) => s + Number(f.montant || 0), 0)
        return totalP - totalF
      })
      setImpayes(Math.abs(soldes.filter(s => s < 0).reduce((a, b) => a + b, 0)))
      setEnReserve(soldes.filter(s => s > 0).reduce((a, b) => a + b, 0))

      // Graphique 12 mois
      const now = new Date()
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        return { mois: MOIS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), enc: 0 }
      })
      ;(paiements.data || []).forEach(p => {
        const d = new Date(p.date)
        const idx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth())
        if (idx >= 0) months[idx].enc += Number(p.montant || 0)
      })
      setMonthlyData(months.map(m => ({ name: m.mois, Encaissé: Math.round(m.enc) })))

      // Articles à facturer / facturés
      const compute = stat => {
        const rows = (attrs.data || []).filter(a => a.statut_facturation === stat)
        const sum = (...cats) => rows
          .filter(a => cats.includes(a.article?.categorie))
          .reduce((s, a) => s + Number(a.prix_unitaire_applique || a.article?.prix_unitaire || 0) * Number(a.quantite || 1), 0)
        const actSum = (activites.data || [])
          .filter(a => a.statut_facturation === stat && a.statut !== 'archive')
          .reduce((s, a) => s + Number(a.montant_total || 0), 0)
        return {
          photocopies: sum('Frais obligatoires'),
          materiel:    sum('Fournitures scolaires'),
          autres:      sum('Vêtements', 'Divers'),
          activites:   actSum,
        }
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

  const totalAFacturer = aFacturer.photocopies + aFacturer.materiel + aFacturer.activites + aFacturer.autres
  const totalFacture   = facture.photocopies   + facture.materiel   + facture.activites   + facture.autres

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Bonjour{profile?.prenom ? `, ${profile.prenom}` : ''} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
      </div>

      {/* 1 — Vue financière */}
      <section>
        <SectionTitle icon="💶" title="Vue financière" sub={`Année scolaire ${as}`} />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard icon="⚠️" label="Impayés"    value={fmtShort(impayes)}   sub="Soldes négatifs cumulés" to="/eleves?solde=negatif"   color="red"   />
          <StatCard icon="🏦" label="En réserve" value={fmtShort(enReserve)} sub="Soldes positifs cumulés" to="/eleves?solde=positif"   color="green" />
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

      {/* 2 — Éléments à facturer */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="📤" title="Éléments à facturer" sub={`Année scolaire ${as}`} />
          <span className="text-lg font-bold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-lg">{fmtShort(totalAFacturer)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais photocopies" value={fmtShort(aFacturer.photocopies)} to="/articles?cat=Frais+obligatoires"     color="blue"   />
          <MiniStat label="Matériel scolaire" value={fmtShort(aFacturer.materiel)}    to="/articles?cat=Fournitures+scolaires"   color="indigo" />
          <MiniStat label="Activités"         value={fmtShort(aFacturer.activites)}   to="/activites?statut_facturation=a_facturer" color="purple" />
          <MiniStat label="Autres"            value={fmtShort(aFacturer.autres)}      to="/articles?cat=Autres"                  color="gray"   />
        </div>
      </section>

      {/* 3 — Assistant social */}
      <section>
        <SectionTitle icon="🤝" title="Assistant social" sub={`Année scolaire ${as}`} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Échelonnements</h3>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="En cours"     value={echStats.en_cours}     to="/echelonnements?statut=en_cours"     color="blue"  />
              <MiniStat label="Non respecté" value={echStats.non_respecte} to="/echelonnements?statut=non_respecte" color="red"   />
              <MiniStat label="Terminé"      value={echStats.termine}      to="/echelonnements?statut=termine"      color="green" />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Organismes tiers (actifs)</h3>
            <div className="grid grid-cols-4 gap-3">
              <MiniStat label="CPAS"  value={orgStats.CPAS}  to="/organismes?type=CPAS"  color="blue"   />
              <MiniStat label="ULB"   value={orgStats.ULB}   to="/organismes?type=ULB"   color="indigo" />
              <MiniStat label="SPJ"   value={orgStats.SPJ}   to="/organismes?type=SPJ"   color="purple" />
              <MiniStat label="Autre" value={orgStats.Autre} to="/organismes?type=Autre" color="gray"   />
            </div>
          </div>
        </div>
      </section>

      {/* 4 — Éléments facturés */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon="✅" title="Éléments facturés" sub={`Année scolaire ${as}`} />
          <span className="text-lg font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg">{fmtShort(totalFacture)}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Frais photocopies" value={fmtShort(facture.photocopies)} to="/articles?cat=Frais+obligatoires&statut=facture"   color="green" />
          <MiniStat label="Matériel scolaire" value={fmtShort(facture.materiel)}    to="/articles?cat=Fournitures+scolaires&statut=facture" color="green" />
          <MiniStat label="Activités"         value={fmtShort(facture.activites)}   to="/activites?statut_facturation=facture"             color="green" />
          <MiniStat label="Autres"            value={fmtShort(facture.autres)}      to="/articles?cat=Autres&statut=facture"               color="green" />
        </div>
      </section>

      {/* 5 — Administration (admin uniquement) */}
      {isAdmin && (
        <section>
          <SectionTitle icon="⚙️" title="Administration" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/admin" className="card p-5 hover:shadow-md transition-all cursor-pointer border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">👥</div>
              <div>
                <div className="font-semibold text-gray-800">Gérer les utilisateurs</div>
                <div className="text-sm text-gray-500 mt-0.5">Rôles, invitations, accès</div>
              </div>
            </Link>
            <Link to="/admin" className="card p-5 hover:shadow-md transition-all cursor-pointer border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">🔐</div>
              <div>
                <div className="font-semibold text-gray-800">Gérer les droits</div>
                <div className="text-sm text-gray-500 mt-0.5">Permissions par rôle</div>
              </div>
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Vue MdP ──────────────────────────────────────────────────────────────────
function HomeMdp() {
  const { user } = useAuth()
  const [activites, setActivites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('activites').select('*').eq('created_by', user?.id).neq('statut','archive').order('date', { ascending: false })
      .then(({ data }) => { setActivites(data || []); setLoading(false) })
  }, [user])

  const nonLiees = activites.filter(a => a.statut === 'publie' && (!a.montant_total || a.montant_total == 0))

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bonjour 👋</h1>
        <p className="text-gray-500 text-sm mt-0.5">Année scolaire {anneeScolaire()}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon="🎯" label="Mes activités" value={activites.length} to="/activites" color="primary" />
        <StatCard icon="⚠️" label="Activités non reliées à une facture" value={nonLiees.length} to="/activites" color="orange" sub="Publiées sans montant" />
      </div>

      {nonLiees.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Activités sans montant</h2>
          <div className="grid gap-3">
            {nonLiees.map(a => (
              <div key={a.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{a.intitule}</div>
                  <div className="text-sm text-gray-500">{a.date} · {a.type}</div>
                </div>
                <span className="badge bg-orange-100 text-orange-700">Sans montant</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vue Responsable ──────────────────────────────────────────────────────────
function EleveFiche({ eleve }) {
  const [factures, setFactures]   = useState([])
  const [paiements, setPaiements] = useState([])
  const [activites, setActivites] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('factures').select('*').eq('eleve_id', eleve.id).order('date', { ascending: false }),
      supabase.from('paiements').select('*').eq('eleve_id', eleve.id).order('date', { ascending: false }),
    ]).then(([f, p]) => { setFactures(f.data || []); setPaiements(p.data || []) })

    // Activités liées via facture
    supabase.from('activites').select('intitule, date, montant_par_eleve, statut')
      .not('facture_id', 'is', null)
      .then(({ data }) => setActivites(data || []))
  }, [eleve.id])

  const totalF = factures.reduce((s, f) => s + Number(f.montant || 0), 0)
  const totalP = paiements.reduce((s, p) => s + Number(p.montant || 0), 0)

  const infoFields = [
    ['Classe',            eleve.classe],
    ['Date de naissance', eleve.date_naissance],
    ['Nationalité',       eleve.nationalite],
    ['Adresse',           [eleve.rue, eleve.code_postal, eleve.commune].filter(Boolean).join(', ') || null],
    eleve.philosophie && ['RLMO', eleve.philosophie],
    eleve.math_d3     && ['Math', eleve.math_d3],
    eleve.sciences_d3 && ['Sciences', eleve.sciences_d3],
    eleve.obs_d2      && ['OBS D2', eleve.obs_d2],
    eleve.ac_d2       && ['AC D2', eleve.ac_d2],
  ].filter(Boolean)

  return (
    <div className="card overflow-hidden">
      <div className="bg-primary px-5 py-4">
        <h2 className="text-lg font-bold text-white">{eleve.prenom} {eleve.nom}</h2>
        <p className="text-white/70 text-sm">{eleve.classe || 'Classe non renseignée'}</p>
      </div>

      <div className="p-5 space-y-6">
        {/* Infos */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informations</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {infoFields.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-sm">
                <dt className="text-gray-500 min-w-[130px]">{k}</dt>
                <dd className="text-gray-800 font-medium">{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Factures */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Factures</p>
            <span className="text-sm font-bold text-gray-700">Total : {fmt(totalF)}</span>
          </div>
          {factures.length === 0
            ? <p className="text-sm text-gray-400">Aucune facture</p>
            : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-left pb-2">N°</th>
                  <th className="text-right pb-2">Montant</th>
                  <th className="text-right pb-2">Statut</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {factures.map(f => (
                    <tr key={f.id}>
                      <td className="py-2 text-gray-500">{f.date}</td>
                      <td className="py-2 text-gray-600">{f.numero || '—'}</td>
                      <td className="py-2 text-right font-medium">{fmt(f.montant)}</td>
                      <td className="py-2 text-right">
                        <span className={`badge ${f.statut === 'paye' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {f.statut === 'paye' ? 'Payé' : 'Non payé'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Paiements */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paiements reçus</p>
            <span className="text-sm font-bold text-gray-700">Total : {fmt(totalP)}</span>
          </div>
          {paiements.length === 0
            ? <p className="text-sm text-gray-400">Aucun paiement</p>
            : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-left pb-2">Montant</th>
                  <th className="text-left pb-2">Payé par</th>
                  <th className="text-left pb-2">Remarque</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {paiements.map(p => (
                    <tr key={p.id}>
                      <td className="py-2 text-gray-500">{p.date}</td>
                      <td className="py-2 font-medium">{fmt(p.montant)}</td>
                      <td className="py-2 text-gray-600">{p.paye_par || '—'}</td>
                      <td className="py-2 text-gray-400 text-xs">{p.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Activités */}
        {activites.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Activités facturées</p>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2">Date</th>
                <th className="text-left pb-2">Intitulé</th>
                <th className="text-right pb-2">Montant</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {activites.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-500">{a.date}</td>
                    <td className="py-2 text-gray-700">{a.intitule}</td>
                    <td className="py-2 text-right font-medium">{fmt(a.montant_par_eleve)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function HomeResponsable() {
  const { user } = useAuth()
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('responsable_eleve').select('eleve:eleve_id(*)').eq('responsable_id', user.id)
      .then(({ data }) => {
        setEleves((data || []).map(r => r.eleve).filter(Boolean))
        setLoading(false)
      })
  }, [user])

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  if (eleves.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">🏫</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Bienvenue</h1>
        <p className="text-gray-500">Aucun élève n'est encore associé à votre compte. Contactez l'école.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bienvenue 👋</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {eleves.length === 1 ? 'Fiche de votre enfant' : 'Fiches de vos enfants'}
        </p>
      </div>
      {eleves.map(e => <EleveFiche key={e.id} eleve={e} />)}
    </div>
  )
}

// ── Export principal ─────────────────────────────────────────────────────────
export default function Home() {
  const { isFinancier, isMdp, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  if (isFinancier) return <HomeFinancier />
  if (isMdp)       return <HomeMdp />
  return <HomeResponsable />
}
