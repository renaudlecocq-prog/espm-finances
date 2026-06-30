import { useState, useRef, useEffect } from 'react'
import { Search, X, MoreHorizontal } from 'lucide-react'
import { isMobileDevice } from '../../lib/isMobile'

/**
 * PageHeader — desktop : ligne unique + overflow ⋯
 *             mobile  : bi-niveaux (titre+action / tabs / search+chips)
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
  // ── Mobile ─────────────────────────────────────────────────────────────────
  if (isMobileDevice) {
    return (
      <header
        className="sticky top-0 z-40 bg-[#2D1B2E] px-4 pb-3.5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Ligne 1 — titre + action principale */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[23px] font-bold text-white leading-none tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-[12.5px] mt-1 truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{subtitle}</p>}
            {info && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{info}</p>}
          </div>
          {/* Bouton d'action principal (premier de `actions`) */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {actions}
            </div>
          )}
        </div>

        {/* Ligne 2 — tabs scrollables */}
        {tabs && (
          <div className="flex gap-2 mt-3.5 overflow-x-auto no-scrollbar">
            {tabs.map(t => {
              const isActive = activeTab === t.key
              return (
                <button key={t.key}
                  onClick={() => onTabChange?.(t.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-[#2D1B2E] font-semibold'
                      : 'bg-white/10 text-white/60 font-normal'
                  }`}>
                  {t.label}
                  {t.count !== undefined && (
                    <span className={`text-xs font-bold tabular-nums ${
                      isActive
                        ? t.color === 'orange' ? 'text-orange-500'
                          : t.color === 'red'  ? 'text-red-500'
                          : 'text-emerald-600'
                        : 'text-white/40'
                    }`}>{t.count}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Ligne 3 — chips de filtre (leftActions) OU barre de recherche */}
        {leftActions && (
          <div className="flex gap-2 mt-2.5 overflow-x-auto no-scrollbar">
            {leftActions}
          </div>
        )}
        {search !== undefined && (
          <div className="mt-2.5 flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.40)' }} />
              <input
                type="text"
                placeholder={searchPlaceholder || 'Rechercher…'}
                value={search}
                onChange={e => onSearch?.(e.target.value)}
                className="w-full pl-8 pr-8 py-2.5 text-sm rounded-xl text-white outline-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              {search && (
                <button onClick={() => onSearch?.('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-55">
                  <X size={13} className="text-white" />
                </button>
              )}
            </div>
            {filters && <div className="shrink-0 flex items-center">{filters}</div>}
          </div>
        )}
        {/* filters seuls sans search (ex: dropdown classe) */}
        {search === undefined && filters && (
          <div className="mt-2.5">
            {filters}
          </div>
        )}
      </header>
    )
  }

  // ── Desktop (original) ─────────────────────────────────────────────────────
  const centerRef  = useRef(null)
  const menuRef    = useRef(null)
  const moreRef    = useRef(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)

  useEffect(() => {
    const el = centerRef.current
    if (!el) return
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 2)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    check()
    return () => ro.disconnect()
  }, [leftActions, tabs, search, filters, info])

  useEffect(() => {
    if (!menuOpen) return
    const handler = e => { if (!menuRef.current?.contains(e.target) && !moreRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const tabColor = (t, active) => {
    if (!active) return 'text-white/60 hover:text-white/90'
    if (t.color === 'orange') return 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 shadow-sm'
    if (t.color === 'red')    return 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
    return 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 shadow-sm'
  }
  const countColor = (t, active) => {
    if (!active) return { color: 'rgba(255,255,255,0.38)' }
    if (t.color === 'orange') return { color: '#ea580c' }
    if (t.color === 'red')    return { color: '#dc2626' }
    return { color: '#15803d' }
  }

  const hasCenter = leftActions || tabs || search !== undefined || filters || info

  const renderTabsWidget = (closeOnClick = false) => !tabs ? null : (
    <div style={{ display:'flex', alignItems:'center', padding:'2px', borderRadius:'8px', backgroundColor:'rgba(255,255,255,0.10)', flexShrink:0 }}>
      {tabs.map(t => (
        <button key={t.key}
          onClick={() => { onTabChange?.(t.key); if (closeOnClick) setMenuOpen(false) }}
          className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${tabColor(t, activeTab === t.key)}`}>
          {t.label}
          {t.count !== undefined && (
            <span className="text-xs font-semibold tabular-nums" style={countColor(t, activeTab === t.key)}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )

  const renderSearchWidget = (fullWidth = false) => search === undefined ? null : (
    <div style={{ position:'relative', width: fullWidth ? '100%' : '190px', flexShrink: fullWidth ? undefined : 0 }}>
      <Search size={12} style={{ position:'absolute', left:'9px', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.40)', pointerEvents:'none' }} />
      <input type="text"
        placeholder={searchPlaceholder || 'Rechercher…'}
        value={search}
        onChange={e => onSearch?.(e.target.value)}
        style={{ width:'100%', paddingLeft:'27px', paddingRight:'24px', paddingTop:'5px', paddingBottom:'5px',
          fontSize:'12px', borderRadius:'8px', backgroundColor:'rgba(255,255,255,0.09)',
          border:'1px solid rgba(255,255,255,0.11)', color:'white', outline:'none' }}
      />
      {search && (
        <button onClick={() => onSearch?.('')}
          style={{ position:'absolute', right:'7px', top:'50%', transform:'translateY(-50%)', opacity:0.55 }}>
          <X size={11} style={{ color:'white' }} />
        </button>
      )}
    </div>
  )

  const sep = (mr = 0, ml = 0) => (
    <div style={{ width:'1px', height:'20px', backgroundColor:'rgba(255,255,255,0.14)', flexShrink:0, marginLeft:ml, marginRight:mr }} />
  )

  return (
    <div className="sticky top-0 z-40" style={{ backgroundColor:'#2D1B2E', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', height:'48px', paddingLeft:'16px', paddingRight:'12px', gap:'0px', overflow:'hidden' }}>
        <div style={{ flexShrink:0, maxWidth:'220px', marginRight:'12px' }}>
          <h1 className="text-sm font-bold text-white leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[10px] leading-tight truncate" style={{ color:'rgba(255,255,255,0.42)' }}>{subtitle}</p>}
        </div>
        {hasCenter && sep(12)}
        {hasCenter && (
          <div ref={centerRef} style={{ flex:'1 1 0', display:'flex', alignItems:'center', gap:'8px', overflow:'hidden', minWidth:0 }}>
            {leftActions  && <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>{leftActions}</div>}
            {renderTabsWidget()}
            {renderSearchWidget()}
            {filters      && <div style={{ flexShrink:0 }}>{filters}</div>}
            {info         && <span style={{ fontSize:'11px', whiteSpace:'nowrap', color:'rgba(255,255,255,0.40)', flexShrink:0 }}>{info}</span>}
          </div>
        )}
        {hasCenter && (
          <button ref={moreRef} onClick={() => setMenuOpen(v => !v)}
            style={{ flexShrink:0, marginLeft:'4px', width:'28px', height:'28px', borderRadius:'8px',
              display:'flex', alignItems:'center', justifyContent:'center',
              backgroundColor: menuOpen ? 'rgba(255,255,255,0.14)' : 'transparent',
              border:'1px solid transparent', opacity: hasOverflow ? 1 : 0,
              pointerEvents: hasOverflow ? 'auto' : 'none', transition:'opacity 0.15s',
              cursor:'pointer', color:'rgba(255,255,255,0.75)' }}
            title="Plus d'options">
            <MoreHorizontal size={15} />
          </button>
        )}
        {actions && (
          <>
            {hasCenter && sep(0, 10)}
            <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0, marginLeft: hasCenter ? '10px' : 'auto' }}>
              {actions}
            </div>
          </>
        )}
      </div>
      {menuOpen && hasOverflow && (
        <div ref={menuRef}
          style={{ position:'absolute', left:0, right:0, top:'100%', backgroundColor:'#2D1B2E',
            borderBottom:'2px solid rgba(255,255,255,0.10)', boxShadow:'0 12px 32px rgba(0,0,0,0.35)',
            padding:'10px 16px 12px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:'8px', zIndex:50 }}>
          {leftActions  && <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>{leftActions}</div>}
          {renderTabsWidget(true)}
          {renderSearchWidget()}
          {filters      && <div>{filters}</div>}
          {info         && <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.50)' }}>{info}</span>}
        </div>
      )}
    </div>
  )
}
