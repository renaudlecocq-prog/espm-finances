import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
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

// ── Utilitaire compression ────────────────────────────────────────────────────
async function compressFile(file) {
  if (!file.type.startsWith('image/')) return file
  try {
    return await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true })
  } catch { return file }
}

// ── Badge Statut ──────────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const s = STATUTS[statut] || STATUTS.nouveau
  return (
    <span style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── Champ dynamique ───────────────────────────────────────────────────────────
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
  const fileRef  = useRef(null)
  const [step, setStep]           = useState(1)
  const [selectedCat, setSelectedCat] = useState(null)
  const [titre, setTitre]         = useState('')
  const [priorite, setPriorite]   = useState('normale')
  const [formData, setFormData]   = useState({})
  const [files, setFiles]         = useState([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // Tickets ouverts dans la catégorie sélectionnée
  const relatedTickets = useMemo(() => {
    if (!selectedCat) return []
    return openTickets.filter(t => t.category_id === selectedCat.id && t.statut !== 'ferme')
  }, [selectedCat, openTickets])

  // Comptage open par catégorie
  const openCountByCategory = useMemo(() => {
    const counts = {}
    openTickets.forEach(t => {
      if (t.statut !== 'ferme') counts[t.category_id] = (counts[t.category_id] || 0) + 1
    })
    return counts
  }, [openTickets])

  const handleSelectCat = (cat) => { setSelectedCat(cat); setStep(2) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // Créer le ticket
      const { data: ticket, error: err } = await supabase.from('helpdesk_tickets').insert({
        titre, category_id: selectedCat.id, priorite, form_data: formData,
        created_by: user.id, assigned_to: null,
      }).select().single()
      if (err) throw err

      // Upload pièces jointes → message initial si fichiers présents
      if (files.length > 0) {
        const attachments = []
        for (const file of files) {
          const compressed = await compressFile(file)
          const path = `${ticket.id}/init_${Date.now()}_${file.name}`
          const { error: upErr } = await supabase.storage.from('helpdesk-attachments').upload(path, compressed)
          if (upErr) throw upErr
          const { data: urlData } = supabase.storage.from('helpdesk-attachments').getPublicUrl(path)
          attachments.push({ name: file.name, url: urlData.publicUrl, type: file.type, size: compressed.size })
        }
        await supabase.from('helpdesk_messages').insert({
          ticket_id: ticket.id, author_id: user.id,
          content: '', is_internal_note: false, attachments,
        })
      }

      onCreated(ticket)
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

        {/* Header modal */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>
              {step === 1 ? 'Nouveau ticket' : selectedCat?.nom}
            </div>
            {step === 2 && (
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

          {/* Étape 1 — choix catégorie */}
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
                            color: '#92400E', padding: '1px 7px', borderRadius: 4 }}>
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

          {/* Étape 2 — formulaire */}
          {step === 2 && (
            <form id="new-ticket-form" onSubmit={handleSubmit}>

              {/* Liste tickets ouverts — simple et discrète */}
              {relatedTickets.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                    Tickets déjà ouverts dans cette catégorie :
                  </div>
                  {relatedTickets.map(rt => (
                    <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>
                        #{String(rt.numero).padStart(4, '0')}
                      </span>
                      <span style={{ fontSize: 13, color: '#374151', flex: 1,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rt.titre}
                      </span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                        {rt.created_by_profile?.prenom} {rt.created_by_profile?.nom}
                      </span>
                      <button type="button"
                        onClick={() => { onClose(); navigate(`/helpdesk/${rt.id}`) }}
                        style={{ fontSize: 11, color: '#2563EB', fontWeight: 600,
                          background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        Voir
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                    Vous pouvez quand même créer un nouveau ticket ci-dessous.
                  </div>
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

              {/* Pièces jointes */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Pièces jointes
                </label>
                {files.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {files.map((f, i) => (
                      <span key={i} style={{ backgroundColor: '#F3F4F6', borderRadius: 6,
                        padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        📎 {f.name}
                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{ fontSize: 12, color: '#6B7280', background: 'none',
                    border: '1.5px dashed #D1D5DB', cursor: 'pointer', padding: '8px 14px',
                    borderRadius: 8, width: '100%', textAlign: 'center' }}>
                  + Ajouter un fichier (image, PDF, Word)
                </button>
                <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = '' }} />
              </div>
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
              {saving ? 'Création…' : 'Créer le ticket'}
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
  const p = PRIORITES[t.priorite] || PRIORITES.normale

  return (
    <div onClick={onClick} style={{
        backgroundColor: '#fff', borderRadius: 10, borderLeft: `4px solid ${catColor}`,
        padding: '14px 18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}>

      {/* Ligne 1 — titre + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{t.titre}</span>
        {isUnread && (
          <span style={{ backgroundColor: '#EF4444', color: '#fff', borderRadius: 999,
            minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            title="Mis à jour depuis votre dernière visite">●</span>
        )}
        <StatutBadge statut={t.statut} />
      </div>

      {/* Ligne 2 — méta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px',
        fontSize: 12, color: '#6B7280', alignItems: 'center' }}>
        {cat && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <CatIcon name={cat.icone} color={catColor} size={12} />
            <span style={{ color: catColor, fontWeight: 700 }}>{cat.nom}</span>
          </span>
        )}
        <span style={{ color: p.color, fontWeight: 700 }}>{p.icon} {p.label}</span>
        {creator && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="#9CA3AF" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {creator}
          </span>
        )}
        <span style={{ color: '#9CA3AF', fontWeight: 600 }}>#{String(t.numero).padStart(4, '0')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="#9CA3AF" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {dateStr}
        </span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Helpdesk() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [categories,   setCategories]   = useState([])
  const [tickets,      setTickets]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [filterStatut, setFilterStatut] = useState('actifs')
  const [filterCatId,  setFilterCatId]  = useState(null)
  const [filterMine,   setFilterMine]   = useState(true)  // "Mes tickets" ON par défaut
  const [search,       setSearch]       = useState('')

  // Tracking messages non-lus (localStorage)
  const [lastSeen, setLastSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hd_lastSeen') || '{}') }
    catch { return {} }
  })
  const isUnread = (t) => {
    if (t.statut === 'ferme') return false
    const seen = lastSeen[t.id]
    if (!seen) return false
    return t.updated_at > seen
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: tix }] = await Promise.all([
      supabase.from('helpdesk_categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('helpdesk_tickets').select(`
        id, numero, titre, statut, priorite, created_at, updated_at, category_id, created_by,
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
      if (filterMine && t.created_by !== user?.id) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.titre.toLowerCase().includes(q) &&
            !t.helpdesk_categories?.nom?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tickets, filterStatut, filterCatId, filterMine, search, user])

  const tabs = [
    { key: 'actifs', label: 'Actifs', count: actifs.filter(t => !filterMine || t.created_by === user?.id).length },
    { key: 'ferme',  label: 'Fermés', count: fermes.filter(t => !filterMine || t.created_by === user?.id).length },
    { key: 'tous',   label: 'Tous' },
  ]

  const unreadCount = tickets.filter(t => isUnread(t) && (!filterMine || t.created_by === user?.id)).length

  // Bouton "Mes tickets" dans leftActions
  const leftActions = (
    <button onClick={() => setFilterMine(f => !f)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.12s',
        border: filterMine ? 'none' : '1px solid rgba(255,255,255,0.15)',
        backgroundColor: filterMine ? 'rgba(255,255,255,0.18)' : 'transparent',
        color: filterMine ? 'white' : 'rgba(255,255,255,0.50)',
      }}>
      <svg viewBox="0 0 24 24" width={13} height={13} fill="none"
        stroke={filterMine ? 'white' : 'rgba(255,255,255,0.50)'} strokeWidth={2}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      Mes tickets
    </button>
  )

  // Filtres catégories (style identique aux tabs)
  const catFilters = categories.length > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', padding: '2px', borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.10)', gap: 0 }}>
      {categories.map(cat => {
        const active = filterCatId === cat.id
        return (
          <button key={cat.id} onClick={() => setFilterCatId(active ? null : cat.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.12s', border: 'none',
              backgroundColor: active ? cat.couleur : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
            }}>
            <CatIcon name={cat.icone} color={active ? '#fff' : 'rgba(255,255,255,0.55)'} size={11} />
            {cat.nom}
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <>
      <PageHeader
        title="Helpdesk"
        subtitle={`${actifs.length} actif${actifs.length !== 1 ? 's' : ''}${unreadCount > 0 ? ` · ${unreadCount} non lu${unreadCount > 1 ? 's' : ''}` : ''}`}
        leftActions={leftActions}
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

      <div className="p-6 max-w-screen-xl mx-auto">
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>
            {search || filterCatId
              ? 'Aucun ticket ne correspond aux filtres.'
              : filterMine
                ? 'Aucun ticket pour l\'instant. Cliquez sur "+ Nouveau ticket" pour en créer un.'
                : 'Aucun ticket.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => (
              <TicketCard key={t.id} ticket={t} isUnread={isUnread(t)}
                onClick={() => navigate(`/helpdesk/${t.id}`)} />
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
