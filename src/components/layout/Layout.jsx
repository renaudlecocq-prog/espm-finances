import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar : cachée sous 1280px (mobile, tablettes, fold), visible desktop */}
      <div className="hidden xl:flex xl:flex-col xl:flex-none">
        <Sidebar />
      </div>

      <div
        id="page-content-scroll"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto"
      >
        <main
          id="page-main-content"
          className="flex-1 flex flex-col max-w-screen-xl mx-auto w-full
                     px-3 py-4 pb-20
                     xl:px-6 xl:py-8 xl:pb-8"
        >
          <Outlet />
        </main>

        {/* Footer : uniquement desktop */}
        <footer className="hidden xl:flex px-6 py-4 border-t border-gray-100 justify-between items-center text-xs text-gray-400 shrink-0">
          <span>© School Plus</span>
          <Link to="/mentions-legales" className="hover:text-primary transition-colors">
            Mentions légales
          </Link>
        </footer>
      </div>

      {/* Barre mobile : visible sous 1280px */}
      <div className="xl:hidden">
        <MobileNav />
      </div>
    </div>
  )
}
