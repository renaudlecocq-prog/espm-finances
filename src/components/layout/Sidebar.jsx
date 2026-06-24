import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import NotificationBell from '../ui/NotificationBell'

// ── Icônes SVG ────────────────────────────────────────────────────────────────
const ICONS = {
  home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />,
  eleves: (<>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </>),
  groupes: (<>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </>),
  soldes: (<>
    <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    <circle cx="16" cy="14" r="1.5" />
  </>),
  factures: (<>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </>),
  paiements: (<>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </>),
  activites: (<>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>),
  articles: (<>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </>),
  social: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
  helpdesk: (<>
    <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/>
  </>),
  salle: (<>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </>),
  admin: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  logout: (<>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>),
  smartschool: <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5m0 0v5m0-5L8 9" />,
  chevronsLeft: (<>
    <polyline points="11 17 6 12 11 7" />
    <polyline points="18 17 13 12 18 7" />
  </>),
  chevronsRight: (<>
    <polyline points="13 17 18 12 13 7" />
    <polyline points="6 17 11 12 6 7" />
  </>),
}

function SvgIcon({ name, size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {ICONS[name]}
    </svg>
  )
}

// ── Icône Smartschool : S dans un carré orange ────────────────────────────────
function SmartschoolIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="20" height="20" rx="4" fill="#E86C00" />
      <text
        x="10"
        y="14.5"
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="800"
        fontFamily="Arial, sans-serif"
      >S</text>
    </svg>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Sidebar() {
  const { profile, role, effectiveRole, isAdmin, isFinancier, isMdp, can } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('espm-sidebar-collapsed') === 'true' }
    catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('espm-sidebar-collapsed', String(collapsed)) }
    catch {}
  }, [collapsed])

  const links = [
    { to: '/',                 label: 'Accueil',      icon: 'home',      show: true },
    { to: '/groupes',          label: 'Élèves',       icon: 'groupes',   show: isMdp },
    { to: '/activites',        label: 'Activités',    icon: 'activites', show: isMdp },
    { to: '/eleves',           label: 'Soldes',       icon: 'soldes',    show: isFinancier },
    { to: '/factures',         label: 'Factures',     icon: 'factures',  show: isFinancier },
    { to: '/paiements',        label: 'Paiements',    icon: 'paiements', show: isFinancier },
    { to: '/articles',         label: 'Articles',     icon: 'articles',  show: isFinancier },
    { to: '/assistant-social', label: 'Suivi social', icon: 'social',    show: isFinancier },
    { to: '/helpdesk',          label: 'Helpdesk',     icon: 'helpdesk',  show: isMdp },
    { to: '/salle-des-profs',  label: 'Salle des profs', icon: 'salle', show: isMdp },
  ]

  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  const roleLabel = {
    admin: 'Admin',
    financier: 'Financier',
    mdp: 'MdP',
    responsable: 'Responsable',
  }

  const isActive = (to) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  const W = collapsed ? 64 : 224

  return (
    <aside
      style={{
        backgroundColor: '#2D1B2E',
        width: W,
        minWidth: W,
        transition: 'width 200ms ease, min-width 200ms ease',
      }}
      className="flex flex-col z-40 shrink-0"
    >
      {/* ── Logo + bouton toggle ─────────────────────────────────────── */}
      <div
        className="flex items-center h-14 px-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Link to="/" className="flex items-center gap-2 flex-1 min-w-0">
          <img
            src="/logo-ecole.svg"
            alt="ESPM"
            style={{ height: 28, width: 28, flexShrink: 0 }}
          />
          {!collapsed && (
            <span className="text-white font-bold text-base tracking-wide whitespace-nowrap">
              ESPM<span style={{ color: '#E86C00' }}>+</span>
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-white/40 hover:text-white transition-colors shrink-0 ml-1"
          title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
        >
          <SvgIcon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={16} />
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {links.filter(l => l.show).map(l => {
          const active = isActive(l.to)
          return (
            <Link
              key={l.to}
              to={l.to}
              title={collapsed ? l.label : undefined}
              className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${
                active
                  ? 'bg-white/20 text-white'
                  : 'text-white/65 hover:text-white hover:bg-white/10'
              }`}
            >
              <SvgIcon name={l.icon} />
              {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap">{l.label}</span>
              )}
            </Link>
          )
        })}

        {/* Séparateur */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 4px' }} />

        {/* Smartschool */}
        <a
          href="https://espmaritime.smartschool.be/"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Smartschool' : undefined}
          className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors hover:bg-white/10"
        >
          <SmartschoolIcon size={20} />
          {!collapsed && (
            <span
              className="text-sm font-medium whitespace-nowrap"
              style={{ color: '#E86C00' }}
            >
              Smartschool
            </span>
          )}
        </a>
      </nav>

      {/* ── Pied : notifications, admin, profil, déconnexion ─────────── */}
      <div
        className="shrink-0 px-2 pb-3 pt-3 space-y-0.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Notifications */}
        <div
          className="flex items-center gap-3 px-2 py-2.5 cursor-pointer rounded-lg hover:bg-white/10 transition-colors"
          onClick={e => { if (!e.target.closest('button')) e.currentTarget.querySelector('button')?.click() }}
        >
          <NotificationBell dropdownAlign="left" dropdownPosition="up" />
          {!collapsed && (
            <span className="text-sm font-medium text-white/65 whitespace-nowrap">
              Notifications
            </span>
          )}
        </div>

        {/* Administration */}
        {isAdmin && (
          <Link
            to="/admin"
            title={collapsed ? 'Administration' : undefined}
            className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${
              isActive('/admin')
                ? 'bg-white/20 text-white'
                : 'text-white/65 hover:text-white hover:bg-white/10'
            }`}
          >
            <SvgIcon name="admin" />
            {!collapsed && (
              <span className="text-sm font-medium whitespace-nowrap">Administration</span>
            )}
          </Link>
        )}

        {/* Profil utilisateur */}
        {profile && !collapsed && (
          <div className="px-2 py-2">
            <div className="text-white text-sm font-semibold truncate">
              {profile.prenom} {profile.nom}
            </div>
            <div className="text-white/50 text-xs flex items-center gap-1">
              {roleLabel[effectiveRole] || effectiveRole}
              {effectiveRole !== role && (
                <span title={`Réel : ${roleLabel[role] || role}`} className="opacity-50">↩</span>
              )}
            </div>
          </div>
        )}

        {/* Déconnexion */}
        <button
          onClick={logout}
          title={collapsed ? 'Se déconnecter' : undefined}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-white/65 hover:text-white hover:bg-white/10 transition-colors"
        >
          <SvgIcon name="logout" />
          {!collapsed && (
            <span className="text-sm font-medium whitespace-nowrap">Déconnexion</span>
          )}
        </button>
      </div>
    </aside>
  )
}
