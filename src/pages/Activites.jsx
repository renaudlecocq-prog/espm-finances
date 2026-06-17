import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const fmt = n => Number(n||0).toFixed(2) + ' €'

const STATUT_COLORS = {
  brouillon: 'bg-gray-100 text-gray-600',
  publie: 'bg-blue-100 text-blue-700',
  archive: 'bg-orange-100 text-orange-700',
}

const FACT_COLORS = {
  a_facturer: 'bg-yellow-100 text-yellow-700',
  facture: 'bg-green-100 text-green-700',
}

function validate(form) {
  const required = ['intitule', 'type', 'date_debut', 'nb_eleves', 'responsable']
  const missing = required.filter(k => !form[k])
  if (form.type === 'extramuros' || form.type === 'voyage') {
    if (!form.lieu) missing.push('lieu')
    if (!form.heure_depart) missing.push('heure_depart')
    if (!form.heure_retour) missing.push('heure_retour')
    if (!form.lieu_rdv) missing.push('lieu_rdv')
    if (!form.type_transport) missing.push('type_transport')
  }
  if (form.type === 'voyage' && !form.date_fin) missing.push('date_fin')
  if (form.type === 'intramuros') {
    if (!form.local) missing.push('local')
    if (!form.heure_debut) missing.push('heure_debut')
    if (!form.heure_fin) missing.push('heure_fin')
  }
  return missing
}

const EMPTY = { intitule:'', description:'', type:'extramuros', date_debut:'', date_fin:'', lieu:'', heure_rdv:'', heure_depart:'', heure_retour:'', lieu_rdv:'', lieu_retour:'', type_transport:'', tel_organisateur:'', local:'', heure_debut:'', heure_fin:'', nb_eleves:'', pop:'', montant_total:'', responsable:'', accompagnateurs:'', statut:'brouillon', statut_facturation:'a_facturer' }

