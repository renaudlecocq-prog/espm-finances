// ConseilsDeGuidance.jsx — Encodage collaboratif des conseils de classe
// 3 onglets (P1/P2/P3) : même layout, données par période

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import {
  Users, ChevronRight, CheckCircle2, Clock, AlertCircle, Circle,
  Copy, Check, RefreshCw, Wifi, WifiOff, Info, ChevronDown,
  MessageSquare, BookOpen, User, Settings,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function degreeFromClasse(classe) {
  const y = parseInt((classe || '').charAt(0))
  if (y <= 2) return 'D1'
  if (y <= 4) return 'D2'
  return 'D3'
}

// Moteur de templates {{variable}} + {{#if variable}}...{{/if}}
function renderTemplate(body, vars) {
  if (!body) return ''
  let out = body

  // Blocs conditionnels {{#if key}}...{{/if}}
  out = out.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
    const val = vars[key]
    return (val && String(val).trim()) ? inner : ''
  })

  // Variables simples
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '')
  })

  // Nettoyer doubles espaces / espaces avant ponctuation
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\s+,/g, ',').trim()
  return out
}

function buildVars(encoding, subjects, competencies, eleve, resourcePersons = []) {
  const sexe = eleve?.sexe || 'X'
  const il_elle   = sexe === 'F' ? 'elle' : 'il'
  const Il_Elle   = sexe === 'F' ? 'Elle' : 'Il'
  const son_sa    = sexe === 'F' ? 'sa'   : 'son'
  const le_la     = sexe === 'F' ? 'la'   : 'le'

  const subjectStatus = encoding?.subject_status || {}
  const matiereEchec      = subjects.filter(s => subjectStatus[s.id] === 'echec').map(s => s.name)
  const matiereDifficulte = subjects.filter(s => subjectStatus[s.id] === 'difficulte').map(s => s.name)
  const matiereNE         = subjects.filter(s => subjectStatus[s.id] === 'NE').map(s => s.name)

  const compChecked = encoding?.competencies || {}
  const compsNom = competencies.filter(c => compChecked[c.id]).map(c => c.name)

  const listFr = (arr) => {
    if (!arr.length) return ''
    if (arr.length === 1) return arr[0]
    return arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1]
  }

  const p1 = resourcePersons.find(r => r.id === encoding?.resource_person_1_id)
  const p2 = resourcePersons.find(r => r.id === encoding?.resource_person_2_id)
  const persons = [p1?.name, p2?.name].filter(Boolean)

  const suiviMention = (() => {
    if (!encoding?.suivi_necessaire) return ''
    if (persons.length) return `Un suivi est prévu avec ${persons.join(' et ')}.`
    return 'Un suivi est prévu.'
  })()

  return {
    prenom: eleve?.prenom || '',
    il_elle, Il_Elle, son_sa, le_la,
    matiere_echec:      listFr(matiereEchec),
    matiere_difficulte: listFr(matiereDifficulte),
    matiere_ne:         listFr(matiereNE),
    competences:        listFr(compsNom),
    ta_forces:     encoding?.ta_force     ? 'Le travail autonome est un point fort.' : '',
    ta_faiblesses: encoding?.ta_faiblesse ? 'Le travail autonome est à améliorer.' : '',
    ta_note:       encoding?.ta_manual_text || '',
    freins:        encoding?.freins   || '',
    forces:        encoding?.forces   || '',
    conseils:      encoding?.conseils || '',
    suivi_necessaire: encoding?.suivi_necessaire ? 'true' : '',
    suivi_raisons:    encoding?.suivi_raisons || '',
    personne_ressource_1: p1?.name || '',
    personne_ressource_2: p2?.name || '',
    suivi_mention:    suiviMention,
  }
}

function generateComment(encoding, subjects, competencies, templates, eleve, resourcePersons = []) {
  if (!encoding || !eleve) return ''
  const degree = degreeFromClasse(eleve.classe)
  const period = encoding.period
  const cas    = encoding.cas || 1
  const tpl = templates.find(t => t.cas === cas && t.degree === degree && t.period === period)
  if (!tpl) return ''
  const vars = buildVars(encoding, subjects, competencies, eleve, resourcePersons)
  return renderTemplate(tpl.body, vars)
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return <span className="text-gray-300 text-xs">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: status.color + '20', color: status.color }}>
      {status.label}
    </span>
  )
}

