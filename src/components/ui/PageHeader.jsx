import { Search, X } from 'lucide-react'

/**
 * PageHeader — 2 lignes fixes strictes, fond sidebar (#2D1B2E)
 *
 * Ligne 1 (TOUJOURS 1 ligne, no-wrap) :
 *   [titre + subtitle] ········ [actions]
 *
 * Ligne 2 (si contenu, TOUJOURS 1 ligne, scroll horizontal silencieux) :
 *   [leftActions] [tabs] [search] [filters] [info]
 *
 * Jamais de 3e ligne.
 *
 * Props :
 *   title, subtitle
 *   leftActions   ReactNode
 *   tabs          [{ key, label, count?, color? }]
 *   activeTab, onTabChange
 *   search, onSearch, searchPlaceholder
 *   filters       ReactNode
 *   info          string
 *   actions       ReactNode  (ligne 1, tout à droite)
 */
export default function PageHeader({
  title, subtitle,
  leftActions,
  tabs, activeTab, onTabChange,
  search, onSearch, searchPlaceholder,
  filters,
  info,
  actions,
}) {
  const tabColor = (t, active) => {
    if (!active) return 'text-white/60 hover:text-white/90'
    if (t.color === 'orange') return 'bg-white text-orange-600 shadow-sm'
    if (t.color === 'red')    return 'bg-white text-red-600 shadow-sm'
    return 'bg-white text-green-700 shadow-sm'
  }
  const countColor = (t, active) => {
    if (!active) return { color: 'rgba(255,255,255,0.38)' }
    if (t.color === 'orange') return { color: '#ea580c' }
    if (t.color === 'red')    return { color: '#dc2626' }
    return { color: '#15803d' }
  }

  const hasToolbar = leftActions || tabs || search !== undefined || filters || info

  return (
    <div
      className="sticky top-0 z-40"
      style={{ backgroundColor: '#2D1B2E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* ── Ligne 1 : titre + actions — 1 ligne stricte ── */}
      <div
        className="flex items-center gap-3 px-4"
        style={{
          flexWrap: 'nowrap',
          minHeight: hasToolbar ? '42px' : '50px',
          paddingTop: hasToolbar ? '10px' : '12px',
          paddingBottom: hasToolbar ? '4px' : '12px',
        }}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-white leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs leading-tight truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* ── Ligne 2 : toolbar — 1 ligne, scroll horizontal si besoin ── */}
      {hasToolbar && (
        <div
          className="flex items-center gap-2 px-4 pb-2.5"
          style={{
            flexWrap: 'nowrap',
            overflowX: 'auto',
            overflowY: 'visible',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >

          {leftActions && (
            <div className="shrink-0 flex items-center">{leftActions}</div>
          )}

          {tabs && (
            <div className="flex items-center p-0.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => onTabChange?.(t.key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${tabColor(t, activeTab === t.key)}`}>
                  {t.label}
                  {t.count !== undefined && (
                    <span className="text-xs font-semibold tabular-nums" style={countColor(t, activeTab === t.key)}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {search !== undefined && (
            <div className="relative shrink-0" style={{ width: '200px' }}>
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.40)' }} />
              <input
                type="text"
                placeholder={searchPlaceholder || 'Rechercher…'}
                value={search}
                onChange={e => onSearch?.(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 text-xs rounded-lg focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
              />
              {search && (
                <button onClick={() => onSearch?.('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity">
                  <X size={11} className="text-white" />
                </button>
              )}
            </div>
          )}

          {filters && <div className="shrink-0">{filters}</div>}

          {info && (
            <span className="text-xs whitespace-nowrap shrink-0"
              style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 'auto', paddingRight: '4px' }}>
              {info}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
