// ── Définition des features ───────────────────────────────────────────────────
// Source de vérité partagée entre AuthContext, Admin et les pages.

export const FEATURES = [
  // Pages principales
  { key: 'eleves',          label: 'Élèves / Groupes',          group: 'Pages',      desc: 'Accès à la liste des élèves et groupes' },
  { key: 'soldes',          label: 'Soldes élèves',              group: 'Pages',      desc: 'Consultation des soldes et fiches financières' },
  { key: 'paiements',       label: 'Paiements',                  group: 'Pages',      desc: 'Importation et gestion des paiements' },
  { key: 'factures',        label: 'Factures',                   group: 'Pages',      desc: 'Génération et gestion des factures' },
  { key: 'articles',        label: 'Articles',                   group: 'Pages',      desc: 'Gestion des articles et attributions' },
  { key: 'suivi_social',    label: 'Suivi social',               group: 'Pages',      desc: 'Échelonnements et organismes tiers (données sensibles)' },
  // Activités
  { key: 'activites_full',  label: 'Activités — accès complet',  group: 'Activités',  desc: 'Voir et gérer toutes les activités, accès aux champs financiers (POP, facturation)' },
  { key: 'activites_own',   label: 'Activités — ses propres',    group: 'Activités',  desc: 'Voir et gérer uniquement ses activités (responsable ou accompagnant), sans champs financiers' },
  // Helpdesk
  { key: 'helpdesk',        label: 'Helpdesk — voir / répondre', group: 'Helpdesk',   desc: 'Consulter les tickets et envoyer des messages' },
  { key: 'helpdesk_admin',  label: 'Helpdesk — gestion admin',   group: 'Helpdesk',   desc: 'Fermer les tickets, changer le statut, gérer les catégories' },
  // Système
  { key: 'salle_profs',     label: 'Salle des profs',           group: 'Collaboration', desc: 'Accès à la salle des profs et au casier personnel' },
  { key: 'econome',         label: 'Économe — comptabilité',     group: 'Système',    desc: 'Suivi comptable (Fonctionnement, Élèves, POP, Bilan, Projets)' },
  { key: 'compositions',    label: 'Compositions de classes',    group: 'Pédagogie',  desc: 'Outil de composition de classes avec drag-and-drop' },
  { key: 'guidance',         label: 'Conseils de guidance',        group: 'Pédagogie',  desc: 'Encodage collaboratif pendant les conseils de classe, génération de commentaires' },
  { key: 'notes_eleves',     label: 'Notes élèves — voir & écrire', group: 'Pédagogie',  desc: 'Accès à l\'onglet Notes : voir toutes les notes, créer et modifier ses propres notes' },
  { key: 'notes_manage_all', label: 'Notes élèves — gérer toutes',  group: 'Pédagogie',  desc: 'Modifier et supprimer les notes des autres utilisateurs' },
  { key: 'administration',  label: 'Administration',             group: 'Système',    desc: 'Panneau admin — utilisateurs, droits, synchronisation Smartschool' },
]

export const FEATURE_KEYS = FEATURES.map(f => f.key)

export const FEATURE_GROUPS = [...new Set(FEATURES.map(f => f.group))]

export const ROLES = ['super_admin', 'admin', 'direction', 'mdp', 'responsable']

export const ROLE_META = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700 border border-purple-200', desc: 'Accès total + gestion des autres super admins. Réservé à SchoolPlus.', dot: 'bg-purple-500', avatarBg: '#7c3aed' },
  admin:       { label: 'Admin',       color: 'bg-red-100 text-red-700 border border-red-200',       desc: 'Accès total — gestion des utilisateurs, toutes les données.',          dot: 'bg-red-500',    avatarBg: '#ef4444' },
  direction:   { label: 'Direction',   color: 'bg-blue-100 text-blue-700 border border-blue-200',    desc: 'Accès financier complet — factures, paiements, élèves, organismes.',   dot: 'bg-blue-500',   avatarBg: '#3b82f6' },
  mdp:         { label: 'MdP',         color: 'bg-green-100 text-green-700 border border-green-200', desc: 'Membres du personnel — activités et helpdesk.',                         dot: 'bg-green-500',  avatarBg: '#22c55e' },
  responsable: { label: 'Responsable', color: 'bg-gray-100 text-gray-600 border border-gray-200',    desc: 'Parents / élèves majeurs — tableau de bord enfants uniquement.',       dot: 'bg-gray-400',   avatarBg: '#9ca3af' },
}
