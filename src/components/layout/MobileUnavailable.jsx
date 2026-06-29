export default function MobileUnavailable({ pageName = 'Cette page' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        backgroundColor: '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none"
          stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2"/>
        </svg>
      </div>
      <p className="text-base font-semibold text-gray-700 mb-2">
        {pageName} n'est pas disponible sur mobile
      </p>
      <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
        Ouvre cette page depuis un ordinateur pour accéder à toutes les fonctionnalités.
      </p>
    </div>
  )
}