export default function Activites() {
  const { user, isAdmin, isFinancier, isMdp } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [docsModal, setDocsModal] = useState(null)
  const [docs, setDocs] = useState([])
  const [docUploading, setDocUploading] = useState(false)
  const fileRef = useRef()

  const reload = () => supabase.from('activites').select('*').order('date_debut', {ascending:false}).then(({data}) => setData(data||[]))

  useEffect(() => { reload().then(() => setLoading(false)) }, [])

  const canEdit = row => isAdmin || isFinancier || (isMdp && row.created_by === user?.id && row.statut !== 'archive')
  const canCreate = isMdp

  const openForm = (row = null) => {
    setEditRow(row)
    setForm(row ? {...EMPTY, ...row} : {...EMPTY})
    setErrors([])
    setShowForm(true)
  }

  const save = async () => {
    const errs = validate(form)
    if (errs.length > 0) { setErrors(errs); return }
    setSaving(true)
    const montantParEleve = form.nb_eleves > 0 ? ((parseFloat(form.montant_total||0) - parseFloat(form.pop||0)) / parseInt(form.nb_eleves||1)).toFixed(2) : 0
    const payload = { ...form, montant_par_eleve: montantParEleve }
    if (!isFinancier) delete payload.pop
    if (editRow) {
      await supabase.from('activites').update(payload).eq('id', editRow.id)
    } else {
      payload.created_by = user?.id
      await supabase.from('activites').insert(payload)
    }
    await reload(); setSaving(false); setShowForm(false)
  }

  const archive = async id => {
    await supabase.from('activites').update({statut:'archive'}).eq('id', id)
    await reload()
  }

  const openDocs = async row => {
    setDocsModal(row)
    const { data } = await supabase.from('activite_documents').select('*').eq('activite_id', row.id)
    setDocs(data||[])
  }

  const uploadDoc = async e => {
    const file = e.target.files[0]; if (!file) return
    setDocUploading(true)
    const path = `${docsModal.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('activite-factures').upload(path, file)
    if (!error) {
      await supabase.from('activite_documents').insert({ activite_id: docsModal.id, nom: file.name, chemin: path, taille: file.size })
      const { data } = await supabase.from('activite_documents').select('*').eq('activite_id', docsModal.id)
      setDocs(data||[])
    }
    setDocUploading(false); e.target.value = ''
  }

  const deleteDoc = async doc => {
    await supabase.storage.from('activite-factures').remove([doc.chemin])
    await supabase.from('activite_documents').delete().eq('id', doc.id)
    const { data } = await supabase.from('activite_documents').select('*').eq('activite_id', docsModal.id)
    setDocs(data||[])
  }

  const viewDoc = async doc => {
    const { data } = await supabase.storage.from('activite-factures').createSignedUrl(doc.chemin, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const f = (k,v) => setForm(prev => ({...prev, [k]: v}))

  const displayed = data.filter(r => showArchived ? true : r.statut !== 'archive')
    .filter(r => isAdmin || isFinancier || r.created_by === user?.id || r.statut === 'publie')

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Activités</h1>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Archives
          </label>
          {canCreate && <button onClick={() => openForm()} className="btn-primary">+ Activité</button>}
        </div>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">{editRow ? 'Modifier' : 'Nouvelle'} activité</h2>
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
              Champs manquants : {errors.join(', ')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Intitulé *</label>
              <input className="input" value={form.intitule} onChange={e => f('intitule',e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => f('description',e.target.value)} />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.type} onChange={e => f('type',e.target.value)}>
                <option value="extramuros">Extramuros</option>
                <option value="intramuros">Intramuros</option>
                <option value="voyage">Voyage</option>
              </select>
            </div>
            <div>
              <label className="label">Responsable *</label>
              <input className="input" value={form.responsable} onChange={e => f('responsable',e.target.value)} />
            </div>
            <div>
              <label className="label">Date {form.type==='voyage'?'de départ':''} *</label>
              <input className="input" type="date" value={form.date_debut} onChange={e => f('date_debut',e.target.value)} />
            </div>
            {form.type === 'voyage' && (
              <div>
                <label className="label">Date de retour *</label>
                <input className="input" type="date" value={form.date_fin} onChange={e => f('date_fin',e.target.value)} />
              </div>
            )}

            {(form.type === 'extramuros' || form.type === 'voyage') && (<>
              <div className="col-span-2 border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Logistique</h3>
              </div>
              <div className="col-span-2">
                <label className="label">Lieu *</label>
                <input className="input" value={form.lieu} onChange={e => f('lieu',e.target.value)} />
              </div>
              <div>
                <label className="label">Heure RDV</label>
                <input className="input" type="time" value={form.heure_rdv} onChange={e => f('heure_rdv',e.target.value)} />
              </div>
              <div>
                <label className="label">Heure de départ *</label>
                <input className="input" type="time" value={form.heure_depart} onChange={e => f('heure_depart',e.target.value)} />
              </div>
              <div>
                <label className="label">Heure de retour *</label>
                <input className="input" type="time" value={form.heure_retour} onChange={e => f('heure_retour',e.target.value)} />
              </div>
              <div>
                <label className="label">Lieu de RDV *</label>
                <input className="input" value={form.lieu_rdv} onChange={e => f('lieu_rdv',e.target.value)} />
              </div>
              <div>
                <label className="label">Lieu de retour</label>
                <input className="input" value={form.lieu_retour} onChange={e => f('lieu_retour',e.target.value)} />
              </div>
              <div>
                <label className="label">Type de transport *</label>
                <select className="input" value={form.type_transport} onChange={e => f('type_transport',e.target.value)}>
                  <option value="">— Choisir —</option>
                  <option value="bus_scolaire">Bus scolaire</option>
                  <option value="train">Train</option>
                  <option value="a_pied">À pied</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Tél. organisateur</label>
                <input className="input" value={form.tel_organisateur} onChange={e => f('tel_organisateur',e.target.value)} />
              </div>
              {form.type === 'voyage' && (
                <div>
                  <label className="label">Tél. séjour</label>
                  <input className="input" value={form.tel_sejour} onChange={e => f('tel_sejour',e.target.value)} />
                </div>
              )}
            </>)}

            {form.type === 'intramuros' && (<>
              <div className="col-span-2 border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Logistique</h3>
              </div>
              <div>
                <label className="label">Local *</label>
                <input className="input" value={form.local} onChange={e => f('local',e.target.value)} />
              </div>
              <div>
                <label className="label">Heure de début *</label>
                <input className="input" type="time" value={form.heure_debut} onChange={e => f('heure_debut',e.target.value)} />
              </div>
              <div>
                <label className="label">Heure de fin *</label>
                <input className="input" type="time" value={form.heure_fin} onChange={e => f('heure_fin',e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Membres du personnel mobilisé·e·s</label>
                <input className="input" value={form.accompagnateurs} onChange={e => f('accompagnateurs',e.target.value)} />
              </div>
            </>)}

            {(form.type === 'extramuros' || form.type === 'voyage') && (
              <div className="col-span-2">
                <label className="label">Accompagnateur·rice·s</label>
                <input className="input" value={form.accompagnateurs} onChange={e => f('accompagnateurs',e.target.value)} />
              </div>
            )}

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Finances</h3>
            </div>
            <div>
              <label className="label">Nb d'élèves *</label>
              <input className="input" type="number" value={form.nb_eleves} onChange={e => f('nb_eleves',e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Auto via groupes Smartschool — à venir</p>
            </div>
            <div>
              <label className="label">Montant total (€)</label>
              <input className="input" type="number" step="0.01" value={form.montant_total} onChange={e => f('montant_total',e.target.value)} />
            </div>
            {isFinancier && (
              <div>
                <label className="label">POP (€)</label>
                <input className="input" type="number" step="0.01" value={form.pop} onChange={e => f('pop',e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Montant par élève (calculé)</label>
              <div className="input bg-gray-50 text-gray-600">
                {form.nb_eleves && form.montant_total ? fmt((parseFloat(form.montant_total||0) - parseFloat(form.pop||0)) / parseInt(form.nb_eleves||1)) : '—'}
              </div>
            </div>

            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={e => f('statut',e.target.value)}>
                <option value="brouillon">Brouillon</option>
                <option value="publie">Publié</option>
                {isFinancier && <option value="archive">Archivé</option>}
              </select>
            </div>
            {isFinancier && (
              <div>
                <label className="label">Statut facturation</label>
                <select className="input" value={form.statut_facturation} onChange={e => f('statut_facturation',e.target.value)}>
                  <option value="a_facturer">À facturer</option>
                  <option value="facture">Facturé</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-6">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Sauvegarde…':'Enregistrer'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {displayed.length === 0 && <div className="card p-8 text-center text-gray-400">Aucune activité</div>}
        {displayed.map(row => (
          <div key={row.id} className="card p-5 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-gray-800">{row.intitule}</span>
                <span className={`badge ${STATUT_COLORS[row.statut]||'bg-gray-100 text-gray-600'}`}>{row.statut}</span>
                <span className={`badge ${FACT_COLORS[row.statut_facturation]||'bg-gray-100 text-gray-600'}`}>{row.statut_facturation?.replace('_',' ')}</span>
                <span className="badge bg-purple-50 text-purple-600 capitalize">{row.type}</span>
              </div>
              {row.description && <p className="text-sm text-gray-500 mb-2 truncate">{row.description}</p>}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <span>📅 {row.date_debut}{row.date_fin ? ` → ${row.date_fin}` : ''}</span>
                {row.lieu && <span>📍 {row.lieu}</span>}
                {row.nb_eleves && <span>👥 {row.nb_eleves} élèves</span>}
                {row.montant_total && <span>💶 {fmt(row.montant_total)} total</span>}
                {row.montant_par_eleve && <span>/ {fmt(row.montant_par_eleve)} par élève</span>}
                {row.responsable && <span>👤 {row.responsable}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => openDocs(row)} className="btn btn-secondary btn-sm">📄 Docs</button>
              {canEdit(row) && <button onClick={() => openForm(row)} className="btn btn-secondary btn-sm">Modifier</button>}
              {isFinancier && row.statut !== 'archive' && <button onClick={() => archive(row.id)} className="btn btn-secondary btn-sm text-orange-600">Archiver</button>}
            </div>
          </div>
        ))}
      </div>

      {docsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && setDocsModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-800">Documents — {docsModal.intitule}</h2>
              <button onClick={() => setDocsModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={uploadDoc} />
            <button onClick={() => fileRef.current.click()} className="btn-primary w-full justify-center mb-4" disabled={docUploading}>
              {docUploading ? 'Upload…' : '+ Ajouter un PDF'}
            </button>
            {docs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun document</p>}
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                <span className="truncate text-gray-700">{d.nom}</span>
                <div className="flex gap-2 ml-2">
                  <button onClick={() => viewDoc(d)} className="btn btn-secondary btn-sm">Voir</button>
                  <button onClick={() => deleteDoc(d)} className="btn btn-sm text-red-600 border-red-200 hover:bg-red-50">Suppr.</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
