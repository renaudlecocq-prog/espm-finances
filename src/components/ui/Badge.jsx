const variants = {
  default:          'bg-accent-light text-primary',
  admin:            'bg-primary text-white',
  direction:        'bg-primary-lighter text-white',
  mdp:              'bg-accent-dark text-white',
  responsable:      'bg-accent-light text-primary',
  brouillon:        'bg-gray-100 text-gray-600',
  facture:          'bg-blue-100 text-blue-700',
  rappel:           'bg-yellow-100 text-yellow-700',
  mise_en_demeure:  'bg-red-100 text-red-700',
  publie:           'bg-green-100 text-green-700',
  archive:          'bg-gray-200 text-gray-500',
  respecte:         'bg-green-100 text-green-700',
  non_respecte:     'bg-red-100 text-red-700',
  termine:          'bg-gray-100 text-gray-500',
  en_cours:         'bg-blue-100 text-blue-700',
  valide:           'bg-green-100 text-green-700',
  non_valide:       'bg-red-100 text-red-700',
  responsable_pay:  'bg-accent-light text-primary',
  cpas:             'bg-purple-100 text-purple-700',
  ulb:              'bg-indigo-100 text-indigo-700',
  spj:              'bg-pink-100 text-pink-700',
  autre:            'bg-gray-100 text-gray-600',
}

const labels = {
  admin: 'Admin', direction: 'Financier', mdp: 'MdP', responsable: 'Responsable',
  brouillon: 'Brouillon', facture: 'Facture', rappel: 'Rappel', mise_en_demeure: 'Mise en demeure',
  publie: 'Publié', archive: 'Archivé',
  respecte: 'Respecté', non_respecte: 'Non respecté', termine: 'Terminé',
  en_cours: 'En cours', valide: 'Validé', non_valide: 'Non validé',
  extramuros: 'Extramuros', intramuros: 'Intramuros', voyage_scolaire: 'Voyage scolaire',
  responsable_pay: 'Responsable', cpas: 'CPAS', ulb: 'ULB', spj: 'SPJ', autre: 'Autre',
}

export default function Badge({ value, className = '' }) {
  if (!value) return null
  const key = value === 'responsable' && className.includes('pay') ? 'responsable_pay' : value
  const cls = variants[key] ?? variants.default
  const lbl = labels[value] ?? value
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {lbl}
    </span>
  )
}
