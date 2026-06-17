import { Outlet, Link } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="max-w-screen-xl mx-auto px-4 py-4 mt-8 border-t border-gray-100 flex justify-between items-center text-xs text-primary-lighter">
        <span>© 2026 École Secondaire Plurielle Maritime</span>
        <Link to="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
      </footer>
    </div>
  )
}
