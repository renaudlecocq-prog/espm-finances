import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUTS = {
  nouveau:    { label: 'Nouveau',    color: '#2563EB', bg: '#DBEAFE' },
  en_cours:   { label: 'En cours',   color: '#D97706', bg: '#FEF3C7' },
  en_attente: { label: 'En attente', color: '#7C3AED', bg: '#EDE9FE' },
  resolu:     { label: 'Résolu',     color: '#059669', bg: '#D1FAE5' },
  ferme:      { label: 'Fermé',      color: '#6B7280', bg: '#F3F4F6' },
}
const PRIORITES = {
  faible:  { label: 'Faible',  color: '#6B7280', icon: '↓' },
  normale: { label: 'Normale', color: '#2563EB', icon: '→' },
  haute:   { label: 'Haute',   color: '#D97706', icon: '↑' },
  urgente: { label: 'Urgente', color: '#DC2626', icon: '⚡' },
}

// ── Compression image ─────────────────────────────────────────────────────────
async function compressFile(file) {
  if (!file.type.startsWith('image/')) return file
  try {
    return await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true })
  } catch { return file }
}

// ── Résumé des champs formulaire ──────────────────────────────────────────────
function FormDataSummary({ formFields, formData }) {
  if (!formFields?.length) return null
  const filled = formFields.filter(f => formData?.[f.id] !== undefined && formData?.[f.id] !== '')
  if (!filled.length) return null
  return (
    <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
      borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Détails de la demande
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filled.map(f => {
          const val = formData[f.id]
          const display = Array.isArray(val) ? val.join(', ') : String(val)
          return (
            <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600,
                minWidth: 140, flexShrink: 0 }}>{f.label}</span>
              <span style={{ fontSize: 12, color: '#111' }}>{display}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Pièce jointe ─────────────────────────────────────────────────────────────
function AttachmentChip({ attachment, dark }) {
  const isImage = attachment.type?.startsWith('image/')
  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        backgroundColor: dark ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
        color: dark ? '#fff' : '#374151', borderRadius: 6, padding: '4px 10px',
        fontSize: 11, fontWeight: 600, textDecoration: 'none', marginTop: 6, marginRight: 6 }}>
      {isImage ? '🖼' : '📎'} {attachment.name}
    </a>
  )
}

