import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// ── Icônes ────────────────────────────────────────────────────────────────────
const ICONS = {
  home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>,
  eleves: (<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>),
  helpdesk: <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/>,
  salle: (<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  more: (<><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></>),
  activites: (<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  paiements: (<><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>),
  factures: (<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>),
  social: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>,
  guidance: (<><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></>),
  articles: (<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/></>),
  profile: (<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  soldes: (<><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><circle cx="16" cy="14" r="1.5"/></>),
}

function Icon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  )
}

// ── Tiroir "Plus" ─────────────────────────────────────────────────────────────
function MoreDrawer({ open, onClose, items }) {
  const location = useLocation()
  const drawerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('touchstart', handler), 50)
    return () => document.removeEventListener('touchstart', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Fond sombre */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 49, touchAction: 'none',
        }}
      />
      {/* Tiroir */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed', bottom: 56, left: 0, right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          zIndex: 50,
          padding: '12px 0 8px',
          maxHeight: '65vh',
          overflowY: 'auto',
        }}
      >
        {/* Poignée */}
        <div style={{ width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, margin: '0 auto 12px' }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 20px 8px' }}>
          Autres pages
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 8px' }}>
          {items.map(item => {
            const active = location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 12,
                  backgroundColor: active ? '#2D1B2E10' : 'transparent',
                  color: active ? '#2D1B2E' : '#374151',
                  textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 500,
                }}
              >
                <span style={{ color: active ? '#F16410' : '#6B7280', flexShrink: 0 }}>
                  <Icon name={item.icon} size={18} />
                </span>
                {item.label}
                {item.readOnly && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#9CA3AF', fontWeight: 600,
                    backgroundColor: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>Lecture</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function MobileNav() {
  const location = useLocation()
  const { can, isAdmin } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  // Ferme le tiroir au changement de route
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  // Pages dans la barre principale
  const mainItems = [
    { to: '/',              label: 'Accueil',  icon: 'home',     always: true },
    { to: '/eleves',        label: 'Élèves',   icon: 'eleves',   show: can('eleves') },
    { to: '/helpdesk',      label: 'Helpdesk', icon: 'helpdesk', show: can('helpdesk') || can('helpdesk_admin') },
    { to: '/salle-des-profs', label: 'Salle',  icon: 'salle',    show: can('salle_profs') },
  ].filter(i => i.always || i.show)

  // Pages dans le tiroir "Plus"
  const moreItems = [
    { to: '/activites',            label: 'Activités',           icon: 'activites',  show: can('activites_full') || can('activites_own'), readOnly: true },
    { to: '/paiements',            label: 'Paiements',           icon: 'paiements',  show: can('paiements') },
    { to: '/factures',             label: 'Factures',            icon: 'factures',   show: can('factures') },
    { to: '/soldes',               label: 'Soldes',              icon: 'soldes',     show: can('soldes') },
    { to: '/suivi-social',         label: 'Suivi social',        icon: 'social',     show: can('suivi_social') },
    { to: '/conseils-de-guidance', label: 'Guidance',            icon: 'guidance',   show: can('guidance') },
    { to: '/articles',             label: 'Articles',            icon: 'articles',   show: can('articles') },
    { to: '/profile',              label: 'Mon profil',          icon: 'profile',    always: true },
  ].filter(i => i.always || i.show)

  const isMoreActive = moreOpen || moreItems.some(i => location.pathname.startsWith(i.to))

  return (
    <>
      <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 56,
        backgroundColor: '#fff',
        borderTop: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'stretch',
        zIndex: 48,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {mainItems.map(item => {
          const active = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                color: active ? '#F16410' : '#9CA3AF',
                textDecoration: 'none',
                fontSize: 10, fontWeight: active ? 700 : 500,
                transition: 'color 0.15s',
              }}
            >
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          )
        })}

        {/* Bouton Plus */}
        <button
          onClick={() => setMoreOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            color: isMoreActive ? '#F16410' : '#9CA3AF',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: isMoreActive ? 700 : 500,
          }}
        >
          <Icon name="more" size={22} />
          Plus
        </button>
      </nav>
    </>
  )
}
