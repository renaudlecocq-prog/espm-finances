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

## Session 1 — 2026-06-18 (deploy/fix)

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

## Session 2 — 2026-06-18 (workflow + AssistantSocial)

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

## Session 4 — 2026-06-19 (commentaires + UX slide-ins)

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

## Session 5 — 2026-06-19 (rôles OAuth + UX activités)

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

## Session 6 — 2026-06-19 (notifications)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `fee214e` | `Commentaires.jsx` + `Activites.jsx` + `AssistantSocial.jsx` | Journal d'activité dans le chat : événements système (modification de champs, ajout/suppression de documents). Fenêtre chat élargie. Migration Supabase : colonnes `type` et `meta` sur `commentaires`. | `git revert fee214e` |
| `a5eeafa` | `Activites.jsx` | Pill "Mes activités" masquée pour les MdP | `git revert a5eeafa` |
| `ef6ed03` | `Activites.jsx` | Affichage `local` (intramuros) sur la carte. Pills de filtre rapide Passées/À venir/Mes activités. Signal visuel pastel vert/rouge. | `git revert ef6ed03` |
| `3e6fbec` | `NotificationBell.jsx` | Bouton "Vider" pour supprimer toutes les notifications | `git revert 3e6fbec` |
| `e1a5d42` | `NotificationBell.jsx` + `Activites.jsx` | Deep-link notification → ouvre le slide-in de l'activité concernée (`?open=<id>`). Badge rouge messages non-lus sur les cartes. | `git revert e1a5d42` |

---

## Session 7 — 2026-06-19 (fix documents)

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

## Session 8 — 2026-06-20 (logo + fiche responsable)

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

## Session 9 — 2026-06-20 (mode démo)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `b4bcdbe` | `demoData.js` + `supabaseMock.js` + `DemoContext.jsx` + `App.jsx` + `Header.jsx` | Mode démo : 20 élèves fictifs (stars de la musique — Billie Eilish, Taylor Swift, Adele, Bruno Mars…). Client Supabase mocké (MockQuery/MockTable thenable). Monkey-patch synchrone de `supabase.from()`. Bannière orange + header brun en mode démo. Aperçu Responsable → Billie Eilish + Post Malone. | `git revert b4bcdbe` |
| `29e0de0` | `DemoContext.jsx` + `App.jsx` + `Admin.jsx` + `Home.jsx` | Fix : `profiles`/`sync_log` passent par le vrai Supabase. Bannière démo : switcher de rôle (Admin/Financier/MdP/Responsable). Admin > Droits : bloc toggle mode démo. HomeResponsable : fallback démo si aucun élève lié. | `git revert 29e0de0` |
| `a1870a0` | `App.jsx` + `Header.jsx` + `demoData.js` | Fix critique : RequireAuth utilise `effectiveRole` (aperçu bloque l'accès par URL directe). Header : label de rôle effectif + `↩` si aperçu. Billie/Post : fratrie cohérente, Billie=échelonnement, Post=OT SPJ. | `git revert a1870a0` |
| `343fef1` | `Home.jsx` + `Header.jsx` | Échéancier mensuel dans HomeResponsable (✓ Payé / ⚠ En retard / ◌ À venir). Bouton démo retiré du header → uniquement Admin > Droits. | `git revert 343fef1` |

---

## Session 10 — 2026-06-20 (facturation)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `4151f19` | `Factures.jsx` + migration SQL | Système de facturation complet : table `facture_lignes` + colonnes `solde_avant`/`solde_apres` sur `factures` + `facture_id` sur `article_attributions`. Wizard par élève (articles + activités en attente, sélection, solde avant/après). Vue liste + vue détail facture. Correction des champs (`date` pas `date_emission`, statuts corrects). | `git revert 4151f19` |

## [Session 10b] - 2026-06-20

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

## [Session 10c] - 2026-06-20

### Changed
- **Factures — modal centré** : panneau de facturation affiché au centre de la page (max-w-2xl, max-h-90vh) au lieu du slide-in latéral
- **Filtre classes en pill dropdown** : un seul bouton-pill "Ignorer des classes" ouvre un menu déroulant avec cases à cocher (style cohérent avec MasterFilter)
- **Logique d'exclusion** : on exclut des classes (au lieu d'en sélectionner), par défaut toutes les classes sont facturées
- Indicateur de classes ignorées dans le pied du modal et le résumé

**Commit :** `08e4cd6`

## [Session 10d] - 2026-06-20

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

## [Session 10e] - 2026-06-20

### Added
- **Logo cercle SVG** dans Header.jsx : remplacement du shield par un cercle mauve avec les initiales "EP", cohérent avec l'identité visuelle
- **Favicon.svg** mis à jour : nouveau favicon cercle mauve, remplace l'ancienne icône
- **HomeResponsable** : vue dédiée pour le rôle `responsable` sur la page d'accueil — liste des enfants liés au compte avec solde, factures et paiements en lecture seule
- **Mode démo** : accès sans authentification avec données fictives pour présentation du site, activé via paramètre URL `?demo=true`

### Fixed
- **Page blanche HomeResponsable en mode démo** : correction du chargement des données fictives pour le rôle responsable

## [Session 10f] - 2026-06-20

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

## [Session 10h] - 2026-06-20

### Changed — UX DetailBatch
- **Layout compact** : onglets "En attente / Approuvé", recherche et bouton "Tout approuver" regroupés sur une seule ligne
- Titre de la page redevient "Factures" avec le numéro de batch en sous-titre
- Suppression du bandeau de recherche séparé dans l'en-tête de la card

---

## [Session 10g] - 2026-06-20

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

> **Note GitHub** : les commits de sessions 10b-e n'ont pas encore été tous poussés depuis le sandbox. Seule la session 10g sera visible après le prochain push manuel.

## [Session 10h] - 2026-06-20

### Changed — UX DetailBatch
- **Layout compact** : onglets "En attente / Approuvé", recherche et bouton "Tout approuver" regroupés sur une seule ligne
- Titre de la page redevient "Factures" avec le numéro de batch en sous-titre
- Suppression du bandeau de recherche séparé dans l'en-tête de la card

---


## [Session 10i] - 2026-06-20

### Changed — UX DetailBatch (onglets)
- Onglet "En attente" : compteur affiché en **badge** séparé à l'intérieur du pill (au lieu de "(n)" dans le texte)
- Onglet "Facturé" (renommé depuis "Approuvé") : libellé corrigé, sans compteur
