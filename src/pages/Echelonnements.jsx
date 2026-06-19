import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/ui/DataTable'
import FicheEleve from '../components/ui/FicheEleve'
import { X, Trash2 } from 'lucide-react'

const fmt = n => Number(n||0).toFixed(2) + ' €'
const fmtDate = s => s ? new Date(s).toLocaleDateString('fr-BE') : '—'

const STATUT_COLORS = {
  en_cours:     'bg-blue-100 text-blue-700',
  non_respecte: 'bg-red-100 text-red-700',
  termine:      'bg-green-100 text-green-700',
}
const STATUT_LABELS = {
  en_cours:     'En cours',
  non_respecte: 'Non respecté',
  termine:      'Terminé',
}

function EchelonnementDetail({ row, onClose, onUpdated, isAllowed }) {
  const [form, setForm] = useState({
    statut:           row.statut || 'en_cours',
    montant:          row.montant != null ? String(row.montant) : '',
    nombre_echeances: row.nombre_echeances != null ? String(row.nombre_echeances) : '',
    date_debut:       row.date_debut || '',
    remarque:         row.remarque || '',
  })
  const [saving, setSaving]   = useState(false)
  const [ficheId, setFicheId] = useState(null)

  const hasChanges =
    form.statut !== row.statut ||
    Number(form.montant) !== Number(row.montant || 0) ||
    Number(form.nombre_echeances) !== Number(row.nombre_echeances || 0) ||
    form.date_debut !== (row.date_debut || '') ||
    (form.remarque || null) !== (row.remarque || null)

  const save = async () => {
    setSaving(true)
    const payload = {
      statut:           form.statut,
      montant:          form.montant !== '' ? Number(form.montant) : null,
      nombre_echeances: form.nombre_echeances !== '' ? Number(form.nombre_echeances) : null,
      date_debut:       form.date_debut || null,
      remarque:         form.remarque || null,
      updated_at:       new Date().toISOString(),
    }
    const { error } = await supabase.from('echelonnements').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onUpdated()
  }

  const del = async () => {
    if (!confirm('Supprimer cet échelonnement ?')) return
    await supabase.from('echelonnements').delete().eq('id', row.id)
    onUpdated()
    onClose()
  }

  const eleve = row.eleve || {}

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/25" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm bg-white shadow-2xl flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <div className="font-bold text-gray-800 text-base">
                {eleve.nom} {eleve.prenom}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{eleve.classe}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setFicheId(row.eleve_id)}
                className="text-xs text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-2.5 py-1 transition-colors">
                Fiche élève
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-1">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Statut */}
            <div>
              <label className="label">Statut</label>
              {isAllowed
                ? <select className="input" value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                    {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                : <span className={`badge ${STATUT_COLORS[form.statut] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUT_LABELS[form.statut] || form.statut}
                  </span>
              }
            </div>

            {/* Montant + Échéances */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Montant total (€)</label>
                {isAllowed
                  ? <input className="input" type="number" step="0.01" value={form.montant}
                      onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
                  : <div className="input bg-gray-50 text-gray-700">{fmt(form.montant)}</div>
                }
              </div>
              <div>
                <label className="label">Échéances</label>
                {isAllowed
                  ? <input className="input" type="number" min="1" value={form.nombre_echeances}
                      onChange={e => setForm(f => ({ ...f, nombre_echeances: e.target.value }))} />
                  : <div className="input bg-gray-50 text-gray-700">{form.nombre_echeances}</div>
                }
              </div>
            </div>

            {/* Date début */}
            <div>
              <label className="label">Date de début</label>
              {isAllowed
                ? <input className="input" type="date" value={form.date_debut}
                    onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
                : <div className="input bg-gray-50 text-gray-700">{fmtDate(form.date_debut)}</div>
              }
            </div>

            {/* Remarque */}
            <div>
              <label className="label">Remarque</label>
              {isAllowed
                ? <textarea className="input resize-none" rows={4} value={form.remarque}
                    onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))}
                    placeholder="Remarques…" />
                : <div className="input bg-gray-50 text-gray-700 min-h-[80px] whitespace-pre-wrap">
                    {form.remarque || <span className="text-gray-400 italic">Aucune remarque</span>}
                  </div>
              }
            </div>

            {/* Dates */}
            <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-100 pt-4">
              {row.created_at && <div>Créé le {fmtDate(row.created_at.slice(0, 10))}</div>}
              {row.updated_at && row.updated_at !== row.created_at &&
                <div>Modifié le {fmtDate(row.updated_at.slice(0, 10))}</div>}
            </div>
          </div>

          {/* Footer */}
          {isAllowed && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button onClick={del}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={13} /> Supprimer
              </button>
              <button onClick={save} disabled={saving || !hasChanges}
                className="btn-primary py-1.5 px-4 text-sm disabled:opacity-40">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>
      </div>
      <FicheEleve eleveId={ficheId} onClose={() => setFicheId(null)} />
    </>
  )
}

export default function Echelonnements() {
  const { isFinancier } = useAuth()
  const [data, setData]       = useState([])
  const [eleves, setEleves]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [detailId, setDetailId]   = useState(null)
  const [form, setForm] = useState({
    eleve_id: '', montant: '', nombre_echeances: 3,
    date_debut: new Date().toISOString().slice(0,10), remarque: '', statut: 'en_cours',
  })
  const [saving, setSaving] = useState(false)

  const reload = () =>
    supabase.from('echelonnements')
      .select('*, eleve:eleve_id(nom,prenom,classe)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setData(data || []))

  useEffect(() => {
    Promise.all([
      reload(),
      supabase.from('eleves').select('id,nom,prenom,classe').eq('actif', true).order('nom'),
    ]).then(([, e]) => { setEleves(e.data || []); setLoading(false) })
  }, []) // eslint-disable-line

  const save = async () => {
    setSaving(true)
    await supabase.from('echelonnements').insert(form)
    await reload()
    setSaving(false)
    setShowForm(false)
  }

  const columns = [
    { key: 'nom',              label: 'Nom',       render: (_, r) => r.eleve?.nom },
    { key: 'prenom',           label: 'Prénom',    render: (_, r) => r.eleve?.prenom },
    { key: 'classe',           label: 'Classe',    render: (_, r) => r.eleve?.classe },
    { key: 'montant',          label: 'Montant',   render: v => fmt(v) },
    { key: 'nombre_echeances', label: 'Échéances' },
    { key: 'date_debut',       label: 'Début' },
    { key: 'statut',           label: 'Statut',    render: v =>
      <span className={`badge ${STATUT_COLORS[v] || 'bg-gray-100 text-gray-600'}`}>
        {STATUT_LABELS[v] || v}
      </span>
    },
  ]

  const multiFilters = [{ key: 'statut', label: 'Statut', options: ['en_cours', 'non_respecte', 'termine'] }]

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  const detailRow = data.find(r => r.id === detailId)

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Échelonnements</h1>
        {isFinancier && (
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Échelonnement</button>
        )}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Élève</label>
              <select className="input" value={form.eleve_id}
                onChange={e => setForm(f => ({ ...f, eleve_id: e.target.value }))}>
                <option value="">— Choisir —</option>
                {eleves.map(el => <option key={el.id} value={el.id}>{el.nom} {el.prenom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Montant total (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nombre d'échéances</label>
              <input className="input" type="number" min="1" value={form.nombre_echeances}
                onChange={e => setForm(f => ({ ...f, nombre_echeances: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date de début</label>
              <input className="input" type="date" value={form.date_debut}
                onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Remarque</label>
              <input className="input" value={form.remarque}
                onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        multiFilters={multiFilters}
        onRowClick={row => setDetailId(row.id)}
      />

      {detailRow && (
        <EchelonnementDetail
          row={detailRow}
          onClose={() => setDetailId(null)}
          onUpdated={() => { reload(); setDetailId(null) }}
          isAllowed={isFinancier}
        />
      )}
    </div>
  )
}
