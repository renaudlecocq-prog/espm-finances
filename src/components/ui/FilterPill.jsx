import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * FilterPill — compact pill dropdown for table filters
 * Props:
 *   label    : string  — column/filter name shown when empty
 *   value    : string  — current selected value ('' = none)
 *   options  : string[] — list of selectable options
 *   onChange : (val: string) => void
 */
export default function FilterPill({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const active = !!value

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 rounded-full border text-xs font-medium
          px-3 py-1.5 whitespace-nowrap transition-colors select-none
          ${active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
          }`}
      >
        {active
          ? <><span className="opacity-60">{label}</span>&nbsp;·&nbsp;{value}</>
          : label}
        <ChevronDown size={11} className={active ? 'text-primary' : 'text-gray-400 dark:text-gray-500'} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600
          rounded-xl shadow-lg min-w-[180px] max-h-56 overflow-y-auto py-1">
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Tous
          </button>
          {options.map(v => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 leading-snug
                ${value === v ? 'text-primary font-semibold' : 'text-gray-700 dark:text-gray-200'}`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
