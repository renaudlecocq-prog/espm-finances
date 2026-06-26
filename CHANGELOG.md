## [v1.16.12] — EleveTableBlock : createBlockSpec + createRoot (bypass createReactBlockSpec)
- Remplacement de createReactBlockSpec par createBlockSpec (@blocknote/core) + createRoot manuel
- Corrige React error #130 causé par le chemin renderType='dom' de createReactBlockSpec en prod
- Config compacte avec recherche+chips (classes et groupes), colonnes à cocher

## [v1.16.11] — EleveTableBlock : config compacte + renommage bouton
- Sélection classes/groupes par recherche + chips (fini la liste de 100+ boutons)
- Bouton d'insertion renommé "Tableau élèves"

## [v1.16.10] — Fix EleveTableBlock : invoquer la factory createReactBlockSpec
- createReactBlockSpec() retourne une fonction factory → appel () nécessaire pour obtenir le BlockSpec
- Corrige "Cannot read properties of undefined (reading 'node')" au chargement de la salle des profs

## [v1.16.9] — Tableau d'élèves dans l'éditeur de pages
- Nouveau bloc custom BlockNote : "Tableau d'élèves"
- Mode config : sélection de classes et/ou groupes + choix des colonnes (Nom, Prénom, Sexe, Classe, Groupes)
- Mode affichage : table live depuis Supabase, rechargeable, bouton "Modifier" pour reconfigurer
- Bouton "Tableau" dans la barre du PageEditor pour insérer le bloc au curseur

## [v1.16.7] — BlockNote : locale française (placeholder + menu slash)
- dictionary: fr de @blocknote/core/locales

## [v1.16.6] — BlockNote : MantineProvider local + @mantine/core v7 + styles CSS
- Réintégration @blocknote/mantine avec MantineProvider uniquement autour de léditeur
- @mantine/core v7 (pas v9) + import CSS obligatoire pour Mantine v7+
- Slash menu, toolbar et side menu fonctionnels

## [v1.16.5] — BlockNote : ajouter BlockNoteDefaultUI (slash menu, toolbar, side menu)
- BlockNoteViewRaw nécessite BlockNoteDefaultUI pour le slash menu et la toolbar

## [v1.16.4] — Éditeur BlockNote : thème dark/light dynamique
- BlockNoteView reçoit theme=dark ou light selon les préférences
- Conteneur éditeur adapté au dark mode

## [v1.16.3] — Fix useEditorChange : arguments dans le bon ordre (callback, editor)
- Correction du crash à l'ouverture de l'éditeur BlockNote

## [v1.16.2] — Fix suppression page : mise à jour liste immédiate
- Après suppression d'une page, la liste se rafraîchit sans rechargement

