import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUTS = {
  nouveau:    { label: 'Nouveau',     color: '#2563EB', bg: '#DBEAFE' },
  en_cours:   { label: 'En cours',    color: '#D97706', bg: '#FEF3C7' },
  en_attente: { label: 'En attente',  color: '#7C3AED', bg: '#EDE9FE' },
  resolu:     { label: 'Résolu',      color: '#059669', bg: '#D1FAE5' },
  ferme:      { label: 'Fermé',       color: '#6B7280', bg: '#F3F4F6' },
}
const PRIORITES = {
  faible:   { label: 'Faible',   color: '#6B7280', icon: '↓' },
  normale:  { label: 'Normale',  color: '#2563EB', icon: '→' },
  haute:    { label: 'Haute',    color: '#D97706', icon: '↑' },
  urgente:  { label: 'Urgente',  color: '#DC2626', icon: '⚡' },
}

// ── Badge Statut ──────────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const s = STATUTS[statut] || STATUTS.nouveau
  return (
    <span style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
      padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── Icône priorité inline ─────────────────────────────────────────────────────
function PrioriteChip({ priorite }) {
  const p = PRIORITES[priorite] || PRIORITES.normale
  return (
    <span style={{ color: p.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {p.icon} {p.label}
    </span>
  )
}

// ── Champ dynamique (formulaire catégorie) ────────────────────────────────────
function DynamicField({ field, value, onChange }) {
  const base = {
    width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
    border: '1.5px solid #e5e7eb', outline: 'none', boxSizing: 'border-box',
    backgroundColor: '#fff',
  }
  if (field.type === 'text_short') return (
    <input type="text" value={value || ''} placeholder={field.placeholder || ''}
      onChange={e => onChange(e.target.value)} style={base} required={field.required} />
  )
  if (field.type === 'text_long') return (
    <textarea value={value || ''} placeholder={field.placeholder || ''}
      onChange={e => onChange(e.target.value)} rows={3}
      style={{ ...base, resize: 'vertical' }} required={field.required} />
  )
  if (field.type === 'number') return (
    <input type="number" value={value || ''} placeholder={field.placeholder || ''}
      onChange={e => onChange(e.target.value)} style={base} required={field.required} />
  )
  if (field.type === 'date') return (
    <input type="date" value={value || ''}
      onChange={e => onChange(e.target.value)} style={base} required={field.required} />
  )
  if (field.type === 'select_single') return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={base} required={field.required}>
      <option value="">— Sélectionner —</option>
      {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (field.type === 'select_multiple') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(field.options || []).map(o => (
        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={(value || []).includes(o)}
            onChange={e => {
              const cur = value || []
              onChange(e.target.checked ? [...cur, o] : cur.filter(x => x !== o))
            }} />
          {o}
        </label>
      ))}
    </div>
  )
  return null
}

// ── Icône catégorie ───────────────────────────────────────────────────────────
function CatIcon({ name, color, size = 20 }) {
  const paths = {
    package:  <><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    building: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    monitor:  <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    ticket:   <><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></>,
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.ticket}
    </svg>
  )
}

// ── Modal Nouveau Ticket ──────────────────────────────────────────────────────
function NouveauTicketModal({ categories, openTickets, onClose, onCreated }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedCat, setSelectedCat] = useState(null)
  const [titre, setTitre] = useState('')
  const [priorite, setPriorite] = useState('normale')
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showRelated, setShowRelated] = useState(true)

  // Tickets ouverts dans la catégorie sélectionnée (depuis la liste déjà chargée)
  const relatedTickets = useMemo(() => {
    if (!selectedCat) return []
    return openTickets.filter(t => t.category_id === selectedCat.id && t.statut !== 'ferme')
  }, [selectedCat, openTickets])

  // Comptage open tickets par catégorie
  const openCountByCategory = useMemo(() => {
    const counts = {}
    openTickets.forEach(t => {
      if (t.statut !== 'ferme') counts[t.category_id] = (counts[t.category_id] || 0) + 1
    })
    return counts
  }, [openTickets])

  const handleSelectCat = (cat) => {
    setSelectedCat(cat)
    setShowRelated(true)
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { data, error: err } = await supabase.from('helpdesk_tickets').insert({
        titre,
        category_id: selectedCat.id,
        priorite,
        form_data: formData,
        created_by: user.id,
        assigned_to: null,
      }).select().single()
      if (err) throw err
      onCreated(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 560,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>
              {step === 1 ? 'Nouveau ticket' : selectedCat?.nom}
            </div>
            {step === 2 && selectedCat && (
              <button onClick={() => { setStep(1); setSelectedCat(null) }}
                style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, marginTop: 2 }}>
                ← Changer de catégorie
              </button>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7280', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Étape 1 : choix catégorie */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 8px' }}>
                Quelle est la nature de votre demande ?
              </p>
              {categories.map(cat => {
                const openCount = openCountByCategory[cat.id] || 0
                return (
                  <button key={cat.id} onClick={() => handleSelectCat(cat)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      border: '1.5px solid #e5e7eb', borderRadius: 10, cursor: 'pointer',
                      backgroundColor: '#fff', textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = cat.couleur; e.currentTarget.style.backgroundColor = '#f9fafb' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fff' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      backgroundColor: cat.couleur + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CatIcon name={cat.icone} color={cat.couleur} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cat.nom}
                        {openCount > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#FEF3C7',
                            color: '#92400E', padding: '1px 7px', borderRadius: 999 }}>
                            {openCount} ouvert{openCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{cat.description}</div>
                      )}
                    </div>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#D1D5DB" strokeWidth={2}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )
              })}
            </div>
          )}

          {/* Étape 2 : formulaire */}
          {step === 2 && (
            <form id="new-ticket-form" onSubmit={handleSubmit}>

              {/* ── Tickets existants ── */}
              {relatedTickets.length > 0 && showRelated && (
                <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FCD34D',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                      ⚠️ {relatedTickets.length} ticket{relatedTickets.length > 1 ? 's' : ''} ouvert{relatedTickets.length > 1 ? 's' : ''} dans cette catégorie
                    </div>
                    <button type="button" onClick={() => setShowRelated(false)}
                      style={{ fontSize: 11, color: '#92400E', background: 'none', border: 'none',
                        cursor: 'pointer', opacity: 0.7 }}>
                      Masquer
                    </button>
                  </div>
                  {relatedTickets.map((rt, i) => (
                    <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                      paddingTop: i > 0 ? 6 : 0, marginTop: i > 0 ? 6 : 0,
                      borderTop: i > 0 ? '1px solid #FDE68A' : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', flexShrink: 0 }}>
                        #{String(rt.numero).padStart(4, '0')}
                      </span>
                      <span style={{ fontSize: 12, color: '#78350F', flex: 1,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rt.titre}
                      </span>
                      <StatutBadge statut={rt.statut} />
                      <button type="button"
                        onClick={() => { onClose(); navigate(`/helpdesk/${rt.id}`) }}
                        style={{ fontSize: 11, color: '#D97706', fontWeight: 700,
                          background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Voir →
                      </button>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#92400E', marginTop: 8, marginBottom: 0 }}>
                    Vérifiez qu'il ne s'agit pas du même problème avant de créer un nouveau ticket.
                  </p>
                </div>
              )}

              {error && (
                <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
                  borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
              )}

              {/* Titre */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Titre <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input type="text" value={titre} required
                  onChange={e => setTitre(e.target.value)}
                  placeholder="Résumez votre demande en une phrase..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
                    border: '1.5px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Priorité */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Priorité
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(PRIORITES).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setPriorite(k)}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        border: priorite === k ? `2px solid ${v.color}` : '2px solid #e5e7eb',
                        backgroundColor: priorite === k ? v.color + '15' : '#fff',
                        color: priorite === k ? v.color : '#6B7280', transition: 'all 0.1s' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Champs dynamiques */}
              {(selectedCat?.form_fields || []).map(field => (
                <div key={field.id} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    {field.label} {field.required && <span style={{ color: '#DC2626' }}>*</span>}
                  </label>
                  <DynamicField field={field} value={formData[field.id]}
                    onChange={v => setFormData(prev => ({ ...prev, [field.id]: v }))} />
                </div>
              ))}
            </form>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} disabled={saving}
              style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Annuler
            </button>
            <button type="submit" form="new-ticket-form" disabled={saving}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
                backgroundColor: '#2D1B2E', color: '#fff', cursor: saving ? 'wait' : 'pointer',
                fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Envoi…' : 'Créer le ticket'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Carte ticket ──────────────────────────────────────────────────────────────
function TicketCard({ ticket: t, isUnread, onClick }) {
  const cat = t.helpdesk_categories
  const catColor = cat?.couleur || '#E5E7EB'
  const creator = t.created_by_profile
    ? `${t.created_by_profile.prenom} ${t.created_by_profile.nom}`
    : null
  const dateStr = new Date(t.updated_at).toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' })

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#fff',
        borderRadius: 10,
        borderLeft: `4px solid ${catColor}`,
        padding: '14px 18px',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Ligne 1 — titre + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{t.titre}</span>

        {/* Badge non-lu */}
        {isUnread && (
          <span style={{
            backgroundColor: '#EF4444', color: '#fff', borderRadius: 999,
            minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            letterSpacing: '-0.5px',
          }} title="Messages non lus">
            ●
          </span>
        )}

        <StatutBadge statut={t.statut} />
      </div>

      {/* Ligne 2 — méta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px',
        fontSize: 12, color: '#6B7280', alignItems: 'center' }}>

        {/* Catégorie */}
        {cat && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CatIcon name={cat.icone} color={catColor} size={12} />
            <span style={{ color: catColor, fontWeight: 700 }}>{cat.nom}</span>
          </span>
        )}

        {/* Priorité */}
        <PrioriteChip priorite={t.priorite} />

        {/* Créateur */}
        {creator && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="#9CA3AF" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {creator}
          </span>
        )}

        {/* Numéro */}
        <span style={{ color: '#9CA3AF', fontWeight: 600 }}>
          #{String(t.numero).padStart(4, '0')}
        </span>

        {/* Date */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="#9CA3AF" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {dateStr}
        </span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Helpdesk() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [categories,    setCategories]    = useState([])
  const [tickets,       setTickets]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [filterStatut,  setFilterStatut]  = useState('actifs')
  const [filterCatId,   setFilterCatId]   = useState(null)
  const [search,        setSearch]        = useState('')

  // Tracking messages non-lus (localStorage)
  const [lastSeen, setLastSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hd_lastSeen') || '{}') }
    catch { return {} }
  })

  const isUnread = (t) => {
    if (t.statut === 'ferme') return false
    const seen = lastSeen[t.id]
    if (!seen) return false // jamais ouvert = pas encore de messages attendus
    return t.updated_at > seen
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: tix }] = await Promise.all([
      supabase.from('helpdesk_categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('helpdesk_tickets').select(`
        id, numero, titre, statut, priorite, created_at, updated_at, category_id,
        helpdesk_categories(nom, icone, couleur),
        created_by_profile:profiles!helpdesk_tickets_created_by_fkey(prenom, nom),
        assigned_to_profile:profiles!helpdesk_tickets_assigned_to_fkey(prenom, nom)
      `).order('updated_at', { ascending: false }),
    ])
    setCategories(cats || [])
    setTickets(tix || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Sync lastSeen depuis localStorage (cas rafraîchissement entre onglets)
  useEffect(() => {
    const sync = () => {
      try { setLastSeen(JSON.parse(localStorage.getItem('hd_lastSeen') || '{}')) }
      catch {}
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const actifs = tickets.filter(t => t.statut !== 'ferme')
  const fermes = tickets.filter(t => t.statut === 'ferme')

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (filterStatut === 'actifs' && t.statut === 'ferme') return false
      if (filterStatut === 'ferme'  && t.statut !== 'ferme') return false
      if (filterCatId && t.category_id !== filterCatId) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.titre.toLowerCase().includes(q) &&
            !t.helpdesk_categories?.nom?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tickets, filterStatut, filterCatId, search])

  const tabs = [
    { key: 'actifs', label: 'Actifs', count: actifs.length },
    { key: 'ferme',  label: 'Fermés', count: fermes.length },
    { key: 'tous',   label: 'Tous' },
  ]

  // Filtres catégorie (dans le header)
  const catFilters = categories.length > 0 ? (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {categories.map(cat => {
        const active = filterCatId === cat.id
        return (
          <button key={cat.id}
            onClick={() => setFilterCatId(active ? null : cat.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.12s',
              border: active ? 'none' : '1px solid rgba(255,255,255,0.15)',
              backgroundColor: active ? cat.couleur : 'rgba(255,255,255,0.08)',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
            }}>
            <CatIcon name={cat.icone} color={active ? '#fff' : 'rgba(255,255,255,0.55)'} size={11} />
            {cat.nom}
          </button>
        )
      })}
    </div>
  ) : null

  const unreadCount = tickets.filter(t => isUnread(t)).length

  return (
    <>
      <PageHeader
        title="Helpdesk"
        subtitle={`${actifs.length} ticket${actifs.length !== 1 ? 's' : ''} actif${actifs.length !== 1 ? 's' : ''}${unreadCount > 0 ? ` · ${unreadCount} non lu${unreadCount > 1 ? 's' : ''}` : ''}`}
        tabs={tabs}
        activeTab={filterStatut}
        onTabChange={setFilterStatut}
        filters={catFilters}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher un ticket..."
        actions={
          <button onClick={() => setShowModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none',
              backgroundColor: '#fff', color: '#2D1B2E', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            + Nouveau ticket
          </button>
        }
      />

      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>
            {search || filterCatId
              ? 'Aucun ticket ne correspond aux filtres.'
              : 'Aucun ticket pour l\'instant.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 900 }}>
            {filtered.map(t => (
              <TicketCard
                key={t.id}
                ticket={t}
                isUnread={isUnread(t)}
                onClick={() => navigate(`/helpdesk/${t.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NouveauTicketModal
          categories={categories}
          openTickets={tickets}
          onClose={() => setShowModal(false)}
          onCreated={(ticket) => { setShowModal(false); navigate(`/helpdesk/${ticket.id}`) }}
        />
      )}
    </>
  )
}
