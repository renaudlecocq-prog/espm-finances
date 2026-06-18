import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'

/**
 * MasterFilter — single dropdown panel regrouping all table filters
 *
 * Props:
 *   filters    : { [key]: string }  — current active values ('' = none)
 *   filterDefs : { key, label, options: string[] | {value,label}[] }[]
 *   onChange   : (key: string, val: string) => void  ('' to clear)
 *   onClearAll : () => void
 */

const isObj  = opts => opts?.length > 0 && typeof opts[0] === 'object'
const getDisplayLabel = (opts, val) => {
  if (!val) return ''
  return isObj(opts) ? (opts.find(o => o.value === val)?.label || val) : val
}

export default function MasterFilter({ filters, filterDefs, onChange, onClearAll }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const activeCount = filterDefs.filter(d => !!filters[d.key]).length
  const cols = filterDefs.length === 1 ? 1 : 2
  const panelW = filterDefs.length === 1 ? 240 : filterDefs.length <= 2 ? 340 : filterDefs.length <= 4 ? 400 : 460

  return (
    <div ref={ref} className="relative shrink-0">

      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-medium
          px-3 py-1.5 whitespace-nowrap transition-colors select-none
          ${activeCount > 0
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'
          }`}
      >
        <SlidersHorizontal size={12} />
        Filtres
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full
            bg-primary text-white text-[10px] font-bold leading-none">
            {activeCount}
          </span>
        )}
        <ChevronDown size={11}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${activeCount > 0 ? 'text-primary' : 'text-gray-400'}`}
        />
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200
          rounded-2xl shadow-xl overflow-hidden"
          style={{ width: panelW }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <SlidersHorizontal size={12} className="text-gray-400" />
              Filtrer par colonne
            </span>
            {activeCount > 0 && (
              <button onClick={() => { onClearAll(); setOpen(false) }}
                className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium flex items-center gap-1">
                <X size={11} /> Tout effacer
              </button>
            )}
          </div>

          {/* Filter grid */}
          <div className={`grid gap-x-4 gap-y-3 p-4`}
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {filterDefs.map(def => {
              const active = !!filters[def.key]
              const opts   = def.options || []
              return (
                <div key={def.key}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5 transition-colors"
                    style={{ color: active ? 'var(--color-primary, #4f46e5)' : '#9ca3af' }}>
                    {def.label}
                  </label>
                  <div className="relative">
                    <select
                      value={filters[def.key] || ''}
                      onChange={e => onChange(def.key, e.target.value)}
                      className={`w-full rounded-lg border text-xs px-2.5 py-1.5 pr-6 outline-none
                        cursor-pointer appearance-none bg-white transition-all
                        ${active
                          ? 'border-primary/40 text-primary bg-primary/5 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <option value="">Tous</option>
                      {opts.map(o => {
                        const val = isObj(opts) ? o.value : o
                        const lbl = isObj(opts) ? o.label : o
                        return <option key={val} value={val}>{lbl}</option>
                      })}
                    </select>
                    <ChevronDown size={11}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none
                        ${active ? 'text-primary' : 'text-gray-400'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {activeCount === 0
                ? 'Aucun filtre actif'
                : `${activeCount} filtre${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`}
            </span>
            <button onClick={() => setOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors
                bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ActiveFilterChips — compact removable chips for active filters
 *
 * Props:
 *   filters    : { [key]: string }
 *   filterDefs : same as MasterFilter
 *   onChange   : (key, '') to remove one
 */
export function ActiveFilterChips({ filters, filterDefs, onChange }) {
  const entries = filterDefs.filter(d => !!filters[d.key])
  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
      {entries.map(def => {
        const val = filters[def.key]
        const displayVal = getDisplayLabel(def.options || [], val)
        return (
          <span key={def.key}
            className="inline-flex items-center gap-1 rounded-full border text-xs px-2.5 py-1 font-medium
              bg-primary/10 border-primary/20 text-primary">
            <span className="opacity-60 font-normal">{def.label} ·</span> {displayVal}
            <button
              onClick={() => onChange(def.key, '')}
              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
              aria-label={`Retirer le filtre ${def.label}`}
            >
              <X size={10} />
            </button>
          </span>
        )
      })}
    </div>
  )
}
