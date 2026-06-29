import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import { isMobileDevice, setLayoutMode } from '../../lib/isMobile'

function LayoutToggle() {
  return (
    <button
      onClick={() => setLayoutMode(isMobileDevice ? 'desktop' : 'mobile')}
      title={isMobileDevice ? 'Passer en mode desktop' : 'Passer en mode mobile'}
      style={{
        position: 'fixed', bottom: isMobileDevice ? 70 : 16, right: 12,
        zIndex: 999, background: '#2D1B2E', color: '#fff',
        border: '1px solid #F16410', borderRadius: 20,
        padding: '4px 10px', fontSize: 11, cursor: 'pointer', opacity: 0.7
      }}
    >
      {isMobileDevice ? '💻' : '📱'}
    </button>
  )
}

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {!isMobileDevice && <Sidebar />}

      <div
        id="page-content-scroll"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto"
      >
        <main
          id="page-main-content"
          className={`flex-1 flex flex-col max-w-screen-xl mx-auto w-full ${
            isMobileDevice ? 'px-3 py-4 pb-20' : 'px-6 py-8'
          }`}
        >
          <Outlet />
        </main>

        {!isMobileDevice && (
          <footer className="flex px-6 py-4 border-t border-gray-100 justify-between items-center text-xs text-gray-400 shrink-0">
            <span>© School Plus</span>
            <Link to="/mentions-legales" className="hover:text-primary transition-colors">
              Mentions légales
            </Link>
          </footer>
        )}
      </div>

      {isMobileDevice && <MobileNav />}
      <LayoutToggle />
    </div>
  )
}
