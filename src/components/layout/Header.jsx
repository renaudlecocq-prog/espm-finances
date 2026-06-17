import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Header() {
  const { role, isAdmin, isFinancier, isMdp } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const links = [
    { to: '/', label: 'Accueil', show: true },
    { to: '/eleves', label: 'Élèves', show: isMdp },
    { to: '/groupes', label: 'Groupes', show: isMdp },
    { to: '/paiements', label: 'Paiements', show: isFinancier },
    { to: '/factures', label: 'Factures', show: isFinancier },
    { to: '/activites', label: 'Activités', show: isMdp },
    { to: '/articles', label: 'Articles', show: isFinancier },
    { to: '/echelonnements', label: 'Échelonnements', show: isMdp },
    { to: '/organismes', label: 'Organismes tiers', show: isMdp },
    { to: '/admin', label: 'Admin', show: isAdmin },
  ]

  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-14">
        <span className="font-bold text-primary text-lg tracking-tight whitespace-nowrap">ESPM Finances</span>
        <nav className="flex items-center gap-1 overflow-x-auto flex-1">
          {links.filter(l => l.show).map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${location.pathname === l.to ? 'bg-surface text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-gray-400 capitalize hidden sm:block">{role}</span>
          <button onClick={logout} className="btn btn-secondary btn-sm">Déconnexion</button>
        </div>
      </div>
    </header>
  )
}
