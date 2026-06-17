import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import DataTable from '../components/ui/DataTable'
import FicheEleve from '../components/ui/FicheEleve'

function Tag({ value }) {
  if (!value) return <span className="text-gray-300">—</span>
  return <span className="inline-block bg-primary-50 text-primary-700 rounded px-2 py-0.5 text-xs font-medium">{value}</span>
}

export default function Groupes() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)

  useEffect(() => {
    supabase.from('eleves').select('*').eq('actif', true).order('nom').then(({ data: rows }) => {
      const enriched = (rows || []).map(r => ({
        ...r,
        rlmo_computed: r.philosophie ? (r.groupe_choix_philo ? `${r.philosophie} ${r.groupe_choix_philo}` : r.philosophie) : null
      }))
      setData(enriched)
      setLoading(false)
    })
  }, [])

  const uniq = key => [...new Set(data.map(r => String(r[key] ?? '')))].filter(Boolean).sort()

  const columns = [
    { key: 'nom', label: 'Nom', width: 140 },
    { key: 'prenom', label: 'Prénom', width: 140 },
    { key: 'classe', label: 'Classe', render: v => <Tag value={v} /> },
    { key: 'rlmo_computed', label: 'RLMO', render: v => <Tag value={v} /> },
    { key: 'obs_d2', label: 'OBS D2', render: v => <Tag value={v} /> },
    { key: 'ac_d2', label: 'AC D2', render: v => <Tag value={v} /> },
    { key: 'math_d3', label: 'Math D3', render: v => <Tag value={v} /> },
    { key: 'sciences_d3', label: 'Sciences D3', render: v => <Tag value={v} /> },
    { key: 'bio_physique_d3', label: 'Bio/Physique D3', render: v => <Tag value={v} /> },
    { key: 'obs1_d3', label: 'OBS 1 D3', render: v => <Tag value={v} /> },
    { key: 'obs2_d3', label: 'OBS 2 D3', render: v => <Tag value={v} /> },
    { key: 'ac_d3', label: 'AC D3', render: v => <Tag value={v} /> },
  ]

  const multiFilters = [
    { key: 'classe', label: 'Classe', options: uniq('classe') },
    { key: 'rlmo_computed', label: 'RLMO', options: uniq('rlmo_computed') },
    { key: 'obs_d2', label: 'OBS D2', options: uniq('obs_d2') },
    { key: 'ac_d2', label: 'AC D2', options: uniq('ac_d2') },
    { key: 'math_d3', label: 'Math D3', options: uniq('math_d3') },
    { key: 'sciences_d3', label: 'Sciences D3', options: uniq('sciences_d3') },
    { key: 'bio_physique_d3', label: 'Bio/Physique D3', options: uniq('bio_physique_d3') },
    { key: 'obs1_d3', label: 'OBS 1 D3', options: uniq('obs1_d3') },
    { key: 'obs2_d3', label: 'OBS 2 D3', options: uniq('obs2_d3') },
    { key: 'ac_d3', label: 'AC D3', options: uniq('ac_d3') },
  ]

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Groupes</h1>
      <DataTable columns={columns} data={data} multiFilters={multiFilters} stickyColumns={2} onRowClick={row => setFicheId(row.id)} />
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}
