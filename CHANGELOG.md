# Changelog — ESPM Finances

Format : `[Date] Commit — Description — Rollback`  
**Ordre : du plus récent au plus ancien.**

---

## Session 7 — 2026-06-19 (fix documents)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `f0ed999` | `Activites.jsx` | Fix critique : noms de colonnes corrects pour `activite_documents` (`nom_fichier`, `storage_path` au lieu de `nom`, `chemin`). Chemin storage via `crypto.randomUUID()` pour éviter les collisions. Gestion d'erreur explicite dans `DocsModal` (alerte si upload storage ou insert DB échoue). `try/catch` autour des appels `logDocEvent` pour éviter qu'une erreur de journal bloque le `reload()`. | `git revert f0ed999` |
| `db04343` | `Activites.jsx` | Fix upload : `contentType: 'application/pdf'` forcé (staged + DocsModal) — Windows remonte parfois un MIME type vide via drag&drop, rejeté par le bucket. Gestion d'erreur explicite dans `uploadStagedFiles`. | `git revert db04343` |
| `0495fef` | `Activites.jsx` | Fix upload : sanitize du nom de fichier dans le chemin storage (NFD + suppression diacritiques + `_` pour caractères spéciaux) — Supabase rejette les clés avec espaces ou accents. Nom original conservé dans `nom_fichier`. | `git revert 0495fef` |
| `4aef92e` | `Activites.jsx` | Affichage des documents sauvegardés dans le slide-in (section Documents & Factures) — rechargement après upload, boutons Voir (signed URL) et Suppr. Fin du bug : fichiers invisibles après enregistrement. | `git revert 4aef92e` |
| `a6b901c` | `Activites.jsx` | Fix journal : `useAuth()` manquant dans `ActivityModal` → `user`/`profile` undefined → `logEvent()` échouait silencieusement (auteur_id null). Icône trombone (📎) sur les cards ayant des docs/factures. | `git revert a6b901c` |
| `1047c58` | `Activites.jsx` | Boutons Docs/Factures colorés (bleu/vert) si fichiers présents. `logEvent` ajouté dans `uploadStagedFiles` et `delSavedDoc`. Sets `activitiesWithDocs`/`activitiesWithFactures` distincts. Suppression trombone. | `git revert 1047c58` |
| `26ae229` | `Activites.jsx` | Fix couleur boutons : `select('activite_id, categorie')` au lieu de `activite_id` seul → les Sets docs/factures étaient toujours vides. | `git revert 26ae229` |
| `7ceb04e` | `Activites.jsx` | Mise à jour dynamique des boutons Docs/Factures : `reloadDocsSets` callback passé à `DocsModal` → appelé après chaque upload/suppression sans rechargement de page. | `git revert 7ceb04e` |
| `83bce34` | `Activites.jsx` + DB | Statut facturation : 4 valeurs (en_attente, a_facturer, facture, non_payant), visible admin/financier uniquement. Auto-calcul non_payant si montant=0. Sélecteur dans slide-in. Filtre mis à jour. Contrainte CHECK DB étendue. | `git revert 83bce34` |
| `a395099` | `Activites.jsx` | Bouton toggle En attente ↔ À facturer sur les cards. Archiver et Supprimer retirés des cards → déplacés dans le footer du slide-in. | `git revert a395099` |

## Session 8 — 2026-06-20 (fiche élève + statut facturation)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| DB | `appels_responsables` | Nouvelle table : historique des appels passés aux responsables (auteur, index resp., nom snap., note éditable). RLS : INSERT tous, SELECT/UPDATE admin+financier, DELETE admin. | Migration SQL manuelle |
| `cdee9a5` | `FicheEleve.jsx` + `AssistantSocial.jsx` | Refonte complète fiche élève : identité, groupes scolaires (champs vides masqués), responsables + bouton appel, suivi social (échelonnements + OT, boutons accès rapide), financier (solde), historique des appels. Sections social/financier/appels masquées pour MdP. Fix noms colonnes resp. (`nom_responsable_N`). AS.jsx : param `?eleve=UUID` pour auto-ouvrir le détail. | `git revert cdee9a5` |
| DB | `commentaires` | Contrainte `message_check` assouplie : `type = 'system' OR char_length(message) > 0` — les événements système (message vide) étaient silencieusement rejetés. | Migration SQL manuelle |

