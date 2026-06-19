import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MasterFilter, { ActiveFilterChips } from '../components/ui/MasterFilter'
import FicheEleve from '../components/ui/FicheEleve'
import Commentaires from '../components/ui/Commentaires'
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X,
  AlertTriangle, CheckCircle2, Clock, Calendar,
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────
const STATUT_ECH = {
  en_cours:     { label: 'En cours',     cls: 'bg-blue-100 text-blue-700'    },
  attente:      { label: 'En attente',   cls: 'bg-yellow-100 text-yellow-700' },
  non_respecte: { label: 'Non respecté', cls: 'bg-red-100 text-red-700'      },
  termine:      { label: 'Terminé',      cls: 'bg-green-100 text-green-700'  },
}
const STATUT_OT = {
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700'  },
  valide:   { label: 'Validé',   cls: 'bg-green-100 text-green-700' },
  refuse:   { label: 'Refusé',   cls: 'bg-red-100 text-red-700'    },
  cloture:  { label: 'Clôturé',  cls: 'bg-gray-100 text-gray-600'  },
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtEur = n =>
  new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + ' €'

const fmtDate = d =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'

const addMonths = (dateStr, n) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

function Badge({ val, map }) {
  const m = map[val] || { label: val, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5" />
  return sort.dir === 'asc'
    ? <ChevronUp   size={11} className="text-primary ml-0.5" />
    : <ChevronDown size={11} className="text-primary ml-0.5" />
}

// Automatic alert status based on cumulative payments vs expected
function computeAlertStatus(ech, echeances, paiements) {
  if (!echeances?.length) return { type: 'no_echeances' }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const startDate = new Date((ech.date_debut || ech.debut) + 'T00:00:00')
  if (startDate > today) return { type: 'not_started' }

  const totalPaid = (paiements || [])
    .filter(p => new Date(p.date + 'T00:00:00') >= startDate)
    .reduce((s, p) => s + Number(p.montant), 0)

  let totalExpectedToDate = 0
  for (const e of echeances) {
    if (new Date(e.date_echeance + 'T00:00:00') <= today)
      totalExpectedToDate += Number(e.montant_prevu)
  }

  if (totalExpectedToDate === 0) return { type: 'upcoming', totalPaid }
  const montantRetard = Math.max(0, totalExpectedToDate - totalPaid)
  return montantRetard < 0.01
    ? { type: 'ok', totalPaid, totalExpectedToDate }
    : { type: 'late', montantRetard, totalPaid, totalExpectedToDate }
}

// ── Detail Panel ─────────────────────────────────────────────────────────
function EchelonnementDetail({ ech, echeances: initEcheances, paiements, onClose, onUpdated, isAllowed, onFicheEleve }) {
  const [echeances, setEcheances] = useState(initEcheances || [])
  const [statut, setStatut]       = useState(ech.statut)
  const [editEch, setEditEch]     = useState(null) // { id, value }
  const [saving, setSaving]       = useState(false)

  useEffect(() => { setEcheances(initEcheances || []) }, [initEcheances])
  useEffect(() => { setStatut(ech.statut) }, [ech.statut])

  const sorted = useMemo(() => [...echeances].sort((a, b) => a.numero_mois - b.numero_mois), [echeances])
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const startDate = new Date((ech.date_debut || ech.debut) + 'T00:00:00')

  const totalPaid = useMemo(() =>
    (paiements || []).filter(p => new Date(p.date + 'T00:00:00') >= startDate)
      .reduce((s, p) => s + Number(p.montant), 0)
  , [paiements, ech.date_debut, ech.debut]) // eslint-disable-line

  const totalPrevu = useMemo(() => sorted.reduce((s, e) => s + Number(e.montant_prevu), 0), [sorted])
  const ecartTotal = useMemo(() => Math.round((Number(ech.montant) - totalPrevu) * 100) / 100, [ech.montant, totalPrevu])

  const totalExpectedToDate = useMemo(() =>
    sorted.filter(e => new Date(e.date_echeance + 'T00:00:00') <= today)
      .reduce((s, e) => s + Number(e.montant_prevu), 0)
  , [sorted, today])

  const retard = Math.max(0, totalExpectedToDate - totalPaid)
  const avance = Math.max(0, totalPaid - totalExpectedToDate)

  const echeanceRows = useMemo(() => {
    let cumul = 0
    return sorted.map(e => {
      const prevCumul = cumul
      cumul += Number(e.montant_prevu)
      const due = new Date(e.date_echeance + 'T00:00:00')
      const status = due > today ? 'upcoming'
        : totalPaid >= cumul - 0.01 ? 'paid'
        : 'late'
      const paidForThis = Math.min(Number(e.montant_prevu), Math.max(0, totalPaid - prevCumul))
      return { ...e, status, paidForThis, cumul }
    })
  }, [sorted, totalPaid, today])

  const recentPaiements = useMemo(() =>
    (paiements || []).filter(p => new Date(p.date + 'T00:00:00') >= startDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  , [paiements, ech.date_debut, ech.debut]) // eslint-disable-line

  const saveStatut = async () => {
    setSaving(true)
    await supabase.from('echelonnements').update({ statut }).eq('id', ech.id)
    setSaving(false)
    onUpdated()
  }

  const saveEcheance = async (id, value) => {
    await supabase.from('echeances')
      .update({ montant_prevu: Number(value), updated_at: new Date().toISOString() })
      .eq('id', id)
    const { data } = await supabase.from('echeances').select('*')
      .eq('echelonnement_id', ech.id).order('numero_mois')
    setEcheances(data || [])
    setEditEch(null)
    onUpdated()
  }

  const [editDateDebut, setEditDateDebut] = useState(null) // valeur ISO en cours d'édition

  const saveDateDebut = async (newDate) => {
    if (!newDate) return
    // Mettre à jour la date de début sur l'échelonnement
    await supabase.from('echelonnements').update({ date_debut: newDate }).eq('id', ech.id)
    // Recalculer toutes les dates d'échéance
    const updates = sorted.map(e => ({
      id: e.id,
      date_echeance: addMonths(newDate, e.numero_mois - 1),
    }))
    for (const u of updates) {
      await supabase.from('echeances').update({ date_echeance: u.date_echeance }).eq('id', u.id)
    }
    setEditDateDebut(null)
    onUpdated()
  }

  const dateFin = ech.date_debut && ech.nombre_echeances
    ? addMonths(ech.date_debut, Number(ech.nombre_echeances) - 1) : ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col"
           style={{ zIndex: 51 }}>

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 z-10 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {ech.eleve?.nom} {ech.eleve?.prenom}
              <span className="ml-2 text-sm font-normal text-gray-400">{ech.eleve?.classe}</span>
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">{fmtEur(ech.montant)} · {ech.nombre_echeances} mois</span>
              <Badge val={statut} map={STATUT_ECH} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {onFicheEleve && (
              <button onClick={onFicheEleve}
                className="text-xs text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-2.5 py-1 transition-colors">
                Fiche élève
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — Commentaires */}
          <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
            <Commentaires
              entityType="echelonnement"
              entityId={ech.id}
              entityLabel={`${ech.eleve?.prenom || ''} ${ech.eleve?.nom || ''}`.trim() || 'Échelonnement'}
            />
          </div>

          {/* RIGHT — Détails */}
          <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Total prévu</div>
              <div className="font-bold text-gray-800 text-sm">{fmtEur(totalPrevu)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Total payé</div>
              <div className={`font-bold text-sm ${totalPaid >= totalExpectedToDate - 0.01 ? 'text-green-600' : 'text-orange-500'}`}>
                {fmtEur(totalPaid)}
              </div>
            </div>
            <div className={`rounded-xl p-3 text-center ${retard > 0.01 ? 'bg-red-50' : avance > 0.01 ? 'bg-green-50' : 'bg-gray-50'}`}>
              <div className="text-xs text-gray-400 mb-1">{retard > 0.01 ? 'Retard' : avance > 0.01 ? 'Avance' : 'Situation'}</div>
              <div className={`font-bold text-sm ${retard > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                {retard > 0.01 ? `−${fmtEur(retard)}` : avance > 0.01 ? `+${fmtEur(avance)}` : '✓ À jour'}
              </div>
            </div>
          </div>

          {/* Alerte déséquilibre mensualités */}
          {Math.abs(ecartTotal) > 0.01 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="text-amber-800">
                <span className="font-semibold">La somme des mensualités ne correspond pas au total.</span>
                <div className="mt-1 text-amber-700">
                  Total déclaré&nbsp;: <strong>{fmtEur(Number(ech.montant))}</strong>
                  {' · '}Somme des mensualités&nbsp;: <strong>{fmtEur(totalPrevu)}</strong>
                  {' · '}
                  {ecartTotal > 0
                    ? <span>Il reste <strong className="text-amber-900">{fmtEur(ecartTotal)}</strong> à répartir sur les mensualités.</span>
                    : <span>Les mensualités dépassent le total de <strong className="text-amber-900">{fmtEur(-ecartTotal)}</strong>.</span>
                  }
                </div>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-5 text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />Début&nbsp;:&nbsp;
              {isAllowed && editDateDebut !== null ? (
                <span className="flex items-center gap-1">
                  <input
                    type="date" autoFocus
                    className="border border-primary rounded px-1.5 py-0.5 text-xs text-gray-700 outline-none"
                    value={editDateDebut}
                    onChange={e => setEditDateDebut(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveDateDebut(editDateDebut)
                      if (e.key === 'Escape') setEditDateDebut(null)
                    }}
                  />
                  <button onClick={() => saveDateDebut(editDateDebut)} className="text-green-500 hover:text-green-700 text-xs font-bold">✓</button>
                  <button onClick={() => setEditDateDebut(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✗</button>
                </span>
              ) : (
                <strong
                  className={`text-gray-700 ${isAllowed ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}
                  title={isAllowed ? 'Cliquer pour modifier' : undefined}
                  onClick={() => isAllowed && setEditDateDebut(ech.date_debut)}
                >{fmtDate(ech.date_debut)}</strong>
              )}
            </span>
            {dateFin && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />Fin&nbsp;: <strong className="text-gray-700">{fmtDate(editDateDebut !== null ? addMonths(editDateDebut || ech.date_debut, Number(ech.nombre_echeances) - 1) : dateFin)}</strong>
              </span>
            )}
          </div>

          {/* Echeances table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Suivi des échéances</h3>
              {retard > 0.01 && (
                <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                  <AlertTriangle size={12} />{fmtEur(retard)} en retard
                </span>
              )}
            </div>

            {sorted.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
                Aucune échéance — plan créé dans l'ancien format
              </div>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase w-12">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Prévu</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {echeanceRows.map(e => (
                      <tr key={e.id}
                        className={`border-b border-gray-50 last:border-0
                          ${e.status === 'late' ? 'bg-red-50/40' : e.status === 'paid' ? 'bg-green-50/30' : ''}`}>
                        <td className="px-3 py-2.5 text-gray-400 text-xs font-mono">M{e.numero_mois}</td>
                        <td className="px-3 py-2.5 text-gray-600">{fmtDate(e.date_echeance)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {isAllowed && editEch?.id === e.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number" step="0.01" autoFocus
                                className="border border-primary rounded px-1.5 py-0.5 text-xs w-20 text-right outline-none"
                                value={editEch.value}
                                onChange={ev => setEditEch(p => ({ ...p, value: ev.target.value }))}
                                onKeyDown={ev => {
                                  if (ev.key === 'Enter') saveEcheance(e.id, editEch.value)
                                  if (ev.key === 'Escape') setEditEch(null)
                                }}
                              />
                              <button onClick={() => saveEcheance(e.id, editEch.value)}
                                className="text-green-500 hover:text-green-700 text-xs font-bold">✓</button>
                              <button onClick={() => setEditEch(null)}
                                className="text-gray-400 hover:text-gray-600 text-xs font-bold">✗</button>
                            </div>
                          ) : (
                            <span
                              className={`font-medium text-gray-700 ${isAllowed ? 'cursor-pointer hover:underline decoration-dotted' : ''}`}
                              title={isAllowed ? 'Cliquer pour modifier' : undefined}
                              onClick={() => isAllowed && setEditEch({ id: e.id, value: String(e.montant_prevu) })}
                            >{fmtEur(e.montant_prevu)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {e.status === 'paid' && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 size={12} />Payé
                            </span>
                          )}
                          {e.status === 'late' && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                              <AlertTriangle size={12} />En retard
                            </span>
                          )}
                          {e.status === 'upcoming' && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                              <Clock size={12} />À venir
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paiements reçus */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Paiements reçus depuis le début
              <span className="ml-2 text-xs font-normal text-gray-400">({recentPaiements.length})</span>
            </h3>
            {recentPaiements.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">
                Aucun paiement enregistré depuis le début
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {recentPaiements.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-600">{fmtDate(p.date)}</span>
                    <span className="text-sm font-semibold text-green-700">+{fmtEur(p.montant)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statut manuel */}
          {isAllowed && (
            <div className="border-t border-gray-100 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Statut du plan (manuel)</h3>
              <div className="flex items-center gap-2">
                <select className="input text-sm flex-1" value={statut} onChange={e => setStatut(e.target.value)}>
                  {Object.entries(STATUT_ECH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={saveStatut} disabled={saving || statut === ech.statut}
                  className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50 whitespace-nowrap">
                  {saving ? '…' : 'Sauvegarder'}
                </button>
              </div>
              {ech.remarque && <p className="text-xs text-gray-400 mt-2 italic">"{ech.remarque}"</p>}
            </div>
          )}

        </div>
          </div>{/* end RIGHT */}
        </div>{/* end two-column */}
      </div>
    </div>
  )
}

// ── Creation Form ─────────────────────────────────────────────────────────
function EchelonnementForm({ eleves, onSaved, onClose }) {
  const [form, setForm] = useState({
    eleve_id: '', montant: '', nombre_echeances: '3',
    mensualite: '', date_debut: new Date().toISOString().slice(0, 10),
    statut: 'en_cours', remarque: '',
  })
  const [saving, setSaving] = useState(false)

  const montantNum = Number(form.montant) || 0
  const nMois      = Math.max(1, Number(form.nombre_echeances) || 1)
  const mensCalc   = montantNum > 0 ? Math.round((montantNum / nMois) * 100) / 100 : 0
  const mensualite = Number(form.mensualite) || mensCalc
  const dateFin    = form.date_debut ? addMonths(form.date_debut, nMois - 1) : ''

  const save = async () => {
    if (!form.eleve_id || !montantNum || !nMois) return
    setSaving(true)

    const { data: ech } = await supabase.from('echelonnements').insert({
      eleve_id: form.eleve_id,
      montant: montantNum,
      nombre_echeances: nMois,
      mensualite,
      date_debut: form.date_debut,
      statut: form.statut,
      notes: form.notes || null,
    }).select().single()

    if (ech) {
      const echeances = Array.from({ length: nMois }, (_, i) => ({
        echelonnement_id: ech.id,
        numero_mois: i + 1,
        date_echeance: addMonths(form.date_debut, i),
        montant_prevu: i === nMois - 1
          ? Math.round((montantNum - mensualite * (nMois - 1)) * 100) / 100
          : mensualite,
      }))
      await supabase.from('echeances').insert(echeances)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-bold text-gray-800 text-lg">Nouvel échelonnement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-3">
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id}
                onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
                <option value="">— Choisir un élève —</option>
                {eleves.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.classe}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Montant total (€)</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0.00"
                value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value, mensualite: '' }))} />
            </div>
            <div>
              <label className="label">Nombre de mois</label>
              <input className="input" type="number" min="1" max="36"
                value={form.nombre_echeances}
                onChange={e => setForm(f => ({ ...f, nombre_echeances: e.target.value, mensualite: '' }))} />
            </div>
            <div>
              <label className="label">
                Mensualité (€)
                {mensCalc > 0 && !form.mensualite && (
                  <span className="ml-1 font-normal text-gray-400 text-xs">auto {fmtEur(mensCalc)}</span>
                )}
              </label>
              <input className="input" type="number" step="0.01" min="0"
                placeholder={mensCalc ? String(mensCalc) : '0.00'}
                value={form.mensualite}
                onChange={e => setForm(f => ({ ...f, mensualite: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date de début</label>
              <input className="input" type="date" value={form.date_debut}
                onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date de fin <span className="font-normal text-gray-400">(calculée)</span></label>
              <input className="input bg-gray-100 cursor-not-allowed" type="date" value={dateFin} readOnly />
            </div>
            <div>
              <label className="label">Statut initial</label>
              <select className="input" value={form.statut}
                onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                {Object.entries(STATUT_ECH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="label">Remarque</label>
              <input className="input" value={form.remarque} placeholder="Notes optionnelles…"
                onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving || !form.eleve_id || !montantNum}
              className="btn-primary py-1.5 px-5 text-sm disabled:opacity-50">
              {saving ? 'Enregistrement…' : `Créer — ${nMois} × ${fmtEur(mensualite)}`}
            </button>
            <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab Échelonnements ────────────────────────────────────────────────────
function TabEchelonnements({ isAllowed }) {
  const [rows, setRows]                 = useState([])
  const [echeancesMap, setEcheancesMap] = useState({})
  const [paiementsMap, setPaiementsMap] = useState({})
  const [eleves, setEleves]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [detailId, setDetailId]         = useState(null)
  const [ficheId, setFicheId]           = useState(null)
  const [search, setSearch]             = useState('')
  const [filters, setFilters]           = useState({})
  const [sort, setSort]                 = useState({ col: 'nom', dir: 'asc' })

  const toggleFilter = useCallback((key, val) =>
    setFilters(f => {
      const cur  = Array.isArray(f[key]) ? f[key] : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return next.length === 0
        ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key))
        : { ...f, [key]: next }
    })
  , [])

  const filterDefs = [
    { key: 'statut', label: 'Statut', options: Object.entries(STATUT_ECH).map(([v, m]) => ({ value: v, label: m.label })) },
  ]

  const reload = async () => {
    const [{ data: echs }, { data: echData }, { data: paies }] = await Promise.all([
      supabase.from('echelonnements')
        .select('*, eleve:eleve_id(nom,prenom,classe)')
        .order('created_at', { ascending: false }),
      supabase.from('echeances').select('*').order('numero_mois'),
      supabase.from('paiements').select('id,date,montant,eleve_id').order('date', { ascending: false }),
    ])
    setRows(echs || [])
    const eMap = {}
    for (const e of (echData || [])) {
      if (!eMap[e.echelonnement_id]) eMap[e.echelonnement_id] = []
      eMap[e.echelonnement_id].push(e)
    }
    setEcheancesMap(eMap)
    const pMap = {}
    for (const p of (paies || [])) {
      if (!pMap[p.eleve_id]) pMap[p.eleve_id] = []
      pMap[p.eleve_id].push(p)
    }
    setPaiementsMap(pMap)
  }

  useEffect(() => {
    Promise.all([
      reload(),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom'),
    ]).then(([, e]) => { setEleves(e.data || []); setLoading(false) })
  }, []) // eslint-disable-line

  const del = async (id) => {
    if (!confirm('Supprimer cet échelonnement et toutes ses échéances ?')) return
    await supabase.from('echelonnements').delete().eq('id', id)
    if (detailId === id) setDetailId(null)
    await reload()
  }

  const toggleSort = col =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        (r.eleve?.nom || '').toLowerCase().includes(q) ||
        (r.eleve?.prenom || '').toLowerCase().includes(q)
      )
    }
    if (filters.statut?.length) d = d.filter(r => filters.statut.includes(r.statut))
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      const va = col === 'nom' ? (a.eleve?.nom || '') : col === 'prenom' ? (a.eleve?.prenom || '') : col === 'classe' ? (a.eleve?.classe || '') : String(a[col] ?? '')
      const vb = col === 'nom' ? (b.eleve?.nom || '') : col === 'prenom' ? (b.eleve?.prenom || '') : col === 'classe' ? (b.eleve?.classe || '') : String(b[col] ?? '')
      if (col === 'montant') return (Number(a.montant) - Number(b.montant)) * (dir === 'asc' ? 1 : -1)
      return va.localeCompare(vb, 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [rows, search, filters, sort])

  const detail = detailId ? rows.find(r => r.id === detailId) : null

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  const TH = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-primary whitespace-nowrap"
      style={{ textAlign: right ? 'right' : 'left' }}>
      <span className={`flex items-center gap-0.5 ${right ? 'justify-end' : ''}`}>
        {label}<SortIcon col={col} sort={sort} />
      </span>
    </th>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-48 focus:border-primary transition-colors"
              placeholder="Rechercher par nom, prénom…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <MasterFilter filters={filters} filterDefs={filterDefs} onChange={toggleFilter} onClearAll={() => setFilters({})} />
          {(search || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v)) && (
            <button onClick={() => { setSearch(''); setFilters({}) }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors">
              <X size={11} /> Tout effacer
            </button>
          )}
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <ActiveFilterChips filters={filters} filterDefs={filterDefs} onChange={toggleFilter} />
        {isAllowed && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm py-1.5 px-4">
            + Échelonnement
          </button>
        )}
      </div>

      {showForm && (
        <EchelonnementForm eleves={eleves} onSaved={reload} onClose={() => setShowForm(false)} />
      )}

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 860 }}>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <TH col="nom"             label="Nom" />
              <TH col="prenom"          label="Prénom" />
              <TH col="classe"          label="Classe" />
              <TH col="montant"         label="Montant" right />
              <TH col="nombre_echeances" label="Mois" />
              <TH col="date_debut"      label="Début" />
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-left whitespace-nowrap">Fin</th>
              <TH col="statut"          label="Statut" />
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-center whitespace-nowrap">Suivi auto</th>
              {isAllowed && <th className="px-3 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400">Aucun échelonnement</td>
              </tr>
            ) : filtered.map(r => {
              const echeances = echeancesMap[r.id] || []
              const paiements = paiementsMap[r.eleve_id] || []
              const alert     = computeAlertStatus(r, echeances, paiements)
              const dateFin   = r.date_debut && r.nombre_echeances
                ? addMonths(r.date_debut, r.nombre_echeances - 1) : ''
              const isSelected = r.id === detailId

              return (
                <tr key={r.id}
                  onClick={() => setDetailId(isSelected ? null : r.id)}
                  className={`border-b border-gray-50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary/5 border-primary/10' : 'hover:bg-primary/5'}`}>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{r.eleve?.nom}</td>
                  <td className="px-3 py-2.5 text-gray-700">{r.eleve?.prenom}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{r.eleve?.classe}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-orange-500">{fmtEur(r.montant)}</td>
                  <td className="px-3 py-2.5 text-center text-gray-600">{r.nombre_echeances}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDate(r.date_debut)}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDate(dateFin)}</td>
                  <td className="px-3 py-2.5"><Badge val={r.statut} map={STATUT_ECH} /></td>
                  <td className="px-3 py-2.5 text-center">
                    {alert.type === 'no_echeances' && <span className="text-gray-300 text-xs">—</span>}
                    {alert.type === 'not_started'  && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 justify-center">
                        <Clock size={12} />Non démarré
                      </span>
                    )}
                    {alert.type === 'upcoming'     && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 justify-center">
                        <Clock size={12} />À venir
                      </span>
                    )}
                    {alert.type === 'ok'           && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-500 justify-center">
                        <CheckCircle2 size={13} />À jour
                      </span>
                    )}
                    {alert.type === 'late'         && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-semibold justify-center">
                        <AlertTriangle size={13} />−{fmtEur(alert.montantRetard)}
                      </span>
                    )}
                  </td>
                  {isAllowed && (
                    <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => del(r.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <EchelonnementDetail
          ech={detail}
          echeances={echeancesMap[detail.id] || []}
          paiements={paiementsMap[detail.eleve_id] || []}
          onClose={() => setDetailId(null)}
          onUpdated={reload}
          isAllowed={isAllowed}
          onFicheEleve={() => setFicheId(detail.eleve_id)}
        />
      )}

      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}

// ── Tab Organismes Tiers ─────────────────────────────────────────────────

function OrganismeTiersDetail({ row, onClose, onUpdated, isAllowed }) {
  const [form, setForm] = useState({
    organisme: (row.organisme || 'cpas').toUpperCase(),
    statut: row.statut || 'en_cours',
    montant_accorde: row.montant_accorde != null ? String(row.montant_accorde) : '',
    notes: row.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [ficheId, setFicheId] = useState(null)

  const hasChanges =
    form.organisme.toLowerCase() !== (row.organisme || '') ||
    form.statut !== row.statut ||
    (form.montant_accorde !== '' ? Number(form.montant_accorde) : null) !== row.montant_accorde ||
    (form.notes || null) !== (row.notes || null)

  const save = async () => {
    setSaving(true)
    const payload = {
      organisme: form.organisme.toLowerCase(),
      statut: form.statut,
      montant_accorde: form.montant_accorde !== '' ? Number(form.montant_accorde) : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('organismes_tiers').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onUpdated()
  }

  const del = async () => {
    if (!confirm('Supprimer cet organisme tiers ?')) return
    await supabase.from('organismes_tiers').delete().eq('id', row.id)
    onUpdated()
    onClose()
  }

  const eleve = row.eleve || {}

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/25" onClick={onClose} />
        <div className="relative z-10 w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <div className="font-bold text-gray-800 text-base">
                {eleve.nom} {eleve.prenom}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{eleve.classe}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setFicheId(eleve.id)}
                className="text-xs text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-2.5 py-1 transition-colors">
                Fiche élève
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-1">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">

            {/* LEFT — Commentaires */}
            <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
              <Commentaires
                entityType="organisme_tiers"
                entityId={row.id}
                entityLabel={`${(row.eleve?.prenom || '')} ${(row.eleve?.nom || '')}`.trim() || 'Organisme tiers'}
              />
            </div>

            {/* RIGHT — Détails */}
            <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Organisme + Statut */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Organisme</label>
                {isAllowed
                  ? <select className="input" value={form.organisme}
                      onChange={e => setForm(f => ({ ...f, organisme: e.target.value }))}>
                      {['CPAS', 'ULB', 'SPJ', 'Autre'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  : <div className="input bg-gray-50 font-semibold text-primary">{form.organisme}</div>
                }
              </div>
              <div>
                <label className="label">Statut</label>
                {isAllowed
                  ? <select className="input" value={form.statut}
                      onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                      {Object.entries(STATUT_OT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  : <Badge val={form.statut} map={STATUT_OT} />
                }
              </div>
            </div>

            {/* Montant accordé */}
            <div>
              <label className="label">Montant accordé (€)</label>
              {isAllowed
                ? <input className="input" type="number" step="0.01" value={form.montant_accorde}
                    onChange={e => setForm(f => ({ ...f, montant_accorde: e.target.value }))}
                    placeholder="0.00" />
                : <div className="input bg-gray-50 text-gray-700">
                    {form.montant_accorde ? fmtEur(Number(form.montant_accorde)) : '—'}
                  </div>
              }
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes</label>
              {isAllowed
                ? <textarea className="input resize-none" rows={4} value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Remarques, contacts, numéros de dossier…" />
                : <div className="input bg-gray-50 text-gray-700 min-h-[80px] whitespace-pre-wrap">
                    {form.notes || <span className="text-gray-400 italic">Aucune note</span>}
                  </div>
              }
            </div>

            {/* Dates */}
            <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-100 pt-4">
              {row.created_at && <div>Créé le {fmtDate(row.created_at.slice(0, 10))}</div>}
              {row.updated_at && row.updated_at !== row.created_at &&
                <div>Modifié le {fmtDate(row.updated_at.slice(0, 10))}</div>}
            </div>
          </div>

          {/* Footer */}
          {isAllowed && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button onClick={del}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={13} /> Supprimer
              </button>
              <button onClick={save} disabled={saving || !hasChanges}
                className="btn-primary py-1.5 px-4 text-sm disabled:opacity-40">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
            </div>{/* end RIGHT */}
          </div>{/* end two-column */}
        </div>
      </div>
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </>
  )
}

function TabOrganismesTiers({ isAllowed }) {
  const [rows, setRows]     = useState([])
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [ficheId, setFicheId]   = useState(null)
  const [detailOTId, setDetailOTId] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const toggleFilter = useCallback((key, val) =>
    setFilters(f => {
      const cur  = Array.isArray(f[key]) ? f[key] : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return next.length === 0
        ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key))
        : { ...f, [key]: next }
    })
  , [])
  const filterDefs = [
    { key: 'organisme', label: 'Organisme', options: ['CPAS', 'ULB', 'SPJ', 'Autre'] },
    { key: 'statut',    label: 'Statut',    options: Object.entries(STATUT_OT).map(([v, m]) => ({ value: v, label: m.label })) },
  ]
  const [sort, setSort] = useState({ col: 'nom', dir: 'asc' })
  const [form, setForm] = useState({ eleve_id: '', organisme: 'CPAS', statut: 'en_cours', montant_accorde: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const reload = () =>
    supabase.from('organismes_tiers')
      .select('*, eleve:eleve_id(id,nom,prenom,classe)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows(data || []))

  useEffect(() => {
    Promise.all([
      reload(),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom'),
    ]).then(([, e]) => { setEleves(e.data || []); setLoading(false) })
  }, []) // eslint-disable-line

  const save = async () => {
    if (!form.eleve_id) return
    setSaving(true)
    const payload = {
      ...form,
      organisme: form.organisme.toLowerCase(),
      montant_accorde: form.montant_accorde !== '' ? Number(form.montant_accorde) : null,
      notes: form.notes || null,
    }
    const { error } = await supabase.from('organismes_tiers').insert(payload)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      setSaving(false)
      return
    }
    await reload()
    setSaving(false)
    setShowForm(false)
    setForm({ eleve_id: '', organisme: 'CPAS', statut: 'en_cours', montant_accorde: '', notes: '' })
  }

  const del = async (id) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('organismes_tiers').delete().eq('id', id)
    await reload()
  }

  const toggleSort = col => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const filtered = useMemo(() => {
    let d = rows
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r => (r.eleve?.nom || '').toLowerCase().includes(q) || (r.eleve?.prenom || '').toLowerCase().includes(q))
    }
    if (filters.statut?.length)    d = d.filter(r => filters.statut.includes(r.statut))
    if (filters.organisme?.length) d = d.filter(r => filters.organisme.map(o => o.toLowerCase()).includes((r.organisme || '').toLowerCase()))
    const { col, dir } = sort
    return [...d].sort((a, b) => {
      const va = col === 'nom' ? (a.eleve?.nom || '') : col === 'prenom' ? (a.eleve?.prenom || '') : col === 'classe' ? (a.eleve?.classe || '') : (a[col] ?? '')
      const vb = col === 'nom' ? (b.eleve?.nom || '') : col === 'prenom' ? (b.eleve?.prenom || '') : col === 'classe' ? (b.eleve?.classe || '') : (b[col] ?? '')
      return String(va).localeCompare(String(vb), 'fr') * (dir === 'asc' ? 1 : -1)
    })
  }, [rows, search, filters, sort])

  if (loading) return <div className="py-8 text-center text-gray-400">Chargement…</div>

  const TH = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-primary whitespace-nowrap text-left">
      <span className="flex items-center gap-0.5">{label}<SortIcon col={col} sort={sort} /></span>
    </th>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-48 focus:border-primary transition-colors"
              placeholder="Rechercher par nom, prénom…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <MasterFilter filters={filters} filterDefs={filterDefs} onChange={toggleFilter} onClearAll={() => setFilters({})} />
          {(search || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v)) && (
            <button onClick={() => { setSearch(''); setFilters({}) }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors">
              <X size={11} /> Tout effacer
            </button>
          )}
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <ActiveFilterChips filters={filters} filterDefs={filterDefs} onChange={toggleFilter} />
        {isAllowed && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm py-1.5 px-4">
            + Organisme
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-bold text-gray-800 text-lg">Nouvel organisme tiers</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="col-span-2 md:col-span-3">
                  <label className="label">Élève</label>
                  <select className="input" value={form.eleve_id}
                    onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {eleves.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.classe}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Organisme</label>
                  <select className="input" value={form.organisme}
                    onChange={e => setForm(f => ({ ...f, organisme: e.target.value }))}>
                    {['CPAS', 'ULB', 'SPJ', 'Autre'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select className="input" value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                    {Object.entries(STATUT_OT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Montant accordé (€)</label>
                  <input className="input" type="number" step="0.01" value={form.montant_accorde}
                    onChange={e => setForm(f => ({ ...f, montant_accorde: e.target.value }))} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="label">Notes</label>
                  <input className="input" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={save} disabled={saving || !form.eleve_id}
                  className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <TH col="nom"             label="Nom" />
              <TH col="prenom"          label="Prénom" />
              <TH col="classe"          label="Classe" />
              <TH col="organisme"       label="Organisme" />
              <TH col="montant_accorde" label="Montant accordé" />
              <TH col="statut"          label="Statut" />
              {isAllowed && <th className="px-3 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun organisme tiers</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}
                onClick={() => setDetailOTId(r.id)}
                className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer">
                <td className="px-3 py-2.5 font-medium text-gray-800">{r.eleve?.nom}</td>
                <td className="px-3 py-2.5 text-gray-700">{r.eleve?.prenom}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.eleve?.classe}</td>
                <td className="px-3 py-2.5">
                  <span className="font-semibold text-primary">{(r.organisme || '').toUpperCase()}</span>
                </td>
                <td className="px-3 py-2.5 text-gray-700">
                  {r.montant_accorde ? fmtEur(r.montant_accorde) : '—'}
                </td>
                <td className="px-3 py-2.5"><Badge val={r.statut} map={STATUT_OT} /></td>
                {isAllowed && <td className="px-2 py-2.5" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailOTId && (() => {
        const detailRow = rows.find(r => r.id === detailOTId)
        return detailRow ? (
          <OrganismeTiersDetail
            row={detailRow}
            onClose={() => setDetailOTId(null)}
            onUpdated={() => { reload(); setDetailOTId(null) }}
            isAllowed={isAllowed}
          />
        ) : null
      })()}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function AssistantSocial() {
  const { isFinancier, isMdp } = useAuth()
  const isAllowed = isFinancier || isMdp
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'echelonnements'
  const setTab = t => setSearchParams({ tab: t }, { replace: true })

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Assistant social</h1>
      <p className="text-sm text-gray-400 mb-5">
        Échelonnements de paiement et organismes tiers de prise en charge
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          ['echelonnements', 'Échelonnements'],
          ['organismes',     'Organismes tiers'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px border border-b-0 transition-colors
              ${tab === k
                ? 'bg-white border-gray-200 text-primary'
                : 'text-gray-500 border-transparent hover:text-primary'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'echelonnements' && <TabEchelonnements isAllowed={isAllowed} />}
      {tab === 'organismes'     && <TabOrganismesTiers isAllowed={isAllowed} />}
    </div>
  )
}
