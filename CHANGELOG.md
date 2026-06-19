# Changelog — ESPM Finances

Format : `[Date] Commit — Description — Rollback`

---

## 2026-06-19 — Session 4 (commentaires + UX slide-ins)

### ✅ Ajouté / Corrigé

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `10c7cff` | `Echelonnements.jsx` | Nouveau panneau slide-in éditable sur clic de ligne (statut, montant, nb échéances, date début, remarque) + bouton "Fiche élève". Fix bouton "Fiche élève" dans OrganismeTiersDetail (eleve.id manquant dans la query select) | `git revert 10c7cff` |
| `df23e90` | `AssistantSocial.jsx` | Bouton "Fiche élève" ajouté dans EchelonnementDetail (onglet Assist. social) | `git revert df23e90` |
| `356c1c0` | `Eleves.jsx` | Suppression colonne Actions (pas de modif/suppression car lié à Smartschool) + couleurs badges AS : CPAS mauve, ULB bleu, SPJ vert, Autres rouge | `git revert 356c1c0` |
| `445a782` | `Eleves.jsx` | Tableau pleine largeur après suppression colonne Actions (colonnes non-sticky flexibles) | `git revert 445a782` |
| `9ac9799` | `Commentaires.jsx`, `NotificationBell.jsx`, `Header.jsx`, `AssistantSocial.jsx`, `Activites.jsx` + DB | Système complet commentaires/messagerie + notifications : chat par entité (activité, échelonnement, organisme tiers), cloche avec badge rouge, deep-link vers la bonne page/onglet, Realtime Supabase. Tables DB : `commentaires` + `notifications` avec RLS | `git revert 9ac9799` |
| `ba3206d` | `AssistantSocial.jsx`, `Activites.jsx` | Commentaires déplacés en colonne gauche dans tous les slide-ins (layout deux colonnes). ActivityModal converti en slide-in depuis la droite (même pattern que les autres panneaux) | `git revert ba3206d` |
| `02e958d` | `Activites.jsx` | Carte activité cliquable (ouvre le slide-in) + suppression bouton "Modifier". Docs/Factures/Archiver conservent leur propre action | `git revert 02e958d` |

---

## 2026-06-18 — Session 2 (workflow + AssistantSocial)

### ✅ Ajouté / Corrigé

| Commit | Fichier / Périmètre | Changement | Rollback |
|--------|---------------------|------------|----------|
| `0e98a41` | `AssistantSocial.jsx` | `EchelonnementForm` converti en modal overlay (fond semi-transparent, carte blanche arrondie, header sticky + bouton ✕, clic dehors pour fermer) — même pattern qu'Activités | `git revert 0e98a41` |
| `21bb81b` | `AssistantSocial.jsx` | Formulaire Organismes Tiers converti en modal overlay (même pattern qu'Échelonnements) | `git revert 21bb81b` |
| `21bb81b` | `Eleves.jsx` | Colonne AS : affiche le ou les organismes actifs (En cours / Validé) sous forme de badges bleus au lieu d'un simple point | `git revert 21bb81b` |
| `797c237` | `AssistantSocial.jsx` | Date de début éditable dans le panneau détail — recalcul auto de toutes les dates d'échéances + date de fin en temps réel | `git revert 797c237` |
| `9ed4590` | `AssistantSocial.jsx` | Bandeau d'alerte ambré quand la somme des mensualités ≠ montant total de l'échelonnement. Indique le montant à répartir ou le dépassement. | `git revert 9ed4590` |

### 🏗 Infrastructure / Workflow

| Quoi | Détail |
|------|--------|
| **Site staging créé** | `https://espmaritime-staging.netlify.app` (siteId: `ed7d1504-00ab-47c6-ad1f-63c0c755abbc`) — toutes les modifications sont vérifiées ici avant la production |
| **Branche GitHub** | Renommage `develop` → `main` (branche unique désormais). Plus de distinction develop/main sur Netlify. |
| **Nouveau workflow** | Code → sandbox → staging (vérification Renaud) → production sur "go prod" explicite |

---

## 2026-06-18 — Session 1 (deploy/fix)

### ✅ Ajouté / Corrigé

| Commit | Fichier | Changement | Rollback |
|--------|---------|------------|----------|
| `56ca23f` | `Header.jsx` | Nouveau header sombre `#2D1B2E`, logo Plurielle, bouton Smartschool orange, nom+rôle utilisateur, bouton logout | `git revert 56ca23f` |
| `81d4cba` | `AssistantSocial.jsx` | Page complète : échelonnements de paiement + organismes tiers (CPAS, ULB, SPJ) + fiches élèves | `git revert 81d4cba` |
| `36394c9` | `AuthContext.jsx` | Ajout `viewAsRole`, `effectiveRole`, `isMdpOnly` pour la fonction aperçu | `git revert 36394c9` |
| `aa54eeb` | `AuthContext.jsx` | Ajout aliases `previewRole`/`setPreviewRole` → corrige la fonction "Aperçu en tant que" dans Admin | `git revert aa54eeb` |
| `486682e` | `App.jsx` | Route `/assistant-social` requiert rôle `financier` (pas `mdp`) | `git revert 486682e` |
| `6e3b425` | `Header.jsx` | Menu "Assist. social" visible uniquement pour admin+financier (pas mdp) | `git revert 6e3b425` |
| `1956e81` | `Home.jsx` | Restauration version sparklines : calcul dynamique paiements−factures, `nb_eleves` pour frais, graphiques sur année scolaire août→juin, liens admin avec bons onglets | `git revert 1956e81` |
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
| Actuel     | 27b1c49 | fix(Home): activités nettes de POP |

---

## Règles de déploiement (rappel)

- **staging** → `espmaritime-staging.netlify.app` (vérification avant mise en ligne)
- **production** → `espmaritime.netlify.app`
- ⚠️ **Jamais déployer en production sans mot-clé explicite de Renaud** : "go prod", "feu vert", "go main", "ok sur main", "déploiement sur main"
- Toujours cloner `main` depuis GitHub avant tout build
- Le proxy-path Netlify est temporaire — en redemander un via le MCP à chaque session
