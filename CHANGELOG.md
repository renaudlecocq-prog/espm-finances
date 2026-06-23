# Changelog — ESPM+

Format : `[Commit] — Description — Rollback`  
**Ordre : du plus ancien au plus récent (nouvelles entrées en bas).**

---

## Comment faire un rollback

### Rollback d'un fichier précis
```bash
git checkout <commit_hash> -- src/pages/MonFichier.jsx
git commit -m "rollback: revenir à version <commit_hash> pour MonFichier.jsx"
git push origin main
```

### Rollback complet à un commit précis
```bash
git revert <commit_hash>
git push origin main
# Puis redéployer sur staging pour vérifier, puis sur prod
```

## Règles de déploiement (rappel)

- **staging** → `espmaritime-staging.netlify.app` (vérification avant mise en ligne)
- **production** → `espmaritime.netlify.app`
- ⚠️ **Jamais déployer en production sans mot-clé explicite de Renaud** : "go prod", "feu vert", "go main", "ok sur main", "déploiement sur main"
- Toujours cloner `main` depuis GitHub avant tout build
- Le proxy-path Netlify est temporaire — en redemander un via le MCP à chaque session

---

## v0.1 — 2026-06-18 (deploy/fix)

| Commit | Fichier | Changement | Rollback |
|--------|---------|------------|----------|
| `c1de3e3` | `netlify.toml` | Ajout `NODE_VERSION = "22"` | `git revert c1de3e3` |
| `1956e81` | `Home.jsx` | Restauration version sparklines avec calcul dynamique | `git revert 1956e81` |
| `486682e` | `App.jsx` | Route `/assistant-social` requiert rôle `financier` | `git revert 486682e` |
| `6e3b425` | `Header.jsx` | Menu "Assist. social" visible uniquement admin+financier | `git revert 6e3b425` |
| `36394c9` | `AuthContext.jsx` | Ajout `viewAsRole`, `effectiveRole`, `isMdpOnly` | `git revert 36394c9` |
| `aa54eeb` | `AuthContext.jsx` | Ajout aliases `previewRole`/`setPreviewRole` | `git revert aa54eeb` |
| `56ca23f` | `Header.jsx` | Nouveau header sombre, logo Plurielle, bouton Smartschool orange | `git revert 56ca23f` |
| `81d4cba` | `AssistantSocial.jsx` | Page complète : échelonnements + organismes tiers + fiches élèves | `git revert 81d4cba` |

---

## v0.2 — 2026-06-18 (workflow + AssistantSocial)

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `0e98a41` | `AssistantSocial.jsx` | `EchelonnementForm` converti en modal overlay | `git revert 0e98a41` |
| `21bb81b` | `AssistantSocial.jsx` | Formulaire Organismes Tiers converti en modal overlay | `git revert 21bb81b` |
| `797c237` | `AssistantSocial.jsx` | Date de début éditable + recalcul auto des échéances | `git revert 797c237` |
| `9ed4590` | `AssistantSocial.jsx` | Bandeau d'alerte si somme mensualités ≠ montant total | `git revert 9ed4590` |

### 🏗 Infrastructure

| Quoi | Détail |
|------|--------|
| **Site staging créé** | `https://espmaritime-staging.netlify.app` (siteId: `ed7d1504-00ab-47c6-ad1f-63c0c755abbc`) |
| **Branche GitHub** | Renommage `develop` → `main` (branche unique) |
| **Nouveau workflow** | Code → sandbox → staging → production sur "go prod" explicite |

---

## v0.4 — 2026-06-19 (commentaires + UX slide-ins)

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `10c7cff` | `Echelonnements.jsx` | Nouveau panneau slide-in éditable + bouton "Fiche élève" | `git revert 10c7cff` |
| `df23e90` | `AssistantSocial.jsx` | Bouton "Fiche élève" dans EchelonnementDetail | `git revert df23e90` |
| `356c1c0` | `Eleves.jsx` | Suppression colonne Actions + badges AS colorés | `git revert 356c1c0` |
| `445a782` | `Eleves.jsx` | Tableau pleine largeur après suppression colonne Actions | `git revert 445a782` |
| `9ac9799` | `Commentaires.jsx` + `NotificationBell.jsx` + `Header.jsx` + `AssistantSocial.jsx` + `Activites.jsx` + DB | Système complet commentaires/messagerie + notifications Realtime. Tables `commentaires` + `notifications` avec RLS | `git revert 9ac9799` |
| `ba3206d` | `AssistantSocial.jsx` + `Activites.jsx` | Commentaires en colonne gauche dans tous les slide-ins. ActivityModal converti en slide-in | `git revert ba3206d` |
| `02e958d` | `Activites.jsx` | Carte activité cliquable (ouvre le slide-in) + suppression bouton "Modifier" | `git revert 02e958d` |

---

## v0.5 — 2026-06-19 (rôles OAuth + UX activités)

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `db7c7a6` | `smartschool-callback.mjs` + DB | **OAuth Smartschool → rôle automatique** : Direction/Enseignant/Autre → MdP ; co-compte → Responsable ; Élève → bloqué. Rôles admin/financier jamais écrasés | `git revert db7c7a6` |
| `65a218f` | `Activites.jsx` + DB | Accompagnateurs peuvent ouvrir le slide-in et commenter (`canView` distinct de `canEdit`). Signup sans rôle par défaut (trigger `handle_new_user` → `NULL`) | `git revert 65a218f` |
| `ae05f4a` | `Activites.jsx` | Carte réorganisée en 4 lignes : titre+badges / classes+groupes / métadonnées / personnel | `git revert ae05f4a` |
| `6106411` | `Activites.jsx` | Accompagnateurs affichés sur la carte (couleur teal), distincts du responsable (violet) | `git revert 6106411` |
| `f9ecdd6` | `Activites.jsx` | Bouton "Supprimer" visible uniquement pour l'admin (avec confirmation) | `git revert f9ecdd6` |
| `e08cfb3` | `Activites.jsx` | Fix débordement horizontal du dropdown `MultiSearchSelect` | `git revert e08cfb3` |
| `2be0499` | `Activites.jsx` | Fix `min-w-0` grille personnel + logique non-destructive | `git revert 2be0499` |
| `2c1f5b6` | `Activites.jsx` | Responsable et accompagnateurs mutuellement exclusifs | `git revert 2c1f5b6` |
| `c088dda` | `Activites.jsx` | Puces classes/groupes sur la carte (max 6 + overflow "+N") | `git revert c088dda` |
| `0d1af49` | `Activites.jsx` | Statut en boutons visuels (Brouillon / Publié / Archivé). Auto-sauvegarde brouillon si fermeture accidentelle | `git revert 0d1af49` |

### 🗄 Migrations Supabase

| Migration | Changement |
|-----------|------------|
| `fix_profiles_select_all_authenticated` | Policy `profiles_select` étendue à tous les utilisateurs authentifiés |
| `handle_new_user_read_role_from_metadata` / `fix_handle_new_user_default_role_null` | Trigger : signup sans rôle par défaut (`NULL`) |

---

## v0.6 — 2026-06-19 (notifications)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `fee214e` | `Commentaires.jsx` + `Activites.jsx` + `AssistantSocial.jsx` | Journal d'activité dans le chat : événements système (modification de champs, ajout/suppression de documents). Fenêtre chat élargie. Migration Supabase : colonnes `type` et `meta` sur `commentaires`. | `git revert fee214e` |
| `a5eeafa` | `Activites.jsx` | Pill "Mes activités" masquée pour les MdP | `git revert a5eeafa` |
| `ef6ed03` | `Activites.jsx` | Affichage `local` (intramuros) sur la carte. Pills de filtre rapide Passées/À venir/Mes activités. Signal visuel pastel vert/rouge. | `git revert ef6ed03` |
| `3e6fbec` | `NotificationBell.jsx` | Bouton "Vider" pour supprimer toutes les notifications | `git revert 3e6fbec` |
| `e1a5d42` | `NotificationBell.jsx` + `Activites.jsx` | Deep-link notification → ouvre le slide-in de l'activité concernée (`?open=<id>`). Badge rouge messages non-lus sur les cartes. | `git revert e1a5d42` |

---

