import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'

const ALL_CLASSES = [
  '1Hunters','1Piraterie','1Samourais','1Simpson',
  '2 Avengers','2 Golden eagles','2 Mugiwaras','2 Protège-tibias',
  '3Agora','3Atlantide','3Estrelas','3Shadow','3Sinaloa','AC Shinigamis',
  '4 Casa del Papel','4 Celestials','4 Cosa Nostra','4 Inconnus','4 Korczak',
  '5Aurora','5Miyazaki','5Nova-Corp','5Suenos','5Visionnaires',
  '6 Astreons','6 OPPS','6 Raspipas','6 Zion',
]

export default function ClassesSelect({ value = [], onChange, disabled }) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const ref                  = useRef()
  const inputRef             = useRef()

  useEffect(() => {
    function onClickOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [])

  const filtered = ALL_CLASSES.filter(c =>
    c.toLowerCase().includes(query.toLowerCase()) && !value.includes(c)
  )

  function add(cls) {
    onChange([...value, cls])
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(cls) {
    onChange(value.filter(c => c !== cls))
  }

  return (
    <div ref={ref} className="relative">
      <div
        className={`input min-h-[38px] flex flex-wrap gap-1 items-center cursor-text ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        {value.map(cls => (
          <span key={cls} className="inline-flex items-center gap-1 bg-accent-light text-primary text-xs px-2 py-0.5 rounded-full">
            {cls}
            <button type="button" onClick={e => { e.stopPropagation(); remove(cls) }} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
          placeholder={value.length === 0 ? 'Rechercher une classe…' : ''}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={14} className="text-primary-lighter shrink-0" />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-accent rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(cls => (
            <button
              key={cls} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface text-primary"
              onMouseDown={e => { e.preventDefault(); add(cls) }}
            >
              {cls}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