---

## Session 6 — 2026-06-19 (notifications)

| Commit | Fichier(s) | Description | Rollback |
|--------|-----------|-------------|---------|
| `e1a5d42` | `NotificationBell.jsx`, `Activites.jsx` | Deep-link notification → ouvre le slide-in de l'activité concernée (`?open=<id>`). Badge rouge de messages non-lus sur les cartes. Marque lu à l'ouverture. | `git revert e1a5d42` |
| `3e6fbec` | `NotificationBell.jsx` | Bouton "Vider" pour supprimer toutes les notifications | `git revert 3e6fbec` |
| `ef6ed03` | `Activites.jsx` | Fix : afficher `local` (intramuros) sur la carte en plus de `lieu`. Pills de filtre rapide Passées/À venir/Mes activités. Signal visuel pastel vert/rouge + "Dans X jours" / "Il y a X jours". | `git revert ef6ed03` |
| `a5eeafa` | `Activites.jsx` | Pill "Mes activités" masquée pour les MdP (déjà filtrés par défaut) | `git revert a5eeafa` |
| `fee214e` | `Commentaires.jsx`, `Activites.jsx`, `AssistantSocial.jsx` | Journal d'activité dans le chat : événements système (modification de champs, ajout/suppression de documents). Fenêtre chat élargie dans les 3 slide-ins (Activités w-104, Échelonnements et Organismes tiers w-96). Migration Supabase : colonnes `type` et `meta` sur `commentaires`. | `git revert fee214e` |

---

## Session 5 — 2026-06-19 (rôles OAuth + UX activités)

### ✅ Ajouté / Corrigé

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `c088dda` | `Activites.jsx` | Puces classes/groupes sur la carte (max 6 + overflow "+N") — retire la description du résumé | `git revert c088dda` |
| `2c1f5b6` | `Activites.jsx` | Responsable et accompagnateurs mutuellement exclusifs : sélectionner un responsable le retire automatiquement des accompagnateurs | `git revert 2c1f5b6` |
| `2be0499` | `Activites.jsx` | Fix `min-w-0` grille personnel + logique non-destructive (n'écrase pas les données existantes à l'ouverture) | `git revert 2be0499` |
| `e08cfb3` | `Activites.jsx` | Fix débordement horizontal du dropdown `MultiSearchSelect` (`w-full` sur le wrapper) | `git revert e08cfb3` |
| `f9ecdd6` | `Activites.jsx` | Bouton "Supprimer" visible uniquement pour l'admin (avec confirmation) | `git revert f9ecdd6` |
| `6106411` | `Activites.jsx` | Accompagnateurs affichés sur la carte (couleur teal), distincts du responsable (violet) | `git revert 6106411` |
| `ae05f4a` | `Activites.jsx` | Carte réorganisée en 4 lignes : titre+badges / classes+groupes / métadonnées / personnel | `git revert ae05f4a` |
| `65a218f` | `Activites.jsx` + DB | Accompagnateurs peuvent ouvrir le slide-in et commenter (`canView` distinct de `canEdit`). Signup sans rôle par défaut (trigger `handle_new_user` → `NULL`) | `git revert 65a218f` |
| `db7c7a6` | `smartschool-callback.mjs` + DB | **OAuth Smartschool → rôle automatique** : Direction/Enseignant/Autre → MdP ; co-compte → Responsable ; Élève → bloqué. Rôles admin/financier jamais écrasés | `git revert db7c7a6` |
| `0d1af49` | `Activites.jsx` | Statut en boutons visuels (Brouillon / Publié / Archivé). Auto-sauvegarde brouillon si fermeture accidentelle du slide-in | `git revert 0d1af49` |

### 🗄 Migrations Supabase

