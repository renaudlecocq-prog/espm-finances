// ── Données de démonstration ESPM+ ───────────────────────────────────────
// Les élèves portent des noms de stars de la musique — pour l'ambiance !

const E = (n) => `demo-eleve-${String(n).padStart(3, '0')}`

const now = new Date()
const sy = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
const past = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
const ts   = (days) => new Date(Date.now() - days * 86400000).toISOString()

const COMMUNES = ['Bruxelles','Laeken','Schaerbeek','Etterbeek','Ixelles','Saint-Gilles','Anderlecht','Molenbeek','Koekelberg','Berchem-Sainte-Agathe']
const CP       = ['1000','1020','1030','1040','1050','1060','1070','1080','1081','1082']
const RUES     = ['Rue de la Paix','Avenue des Arts','Chaussee de Mons','Rue Haute','Boulevard Anspach','Rue du Midi','Avenue Louise','Rue Royale','Place Fontainas','Rue des Bouchers']

const STARS = [
  { id:E(1),  prenom:'Billie',   nom:'Eilish',     classe:'1A',    dob:'2012-12-18', p1n:'Eilish',    p1f:'Maggie',     p1t:'0476 11 22 33', p2n:null,          p2f:null,        p2t:null,           philo:'Cours de religion catholique', solde:-45.00,  obs:'Sciences generales',  ac:'Arts plastiques',    m3:null,                  s3:null },
  { id:E(2),  prenom:'Post',     nom:'Malone',     classe:'1B',    dob:'2012-07-04', p1n:'Malone',    p1f:'Rich',       p1t:'0487 33 44 55', p2n:'Malone',      p2f:'Amy',       p2t:'0472 55 66 77',philo:'Morale non confessionnelle',   solde: 20.00,  obs:'Sciences generales',  ac:null,                 m3:null,                  s3:null },
  { id:E(3),  prenom:'Abel',     nom:'Tesfaye',    classe:'2A',    dob:'2011-02-16', p1n:'Tesfaye',   p1f:'Samra',      p1t:'0468 22 33 44', p2n:null,          p2f:null,        p2t:null,           philo:'Islam',                        solde:-80.00,  obs:'Sciences generales',  ac:null,                 m3:null,                  s3:null },
  { id:E(4),  prenom:'Ariana',   nom:'Grande',     classe:'2B',    dob:'2011-06-26', p1n:'Grande',    p1f:'Joan',       p1t:'0494 44 55 66', p2n:'Grande',      p2f:'Ed',        p2t:'0471 66 77 88',philo:'Cours de religion catholique', solde: 10.00,  obs:null,                  ac:'Musique',            m3:null,                  s3:null },
  { id:E(5),  prenom:'Taylor',   nom:'Swift',      classe:'3TQ A', dob:'2010-12-13', p1n:'Swift',     p1f:'Scott',      p1t:'0478 77 88 99', p2n:'Swift',       p2f:'Andrea',    p2t:'0462 99 00 11',philo:'Cours de religion catholique', solde:-125.50, obs:'Sciences appliquees', ac:'Langues modernes',   m3:null,                  s3:null },
  { id:E(6),  prenom:'Dua',      nom:'Lipa',       classe:'3GT B', dob:'2010-08-22', p1n:'Lipa',      p1f:'Dukagjin',   p1t:'0475 12 23 34', p2n:'Lipa',        p2f:'Anesa',     p2t:'0466 34 45 56',philo:'Islam',                        solde:  0.00,  obs:'Sciences generales',  ac:'Langues modernes',   m3:null,                  s3:null },
  { id:E(7),  prenom:'Ed',       nom:'Sheeran',    classe:'3GT A', dob:'2010-02-17', p1n:'Sheeran',   p1f:'John',       p1t:'0493 56 67 78', p2n:'Sheeran',     p2f:'Imogen',    p2t:'0477 78 89 90',philo:'Morale non confessionnelle',   solde: 55.00,  obs:'Sciences generales',  ac:'Arts plastiques',    m3:null,                  s3:null },
  { id:E(8),  prenom:'Katy',     nom:'Perry',      classe:'4GT C', dob:'2009-10-25', p1n:'Perry',     p1f:'Keith',      p1t:'0488 90 01 12', p2n:'Perry',       p2f:'Mary',      p2t:'0474 12 23 34',philo:'Cours de religion catholique', solde:-200.00, obs:'Sciences generales',  ac:'Sciences humaines',  m3:'Mathematiques 4h',    s3:null },
  { id:E(9),  prenom:'Harry',    nom:'Styles',     classe:'4TQ A', dob:'2009-02-01', p1n:'Styles',    p1f:'Anne',       p1t:'0463 34 45 56', p2n:null,          p2f:null,        p2t:null,           philo:'Morale non confessionnelle',   solde: 30.00,  obs:'Sciences appliquees', ac:null,                 m3:null,                  s3:null },
  { id:E(10), prenom:'Rihanna',  nom:'Fenty',      classe:'4GT B', dob:'2009-02-20', p1n:'Fenty',     p1f:'Ronald',     p1t:'0492 56 67 78', p2n:'Braithwaite', p2f:'Monica',    p2t:'0481 78 89 00',philo:'Cours de religion catholique', solde:-350.00, obs:'Sciences generales',  ac:'Arts appliques',     m3:'Mathematiques 4h',    s3:null },
  { id:E(11), prenom:'Beyonce',  nom:'Knowles',    classe:'5TT A', dob:'2008-09-04', p1n:'Knowles',   p1f:'Mathew',     p1t:'0476 00 11 22', p2n:'Beyince',     p2f:'Tina',      p2t:'0469 22 33 44',philo:'Cours de religion catholique', solde: 75.00,  obs:'Sciences generales',  ac:'Musique',            m3:'Mathematiques 6h',    s3:'Chimie' },
  { id:E(12), prenom:'Justin',   nom:'Timberlake', classe:'5GT B', dob:'2008-01-31', p1n:'Harless',   p1f:'Lynn',       p1t:'0484 44 55 66', p2n:null,          p2f:null,        p2t:null,           philo:'Cours de religion baptiste',   solde:  0.00,  obs:'Sciences generales',  ac:'Sciences appliquees',m3:'Mathematiques 4h',    s3:null },
  { id:E(13), prenom:'Bruno',    nom:'Mars',       classe:'5GT A', dob:'2008-10-08', p1n:'Hernandez', p1f:'Peter',      p1t:'0473 66 77 88', p2n:'Bayot',       p2f:'Bernadette',p2t:'0465 88 99 00',philo:'Cours de religion catholique', solde: 42.00,  obs:'Sciences generales',  ac:'Arts plastiques',    m3:null,                  s3:'Biologie-Chimie' },
  { id:E(14), prenom:'Sam',      nom:'Smith',      classe:'5TT B', dob:'2008-05-19', p1n:'Smith',     p1f:'Fred',       p1t:'0491 00 11 22', p2n:'Smith',       p2f:'Kate',      p2t:'0478 22 33 44',philo:'Morale non confessionnelle',   solde:-60.00,  obs:'Sciences generales',  ac:'Langues modernes',   m3:'Mathematiques 4h',    s3:null },
  { id:E(15), prenom:'Adele',    nom:'Adkins',     classe:'6TT A', dob:'2007-05-05', p1n:'Adkins',    p1f:'Mark',       p1t:'0467 44 55 66', p2n:'Adkins',      p2f:'Penny',     p2t:'0479 66 77 88',philo:'Morale non confessionnelle',   solde:-175.00, obs:'Sciences generales',  ac:'Arts plastiques',    m3:'Mathematiques 4h',    s3:'Biologie' },
  { id:E(16), prenom:'Pharrell', nom:'Williams',   classe:'6GT B', dob:'2007-04-05', p1n:'Williams',  p1f:'Pharaoh',    p1t:'0482 88 99 00', p2n:'Williams',    p2f:'Carolyn',   p2t:'0474 00 11 22',philo:'Cours de religion baptiste',   solde: 90.00,  obs:'Sciences generales',  ac:'Musique',            m3:'Mathematiques 6h',    s3:'Physique-Chimie' },
  { id:E(17), prenom:'Alicia',   nom:'Keys',       classe:'6GT A', dob:'2007-01-25', p1n:'Augello',   p1f:'Terria',     p1t:'0470 22 33 44', p2n:null,          p2f:null,        p2t:null,           philo:'Cours de religion catholique', solde: 15.00,  obs:'Sciences generales',  ac:'Sciences humaines',  m3:'Mathematiques 4h',    s3:'Biologie' },
  { id:E(18), prenom:'John',     nom:'Legend',     classe:'6GT C', dob:'2007-12-28', p1n:'Stephens',  p1f:'Ronald',     p1t:'0489 44 55 66', p2n:'Stephens',    p2f:'Phyllis',   p2t:'0461 66 77 88',philo:'Cours de religion baptiste',   solde:-95.00,  obs:'Sciences generales',  ac:'Arts plastiques',    m3:'Mathematiques 4h',    s3:null },
  { id:E(19), prenom:'Chris',    nom:'Martin',     classe:'6TT B', dob:'2007-03-02', p1n:'Martin',    p1f:'Anthony',    p1t:'0496 88 99 00', p2n:'Martin',      p2f:'Allison',   p2t:'0475 00 11 22',philo:'Morale non confessionnelle',   solde:  5.00,  obs:'Sciences generales',  ac:'Musique',            m3:'Mathematiques 6h',    s3:'Chimie' },
  { id:E(20), prenom:'Shakira',  nom:'Mebarak',    classe:'6GT D', dob:'2007-02-02', p1n:'Mebarak',   p1f:'William',    p1t:'0483 22 33 44', p2n:'Ripoll',      p2f:'Nidia',     p2t:'0466 44 55 66',philo:'Islam',                        solde: 30.00,  obs:'Sciences generales',  ac:'Langues modernes',   m3:'Mathematiques 4h',    s3:'Biologie-Chimie' },
]

