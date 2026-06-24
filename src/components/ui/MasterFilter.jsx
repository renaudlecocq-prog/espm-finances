import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'

/**
 * MasterFilter — dropdown panel with checkbox multi-select per column
 *
 * Props:
 *   filters    : { [key]: string[] }   — active values per column
 *   filterDefs : { key, label, options: string[] | {value,label}[] }[]
 *   onChange   : (key: string, val: string) => void  — toggles val in/out
 *   onClearAll : () => void
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

/** Custom checkbox — nettement plus lisible que le HTML natif */
function Checkbox({ checked }) {
  return (
    <span
      aria-hidden="true"
      className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
        checked ? 'bg-primary border-primary' : 'bg-white border-gray-400'
      }`}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

export default function MasterFilter({ filters, filterDefs, onChange, onClearAll, dark = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const totalActive = filterDefs.reduce((n, d) => n + getSelected(filters, d.key).length, 0)
  const cols   = filterDefs.length === 1 ? 1 : 2
  const panelW = filterDefs.length === 1 ? 220
               : filterDefs.length <= 2  ? 360
               : filterDefs.length <= 5  ? 460
               : 560

  return (
    <div ref={ref} className="relative shrink-0">

      {/* ── Trigger ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 whitespace-nowrap transition-colors select-none ${
          dark
            ? 'rounded-lg ' + (totalActive > 0 ? 'text-white' : 'text-white/60 hover:text-white/90')
            : 'rounded-full border ' + (totalActive > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800')
        }`}
        style={dark ? { backgroundColor: `rgba(255,255,255,${totalActive > 0 ? '0.18' : '0.10'})`, border: `1px solid rgba(255,255,255,${totalActive > 0 ? '0.25' : '0.12'})` } : {}}
      >
        <SlidersHorizontal size={12} />
        Filtres
        {totalActive > 0 && (
          <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none ${dark ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
            {totalActive}
          </span>
        )}
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${totalActive > 0 ? 'text-primary' : 'text-gray-400'}`} />
      </button>

      {/* ── Panel ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
          style={{ width: panelW }}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <SlidersHorizontal size={12} className="text-gray-400" /> Filtrer par colonne
            </span>
            {totalActive > 0 && (
              <button onClick={() => { onClearAll(); setOpen(false) }}
                className="text-xs text-red-400 hover:text-red-600 font-medium flex items-center gap-1 transition-colors">
                <X size={11} /> Tout effacer
              </button>
            )}
          </div>

          {/* Grid of filter columns */}
          <div className="grid gap-x-4 gap-y-4 p-4"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {filterDefs.map(def => {
              const opts     = def.options || []
              const selected = getSelected(filters, def.key)
              const count    = selected.length

              return (
                <div key={def.key}>
                  {/* Column header */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: count > 0 ? '#2D1B2E' : '#6b7280' }}
                    >
                      {def.label}
                    </span>
                    {count > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Options list */}
                  <div
                    className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden"
                    style={{ maxHeight: opts.length > 7 ? 196 : 'none', overflowY: opts.length > 7 ? 'auto' : 'visible' }}
                  >
                    {opts.length === 0
                      ? <p className="text-xs text-gray-400 px-3 py-2">—</p>
                      : opts.map(o => {
                          const val     = isObj(opts) ? o.value : o
                          const lbl     = isObj(opts) ? o.label  : o
                          const checked = selected.includes(val)
                          return (
                            <label
                              key={val}
                              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors select-none ${
                                checked ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {/* Accessibility: input caché, visual custom */}
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onChange(def.key, val)}
                                className="sr-only"
                              />
                              <Checkbox checked={checked} />
                              <span className={`text-xs leading-snug ${checked ? 'font-medium' : ''}`}>{lbl}</span>
                            </label>
                          )
                        })
                    }
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {totalActive === 0 ? 'Aucun filtre actif'
                : `${totalActive} sélection${totalActive > 1 ? 's' : ''} active${totalActive > 1 ? 's' : ''}`}
            </span>
            <button onClick={() => setOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ActiveFilterChips — one chip per selected value, click × to deselect
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
