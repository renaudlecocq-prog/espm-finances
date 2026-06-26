import { Search, X } from 'lucide-react'

/**
 * PageHeader — lignes adaptatives
 *
 * 1 ligne  : [titre + subtitle ···· actions] [toolbar]   quand tout rentre
 * 2 lignes : [titre + subtitle ···· actions]              quand le toolbar est trop large
 *            [toolbar ···················]
 *
 * Le toolbar scrolle horizontalement si nécessaire (jamais de 3e ligne).
 *
 * Props :
 *   title, subtitle
 *   leftActions   ReactNode
 *   tabs          [{ key, label, count?, color? }]
 *   activeTab, onTabChange
 *   search, onSearch, searchPlaceholder
 *   filters       ReactNode
 *   info          string
 *   actions       ReactNode  (toujours avec le titre, à droite)
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
      <div
        className="px-4"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: '12px',
          rowGap: '6px',
          paddingTop: '8px',
          paddingBottom: '8px',
        }}
      >
        {/* ── Titre + actions — toujours sur la même ligne ── */}
        <div
          style={{
            flex: '1 1 200px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
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

        {/* ── Toolbar — se place à droite si ça rentre, sinon descend en 2e ligne ── */}
        {hasToolbar && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              maxWidth: '100%',
              overflowX: 'auto',
              overflowY: 'visible',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {leftActions && (
              <div style={{ flexShrink: 0 }}>{leftActions}</div>
            )}

            {tabs && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  flexShrink: 0,
                }}
              >
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => onTabChange?.(t.key)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${tabColor(t, activeTab === t.key)}`}
                  >
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
              <div style={{ position: 'relative', width: '200px', flexShrink: 0 }}>
                <Search
                  size={12}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.40)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder={searchPlaceholder || 'Rechercher…'}
                  value={search}
                  onChange={e => onSearch?.(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '28px',
                    paddingRight: '24px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'white',
                    outline: 'none',
                  }}
                />
                {search && (
                  <button
                    onClick={() => onSearch?.('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}
                  >
                    <X size={11} style={{ color: 'white' }} />
                  </button>
                )}
              </div>
            )}

            {filters && <div style={{ flexShrink: 0 }}>{filters}</div>}

            {info && (
              <span
                style={{
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  color: 'rgba(255,255,255,0.45)',
                  flexShrink: 0,
                }}
              >
                {info}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