const eleves = STARS.map((s, i) => ({
  id:                   s.id,
  prenom:               s.prenom,
  nom:                  s.nom,
  classe:               s.classe,
  date_naissance:       s.dob,
  nationalite:          'Belge',
  rue:                  `${RUES[i % 10]} ${(i + 1) * 7}`,
  code_postal:          CP[i % 10],
  commune:              COMMUNES[i % 10],
  pays:                 'Belgique',
  email:                `${s.prenom.toLowerCase()}.${s.nom.toLowerCase().replace(/\s/g,'')}@example-demo.be`,
  telephone:            null,
  mobile:               s.p1t,
  matricule:            `DEMO${String(i + 1).padStart(3, '0')}`,
  philosophie:          s.philo,
  groupe_choix_philo:   `Groupe ${'ABC'[i % 3]}`,
  obs_d2:               s.obs,
  ac_d2:                s.ac,
  math_d3:              s.m3,
  sciences_d3:          s.s3,
  bio_physique_d3:      null,
  obs1_d3: null, obs2_d3: null, ac_d3: null,
  nom_responsable_1:    s.p1n,
  prenom_responsable_1: s.p1f,
  tel_responsable_1:    s.p1t,
  nom_responsable_2:    s.p2n,
  prenom_responsable_2: s.p2f,
  tel_responsable_2:    s.p2t,
  nom_responsable_3: null, prenom_responsable_3: null, tel_responsable_3: null,
  solde:                s.solde,
  actif:                true,
  remarque:             null,
  smartschool_username:         null,
  smartschool_internal_number:  null,
}))