// ── Élève dans la liste gauche ─────────────────────────────────────────────────
function EleveRow({ eleve, encoding, status, active, onClick }) {
  const hasData = encoding && (
    Object.keys(encoding.subject_status || {}).length > 0 ||
    Object.keys(encoding.competencies   || {}).length > 0 ||
    encoding.freins || encoding.forces || encoding.conseils
  )
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center gap-3 ${
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white border-gray-100 hover:border-primary/30 hover:shadow-sm'
      }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
      }`}>
        {eleve.prenom?.charAt(0)}{eleve.nom?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-gray-800'}`}>
          {eleve.nom} {eleve.prenom}
        </div>
        <div className={`text-xs truncate ${active ? 'text-white/70' : 'text-gray-400'}`}>
          {eleve.classe}
        </div>
      </div>
      {hasData && !active && (
        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
      )}
      {status && !active && <StatusBadge status={status} />}
    </button>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ConseilsDeGuidance() {
  const { profile } = useAuth()

  // ── Config ──────────────────────────────────────────────────────────────────
  const [subjects,        setSubjects]       = useState([])
  const [competencies,    setCompetencies]   = useState([])
  const [resourcePersons, setResourcePersons] = useState([])
  const [taskStatuses,    setTaskStatuses]   = useState([])
  const [templates,       setTemplates]      = useState([])

  // ── Données élèves ──────────────────────────────────────────────────────────
  const [eleves,   setEleves]   = useState([])
  const [encodings, setEncodings] = useState({}) // { eleveId_period: encoding }

  // ── Sélection ───────────────────────────────────────────────────────────────
  const [period,       setPeriod]       = useState('P1')
  const [classeFilter, setClasseFilter] = useState('')
  const [selectedId,   setSelectedId]   = useState(null)
  const [search,       setSearch]       = useState('')

  // ── UI ──────────────────────────────────────────────────────────────────────
  const [saving,     setSaving]     = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [online,     setOnline]     = useState(true)
  const [lastUpdBy,  setLastUpdBy]  = useState(null)

  const realtimeRef    = useRef(null)
  const saveTimer      = useRef(null)
  const pendingSaveRef = useRef(null) // { enc } — pour flush avant changement de période

  // ── Chargement config ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from('guidance_subjects').select('*').order('degree').order('position'),
      supabase.from('guidance_competencies').select('*').order('degree').order('position'),
      supabase.from('guidance_resource_persons').select('*').order('position'),
      supabase.from('guidance_task_statuses').select('*').order('position'),
      supabase.from('guidance_templates').select('*'),
    ]).then(([s, c, r, ts, tp]) => {
      setSubjects(s.data || [])
      setCompetencies(c.data || [])
      setResourcePersons(r.data || [])
      setTaskStatuses(ts.data || [])
      setTemplates(tp.data || [])
    })
  }, [])

  // ── Chargement élèves ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('eleves')
      .select('id, nom, prenom, classe, sexe, photo_url, smartschool_username, smartschool_internal_number')
      .order('classe').order('nom')
      .then(({ data }) => { setEleves(data || []) })
  }, [])

  // ── Chargement encodings pour la période ───────────────────────────────────
  const loadEncodings = useCallback(async (p) => {
    const eleveIds = eleves.map(e => e.id)
    if (!eleveIds.length) return
    const { data } = await supabase.from('guidance_encodings')
      .select('*').eq('period', p).in('eleve_id', eleveIds)
    const map = {}
    ;(data || []).forEach(enc => { map[enc.eleve_id + '_' + p] = enc })
    setEncodings(prev => ({ ...prev, ...map }))
  }, [eleves])

  useEffect(() => {
    if (eleves.length) loadEncodings(period)
  }, [eleves, period, loadEncodings])

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
    const ch = supabase.channel(`guidance_${period}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guidance_encodings', filter: `period=eq.${period}` },
        (payload) => {
          const enc = payload.new || payload.old
          if (!enc) return
          setEncodings(prev => {
            const key = enc.eleve_id + '_' + period
            if (payload.eventType === 'DELETE') {
              const n = { ...prev }; delete n[key]; return n
            }
            // Si c'est notre propre update, ignorer (on gère l'état local)
            if (enc.updated_by_name && profile && enc.updated_by_name !== (profile.prenom + ' ' + profile.nom)) {
              setLastUpdBy(enc.updated_by_name)
              setTimeout(() => setLastUpdBy(null), 4000)
            }
            return { ...prev, [key]: enc }
          })
          setOnline(true)
        }
      )
      .subscribe((status) => {
        setOnline(status === 'SUBSCRIBED')
      })
    realtimeRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [period, profile])

  // ── Encoding courant ─────────────────────────────────────────────────────────
  const currentKey = selectedId ? selectedId + '_' + period : null
  const currentEnc = currentKey ? encodings[currentKey] : null
  const currentEleve = eleves.find(e => e.id === selectedId)
  const currentDegree = currentEleve ? degreeFromClasse(currentEleve.classe) : 'D1'
  const currentSubjects = subjects.filter(s => s.degree === currentDegree)
  const currentComps    = competencies.filter(c => c.degree === currentDegree)

  // ── Sauvegarde auto (debounce 1.5s) ─────────────────────────────────────────
  const saveEncoding = useCallback(async (enc) => {
    if (!selectedId) return
    setSaving(true)
    const displayName = profile ? `${profile.prenom} ${profile.nom}` : 'Inconnu'
    const payload = {
      ...enc,
      eleve_id: selectedId,
      period,
      updated_by_name: displayName,
      updated_at: new Date().toISOString(),
    }
    const key = selectedId + '_' + period
    if (encodings[key]?.id) {
      await supabase.from('guidance_encodings').update(payload).eq('id', encodings[key].id)
    } else {
      await supabase.from('guidance_encodings').insert(payload)
    }
    setSaving(false)
  }, [selectedId, period, encodings, profile])

  const scheduleAutoSave = useCallback((enc) => {
    setEncodings(prev => ({ ...prev, [selectedId + '_' + period]: enc }))
    clearTimeout(saveTimer.current)
    pendingSaveRef.current = enc
    saveTimer.current = setTimeout(() => {
      pendingSaveRef.current = null
      saveEncoding(enc)
    }, 1500)
  }, [saveEncoding, selectedId, period])

  // ── Changement de période : flush le save en attente avant de switcher ────────
  const handlePeriodChange = useCallback(async (newPeriod) => {
    if (pendingSaveRef.current) {
      clearTimeout(saveTimer.current)
      const enc = pendingSaveRef.current
      pendingSaveRef.current = null
      await saveEncoding(enc)
    }
    setPeriod(newPeriod)
  }, [saveEncoding])

  // ── Helpers de modification ──────────────────────────────────────────────────
  const enc = currentEnc || { cas: 1, subject_status: {}, competencies: {}, ta_force: false, ta_faiblesse: false, freins: '', forces: '', conseils: '', suivi_necessaire: false, suivi_raisons: '', resource_person_1_id: null, resource_person_2_id: null, status_id: null, generated_comment: '', period }

  const update = (patch) => {
    const next = { ...enc, ...patch }
    // Regénérer le commentaire
    next.generated_comment = generateComment(next, currentSubjects, currentComps, templates, currentEleve, resourcePersons)
    scheduleAutoSave(next)
  }

  const toggleSubject = (subjectId, status) => {
    const current = enc.subject_status || {}
    const next = { ...current }
    if (next[subjectId] === status) delete next[subjectId]
    else next[subjectId] = status
    update({ subject_status: next })
  }

  const toggleComp = (compId) => {
    const current = enc.competencies || {}
    const next = { ...current, [compId]: !current[compId] }
    if (!next[compId]) delete next[compId]
    update({ competencies: next })
  }

  // ── Commentaire généré ───────────────────────────────────────────────────────
  const comment = generateComment(enc, currentSubjects, currentComps, templates, currentEleve, resourcePersons)


  const copyComment = () => {
    if (!comment) return
    navigator.clipboard.writeText(comment)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Filtrage liste élèves ────────────────────────────────────────────────────
  const classes = [...new Set(eleves.map(e => e.classe))].sort()
  const filteredEleves = eleves.filter(e => {
    if (classeFilter && e.classe !== classeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${e.nom} ${e.prenom}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const getStatus = (eleveId) => {
    const enc = encodings[eleveId + '_' + period]
    if (!enc?.status_id) return null
    return taskStatuses.find(s => s.id === enc.status_id) || null
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Conseils de guidance"
        tabs={[
          { key: 'P1', label: 'Période 1' },
          { key: 'P2', label: 'Période 2' },
          { key: 'P3', label: 'Période 3' },
        ]}
        activeTab={period}
        onTabChange={handlePeriodChange}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Rechercher un élève…"
        filters={
          <select value={classeFilter} onChange={e => setClasseFilter(e.target.value)}
            style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', fontSize: '12px', padding: '5px 8px', borderRadius: '8px', outline: 'none' }}>
            <option value="" style={{ color: '#1f2937', backgroundColor: 'white' }}>Toutes les classes</option>
            {classes.map(c => <option key={c} value={c} style={{ color: '#1f2937', backgroundColor: 'white' }}>{c}</option>)}
          </select>
        }
        actions={
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${
            online ? 'bg-green-600/20 text-green-300' : 'bg-white/10 text-white/40'
          }`}>
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? 'En direct' : 'Hors ligne'}
          </div>
        }
      />

      {/* Notification realtime distant */}
      {lastUpdBy && (
        <div className="mx-4 mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
          <RefreshCw size={14} />
          Mis à jour par <strong>{lastUpdBy}</strong>
        </div>
      )}

      {/* Corps */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ── Colonne gauche : liste élèves ─────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium flex justify-between">
            <span>{filteredEleves.length} élève{filteredEleves.length > 1 ? 's' : ''}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredEleves.map(e => (
              <EleveRow key={e.id} eleve={e}
                encoding={encodings[e.id + '_' + period]}
                status={getStatus(e.id)}
                active={selectedId === e.id}
                onClick={() => setSelectedId(e.id)} />
            ))}
          </div>
        </div>

        {/* ── Colonne droite : formulaire d'encodage ───────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <Users size={48} className="text-gray-200" />
              <p className="text-sm">Sélectionne un élève pour commencer l'encodage</p>
            </div>
          ) : (
            <div className="p-6 max-w-3xl space-y-6">

              {/* Header élève */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {currentEleve?.nom} {currentEleve?.prenom}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {currentEleve?.classe} · Degré {currentDegree} · {period}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/>Enreg…</span>}
                  <select value={enc.status_id || ''}
                    onChange={e => update({ status_id: e.target.value || null })}
                    className="input text-sm py-1.5 w-36">
                    <option value="">Statut…</option>
                    {taskStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Cas ──────────────────────────────────────────────────────── */}
              <section className="card p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Situation de l'élève</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { cas: 1, label: 'Bonne situation',   color: 'green',  desc: 'Résultats satisfaisants' },
                    { cas: 2, label: 'Difficultés',       color: 'yellow', desc: 'Quelques points d\'attention' },
                    { cas: 3, label: 'Préoccupant',       color: 'red',    desc: 'Difficultés importantes' },
                  ].map(({ cas, label, color, desc }) => (
                    <button key={cas} onClick={() => update({ cas })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        enc.cas === cas
                          ? color === 'green'  ? 'border-green-500  bg-green-50  text-green-700'
                          : color === 'yellow' ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          :                      'border-red-500    bg-red-50    text-red-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}>
                      <div className="font-medium text-sm">{cas}. {label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Matières ─────────────────────────────────────────────────── */}
              <section className="card p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Matières</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {currentSubjects.map(s => {
                    const st = enc.subject_status?.[s.id]
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 w-40 flex-shrink-0">{s.name}</span>
                        <div className="flex gap-1">
                          {[
                            { key: 'echec',      label: 'Échec',      bg: 'bg-red-100 text-red-700 border-red-300'       },
                            { key: 'difficulte', label: 'Difficulté', bg: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                            { key: 'NE',         label: 'NE',         bg: 'bg-gray-100 text-gray-600 border-gray-300'    },
                          ].map(({ key, label, bg }) => (
                            <button key={key} onClick={() => toggleSubject(s.id, key)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                                st === key ? bg : 'border-gray-200 text-gray-400 hover:border-gray-300'
                              }`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* ── Compétences transversales ─────────────────────────────────── */}
              <section className="card p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Compétences transversales</h3>
                <div className="flex flex-wrap gap-2">
                  {currentComps.map(c => {
                    const checked = enc.competencies?.[c.id]
                    return (
                      <button key={c.id} onClick={() => toggleComp(c.id)}
                        className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                          checked
                            ? 'bg-primary text-white border-primary'
                            : 'border-gray-200 text-gray-600 hover:border-primary/40'
                        }`}>
                        {checked && <Check size={12} className="inline mr-1" />}{c.name}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ── Travail autonome ─────────────────────────────────────────── */}
              <section className="card p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Travail autonome (TA)</h3>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enc.ta_force} onChange={e => update({ ta_force: e.target.checked })}
                      className="w-4 h-4 rounded accent-green-500" />
                    <span className="text-sm text-green-700 font-medium">Force</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enc.ta_faiblesse} onChange={e => update({ ta_faiblesse: e.target.checked })}
                      className="w-4 h-4 rounded accent-orange-500" />
                    <span className="text-sm text-orange-700 font-medium">Faiblesse</span>
                  </label>
                </div>
                <textarea value={enc.ta_manual_text || ''} onChange={e => update({ ta_manual_text: e.target.value })}
                  placeholder="Précision libre sur le TA…" rows={2}
                  className="input mt-2 resize-none text-sm" />
              </section>

              {/* ── Champs libres ─────────────────────────────────────────────── */}
              <section className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-600">Notes libres</h3>
                <div>
                  <label className="label">Freins</label>
                  <textarea value={enc.freins || ''} onChange={e => update({ freins: e.target.value })}
                    rows={2} className="input resize-none text-sm" placeholder="Obstacles observés…" />
                </div>
                <div>
                  <label className="label">Forces</label>
                  <textarea value={enc.forces || ''} onChange={e => update({ forces: e.target.value })}
                    rows={2} className="input resize-none text-sm" placeholder="Points positifs…" />
                </div>
                <div>
                  <label className="label">Conseils</label>
                  <textarea value={enc.conseils || ''} onChange={e => update({ conseils: e.target.value })}
                    rows={2} className="input resize-none text-sm" placeholder="Recommandations du conseil…" />
                </div>
              </section>

              {/* ── Suivi ─────────────────────────────────────────────────────── */}
              <section className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-600">Suivi</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enc.suivi_necessaire}
                    onChange={e => update({ suivi_necessaire: e.target.checked })}
                    className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-gray-700">Suivi nécessaire</span>
                </label>
                {enc.suivi_necessaire && (
                  <textarea value={enc.suivi_raisons || ''} onChange={e => update({ suivi_raisons: e.target.value })}
                    rows={2} className="input resize-none text-sm" placeholder="Raisons du suivi…" />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Personne ressource 1</label>
                    <select value={enc.resource_person_1_id || ''}
                      onChange={e => update({ resource_person_1_id: e.target.value || null })}
                      className="input text-sm">
                      <option value="">—</option>
                      {resourcePersons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Personne ressource 2</label>
                    <select value={enc.resource_person_2_id || ''}
                      onChange={e => update({ resource_person_2_id: e.target.value || null })}
                      className="input text-sm">
                      <option value="">—</option>
                      {resourcePersons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* ── Commentaire généré ──────────────────────────────────────── */}
              <section className="card p-4 space-y-3 border-l-4 border-accent">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MessageSquare size={16} className="text-accent" />
                    Commentaire de bulletin généré
                  </h3>
                </div>
                {comment ? (
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">
                    {comment}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Remplis les champs ci-dessus pour générer le commentaire automatiquement.
                  </p>
                )}

                {comment && (
                  <div className="border-t border-gray-100 pt-3 flex justify-end">
                    <button onClick={copyComment}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all ${
                        copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}>
                      {copied ? <><Check size={12}/>Copié !</> : <><Copy size={12}/>Copier le commentaire</>}
                    </button>
                  </div>
                )}
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
