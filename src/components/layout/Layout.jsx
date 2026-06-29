import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import { isMobileDevice } from '../../lib/isMobile'

// DEBUG TEMPORAIRE — à supprimer après diagnostic
function DebugBar() {
  const lines = [
    `pointer:coarse = ${window.matchMedia('(pointer: coarse)').matches}`,
    `any-pointer:coarse = ${window.matchMedia('(any-pointer: coarse)').matches}`,
    `hover:none = ${window.matchMedia('(hover: none)').matches}`,
    `maxTouchPoints = ${navigator.maxTouchPoints}`,
    `innerWidth = ${window.innerWidth}`,
    `screen.width = ${window.screen.width}`,
    `isMobile = ${isMobileDevice}`,
    `UA = ${navigator.userAgent.slice(0, 60)}`,
  ]
  return (
    <div style={{
      background: '#111', color: '#4f4', fontSize: 11,
      padding: '6px 8px', fontFamily: 'monospace', lineHeight: 1.6,
      borderBottom: '2px solid #4f4', flexShrink: 0
    }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
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
        <DebugBar />

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
    </div>
  )
}