| Migration | Changement |
|-----------|------------|
| `fix_profiles_select_all_authenticated` | Policy `profiles_select` étendue à tous les utilisateurs authentifiés |
| `handle_new_user_autodetect_role_from_smartschool` | Trigger (remplacé par la logique OAuth dans le callback) |
| `handle_new_user_read_role_from_metadata` / `fix_handle_new_user_default_role_null` | Trigger : signup sans rôle par défaut (`NULL`) |

---

## Session 4 — 2026-06-19 (commentaires + UX slide-ins)

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `10c7cff` | `Echelonnements.jsx` | Nouveau panneau slide-in éditable + bouton "Fiche élève" | `git revert 10c7cff` |
| `df23e90` | `AssistantSocial.jsx` | Bouton "Fiche élève" dans EchelonnementDetail | `git revert df23e90` |
| `356c1c0` | `Eleves.jsx` | Suppression colonne Actions + badges AS colorés | `git revert 356c1c0` |
| `445a782` | `Eleves.jsx` | Tableau pleine largeur après suppression colonne Actions | `git revert 445a782` |
| `9ac9799` | `Commentaires.jsx`, `NotificationBell.jsx`, `Header.jsx`, `AssistantSocial.jsx`, `Activites.jsx` + DB | Système complet commentaires/messagerie + notifications Realtime. Tables `commentaires` + `notifications` avec RLS | `git revert 9ac9799` |
| `ba3206d` | `AssistantSocial.jsx`, `Activites.jsx` | Commentaires en colonne gauche dans tous les slide-ins. ActivityModal converti en slide-in | `git revert ba3206d` |
| `02e958d` | `Activites.jsx` | Carte activité cliquable (ouvre le slide-in) + suppression bouton "Modifier" | `git revert 02e958d` |

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

## Session 1 — 2026-06-18 (deploy/fix)

| Commit | Fichier | Changement | Rollback |
|--------|---------|------------|----------|
| `56ca23f` | `Header.jsx` | Nouveau header sombre, logo Plurielle, bouton Smartschool orange | `git revert 56ca23f` |
| `81d4cba` | `AssistantSocial.jsx` | Page complète : échelonnements + organismes tiers + fiches élèves | `git revert 81d4cba` |
| `36394c9` | `AuthContext.jsx` | Ajout `viewAsRole`, `effectiveRole`, `isMdpOnly` | `git revert 36394c9` |
| `aa54eeb` | `AuthContext.jsx` | Ajout aliases `previewRole`/`setPreviewRole` | `git revert aa54eeb` |
| `486682e` | `App.jsx` | Route `/assistant-social` requiert rôle `financier` | `git revert 486682e` |
| `6e3b425` | `Header.jsx` | Menu "Assist. social" visible uniquement admin+financier | `git revert 6e3b425` |
| `1956e81` | `Home.jsx` | Restauration version sparklines avec calcul dynamique | `git revert 1956e81` |
| `c1de3e3` | `netlify.toml` | Ajout `NODE_VERSION = "22"` | `git revert c1de3e3` |

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

### Commits clés de référence
| État | Commit | Date |
|------|--------|------|
| Avant toutes les modifs de juin 2026 | `a5b8e3c` | ~2026-06-15 |
| Après filtres multi-select | `274b3b4` | ~2026-06-16 |
| Après header + AssistantSocial | `81d4cba` | 2026-06-17 |
| Début session 2 (stable) | `1956e81` | 2026-06-18 |
| Actuel | `3e6fbec` | Bouton Vider notifications — 2026-06-19 |

---

## Règles de déploiement (rappel)

- **staging** → `espmaritime-staging.netlify.app` (vérification avant mise en ligne)
- **production** → `espmaritime.netlify.app`
- ⚠️ **Jamais déployer en production sans mot-clé explicite de Renaud** : "go prod", "feu vert", "go main", "ok sur main", "déploiement sur main"
- Toujours cloner `main` depuis GitHub avant tout build
- Le proxy-path Netlify est temporaire — en redemander un via le MCP à chaque session
