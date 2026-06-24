import { useState, useEffect, useCallback } from 'react'
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
  faible:   { label: 'Faible',   color: '#6B7280' },
  normale:  { label: 'Normale',  color: '#2563EB' },
  haute:    { label: 'Haute',    color: '#D97706' },
  urgente:  { label: 'Urgente',  color: '#DC2626' },
}

// ── Badge Statut ──────────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const s = STATUTS[statut] || STATUTS.nouveau
  return (
    <span style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── Badge Priorité ────────────────────────────────────────────────────────────
function PrioriteBadge({ priorite }) {
  const p = PRIORITES[priorite] || PRIORITES.normale
  return (
    <span style={{ color: p.color, fontSize: 11, fontWeight: 700 }}>
      ▲ {p.label}
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

// ── Modal Nouveau Ticket ──────────────────────────────────────────────────────
function NouveauTicketModal({ categories, onClose, onCreated }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1) // 1 = choix catégorie, 2 = formulaire
  const [selectedCat, setSelectedCat] = useState(null)
  const [titre, setTitre] = useState('')
  const [priorite, setPriorite] = useState('normale')
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSelectCat = (cat) => { setSelectedCat(cat); setStep(2) }

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
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{ fontSize: 12, color: '#6B7280',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
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
              {categories.map(cat => (
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
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{cat.nom}</div>
                    {cat.description && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{cat.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Étape 2 : formulaire */}
          {step === 2 && (
            <form id="new-ticket-form" onSubmit={handleSubmit}>
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

// ── Composant principal ───────────────────────────────────────────────────────
export default function Helpdesk() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [categories, setCategories]   = useState([])
  const [tickets, setTickets]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [filterStatut, setFilterStatut] = useState('actifs') // actifs | ferme | tous
  const [search, setSearch]           = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: tix }] = await Promise.all([
      supabase.from('helpdesk_categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('helpdesk_tickets').select(`
        id, numero, titre, statut, priorite, created_at, updated_at,
        category_id,
        helpdesk_categories(nom, icone, couleur),
        created_by_profile:profiles!helpdesk_tickets_created_by_fkey(prenom, nom),
        assigned_to_profile:profiles!helpdesk_tickets_assigned_to_fkey(prenom, nom)
      `).order('created_at', { ascending: false }),
    ])
    setCategories(cats || [])
    setTickets(tix || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = tickets.filter(t => {
    if (filterStatut === 'actifs' && t.statut === 'ferme') return false
    if (filterStatut === 'ferme'  && t.statut !== 'ferme') return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.titre.toLowerCase().includes(q) &&
          !t.helpdesk_categories?.nom?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const tabs = [
    { key: 'actifs', label: `Actifs (${tickets.filter(t => t.statut !== 'ferme').length})` },
    { key: 'ferme',  label: `Fermés (${tickets.filter(t => t.statut === 'ferme').length})` },
    { key: 'tous',   label: 'Tous' },
  ]

  return (
    <>
      <PageHeader
        title="Helpdesk"
        subtitle={`${tickets.filter(t => t.statut !== 'ferme').length} ticket${tickets.filter(t => t.statut !== 'ferme').length !== 1 ? 's' : ''} actif${tickets.filter(t => t.statut !== 'ferme').length !== 1 ? 's' : ''}`}
        tabs={tabs}
        activeTab={filterStatut}
        onTabChange={setFilterStatut}
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

      <div style={{ padding: '24px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>
            {search ? 'Aucun ticket ne correspond à la recherche.' : 'Aucun ticket pour l\'instant.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* En-tête table */}
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 180px 120px 110px 140px',
              padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>#</span><span>Titre</span><span>Catégorie</span>
              <span>Priorité</span><span>Statut</span><span>Date</span>
            </div>

            {filtered.map(t => (
              <div key={t.id} onClick={() => navigate(`/helpdesk/${t.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '70px 1fr 180px 120px 110px 140px',
                  padding: '14px 16px', backgroundColor: '#fff', cursor: 'pointer',
                  borderTop: '1px solid #f3f4f6', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF' }}>
                  #{String(t.numero).padStart(4, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.titre}
                  </div>
                  {t.created_by_profile && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {t.created_by_profile.prenom} {t.created_by_profile.nom}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.helpdesk_categories && (
                    <CatIcon name={t.helpdesk_categories.icone} color={t.helpdesk_categories.couleur} size={14} />
                  )}
                  <span style={{ fontSize: 12, color: '#374151',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.helpdesk_categories?.nom || '—'}
                  </span>
                </div>
                <PrioriteBadge priorite={t.priorite} />
                <StatutBadge statut={t.statut} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  {new Date(t.updated_at).toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NouveauTicketModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onCreated={(ticket) => { setShowModal(false); navigate(`/helpdesk/${ticket.id}`) }}
        />
      )}
    </>
  )
}
