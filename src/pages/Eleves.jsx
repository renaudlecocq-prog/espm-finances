import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DataTable from '../components/ui/DataTable'
import FicheEleve from '../components/ui/FicheEleve'

const fmt = n => Number(n||0).toFixed(2) + ' €'

export default function Eleves() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [ficheId, setFicheId] = useState(null)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    let q = supabase.from('eleves').select('*').order('nom')
    const solde = searchParams.get('solde')
    if (solde === 'negatif') q = q.lt('solde', 0)
    else if (solde === 'positif') q = q.gt('solde', 0)
    else q = q.eq('actif', true)
    q.then(({ data }) => { setData(data || []); setLoading(false) })
  }, [searchParams])

  const uniq = key => [...new Set(data.map(r => String(r[key] ?? '')))].sort()

  const columns = [
    { key: 'nom', label: 'Nom', width: 150 },
    { key: 'prenom', label: 'Prénom', width: 150 },
    { key: 'classe', label: 'Classe', width: 100 },
    { key: 'solde', label: 'Solde', render: v => <span className={Number(v||0)<0?'text-red-600 font-semibold':'text-green-600'}>{fmt(v)}</span> },
  ]

  const multiFilters = [
    { key: 'classe', label: 'Classe', options: uniq('classe') },
  ]

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Élèves</h1>
      <DataTable columns={columns} data={data} multiFilters={multiFilters} stickyColumns={2} onRowClick={row => setFicheId(row.id)} />
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  )
}
