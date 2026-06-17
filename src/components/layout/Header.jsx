import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Header() {
  const { role, profile, isAdmin, isFinancier, isMdp } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const links = [
    { to: '/',               label: 'Accueil',        show: true },
    { to: '/eleves',         label: 'Élèves',         show: isMdp },
    { to: '/groupes',        label: 'Groupes',        show: isMdp },
    { to: '/factures',       label: 'Factures',       show: isFinancier },
    { to: '/paiements',      label: 'Paiements',      show: isFinancier },
    { to: '/activites',      label: 'Activités',      show: isMdp },
    { to: '/articles',       label: 'Articles',       show: isFinancier },
    { to: '/echelonnements', label: 'Assist. social', show: isMdp },
    { to: '/admin',          label: 'Admin',          show: isAdmin },
  ]

  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const displayName = profile ? (profile.prenom || profile.nom || '') : ''
  const roleLabel = { admin: 'Admin', financier: 'Financier', mdp: 'MdP', responsable: 'Responsable' }[role] || role

  return (
    <header style={{ backgroundColor: '#2D1B2E' }}>
      <div className="max-w-screen-xl mx-auto px-4 flex items-center h-14 gap-4">

        {/* Logo */}
        <Link to="/" className="shrink-0">
          <img src="/logo-espm.png" alt="ESPM" className="h-9 w-auto" />
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 overflow-x-auto flex-1">
          {links.filter(l => l.show).map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${isActive(l.to)
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Droite */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Smartschool */}
          <a
            href="https://espmaritime.smartschool.be"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#E86C00' }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2">
              <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M9 2h5m0 0v5m0-5L7 10"/>
            </svg>
            Smartschool
          </a>

          {/* Utilisateur */}
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-white text-sm font-semibold">{displayName || 'Renaud'}</span>
            <span className="text-white/60 text-xs">{roleLabel}</span>
          </div>

          {/* Cloche */}
          <button className="text-white/60 hover:text-white transition-colors" title="Notifications">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z"/>
            </svg>
          </button>

          {/* Déconnexion */}
          <button onClick={logout} className="text-white/60 hover:text-white transition-colors" title="Déconnexion">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l4 3m0 0l-4 3m4-3H7m3 6H5a2 2 0 01-2-2V6a2 2 0 012-2h5"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
