import { useState, useRef, useEffect } from 'react'

function DropdownFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && dropRef.current) {
      const rect = dropRef.current.getBoundingClientRect()
      setAlignRight(rect.right > window.innerWidth - 8)
    }
  }, [open])

  const active = selected.length > 0
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`btn btn-sm whitespace-nowrap ${active ? 'bg-primary-600 text-white border-primary-600' : 'btn-secondary'}`}
      >
        {label}
        {active && <span className="ml-1 bg-white/30 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">{selected.length}</span>}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div
          ref={dropRef}
          className={`absolute top-full mt-1 z-[200] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg min-w-[180px] max-h-64 overflow-y-auto ${alignRight ? 'right-0' : 'left-0'}`}
        >
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 border-b border-gray-100 dark:border-gray-700">
              Effacer la sélection
            </button>
          )}
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt])}
                className="rounded"
              />
              {opt || '—'}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DataTable({ columns, data, searchable = true, multiFilters = [], stickyColumns = 0, onRowClick }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [filterState, setFilterState] = useState(() => Object.fromEntries(multiFilters.map(f => [f.key, []])))

  const setFilter = (key, val) => setFilterState(prev => ({ ...prev, [key]: val }))
  const hasActiveFilters = search || multiFilters.some(f => (filterState[f.key] || []).length > 0)
  const clearAll = () => { setSearch(''); setFilterState(Object.fromEntries(multiFilters.map(f => [f.key, []]))) }

  let rows = [...(data || [])]

  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(row => columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q)))
  }

  multiFilters.forEach(f => {
    const sel = filterState[f.key] || []
    if (sel.length > 0) rows = rows.filter(row => sel.includes(String(row[f.key] ?? '')))
  })

  if (sort) {
    rows.sort((a, b) => {
      const av = a[sort] ?? '', bv = b[sort] ?? ''
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  const toggleSort = (key) => {
    if (sort === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setSortDir('asc') }
  }

  return (
    <div className="card p-0">
      {(searchable || multiFilters.length > 0) && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 items-center">
          {searchable && (
            <input
              className="input max-w-xs"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          {multiFilters.map(f => (
            <DropdownFilter
              key={f.key}
              label={f.label}
              options={f.options}
              selected={filterState[f.key] || []}
              onChange={val => setFilter(f.key, val)}
            />
          ))}
          {hasActiveFilters && (
            <button onClick={clearAll} className="btn btn-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50">
              Tout effacer
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{rows.length} résultat{rows.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap
                    ${col.sortable !== false ? 'cursor-pointer hover:text-gray-800 dark:hover:text-gray-100' : ''}
                    ${i < stickyColumns ? `sticky z-20 bg-gray-50 dark:bg-gray-900` : ''}`}
                  style={i < stickyColumns ? { left: columns.slice(0, i).reduce((a, c) => a + (c.width || 150), 0) } : {}}
                >
                  {col.label}
                  {sort === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Aucun résultat</td></tr>
            ) : rows.map((row, ri) => (
              <tr
                key={row.id ?? ri}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${i < stickyColumns ? 'sticky bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 z-10' : ''}`}
                    style={i < stickyColumns ? { left: columns.slice(0, i).reduce((a, c) => a + (c.width || 150), 0) } : {}}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
