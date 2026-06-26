import { useState, useRef, useEffect } from 'react'
import { Search, X, MoreHorizontal } from 'lucide-react'

/**
 * PageHeader — ligne unique, overflow par menu "⋯"
 *
 * [Titre] | [leftActions] [tabs] [search] [filters] [info] ··· [⋯] | [actions]
 *  fixe       scrollable centre (overflow:hidden) + bouton ⋯ si ça dépasse     fixe
 *
 * Quand le centre déborde → bouton ⋯ apparaît → dropdown avec tous les items
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
  const centerRef  = useRef(null)
  const menuRef    = useRef(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)

  // Détection overflow dans la zone centrale
  useEffect(() => {
    const el = centerRef.current
    if (!el) return
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 2)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    check()
    return () => ro.disconnect()
  }, [leftActions, tabs, search, filters, info])

  // Fermer le menu si clic en dehors
  useEffect(() => {
    if (!menuOpen) return
    const handler = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

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

      {/* ── Barre principale ── */}
      <div style={{ display:'flex', alignItems:'center', height:'48px', paddingLeft:'16px', paddingRight:'12px', gap:'0px', overflow:'hidden' }}>

        {/* Titre */}
        <div style={{ flexShrink:0, maxWidth:'220px', marginRight:'12px' }}>
          <h1 className="text-sm font-bold text-white leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[10px] leading-tight truncate" style={{ color:'rgba(255,255,255,0.42)' }}>{subtitle}</p>}
        </div>

        {hasCenter && sep(12)}

        {/* Zone centrale — overflow:hidden, le bouton ⋯ prend toujours la place */}
        {hasCenter && (
          <div ref={centerRef} style={{ flex:'1 1 0', display:'flex', alignItems:'center', gap:'8px', overflow:'hidden', minWidth:0 }}>
            {leftActions  && <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>{leftActions}</div>}
            {renderTabsWidget()}
            {renderSearchWidget()}
            {filters      && <div style={{ flexShrink:0 }}>{filters}</div>}
            {info         && <span style={{ fontSize:'11px', whiteSpace:'nowrap', color:'rgba(255,255,255,0.40)', flexShrink:0 }}>{info}</span>}
          </div>
        )}

        {/* Bouton ⋯ — toujours dans le DOM pour stabiliser le layout, visible seulement si overflow */}
        {hasCenter && (
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              flexShrink:0, marginLeft:'4px',
              width:'28px', height:'28px', borderRadius:'8px',
              display:'flex', alignItems:'center', justifyContent:'center',
              backgroundColor: menuOpen ? 'rgba(255,255,255,0.14)' : 'transparent',
              border:'1px solid transparent',
              opacity: hasOverflow ? 1 : 0,
              pointerEvents: hasOverflow ? 'auto' : 'none',
              transition:'opacity 0.15s',
              cursor:'pointer',
              color:'rgba(255,255,255,0.75)',
            }}
            title="Plus d'options"
          >
            <MoreHorizontal size={15} />
          </button>
        )}

        {/* Actions */}
        {actions && (
          <>
            {hasCenter && sep(0, 10)}
            <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0, marginLeft: hasCenter ? '10px' : 'auto' }}>
              {actions}
            </div>
          </>
        )}
      </div>

      {/* ── Dropdown overflow ── */}
      {menuOpen && hasOverflow && (
        <div ref={menuRef}
          style={{
            position:'absolute', left:0, right:0, top:'100%',
            backgroundColor:'#2D1B2E',
            borderBottom:'2px solid rgba(255,255,255,0.10)',
            boxShadow:'0 12px 32px rgba(0,0,0,0.35)',
            padding:'10px 16px 12px',
            display:'flex', flexWrap:'wrap', alignItems:'center', gap:'8px',
            zIndex:50,
          }}
        >
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
