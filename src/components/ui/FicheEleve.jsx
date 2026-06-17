import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

function Section({ icon, title, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="grid grid-cols-2 gap-2 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  )
}

function isMajeur(dateNaissance) {
  if (!dateNaissance) return false
  const dob = new Date(dateNaissance)
  const now = new Date()
  const age = now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
  return age >= 18
}

function rlmo(philosophie, groupe) {
  if (!philosophie) return null
  return groupe ? `${philosophie} ${groupe}` : philosophie
}

function colorEch(s) {
  const c = { en_cours: 'bg-blue-100 text-blue-700', non_respecte: 'bg-red-100 text-red-700', termine: 'bg-green-100 text-green-700' }
  return c[s] || 'bg-gray-100 text-gray-700'
}

function colorOrg(s) {
  const c = { en_cours: 'bg-blue-100 text-blue-700', valide: 'bg-green-100 text-green-700', refuse: 'bg-red-100 text-red-700', cloture: 'bg-gray-100 text-gray-700' }
  return c[s] || 'bg-gray-100 text-gray-700'
}

export default function FicheEleve({ eleveId, onClose }) {
  const [eleve, setEleve] = useState(null)
  const [echs, setEchs] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eleveId) return
    setLoading(true)
    Promise.all([
      supabase.from('eleves').select('*').eq('id', eleveId).single(),
      supabase.from('echelonnements').select('*').eq('eleve_id', eleveId),
      supabase.from('organismes_tiers').select('*').eq('eleve_id', eleveId),
    ]).then(([e, ec, o]) => {
      setEleve(e.data)
      setEchs(ec.data || [])
      setOrgs(o.data || [])
      setLoading(false)
    })
  }, [eleveId])

  if (!eleveId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-800">Fiche élève</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement…</div>
        ) : !eleve ? (
          <div className="p-8 text-center text-gray-400">Élève introuvable</div>
        ) : (
          <div className="p-5">
            <Section icon="👤" title="Identité">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Field label="Nom" value={eleve.nom} />
                  <Field label="Prénom" value={eleve.prenom} />
                  <Field label="Date de naissance" value={eleve.date_naissance} />
                  <Field label="Classe" value={eleve.classe} />
                  <Field label="Statut" value={eleve.actif ? 'Actif' : 'Inactif'} />
                </div>
                {isMajeur(eleve.date_naissance) && (
                  <span className="badge bg-purple-100 text-purple-700 ml-3">Élève majeur·e</span>
                )}
              </div>
            </Section>

            <Section icon="📚" title="Groupes scolaires">
              <Field label="RLMO" value={rlmo(eleve.philosophie, eleve.groupe_choix_philo)} />
              <Field label="OBS D2" value={eleve.obs_d2} />
              <Field label="AC D2" value={eleve.ac_d2} />
              <Field label="Math D3" value={eleve.math_d3} />
              <Field label="Sciences D3" value={eleve.sciences_d3} />
              <Field label="Bio/Physique D3" value={eleve.bio_physique_d3} />
              <Field label="OBS 1 D3" value={eleve.obs1_d3} />
              <Field label="OBS 2 D3" value={eleve.obs2_d3} />
              <Field label="AC D3" value={eleve.ac_d3} />
            </Section>

            {[1,2,3].some(n => eleve[`resp${n}_nom`]) && (
              <Section icon="👪" title="Responsables légaux">
                {[1,2,3].map(n => eleve[`resp${n}_nom`] ? (
                  <div key={n} className={n > 1 ? 'mt-3 pt-3 border-t border-gray-50' : ''}>
                    <Field label="Nom" value={`${eleve[`resp${n}_nom`] || ''} ${eleve[`resp${n}_prenom`] || ''}`.trim()} />
                    <Field label="Téléphone" value={eleve[`resp${n}_tel`]} />
                    <Field label="Email" value={eleve[`resp${n}_email`]} />
                  </div>
                ) : null)}
              </Section>
            )}

            {eleve.assistant_social_nom && (
              <Section icon="🤝" title="Assistant·e social·e">
                <Field label="Nom" value={eleve.assistant_social_nom} />
                <Field label="Organisme" value={eleve.assistant_social_organisme} />
                <Field label="Téléphone" value={eleve.assistant_social_tel} />
                <Field label="Email" value={eleve.assistant_social_email} />
              </Section>
            )}

            {echs.length > 0 && (
              <Section icon="📅" title="Échelonnements">
                {echs.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-700">{e.montant} € — {e.nombre_echeances} éch.</span>
                    <span className={`badge ${colorEch(e.statut)}`}>{e.statut?.replace('_',' ')}</span>
                  </div>
                ))}
              </Section>
            )}

            {orgs.length > 0 && (
              <Section icon="🏢" title="Organismes tiers">
                {orgs.map(o => (
                  <div key={o.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-700">{o.organisme}</span>
                    <span className={`badge ${colorOrg(o.statut)}`}>{o.statut?.replace('_',' ')}</span>
                  </div>
                ))}
              </Section>
            )}

            <Section icon="💶" title="Financier">
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-500">Solde</span>
                <span className={`font-bold text-base ${(eleve.solde || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {Number(eleve.solde || 0).toFixed(2)} €
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Le détail des factures et paiements sera disponible prochainement.</p>
            </Section>

            {eleve.remarque && (
              <Section icon="📝" title="Remarque">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{eleve.remarque}</p>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