## v0.7 — 2026-06-19 (fix documents)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `a395099` | `Activites.jsx` | Bouton toggle En attente ↔ À facturer sur les cards. Archiver et Supprimer déplacés dans le footer du slide-in. | `git revert a395099` |
| `83bce34` | `Activites.jsx` + DB | Statut facturation : 4 valeurs (en_attente, a_facturer, facture, non_payant). Auto-calcul non_payant si montant=0. Contrainte CHECK DB étendue. | `git revert 83bce34` |
| `7ceb04e` | `Activites.jsx` | Mise à jour dynamique des boutons Docs/Factures : `reloadDocsSets` callback passé à `DocsModal`. | `git revert 7ceb04e` |
| `26ae229` | `Activites.jsx` | Fix couleur boutons : `select('activite_id, categorie')` → Sets docs/factures corrects. | `git revert 26ae229` |
| `1047c58` | `Activites.jsx` | Boutons Docs/Factures colorés si fichiers présents. `logEvent` dans upload/suppression. | `git revert 1047c58` |
| `a6b901c` | `Activites.jsx` | Fix journal : `useAuth()` manquant dans `ActivityModal` → auteur_id null. Icône trombone sur les cards avec docs. | `git revert a6b901c` |
| `4aef92e` | `Activites.jsx` | Affichage des documents sauvegardés dans le slide-in. Rechargement après upload. Boutons Voir (signed URL) et Suppr. | `git revert 4aef92e` |
| `0495fef` | `Activites.jsx` | Fix upload : sanitize du nom de fichier dans le chemin storage (diacritiques + espaces). | `git revert 0495fef` |
| `db04343` | `Activites.jsx` | Fix upload : `contentType: 'application/pdf'` forcé — Windows remonte parfois un MIME type vide. | `git revert db04343` |
| `f0ed999` | `Activites.jsx` | Fix critique : noms de colonnes corrects pour `activite_documents` (`nom_fichier`, `storage_path`). | `git revert f0ed999` |

---

