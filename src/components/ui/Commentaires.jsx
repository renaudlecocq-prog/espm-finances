import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Send, MessageCircle, FileText, FileMinus, Pencil } from 'lucide-react'

const fmtDateTime = iso => {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
  if (isToday)     return `Aujourd'hui à ${time}`
  if (isYesterday) return `Hier à ${time}`
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }) + ` à ${time}`
}

const initiales = nom => {
  const parts = (nom || '').trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (nom || '?').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-sky-500',
  'bg-teal-500',   'bg-rose-500',   'bg-amber-500',
]
const avatarColor = nom => {
  let hash = 0
  for (const c of (nom || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function SystemEvent({ m }) {
  const meta = m.meta || {}
  let Icon = Pencil
  let text = ''
  let colorClass = 'text-blue-500'

  if (meta.action === 'edit') {
    Icon = Pencil
    colorClass = 'text-blue-400'
    text = `a modifié : ${(meta.fields || []).join(', ')}`
  } else if (meta.action === 'doc_add') {
    Icon = FileText
    colorClass = 'text-green-500'
    const cat = meta.categorie === 'facture' ? 'une facture' : 'un document'
    text = `a ajouté ${cat} : ${meta.filename}`
  } else if (meta.action === 'doc_del') {
    Icon = FileMinus
    colorClass = 'text-red-400'
    const cat = meta.categorie === 'facture' ? 'une facture' : 'un document'
    text = `a supprimé ${cat} : ${meta.filename}`
  }

  return (
    <div className="flex items-center gap-2 py-1 select-none">
      <div className="flex-1 h-px bg-gray-100" />
      <div className={`flex items-center gap-1 text-[10px] ${colorClass} shrink-0 max-w-[80%]`}>
        <Icon size={10} className="shrink-0" />
        <span className="font-semibold text-gray-600 truncate">{m.auteur_nom}</span>
        <span className="text-gray-400 truncate">{text}</span>
        <span className="text-gray-300 shrink-0">· {fmtDateTime(m.created_at)}</span>
      </div>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

export default function Commentaires({ entityType, entityId, entityLabel }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [texte, setTexte]       = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const loadMessages = useCallback(async () => {
    if (!entityId) return
    const { data } = await supabase
      .from('commentaires')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => {
    setLoading(true)
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!entityId) return
    const channel = supabase
      .channel(`commentaires:${entityType}:${entityId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'commentaires',
        filter: `entity_id=eq.${entityId}`,
      }, payload => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [entityType, entityId])

  const send = async () => {
    const msg = texte.trim()
    if (!msg || !user || sending) return
    setSending(true)

    const auteurNom = profile
      ? `${profile.prenom || ''} ${profile.nom || ''}`.trim()
      : (user.email || 'Inconnu')

    const { data: inserted, error } = await supabase
      .from('commentaires')
      .insert({
        entity_type: entityType,
        entity_id:   entityId,
        auteur_id:   user.id,
        auteur_nom:  auteurNom,
        message:     msg,
        type:        'message',
      })
      .select()
      .single()

    if (!error && inserted) {
      const { data: allProfiles } = await supabase.from('profiles').select('id')
      const others = (allProfiles || []).filter(p => p.id !== user.id)
      if (others.length > 0) {
        await supabase.from('notifications').insert(
          others.map(p => ({
            destinataire_id: p.id,
            commentaire_id:  inserted.id,
            entity_type:     entityType,
            entity_id:       entityId,
            entity_label:    entityLabel || null,
          }))
        )
      }
      setTexte('')
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!entityId) return null

  const msgCount = messages.filter(m => m.type === 'message').length

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-gray-100 shrink-0">
        <MessageCircle size={14} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Messages & journal
          {msgCount > 0 && (
            <span className="ml-1.5 bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-xs font-medium">
              {msgCount}
            </span>
          )}
        </span>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {loading ? (
          <div className="text-xs text-gray-400 text-center py-4">Chargement…</div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-6 italic">
            Aucun message pour le moment.
          </div>
        ) : (
          messages.map(m => {
            if (m.type === 'system') return <SystemEvent key={m.id} m={m} />

            const isMe = m.auteur_id === user?.id
            return (
              <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                  text-white text-xs font-bold ${avatarColor(m.auteur_nom)}`}>
                  {initiales(m.auteur_nom)}
                </div>
                <div className={`flex flex-col gap-0.5 max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-1.5">
                    {!isMe && (
                      <span className="text-xs font-semibold text-gray-700">{m.auteur_nom}</span>
                    )}
                    <span className="text-[10px] text-gray-400">{fmtDateTime(m.created_at)}</span>
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words
                    ${isMe
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                    {m.message}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0 border-t border-gray-50">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 pr-1.5 pl-3 py-1.5
          focus-within:border-primary/40 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={texte}
            onChange={e => setTexte(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Écrire un message… (Entrée)"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none
              outline-none leading-snug py-0.5"
            style={{ maxHeight: 80 }}
          />
          <button
            onClick={send}
            disabled={!texte.trim() || sending}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
              bg-primary text-white disabled:opacity-30 hover:bg-primary/90 transition-colors">
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 ml-1">Shift+Entrée pour un saut de ligne</p>
      </div>
    </div>
  )
}
