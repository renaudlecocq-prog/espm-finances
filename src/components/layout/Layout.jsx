import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar />
      <div id="page-content-scroll" className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
          <Outlet />
        </main>
        <footer className="px-6 py-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 shrink-0">
          <span>© 2026 École Secondaire Plurielle Maritime</span>
          <Link to="/mentions-legales" className="hover:text-primary transition-colors">
            Mentions légales
          </Link>
        </footer>
      </div>
    </div>
  )
}
