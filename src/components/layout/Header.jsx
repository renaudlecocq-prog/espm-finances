import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import NotificationBell from '../ui/NotificationBell'

export default function Header() {
  const { profile, role, isAdmin, isFinancier, isMdp } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const links = [
    { to: '/',                 label: 'Accueil',        show: true },
    { to: '/eleves',           label: 'Élèves',         show: isFinancier },
    { to: '/groupes',          label: 'Groupes',        show: isMdp },
    { to: '/factures',         label: 'Factures',       show: isFinancier },
    { to: '/paiements',        label: 'Paiements',      show: isFinancier },
    { to: '/activites',        label: 'Activités',      show: isMdp },
    { to: '/articles',         label: 'Articles',       show: isFinancier },
    { to: '/assistant-social', label: 'Assist. social', show: isFinancier },
  ]

  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  const roleLabel = { admin: 'Admin', financier: 'Financier', mdp: 'MdP', responsable: 'Responsable' }

  const navClass = (to) => {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
    return 'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
      (active ? 'bg-white/20 text-white font-semibold' : 'text-white/70 hover:text-white hover:bg-white/10')
  }

  return (
    <header style={{ backgroundColor: '#2D1B2E' }}>
      <div className="max-w-screen-xl mx-auto px-4 flex items-center h-14 gap-4">

        <Link to="/" className="shrink-0">
          <img src="/logo-espm.png" alt="ESPM" className="h-9 w-auto brightness-0 invert" />
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto flex-1">
          {links.filter(l => l.show).map(l => (
            <Link key={l.to} to={l.to} className={navClass(l.to)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://espmaritime.smartschool.be/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'rgb(232, 108, 0)' }}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M9 2h5m0 0v5m0-5L8 9" />
            </svg>
            Smartschool
          </a>

          {profile && (
            <div className="text-right leading-tight hidden sm:block">
              <span className="text-white text-sm font-semibold block">{profile.prenom}</span>
              <span className="text-white/60 text-xs">{roleLabel[role] || role}</span>
            </div>
          )}

          {isAdmin && (
            <Link to="/admin" className="text-white/60 hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
            </Link>
          )}

          <NotificationBell />

          <button onClick={logout} className="text-white/60 hover:text-white transition-colors">
            <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h5a1 1 0 010 2H3a3 3 0 01-3-3V4a3 3 0 013-3h5a1 1 0 010 2H3zm10.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L14.586 11H7a1 1 0 110-2h7.586l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
