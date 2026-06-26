const variants = {
  default:          'bg-accent-light text-primary',
  admin:            'bg-primary text-white',
  direction:        'bg-primary-lighter text-white',
  mdp:              'bg-accent-dark text-white',
  responsable:      'bg-accent-light text-primary',
  brouillon:        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  facture:          'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  rappel:           'bg-yellow-100 text-yellow-700 dark:text-yellow-300',
  mise_en_demeure:  'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  publie:           'bg-green-100 text-green-700 dark:text-green-300',
  archive:          'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400',
  respecte:         'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  non_respecte:     'bg-red-100 text-red-700 dark:text-red-300',
  termine:          'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  en_cours:         'bg-blue-100 text-blue-700 dark:text-blue-300',
  valide:           'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  non_valide:       'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  responsable_pay:  'bg-accent-light text-primary',
  cpas:             'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  ulb:              'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300',
  spj:              'bg-pink-100 text-pink-700',
  autre:            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
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