## v0.8 — 2026-06-20 (logo + fiche responsable)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| DB | `commentaires` | Contrainte `message_check` assouplie : `type = 'system' OR char_length(message) > 0`. | Migration SQL manuelle |
| DB | `appels_responsables` | Nouvelle table : historique des appels passés aux responsables. RLS : INSERT tous, SELECT/UPDATE admin+financier, DELETE admin. | Migration SQL manuelle |
| `8d2cd04` | `FicheEleve.jsx` | Bouton Appel masqué pour le profil MdP. | `git revert 8d2cd04` |
| `26fcee0` | `FicheEleve.jsx` + `smartschool-photo.mjs` | Photo Smartschool dans le header de la fiche (fallback initiales). Nouvelle fonction Netlify `smartschool-photo.mjs`. | `git revert 26fcee0` |
| `2eb59a3` | `FicheEleve.jsx` | Fix canSeeRestricted : utilise `isAdmin\|\|isFinancier`. Sections échelonnements/historique appels visibles pour admin/financier. | `git revert 2eb59a3` |
| `c8e6691` | `smartschool-photo.mjs` + `smartschool-sync.mjs` | Fix URL SOAP : `webservices` → `Webservices` (majuscule). | `git revert c8e6691` |
| `7f789df` | `FicheEleve.jsx` | Fix photo Smartschool : utilise `smartschool_internal_number` comme `userIdentifier`. | `git revert 7f789df` |
| `9fce5ff` | `FicheEleve.jsx` | Historique appels : icône édition toujours visible, bouton Voicemail en 1 clic. | `git revert 9fce5ff` |
| `cdee9a5` | `FicheEleve.jsx` + `AssistantSocial.jsx` | Refonte complète fiche élève : identité, groupes scolaires, responsables + bouton appel, suivi social, financier, historique appels. | `git revert cdee9a5` |
| `5054e11` | `Header.jsx` + `Home.jsx` + `index.html` | Rebranding ESPM+ : icône GraduationCap + texte "ESPM+" (+ orange). | `git revert 5054e11` |
| `cc7b27a` | `Header.jsx` | Logo école (favicon.svg, filtre blanc) dans le header. | `git revert cc7b27a` |
| `c22fc71` | `Header.jsx` + `public/favicon.svg` | Logo ESPM+ : icône cercle biton blanc/orange. Début d'identité visuelle. | `git revert c22fc71` |
| `9c95ef2` | `index.html` | Fix favicon : référence `favicon.svg` en priorité, `favicon.png` en fallback. | `git revert 9c95ef2` |
| `0188595` | `Header.jsx` + `public/logo-ecole.svg` + `public/favicon.svg` | Logo école SVG extrait du .ai. Favicon : carré blanc + "+" orange. | `git revert 0188595` |
| `75bc6eb` | `public/logo-ecole.svg` + `Header.jsx` | Logo école recolorisé : pentagone blanc, bonhomme orange (#E86C00). | `git revert 75bc6eb` |
| `f0ce1e9` | `Home.jsx` | Page d'accueil responsable : fiche de l'enfant pleine page (photo, identité, groupes, responsables légaux, suivi social sans notes internes, solde). Support multi-enfants (onglets). | `git revert f0ce1e9` |

---

## v0.9 — 2026-06-20 (mode démo)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `b4bcdbe` | `demoData.js` + `supabaseMock.js` + `DemoContext.jsx` + `App.jsx` + `Header.jsx` | Mode démo : 20 élèves fictifs (stars de la musique — Billie Eilish, Taylor Swift, Adele, Bruno Mars…). Client Supabase mocké (MockQuery/MockTable thenable). Monkey-patch synchrone de `supabase.from()`. Bannière orange + header brun en mode démo. Aperçu Responsable → Billie Eilish + Post Malone. | `git revert b4bcdbe` |
| `29e0de0` | `DemoContext.jsx` + `App.jsx` + `Admin.jsx` + `Home.jsx` | Fix : `profiles`/`sync_log` passent par le vrai Supabase. Bannière démo : switcher de rôle (Admin/Financier/MdP/Responsable). Admin > Droits : bloc toggle mode démo. HomeResponsable : fallback démo si aucun élève lié. | `git revert 29e0de0` |
| `a1870a0` | `App.jsx` + `Header.jsx` + `demoData.js` | Fix critique : RequireAuth utilise `effectiveRole` (aperçu bloque l'accès par URL directe). Header : label de rôle effectif + `↩` si aperçu. Billie/Post : fratrie cohérente, Billie=échelonnement, Post=OT SPJ. | `git revert a1870a0` |
| `343fef1` | `Home.jsx` + `Header.jsx` | Échéancier mensuel dans HomeResponsable (✓ Payé / ⚠ En retard / ◌ À venir). Bouton démo retiré du header → uniquement Admin > Droits. | `git revert 343fef1` |

---

## v0.10 — 2026-06-20 (facturation)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `4151f19` | `Factures.jsx` + migration SQL | Système de facturation complet : table `facture_lignes` + colonnes `solde_avant`/`solde_apres` sur `factures` + `facture_id` sur `article_attributions`. Wizard par élève (articles + activités en attente, sélection, solde avant/après). Vue liste + vue détail facture. Correction des champs (`date` pas `date_emission`, statuts corrects). | `git revert 4151f19` |

## [v0.10b] - 2026-06-20

### Refactored
- **Factures — modal slideout** : "Nouvelle facture" ouvre un panneau latéral (plus de navigation de page)
- **Facturation par groupe/classe** : le panneau liste directement les articles et activités à facturer, sans étape de sélection d'élève
- Filtre optionnel par classe pour cibler les factures sur un sous-ensemble d'élèves
- Case à cocher par item + bouton "Tout sélectionner / désélectionner" par section
- Aperçu en pied de panneau : nb élèves + montant total avant génération
- Génération batch : une facture par élève affecté, regroupant tous les items qui le concernent
- Mise à jour automatique du statut articles et activités → `facture` après génération
- Écran de succès avec compteur de factures créées

**Commit :** `1dd7738`

## [v0.10c] - 2026-06-20

### Changed
- **Factures — modal centré** : panneau de facturation affiché au centre de la page (max-w-2xl, max-h-90vh) au lieu du slide-in latéral
- **Filtre classes en pill dropdown** : un seul bouton-pill "Ignorer des classes" ouvre un menu déroulant avec cases à cocher (style cohérent avec MasterFilter)
- **Logique d'exclusion** : on exclut des classes (au lieu d'en sélectionner), par défaut toutes les classes sont facturées
- Indicateur de classes ignorées dans le pied du modal et le résumé

**Commit :** `08e4cd6`

## [v0.10d] - 2026-06-20

### Added
- **Tag "Partiellement facturé"** : nouveau statut `partiellement_facture` pour articles et activités
  - Déclenché quand un run de facturation ignore certaines classes qui sont dans la cible d'un item
  - Badge bleu "Partiel" dans la liste des activités et dans le tableau des attributions (Articles)
  - L'item **réapparaît** dans la modale lors du prochain run pour facturer les classes manquantes
  - Badge "PARTIEL — N déjà fact." dans la modale pour indiquer les élèves déjà couverts

### Changed  
- **FacturationModal — logique multi-run** : charge les `facture_lignes` existantes pour les items partiels et exclut les élèves déjà facturés du calcul
- **FacturationModal — avertissement** : message explicite dans le footer quand des classes ignorées feront passer des items en "Partiel"
- Activites.jsx : filtre MasterFilter inclut l'option "Partiel"

**Commits :** `1dd7738` (modal slideout) · `08e4cd6` (modal centré + pill) · `0db2a51` (partiellement facturé)

---

## [v0.10e] - 2026-06-20

### Added
- **Logo cercle SVG** dans Header.jsx : remplacement du shield par un cercle mauve avec les initiales "EP", cohérent avec l'identité visuelle
- **Favicon.svg** mis à jour : nouveau favicon cercle mauve, remplace l'ancienne icône
- **HomeResponsable** : vue dédiée pour le rôle `responsable` sur la page d'accueil — liste des enfants liés au compte avec solde, factures et paiements en lecture seule
- **Mode démo** : accès sans authentification avec données fictives pour présentation du site, activé via paramètre URL `?demo=true`

### Fixed
- **Page blanche HomeResponsable en mode démo** : correction du chargement des données fictives pour le rôle responsable

## [v0.10f] - 2026-06-20

### Added
- **Architecture par batch** : chaque run de facturation crée un batch (table `facture_batches`) avec numéro au format `F-AAMMJJ` (ex. `F-260620`). Si plusieurs runs le même jour : `F-260620-2`, etc.
- **Navigation 3 niveaux** : Liste des batches → Détail du batch (élèves) → Détail d'une facture (lignes)
- **Action "Valider"** (par élève) : approuve une facture individuelle indépendamment du batch
- **Action "Ignorer"** (par élève) : exclut un élève du "Tout approuver" tout en laissant sa facture en attente (reversible : "↩ Réactiver")
- **Action "Supprimer"** (par élève) : supprime définitivement la facture de l'élève, avec recalcul intelligent du statut des items (`a_facturer` ou `partiellement_facture` selon les autres élèves encore couverts)
- **Reporter / Supprimer une ligne** (niveau 3) : survol d'une ligne de facture → boutons "↩ Reporter" (remet en à_facturer pour prochain run) et "× Suppr." (suppression permanente). Si la dernière ligne est supprimée, la facture entière est effacée.
- **"Tout approuver"** dans le détail d'un batch : valide toutes les factures `brouillon` (pas les `ignore`), avec compteur
- **Légende des actions** sous le tableau du batch

### Changed
- `Factures.jsx` : refonte complète — `ListeBatches` + `DetailBatch` + `DetailFacture` avec `LigneRow`
- `FacturationModal.generate()` : crée un batch avant les factures, injecte `batch_id` sur chaque facture
- Statuts facture : ajout de `ignore` (en attente délibérée)
- Badge statuts : `brouillon` → "En attente", `facture` → "Validé"

### Migration Supabase
- Table `facture_batches` : `id`, `numero`, `date`, `statut`, `created_by`, `created_at`
- `factures.batch_id` → FK vers `facture_batches`
- Batch rétroactif `F-000000` créé pour les factures existantes sans `batch_id`

---

## [v0.10h] - 2026-06-20

### Changed — UX DetailBatch
- **Layout compact** : onglets "En attente / Approuvé", recherche et bouton "Tout approuver" regroupés sur une seule ligne
- Titre de la page redevient "Factures" avec le numéro de batch en sous-titre
- Suppression du bandeau de recherche séparé dans l'en-tête de la card

---

## [v0.10g] - 2026-06-20

### Fixed — Bugs critiques
- **Statuts articles/activités prématurés** : les items restent `a_facturer` après génération d'un brouillon. Le statut `facture` n'est appliqué qu'à l'approbation effective (Valider ou Tout approuver). Seul `partiellement_facture` est appliqué à la génération (classes ignorées).
- **DB** : batch `F-000000` renommé `F-260620-01` · statuts items remis à `a_facturer` (aucune facture n'était encore approuvée).

### Changed — Nomenclature
- **Batch** : format `F-AAMMJJ-01`, `F-AAMMJJ-02`… (suffixe 2 chiffres, toujours présent). Ex : `F-260620-01`.
- **Facture individuelle** : `F-AAMMJJ-NN-MATRICULE`. Ex : `F-260620-01-230179`. Le matricule est lu depuis `eleves.matricule`.
- **Collision** : le code compte les batches existants du même jour → suffixe incrémenté correctement.

### Added — UX DetailBatch
- **Onglets "En attente" / "Approuvé"** dans le détail d'un batch pour filtrer les factures par statut.
- **Colonne "N° Facture"** dans la liste des élèves du batch (format mono-espace, sélectionnable).
- **Colonne Actions** masquée dans l'onglet "Approuvé" (factures déjà traitées).

### Changed — Modal
- Texte "Les items qui ciblent…" → "Les **éléments** qui ciblent…"

---

> **Note GitHub** : les commits de v0.10b-e n'ont pas encore été tous poussés depuis le sandbox. Seule la session 10g sera visible après le prochain push manuel.

## [v0.10h] - 2026-06-20

### Changed — UX DetailBatch
- **Layout compact** : onglets "En attente / Approuvé", recherche et bouton "Tout approuver" regroupés sur une seule ligne
- Titre de la page redevient "Factures" avec le numéro de batch en sous-titre
- Suppression du bandeau de recherche séparé dans l'en-tête de la card

---


## [v0.10i] - 2026-06-20

### Changed — UX DetailBatch (onglets + bouton)
- Remplacement des deux pills ovales par un **segmented control** (cadre unique, deux sections, fond gris, section active en blanc avec ombre)
- Compteur "En attente" affiché en chiffre sobre à droite du libellé, sans pill
- Onglet "Facturé" (renommé depuis "Approuvé"), sans compteur
- Bouton "Tout approuver" : style outlined (bordure + teinte primaire), plus léger que btn-primary

## [v0.10j] - 2026-06-20

### Changed — ListeBatches
- Colonne "N° BATCH" renommée "N° FACTURATION"
- Header aligné sur le style DetailBatch : titre + total factures + montant total coloré sur une ligne
- Ajout segmented control "En attente / Facturé" pour filtrer les runs
- Ajout champ de recherche : filtre par élève, classe ou numéro de batch
- Montant total dans le tableau coloré en primary
- Compteur "runs de facturation" → "factures générées"

### Changed — DetailBatch
- Bouton "← Retour aux batches" remplacé par bouton "← Retour" intégré dans la barre de contrôles (même ligne que les onglets), coloré en mauve/primary

## [v0.10k] - 2026-06-20

### Fixed — DetailBatch actions
- **Ignorer** : mise à jour locale immédiate (optimistic update) — plus de flash "Chargement…" ni d'attente visible
- **Valider** : idem, mise à jour locale immédiate
- **Supprimer** : la facture disparaît instantanément du tableau sans rechargement complet
- **Bouton "Tout approuver"** : label devient "Approuver X élèves" (sans "Tout") dès qu'au moins une facture est ignorée, pour refléter que certains sont exclus

## [v0.10l] - 2026-06-20

### Fixed — DetailBatch
- **Tout approuver** : remplacement de `.in('id', [644 ids])` par `.eq('batch_id').eq('statut','brouillon')` — évite le dépassement de limite URL PostgREST qui faisait échouer silencieusement l'approbation massive
- Mise à jour locale immédiate après `toutApprouver` (plus de rechargement complet)
- Les factures ignorées sont correctement exclues car leur statut est `ignore` (pas `brouillon`)

### Note — Nomenclature individuelle
- Le code de génération est correct : `F-AAMMJJ-NN-MATRICULE`
- Les factures affichant `F-AAAA-NNN` sont des données legacy créées avec l'ancien code

## [v0.10m] - 2026-06-20

### Fixed — Statut articles/activités après approbation partielle
- `mettreAJourItemsApresApprobation` gère désormais 3 cas :
  - Toutes les factures approuvées → `facture`
  - Certaines approuvées, d'autres ignorées/en attente → `partiellement_facture`
  - Aucune encore approuvée → `a_facturer`
- Requêtes chunckées par 50 pour éviter les limites URL PostgREST

## [v0.10n] - 2026-06-20

### Fixed — Race condition ignorerFacture / toutApprouver
- `ignorerFacture` appelle désormais `setBusy(true/false)` — le bouton "Approuver X élèves" reste désactivé pendant le save Supabase de l'ignore, évitant qu'un étudiant ignoré soit quand même marqué `facture` si l'utilisateur cliquait immédiatement après

### Fixed — Statuts articles/activités toujours "À facturer" après toutApprouver
- La requête initiale `.in('facture_id', [669 ids])` dans `mettreAJourItemsApresApprobation` dépassait la limite URL PostgREST et échouait silencieusement → résultat vide → aucun statut mis à jour
- Remplacement par une boucle chunked (tranches de 50), cohérente avec les autres fix PostgREST

### Fixed — Rechargement manuel après génération d'un batch
- Après génération, `onDone(batchId)` navigue directement vers le `DetailBatch` du nouveau batch au lieu de fermer le modal et attendre un rechargement manuel

### Added — Inserts par lots + barre de progression pendant génération
- `generate()` refondu : remplace 670 inserts séquentiels (≈1340 requêtes) par des inserts en lots de 50 pour les factures et de 100 pour les lignes (~15-20 requêtes au total)
- Affiche une barre de progression avec l'étape courante (Création du batch, Calcul des soldes, Génération des factures X/N, Enregistrement des lignes X/N, Mise à jour des statuts)
- Le modal est bloqué (clic backdrop et bouton ✕ désactivés) pendant la génération avec message "⚠ Ne pas fermer ni recharger la page"
- Bouton "Voir les factures générées →" à la fin au lieu de "Fermer et rafraîchir"
- La query des soldes utilise maintenant une requête globale (sans `.in()`) pour éviter la limite URL avec 670+ élèves


## [v0.10o] - 2026-06-20

### Fixed — toutApprouver : élèves ignorés quand même facturés (race condition persistante)
- La correction du `setBusy` en 10n était insuffisante : si deux "Ignorer" sont cliqués en succession rapide, deux `ignorerFacture` tournent en parallèle ; quand le premier se termine, `setBusy(false)` libère le bouton "Approuver" alors que le second save n'a pas encore atteint la DB
- Solution radicale : `toutApprouver` utilise désormais les IDs **depuis l'état local** (pas un filtre DB `.eq('statut','brouillon')`). L'optimistic update de `ignorerFacture` exclut les élèves ignorés du state local IMMÉDIATEMENT (avant même le save Supabase), donc `ids` ne les contient jamais, quelle que soit la vitesse de la DB
- Le `.update().in('id', ids)` est découpé en tranches de 50 pour respecter les limites URL PostgREST

## [v0.11] - 2026-06-20

### Fixed — calcStatut : statuts articles/activités toujours "À facturer"
- Remplacement de l'approche "paginer des milliers d'IDs en chunks de 50" (≥94 requêtes séquentielles pour un seul article avec 7 batches de test) par 2 requêtes parallèles utilisant un JOIN PostgREST
- `facture_lignes JOIN factures!inner` + `.eq('factures.statut', ...)` → la DB fait le join, zéro pagination côté client
- Logique : nbBrouillon=0 + nbApproved>0 → 'facture' ; nbBrouillon>0 + nbApproved>0 → 'partiellement_facture' ; sinon → 'a_facturer'
- Les factures ignorées ne bloquent plus la transition vers 'facture' (seules les brouillon comptent comme "en attente")

### Changed — Articles : tableau attributions redesigné
- Header "Notes" renommé "Statut" (le header pointait déjà sur la colonne des badges statut, le texte était trompeur)
- Colonne "Notes" (texte libre, toujours vide = "—") supprimée du tableau — la saisie reste dans le formulaire
- `__ALL__` remplacé par "Tous les élèves" dans la colonne Attribution
- Boutons "Modifier" / "Supprimer" remplacés par icônes SVG crayon/corbeille (gain de place)
- Boutons désactivés (opacité 30%, curseur interdit) quand `statut_facturation === 'facture'`


## [v0.11b] - 2026-06-21

### Fixed
- **calcStatut** : l'approche par JOIN PostgREST (`factures!inner` + `.eq('factures.statut', ...)` + `head:true`) retournait systématiquement count=0, ce qui forçait le statut à "À facturer". Retour à l'approche chunked fiable : récupère les `facture_id` depuis `facture_lignes`, puis count par statut en lots de 50 avec early-exit dès que les deux catégories sont trouvées.
- **Statut "Partiel"** : les factures `ignore` comptent désormais comme "non facturé" (comme `brouillon`), donc un article avec des élèves ignorés affiche bien "Partiellement facturé" plutôt que "Facturé".

## [v0.11c] - 2026-06-21

### Fixed
- **calcStatut** : `{ count: 'exact', head: true }` retourne `count: null` dans Supabase JS v2, causant un faux "À facturer". Remplacé par `select('id')` sans `head:true` + `.length` sur `data` — fiable et simple (≤50 lignes/chunk).

## [v0.11d] - 2026-06-21

### Simplified
- **Statut articles/activités** : suppression du statut "Partiellement facturé". Après approbation d'un batch, les articles et activités sont directement marqués "Facturé". Un élève ignoré = décision consciente, l'article est considéré traité. Approche directe sans calcul de statut complexe.

## [v0.11e] - 2026-06-21

### Changed
- **calcStatut** : logique binaire — "Facturé" seulement si TOUS les élèves ont statut='facture' (ignore = non facturé). 1 requête par chunk avec `.neq('statut','facture').limit(1)`, early exit dès le premier élève non-facturé trouvé.

## [v0.12] - 2026-06-21

### Fixed
- **Crash DetailFacture** : `activByCat` référencé mais jamais défini → ReferenceError. Les activités s'affichent maintenant en liste plate (pas de sous-catégories).
- **removeLigne** : suppression de `{ count: 'exact', head: true }` (retourne null en Supabase JS v2) + suppression de `partiellement_facture` (statut supprimé). Reporter une ligne remet toujours l'article/activité à `a_facturer`.

### Changed  
- **Clic sur N° facture** au lieu du nom élève pour ouvrir le détail — le numéro est maintenant un lien cliquable (texte primaire souligné au survol), le nom reste en texte simple.

## [v0.13] - 2026-06-21

### Added
- **Auto-tab** : dans `ListeBatches` et `DetailBatch`, passage automatique sur l'onglet "Facturé" au chargement si aucun élément n'est en attente (dans les deux pages).

### Changed
- **Row cliquable dans DetailBatch** : toute la ligne est désormais cliquable (comme dans `ListeBatches`) — le N° de facture est toujours souligné pour indiquer la cliquabilité. `stopPropagation` sur la colonne des boutons d'action.
- **FacturationModal** : suppression du Step 6 "marquer partiellement" (statut `partiellement_facture` supprimé depuis session 11e). Numérotation fallback basée sur l'index au lieu d'un `head:true` count.

### Fixed
- **supprimerFacture** : suppression de `{ count: 'exact', head: true }` (retourne null) et de `partiellement_facture`. Recalcul correct du statut via `calcStatutSuppr` (même logique binaire que `calcStatut`).

## [v0.14] - 2026-06-21

### Added
- **Calcul des impayés chronologique** : helper `calcImpayes(allFactures, paiementsMap)` — pour chaque élève, les paiements sont alloués aux factures dans l'ordre chronologique (la 1ère facture est couverte en premier). Retourne un map `factureId → montantImpayé`.
- **Colonne "Impayés"** dans `ListeBatches` (à côté de "Total") : montant impayé total par batch en rouge, "—" si tout est payé.
- **Colonne "Impayé"** dans `DetailBatch` (à côté de "Solde après") : montant impayé par facture individuelle en rouge.
- **Onglet "Impayés"** (rouge) dans les deux vues — filtre les batches/factures avec impayé > 0.

### Changed
- **"Solde après"** dans `DetailBatch` : couleur négative changée de rouge → orange (`text-orange-500`) pour différencier du rouge "Impayé".
- `DetailBatch.load()` : charge en parallèle les factures et paiements des élèves du batch (chunked par 50) pour calculer les impayés.
- `ListeBatches.load()` : charge en parallèle toutes les factures approuvées + paiements pour agréger les impayés par batch.

## [v0.15] - 2026-06-21

### Fixed
- **FacturationModal** : les activités en statut "Brouillon" n'apparaissaient pas dans la liste des éléments à facturer car le filtre `.eq('statut', 'publie')` les excluait. Suppression de ce filtre — seul `statut_facturation = 'a_facturer'` compte pour la facturation, pas le statut de publication.

## [v0.16] - 2026-06-21

### Changed
- **Activites.jsx — formulaire** : suppression des boutons Brouillon/Publié dans le corps du formulaire. Remplacé "Enregistrer" par deux boutons dans le footer : **"✓ Publier"** (primary, enregistre avec `statut='publie'`) et **"✎ Brouillon"** (secondaire gris, enregistre avec `statut='brouillon'`).
- **Statut facturation** : les options "À facturer" et "Facturé" sont désactivées (opacité 30%, cursor not-allowed, tooltip) tant que l'activité est en statut Brouillon. Seul "En attente" reste accessible.
- **Quick-toggle liste** : le bouton "À facturer / En attente" n'est plus affiché si l'activité est en Brouillon.

### Fixed  
- **Factures.jsx** : rétablissement du filtre `.eq('statut', 'publie')` dans FacturationModal — les activités brouillon n'apparaissent pas dans la facturation (comportement intentionnel).
- Apostrophe non échappée dans le `title` JSX qui cassait le build.

## [v0.17] - 2026-06-21

### Fixed
- **Double facturation** : la FacturationModal affichait des articles/activités déjà inclus dans un batch en brouillon (non encore approuvé). Au chargement, les factures en brouillon sont maintenant consultées, et leurs items exclus de la liste — impossible de les facturer deux fois. Si le batch brouillon est supprimé, les items réapparaissent automatiquement.
- Nettoyage du code mort `billedByAttr`/`billedByActiv` (logique `partiellement_facture` supprimée en session 11e).
- Filtre `in('statut_facturation', [...])` simplifié en `eq('statut_facturation', 'a_facturer')` (partiellement_facture supprimé).

## [v0.18] - 2026-06-21
### Added
- **Nom du batch** : champ texte optionnel dans la modal de facturation (ex : "Photocopies 1H", "Voyage scolaire 3A")
- Nom affiché sous le N° dans ListeBatches, dans le header de DetailBatch, et inclus dans la recherche
- **Fiche élève — section Financier** : détail complet des factures (avec nom du batch) et paiements, solde calculé dynamiquement (remplace le placeholder "disponible prochainement")
### Technical
- Migration DB : colonne `nom TEXT` ajoutée à `facture_batches`

## [v0.18b] - 2026-06-21
### Changed
- ListeBatches : nom du batch affiché en grand au-dessus, N° en petit en dessous (si nom absent, N° affiché seul en grand)

## [v0.19] - 2026-06-21
### Changed
- **Fiche élève** : restructurée en 4 onglets (Infos / Appels / Social / Financier) avec le même style pill que la page Factures
  - Onglets Appels, Social, Financier visibles uniquement pour admin/financier
  - MDP ne voit que l'onglet Infos (identité, groupes, responsables sans bouton d'appel)
  - Tab Financier : fix affichage "Responsable" (majuscule) via labels map
- **HomeResponsable** : même restructuration en 3 onglets (Informations / Suivi social / Financier)
- **Paiements.jsx** : fix valeur par défaut 'responsable' (lowercase cohérent avec PAYE_PAR_OPTIONS)

## [v0.19b] - 2026-06-21
### Changed
- Fiche élève : paiements affichent "Payé par Responsable" / "Payé par CPAS" etc.
- Fiche élève : onglet Social masqué si aucune donnée (plus d'état vide)
- Fiche élève : hauteur fixe (88vh) — plus de redimensionnement entre onglets

## [v0.20] - 2026-06-21

### Added
- **Notifications Smartschool** : nouvelle Netlify Function `smartschool-notify.mjs` (SOAP `sendMsg` V3)
  - Type `facture` : message aux co-comptes parents (co-account 1 et 2) de chaque élève lors d'une approbation
  - Type `activite` : message à une liste fixe (direction) lors de la première publication d'une activité
- **Mode test** : variable `SMARTSCHOOL_TEST_RECIPIENT` — redirige tous les messages vers un seul destinataire avec préfixe `[TEST]`
- `SMARTSCHOOL_NOTIFY_SENDER` : identifiant Smartschool de l'expéditeur (futur compte ESPM+), 'Null' si absent
- `SMARTSCHOOL_NOTIFY_DIRECTION` : JSON array des identifiants direction pour les notifications activités

### Changed
- Lien activité dans le message : deep-link `https://espmaritime.netlify.app/activites?open=<id>` (la direction peut accéder à la page)
- `SMARTSCHOOL_NOTIFY_SENDER` configuré sur le compte dédié **ESPM+**
- `DetailBatch.load()` : select étendu avec `smartschool_internal_number` sur l'élève (nécessaire pour les notifications)
- `validerFacture` + `toutApprouver` : appellent `callNotify('facture', ...)` après approbation (fire-and-forget)
- `ActivityModal.save()` : appelle notify à la première publication d'une activité (`brouillon → publie`)

## [v0.19c] - 2026-06-21
### Changed
- Fiche élève : point orange retiré de l'onglet Social (l'onglet est déjà masqué si pas de données)
- Fiche élève : retour automatique sur l'onglet Infos à chaque nouvelle fiche ouverte

## [v0.20b] - 2026-06-21
### Changed
- Notifications activité : lien deep-link `?open=<id>` pour ouvrir le modal directement
- Expéditeur configuré sur ESPM+ (compte dédié)

## [v0.20c] - 2026-06-21
### Fixed
- `validerFacture` : suppression du guard `smartschool_internal_number` — `callNotify` appelé inconditionnellement (la fonction gère le mode test sans numéro interne)

## [v0.20d] - 2026-06-21
### Changed
- `callNotify` : ajout log console de la réponse de la fonction (debug temporaire)
- Env vars Netlify : `SMARTSCHOOL_ACCESS_CODE` staging → contexte "all" (était "production" uniquement → vide pour branch deploys)
- Env vars Netlify prod : ajout `SMARTSCHOOL_TEST_RECIPIENT = 0000281` + `SMARTSCHOOL_NOTIFY_SENDER = Null`

## [v0.20e] - 2026-06-21
### Fixed
- Sync Smartschool (erreur 19 "Parent-ID bestaat niet!") : `getAllAccountsExtended` nécessite maintenant des paramètres `$code` et `$recursive` explicites depuis la mise à jour Smartschool 2026. Passage de `<soa:code></soa:code><soa:recursive>1</soa:recursive>` pour forcer le retour de tous les comptes de manière récursive.

## [v0.20f] - 2026-06-21
### Fixed
- Sync Smartschool : champs JSON en néerlandais (`internnummer` → `smartschool_internal_number`, `gebruikersnaam` → `smartschool_username`, `naam` → `nom`, `voornaam` → `prenom`, `klas`/`stamklas` → `classe`) — retournait 0 élèves/0 personnel
- Upsert rows : colonnes DB corrigées (`smartschool_username` + `smartschool_internal_number` au lieu de `smartschool_id` inexistant)
- Désactivation des élèves absents : filtre sur `smartschool_username` au lieu de `smartschool_id`

## [v0.20g] - 2026-06-21
### Fixed
- Sync Smartschool : `supabaseUpsert` ajout `?on_conflict=smartschool_username` — résolution du 409 "23505 unique constraint violation" sur `personnel` (et `eleves`)

## [v0.20h] - 2026-06-21
### Fixed
- Sync Smartschool : `basisrol` retourne des codes numériques (`'1'` = élève, `'0'`/`'13'`/`'30'` = personnel) et non du texte (`'leerling'`) — tous les élèves étaient classés en personnel (0 élèves, 763 personnel)
## [v0.20i] - 2026-06-21
### Fixed
- notify : check de succès Smartschool corrigé — extraction du code de retour SOAP (`<return>N</return>`) ; `ok` = true seulement si N > 0 (était basé sur `!includes('<return>-</return>')` qui passait toujours)
- notify : ajout `ssCode` dans la réponse pour debug (visible dans la console F12)
## [v0.20j] - 2026-06-21
### Fixed
- Sync Smartschool : classe des élèves extraite de `a.groups.find(g => g.isKlas && g.isOfficial).name` — le champ `klas`/`stamklas` n'existe pas dans getAllAccountsExtended, la classe est dans le tableau `groups`

## [v0.20k] - 2026-06-21
### Changed
- Sync Smartschool : suppression de tout le code debug temporaire (3 couches : ff75a5d, 5349a95, 4e6518a)
- Extraction de classe simplifiée et définitive : `a.groups.find(g => g.isKlas === true && g.isOfficial === true)?.name?.trim()`
- Détection `basisrol` simplifiée : `String(a.basisrol).trim() === '1'` (élève)
- Message de log nettoyé (plus de `DEBUG:` en suffixe)

## [v0.20l] - 2026-06-21
### Fixed
- notify : suppression du paramètre `senderIdentifier` dans l'enveloppe SOAP — le serveur Smartschool retournait ssCode=12 ("utilisateur inexistant") pour toute valeur de `senderIdentifier` (y compris 'ESPM+', 'Null', chaîne vide). Sans ce paramètre, ssCode=0 (succès) et les messages apparaissent comme "Indisponible" (sans expéditeur, impossible de répondre — comportement voulu pour les notifications automatiques)
- notify : correction du check de succès — `ssCode === 0` au lieu de `ssCode > 0` (0 = succès Smartschool, pas une erreur)
- notify : suppression de `SMARTSCHOOL_NOTIFY_SENDER` (env var et paramètre `sender`) — devenu inutile

## [v0.20m] - 2026-06-21
### Fixed
- notify : body des messages converti en HTML (`<p>`, `<strong>`, `<a href>`) — le lien vers espmaritime.netlify.app est maintenant cliquable dans Smartschool (le format texte brut ne génère pas de lien cliquable dans l'interface Smartschool)

## [v0.20n] - 2026-06-21
### Changed
- notify : bouton "↗ ESPM+" orange (#E86C00) dans le corps des messages Smartschool — remplace le lien texte brut (style identique au bouton Smartschool du header)

## [v0.20o] - 2026-06-21
### Changed
- notify : bouton ESPM+ redesigné — fond mauve (#2D1B2E), "ESPM" blanc, "+" orange (#E86C00), ouvre dans un nouvel onglet (target="_blank")

## [v0.21] - 2026-06-21
### Added
- Génération PDF facture : nouvelle Netlify Function `facture-pdf.mjs` — génère un HTML A4 print-ready (logo école, ESPM+, adresse fenêtre droite enveloppe DL, lignes, totaux, IBAN/BIC, échelonnement et organisme tiers si actifs, contacts, pied de page)
- Logo école (`public/logo-ecole.png`) — converti depuis le fichier .ai fourni par l'économe
- Bouton "🖨 PDF" dans la vue détail d'une facture (DetailFacture) — visible pour tous les utilisateurs authentifiés
- Bouton "🖨" par ligne facture dans FicheEleve (onglet Finances)
- Env vars à configurer sur Netlify : SCHOOL_IBAN, SCHOOL_BIC, SCHOOL_EMAIL_ECO, SCHOOL_TEL_ECO, SCHOOL_EMAIL_AS, SCHOOL_TEL_AS, SCHOOL_BCE

## [v0.22b] — 2026-06-21
### Vue facture en ligne — nettoyage boutons
- REMOVE boutons Rappel, Brouillon, Mise en demeure de DetailFacture
- MOVE bouton PDF dans le coin supérieur droit (à côté de la date)
- KEEP bouton Valider (brouillon) et Réactiver (ignoré)

## [v0.22] — 2026-06-21
### PDF groupé + vue facture enrichie
- ADD factures-batch-pdf.mjs : PDF multi-pages de toutes les factures Facture d un batch
- ADD Bouton PDF groupe dans DetailBatch (visible si >=1 facture validee)
- ADD Vue en ligne DetailFacture : section Informations de paiement (beneficiaire, IBAN, communication, date limite)
- ADD Vue en ligne DetailFacture : section Contacts (assistant social + econome)

## [v0.21e] — 2026-06-21
### Facture PDF v1.4
- FIX contacts : AS et econome toujours affiches, meme avec echelonnement/organisme tiers

## [v0.21d] — 2026-06-21
### Facture PDF v1.3
- REMOVE logo ESPM+ de l en-tete (logo ecole seul)
- FIX footer : email + tel economat + mention "editee depuis ESPM+"
- ADD Beneficiaire : Pouvoir Organisateur Pluriel (avant IBAN)

## [v0.21c] — 2026-06-21
### Facture PDF v1.2
- FIX logo : extraction correcte (Maritime uniquement, sans Karreveld)
- FIX en-tete : logo + ESPM+ a gauche, nom ecole + adresse a droite
- FIX RESTE A PAYER : inclut le solde anterieur (montant - solde_avant - paye)
- ADD nom de l ecole dans en-tete : "Ecole Secondaire Plurielle Maritime"

## [v0.21b] - 2026-06-21
### Fixed
- PDF facture : logo école — PNG recadré pour n'afficher que le logo Maritime (supprime le doublon Harreveld)
- PDF facture : mise en page en-tête — logo + "ESPM+" côte à côte (flex row), suppression de la colonne ESPM+ séparée à droite
- PDF facture : BIC supprimé des informations de paiement
- PDF facture : communication = "Nom Prénom Classe" (au lieu du numéro de facture structuré)
### Changed
- PDF facture : section contacts conditionnelle — si aucun plan de paiement ni organisme tiers actif, invite à contacter l'AS (M. Mignolet, Smartschool ou 02/210.20.91) + l'économe (M. Lecocq, Smartschool ou 02/210.20.96) ; sinon, uniquement l'économe
- PDF facture : footer — email économat + téléphone économat uniquement (suppression des coordonnées AS du footer)
- PDF facture : env vars SCHOOL_EMAIL_AS et SCHOOL_BIC ne sont plus requises (non affichées)

## [v0.22c] — 2026-06-21
### Fixed
- PDF groupé (et individuel) : dernière facture débordait sur une page vide quand elle contenait un plan d'échelonnement + organisme tiers
- `.page` passe en `display:flex; flex-direction:column`, contenu dans `.page-body` (flex:1), footer en flux normal (plus de `position:absolute`)
- Appliqué à `factures-batch-pdf.mjs` et `facture-pdf.mjs`

## [v0.23] — 2026-06-21
### Added
- Rapport PDF des échelonnements (`echelonnements-rapport-pdf.mjs`)
  - Format A4 paysage, même header/footer que les factures (logo + école)
  - Sans coordonnées parents
  - Tableau : Élève, Classe, Statut, Montant, Échéances, Mensualité, Début, Fin estimée, Remarque
  - Sections groupées par statut (En cours / Non respecté / Terminé) quand filtre = Tous
  - Cards de synthèse : compteurs par statut + montant total
- Bouton "🖨 Rapport PDF" + sélecteur de statut dans la page Échelonnements

## [v0.24] — 2026-06-21
### Added
- Rapport PDF des plans d'échelonnement (v2.0) depuis AssistantSocial
  - Une page A4 par plan : info élève, statut, dates, remarque
  - Cards financières : total prévu, total payé, retard, solde restant
  - Tableau des échéances individuelles avec statut (À venir / En retard / Payé)
  - Sélecteur statut + bouton "🖨 Rapport PDF" dans la toolbar de l'onglet Échelonnements
### Removed
- Pages orphelines `Echelonnements.jsx` et `OrganismesTiers.jsx` (remplacées depuis longtemps par AssistantSocial)
- Imports correspondants retirés de App.jsx (les redirections /echelonnements et /organismes vers /assistant-social restent actives)

## [v0.25] — 2026-06-21
### Changed
- PDF échelonnement : bouton icône FileText par ligne dans le tableau + dans le modal (plus de bouton toolbar global)
- PDF échelonnement : paramètre `echId` (plan individuel uniquement), plus de filtre par statut
- PDF échelonnement footer : suppression nom/adresse école, email/tél AS au lieu d'économe, "généré" au lieu d'"édité"
- PDF factures : "Cette facture a été éditée" → "Cette facture a été générée" dans footer (facture-pdf.mjs + factures-batch-pdf.mjs)

## [v0.26] — 2026-06-21
### Added
- PDF échelonnement : bloc signature en bas de page — "Fait à Molenbeek-Saint-Jean, le ___", ligne de signature responsable légal (gauche) et représentant de l'école (droite)

## [v0.27] — 2026-06-21
### Added
- PDF échelonnement : logo de l'école en haut à gauche (chargement via URL HTTP comme les factures)
- PDF échelonnement footer : "Jérôme Mignolet, Assistant social" avant email/tél
- EchelonnementDetail modal : section "Rapport signé" avec upload PDF (drag & drop ou parcourir), liste des documents uploadés avec vue/suppression
- Supabase : table `echelonnement_documents` + bucket `echelonnement-rapports` avec policies RLS

## [v0.28] — 2026-06-21
### Added
- Organismes tiers : sélection articles depuis le catalogue global (décorrélé de la facturation), articles personnalisés (titre + montant), champ adresse organisme, montant demandé calculé automatiquement
- Organismes tiers : section rapport signé dans le modal (1/3 générer + 2/3 upload, même UX que échelonnements)
- Organismes tiers : bouton PDF par ligne dans le tableau + icône corbeille par ligne
- Nouvelle function Netlify `organismes-tiers-rapport-pdf.mjs` : demande de prise en charge A4 (logo, infos élève/organisme, tableau articles, bloc double signature, footer AS)
- Tables Supabase : `organismes_tiers_articles`, `organismes_tiers_documents`, colonnes `adresse` et `montant_demande` sur `organismes_tiers`
- Bucket Supabase `organismes-tiers-rapports`
### Changed
- Factures : "← Retour au batch" → "← Retour aux factures individuelles"

## [v0.29] — 2026-06-21
### Added
- Organismes tiers : table Supabase `organismes_repertoire` (répertoire d'adresses enregistrées : type, institution, rue, code postal, commune)
- Organismes tiers : bouton "Nouvel organisme" dans la liste — ouvre un modal central pour créer une adresse répertoire (type CPAS/ULB/SPJ/Autre + 4 champs)
- OrganismeTiersDetail modal : champs adresse décomposés (Institution, Rue et numéro, Code postal, Commune) + sélecteur de pré-remplissage depuis le répertoire
- Formulaire "Nouvelle situation" : sélection depuis le répertoire ou saisie manuelle des 4 champs adresse
- PDF "Demande de prise en charge" : affichage institution, rue et code postal/commune séparément
### Changed
- Bouton "+ Organisme" → "+ Nouvelle situation" dans la liste des organismes tiers
- Colonne `adresse` text remplacée par `institution`, `rue`, `code_postal`, `commune`, `repertoire_id` sur `organismes_tiers`

## [v0.30] — 2026-06-21
### Changed
- PDF "Demande de prise en charge" : refonte complète du layout
  - Adresse organisme (institution/rue/CP/commune) dans une box en haut à droite, miroir de la box responsable sur les factures
  - Section "Coordonnées de l'élève" : grille avec nom, prénom, classe, date de naissance, responsable 1, responsable 2, adresse
  - Table articles sans catégories, ligne total seule (comme les factures)
  - Section "Informations de paiement" (bénéficiaire, IBAN, communication, montant demandé) avec fond orangé

## [v0.30b] — 2026-06-21
### Fixed
- Crash page Assistant social : `reloadRepertoire` injecté par erreur dans le `useEffect` de `TabEchelonnements` au lieu de `TabOrganismesTiers`. `ReferenceError` au montage de l'onglet par défaut (échelonnements).

## [0.31] — 2026-06-22

### Added
- **Rapport PDF Activités** : nouveau bouton "📄 Rapport PDF" dans la page Activités (admin/financier uniquement)
  - Statistiques : nb activités par type, par responsable, par classe
  - Coûts totaux par type + coût moyen par élève (après déduction POP)
  - Intervention POP par type + total
  - Graphique SVG (barres groupées par mois, couleurs par type)
  - Liste des activités classées par type (intramuros / extramuros / voyage) avec : titre, date, heures, classes, responsable, accompagnants, prix total, prix/élève, POP, transport
  - Footer avec email et téléphone de l'école (variables `SCHOOL_EMAIL_SCHOOL` et `SCHOOL_TEL_SCHOOL`)
  - Orientation paysage A4

## [v0.32] — 2026-06-22

### Changed
- **Layout : sidebar latérale collapsible** remplace le header horizontal
  - Nouveau composant `Sidebar.jsx` : menu vertical avec icônes SVG pour chaque section
  - Mode déplié (224 px) : icône + libellé — mode réduit (64 px) : icônes seules avec tooltip
  - Bascule via double-chevron, état persisté en `localStorage`
  - Sections : navigation + séparateur + Smartschool / notifications + admin + profil + déconnexion
  - Layout passe en `flex h-screen` : sidebar fixe à gauche, contenu scrollable à droite
  - `NotificationBell` : nouvelle prop `dropdownAlign` ('right' par défaut, 'left' pour sidebar) afin que le dropdown s'ouvre dans le bon sens

### Fixed
- `App.jsx` définissait son propre composant `Layout` inline qui continuait d'importer `Header` — le fichier `Layout.jsx` modifié n'était jamais utilisé. `App.jsx` importe désormais directement `Sidebar` et utilise le nouveau layout.

## [v0.33] — 2026-06-22

### Added
- **PageHeader** : nouveau composant `src/components/ui/PageHeader.jsx` — barre sticky sombre (`#2D1B2E`) en haut de chaque page avec titre (blanc) et sous-titre (blanc 50%)
  - Prop `actions` pour injecter des boutons côté droit (ex. bouton "+ Facturer" sur Factures)
  - Intégré sur les 9 pages : Élèves, Paiements, Activités, Factures, Articles, Groupes, Assistant social, Administration, Accueil (Tableau de bord + Bonjour)
  - Hauteur de calcul `calc(100vh - Xpx)` ajustée à `88px` pour les pages avec tableau scrollable

## [v0.34] — 2026-06-22

### Changed
- **PageHeader : toolbar intégrée** — tous les éléments de filtrage/navigation migrent du corps de page vers la 2e ligne du PageHeader (fond sombre `#2D1B2E`)
  - `PageHeader` reçoit désormais : `tabs`, `activeTab`, `onTabChange`, `leftActions`, `search`, `onSearch`, `searchPlaceholder`, `filters`, `info`, `actions`
  - Onglets : style segment control sur fond translucide blanc — actif : fond blanc, couleur selon `tab.color` (orange/red/vert) ; inactif : blanc 60%
  - Champ de recherche : fond translucide, texte blanc, icône loupe + bouton clear ×
  - `info` s'aligne à droite si pas d'`actions`, sinon avant les actions
  - **Élèves** : recherche + MasterFilter (dark) + info nb résultats → PageHeader ; wrapper `h-full flex flex-col` ; `flex-1 min-h-0` pour le tableau scrollable ; calcul hauteur supprimé
  - **Groupes** : même migration que Élèves
  - **Paiements** : recherche + MasterFilter (dark) + actions Import CSV / + Paiement (visibles financier uniquement) + info nb résultats → PageHeader
  - **Factures — ListeBatches** : onglets (En attente · Facturé · Impayés) + recherche + "+ Facturer" → PageHeader
  - **Factures — DetailBatch** : ← Retour (leftActions) + onglets + recherche + actions conditionnelles (Tout approuver / PDF groupé) → PageHeader
  - **Articles** : onglets Attributions / Catalogue → PageHeader ; div tabs supprimée du corps
  - **Assistant social** : onglets Échelonnements / Organismes tiers → PageHeader ; div tabs supprimée du corps
- **MasterFilter** : nouvelle prop `dark` pour fond sombre — bouton déclencheur adapte son style (translucide blanc, badge blanc)
- **App.jsx** : `overflow-hidden` sur le panel droit + `overflow-y-auto min-h-0` sur `<main>` → layout CSS flex correct pour pages avec tableau scrollable

## [v0.35] — 2026-06-22

### Changed
- **PageHeader : single-row layout** — titre + sous-titre empilés à gauche, séparateur vertical, puis toolbar (tabs / search / filters / info / actions) sur la même ligne. Suppression du 2ème row.
- **Activités** : migration complète vers PageHeader
  - Checkbox Archives, bouton Rapport PDF, bouton + Activité → `leftActions` / `actions`
  - Recherche + MasterFilter dark → search/filters du PageHeader
  - Pills À venir / Passées / Mes activités → `tabs` du PageHeader (toggle : clic = activer, re-clic = désactiver)
  - Compteur résultats → `info`
  - `ActiveFilterChips` reste dans le corps de page
- **Articles** : search + actions (+Attribution / +Article) migrés vers PageHeader
  - État `search` levé au niveau Articles (reset lors du changement d'onglet)
  - État `formOpen` levé au niveau Articles → tabs reçoivent `formOpen` + `onFormClose` comme props
  - Toolbar interne supprimé dans `AttributionsTab` et `CatalogueTab`
- **Assistant social** : search + MasterFilter dark + actions migrés vers PageHeader
  - États `search`, `filters`, `formOpen`, `orgModalOpen` levés vers le composant parent pour les 2 onglets
  - Toolbar interne supprimé dans `TabEchelonnements` et `TabOrganismesTiers`
  - `filterDefs` définis au niveau parent (ECH et OT)
  - `ActiveFilterChips` reste dans le corps de page
- **Administration** : onglets Utilisateurs / Droits / Synchronisation → PageHeader

## [v0.36] — 2026-06-22

### Changed
- **Factures — ListeBatches et DetailBatch** : layout scrollable identique à Élèves/Groupes
  - Wrapper `h-full flex flex-col` (remplace fragment `<>`)
  - Zone contenu `flex-1 min-h-0` + tableau `flex-1 overflow-auto min-h-0`
  - `thead` sticky (`sticky top-0 z-10`) dans les deux vues

## [v0.37] — 2026-06-22

### Changed
- **smartschool-notify.mjs** : migration `sendMsg` → `sendNotification` (scope `sendnotif`)
  - Scope `sendnotif` activé par Smartschool le 22/06/2026 (ticket #198282)
  - La fonction SOAP `sendNotification` envoie une notification push dans l'app Smartschool
    au lieu d'un message dans la boîte de réception — moins intrusif, plus adapté
  - Corps en **plain text** (plus de HTML) + nouveau paramètre `link` (URL cliquable)
  - **Mode bêta (actuel)** : si `SMARTSCHOOL_TEST_RECIPIENT` est défini, 100% des notifs
    vont uniquement à ce compte (Renaud) — comportement inchangé depuis le frontend
  - **Mode production (V1 futur)** : factures → co-accounts 1 & 2 de chaque élève facturé ;
    activités → liste `SMARTSCHOOL_NOTIFY_DIRECTION`
  - `SOAPAction` : `"urn:sendMsg"` → `"urn:sendNotification"`
  - Aucun changement dans `Factures.jsx` ni `Activites.jsx` — même endpoint, même payload

## [v0.38] — 2026-06-22

### Fixed
- **smartschool-notify.mjs** : revert `sendNotification` → `sendMsg` (SOAP V3)
  - `sendNotification` n'existe pas dans le WSDL SOAP V3 Smartschool (confirmé en inspectant
    le WSDL live) — la méthode renvoie un SOAP fault → ssCode: -999 systématique
  - Le scope `sendnotif` activé par Smartschool (ticket #198282) est réservé à l'**API OAuth2**
    (client credentials), pas au SOAP V3 avec access code — deux systèmes distincts
  - `sendMsg` (messages inbox) est la seule méthode d'envoi disponible en SOAP V3 + access code
  - Ajout de `https://espmaritime-staging.netlify.app` dans les origines CORS autorisées
    (manquait, causait des blocages potentiels sur staging)
  - TODO (chantier futur) : implémenter OAuth2 Smartschool pour accéder à `sendNotification`
    via token Bearer — nécessite client_id + client_secret + flow token exchange

## [v0.39] — 2026-06-22

### Changed
- **smartschool-notify.mjs** : implémentation OAuth2 `client_credentials` pour `sendNotification`
  - Remplace `sendMsg` (inbox) par `sendNotification` (push notification mobile/desktop)
  - Authentification via OAuth2 `client_credentials` (machine-to-machine, sans redirect URI)
    → fonctionne sur staging ET production (contrairement au login OAuth utilisateur)
  - Flow : `POST /OAuth/index/token` (scope=sendnotif) → Bearer token → SOAP `sendNotification`
    avec `Authorization: Bearer {token}` — Smartschool retourne HTTP 200 + body vide = succès
  - `<accesscode>` dans le SOAP body positionné à `"OAUTH"` (ignoré par Smartschool quand
    le header Bearer est présent)
  - Nouvelles env vars Netlify (staging + production) :
    - `SMARTSCHOOL_CLIENT_ID` = identifiant OAuth2 ESPM+
    - `SMARTSCHOOL_CLIENT_SECRET` = secret OAuth2 ESPM+
  - Env var optionnelle `SMARTSCHOOL_OAUTH_URL` (défaut : `…/OAuth/index/token`)
  - Structure SOAP `sendNotification` : `accesscode`, `title`, `description`,
    `userIdentifier`, `coaccount`, `link`
  - `link` = URL vers ESPM+ (racine ou page activité avec `?open={id}`)
  - Token OAuth obtenu une fois par invocation de la fonction (serverless = pas de cache)

## [v0.40] — 2026-06-22

### Reverted
- **smartschool-notify.mjs** : retour à `sendMsg` SOAP V3 (message inbox)
  - `sendNotification` SOAP V3 + Bearer OAuth → HTTP 200 + body vide mais aucune
    notification réellement envoyée (action inconnue dans le WSDL, ignorée silencieusement)
  - REST `/Api/V1/sendNotification` + Bearer OAuth → HTTP 500 systématique
    (token `client_credentials` avec `sub: ""` → Smartschool refuse sans identité expéditeur)
  - `sendMsg` (message inbox Smartschool) est la seule méthode fiable avec les droits actuels
  - Suppression des env vars `SMARTSCHOOL_CLIENT_ID` / `SMARTSCHOOL_CLIENT_SECRET` (non utilisées)
  - Correction `SMARTSCHOOL_TEST_RECIPIENT` → "Renaud Lecocq" (identifiant Smartschool réel)
  - TODO : ouvrir ticket Smartschool pour demander endpoint REST sendnotif + payload attendu

## [v0.41] — 2026-06-22

### Fixed
- **smartschool-notify.mjs** : restauration de la version fonctionnelle depuis main
  - ssCode 12 causé par déclaration des namespaces XML (`xmlns:xsi`, `xmlns:xsd`) au niveau
    de l'enveloppe SOAP au lieu d'inline sur chaque élément — Smartschool l'exige inline
  - Corps du message en HTML restauré (bouton ESPM+ orange/sombre)
  - Ajout `https://espmaritime-staging.netlify.app` dans CORS origins

## [v0.42] — 2026-06-22

### Changed
- **Activites.jsx** : séparation en deux onglets principaux
  - Onglet **Intra-Extramuros** : affiche uniquement les activités de type `extramuros`
    et `intramuros` ; filtre Type limité à ces deux options
  - Onglet **Voyages scolaires** : affiche uniquement les activités de type `voyage`
  - Changement d'onglet principal réinitialise le quick filter (À venir / Passées / Mes)
  - Quick filters (🟢 À venir, 🔴 Passées, 👤 Mes activités) déplacés dans `leftActions`
    (à gauche du header) en remplacement des anciens tabs PageHeader
  - **Modal** : options de type restreintes selon l'onglet actif
    - Intra-Extramuros → `Extramuros` / `Intramuros` (sélecteur actif)
    - Voyages scolaires → `Voyage scolaire` uniquement (sélecteur désactivé)
  - Type par défaut à la création = cohérent avec l'onglet actif
    (`extramuros` sur Intra-Extramuros, `voyage` sur Voyages scolaires)

## [v0.43] — 2026-06-22

### Changed
- **Activites.jsx** : refonte UI header onglets + filtres rapides
  - Onglets principaux (Intra-Extramuros / Voyages) déplacés à gauche des filtres rapides,
    avant "À venir / Passées / Mes activités"
  - Onglet "Voyages scolaires" renommé "Voyages"
  - Filtres rapides sans emoji ; texte coloré dynamique (vert = À venir, rouge = Passées,
    orange = Mes activités) — actif = couleur vive, inactif = blanc atténué
  - Suppression de la feature "Archives" (checkbox + filtre `showArchived`) ;
    les activités archivées ne sont plus affichées
  - Bouton "+ Activité" renommé **"Nouvelle activité"** sur l'onglet Intra-Extramuros
    et **"Nouveau voyage"** sur l'onglet Voyages

## [v0.44] — 2026-06-22

### Changed
- **Activites.jsx** : refonte modale + formulaire intra-extramuros
  - **Modal centré** : passage du slide-in latéral vers une modale centrale (max 90vh,
    arrondie) pour la création et l'édition des deux types d'activités
  - **Filtre "Type" supprimé** du panneau Filtres (redondant avec les onglets principaux)
  - **Responsable verrouillé** : pour les profils non-admin/non-financier, le responsable
    est toujours le créateur (champ en lecture seule) ; admin et financier conservent
    la sélection libre
  - **"Accompagnateur·rice·s" → "Accompagnants"** (label + placeholder)
  - **Heure RDV supprimée** du formulaire logistique
  - **Lieu de retour obligatoire** pour les extramuros (validation + astérisque)
  - **Type de transport multi-sélection** : STIB, SNCB, De Lijn, TEC, Flixbus,
    Société de car, À pied, Autre (champ texte libre si Autre coché) — stocké en
    chaîne CSV dans la colonne `type_transport` ; rétrocompatible avec les anciennes
    valeurs (`bus_scolaire` → `societe_car`, `train` → `sncb`)

## [v0.45] — 2026-06-22

### Changed
- **Activites.jsx** — recherche multi-critères + transport détaillé + exclusion élèves
  - **Filtres supprimés** du PageHeader (MasterFilter + ActiveFilterChips)
  - **Recherche étendue** : titre · responsable/accompagnants (nom staff) · classes
    incluses · groupes inclus (label) · élèves participants (nom+prénom via classes/groupes)
  - **Participants — "Retirer spécifiquement"** : section amber identique à Articles.jsx
    permettant d'exclure des élèves individuels ; stocké dans `eleves_exclus UUID[]` ;
    pris en compte dans le calcul automatique du nombre d'élèves
  - **Transport — champs contextuels** selon les modes sélectionnés :
    - SNCB → Gare de départ, Gare d'arrivée, PMR (oui/non)
    - TEC → Gare de départ, Gare d'arrivée, Ligne empruntée
    - De Lijn → message informatif "Contacter l'économe…"
    - Autre → champ texte libre (inchangé)
  - Affichage simultané des blocs si plusieurs transports combinés (ex: SNCB + TEC)

### Migration DB
- `activites` : nouvelles colonnes `eleves_exclus UUID[]`, `gare_depart TEXT`,
  `gare_arrivee TEXT`, `pmr VARCHAR(3)`, `ligne_tec TEXT`

## [v0.46] — 2026-06-22

### Changed
- **Activites.jsx** — suppressions, validations et transport enrichi
  - **Archiver supprimé** : bouton "Archiver" retiré du footer du modal ; fonction `archive()`
    retirée du composant principal ; `canEdit` ne vérifie plus le statut `archive`
  - **Type "Voyage scolaire" masqué** depuis le modal Intra-Extramuros : `allowedTypes`
    et `defaultType` correctement passés selon l'onglet actif
  - **Tél. organisateur.trice** renommé + rendu obligatoire pour les types extramuros/voyage
  - **Transport — champs contextuels étendus** :
    - Flixbus → Gare de départ, Gare d'arrivée, Heure de départ (retour)
    - SNCB → + Heure de départ (retour) (s'ajoute aux champs existants)
    - TEC → + Heure de départ (retour) (s'ajoute aux champs existants)

### Migration DB
- `activites` : nouvelle colonne `heure_depart_retour TIME`

## [v0.47] — 2026-06-22

### Added
- **activite-avis-pdf.mjs** — nouvelle fonction Netlify générant un avis parental PDF (format A4)
  pour une activité intramuros ou extramuros. Contenu : logo + coordonnées école + date,
  badge de type, titre, date, salutation "Chers parents…", description, tableau
  d'informations pratiques (lieu, heures, lieu RDV/retour, transport + détails SNCB/TEC/Flixbus,
  montant par élève), encadré responsable + accompagnants, mention contact Smartschool, footer.
  S'ouvre en nouvelle fenêtre avec `window.print()` automatique.
- **Activites.jsx — section "Documents & Factures"** : passage de 2 à 3 colonnes avec ajout
  d'une colonne "Générer avis" (composant `AvisGenerator`). Disponible uniquement pour les
  activités sauvegardées de type intramuros ou extramuros.

## [v0.48] — 2026-06-22

### Added
- **activites** DB : nouvelle colonne `informations_supplementaires TEXT`
- **Activites.jsx** — section "Informations supplémentaires" (textarea, 3 lignes) insérée
  entre "Finances" et "Documents & Factures" dans le modal activité
- **activite-avis-pdf.mjs** — refonte visuelle complète de l'avis parental :
  - Header : logo seul à gauche · nom école (gras) + adresse (couleur type) à droite
  - Titre : badge de type compact inline à gauche du titre (sur la même ligne)
  - "Chers parents…" et description : même police/taille (10.5pt)
  - Section "Informations supplémentaires" affichée si renseignée (encadré gris)
  - Footer : "Avis généré par ESPM**+** le [date]" avec le + en orange

---

## [sidebar-smartschool-button] — Bouton Smartschool redesigné dans la sidebar

### Changed
- **Sidebar.jsx** — lien Smartschool converti en bouton stylisé :
  - Fond sombre (`#120f1a`) avec coins arrondis (`rounded-xl`)
  - Mode étendu : carré orange avec icône lien externe + texte "Smartschool" en blanc
  - Mode réduit : logo Smartschool (image officielle) centré