## [v1.16.1] — Fix critique : supprimer @blocknote/mantine + MantineProvider (app blanche)
- Suppression de @blocknote/mantine, @mantine/core, @mantine/hooks
- Remplacement par BlockNoteViewRaw de @blocknote/react (sans dépendance Mantine)
- Revert main.jsx : MantineProvider retiré (causait page blanche sur toute l'app)
- L'éditeur BlockNote fonctionne désormais sans contexte Mantine

## [v1.16.0] — Salle des Profs : éditeur de pages collaboratif (BlockNote)
- Nouvel onglet "Pages" dans la Salle des Profs
- Éditeur bloc-par-bloc à la Notion (menu / pour titres, listes, tableaux, code, équations, images…)
- Auto-save Supabase toutes les 1,5 secondes + indicateur "Sauvegardé ✓"
- Synchronisation temps réel : les modifications d'un utilisateur apparaissent pour tous les autres
- Pages épinglables, renommables, supprimables avec confirmation
- Migration Supabase : table salle_pages (type shared/personal, content JSONB, RLS)
- Dépendances ajoutées : @blocknote/react, @blocknote/core, @blocknote/mantine, @mantine/core, @mantine/hooks

## [v1.15.9] — Fix dark mode : page Mentions légales illisible
- MentionsLegales.jsx : text-primary → dark:text-accent, text-primary-lighter → dark:text-gray-300/400

## [v1.15.8] — Fix dark mode : MiniStat Home illisibles
- Home.jsx : MiniStat color variants → dark:text-*-200 pour blue/red/green/orange/indigo/purple

## [v1.15.7] — Fix dark mode : compteur élèves concernés illisible
- Articles.jsx : nbEleves → text-primary dark:text-accent

## [v1.15.6] — Fix dark mode : chips multi-select illisibles
- Articles.jsx : chips valeurs sélectionnées (classes/groupes/élèves) → dark:bg-accent/20 dark:text-accent
- Articles.jsx : items sélectionnés dans dropdown → dark:text-accent

## [v1.15.5] — Fix dark mode round 4 (btn-secondary, boutons primaires, sync)
- index.css : définir .btn-secondary avec dark mode (bg-gray-700 + text-gray-100)
- Activités : responsable dans les cards invisible (text-primary/80 → dark:text-accent/80)
- FicheEleve : bouton Appel + icône téléphone + liens Gérer invisibles (text-primary → dark:text-accent)
- Articles : mode attribution sélectionné invisible (text-primary → dark:text-accent)
- AssistantSocial : boutons Générer rapport + Fiche élève + Montant demandé + Ajouter article (text-primary → dark:text-accent)
- Admin Sync : chiffres élèves/personnel sans couleur dark (dark:text-gray-100)

## [v1.15.4] — Fix dark mode round 3 (selects, onglets, icônes)
- Activités : "Voir justificatif" invisible en dark (text-primary → dark:text-accent)
- Économe : selects année/mois/projet sans couleur de texte dark (dark:text-gray-100)
- Économe Projets : ligne expand bg-gray-50/80 opaque → dark:bg-gray-800/80
- Admin : sous-onglets actifs (Utilisateurs/Droits/Photos) text-primary → dark:text-accent
- Suivi social : icône upload dans zone dashed trop sombre (dark:text-gray-300)
- Suivi social : footer "Créé/Modifié le" trop sombre (dark:text-gray-400)

## [v1.15.3] — Fix dark mode round 2 (onglets, tableaux, liens)
- FicheEleve : onglets actifs (`text-primary`) invisibles → `dark:text-accent`
- Articles : colonne NB ÉLÈVES `text-primary` → `dark:text-accent` ; lignes paires catalogue sans dark bg → `dark:bg-gray-900/60`
- Factures : total batch + numéro facture `text-primary` → `dark:text-accent` ; solde positif `text-green-600` sans dark → `dark:text-green-400`
- Économe Bilan : row SOLDE `text-green-600`/`text-red-500` sans dark → `dark:text-green-400`/`dark:text-red-400` ; solde `text-indigo-600` → `dark:text-indigo-400`
- Suivi social : nom organisme + totalDemande `text-primary` → `dark:text-accent` ; "parcourir" upload → `dark:text-accent`
- Admin : sous-onglet actif guidance `text-primary` → `dark:text-accent`
- Activités : "parcourir" upload + radio PMR/TEC sans couleur → `text-gray-700 dark:text-gray-200`

## [v1.15.2] — Fix dark mode (visibilité texte + bulles + totaux)
- Admin : lignes matières/personnes ressource/statuts sans couleur de texte → `text-gray-700 dark:text-gray-200`
- Admin : badge `<code>` templates — `text-primary` invisible en dark → `dark:text-gray-200`
- Activités : tags multiselect — `text-primary` invisible en dark → `dark:text-accent`
- HelpdeskDetail : fond blanc hardcodé sur boutons Répondre/Note, textarea et chip fichiers → ternaires dark
- HelpdeskDetail : selects Statut/Priorité/Participant sans couleur de texte → `color: dark ? '#F9FAFB' : '#111'`
- HelpdeskDetail : bulle message non-own (`#F3F4F6`) invisible en dark → `dark ? '#374151'`
- Économe : lignes TOTAL DÉPENSES/ENCAISSEMENTS/PRODUITS/CHARGES — pas de variante dark → `dark:bg-red-950/50` / `dark:bg-green-950/50`
- Suivi social : stat box retard/avance sans variante dark → `dark:bg-red-950` / `dark:bg-green-950`


## [v1.15.1] — Fix dark mode (inline styles)
- Helpdesk : cards tickets, modal nouveau ticket, champs dynamiques — fond blanc corrigé en dark
- HelpdeskDetail : panneau admin, dropdowns statut/priorité, barre ticket fermé — corrigés en dark
- Admin (Helpdesk) : cards catégories, modal édition catégorie — corrigés en dark
- Articles : ligne impaire (`odd:bg-white`) sans variante dark — corrigée
- Cause : le script v1.15.0 ne couvrait pas les `style={{ backgroundColor: '#fff' }}` inline React

## [v1.14.1] — Fix détection mot de passe existant
## [v1.15.0] — Dark mode
- Nouveau mode sombre accessible via Profil → Préférences → Thème
- Préférence persistée dans localStorage (dark/light)
- Couverture complète : backgrounds, textes, bordures, badges sémantiques (vert/rouge/amber/indigo/bleu/orange/violet/emerald/yellow/purple)
- Classes CSS globales (.card, .input, .btn-ghost, .label) adaptées en dark
- Scrollbars et autofill stylisés en dark
- Toggle dans l'onglet Préférences du profil personnel (remplace le placeholder "À venir")

- Fix : `hasPassword` détecte maintenant l'identité email via `user.identities` en plus de `has_password` (évite le cas où des utilisateurs ayant un MDP avant l'ajout de la colonne devaient quand même re-saisir l'ancien)
- DB : `has_password = true` mis à jour pour les comptes existants concernés
- Clic sur le nom dans la sidebar → page /profile (rôle responsable exclu)
- Onglet Sécurité : définir ou modifier son mot de passe (re-auth si MDP existant)
- Onglet Notifications : plages silencieuses (heures + jours) — badge + temps réel coupés
- Onglet Préférences : placeholders Thème et Page d'accueil (à venir)
- Migration DB : colonnes notif_schedule (jsonb) + has_password (boolean) sur profiles
- NotificationBell : icône 🔕 discrète + badge masqué si plage silencieuse active

## [v1.13.6] — PageHeader : fix toggle bouton ⋯
- Reclique sur ⋯ ferme correctement le dropdown (exclusion du bouton du listener mousedown extérieur)

## [v1.13.5] — PageHeader : responsive avec menu ⋯
- Zone centrale (onglets, recherche, filtres) overflow:hidden — jamais de 2e ligne
- Bouton ⋯ apparaît automatiquement dès que les items débordent (ResizeObserver)
- Dropdown sous le header avec tous les items, fermeture au clic extérieur
- Titre et actions toujours visibles à gauche / droite

## [v1.13.4] — PageHeader : layout repensé, ligne unique
- Gauche : Titre + (séparateur) + zone scrollable → onglets, leftActions, recherche, filtres, info
- Droite : actions spécifiques de la page (toujours fixe)
- Hauteur fixe 48px, jamais de 2e ligne — si la zone centrale déborde, elle scrolle silencieusement

## [v1.13.3] — Compositions : réordonner les groupes par glisser-déposer
- Ajout d'une poignée de déplacement (icône grip) dans l'en-tête de chaque groupe
- Glisser un groupe horizontalement pour changer son ordre dans le board
- Le pool "Élèves à placer" reste toujours en première position (non déplaçable)


## [v1.13.2] — Compositions : contrainte Séparer
- Nouveau bouton « Séparer » (orange, icône ciseaux) : marque 2+ élèves comme devant être dans des groupes différents
- Icône ciseaux orange sur les cartes ayant une contrainte de séparation
- Bordure rouge + icône ⚠️ sur les cartes dont un partenaire séparé est dans le même groupe
- Bouton « Déséparer » pour retirer la contrainte
- Avertissement modal si les élèves sélectionnés sont dans la même classe scolaire
- separatedSets sauvegardé/restauré avec le projet (Supabase + JSON)

## [v1.13c] — PageHeader adaptatif (1 ligne quand ça rentre)
- Suppression du 2 lignes forcé : le header s'affiche sur 1 ligne quand titre + toolbar rentrent
- Le toolbar descend en 2e ligne uniquement si nécessaire (container trop étroit)
- Le toolbar scrolle horizontalement si surcharge → jamais de 3e ligne
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

---

## [sidebar-smartschool-v2] — Bouton Smartschool affiné

### Changed
- **Sidebar.jsx** — redesign du bouton Smartschool :
  - Mode réduit : carré orange 40×40 avec icône lien externe (plus d'image externe)
  - Mode étendu : bouton card `#1a0f2e` h=44px, carré orange flush gauche, texte blanc `tracking-wide`
  - `w-full` ajouté pour occuper toute la largeur disponible

---

## [sidebar-smartschool-v3] — Smartschool : icône S-carré, style nav simple

### Changed
- **Sidebar.jsx** — refonte du lien Smartschool, retour au style "nav link" :
  - Nouveau composant `SmartschoolIcon` : carré orange (rx=4) avec lettre "S" blanche, 20×20px
  - Mode étendu : lien simple (gap-3, px-2, py-2.5, rounded-lg) avec icône + texte orange `#E86C00`
  - Mode réduit : même icône S-carré, sans fond supplémentaire — cohérent avec les autres items réduits
  - Suppression du fond card sombre `#1a0f2e` et du carré flush gauche 44px

## [v0.50] — 2026-06-23

### Changed
- **Activites.jsx — onglet Voyages** :
  - Champ "Type" masqué (un seul type possible : Voyage scolaire)
  - Section Finances remplacée pour les voyages :
    - "Montant par élève (annoncé)" : sélecteur D1 (150€) / D2 (350€) / D3 (550€)
    - "Montant total annoncé" : calculé automatiquement (tier × nb élèves, lecture seule)
    - POP supprimé pour les voyages
  - Logique inversée : c'est le tier par élève qui détermine le montant total
  - Intramuros/Extramuros : comportement inchangé (montant total + POP → calcul par élève)

### Migration DB
- `activites` : nouvelle colonne `montant_par_eleve_annonce NUMERIC`

## [v0.51] — 2026-06-23

### Fixed
- **Activites.jsx — Voyages** : calcul du montant total annoncé ne se mettait pas à jour
  - Cause : `f()` utilisait `form.nb_eleves` (champ manuel) au lieu de `nbEleves` (calculé depuis la sélection de classes)
  - Fix : `hasSelection` et `nbEleves` déplacés avant `f()` et utilisés dans la closure
  - Ajout d'un `useEffect` pour recalculer quand `nbEleves` change (ajout/retrait de classe)
  - Statut facturation passe correctement à "En attente" dès qu'un tier est sélectionné

## [v0.52] — 2026-06-23

### Changed
- **Activites.jsx** : section "Documents & Factures" masquée lors de la création d'une activité (uniquement visible en mode édition)

## [v0.53] — 2026-06-23

### Added
- **Activites.jsx — Édition en page entière** :
  - Modal d'édition transformé en page 3 colonnes (1/4 Messages | 2/4 Formulaire | 1/4 Documents & Dépenses)
  - Bouton "Retour" dans le PageHeader à gauche des onglets Intra-Extramuros / Voyages
  - Création reste en modal (sans l'ID de l'activité)
- **Composant DepensesPanel** (colonne droite) :
  - Documents PDF : upload glisser-déposer
  - Factures PDF : idem
  - Générer avis : uniquement pour intramuros/extramuros
  - Table dépenses (voyages uniquement) : Catégorie, Intitulé, Montant, Nb élèves, Par élève, Incompressible, Payé par, Justificatif PDF
  - Calculs automatiques : Montant total réel, Montant par élève réel
  - Élèves absents : réduction des dépenses non-incompressibles
- **DB** : tables `activite_depenses` + `activite_absents` avec RLS
- **Helpers** : `getParticipantEleves()` pour filtrer les élèves participants

## [v0.54] — 2026-06-23

### Changed
- **Activites.jsx — page d'édition** : colonnes réorganisées en 1/5 Messagerie | 2/5 Documents & Factures | 2/5 Formulaire

## [v0.55] — 2026-06-23

### Fixed
- **Activites.jsx — page d'édition** : suppression du slider global de la page
  - `overflow-y: hidden` sur le conteneur de scroll (#page-content-scroll) en mode page
  - Marges négatives pour échapper au padding du Layout (`px-6 py-8`)
  - Hauteur corrigée à `calc(100vh - 50px)` (viewport moins le PageHeader)
- **Layout.jsx** : ajout id `page-content-scroll` sur le conteneur scrollable

## [v0.56] — 2026-06-23

### Fixed
- **Activites.jsx — dropdowns élèves** : noms des élèves affichés correctement dans "Élèves absents", "Élèves à exclure" (ajout de `nom, prenom` dans la requête Supabase `eleves`)
- **DepensesPanel** : section "Factures PDF" masquée pour les voyages (les factures sont attachées aux dépenses) ; conservée pour intramuros/extramuros

## [v0.57] — 2026-06-23

### Fixed
- **Layout.jsx** : ajout `id="page-main-content"` + `flex flex-col` sur `<main>` pour permettre la gestion du layout en mode page
- **Activites.jsx — page d'édition** : suppression des scrollbars horizontal et vertical parasites
  - L'effet DOM remet à zéro `padding`, `maxWidth`, `margin`, `width` de `<main>` en mode édition (au lieu de marges négatives)  
  - Le conteneur d'édition utilise `flex: 1 1 0 / minHeight: 0` au lieu de `height: calc(100vh - 50px)`
  - Le wrapper du return Activites passe en `flex flex-col h-full overflow-hidden` en mode édition → le contenu occupe exactement l'espace disponible sans débordement

## [v0.58] — 2026-06-23

### Added
- **DepensesPanel (voyages)** : ajout colonne "Absents réel" dans la ligne des totaux
  - 3 colonnes : Montant total réel | Par élève réel | Absents réel
  - "Absents réel" = somme des dépenses incompressibles / nb total élèves
  - Affiché en amber si des absents sont signalés, grisé avec "—" sinon

## [v0.59] — 2026-06-23

### Added
- **DB** : colonne `avance` (boolean) sur `activite_depenses`
- **DepensesPanel (voyages)** : grille top row passe de 2 à 4 sections
  - Documents PDF | Générer avis | Demande d'avance | Générer rapport
- **Générer avis** : activé pour les voyages (montant par élève annoncé uniquement)
- **Demande d'avance** : nouveau bouton + Netlify function `activite-avance-pdf.mjs`
  - Formulaire imprimable : coordonnées personnel, IBAN, date, dépenses marquées "Avance", mention documents originaux, 2 signatures
- **Générer rapport** : nouveau bouton + Netlify function `activite-voyage-rapport-pdf.mjs`
  - Rapport complet : KPIs, infos, tableau dépenses détaillé, totaux
- **Dépenses** : checkbox "Avance" (bleu) à côté de "Incompressible" dans chaque ligne de dépense

## [v0.60] — 2026-06-23

### Changed
- **activite-avis-pdf.mjs** : footer "Avis généré par" → "Document généré par"
- **activite-avance-pdf.mjs** :
  - Header identique à l'avis (adresse école au lieu du tel/email)
  - Footer identique à l'avis ("Document généré par ESPM+ le [date]")
  - Coordonnées du personnel en grille 2 colonnes (moins de place)

## [v0.61] — 2026-06-23

### Changed
- **activite-avance-pdf.mjs** : badge "Demande d'avance" déplacé à droite du titre, "Document généré le" supprimé, champ "École" retiré, formulaire coordonnées plus compact

## [v0.62] — 2026-06-23

### Changed
- **activite-avance-pdf.mjs** : formulaire coordonnées restructuré en 2 colonnes — gauche : Nom, Prénom, IBAN, Téléphone — droite : Adresse (grande zone)

## [v0.63] — 2026-06-23

### Changed
- **Activites.jsx** : en mode édition (activité existante), "Publier" → "Sauvegarder les modifications" et "Brouillon" → "Repasser en brouillon" (intra-extramuros et voyages)

## [v0.64] — 2026-06-23

### Changed
- **Activites.jsx** : champ Description agrandi (rows 2 → 5) dans le modal et la page d'édition
- **activite-voyage-rapport-pdf.mjs** :
  - Badge "Rapport — Voyage scolaire" déplacé à droite du titre
  - "Rapport généré le" supprimé de la ligne de date
  - Header/footer identiques à l'avis (adresse école, footer "Document généré par ESPM+")
  - Section Informations : Description retirée, Départ/Retour sur une ligne (sans heure), Lieu de RDV/retour remplacés par Lieu
  - Dépenses groupées par catégorie avec sous-totaux par catégorie

## [v0.65] — 2026-06-23

### Changed
- **activite-voyage-rapport-pdf.mjs** : "Lieu" retiré de la section Informations (déjà dans les KPIs)
- **activite-voyage-rapport-pdf.mjs + Activites.jsx** : "Par élève réel" → "Facturé aux élèves présents" ; "Absents réel" → "Facturé aux élèves absents"

## [v0.66] — 2026-06-23

### Added
- **Acomptes voyage** : nouveau système de facturation en plusieurs fois pour les voyages scolaires
  - Migration DB : `activites.acomptes_config` (JSONB), `facture_batches.voyage_activite_id / voyage_batch_type / voyage_acompte_index`
  - Formulaire voyage : section "Acomptes" pour configurer N acomptes (label + montant) avec total et comparaison au montant annoncé
  - DepensesPanel : section "Acomptes & Solde" (voyages uniquement) — status par acompte, bouton Générer, bouton Générer solde
  - Calcul automatique du solde réel : élèves présents (toutes dépenses) / absents (dépenses incompressibles seulement), moins les acomptes déjà facturés
  - Les factures de solde peuvent être négatives (avoir à rembourser)
  - Les batches acomptes/solde sont liés à l'activité via `voyage_activite_id`

### Changed
- **Factures.jsx** : voyages avec acomptes configurés exclus du flux de facturation classique (gérés depuis la page voyage)

## [v0.67] — 2026-06-23

### Changed
- **Home.jsx** (HomeFinancier) : Vue financière redessinée — 4 cards dégradées rouge→orange→ambre→vert
  - Card 1 (rouge) : Impayés — soldes négatifs cumulés
  - Card 2 (orange) : Échelonnements — montant total en cours / non respecté
  - Card 3 (ambre) : Organismes tiers — montant total des demandes actives (en cours / validé)
  - Card 4 (vert) : En réserve — soldes positifs cumulés
  - Suppression des graphiques sparkline et de tout le code de calcul mensuel associé

## [v0.68] — 2026-06-23

### Changed
- Renommage "Assistant social" → "Suivi social" dans la sidebar, le header, la page AssistantSocial, et la section de l'accueil
- Fix : liens des cards Vue financière corrigés (`/assist-social` → `/assistant-social`)

## [v0.69] — 2026-06-23

### Added
- **Élèves** : nouveau filtre "Suivi social" avec deux options — "Échelonnement actif" et "Organisme tiers actif"
- **Home.jsx** : cards Échelonnements et Organismes tiers pointent vers `/eleves?suivi=échelonnement` / `/eleves?suivi=organisme` (pré-filtre automatique)

## [v0.70] — 2026-06-24

### Fixed
- **Sidebar** (mode réduit) : alignement de la cloche avec les autres icônes du bas — suppression du `justify-center` parasite et harmonisation du padding vertical (`py-2.5`)

## [v0.71] — 2026-06-24

### Fixed
- **Sidebar / NotificationBell** : dropdown s'ouvre maintenant vers le haut (`bottom-10`) pour éviter de sortir du viewport quand la cloche est en bas de la sidebar
- **Sidebar** : rangée "Notifications" entièrement cliquable (hover + curseur) comme "Administration" — un clic sur le texte ouvre le panneau

## [v0.72] — 2026-06-24 (rev2)

### Fixed
- **MasterFilter** : remplacement des checkboxes HTML natifs (quasi-invisibles non-cochés) par des checkboxes custom avec fort contraste — fond blanc + bordure `gray-400` non coché, fond primary + coche blanche coché
- **MasterFilter** : amélioration des séparateurs (`divide-gray-50` → `divide-gray-100`) et des bordures de liste (`border-gray-100` → `border-gray-200`) pour une meilleure lisibilité
- **MasterFilter** : largeur du panneau étendue à 560px pour les pages avec 6+ colonnes de filtre (ex. Groupes), évitant l'entassement

## [v0.72b] — 2026-06-24

### Fixed
- **MasterFilter** : suppression totale de l'`<input>` HTML natif (remplacé par `div + onClick`) — élimine toute interférence du rendu natif du navigateur
- **MasterFilter** : checkbox custom via inline-style (border 2px `#6b7280` non coché, fond `#2D1B2E` + coche blanche coché) — contraste maximum garanti
- **MasterFilter** : séparateurs entre options via `border-t border-gray-100` au lieu de `divide`

## [v0.72c] — 2026-06-24

### Fixed
- **PageHeader** : stacking context corrigé — `z-10` → `z-40` pour garantir que le dropdown MasterFilter s'affiche au-dessus du `<thead>` sticky (z-20) et des `<th>` sticky (z-30) des tables. C'est la vraie cause de l'invisibilité des filtres sur Groupes, Élèves, Paiements.

## [0.73] — 2026-06-24
### Changed
- Sidebar : renommage "Élèves" → "Soldes" (route `/eleves`) avec nouvelle icône portefeuille
- Sidebar : renommage "Groupes" → "Élèves" (route `/groupes`) avec récupération de l'icône personnes
- Sidebar : nouvel ordre — Accueil, Élèves, Activités, Soldes, Factures, Paiements, Articles, Suivi social
- Eleves.jsx : titre page "Élèves" → "Soldes"
- Groupes.jsx : titre page "Groupes" → "Élèves"

## [v0.74] — 2026-06-24
### Changed
- **AssistantSocial** : statut OT `en_cours` — libellé "En cours" renommé en "Demande en cours" (badge + formulaire + filtre)
### Added
- **Articles** : bouton "📄 Rapport articles" dans la barre de navigation (visible financier+) — génère un rapport HTML imprimable via la Netlify Function `articles-rapport-pdf`
- **Netlify Function** `articles-rapport-pdf.mjs` v1.0 — rapport par article, par catégorie et total : montant attribué, montant facturé, montant payé, montant impayé (dont échelonnement en cours, dont OT en attente)

## [v0.74a] — 2026-06-24
### Changed
- **Rapport articles** : suppression de la ligne de métadonnées sous le titre (date + nb attributions + nb articles) — déjà présente dans le footer

## [0.74] — 2026-06-24
### Added
- **Helpdesk** : nouvelle page `/helpdesk` accessible à tout le staff (admin/financier/mdp)
  - Liste des tickets avec filtres Actifs / Fermés / Tous, recherche, badges statut/priorité
  - Modal "Nouveau ticket" : choix de catégorie → formulaire dynamique (titre + priorité + champs configurés)
  - `/helpdesk/:id` : fil de discussion, notes internes (agents), upload pièces jointes avec compression auto
  - Panneau agent (admin) : statut, priorité, assignation, fermeture du ticket
- **4 catégories pré-configurées** : Demande de matériel, Demande de réservation, Problème bâtiment, Problème informatique
- **Admin > onglet Helpdesk** : gestion des catégories, form builder (ajout/suppression/réordonnancement de champs), option purge des pièces jointes
- Compression automatique des images avant upload (browser-image-compression, max 500KB)
- 3 tables Supabase : `helpdesk_categories`, `helpdesk_tickets`, `helpdesk_messages`
- Bucket Supabase `helpdesk-attachments` (5MB max, images + PDF + Word)

## [v0.75] — 2026-06-24
### Changed
- **Helpdesk — cartes rich** : remplacement de la table par des cartes à bordure gauche colorée (couleur de catégorie), style inspiré de la page Activités
  - Titre + badge statut + badge messages non-lus (rouge) + priorité + créateur + date
- **Helpdesk — filtres catégorie** : boutons rapides dans le header pour filtrer par catégorie (couleur de chaque catégorie)
- **Helpdesk — détection doublons** : lors de la création d'un ticket, la catégorie affiche le nombre de tickets ouverts ; à l'étape formulaire, un encadré orange liste les tickets existants de la catégorie avec lien direct
- **Helpdesk — messages non-lus** : badge rouge sur les cartes de la liste quand un ticket a été mis à jour depuis la dernière visite (tracking localStorage `hd_lastSeen`)

## [v0.76] — 2026-06-24
### Changed
- **Helpdesk — layout** : cartes full-width (suppression maxWidth:900), style conforme aux autres pages
- **Helpdesk — "Mes tickets"** : bouton toggle dans le header, actif par défaut (affiche uniquement les tickets du compte connecté)
- **Helpdesk — filtres catégorie** : même style pill-container que les tabs Actifs/Fermés/Tous, séparé visuellement
- **Helpdesk — détection doublons** : simplification — liste discrète titre + créateur + lien, sans warning box
- **Helpdesk — création** : upload de pièces jointes possible dès la création du ticket (zone dépôt en bas du formulaire)
- **HelpdeskDetail — header** : intégration dans PageHeader avec "← Helpdesk" (style Activités), titre dans la barre, statut et priorité comme tags dans la zone filters, bouton "Fermer/Réouvrir" dans actions
- **HelpdeskDetail — badges** : remplacement des pills ovales (border-radius:999) par des tags angulaires (border-radius:4)
- **HelpdeskDetail — "Assigné à"** : remplacé par "Participants" — liste des collègues impliqués avec avatars initiales, ajout/suppression depuis le panneau droit
### Added
- Migration Supabase : colonne `participant_ids uuid[]` sur `helpdesk_tickets`

## [v0.77] — 2026-06-24
### Changed
- **Helpdesk — "Mes tickets"** : fond blanc + texte foncé quand actif (même style que les tabs actifs), plus visible
- **Helpdesk — statut sur carte** : select stylisé (couleur de la catégorie, fond coloré, flèche discrète) directement sur chaque carte — clic intercepté (ne navigue pas vers le ticket)
- **HelpdeskDetail — bouton Fermer** : ajouté à côté de "Envoyer" dans la zone de saisie ; si un message est en cours de rédaction, l'envoie avant de fermer
- **HelpdeskDetail — auto-statut** : passage automatique à "En attente" après envoi de tout message (tant que le ticket n'est pas fermé)

## [v0.78] — 2026-06-24
### Added
- **Système de droits dynamique** : 2 nouvelles tables Supabase (`role_permissions` + `user_permissions`), seedées avec la matrice validée
- **AuthContext — `can(feature)`** : charge les permissions depuis la DB au login, applique les overrides individuels. Subscription realtime Supabase — les changements de droits se propagent en temps réel sans redéploiement
- **Admin — onglet Droits** : matrice interactive avec toggles par rôle (colonne Admin verrouillée), groupement par section ; section "Exceptions individuelles" pour accorder/révoquer un droit par personne indépendamment de son rôle
- **`src/lib/permissions.js`** : source de vérité partagée (FEATURES, ROLES, ROLE_META, FEATURE_GROUPS)
### Fixed
- **AssistantSocial** : MdP n'a plus accès au Suivi social (données sensibles) — `isFinancier || isMdp` → `isFinancier`

## [v0.79] — 2026-06-24
### Added
- **Salle des profs** (`/salle-des-profs`) : nouveau module collaboratif accessible aux rôles admin, financier et mdp
  - Deux espaces : "Salle des profs" (partagée) et "Mon casier" (personnel/privé)
  - Dossiers colorisables, avec emoji, épinglables (pinnable), gestion par le créateur ou l'admin
  - 4 types d'items : images (compression auto via browser-image-compression), documents PDF/Word, liens web, notes texte
  - Supabase Storage bucket `padlet-files` (25 Mo max, JPEG/PNG/WebP/GIF/PDF/Word)
  - Tables `padlet_folders` + `padlet_items` avec RLS (créateur = propriétaire, admin = gestionnaire global)
  - Permissions DB : `salle_profs` ajouté dans `role_permissions` (ON pour admin/financier/mdp)
  - Icône maison dans la sidebar

## [v0.79g] — 2026-06-24
### Fixed
- **SalleDProfs.jsx** — 4 bugs corrigés qui bloquaient l'affichage des dossiers après création :
  - `loadFolders` : query Supabase JS v2 immuable — `q.eq('created_by', …)` ne modifiait pas `q` → corrigé en `q = q.eq(…)`
  - `loadFolders` et `loadFolderContent` : ajout de `try/finally` → `setLoading(false)` / `setContentLoading(false)` garantis même en cas d'erreur (ex : cache PostgREST non rechargé après migration `parent_id`)
  - `createFolder` / `updateFolder` : throw sur erreur Supabase pour que `FolderModal` puisse l'intercepter
  - `FolderModal` : ajout `try/catch` dans `handleSave` + message d'erreur visible si l'insertion échoue
- Schema PostgREST rechargé (`NOTIFY pgrst, 'reload schema'`) pour exposer la colonne `parent_id` fraîchement ajoutée

## [v0.79h] — 2026-06-24
### Fixed
- **SalleDProfs.jsx** — breadcrumb : `<>` fragment remplacé par `<div display:flex alignItems:center>` pour aligner le chevron `›` avec le texte "Salle des profs"
- **Supabase RLS** — policy `padlet_folders_select` récrite sans sous-SELECT auto-référentiel (erreur `42P17 infinite recursion`)

## [v0.79i] — 2026-06-24
### Changed
- **SalleDProfs.jsx** — cards racine plus compactes : bandeau 160→145px, grille `minmax(270px→220px,1fr)` (4 colonnes sur écrans larges)

## [v0.80] — 2026-06-24 — Système Trello intégré

### Nouveautés
- **TrelloBoardView** : composant kanban complet (782 lignes)
  - Colonnes (listes) avec drag & drop des cartes via @dnd-kit/sortable
  - Cards : titre, description, checkbox complétion
  - Détail carte : description éditable, checklist avec barre de progression, journal d'activité
  - Activité tracée : création, déplacement (from/to liste), modification, complétion, check/uncheck items
  - CRUD complet : ajouter/renommer/supprimer listes et cartes, ajouter/cocher/supprimer items checklist
- **Salle des profs** : tableaux Trello mélangés aux dossiers dans la grille
  - Carte visuelle avec badge TABLEAU et motif kanban décoratif
  - Bouton `+ Tableau` dans le header (à la racine seulement)
  - Modal création/édition : nom, couleur, émoji
  - Épinglage, modification, suppression de boards
  - Navigation : clic → ouvre TrelloBoardView, fil d'Ariane pour revenir

### Technique
- DB : migration `create_trello_tables` appliquée (trello_boards/lists/cards/checklist_items/activity + RLS)
- Packages : @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities installés

## [v0.80b] — 2026-06-24 — Drag & drop réorganisation grille + dossiers

### Nouveautés
- **Grille racine réorganisable** : dossiers et tableaux glissables pour changer leur ordre (position persistée en DB)
- **Items dans dossiers réorganisables** : les éléments d'un dossier (images, liens, notes, fichiers) peuvent être glissés pour changer leur ordre (position persistée en DB)
- Overlay visuel pendant le drag (card fantôme avec rotation)

### Technique
- DB : migration `add_position_columns_padlet_trello` appliquée (`position INTEGER` sur padlet_folders, trello_boards, padlet_items)
- `allItems` : tableau fusionné folders+boards trié par position, IDs préfixés (`folder-`, `board-`, `item-`)
- `SortableItemCard` : wrapper @dnd-kit/sortable autour de `ItemCard`
- `handleRootDragEnd` + `handleItemDragEnd` : réordonnement optimiste + mise à jour DB en parallèle

## [v0.80c] — 2026-06-24 — Page Économe v1 (Phase 1)

### Nouveautés
- **Page Économe** : nouvelle page comptable avec 5 onglets (Fonctionnement, Élèves, POP, Bilan, Projets)
- **Tab Fonctionnement** : import CSV Belfius, liste transactions avec entrées/sorties, attribution Nature comptable inline
- **Tab Élèves** : import CSV Belfius, liste transactions (paiements entrants), statut paiement (pending/imported/ignored)
- **NatureSelect** : dropdown groupé par catégorie avec recherche plein-texte
- **Barre de synthèse** : total entrées, total sorties, solde, nb non-classés
- Filtres : année, mois, recherche texte, "en attente seulement" (onglet Élèves)
- Import modal avec drag-and-drop, aperçu, détection doublons (via référence Belfius)
- Onglets POP/Bilan/Projets en placeholder "En développement"
- **Admin › Natures comptables** : onglet CRUD complet dans Admin.jsx (liste par catégorie, activation/désactivation, création/édition/suppression)

### Technique
- DB : migration `create_comptable_tables` appliquée (comptable_natures, comptable_imports, comptable_transactions, comptable_projets, comptable_projet_lignes + RLS admin-only)
- DB : seed 60 natures comptables (catégories : Achats, Catering, Divers, Élèves, Entretien, ExtraMuros, Frais pédagogiques, Voyages Scolaires)
- `src/pages/Econome.jsx` créé (~790 lignes)
- `src/lib/permissions.js` : feature `econome` ajoutée
- `src/components/layout/Sidebar.jsx` : icône + lien Économe
- `src/App.jsx` : route `/econome` ajoutée (RequireAuth admin)
- `src/pages/Admin.jsx` : onglet "Natures comptables" + composants NaturesAdmin + NatureModal

## [v0.80d] — 2026-06-24 — Économe : sélection multiple + bulk assign nature

### Amélioration
- **Cases à cocher** : chaque ligne de transaction est sélectionnable (clic sur la ligne ou sur la case)
- **Select all** : case dans l'en-tête pour tout cocher/décocher (indeterminate si sélection partielle)
- **Barre d'action bulk** : apparaît dès qu'une ligne est cochée — NatureSelect + "Appliquer (N)" + "Désélectionner"
- Mise à jour en base par lots de 100 (`.in()`)
- Clic sur ligne = toggle sélection ; clic NatureSelect ou bouton Supprimer = stop propagation

## [v0.80e] — 2026-06-25 — Économe : onglet Élèves identique à Fonctionnement

### Correction
- **Onglet Élèves** : affiche désormais toutes les transactions (entrées ET sorties), comme l'onglet Fonctionnement
- Suppression du filtre `montantRaw <= 0` dans le parseur CSV pour le compte élèves
- Colonnes Sortie + Solde visibles dans les deux onglets
- `statut_paiement: 'pending'` uniquement sur les lignes avec `montant_entree` (pas sur les virements vers POP)

## [v0.80f] — 2026-06-25 — Économe : bulk action inline dans la barre de synthèse

### UX
- Les contrôles de sélection multiple (nb sélectionnées + NatureSelect + Appliquer + ✕) apparaissent
  maintenant directement dans la barre ENTRÉES/SORTIES/SOLDE/TRANSACTIONS/NON CLASSÉ,
  séparés par un diviseur vertical — plus de barre collante séparée au-dessus du tableau

## [v0.80g] — 2026-06-25 — FIX Économe : sélection se décochait immédiatement

### Correction
- `filtered` mémoïsé avec `useMemo` dans `CompteTab` — sans ça, chaque `setSelected` déclenchait un nouveau render → nouveau tableau `filtered` → l'`useEffect` dans `TransactionTable` réinitialisait la sélection en boucle
- `useEffect` de reset supprimé de `TransactionTable` (le reset se fait maintenant uniquement après un bulk apply)

## [v0.80h] — 2026-06-25 — Phase 2 Économe : onglet POP + import depuis Économe

### Nouvelles fonctionnalités
- **Onglet POP** (Econome.jsx) : encodage manuel des notes de frais et factures transmises au Pouvoir Organisateur Pluriel
  - Table avec Date de transmission, Fournisseur, N° pièce, Nature comptable, Montant, Commentaire
  - Barre de synthèse : total transmis au POP, nombre de lignes, compteur Non classé
  - Formulaire modal d'ajout/édition
  - Attribution de nature comptable inline (même NatureSelect que les autres onglets)
  - Filtre par année et par mois
  - Nouvelle table Supabase : `comptable_pop_lignes` avec RLS admin
- **Paiements.jsx** : nouveau bouton "Depuis Économe" dans le header
  - Modal `PendingEconomeModal` : affiche toutes les transactions `comptable_transactions` (compte=eleves, statut_paiement=pending)
  - Matching automatique des élèves par communication/libellé (normalisation accents + ponctuation)
  - Dropdown de correction manuelle de l'association élève
  - Import en lot avec marquage `statut_paiement='imported'` après succès
  - Pré-sélection intelligente : cases cochées si élève trouvé automatiquement, décochées sinon
  - Les lignes déjà importées s'affichent en grisé avec badge "Importé"

## [v0.80i] — 2026-06-25 — Phase 3 Économe : onglet Bilan mensuel

### Nouvelles fonctionnalités
- **Onglet Bilan** (Econome.jsx) : tableau croisé Produits / Charges par mois
  - Sources de données fusionnées : `comptable_transactions` (Fonctionnement + Élèves) + `comptable_pop_lignes`
  - Colonnes = 12 mois ; colonne Total annuel fixe à droite
  - Seuls les mois avec données sont mis en valeur (les autres s'affichent en grisé)
  - Section **PRODUITS** : natures `type_flux='produit'`, groupées par catégorie, avec sous-totaux catégorie cliquables (plier/déplier)
  - Section **CHARGES** : natures `type_flux='charge'`, même structure (affichées avec signe −)
  - Natures `type_flux='neutre'` exclues du bilan
  - Ligne **SOLDE** avec indicateur dynamique : ✓ Sur couverture (vert) / ⚠ Sous couverture (rouge)
  - Avertissement si des transactions sans nature ne sont pas comptabilisées

## [v0.81] — 2026-06-25 — FIX Paiements : UX boutons + fermeture modal

### Corrections
- Modal "Depuis Économe" se ferme automatiquement après l'import réussi
- Bouton "Import CSV" supprimé du header Paiements (remplacé par le flux Économe)
- Bouton "+ Paiement" adopte le même style ghost que "Depuis Économe"

## [v0.81b] — 2026-06-25 — Bilan v2 : vue Couverture élèves + Admin in_couverture

### Nouvelles fonctionnalités
- **Bilan — Vue Couverture élèves** (onglet par défaut) :
  - Affiche uniquement les charges marquées `in_couverture=true` (Extramuros, Voyages scolaires, Frais pédagogiques, Achats-Événements) confrontées à tous les encaissements élèves
  - 3 cartes récap : Total dépenses / Total encaissé / Solde (Avance en indigo, Découvert en ambre)
  - Tableau mensuel avec sous-totaux par catégorie pliables/dépliables
- **Bilan — Vue Générale** (onglet secondaire) : tableau Produits/Charges complet conservé pour vision globale
- **Migration DB** : colonne `in_couverture boolean` sur `comptable_natures` (28 natures marquées au seed)
- **Admin — Natures comptables** : nouveau toggle "Couverture élèves" dans le formulaire d'édition

## [v0.81c] — 2026-06-25 — Phase 4 Économe : onglet Projets

### Nouvelles fonctionnalités
- **Onglet Projets** (Econome.jsx) : modèle universel pour les petits projets (Pâtes, Fancy Fair, Rhétos…)
  - Création/édition/suppression de projets (nom, année, description, catégories configurables)
  - Catégories entièrement configurables par projet (tags ajout/suppression dans le modal, ou texte libre si aucune catégorie définie)
  - Table de lignes : Date, Intitulé, Catégorie, Entrée, Sortie, Commentaire
  - Affichage groupé par catégorie avec sous-totaux (Entrée / Sortie / Solde) pliables/dépliables
  - Grand total en pied de tableau
  - 3 cartes récap en haut : Total entrées / Total sorties / Solde
  - Clôture de projet (lecture seule une fois clôturé)
  - Saisie d'une ligne : si Entrée remplie → Sortie se vide automatiquement (et vice versa)
  - Deux nouvelles tables Supabase : `comptable_projets` + `comptable_projet_lignes` avec RLS admin

## [v0.81d] — 2026-06-25 — FIX Projets : schema DB + gestion erreurs

### Corrections
- Migration DB : ajout colonnes `description` et `cloture` sur `comptable_projets` (table créée dans une session antérieure avec des colonnes manquantes)
- `saveProjet` et `saveLigne` : ajout try/catch avec message d'erreur visible — les erreurs Supabase étaient silencieuses

## [v0.81e] — 2026-06-25 — FIX Projets : colonnes date_ligne/note/commentaire

### Corrections
- `comptable_projet_lignes` : table ancienne avec `date_ligne` au lieu de `date` et `note` au lieu de `commentaire`
- Migration : ajout colonnes `date`, `commentaire`, `position` + synchronisation `date ← date_ligne`
- Code : payload envoie maintenant les deux noms (`date`+`date_ligne`, `commentaire`+`note`) pour compat
- Affichage date et commentaire dans l'édition : fallback sur l'ancienne colonne

## [v0.81f] — 2026-06-25 — Phase 5 Économe : Exports Excel, Graphiques Bilan, PDF

### Nouvelles fonctionnalités
- **Export Excel** (SheetJS) :
  - Onglets Fonctionnement et Élèves : bouton "Excel" → colonnes Date, Libellé, Nature, Catégorie, Entrée, Sortie, Solde cumulé — filename `ESPM_{compte}_{annee}.xlsx`
  - Onglet POP : bouton "Excel" → colonnes Date, Fournisseur, N° pièce, Nature, Catégorie, Montant, Solde cumulé — filename `ESPM_POP_{annee}.xlsx`
  - Largeurs de colonnes auto-ajustées
- **Graphiques Bilan** (recharts) :
  - Composant `BilanCharts` partagé entre Vue Couverture et Vue Générale, rétractable/déployable
  - Barres groupées comparant les deux flux par mois (Dépenses/Encaissements ou Charges/Produits)
  - Courbe de solde cumulatif avec remplissage de zone
- **PDF Bilan** — `netlify/functions/econome-bilan-pdf.mjs` :
  - GET `?annee=YYYY&token=JWT` → HTML avec `window.print()` automatique
  - Page de vue générale (Produits/Charges par mois avec solde) + page couverture élèves
  - Cartes récap : Total produits / Total charges / Solde général / Couverture élèves
  - Rendu paysage A4 optimisé (@media print)
- **PDF Projets** — `netlify/functions/econome-projet-pdf.mjs` :
  - GET `?projetId=UUID&token=JWT` → HTML avec `window.print()` automatique
  - Lignes groupées par catégorie avec sous-totaux, grand total, cartes récap
  - Badge statut (En cours / Clôturé), description du projet si renseignée
- **Boutons PDF** dans l'UI :
  - Tab Bilan : bouton "PDF Bilan" dans la toolbar (à côté du sélecteur d'année)
  - Tab Projets : bouton "PDF Projet" dans la toolbar (visible quand un projet est sélectionné)

### Dépendances ajoutées
- `xlsx` (SheetJS) — export Excel côté client
- `recharts` — graphiques dans le Bilan


## [v0.81g] — 2026-06-25 — FIX PDF Bilan v2 : données correctes + header/footer + mise en page

### Corrections
- **Bug données vides** : la fonction utilisait `.gte('date', ...)` alors que la table `comptable_transactions` utilise `date_operation`. Fix : `.gte('date_operation', ...)` + `.lte('date_operation', ...)`. Ajout des données POP (`comptable_pop_lignes`) manquantes dans l'agrégation (même logique que BilanTab).
- **Header/footer standard** : logo école + adresse + téléphone + email (identique aux autres rapports PDF)
- **Mise en page 2 pages fixes** : Page 1 = Vue générale, Page 2 = Couverture élèves — chaque page a son propre header/footer avec "Page X / 2"
- **Bouton "Imprimer / Enregistrer PDF"** ajouté (masqué à l'impression)
- **Numéros de lignes** (#) sur chaque nature comptable
- **Sauts de page** : `page-break-before: always` entre les deux sections, `page-break-inside: avoid` sur les en-têtes de catégories
- Rendu paysage A4 optimisé (12mm marges, 297mm width)



## [v0.81h] — 2026-06-25 — Module Compositions : outil de composition de classes

### Nouvelles fonctionnalités
- **Page Compositions** (`/compositions`) — outil entièrement numérique de composition de classes (prévu pour projection sur tableau interactif)

#### Migration DB
- Colonne `groupes_ss jsonb DEFAULT '[]'` sur la table `eleves` — groupes Smartschool non-klas
- Colonne `amenagements_raisonnables text` sur la table `eleves` — aménagements raisonnables

#### Synchronisation Smartschool (`smartschool-sync.mjs`)
- Extraction des groupes non-klas dans `groupes_ss` (tous les groupes Smartschool sauf la classe officielle)
- Détection des aménagements raisonnables : groupes préfixés "AR" + champs libres (`vrij1`…`vrij8`) contenant "aménagement/AR"

#### Compositions.jsx — deux onglets
**Configuration :**
- Nom de la composition
- Filtre élèves par année (1e–6e) ou par classe précise
- Toggles champs vignette (Photo / Classe / Groupes SS / Aménagements raisonnables)
- Gestion des groupes cibles (ajout, renommage, suppression)
- Import / Export JSON (persistance de la composition)

**Board (Kanban DnD) :**
- Colonne "Pool" (élèves non encore placés) + colonnes groupes
- Vignettes élèves avec photo Smartschool, nom/prénom, classe, groupes, badge AR
- Drag-and-drop (`@dnd-kit`) avec déplacement multi-sélection
- Liaison de cartes (`Link`) : déplacer plusieurs élèves liés d'un seul geste
- DragOverlay avec compteur "+N autres" quand multi-sélection
- Scroll horizontal sur le board, scroll vertical par colonne

#### Permissions & navigation
- Feature `compositions` ajoutée dans `permissions.js`
- Entrée sidebar (visible `isMdp`) avec icône dédiée
- Route `/compositions` dans App.jsx (RequireAuth `mdp`)


## [v0.81i] — 2026-06-25 — Compositions v2 : fixes + nouvelles fonctionnalités

### Corrections
- **Photos** : `ElevePhoto` réécrit en `fetch POST` vers `smartschool-photo.mjs` (l'ancienne version faisait un GET invalide). Utilise `smartschool_username` au lieu de `internalNumber`. Cache en `sessionStorage` par username.
- **Bug JSX** : structure `EleveCard` corrigée (balises mal imbriquées introduites lors du premier patch).

### Nouvelles fonctionnalités — Configuration
- **Sélection individuelle** : recherche par nom + clic pour exclure/réintégrer un élève spécifique dans la composition (indépendamment du filtre année/classe)
- **Champs personnalisés** : créer des champs ad hoc (ex: "Langue maternelle") — les valeurs sont saisies directement sur les vignettes du board via un mini-champ inline

### Nouvelles fonctionnalités — Vignettes
- **RLMO** : nouveau champ affiché sur les vignettes (`philosophie` + `groupe_choix_philo`), badge vert, toggle activable/désactivable
- **Troubles attestés** : renommé depuis "Aménagements raisonnables" ; badge orange + détail complet sous la vignette
- **Champs personnalisés** : mini-inputs inline éditables directement sur la carte (clic sans déclencher le DnD)

### Amélioration sync Smartschool
- Détection "Troubles attestés" élargie : groupes préfixés "AR", "trouble", "dys", champs libres `vrij1`–`vrij8` non vides, et champs API `leerstoornis`/`stoornis` si présents
- Requête Supabase enrichie : `smartschool_username`, `philosophie`, `groupe_choix_philo` ajoutés au SELECT

## [v0.82] — 2026-06-25 — Compositions v3 : refonte UI + persistance localStorage

### Général
- **Ordre onglets inversé** : "Composition" devient le premier onglet (tab par défaut), "Configuration" en second
- **RLMO supprimé** : champ RLMO retiré de DEFAULT_FIELDS et des vignettes (déjà visible dans les groupes Smartschool → pas de double affichage)

### Configuration
- **Import/export JSON** déplacés : retirés de la Config, accessibles dans la modal "Ouvrir" (export) et via "Ouvrir" (import)
- **Source compacte** : filtre par année (pills) + filtre par classe (chips scrollables) dans un bloc condensé, plus compact que les anciens boutons
- **"Groupes cibles" supprimé** : section retirée (déjà gérée dans le board Composition)
- **Ordre des sections** réorganisé : Nom → Source → Champs affichés → Champs personnalisés → CTA (les champs perso sont maintenant juste après les champs affichés)

### Composition
- **Bouton "+ Nouveau groupe" droit supprimé** : seul le bouton dans la barre info et la colonne ghost restent
- **Mode compact / étendu** : bouton toggle dans la barre du board — Compact = photo + nom + prénom uniquement, Étendu = photo + nom + prénom + groupes + troubles + champs perso
- **Persistance localStorage** : les compositions sont sauvegardées dans `localStorage` (`espm_compositions_v1`) — load/save avec noms personnalisables
  - Bouton "Sauvegarder" dans le header → modal avec nom éditable
  - Bouton "Ouvrir (N)" dans le header → liste des compositions avec date, charger ou supprimer
  - Import/export JSON disponibles dans la modal "Ouvrir"

## [v0.82b] — 2026-06-25 — Compositions v3.1 : Source refonte avec MasterFilter

### Configuration — Source
- **Filtres** : remplacement des pills "Par année / Par classe" par le composant `MasterFilter` (identique à la page Élèves) — dropdown avec colonnes Année et Classe, compteur de filtres actifs
- **Recherche** : champ de recherche par nom d'élève (pour exclure individuellement) déplacé sur la même ligne que le bouton Filtres
- **Exclusion individuelle** : les résultats de recherche apparaissent uniquement quand un terme est tapé (plus de grille de 670 pills affichée en permanence) — cliquer sur un résultat exclut/réintègre l'élève
- **Compteur d'exclus** : affiché à droite de la ligne filtres/recherche quand ≥1 élève exclu, avec bouton "✕ N exclus" pour tout réintégrer

## [v0.82c] — 2026-06-25 — Compositions v3.2 : photos, étendu, auto-save

### Fix photos
- **`smartschool-photo.mjs`** : accepte maintenant `internalNumber` comme `$userIdentifier` (prioritaire sur `username`). Cohérent avec `smartschool-notify.mjs` qui utilise déjà le numéro interne — le champ unique API de la plateforme est "numéro interne", pas l'identifiant web.
- **`ElevePhoto`** : passe `internalNumber` (smartschool_internal_number) en priorité, `username` en fallback. Cache sessionStorage séparé par type d'identifiant.

### Mode étendu
- Tous les groupes SS affichés (plus de limite à 2)
- Largeur carte étendu : 220 → 240px
- Tags groupes sans troncature

### Auto-save + UX
- **Auto-save débounced 1.5s** : toute modification (nom, filtres, groupes, assignments, champs, mode carte) déclenche une sauvegarde automatique sous le nom de la composition
- **"Accéder à la composition"** (ex "Ouvrir le board") : sauvegarde immédiate avant de basculer vers le board
- **Bouton "Sauvegarder" supprimé** : remplacé par l'auto-save + indicateur "✓ Sauvegardé HH:MM" dans la barre du board
- **"Ouvrir"** : toujours disponible pour charger une composition sauvegardée précédemment

## [v0.82d] — 2026-06-25 — Fix sync troubles attestés + debug endpoint

### Fix critique — smartschool-sync.mjs
- **Troubles attestés** : remplacement de l'ancienne détection heuristique (vrij1-8, groupes AR/dys, leerstoornis) par la lecture directe des champs profil Smartschool découverts via `getUserDetails` : `"Troubles attestés"`, `"Aménagements raisonnables"`, `"Difficultés sans troubles attestés"`. Ces champs ont des noms français avec espaces et accents — non capturés par l'ancienne logique.
- Après la prochaine synchronisation, `amenagements_raisonnables` sera correctement peuplé pour tous les élèves concernés.

### Debug
- `smartschool-debug.mjs` : endpoint temporaire de diagnostic (à supprimer après usage)

## [v0.82e] — 2026-06-25 — Compositions v4 : liste projets + modals

### Refonte UX complète (v4)
- **Suppression des deux onglets** (Config / Composition) remplacée par une architecture page unique
- **Vue liste** : grille de cartes projets + carte "+ Nouveau projet" en première position ; chaque carte affiche nom, date, nombre de groupes et élèves placés
- **Modal de création** : formulaire complet (nom, source/filtres, champs, champs personnalisés) à l'ouverture d'un nouveau projet
- **Modal de configuration** : même formulaire, accessible via bouton "Configuration" dans la barre du board ; modifications appliquées en temps réel
- **Vue board** : barre d'info avec retour vers la liste (← Mes projets), indicateur de sauvegarde, toggle compact/étendu, bouton "Nouveau groupe"
- **Suppression** d'un projet depuis la vue liste (icône poubelle au survol)
- **Import JSON** : depuis la vue liste (bouton "Importer JSON")
## [v0.82f] — 2026-06-25 — Fix filtres Compositions (OR entre dimensions)

- Filtres année + classe maintenant combinés en **OR** : sélectionner '2e' + 'AC Shinigamis' retourne les élèves de 2e OU les élèves d'AC Shinigamis (au lieu de l'intersection vide)

## [v0.82g] — 2026-06-25 — Compositions v4 — Fix export Excel + sync sexe féminin

**Export Excel refactorisé :**
- `exportXLSX` déplacé dans le composant parent (accès à `assignments`, `groups`, `filteredEleves`)
- Colonne **"Groupe composition"** : affiche le vrai nom du groupe (Pool / Groupe 1…) au lieu de "(à compléter)"
- Colonnes **"Groupe SS N"** : une colonne par groupe Smartschool (Groupe SS 1, Groupe SS 2…) selon le max parmi les élèves exportés
- Colonne **id** renommée `!!! id (ne pas modifier) !!!` et placée en dernière position
- Import XLSX mis à jour pour retrouver la colonne id par son nouveau nom

**Sync sexe féminin :**
- `smartschool-sync.mjs` : ajout de `geslacht === 'f'` comme alias pour féminin (en plus de `'v'`) — corrige les 350 filles sans sexe en DB

## [v0.82h] — 2026-06-25 — Compositions — Exclusion/inclusion individuelle d'élèves

**Nouvelle UI dans la section "Source — Élèves" de la configuration :**
- **Exclure un élève** (rouge) : champ de recherche → clic pour exclure → chip rouge avec ✕ pour retirer. Un élève exclu est retiré de la sélection filtrée même s'il correspondrait aux filtres.
- **Ajouter un élève hors filtre** (vert) : champ de recherche → clic pour inclure → chip vert avec ✕ pour retirer. Un élève ajouté apparaît dans le board même s'il ne correspond pas aux filtres.
- Compteur mis à jour : "+N ajouté(s)" en vert / "−N exclus" en rouge à côté du total
- `includedIds` et `excludedIds` persistés dans localStorage et dans l'export JSON

## [v0.82i] — 2026-06-25 — Compositions — Toast import Excel + normalisation Unicode

- **Toast de confirmation** après import Excel : message vert "N valeurs importées sur X champs" (4 sec) ou rouge avec explication en cas d'erreur
- **Normalisation Unicode NFC** sur les noms de colonnes avant comparaison — corrige les cas où `è` encodé différemment (Excel vs JS) empêchait le matching silencieusement
- Recherche de colonne par `findIndex` + `normalize` au lieu de `indexOf` strict

## [v0.83] — 2026-06-25
### Debug
- sync: logger les champs disponibles dans getAllAccountsExtended pour trouver le champ photo des élèves importés en masse

## [v0.83b] — 2026-06-25 — photos ESPM+
### Added
- Migration Supabase : colonne `photo_url` sur `eleves` + bucket public `eleve-photos` (512 KB max, JPEG/PNG/WebP)
- `ElevePhoto` : priorité absolue à `photo_url` stockée en DB (zéro appel Smartschool si photo présente)
- Upload photo par clic : cliquer sur la photo (ou le "?") dans Compositions ouvre un file picker → resize client-side 300×300 → upload Supabase Storage → sauvegarde en DB
- Suppression du debug sync (champs `_debug_sample_keys` / `_debug_photo_keys`)

## [v0.83c] — 2026-06-25 — admin photos
### Added
- Admin → onglet "Photos élèves" : import en masse par glisser-déposer
  - Matching par nom de fichier = numéro interne (ex: `4849.jpg`) ou username Smartschool (ex: `elif.kaplaner.jpg`)
  - Resize automatique 300×300, upload Supabase Storage, sauvegarde `photo_url` en DB
  - Barre de progression + rapport OK/KO détaillé

## [v0.83d] — 2026-06-25 — Sidebar ordre alphabétique
### Changed
- Sidebar : menus réordonnés alphabétiquement (Activités → Articles → Compositions → Économe → Élèves → Factures → Helpdesk → Paiements → Salle des profs → Soldes → Suivi social)

## [v0.83e] — 2026-06-25 — FIX Sidebar : droits par feature
### Fixed
- Sidebar : tous les items utilisent désormais `can('feature')` au lieu du check de rôle (`isMdp`, `isFinancier`)
- Désactiver une feature dans Admin → Droits retire maintenant correctement l'entrée du menu pour ce rôle
- Corrige : Salle des profs restait visible en aperçu MdP même après désactivation

## [v0.83f] — 2026-06-25 — FIX Aperçu : can() charge les permissions du rôle simulé
### Fixed
- `AuthContext` : en mode aperçu, `can()` retournait `false` pour toutes les features → sidebar vide
- Ajout de `previewPermissions` : chargement des `role_permissions` du rôle aperçu depuis la DB dès activation
- `can()` utilise désormais `previewPermissions` en mode aperçu au lieu de retourner `false` hardcodé
- L'aperçu reflète fidèlement les droits configurés dans Admin → Droits pour le rôle simulé

## [v0.83g] — 2026-06-25 — FIX routes : garde feature sur chaque route
### Fixed
- `RequireAuth` : ajout prop `feature` (string ou array) — vérifie `can()` en plus du check de rôle
- Routes protégées par feature : `/eleves`, `/groupes`, `/paiements`, `/factures`, `/activites`, `/articles`, `/assistant-social`, `/helpdesk`, `/salle-des-profs`, `/econome`, `/compositions`
- Accès direct par URL (bypass sidebar) désormais bloqué si la feature est désactivée pour le rôle
- Admin toujours autorisé (pas de `can()` check pour `role === 'admin'`)

## [v0.83h] — 2026-06-25 — FIX RequireAuth : bloque aussi l'admin en aperçu
### Fixed
- `RequireAuth` : en mode aperçu, l'admin pouvait accéder à toute URL directement car `role === 'admin'` court-circuitait la vérification de feature
- La garde s'applique désormais si `viewAsRole` est actif, même pour l'admin
- URL directes bloquées en aperçu si la feature est désactivée pour le rôle simulé

## [v0.83i] — 2026-06-25 — UX Compositions : cercle de sélection déplacé
### Changed
- Compositions : le cercle de sélection n'est plus positionné en absolu sur la photo
- Cercle maintenant inline dans la rangée flex (avant la photo), taille `w-4 h-4`
- État non sélectionné plus visible : `border-gray-400` + légère ombre intérieure au lieu de `border-gray-200`

## [v0.83j] — 2026-06-25 — Compositions : suppression upload photo individuel
### Changed
- Compositions : suppression du clic pour uploader une photo directement sur la carte
- L'upload de photos passe désormais exclusivement par Admin → Photos élèves (import en masse)
- Nettoyage complet de la prop `onPhotoUpload` dans `EleveCard`, `SortableEleveCard` et `GroupColumn`

## [v0.84] — 2026-06-25 — Footer : numéro de version
### Added
- Footer : affichage de la version (`v0.83j`) après le copyright, injectée depuis `package.json` via Vite `define`
- `vite.config.js` : injection de `__APP_VERSION__` au build
- `package.json` : version alignée sur le versioning ESPM+ (`0.83j`)

## [v0.85] — 2026-06-25 — Compositions : persistance Supabase
### Changed
- Compositions : migration de localStorage vers Supabase (`compositions_projets` table)
- Les projets sont maintenant partagés entre tous les navigateurs/environnements
- Création : INSERT en DB → UUID Supabase (plus de slug localStorage)
- Auto-save : UPDATE en DB toutes les 1,5s pendant l'édition
- Suppression : DELETE en DB
- Liste : chargement depuis Supabase au montage avec état "Chargement…"
### Migration DB
- Nouvelle table `compositions_projets` (id UUID, nom TEXT, updated_at TIMESTAMPTZ, data JSONB)
- RLS : tous les utilisateurs authentifiés peuvent lire/écrire

## [v0.85b] — 2026-06-25 — Compositions : migration localStorage → Supabase
### Added
- Bandeau de migration : si des projets existent en localStorage (ancienne version), un bouton "Importer" les insère en DB Supabase puis nettoie le localStorage

## v0.86 — Compositions : collaboration temps réel (2026-06-25)
- Abonnement Supabase Realtime sur le projet ouvert : les changements d'un utilisateur s'affichent chez les autres sans rechargement
- Auto-save déclenché sur chaque modification (debounce 1,5 s) → propagation quasi-instantanée
- Indicateur "En direct" (point animé) dans la barre du board quand le canal est actif
- Désinscription propre du canal à la fermeture du projet ou au retour à la liste

## v0.86b — Compositions : horodatage avec secondes + auteur dernière modif (2026-06-25)
- "Sauvegardé 14:47" → "Sauvegardé 14:47:32" (secondes incluses)
- Quand une autre personne modifie le projet en temps réel : "Renaud a sauvegardé à 14:47:32"
- Colonne updated_by ajoutée sur compositions_projets

## v0.86c — Compositions : fix "Sauvegardé" absent à l'ouverture (2026-06-25)
- lastSaved initialisé depuis la date DB dès l'ouverture d'une composition (ne nécessite plus de modification pour apparaître)

## v0.87 — Compositions : fix realtime écrasait les assignments + debounce 500ms (2026-06-25)
- FIX CRITIQUE : comparaison timestamp échouait (format Z vs +00) → nos propres saves revenaient en realtime et réinitialisaient les assignments après chaque DnD
- Solution : nonce unique par save stocké dans data._nonce, comparé dans le handler realtime
- Debounce réduit de 1500ms → 500ms (save plus réactif)
- Indicateur "Enregistrement…" (orange) pendant les changements en attente, "Sauvegardé HH:MM:SS" après save réussi
- Table compositions_projets ajoutée à la publication supabase_realtime (fix collaboration temps réel)
- FIX : subscribeToProject wrappé dans try/catch (évite blocage navigation si erreur realtime)
- FIX : setView('board') avant subscribeToProject (navigation garantie même si realtime échoue)

## [v0.88] — FIX boucle "Enregistrement…" infinie

- FIX : `lastNonce` (valeur unique) remplacé par `lastNonces` (Set) — plusieurs saves en vol ne causent plus de faux positifs realtime
- FIX : `justLoaded` ref — skip du premier auto-save inutile après ouverture d'une composition (données déjà en DB)
- Résultat : "Enregistrement…" n'apparaît plus au simple chargement d'une composition, et les changements utilisateur restent sauvegardés correctement

## [v0.88b] — FIX boucle Enregistrement (sync assignments bail out)

- FIX ROOT CAUSE : l'effet sync assignments créait toujours un nouvel objet `{ ...prev }` même quand aucun élève n'était ajouté
- Ce nouvel objet (référence différente) déclenchait l'effet auto-save → "Enregistrement…" en boucle au chargement
- Fix : `return prev` (même référence) quand `toAdd.length === 0` → React bail out, pas de re-render, pas de save inutile

## [v0.88c] — FIX spinner bloqué (setHasPending déplacé dans async save)

- FIX : `setHasPending(true)` déplacé DANS la fonction async `save()` — supprime le re-render synchrone avant le timer qui pouvait déclencher la boucle
- FIX : `setHasPending(false)` appelé AUSSI en cas d'erreur Supabase — le spinner ne peut plus rester bloqué indéfiniment
- Résultat : "Enregistrement…" n'apparaît plus au chargement, et disparaît toujours après la save (succès ou erreur)

## [v0.91] — FIX collaboration Compositions — realtime crash + stale data

- BUG ROOT CAUSE : `subscribeToProject` référençait `lastSaveTs.current` (variable jamais déclarée) → `ReferenceError` à chaque update reçu → la collaboration live était totalement cassée pour tous les utilisateurs
- FIX 1 : Remplacement de `lastSaveTs.current` par le système de nonces déjà en place — `if (nonce && lastNonces.current.has(nonce)) return` — filtre correctement nos propres saves sans crasher
- FIX 2 : `loadComposition` devient `async` et fait un fetch fresh depuis Supabase au moment du clic — évite que l'utilisateur charge une version stale de `savedList` si une autre personne a sauvegardé après le chargement de la liste
- Résultat : deux utilisateurs qui ouvrent la même composition voient maintenant les DnD de l'autre en temps réel

## [v0.92] — FIX boucle de save en collaboration (ping-pong realtime)

- BUG : quand l'utilisateur B recevait un update realtime de A, `applyCompositionData` changeait ses `assignments` → l'auto-save effect se déclenchait → B sauvegardait → A recevait l'update de B → boucle à ~500ms, les élèves allaient et venaient entre le pool et les classes
- FIX : ajout du ref `justAppliedRemote` — mis à `true` juste avant `applyCompositionData` dans la callback realtime, vérifié dans l'auto-save effect pour sauter la sauvegarde inutile après réception d'un update distant

## [v0.93] — Compact mode local uniquement (ne se propage plus aux autres utilisateurs)

- FIX : `cardMode` (Compact/Étendu) était inclus dans les données sauvegardées sur Supabase et propagé via realtime — tous les utilisateurs basculaient en même temps
- FIX : `cardMode` stocké en `localStorage` (`espm_cardMode`) par utilisateur, initialisé depuis localStorage au montage
- FIX : `cardMode` retiré du payload `doSave`, de `applyCompositionData`, des dépendances useCallback/useEffect, et du data JSON export
- Résultat : chaque utilisateur garde sa propre préférence Compact/Étendu, persistée entre sessions, sans affecter les autres

## [v0.94] — Photos élèves : outil de recadrage + écrasement propre

- ADD Admin → Photos élèves : grille de toutes les photos importées avec barre de recherche par nom
- ADD CropModal : outil de recadrage circulaire — glisser pour repositionner, slider pour zoomer, enregistrement 300×300 JPEG
- FIX upload individuel (ElevePhoto dans Compositions) : `remove` + `upload` au lieu de `upsert: true` pour forcer le bust de cache CDN et garantir l'écrasement de l'ancien fichier

## [v0.94a] — Photos élèves : filtre par classe dans la grille

- ADD filtre "Classe" via MasterFilter dans la grille de photos (onglet Photos élèves)
- La grille affiche maintenant les classes disponibles dans le menu filtre, comme la page Élèves

## [v0.94b] — FIX filtre classe photos (prop filterDefs)

- FIX : prop `defs` → `filterDefs` dans l'appel MasterFilter → crash "Cannot read reduce of undefined" corrigé

## [v0.94c] — FIX filtre classe photos — refacto IIFE → composant PropersGrid

- FIX : grille extraite dans composant `PhotosGrid` avec `useMemo` — le filtre Classe fonctionne maintenant
- ADD : compteur "X / Y photos" quand un filtre est actif

## [v0.94d] — FIX filtre classe photos — signature onChange correcte

- FIX : MasterFilter appelle `onChange(key, val)` (2 args) mais on passait `setGridFilters` (setState direct) → les clics ne faisaient rien
- FIX : handler correct avec toggle multi-sélection + `onClearAll`

## [v0.94e] — Photos élèves : filtre + recherche dans le PageHeader

- REFACTO : filtre "Classe" et champ recherche déplacés dans la barre PageHeader (fond sombre), identique à la page Élèves
- États `search` et `filters` remontés au niveau Admin, passés en props à PhotosAdmin puis PhotosGrid
- Callback `onClassesReady` pour synchroniser les classes disponibles vers Admin dès le chargement
- PhotosGrid simplifié : ne gère plus sa propre toolbar

## [v0.94f] — Photos élèves : photos plus grandes dans la grille

- Photos agrandies : 56px → 80px
- Grille 6 colonnes → 5 colonnes (plus d'espace)
- Nom de l'élève en text-xs au lieu de text-[10px]

## [v0.94g] — Photos élèves : grille tous élèves + upload individuel

- La grille affiche maintenant TOUS les élèves actifs (pas seulement ceux avec une photo)
- Élèves sans photo : cercle grisé avec initiales, icône "+" au survol pour uploader
- Cliquer un élève sans photo ouvre un sélecteur de fichier pour uploader directement
- Compteur "X / Y élèves avec photo" dans le header
- Filtres locaux : "Tous" / "Avec photo" / "Sans photo"
- Cumul avec le filtre Classe du PageHeader

## [v0.95] — Admin Utilisateurs — interface compacte

- Recherche dans le PageHeader (comme les autres pages)
- Bouton "+ Inviter" déplacé dans le PageHeader
- Chips de filtre par rôle (Tous / Admin / Financier / MdP / Responsable) avec compteur
- Table dense : avatar initiales coloré par rôle + Nom + Email fusionnés en une colonne
- Ligne "X utilisateurs sur Y" en pied de tableau
- Tri par rôle + recherche combinables

## [v0.95a] — Admin Utilisateurs : tri alphabétique + dernière connexion

- Utilisateurs triés par nom puis prénom (localeCompare fr)
- FIX dernière connexion : trigger Supabase `on_auth_user_login` qui copie `auth.users.last_sign_in_at` → `profiles.last_connexion` à chaque login
- Backfill appliqué sur les connexions existantes

## [v0.95b] — Compositions : barre info déplacée dans le PageHeader

- "← Mes projets", compteur élèves/groupes, statut sauvegarde, "En direct" → leftActions dans le header sombre
- Compact/Étendu, "+ Nouveau groupe", Configuration → actions dans le header sombre
- Suppression de la barre blanche séparée sous le header

## [v0.96] — Paramètres école centralisés dans l'Admin

- Nouvelle table Supabase `app_settings` : 16 clés organisées en 5 catégories (Identité, Contacts, Économat, Suivi social, Facturation)
- Nouvel onglet "Paramètres école" dans Admin : formulaire par catégorie + upload logo
- SettingsContext React : toutes les valeurs chargées au démarrage, accessibles via `useSettings()`
- Footer du site, logo Sidebar/Header, IBAN/contacts dans Factures.jsx → dynamiques via le context
- 11 fonctions Netlify PDF refactorisées : lecture des settings depuis Supabase au lieu des env vars
- Logo des PDFs : utilise `school_logo_url` si défini, sinon fallback sur `/logo-ecole.png`
- Plus aucune valeur école n'est hardcodée dans le code

## [v0.96a] — Fixes paramètres école

- FIX Factures.jsx : import useSettings manquant (ReferenceError)
- Bénéficiaire branché dans les PDF factures individuelles, batch et organismes tiers
- Onglet Paramètres : carte d'impact collapsible ("Où ces variables sont-elles utilisées ?")

## [v0.96b] — FIX fonctions PDF : getSchoolSettings non injectée

- FIX facture-pdf.mjs, factures-batch-pdf.mjs, econome-bilan-pdf.mjs, econome-projet-pdf.mjs :
  le client Supabase s'appelle `supa` dans ces fichiers (pas `supabase`) — le regex initial
  n'avait pas injecté `const ss = await getSchoolSettings(supa)`, provoquant un crash TypeError

## [v0.96c] — FIX facture-pdf.mjs : crash sur factures sans élève (acomptes voyage)

- FIX TypeError "Cannot read properties of null (reading 'id')" sur les factures de type
  acompte voyage (eleve_id null) : toutes les références à `eleve.xxx` sont désormais
  sécurisées avec des gardes null (opérateur ternaire + optional chaining)
- Les factures sans élève génèrent maintenant un PDF avec "—" à la place du nom/classe

## [v0.97] — FIX acomptes voyage : eleve_id null dans les factures générées

- ROOT CAUSE : getParticipantEleves() retournait { value, label } mais genererAcompte()
  utilisait e.id et e.matricule — donc eleve_id était undefined → null en DB
- FIX : ajout de id, matricule, nom, prenom, classe dans les objets participantEleves
- Les futures générations d'acomptes et de solde voyage auront l'élève correctement lié

## [v0.98] — DetailFacture : infos paiement + échelonnement + organisme tiers

- Informations de paiement affichées sur toutes les factures (plus seulement PDF)
- Bloc "Plan d'échelonnement en cours" si échelonnement actif pour l'élève
- Bloc "Prise en charge par organisme tiers" si OT actif pour l'élève
- Bloc "Nous contacter" avec noms/tél depuis les paramètres école (plus hardcodés)
- FIX : useSettings() manquait dans DetailFacture (s() était undefined → crash sur factures validées)

## [v0.99] — Curseur drag & drop instantané
- Remplacement du curseur `cursor: grab` natif (qui chargeait son ombre en différé sur Windows) par un curseur SVG embarqué (data URI) dans index.css — classe `.cursor-grab-custom` / `.cursor-grabbing-custom`
- Appliqué sur les cards Trello (TrelloBoardView.jsx) et la grille SalleDProfs (SalleDProfs.jsx) et les vignettes élèves Compositions (Compositions.jsx)

## [v1.00] — Module Conseils de guidance
- Nouveau module "Conseils de guidance" accessible aux rôles admin, financier, mdp
- Migration DB : 6 tables guidance_* (subjects, competencies, resource_persons, task_statuses, templates, encodings) + seed matières/compétences/statuts/personnes ressource/27 templates
- ConseilsDeGuidance.jsx : encodage collaboratif en temps réel (Supabase Realtime), sélection période/classe/élève, formulaire matières (échec/difficulté/NE), compétences transversales, TA, champs libres, cas (1/2/3), suivi, personnes ressource, statut
- Génération automatique du commentaire de bulletin depuis templates {{variable}} + blocs {{#if}}...{{/if}}
- Prompt IA prêt à copier pour correction grammaticale
- Admin.jsx : onglet "Conseils de guidance" — CRUD matières/compétences/personnes/statuts + éditeur de templates avec référence des variables
- Sidebar + route /conseils-de-guidance
- Installation : browser-image-compression (dépendance manquante Helpdesk)

## [v1.01] — Améliorations module Conseils de guidance
- Filtre de classes déplacé dans le panneau élèves (plus visible, plus ergonomique)
- Suppression de l'aperçu "Prompt IA" sous le bouton copier
- Bouton renommé "Copier le commentaire" (copie le commentaire brut, pas le prompt IA)
- Templates enrichis : intégration de toutes les variables (TA, freins, forces, suivi, personnes ressource, suivi_mention) dans les 27 templates
- buildVars enrichi : personne_ressource_1/2, suivi_mention, ta_note, suivi_raisons
- Admin.jsx : réorganisation des onglets en 3 groupes (Personnes & accès / École / Modules) avec sous-navigation dynamique
- Installation @dnd-kit/* manquant (dependency Compositions)

## [v1.02] — Navigation Conseils de guidance simplifiée
- Onglet "Commentaires (à venir)" supprimé
- P1/P2/P3 sont maintenant les 3 onglets principaux du PageHeader (même layout, données par période)
- Filtre de classes repositionné dans la barre du PageHeader (avec search et statut realtime)
- Panneau gauche simplifié (compteur seul, plus de filtre redondant)
## [v1.03] — Fix filtre classes dans PageHeader (props search/filters/actions)
## [v1.04] — Fix perte de données au changement de période
- loadEncodings merge au lieu de remplacer (setEncodings prev => merge)
- Flush immédiat du save en attente avant de changer de période (handlePeriodChange)
- pendingSaveRef pour tracker le dernier enc non encore sauvé
## [v1.05] — Mentions légales : ajout section Développement (Renaud Lecocq + Francesc Altes)
## [v1.06] — Mentions légales : Francesc Altes aussi bêta testeur
## [v1.07] — Mentions légales : distinction PI SchoolPlus / PO Pluriel + section Développement mise à jour

## [v1.08] — Rôle super_admin
- Nouveau rôle au-dessus d'admin : super_admin (violet), réservé à SchoolPlus
- Super admin peut nommer d'autres admins et gérer tous les rôles y compris super_admin
- Un admin normal ne peut pas modifier/voir le rôle d'un super_admin (dropdown désactivé)
- Un admin normal ne peut pas promouvoir quelqu'un en super_admin
- AuthContext : isSuperAdmin exposé, can() et isAdmin couvrent super_admin
- permissions.js : ROLE_META.super_admin + super_admin dans ROLES
- Migration DB : contrainte profiles_role_check étendue, Renaud Lecocq promu super_admin

## [v1.09] — Fix accès Administration pour super_admin
- RequireAuth : les checks require="admin" et feature acceptent désormais super_admin
- Corrige la redirection vers / pour Renaud lors de l'accès au panneau Admin

## [v1.10] — Protection transfert Super Admin
- Changer son propre rôle depuis super_admin ouvre une boîte de dialogue
- Obligatoire : choisir un destinataire pour le grade avant de pouvoir se dégrader
- Le transfert est atomique : le destinataire devient super_admin, puis le rôle actuel change
- Impossible de fermer la modale sans sélectionner un destinataire (bouton désactivé)

## [v1.11] — Home admin : 3 cards alignées sur les sections du panneau
- "Personnes & accès" → onglet utilisateurs (Utilisateurs, droits, photos élèves)
- "École" → onglet synchronisation (Smartschool, paramètres)
- "Modules" → onglet helpdesk (Helpdesk, natures comptables, guidance)

## [v1.12] — Renommage financier → direction + fix RLS + fix toggle droits
- Rôle "Financier" renommé "Direction" (valeur DB : direction) dans toutes les tables et le frontend
- Fix RLS : policies profiles + role_permissions étendues à super_admin (toggle économe fonctionnel)
- Fix colSpan dans la matrice Droits (alignement correct sur 3 colonnes filtrées)
- Migration DB : contrainte CHECK mise à jour, données renommées dans profiles + role_permissions

## [v1.13] — Sidebar groupes + PageHeader responsive
- Sidebar : navigation regroupée en deux sections expandables "Vie de l'école" (Activités, Compositions, Conseils de guidance, Élèves, Helpdesk, Salle des profs) et "Financier" (Articles, Économe, Factures, Paiements, Soldes, Suivi social)
- Sidebar : auto-expand du groupe de l'item actif ; état mémorisé dans localStorage
- Sidebar : mode icon-only inchangé (icônes à plat avec séparateurs de groupe)
- PageHeader : zone droite (search + filters + info + actions) en div dédiée avec ml-auto → wrap propre sur ligne 2 sur écrans intermédiaires

## [v1.13b] — PageHeader 2 lignes fixes
- Ligne 1 : titre + actions (strict no-wrap)
- Ligne 2 : leftActions + tabs + search + filtres + info (scroll horizontal silencieux, jamais de 3e ligne)
