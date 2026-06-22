// Barre de titre sticky en haut de chaque page, fond sombre (cohérent avec la sidebar)
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div
      className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between gap-4"
      style={{ backgroundColor: '#2D1B2E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-screen-xl mx-auto w-full flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.50)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