// En mode demo, l'apercu Responsable affiche Billie Eilish + Post Malone
// Le wildcard '*' dans responsable_id match n'importe quel user.id connecte
const responsable_eleve = [
  {
    responsable_id: '*', eleve_id: E(1),
    eleve: { id:E(1), prenom:'Billie', nom:'Eilish', classe:'1A', date_naissance:'2012-12-18' },
  },
  {
    responsable_id: '*', eleve_id: E(2),
    eleve: { id:E(2), prenom:'Post', nom:'Malone', classe:'1B', date_naissance:'2012-07-04' },
  },
]

// ── Activites ─────────────────────────────────────────────────────────────
const ACT1 = 'demo-act-001'
const ACT2 = 'demo-act-002'
const ACT3 = 'demo-act-003'

const activites = [
  { id:ACT1, nom:'Voyage culturel a Amsterdam', description:'Sejour 3 jours - Rijksmuseum, Anne Frank, velo en ville', date_debut:`${sy+1}-03-12`, date_fin:`${sy+1}-03-14`, lieu:'Amsterdam, Pays-Bas', local:false, statut:'publie', statut_facturation:'a_facturer', montant_total:4800, pop:200 },
  { id:ACT2, nom:'Visite du Parlement europeen', description:'Journee decouverte des institutions europeennes a Bruxelles', date_debut:`${sy}-11-15`, date_fin:`${sy}-11-15`, lieu:'Bruxelles', local:true, statut:'publie', statut_facturation:'facture', montant_total:540, pop:0 },
  { id:ACT3, nom:'Journee sportive annuelle', description:'Escalade, orientation, activites de cohesion en plein air', date_debut:`${sy+1}-05-20`, date_fin:`${sy+1}-05-20`, lieu:'Foret de Soignes', local:false, statut:'publie', statut_facturation:'a_facturer', montant_total:1800, pop:0 },
]