// ── Bulle de message ──────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }) {
  const dateStr = new Date(msg.created_at).toLocaleString('fr-BE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
  if (msg.is_internal_note) return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
      <div style={{ backgroundColor: '#FEF3C7', border: '1px dashed #D97706',
        borderRadius: 8, padding: '10px 14px', maxWidth: 480, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#92400E', fontSize: 11, marginBottom: 4 }}>
          🔒 Note interne — {msg.author_profile?.prenom} {msg.author_profile?.nom} · {dateStr}
        </div>
        <div style={{ color: '#78350F', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        {(msg.attachments || []).map((a, i) => <AttachmentChip key={i} attachment={a} />)}
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
      <div style={{ maxWidth: '72%' }}>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, textAlign: isOwn ? 'right' : 'left' }}>
          {!isOwn && `${msg.author_profile?.prenom} ${msg.author_profile?.nom} · `}{dateStr}
        </div>
        <div style={{
          backgroundColor: isOwn ? '#2D1B2E' : '#F3F4F6', color: isOwn ? '#fff' : '#111',
          borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding: '10px 14px', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
        {(msg.attachments || []).filter(a => a.name || a.url).map((a, i) => (
          <AttachmentChip key={i} attachment={a} dark={isOwn} />
        ))}
      </div>
    </div>
  )
}

// ── Ligne info panneau ────────────────────────────────────────────────────────

// ── Tag (badge non-pill) ──────────────────────────────────────────────────────
function Tag({ label, color, bg }) {
  return (
    <span style={{ backgroundColor: bg, color, fontSize: 11, fontWeight: 700,
      padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function HelpdeskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const bottomRef = useRef(null)
  const fileRef   = useRef(null)

  const [ticket,    setTicket]    = useState(null)
  const [messages,  setMessages]  = useState([])
  const [profiles,  setProfiles]  = useState([])  // staff pour participants
  const [loading,   setLoading]   = useState(true)
  const [content,   setContent]   = useState('')
  const [isNote,    setIsNote]    = useState(false)
  const [files,     setFiles]     = useState([])
  const [sending,   setSending]   = useState(false)
  const [updating,  setUpdating]  = useState(false)
  const [error,     setError]     = useState('')
  const [showAddParticipant, setShowAddParticipant] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('helpdesk_tickets').select(`
        *, helpdesk_categories(*),
        created_by_profile:profiles!helpdesk_tickets_created_by_fkey(id, prenom, nom),
        assigned_to_profile:profiles!helpdesk_tickets_assigned_to_fkey(id, prenom, nom)
      `).eq('id', id).single(),
      supabase.from('helpdesk_messages').select(`
        *, author_profile:profiles!helpdesk_messages_author_id_fkey(id, prenom, nom)
      `).eq('ticket_id', id).order('created_at', { ascending: true }),
    ])
    setTicket(t)
    setMessages(m || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Marquer comme lu
  useEffect(() => {
    if (loading || !id) return
    try {
      const seen = JSON.parse(localStorage.getItem('hd_lastSeen') || '{}')
      seen[id] = new Date().toISOString()
      localStorage.setItem('hd_lastSeen', JSON.stringify(seen))
    } catch {}
  }, [id, loading])

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Charger staff pour participants
  useEffect(() => {
    if (!isAdmin) return
    supabase.from('profiles').select('id, prenom, nom, role')
      .in('role', ['admin','financier','mdp']).order('nom')
      .then(({ data }) => setProfiles(data || []))
  }, [isAdmin])

  const updateField = async (field, value) => {
    setUpdating(true)
    const update = { [field]: value }
    if (field === 'statut' && value === 'ferme') update.closed_at = new Date().toISOString()
    if (field === 'statut' && value !== 'ferme') update.closed_at = null
    await supabase.from('helpdesk_tickets').update(update).eq('id', id)
    setTicket(prev => ({ ...prev, ...update }))
    setUpdating(false)
  }

  const addParticipant = async (profileId) => {
    const current = ticket.participant_ids || []
    if (current.includes(profileId)) return
    const updated = [...current, profileId]
    await updateField('participant_ids', updated)
    setShowAddParticipant(false)
  }

  const removeParticipant = async (profileId) => {
    const updated = (ticket.participant_ids || []).filter(id => id !== profileId)
    await updateField('participant_ids', updated)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!content.trim() && files.length === 0) return
    setSending(true)
    setError('')
    try {
      const attachments = []
      for (const file of files) {
        const compressed = await compressFile(file)
        const path = `${id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('helpdesk-attachments').upload(path, compressed)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('helpdesk-attachments').getPublicUrl(path)
        attachments.push({ name: file.name, url: urlData.publicUrl, type: file.type, size: compressed.size })
      }
      const { error: msgErr } = await supabase.from('helpdesk_messages').insert({
        ticket_id: id, author_id: user.id,
        content: content.trim(), is_internal_note: isNote && isAdmin, attachments,
      })
      if (msgErr) throw msgErr
      if (ticket.statut === 'nouveau') await updateField('statut', 'en_cours')
      setContent(''); setFiles([]); setIsNote(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9CA3AF' }}>
      Chargement…
    </div>
  )
  if (!ticket) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Ticket introuvable.</div>
  )

  const statut   = STATUTS[ticket.statut]   || STATUTS.nouveau
  const priorite = PRIORITES[ticket.priorite] || PRIORITES.normale
  const cat      = ticket.helpdesk_categories
  const creator  = ticket.created_by_profile
  const numStr   = `#${String(ticket.numero).padStart(4, '0')}`
  const dateStr  = new Date(ticket.created_at).toLocaleDateString('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' })

  // Participants = profils chargés dont l'ID est dans participant_ids
  const participantProfiles = profiles.filter(p => (ticket.participant_ids || []).includes(p.id))
  const availableToAdd = profiles.filter(p =>
    !(ticket.participant_ids || []).includes(p.id) &&
    p.id !== ticket.created_by
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── PageHeader (style Activités) ── */}
      <PageHeader
        title={ticket.titre}
        subtitle={`${numStr} · ${cat?.nom || ''} · ${creator?.prenom} ${creator?.nom} · ${dateStr}`}
        leftActions={
          <>
            <button onClick={() => navigate('/helpdesk')}
              style={{ display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: 500,
                padding: '4px 8px', borderRadius: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.70)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Helpdesk
            </button>
            <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.20)', margin: '0 2px' }} />
          </>
        }
        filters={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag label={statut.label} color={statut.color} bg={statut.bg} />
            <span style={{ color: priorite.color, fontSize: 11, fontWeight: 700 }}>
              {priorite.icon} {priorite.label}
            </span>
          </div>
        }
        actions={
          isAdmin && ticket.statut !== 'ferme' ? (
            <button onClick={() => updateField('statut', 'ferme')} disabled={updating}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
              Fermer
            </button>
          ) : ticket.statut === 'ferme' && isAdmin ? (
            <button onClick={() => updateField('statut', 'nouveau')} disabled={updating}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
              Réouvrir
            </button>
          ) : null
        }
      />

      {/* ── Corps ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Colonne gauche : fil de discussion */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #E5E7EB' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <FormDataSummary formFields={cat?.form_fields} formData={ticket.form_data} />
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '40px 0' }}>
                Aucun message pour l'instant. Soyez le premier à répondre.
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} isOwn={msg.author_id === user?.id} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Zone de saisie */}
          {ticket.statut !== 'ferme' ? (
            <div style={{ borderTop: '1px solid #E5E7EB', padding: '16px 24px', flexShrink: 0 }}>
              {error && (
                <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '8px 12px',
                  borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>
              )}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button type="button" onClick={() => setIsNote(false)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: !isNote ? '2px solid #2D1B2E' : '2px solid #E5E7EB',
                      backgroundColor: !isNote ? '#2D1B2E' : '#fff', color: !isNote ? '#fff' : '#374151' }}>
                    Répondre
                  </button>
                  <button type="button" onClick={() => setIsNote(true)}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: isNote ? '2px solid #D97706' : '2px solid #E5E7EB',
                      backgroundColor: isNote ? '#FEF3C7' : '#fff', color: isNote ? '#92400E' : '#374151' }}>
                    🔒 Note interne
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder={isNote ? 'Note visible uniquement par les agents...' : 'Écrivez votre message...'}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                    border: `1.5px solid ${isNote ? '#D97706' : '#E5E7EB'}`,
                    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    backgroundColor: isNote ? '#FFFBEB' : '#fff' }} />
                {files.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {files.map((f, i) => (
                      <span key={i} style={{ backgroundColor: '#F3F4F6', borderRadius: 6,
                        padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        📎 {f.name}
                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280',
                      fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    📎 Pièce jointe
                  </button>
                  <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = '' }} />
                  <button type="submit" disabled={sending || (!content.trim() && files.length === 0)}
                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
                      backgroundColor: isNote ? '#D97706' : '#2D1B2E', color: '#fff',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      opacity: (sending || (!content.trim() && files.length === 0)) ? 0.5 : 1 }}>
                    {sending ? 'Envoi…' : isNote ? 'Ajouter la note' : 'Envoyer'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #E5E7EB', padding: '14px 24px',
              backgroundColor: '#F9FAFB', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              Ce ticket est fermé.
            </div>
          )}
        </div>

        {/* Colonne droite : panneau agent */}
        {isAdmin && (
          <div style={{ width: 250, flexShrink: 0, overflowY: 'auto', padding: '20px 16px',
            backgroundColor: '#FAFAFA' }}>

            {/* Statut */}
            <SectionLabel>Statut</SectionLabel>
            <select value={ticket.statut} onChange={e => updateField('statut', e.target.value)}
              disabled={updating}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
                border: '1.5px solid #E5E7EB', backgroundColor: '#fff', cursor: 'pointer', marginBottom: 14 }}>
              {Object.entries(STATUTS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Priorité */}
            <SectionLabel>Priorité</SectionLabel>
            <select value={ticket.priorite} onChange={e => updateField('priorite', e.target.value)}
              disabled={updating}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
                border: '1.5px solid #E5E7EB', backgroundColor: '#fff', cursor: 'pointer', marginBottom: 14 }}>
              {Object.entries(PRIORITES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>

            {/* Participants */}
            <SectionLabel>Participants</SectionLabel>
            <div style={{ marginBottom: 14 }}>
              {/* Créateur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: 999,
                  backgroundColor: '#E0D4E7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#2D1B2E', flexShrink: 0 }}>
                  {creator?.prenom?.[0]}{creator?.nom?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111', 
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {creator?.prenom} {creator?.nom}
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Demandeur</div>
                </div>
              </div>

              {/* Participants ajoutés */}
              {participantProfiles.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999,
                    backgroundColor: '#E0D4E7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#2D1B2E', flexShrink: 0 }}>
                    {p.prenom?.[0]}{p.nom?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.prenom} {p.nom}
                    </div>
                  </div>
                  <button onClick={() => removeParticipant(p.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9CA3AF', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}
                    title="Retirer">×</button>
                </div>
              ))}

              {/* Ajouter */}
              {!showAddParticipant && availableToAdd.length > 0 && (
                <button onClick={() => setShowAddParticipant(true)}
                  style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, marginTop: 4 }}>
                  + Ajouter un·e collègue
                </button>
              )}
              {showAddParticipant && (
                <div style={{ marginTop: 6 }}>
                  <select defaultValue=""
                    onChange={e => { if (e.target.value) addParticipant(e.target.value) }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
                      border: '1.5px solid #E5E7EB', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="">Choisir…</option>
                    {availableToAdd.map(p => (
                      <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                    ))}
                  </select>
                  <button onClick={() => setShowAddParticipant(false)}
                    style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '4px 0' }}>
                    Annuler
                  </button>
                </div>
              )}
            </div>

            {/* Infos ticket */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, marginTop: 8 }}>
              <SectionLabel>Informations</SectionLabel>
              <InfoRow label="Ticket" value={numStr} />
              <InfoRow label="Créé le" value={new Date(ticket.created_at).toLocaleDateString('fr-BE', {
                day: '2-digit', month: 'short', year: 'numeric' })} />
              <InfoRow label="Mis à jour" value={new Date(ticket.updated_at).toLocaleDateString('fr-BE', {
                day: '2-digit', month: 'short' })} />
              {ticket.closed_at && (
                <InfoRow label="Fermé le" value={new Date(ticket.closed_at).toLocaleDateString('fr-BE', {
                  day: '2-digit', month: 'short', year: 'numeric' })} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF',
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#374151', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
