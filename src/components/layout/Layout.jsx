import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import { isMobileDevice } from '../../lib/isMobile'
import DebugMobile from './DebugMobile'

export default function Layout() {
  return (
    <><DebugMobile />
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar : uniquement sur desktop (pointer:fine) */}
      {!isMobileDevice && <Sidebar />}

      <div
        id="page-content-scroll"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto"
      >
        <main
          id="page-main-content"
          className={`flex-1 flex flex-col max-w-screen-xl mx-auto w-full ${
            isMobileDevice
              ? 'px-3 py-4 pb-20'
              : 'px-6 py-8'
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

      {/* Barre mobile : uniquement sur touch devices */}
      {isMobileDevice && <MobileNav />}
    </div>
  )
}
