export default function StatCard({ icon: Icon, label, value, sub, color = 'primary', onClick }) {
  const colors = {
    primary:  'bg-primary text-white',
    accent:   'bg-accent text-white',
    green:    'bg-green-600 text-white',
    red:      'bg-red-600 text-white',
    blue:     'bg-blue-600 text-white',
    purple:   'bg-purple-600 text-white',
    orange:   'bg-orange-500 text-white',
    gray:     'bg-gray-200 text-primary',
  }
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-5 shadow-sm flex flex-col gap-3 ${colors[color]} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
    >
      <div className="flex items-start justify-between">
        {Icon && <div className="p-2 bg-white/20 rounded-lg"><Icon size={20} /></div>}
        {sub && <span className="text-xs opacity-70">{sub}</span>}
      </div>
      <div>
        <p className="text-2xl font-bold">{value ?? '—'}</p>
        <p className="text-sm opacity-80 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
