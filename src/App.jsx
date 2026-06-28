import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DemoProvider, useDemo } from './context/DemoContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Eleves from './pages/Eleves'
import Groupes from './pages/Groupes'
import Paiements from './pages/Paiements'
import Factures from './pages/Factures'
import Activites from './pages/Activites'
import Articles from './pages/Articles'
import AssistantSocial from './pages/AssistantSocial'
import Admin from './pages/Admin'
import Helpdesk from './pages/Helpdesk'
import SalleDProfs from './pages/SalleDProfs'
import Econome from './pages/Econome'
import Compositions from './pages/Compositions'
import ConseilsDeGuidance from './pages/ConseilsDeGuidance'
import HelpdeskDetail from './pages/HelpdeskDetail'
import MentionsLegales from './pages/MentionsLegales'
import Profile from './pages/Profile'

function RequireAuth({ children, require = 'user', feature = null }) {
  const { user, loading, role, effectiveRole, can, viewAsRole } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  if (require === 'admin'     && !['admin','super_admin'].includes(role))                                    return <Navigate to="/" replace />
  if (require === 'direction' && !['admin','super_admin','direction'].includes(effectiveRole))               return <Navigate to="/" replace />
  if (require === 'mdp'       && !['admin','super_admin','direction','mdp'].includes(effectiveRole))         return <Navigate to="/" replace />
  // Vérification par feature — s'applique aux non-admins ET aux admins en mode aperçu
  if (feature && (!['admin','super_admin'].includes(role) || viewAsRole)) {
    const features = Array.isArray(feature) ? feature : [feature]
    if (!features.some(f => can(f))) return <Navigate to="/" replace />
  }
  return children
}

const DEMO_ROLES = [
  { key: null,          label: 'Admin' },
  { key: 'direction',   label: 'Direction' },
  { key: 'mdp',         label: 'MdP' },
  { key: 'responsable', label: 'Responsable' },
]

function Layout({ children }) {
  const { previewRole, setPreviewRole, role } = useAuth()
  const { demoMode, toggleDemo } = useDemo()
  const { s } = useSettings()

  return (
    <div className="flex h-screen bg-surface dark:bg-gray-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main
          className="flex-1 min-h-0 overflow-y-auto"
          style={demoMode ? { paddingBottom: '3rem' } : {}}
        >
          {children}
        </main>
        <footer className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400 dark:text-gray-500 shrink-0">
          <span>© 2026 {s('school_nom')} · v{__APP_VERSION__}</span>
          <Link to="/mentions-legales" className="hover:text-primary transition-colors">
            Mentions légales
          </Link>
        </footer>
      </div>

      {/* ── Bannière mode démo (avec switcher de rôle) ── */}
      {demoMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 text-sm shadow-[0_-4px_16px_rgba(0,0,0,0.25)]"
          style={{ background: '#7a3800', borderTop: '2px solid #E86C00' }}>
          <span className="text-white/70 text-xs font-semibold shrink-0">🎭 DÉMO</span>
          <span className="text-white/40 text-xs shrink-0">Vue :</span>
          <div className="flex gap-1">
            {DEMO_ROLES.map(({ key, label }) => {
              const active = previewRole === key
              return (
                <button
                  key={label}
                  onClick={() => setPreviewRole(key)}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors"
                  style={active
                    ? { background: '#E86C00', color: 'white' }
                    : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <button
            onClick={toggleDemo}
            className="bg-white dark:bg-gray-800 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition-colors shrink-0"
            style={{ color: '#E86C00' }}>
            Quitter le mode démo
          </button>
        </div>
      )}

      {/* ── Bannière aperçu de rôle (hors mode démo) ── */}
      {previewRole && !demoMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between text-sm shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          <span className="flex items-center gap-2">
            <span>👁</span>
            <span>Aperçu en tant que <strong>
              {{ direction: 'Direction', mdp: 'Membre du personnel', responsable: 'Responsable' }[previewRole] || previewRole}
            </strong> — les menus et accès reflètent ce rôle</span>
          </span>
          <button onClick={() => setPreviewRole(null)}
            className="bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition-colors ml-4 shrink-0">
            Quitter l'aperçu
          </button>
        </div>
      )}
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Chargement…</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/profile" element={<RequireAuth require="mdp"><Layout><Profile /></Layout></RequireAuth>} />
      <Route path="/" element={<RequireAuth><Layout><Home /></Layout></RequireAuth>} />
      <Route path="/soldes" element={<RequireAuth require="mdp" feature="eleves"><Layout><Eleves /></Layout></RequireAuth>} />
      <Route path="/eleves" element={<RequireAuth require="mdp" feature="eleves"><Layout><Groupes /></Layout></RequireAuth>} />
      <Route path="/paiements" element={<RequireAuth require="direction" feature="paiements"><Layout><Paiements /></Layout></RequireAuth>} />
      <Route path="/factures" element={<RequireAuth require="direction" feature="factures"><Layout><Factures /></Layout></RequireAuth>} />
      <Route path="/activites" element={<RequireAuth require="mdp" feature={['activites_full','activites_own']}><Layout><Activites /></Layout></RequireAuth>} />
      <Route path="/articles" element={<RequireAuth require="direction" feature="articles"><Layout><Articles /></Layout></RequireAuth>} />
      <Route path="/suivi-social" element={<RequireAuth require="direction" feature="suivi_social"><Layout><AssistantSocial /></Layout></RequireAuth>} />
      <Route path="/echelonnements" element={<Navigate to="/suivi-social" replace />} />
      <Route path="/organismes" element={<Navigate to="/suivi-social" replace />} />
      <Route path="/admin" element={<RequireAuth require="admin"><Layout><Admin /></Layout></RequireAuth>} />
      <Route path="/helpdesk" element={<RequireAuth require="mdp" feature={['helpdesk','helpdesk_admin']}><Layout><Helpdesk /></Layout></RequireAuth>} />
      <Route path="/helpdesk/:id" element={<RequireAuth require="mdp" feature={['helpdesk','helpdesk_admin']}><Layout><HelpdeskDetail /></Layout></RequireAuth>} />
      <Route path="/salle-des-profs" element={<RequireAuth require="mdp" feature="salle_profs"><Layout><SalleDProfs /></Layout></RequireAuth>} />
      <Route path="/comptes" element={<RequireAuth require="admin" feature="econome"><Layout><Econome /></Layout></RequireAuth>} />
      <Route path="/compositions" element={<RequireAuth require="mdp" feature="compositions"><Layout><Compositions /></Layout></RequireAuth>} />
      <Route path="/conseils-de-guidance" element={<RequireAuth require="mdp" feature="guidance"><Layout><ConseilsDeGuidance /></Layout></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <SettingsProvider>
        <DemoProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </DemoProvider>
      </SettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
