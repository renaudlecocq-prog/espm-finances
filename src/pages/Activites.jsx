import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FilterPill from '../components/ui/FilterPill'
import { Search, X, FileText, Pencil, Archive } from 'lucide-react'

const fmt = n => Number(n || 0).toFixed(2) + ' €'
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_COLORS = {
  brouillon: 'bg-gray-100 text-gray-600',
  publie:    'bg-blue-100 text-blue-700',
  archive:   'bg-orange-100 text-orange-700',
}
const FACT_COLORS = {
  a_facturer: 'bg-yellow-100 text-yellow-700',
  facture:    'bg-green-100 text-green-700',
}
const TYPE_LABELS = { extramuros: 'Extramuros', intramuros: 'Intramuros', voyage: 'Voyage' }

const EMPTY = {
  intitule: '', description: '', type: 'extramuros',
  date_debut: '', date_fin: '',
  lieu: '', heure_rdv: '', heure_depart: '', heure_retour: '',
  lieu_rdv: '', lieu_retour: '', type_transport: '', tel_organisateur: '', tel_sejour: '',
  local: '', heure_debut: '', heure_fin: '',
  nb_eleves: '', pop: '', montant_total: '',
  responsable: '', accompagnateurs: '',
  statut: 'brouillon', statut_facturation: 'a_facturer',
}

function validate(form) {
  const miss = ['intitule', 'type', 'date_debut', 'nb_eleves', 'responsable'].filter(k => !form[k])
  if (form.type === 'extramuros' || form.type === 'voyage') {
    if (!form.lieu) miss.push('lieu')
    if (!form.heure_depart) miss.push('heure_depart')
    if (!form.heure_retour) miss.push('heure_retour')
    if (!form.lieu_rdv) miss.push('lieu_rdv')
    if (!form.type_transport) miss.push('type_transport')
  }
  if (form.type === 'voyage' && !form.date_fin) miss.push('date_fin')
  if (form.type === 'intramuros') {
    if (!form.local) miss.push('local')
    if (!form.heure_debut) miss.push('heure_debut')
    if (!form.heure_fin) miss.push('heure_fin')
  }
  return miss
}

