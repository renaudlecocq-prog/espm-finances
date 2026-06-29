import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Phone, ExternalLink, Edit2, Check, X, Loader2, Voicemail } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : null
const fmtDateTime = ts => ts
  ? new Date(ts).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
  : ''
const fmtEur = n =>
  new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(n || 0) + ' €'

function isMajeur(dateNaissance) {
  if (!dateNaissance) return false
  const dob = new Date(dateNaissance)
  const now = new Date()
  const age = now.getFullYear() - dob.getFullYear() -
    (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
  return age >= 18
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Section({ icon, title, children, action }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <h3 className="font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wide">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="text-gray-400 dark:text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  )
}

const STATUT_ECH = {
  en_cours:     { label: 'En cours',     cls: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  attente:      { label: 'En attente',   cls: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
  non_respecte: { label: 'Non respecté', cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  termine:      { label: 'Terminé',      cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
}
const STATUT_OT = {
  en_cours: { label: 'En cours', cls: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  valide:   { label: 'Validé',   cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  refuse:   { label: 'Refusé',   cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  cloture:  { label: 'Clôturé',  cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
}

function StatusBadge({ val, map }) {
  const m = map[val] || { label: val, cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${m.cls}`}>
      {m.label}
    </span>
  )
}

const PAYE_PAR_LABELS = { responsable: 'Responsable', cpas: 'CPAS', ulb: 'ULB', spj: 'SPJ', autre: 'Autre' }

// ── Main component ─────────────────────────────────────────────────────────
export default function FicheEleve({ eleveId, onClose }) {
  const { user, profile, isAdmin, isFinancier } = useAuth()
  const navigate = useNavigate()
  const canSeeRestricted = isAdmin || isFinancier

  const [eleve, setEleve]   = useState(null)
  const [echs, setEchs]     = useState([])
  const [orgs, setOrgs]     = useState([])
  const [appels, setAppels] = useState([])
  const [photo, setPhoto]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [callingIdx, setCallingIdx] = useState(null)
  const [editNoteId, setEditNoteId] = useState(null)
  const [editNoteVal, setEditNoteVal] = useState('')
  const [finData, setFinData] = useState(null)  // { factures, paiements }

  const handlePDF = (factureId) => {
    const win = window.open('', '_blank')
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { win?.close(); return }
      if (win) win.location.href = `${window.location.origin}/.netlify/functions/facture-pdf?factureId=${factureId}&token=${session.access_token}`
    })
  }
  const [activeTab, setActiveTab] = useState('info')

  const load = useCallback(async () => {
    if (!eleveId) return
    setLoading(true)
    const queries = [
      supabase.from('eleves').select('*').eq('id', eleveId).single(),
      supabase.from('echelonnements')
        .select('id,montant,nombre_echeances,date_debut,mensualite,statut,remarque,eleve_id')
        .eq('eleve_id', eleveId),
      supabase.from('organismes_tiers')
        .select('id,organisme,statut,montant_accorde,notes,eleve_id')
        .eq('eleve_id', eleveId),
    ]
    if (canSeeRestricted) {
      queries.push(
        supabase.from('appels_responsables')
          .select('*')
          .eq('eleve_id', eleveId)
          .order('created_at', { ascending: false })
      )
    }
    // Financial data (admin/financier)
    let finPromise = Promise.resolve(null)
    if (canSeeRestricted) {
      finPromise = Promise.all([
        supabase.from('factures')
          .select('id, numero, montant, statut, date, batch:batch_id(numero, nom)')
          .eq('eleve_id', eleveId)
          .neq('statut', 'brouillon')
          .order('date', { ascending: false }),
        supabase.from('paiements')
          .select('id, date, montant, paye_par, notes')
          .eq('eleve_id', eleveId)
          .order('date', { ascending: false }),
      ])
    }

    const [eRes, ecRes, oRes, apRes] = await Promise.all(queries)
    setEleve(eRes.data)
    setEchs(ecRes.data || [])
    setOrgs(oRes.data || [])
    if (apRes) setAppels(apRes.data || [])

    if (canSeeRestricted) {
      const [facsRes, paiesRes] = await finPromise
      setFinData({
        factures: facsRes?.data || [],
        paiements: paiesRes?.data || [],
      })
    }
    setLoading(false)
  }, [eleveId, canSeeRestricted])

  useEffect(() => { load() }, [load])
  useEffect(() => { setActiveTab('info') }, [eleveId])

  const fetchPhoto = useCallback(async (username) => {
    if (!username) return
    try {
      const res = await fetch('/.netlify/functions/smartschool-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const { photo } = await res.json()
      if (photo) setPhoto(photo)
    } catch { /* pas de photo = pas bloquant */ }
  }, [])

  useEffect(() => {
    if (eleve?.smartschool_internal_number) fetchPhoto(eleve.smartschool_internal_number)
  }, [eleve, fetchPhoto])

  const logAppel = async (respIdx, respNom) => {
    setCallingIdx(respIdx)
    const auteurNom = profile
      ? `${profile.prenom || ''} ${profile.nom || ''}`.trim()
      : (user?.email || 'Inconnu')
    await supabase.from('appels_responsables').insert({
      eleve_id: eleveId,
      auteur_id: user?.id,
      auteur_nom: auteurNom,
      responsable_index: respIdx,
      responsable_nom: respNom,
    })
    setCallingIdx(null)
    if (canSeeRestricted) load()
  }

  const saveNote = async (id) => {
    await supabase.from('appels_responsables').update({ note: editNoteVal }).eq('id', id)
    setAppels(prev => prev.map(a => a.id === id ? { ...a, note: editNoteVal } : a))
    setEditNoteId(null)
  }

  if (!eleveId) return null

  // Build responsables list (only those with data)
  const responsables = eleve
    ? [1, 2, 3].map(n => ({
        idx: n,
        nom: `${eleve[`nom_responsable_${n}`] || ''} ${eleve[`prenom_responsable_${n}`] || ''}`.trim(),
        tel: eleve[`tel_responsable_${n}`] || '',
      })).filter(r => r.nom || r.tel)
    : []

  const hasAS = echs.length > 0 || orgs.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl h-[88vh] flex flex-col">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          {eleve ? (
            <div className="flex items-center gap-3">
              {photo ? (
                <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 border border-gray-100 dark:border-gray-700" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 text-lg font-bold">
                  {(eleve.prenom?.[0] || '') + (eleve.nom?.[0] || '')}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{eleve.prenom} {eleve.nom}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {eleve.classe && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{eleve.classe}</span>
                  )}
                  {isMajeur(eleve.date_naissance) && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                      Majeur·e
                    </span>
                  )}
                  {!eleve.actif && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      Inactif
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Fiche élève</h2>
          )}
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 ml-4">
            <X size={20} />
          </button>
        </div>

        {/* ── Tabs (si droits) ────────────────────────────────────────── */}
        {!loading && eleve && (
          <div className="px-5 pt-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 w-full">
              <button onClick={() => setActiveTab('info')}
                className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'info' ? 'bg-white dark:bg-gray-800 text-primary dark:text-accent shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                Infos
              </button>
              {canSeeRestricted && (
                <button onClick={() => setActiveTab('appels')}
                  className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'appels' ? 'bg-white dark:bg-gray-800 text-primary dark:text-accent shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  Appels {appels.length > 0 && <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{appels.length}</span>}
                </button>
              )}
              {canSeeRestricted && hasAS && (
                <button onClick={() => setActiveTab('social')}
                  className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'social' ? 'bg-white dark:bg-gray-800 text-primary dark:text-accent shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  Social
                </button>
              )}
              {canSeeRestricted && (
                <button onClick={() => setActiveTab('financier')}
                  className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'financier' ? 'bg-white dark:bg-gray-800 text-primary dark:text-accent shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  Financier
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto p-5 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <Loader2 size={20} className="animate-spin mr-2" /> Chargement…
            </div>
          ) : !eleve ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500">Élève introuvable</div>
          ) : (<>

            {/* ══ TAB 1 : Informations ══════════════════════════════════ */}
            {activeTab === 'info' && (<>
              <Section icon="👤" title="Identité">
                <Field label="Date de naissance" value={fmtDate(eleve.date_naissance)} />
                <Field label="Nationalité"       value={eleve.nationalite} />
                {(eleve.rue || eleve.commune) && (
                  <Field label="Adresse" value={[
                    eleve.rue,
                    [eleve.code_postal, eleve.commune].filter(Boolean).join(' '),
                    eleve.pays && eleve.pays !== 'Belgique' ? eleve.pays : null,
                  ].filter(Boolean).join(', ')} />
                )}
                <Field label="Email"     value={eleve.email} />
                <Field label="Téléphone" value={eleve.telephone} />
                <Field label="Mobile"    value={eleve.mobile} />
                <Field label="Matricule" value={eleve.matricule} />
                {eleve.remarque && (
                  <div className="mt-2.5 p-2.5 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-100">
                    <p className="text-xs text-amber-800 whitespace-pre-wrap">{eleve.remarque}</p>
                  </div>
                )}
              </Section>

              {[
                eleve.philosophie, eleve.groupe_choix_philo,
                eleve.obs_d2, eleve.ac_d2,
                eleve.math_d3, eleve.sciences_d3, eleve.bio_physique_d3,
                eleve.obs1_d3, eleve.obs2_d3, eleve.ac_d3,
              ].some(Boolean) && (
                <Section icon="📚" title="Groupes scolaires">
                  {eleve.philosophie && (
                    <Field label="RLMO" value={
                      eleve.groupe_choix_philo
                        ? `${eleve.philosophie} ${eleve.groupe_choix_philo}`
                        : eleve.philosophie
                    } />
                  )}
                  <Field label="OBS D2"          value={eleve.obs_d2} />
                  <Field label="AC D2"           value={eleve.ac_d2} />
                  <Field label="Math D3"         value={eleve.math_d3} />
                  <Field label="Sciences D3"     value={eleve.sciences_d3} />
                  <Field label="Bio/Physique D3" value={eleve.bio_physique_d3} />
                  <Field label="OBS 1 D3"        value={eleve.obs1_d3} />
                  <Field label="OBS 2 D3"        value={eleve.obs2_d3} />
                  <Field label="AC D3"           value={eleve.ac_d3} />
                </Section>
              )}

              {responsables.length > 0 && (
                <Section icon="👪" title="Responsables légaux">
                  {responsables.map((r, i) => (
                    <div key={r.idx}
                      className={`flex items-center gap-3 py-1.5 ${i > 0 ? 'border-t border-gray-50 dark:border-gray-800' : ''}`}>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">
                        {r.nom || `Responsable ${r.idx}`}
                      </span>
                      {r.tel && <span className="text-sm text-gray-500 dark:text-gray-400">{r.tel}</span>}
                    </div>
                  ))}
                </Section>
              )}
            </>)}

            {/* ══ TAB 2 : Appels ═══════════════════════════════════════ */}
            {activeTab === 'appels' && canSeeRestricted && (<>
              {responsables.length > 0 && (
                <Section icon="👪" title="Responsables légaux">
                  {responsables.map((r, i) => (
                    <div key={r.idx}
                      className={`flex items-center gap-3 py-1.5 ${i > 0 ? 'border-t border-gray-50 dark:border-gray-800' : ''}`}>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {r.nom || `Responsable ${r.idx}`}
                      </span>
                      {r.tel && (
                        <div className="flex items-center gap-2 ml-auto shrink-0">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{r.tel}</span>
                          <button
                            onClick={() => logAppel(r.idx, r.nom || `Responsable ${r.idx}`)}
                            disabled={callingIdx === r.idx}
                            title="Enregistrer un appel"
                            className="flex items-center gap-1 text-xs text-primary dark:text-accent border border-primary/30 dark:border-accent/30 hover:bg-primary/5 dark:hover:bg-accent/5 rounded-full px-2.5 py-0.5 transition-colors disabled:opacity-50"
                          >
                            {callingIdx === r.idx ? <Loader2 size={11} className="animate-spin" /> : <Phone size={11} />}
                            Appel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              <Section icon="📞" title="Historique des appels">
                {appels.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">Aucun appel enregistré.</p>
                ) : (
                  <div className="space-y-2">
                    {appels.map(a => (
                      <div key={a.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Phone size={12} className="text-primary dark:text-accent shrink-0" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                              {a.responsable_nom || `Responsable ${a.responsable_index}`}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{fmtDateTime(a.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-[18px]">Par {a.auteur_nom || '—'}</p>
                        {editNoteId === a.id ? (
                          <div className="flex items-center gap-1.5 mt-1.5 ml-[18px]">
                            <input autoFocus
                              className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-primary"
                              value={editNoteVal}
                              onChange={e => setEditNoteVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveNote(a.id)
                                if (e.key === 'Escape') setEditNoteId(null)
                              }}
                            />
                            <button onClick={() => saveNote(a.id)} className="text-green-600 dark:text-green-400 hover:text-green-700"><Check size={14} /></button>
                            <button onClick={() => setEditNoteId(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1.5 ml-[18px] group">
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic flex-1">
                              {a.note || <span className="text-gray-300 dark:text-gray-600">Aucune note</span>}
                            </span>
                            <button onClick={() => { setEditNoteId(a.id); setEditNoteVal(a.note || '') }}
                              className="text-gray-400 dark:text-gray-500 hover:text-primary transition-colors" title="Modifier la note">
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                await supabase.from('appels_responsables').update({ note: 'Message vocal' }).eq('id', a.id)
                                setAppels(prev => prev.map(x => x.id === a.id ? { ...x, note: 'Message vocal' } : x))
                              }}
                              className="text-gray-400 dark:text-gray-500 hover:text-orange-500 transition-colors" title="Message vocal">
                              <Voicemail size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>)}

            {/* ══ TAB 3 : Suivi social ══════════════════════════════════ */}
            {activeTab === 'social' && canSeeRestricted && (
              hasAS ? (
                <Section icon="🤝" title="Suivi social">
                  {echs.length > 0 && (
                    <div className={orgs.length > 0 ? 'mb-4' : ''}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Échelonnements</span>
                        <button onClick={() => { onClose(); navigate(`/suivi-social?tab=echelonnements&eleve=${eleveId}`) }}
                          className="flex items-center gap-1 text-xs text-primary dark:text-accent hover:underline">
                          <ExternalLink size={11} /> Gérer
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {echs.map(e => (
                          <div key={e.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5 text-sm gap-3">
                            <span className="text-gray-700 dark:text-gray-200 truncate">
                              {fmtEur(e.montant)}{e.nombre_echeances ? ` — ${e.nombre_echeances} éch.` : ''}{e.mensualite ? ` de ${fmtEur(e.mensualite)}` : ''}
                            </span>
                            <StatusBadge val={e.statut} map={STATUT_ECH} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {orgs.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Organismes tiers</span>
                        <button onClick={() => { onClose(); navigate(`/suivi-social?tab=organismes&eleve=${eleveId}`) }}
                          className="flex items-center gap-1 text-xs text-primary dark:text-accent hover:underline">
                          <ExternalLink size={11} /> Gérer
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {orgs.map(o => (
                          <div key={o.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5 text-sm gap-3">
                            <span className="text-gray-700 dark:text-gray-200 capitalize truncate">
                              {o.organisme}{o.montant_accorde ? ` — ${fmtEur(o.montant_accorde)}` : ''}
                            </span>
                            <StatusBadge val={o.statut} map={STATUT_OT} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              ) : (
                <div className="py-10 text-center text-gray-400 dark:text-gray-500">
                  <div className="text-3xl mb-2">🤝</div>
                  <p className="text-sm">Aucun suivi social pour cet élève.</p>
                </div>
              )
            )}

            {/* ══ TAB 4 : Financier ════════════════════════════════════ */}
            {activeTab === 'financier' && canSeeRestricted && finData && (() => {
              const totalFac = finData.factures
                .filter(f => f.statut === 'facture' || f.statut === 'rappel' || f.statut === 'mise_en_demeure')
                .reduce((s, f) => s + Number(f.montant || 0), 0)
              const totalPai = finData.paiements.reduce((s, p) => s + Number(p.montant || 0), 0)
              const solde = totalPai - totalFac
              const STATUT_FAC = {
                facture:         { label: 'Facturé',         cls: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
                ignore:          { label: 'Ignoré',          cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
                rappel:          { label: 'Rappel',          cls: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
                mise_en_demeure: { label: 'Mise en demeure', cls: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
              }
              return (<>
                <Section icon="💶" title="Financier">
                  <div className="flex items-center justify-between py-1 mb-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Solde</span>
                    <span className={`text-base font-bold ${solde < 0 ? 'text-red-600' : solde > 0 ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
                      {fmtEur(solde)}
                    </span>
                  </div>

                  {finData.factures.length > 0 && (
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Factures</span>
                      <div className="space-y-1.5 mt-2">
                        {finData.factures.map(f => {
                          const st = STATUT_FAC[f.statut] || { label: f.statut, cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' }
                          return (
                            <div key={f.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-700 dark:text-gray-200 truncate text-xs">{f.batch?.nom || f.batch?.numero || '—'}</p>
                                <p className="text-gray-400 dark:text-gray-500 text-[11px] truncate">{f.numero} · {fmtDate(f.date)}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums text-xs">{fmtEur(f.montant)}</span>
                                <button
                                  onClick={e => { e.stopPropagation(); handlePDF(f.id) }}
                                  title="Imprimer / PDF"
                                  className="text-gray-400 dark:text-gray-500 hover:text-primary transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-primary/10"
                                >🖨</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {finData.paiements.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Paiements</span>
                      <div className="space-y-1.5 mt-2">
                        {finData.paiements.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-700 dark:text-gray-200 text-xs">Payé par {PAYE_PAR_LABELS[p.paye_par] || p.paye_par || '—'}</p>
                              <p className="text-gray-400 dark:text-gray-500 text-[11px]">{fmtDate(p.date)}{p.notes ? ` · ${p.notes}` : ''}</p>
                            </div>
                            <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums shrink-0 text-xs">+{fmtEur(p.montant)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {finData.factures.length === 0 && finData.paiements.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">Aucun mouvement financier.</p>
                  )}
                </Section>
              </>)
            })()}

          </>)}
        </div>
      </div>
    </div>
  )
}
