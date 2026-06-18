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
import AssistantSocial from './pages/AssistantSocial'
import OrganismesTiers from './pages/OrganismesTiers'
import Admin from './pages/Admin'
import MentionsLegales from './pages/MentionsLegales'

function RequireAuth({ children, require = 'user' }) {
  const { user, loading, role } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  if (require === 'admin'     && role !== 'admin')                               return <Navigate to="/" replace />
  if (require === 'financier' && !['admin','financier'].includes(role))          return <Navigate to="/" replace />
  if (require === 'mdp'       && !['admin','financier','mdp'].includes(role))    return <Navigate to="/" replace />
  return children
}

const PREVIEW_LABELS = { financier: 'Financier', mdp: 'Membre du personnel', responsable: 'Responsable' }
function Layout({ children }) {
  const { previewRole, setPreviewRole } = useAuth()
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-safe">{children}</main>
      <footer className="max-w-screen-xl mx-auto w-full px-4 py-4 mt-8 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
        <span>© 2026 École Secondaire Plurielle Maritime</span>
        <Link to="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
      </footer>
      {previewRole && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between text-sm shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          <span className="flex items-center gap-2">
            <span>👁</span>
            <span>Aperçu en tant que <strong>{PREVIEW_LABELS[previewRole] || previewRole}</strong> — les menus et accès reflètent ce rôle</span>
          </span>
          <button onClick={() => setPreviewRole(null)}
            className="bg-white text-orange-600 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition-colors ml-4 shrink-0">
            Quitter l'aperçu
          </button>
        </div>
      )}
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
      <Route path="/assistant-social" element={<RequireAuth require="mdp"><Layout><AssistantSocial /></Layout></RequireAuth>} />
      <Route path="/echelonnements" element={<Navigate to="/assistant-social" replace />} />
      <Route path="/organismes" element={<Navigate to="/assistant-social" replace />} />
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