// ── Articles ──────────────────────────────────────────────────────────────
const ART1 = 'demo-art-001'
const ART2 = 'demo-art-002'
const ART3 = 'demo-art-003'

const articles = [
  { id:ART1, nom:`Agenda scolaire ESPM ${sy}-${sy+1}`, categorie:'Fournitures scolaires', prix_unitaire:12.50, annee_scolaire:`${sy}-${sy+1}` },
  { id:ART2, nom:'Assurance scolaire annuelle',         categorie:'Frais obligatoires',    prix_unitaire:25.00, annee_scolaire:`${sy}-${sy+1}` },
  { id:ART3, nom:'Cotisation APE',                      categorie:'Frais obligatoires',    prix_unitaire:10.00, annee_scolaire:`${sy}-${sy+1}` },
]

// ── Attributions articles ─────────────────────────────────────────────────
const article_attributions = eleves.flatMap((el, i) => [
  { id:`demo-aa-${i}-1`, article_id:ART1, eleve_id:el.id, quantite:1, nb_eleves:1, prix_unitaire_applique:12.50, statut_facturation: i < 10 ? 'a_facturer' : 'facture', article:{ categorie:'Fournitures scolaires', prix_unitaire:12.50 } },
  { id:`demo-aa-${i}-2`, article_id:ART2, eleve_id:el.id, quantite:1, nb_eleves:1, prix_unitaire_applique:25.00, statut_facturation:'facture',   article:{ categorie:'Frais obligatoires', prix_unitaire:25.00 } },
  { id:`demo-aa-${i}-3`, article_id:ART3, eleve_id:el.id, quantite:1, nb_eleves:1, prix_unitaire_applique:10.00, statut_facturation:'facture',   article:{ categorie:'Frais obligatoires', prix_unitaire:10.00 } },
])

