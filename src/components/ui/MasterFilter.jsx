import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'

/**
 * MasterFilter — dropdown panel with checkbox multi-select per column
 * Panel rendered via portal (position:fixed) to escape overflow:hidden parents
 */

const isObj = opts => opts?.length > 0 && typeof opts[0] === 'object'
const getDisplayLabel = (opts, val) => {
  if (!val) return ''
  return isObj(opts) ? (opts.find(o => o.value === val)?.label ?? val) : val
}
const getSelected = (filters, key) => {
  const v = filters[key]
  return Array.isArray(v) ? v : (v ? [v] : [])
}

export default function MasterFilter({ filters, filterDefs, onChange, onClearAll, dark = false }) {
  const [open, setOpen]       = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const btnRef    = useRef(null)
  const panelRef  = useRef(null)

  // Position panel under trigger button
  const openPanel = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPanelPos({ top: r.bottom + 8, left: r.left })
    }
    setOpen(o => !o)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const close = e => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Close on scroll or resize
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const totalActive = filterDefs.reduce((n, d) => n + getSelected(filters, d.key).length, 0)
  const cols   = filterDefs.length === 1 ? 1 : 2
  const panelW = filterDefs.length === 1 ? 220
               : filterDefs.length <= 2  ? 360
               : filterDefs.length <= 5  ? 460
               : 560

  const panel = open && createPortal(
    <div
      ref={panelRef}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl overflow-hidden"
      style={{ position:'fixed', top: panelPos.top, left: panelPos.left, width: panelW, zIndex: 9999 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-200 dark:border-gray-600">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <SlidersHorizontal size={12} className="text-gray-400 dark:text-gray-500" /> Filtrer par colonne
        </span>
        {totalActive > 0 && (
          <button onClick={() => { onClearAll(); setOpen(false) }}
            className="text-xs text-red-400 dark:text-red-300 hover:text-red-600 font-medium flex items-center gap-1 transition-colors">
            <X size={11} /> Tout effacer
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-x-4 gap-y-4 p-4"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, maxHeight:'70vh', overflowY:'auto' }}>
        {filterDefs.map(def => {
          const opts     = def.options || []
          const selected = getSelected(filters, def.key)
          const count    = selected.length

          return (
            <div key={def.key}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: count > 0 ? '#2D1B2E' : '#6b7280' }}>
                  {def.label}
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                    {count}
                  </span>
                )}
              </div>

              <div
                className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden"
                style={{ maxHeight: opts.length > 7 ? 196 : 'none', overflowY: opts.length > 7 ? 'auto' : 'visible' }}
              >
                {opts.length === 0
                  ? <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">—</p>
                  : opts.map((o, i) => {
                      const val     = isObj(opts) ? o.value : o
                      const lbl     = isObj(opts) ? o.label  : o
                      const checked = selected.includes(val)
                      return (
                        <div
                          key={val}
                          onClick={() => onChange(def.key, val)}
                          className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none transition-colors ${
                            i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                          } ${checked ? 'bg-primary/10 text-primary' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                          <span style={{
                            flexShrink: 0, width: 16, height: 16, borderRadius: 3,
                            border: checked ? '2px solid #2D1B2E' : '2px solid #6b7280',
                            backgroundColor: checked ? '#2D1B2E' : '#ffffff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.1s',
                          }}>
                            {checked && (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className={`text-xs leading-snug ${checked ? 'font-medium' : ''}`}>{lbl}</span>
                        </div>
                      )
                    })
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {totalActive === 0 ? 'Aucun filtre actif'
            : `${totalActive} sélection${totalActive > 1 ? 's' : ''} active${totalActive > 1 ? 's' : ''}`}
        </span>
        <button onClick={() => setOpen(false)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 font-medium transition-colors bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-gray-300 rounded-lg px-3 py-1">
          Fermer
        </button>
      </div>
    </div>,
    document.body
  )

  return (
    <div className="relative shrink-0">
      {/* ── Trigger ── */}
      <button
        ref={btnRef}
        onClick={openPanel}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 whitespace-nowrap transition-colors select-none ${
          dark
            ? 'rounded-lg ' + (totalActive > 0 ? 'text-white' : 'text-white/60 hover:text-white/90')
            : 'rounded-full border ' + (totalActive > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 hover:text-gray-800 dark:hover:text-gray-100')
        }`}
        style={dark ? { backgroundColor: `rgba(255,255,255,${totalActive > 0 ? '0.18' : '0.10'})`, border: `1px solid rgba(255,255,255,${totalActive > 0 ? '0.25' : '0.12'})` } : {}}
      >
        <SlidersHorizontal size={12} />
        Filtres
        {totalActive > 0 && (
          <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none ${dark ? 'bg-white dark:bg-gray-800 text-primary' : 'bg-primary text-white'}`}>
            {totalActive}
          </span>
        )}
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${totalActive > 0 ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`} />
      </button>

      {panel}
    </div>
  )
}

/**
 * ActiveFilterChips
 */
export function ActiveFilterChips({ filters, filterDefs, onChange }) {
  const items = []
  filterDefs.forEach(def => {
    getSelected(filters, def.key).forEach(val =>
      items.push({ def, val, displayVal: getDisplayLabel(def.options || [], val) })
    )
  })
  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
      {items.map(({ def, val, displayVal }) => (
        <span key={`${def.key}:${val}`}
          className="inline-flex items-center gap-1 rounded-full border text-xs px-2.5 py-1 font-medium bg-primary/10 border-primary/20 text-primary">
          <span className="opacity-60 font-normal">{def.label} ·</span> {displayVal}
          <button
            onClick={() => onChange(def.key, val)}
            className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
            aria-label={`Retirer ${def.label}: ${displayVal}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  )
}