// ── Activity form modal ────────────────────────────────────────────────────
function ActivityModal({ editRow, isFinancier, userId, onClose, onSaved }) {
  const [form, setForm] = useState(editRow ? { ...EMPTY, ...editRow } : { ...EMPTY })
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const montantParEleve = form.nb_eleves && form.montant_total
    ? ((parseFloat(form.montant_total || 0) - parseFloat(form.pop || 0)) / Math.max(parseInt(form.nb_eleves || 1), 1))
    : null

  const save = async () => {
    const miss = validate(form)
    if (miss.length > 0) { setErrors(miss); return }
    setSaving(true); setSaveError(null)
    const payload = {
      ...form,
      montant_par_eleve: montantParEleve ? montantParEleve.toFixed(2) : null,
    }
    if (!isFinancier) delete payload.pop
    let error
    if (editRow) {
      ({ error } = await supabase.from('activites').update(payload).eq('id', editRow.id))
    } else {
      payload.created_by = userId
      ;({ error } = await supabase.from('activites').insert(payload))
    }
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    onSaved()
    onClose()
  }

  const FIELD_LABELS = {
    intitule: 'Intitulé', type: 'Type', date_debut: 'Date de début',
    nb_eleves: "Nb d'élèves", responsable: 'Responsable',
    lieu: 'Lieu', heure_depart: 'Heure de départ', heure_retour: 'Heure de retour',
    lieu_rdv: 'Lieu de RDV', type_transport: 'Type de transport',
    date_fin: 'Date de retour', local: 'Local',
    heure_debut: 'Heure de début', heure_fin: 'Heure de fin',
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-bold text-gray-800 text-lg">{editRow ? 'Modifier' : 'Nouvelle'} activité</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              Champs manquants : {errors.map(e => FIELD_LABELS[e] || e).join(', ')}
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              Erreur : {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Intitulé *</label>
              <input className="input" value={form.intitule} onChange={e => f('intitule', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.type} onChange={e => f('type', e.target.value)}>
                <option value="extramuros">Extramuros</option>
                <option value="intramuros">Intramuros</option>
                <option value="voyage">Voyage</option>
              </select>
            </div>
            <div>
              <label className="label">Responsable *</label>
              <input className="input" value={form.responsable} onChange={e => f('responsable', e.target.value)} />
            </div>
            <div>
              <label className="label">{form.type === 'voyage' ? 'Date de départ' : 'Date'} *</label>
              <input className="input" type="date" value={form.date_debut} onChange={e => f('date_debut', e.target.value)} />
            </div>
            {form.type === 'voyage' && (
              <div>
                <label className="label">Date de retour *</label>
                <input className="input" type="date" value={form.date_fin} onChange={e => f('date_fin', e.target.value)} />
              </div>
            )}
          </div>

          {/* Logistique extramuros / voyage */}
          {(form.type === 'extramuros' || form.type === 'voyage') && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Logistique</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Lieu *</label>
                  <input className="input" value={form.lieu} onChange={e => f('lieu', e.target.value)} />
                </div>
                <div><label className="label">Heure RDV</label>
                  <input className="input" type="time" value={form.heure_rdv} onChange={e => f('heure_rdv', e.target.value)} />
                </div>
                <div><label className="label">Heure de départ *</label>
                  <input className="input" type="time" value={form.heure_depart} onChange={e => f('heure_depart', e.target.value)} />
                </div>
                <div><label className="label">Heure de retour *</label>
                  <input className="input" type="time" value={form.heure_retour} onChange={e => f('heure_retour', e.target.value)} />
                </div>
                <div><label className="label">Lieu de RDV *</label>
                  <input className="input" value={form.lieu_rdv} onChange={e => f('lieu_rdv', e.target.value)} />
                </div>
                <div><label className="label">Lieu de retour</label>
                  <input className="input" value={form.lieu_retour} onChange={e => f('lieu_retour', e.target.value)} />
                </div>
                <div><label className="label">Type de transport *</label>
                  <select className="input" value={form.type_transport} onChange={e => f('type_transport', e.target.value)}>
                    <option value="">— Choisir —</option>
                    <option value="bus_scolaire">Bus scolaire</option>
                    <option value="train">Train</option>
                    <option value="a_pied">À pied</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div><label className="label">Tél. organisateur</label>
                  <input className="input" value={form.tel_organisateur} onChange={e => f('tel_organisateur', e.target.value)} />
                </div>
                {form.type === 'voyage' && (
                  <div><label className="label">Tél. séjour</label>
                    <input className="input" value={form.tel_sejour || ''} onChange={e => f('tel_sejour', e.target.value)} />
                  </div>
                )}
                <div className="col-span-2"><label className="label">Accompagnateur·rice·s</label>
                  <input className="input" value={form.accompagnateurs} onChange={e => f('accompagnateurs', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Logistique intramuros */}
          {form.type === 'intramuros' && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Logistique</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Local *</label>
                  <input className="input" value={form.local} onChange={e => f('local', e.target.value)} />
                </div>
                <div><label className="label">Heure de début *</label>
                  <input className="input" type="time" value={form.heure_debut} onChange={e => f('heure_debut', e.target.value)} />
                </div>
                <div><label className="label">Heure de fin *</label>
                  <input className="input" type="time" value={form.heure_fin} onChange={e => f('heure_fin', e.target.value)} />
                </div>
                <div className="col-span-2"><label className="label">Personnel mobilisé·e</label>
                  <input className="input" value={form.accompagnateurs} onChange={e => f('accompagnateurs', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Finances */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 border-t pt-4">Finances</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Nb d'élèves *</label>
                <input className="input" type="number" value={form.nb_eleves} onChange={e => f('nb_eleves', e.target.value)} />
              </div>
              <div><label className="label">Montant total (€)</label>
                <input className="input" type="number" step="0.01" value={form.montant_total} onChange={e => f('montant_total', e.target.value)} />
              </div>
              {isFinancier && (
                <div><label className="label">POP (€)</label>
                  <input className="input" type="number" step="0.01" value={form.pop} onChange={e => f('pop', e.target.value)} />
                </div>
              )}
              <div><label className="label">Montant par élève (calculé)</label>
                <div className="input bg-gray-50 text-gray-600">
                  {montantParEleve !== null ? fmt(montantParEleve) : '—'}
                </div>
              </div>
              <div><label className="label">Statut</label>
                <select className="input" value={form.statut} onChange={e => f('statut', e.target.value)}>
                  <option value="brouillon">Brouillon</option>
                  <option value="publie">Publié</option>
                  {isFinancier && <option value="archive">Archivé</option>}
                </select>
              </div>
              {isFinancier && (
                <div><label className="label">Statut facturation</label>
                  <select className="input" value={form.statut_facturation} onChange={e => f('statut_facturation', e.target.value)}>
                    <option value="a_facturer">À facturer</option>
                    <option value="facture">Facturé</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-5 text-sm disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-sm">Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ── Docs modal (unchanged logic, new style) ────────────────────────────────
function DocsModal({ row, onClose }) {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('activite_documents').select('*').eq('activite_id', row.id).then(({ data }) => setDocs(data || []))
  }, [row.id])

  const reload = () => supabase.from('activite_documents').select('*').eq('activite_id', row.id).then(({ data }) => setDocs(data || []))

  const upload = async e => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const path = `${row.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('activite-factures').upload(path, file)
    if (!error) {
      await supabase.from('activite_documents').insert({ activite_id: row.id, nom: file.name, chemin: path, taille: file.size })
      await reload()
    }
    setUploading(false); e.target.value = ''
  }

  const view = async doc => {
    const { data } = await supabase.storage.from('activite-factures').createSignedUrl(doc.chemin, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const del = async doc => {
    await supabase.storage.from('activite-factures').remove([doc.chemin])
    await supabase.from('activite_documents').delete().eq('id', doc.id)
    await reload()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Documents — {row.intitule}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={upload} />
          <button onClick={() => fileRef.current.click()} disabled={uploading}
            className="btn-primary w-full justify-center text-sm py-1.5 mb-4">
            {uploading ? 'Upload…' : '+ Ajouter un PDF'}
          </button>
          {docs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun document</p>}
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
              <span className="truncate text-gray-700 flex-1">{d.nom}</span>
              <div className="flex gap-2 ml-2">
                <button onClick={() => view(d)} className="text-primary text-xs hover:underline">Voir</button>
                <button onClick={() => del(d)} className="text-red-500 text-xs hover:underline">Suppr.</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Activites() {
  const { user, isAdmin, isFinancier, isMdp } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [docsRow, setDocsRow] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFact, setFilterFact] = useState('')

  const reload = useCallback(() =>
    supabase.from('activites').select('*').order('date_debut', { ascending: false })
      .then(({ data }) => setData(data || []))
  , [])

  useEffect(() => { reload().then(() => setLoading(false)) }, [reload])

  const openNew = () => { setEditRow(null); setShowModal(true) }
  const openEdit = row => { setEditRow(row); setShowModal(true) }

  const archive = async id => {
    if (!confirm('Archiver cette activité ?')) return
    await supabase.from('activites').update({ statut: 'archive' }).eq('id', id)
    await reload()
  }

  const canEdit = row => isAdmin || isFinancier || (isMdp && row.created_by === user?.id && row.statut !== 'archive')
  const canCreate = isAdmin || isFinancier || isMdp

  const displayed = data
    .filter(r => showArchived ? true : r.statut !== 'archive')
    .filter(r => isAdmin || isFinancier || r.created_by === user?.id || r.statut === 'publie')
    .filter(r => !search || `${r.intitule} ${r.description || ''} ${r.responsable || ''}`.toLowerCase().includes(search.toLowerCase()))
    .filter(r => !filterType || r.type === filterType)
    .filter(r => !filterFact || r.statut_facturation === filterFact)

  const hasFilters = search || filterType || filterFact

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-primary">Activités</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestion des activités scolaires et extrascolaires</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
            Archives
          </label>
          {canCreate && <button onClick={openNew} className="btn-primary text-sm py-1.5 px-4">+ Activité</button>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="rounded-full border border-gray-200 bg-white text-xs pl-7 pr-3 py-1.5 outline-none w-56 focus:border-primary transition-colors"
            placeholder="Rechercher par intitulé, responsable…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <FilterPill label="Type" value={filterType}
          options={Object.values(TYPE_LABELS)}
          onChange={v => setFilterType(Object.entries(TYPE_LABELS).find(([, l]) => l === v)?.[0] || '')} />
        <FilterPill label="Facturation" value={filterFact}
          options={['À facturer', 'Facturé']}
          onChange={v => setFilterFact(v === 'À facturer' ? 'a_facturer' : v === 'Facturé' ? 'facture' : '')} />
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterType(''); setFilterFact('') }}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-full px-2.5 py-1 transition-colors">
            <span className="text-sm leading-none">✕</span> Tout effacer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{displayed.length} résultat{displayed.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Cards */}
      <div className="grid gap-3">
        {displayed.length === 0 && (
          <div className="card p-8 text-center text-gray-400">Aucune activité</div>
        )}
        {displayed.map(row => (
          <div key={row.id} className="card p-5 flex items-start justify-between gap-4 hover:shadow-md transition-shadow">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-semibold text-gray-800">{row.intitule}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[row.statut] || 'bg-gray-100 text-gray-600'}`}>
                  {row.statut === 'brouillon' ? 'Brouillon' : row.statut === 'publie' ? 'Publié' : 'Archivé'}
                </span>
                {isFinancier && row.statut_facturation && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FACT_COLORS[row.statut_facturation] || 'bg-gray-100'}`}>
                    {row.statut_facturation === 'a_facturer' ? 'À facturer' : 'Facturé'}
                  </span>
                )}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                  {TYPE_LABELS[row.type] || row.type}
                </span>
              </div>
              {row.description && <p className="text-sm text-gray-500 mb-2 line-clamp-1">{row.description}</p>}
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <span>📅 {fmtDate(row.date_debut)}{row.date_fin ? ` → ${fmtDate(row.date_fin)}` : ''}</span>
                {row.lieu && <span>📍 {row.lieu}</span>}
                {row.nb_eleves && <span>👥 {row.nb_eleves} élèves</span>}
                {row.montant_total && <span>💶 {fmt(row.montant_total)} total{row.montant_par_eleve ? ` · ${fmt(row.montant_par_eleve)}/élève` : ''}</span>}
                {row.responsable && <span>👤 {row.responsable}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0 items-center">
              <button onClick={() => setDocsRow(row)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary rounded-full px-3 py-1.5 transition-colors">
                <FileText size={12} /> Docs
              </button>
              {canEdit(row) && (
                <button onClick={() => openEdit(row)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary border border-gray-200 hover:border-primary rounded-full px-3 py-1.5 transition-colors">
                  <Pencil size={12} /> Modifier
                </button>
              )}
              {isFinancier && row.statut !== 'archive' && (
                <button onClick={() => archive(row.id)}
                  className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-700 border border-orange-200 hover:border-orange-400 rounded-full px-3 py-1.5 transition-colors">
                  <Archive size={12} /> Archiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showModal && (
        <ActivityModal
          editRow={editRow}
          isFinancier={isFinancier || isAdmin}
          userId={user?.id}
          onClose={() => setShowModal(false)}
          onSaved={reload}
        />
      )}
      {docsRow && <DocsModal row={docsRow} onClose={() => setDocsRow(null)} />}
    </div>
  )
}
