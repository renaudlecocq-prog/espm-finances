import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/layout/Header'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Eleves from './pages/Eleves'
import Groupes from './pages/Groupes'
import Paiements from './pages/Paiements'
import Factures from './pages/Factures'
import Activites from './pages/Activites'
import Articles from './pages/Articles'
import Echelonnements from './pages/Echelonnements'
import OrganismesTiers from './pages/OrganismesTiers'
import Admin from './pages/Admin'
import MentionsLegales from './pages/MentionsLegales'

function RequireAuth({ children, require = 'user' }) {
  const { user, loading, isAdmin, isFinancier, isMdp } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  if (require === 'admin' && !isAdmin) return <Navigate to="/" replace />
  if (require === 'financier' && !isFinancier) return <Navigate to="/" replace />
  if (require === 'mdp' && !isMdp) return <Navigate to="/" replace />
  return children
}

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="max-w-screen-xl mx-auto w-full px-4 py-4 mt-8 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
        <span>© 2026 École Secondaire Plurielle Maritime</span>
        <Link to="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
      </footer>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/" element={<RequireAuth><Layout><Home /></Layout></RequireAuth>} />
      <Route path="/eleves" element={<RequireAuth require="mdp"><Layout><Eleves /></Layout></RequireAuth>} />
      <Route path="/groupes" element={<RequireAuth require="mdp"><Layout><Groupes /></Layout></RequireAuth>} />
      <Route path="/paiements" element={<RequireAuth require="financier"><Layout><Paiements /></Layout></RequireAuth>} />
      <Route path="/factures" element={<RequireAuth require="financier"><Layout><Factures /></Layout></RequireAuth>} />
      <Route path="/activites" element={<RequireAuth require="mdp"><Layout><Activites /></Layout></RequireAuth>} />
      <Route path="/articles" element={<RequireAuth require="financier"><Layout><Articles /></Layout></RequireAuth>} />
      <Route path="/echelonnements" element={<RequireAuth require="mdp"><Layout><Echelonnements /></Layout></RequireAuth>} />
      <Route path="/organismes" element={<RequireAuth require="mdp"><Layout><OrganismesTiers /></Layout></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth require="admin"><Layout><Admin /></Layout></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
