import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Bell, MessageCircle, CheckCheck } from 'lucide-react'

const ENTITY_ROUTES = {
  activite:        '/activites',
  echelonnement:   '/assistant-social?tab=echelonnements',
  organisme_tiers: '/assistant-social?tab=organismes',
}

const ENTITY_LABELS = {
  activite:        'Activité',
  echelonnement:   'Échelonnement',
  organisme_tiers: 'Organisme tiers',
}

const fmtAgo = iso => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [notifs, setNotifs]   = useState([])
  const [open, setOpen]       = useState(false)
  const ref = useRef(null)

  const unread = notifs.filter(n => !n.lu).length

  // ── Chargement ─────────────────────────────────────────────────────────
  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*, commentaire:commentaire_id(message, auteur_nom)')
      .eq('destinataire_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifs(data || [])
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line

  // ── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `destinataire_id=eq.${user.id}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user]) // eslint-disable-line

  // ── Fermer au clic extérieur ────────────────────────────────────────────
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────
  const markAllRead = async () => {
    const ids = notifs.filter(n => !n.lu).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ lu: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const clickNotif = async notif => {
    // Mark as read
    if (!notif.lu) {
      await supabase.from('notifications').update({ lu: true }).eq('id', notif.id)
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, lu: true } : n))
    }
    setOpen(false)
    const base = ENTITY_ROUTES[notif.entity_type] || '/'
    // Deep-link : passer l'id de l'entité pour ouvrir directement le bon élément
    const route = notif.entity_id ? `${base}?open=${notif.entity_id}` : base
    navigate(route)
  }

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) load() }}
        className="relative text-white/60 hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5
            bg-red-500 text-white text-[10px] font-bold rounded-full
            flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-8 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100
          overflow-hidden z-[100]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">
              Notifications
              {unread > 0 && (
                <span className="ml-1.5 bg-red-100 text-red-600 text-xs rounded-full px-1.5 py-0.5 font-medium">
                  {unread} non lue{unread > 1 ? 's' : ''}
                </span>
              )}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck size={12} /> Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                Aucune notification
              </div>
            ) : notifs.map(n => (
              <button key={n.id} onClick={() => clickNotif(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50
                  transition-colors flex gap-3 items-start
                  ${!n.lu ? 'bg-primary/5' : ''}`}>

                {/* Dot non-lu */}
                <div className="mt-1.5 shrink-0">
                  {!n.lu
                    ? <span className="w-2 h-2 rounded-full bg-primary block" />
                    : <span className="w-2 h-2 rounded-full bg-transparent block" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  {/* Type + entité */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <MessageCircle size={11} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500 font-medium">
                      {ENTITY_LABELS[n.entity_type]}
                    </span>
                    {n.entity_label && (
                      <span className="text-xs text-gray-400 truncate">— {n.entity_label}</span>
                    )}
                  </div>

                  {/* Message */}
                  {n.commentaire?.message && (
                    <p className="text-sm text-gray-700 truncate leading-snug">
                      <span className="font-medium">{n.commentaire.auteur_nom}</span>
                      {' : '}{n.commentaire.message}
                    </p>
                  )}

                  {/* Date */}
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {fmtAgo(n.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-400">
                {notifs.length} notification{notifs.length > 1 ? 's' : ''} affichée{notifs.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