// ── Factures ──────────────────────────────────────────────────────────────
const factures = eleves.flatMap((el, i) => {
  const rows = [
    { id:`demo-f-${i}-1`, eleve_id:el.id, montant:250.00, date:past(90), libelle:'Frais scolaires 1er trimestre' },
    { id:`demo-f-${i}-2`, eleve_id:el.id, montant:12.50,  date:past(80), libelle:'Agenda scolaire' },
    { id:`demo-f-${i}-3`, eleve_id:el.id, montant:25.00,  date:past(80), libelle:'Assurance scolaire' },
    { id:`demo-f-${i}-4`, eleve_id:el.id, montant:10.00,  date:past(80), libelle:'Cotisation APE' },
  ]
  if (i < 5) rows.push({ id:`demo-f-${i}-5`, eleve_id:el.id, montant:180.00, date:past(20), libelle:'Voyage Amsterdam - acompte' })
  return rows
})

// ── Paiements ─────────────────────────────────────────────────────────────
const paiements = eleves.map((el, i) => {
  const totalFact = 297.50 + (i < 5 ? 180 : 0)
  const paid = totalFact + el.solde
  return { id:`demo-p-${i}-1`, eleve_id:el.id, montant: Math.max(0, parseFloat(paid.toFixed(2))), date:past(60), libelle:'Virement bancaire' }
})

// ── Echelonnements ────────────────────────────────────────────────────────
const echelonnements = [
  { id:'demo-ech-001', eleve_id:E(5),  montant:450.00, nombre_echeances:6, date_debut:past(60),  mensualite:75.00, statut:'en_cours',     remarque:'Plan convenu avec la famille.' },
  { id:'demo-ech-002', eleve_id:E(8),  montant:600.00, nombre_echeances:8, date_debut:past(90),  mensualite:75.00, statut:'non_respecte', remarque:'Relance envoyee le ' + past(10) + '.' },
  { id:'demo-ech-003', eleve_id:E(10), montant:350.00, nombre_echeances:5, date_debut:past(150), mensualite:70.00, statut:'en_cours',     remarque:'Accord verbal parents.' },
  { id:'demo-ech-004', eleve_id:E(15), montant:525.00, nombre_echeances:7, date_debut:past(210), mensualite:75.00, statut:'non_respecte', remarque:'Dossier transmis a la direction.' },
  { id:'demo-ech-005', eleve_id:E(18), montant:285.00, nombre_echeances:3, date_debut:past(120), mensualite:95.00, statut:'termine',      remarque:'Cloture - solde apure.' },
]

// ── Organismes tiers ──────────────────────────────────────────────────────
const organismes_tiers = [
  { id:'demo-ot-001', eleve_id:E(1),  organisme:'CPAS',  statut:'en_cours', montant_accorde:180.00, notes:'Dossier ouvert.' },
  { id:'demo-ot-002', eleve_id:E(2),  organisme:'SPJ',   statut:'valide',   montant_accorde:300.00, notes:'Accord recu.' },
  { id:'demo-ot-003', eleve_id:E(9),  organisme:'ULB',   statut:'en_cours', montant_accorde:250.00, notes:'En attente de confirmation.' },
  { id:'demo-ot-004', eleve_id:E(14), organisme:'CPAS',  statut:'valide',   montant_accorde:240.00, notes:'Versement effectue.' },
  { id:'demo-ot-005', eleve_id:E(8),  organisme:'Autre', statut:'en_cours', montant_accorde:150.00, notes:'Contact en cours.' },
]

// ── Notifications demo ────────────────────────────────────────────────────
const notifications = [
  { id:'demo-notif-1', user_id:'*', message:'Nouvelle activite : Voyage culturel a Amsterdam', lue:false, created_at:ts(2), activite_id:ACT1 },
  { id:'demo-notif-2', user_id:'*', message:'Rappel : Journee sportive annuelle - inscriptions ouvertes', lue:false, created_at:ts(5), activite_id:ACT3 },
]

const demoData = {
  eleves,
  responsable_eleve,
  factures,
  paiements,
  activites,
  articles,
  article_attributions,
  echelonnements,
  organismes_tiers,
  notifications,
  appels_responsables: [],
  commentaires: [],
  profiles: [],
  groupes: [],
  activite_groupes: [],
  activite_documents: [],
}

export default demoData
