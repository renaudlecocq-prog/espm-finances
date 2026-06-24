import { Search, X } from 'lucide-react'

/**
 * PageHeader — barre single-row sticky, fond sidebar (#2D1B2E)
 * Layout : [titre+subtitle] [leftActions] [tabs] [search flex-1] [filters] [info] [actions]
 *
 * Props:
 *   title, subtitle
 *   leftActions   ReactNode
 *   tabs          [{ key, label, count?, color? }]  color: 'orange'|'red'
 *   activeTab     string
 *   onTabChange   fn
 *   search        string     — contrôlé (undefined = pas d'input)
 *   onSearch      fn
 *   searchPlaceholder string
 *   filters       ReactNode
 *   info          string
 *   actions       ReactNode
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

  return (
    <div className="sticky top-0 z-40 flex items-center px-6 py-2 gap-2.5 flex-wrap"
      style={{ backgroundColor: '#2D1B2E', borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: '50px' }}>

      {/* Titre + sous-titre empilés à gauche */}
      <div className="shrink-0 mr-1">
        <h1 className="text-sm font-bold text-white leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Séparateur visuel si toolbar présente */}
      {(leftActions || tabs || search !== undefined || filters || info || actions) && (
        <div className="shrink-0 self-stretch w-px mx-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
      )}

      {leftActions && <div className="shrink-0">{leftActions}</div>}

      {tabs && (
        <div className="flex items-center p-0.5 rounded-lg shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => onTabChange?.(t.key)}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${tabColor(t, activeTab === t.key)}`}>
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
        <div className="relative flex-1" style={{ minWidth: '110px', maxWidth: '280px' }}>
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

      {info && !actions && (
        <span className="ml-auto text-xs whitespace-nowrap shrink-0"
          style={{ color: 'rgba(255,255,255,0.45)' }}>
          {info}
        </span>
      )}

      {actions && (
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {info && (
            <span className="text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {info}
            </span>
          )}
          {actions}
        </div>
      )}
    </div>
  )
}
