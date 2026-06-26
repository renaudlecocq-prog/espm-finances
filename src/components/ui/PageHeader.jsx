import { Search, X } from 'lucide-react'

/**
 * PageHeader — ligne unique
 *
 * [Titre · subtitle] | [leftActions] [tabs] [search] [filters] [info] → → → [actions]
 * └─── fixe ─────┘   └───────────── scrollable (centre) ──────────────┘   └─ fixe ──┘
 *
 * Props :
 *   title, subtitle
 *   leftActions   ReactNode  — ex: bouton Retour, sélecteur de vue
 *   tabs          [{ key, label, count?, color? }]
 *   activeTab, onTabChange
 *   search, onSearch, searchPlaceholder
 *   filters       ReactNode
 *   info          string
 *   actions       ReactNode  — actions primaires de la page (toujours à droite)
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

  const hasCenter = leftActions || tabs || search !== undefined || filters || info

  return (
    <div
      className="sticky top-0 z-40"
      style={{
        backgroundColor: '#2D1B2E',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0px',
          height: '48px',
          paddingLeft: '16px',
          paddingRight: '12px',
          overflow: 'hidden',
        }}
      >
        {/* ── Titre (fixe à gauche) ── */}
        <div style={{ flexShrink: 0, minWidth: 0, maxWidth: '220px', marginRight: '12px' }}>
          <h1 className="text-sm font-bold text-white leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-[10px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.42)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* ── Séparateur titre / centre ── */}
        {hasCenter && (
          <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.14)', flexShrink: 0, marginRight: '12px' }} />
        )}

        {/* ── Zone centrale scrollable : leftActions + tabs + search + filters + info ── */}
        {hasCenter && (
          <div
            style={{
              flex: '1 1 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              overflowY: 'visible',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              minWidth: 0,
            }}
          >
            {leftActions && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>{leftActions}</div>}

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
              <div style={{ position: 'relative', width: '190px', flexShrink: 0 }}>
                <Search
                  size={12}
                  style={{
                    position: 'absolute', left: '9px', top: '50%',
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
                    paddingLeft: '27px', paddingRight: '24px',
                    paddingTop: '5px', paddingBottom: '5px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.09)',
                    border: '1px solid rgba(255,255,255,0.11)',
                    color: 'white',
                    outline: 'none',
                  }}
                />
                {search && (
                  <button
                    onClick={() => onSearch?.('')}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', opacity: 0.55 }}
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
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  color: 'rgba(255,255,255,0.40)',
                  flexShrink: 0,
                }}
              >
                {info}
              </span>
            )}
          </div>
        )}

        {/* ── Actions (fixe à droite) ── */}
        {actions && (
          <>
            {hasCenter && (
              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.14)', flexShrink: 0, marginLeft: '12px' }} />
            )}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                flexShrink: 0, marginLeft: hasCenter ? '10px' : 'auto',
              }}
            >
              {actions}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
