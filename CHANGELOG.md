# Changelog — ESPM Finances

Format : `[Date] Commit — Description — Rollback`

---

## 2026-06-18 — Session deploy/fix

### ✅ Ajouté / Corrigé

| Commit | Fichier | Changement | Rollback |
|--------|---------|------------|----------|
| `56ca23f` | `Header.jsx` | Nouveau header sombre `#2D1B2E`, logo Plurielle, bouton Smartschool orange, nom+rôle utilisateur, bouton logout | `git revert 56ca23f` |
| `81d4cba` | `AssistantSocial.jsx` | Page complète : échelonnements de paiement + organismes tiers (CPAS, ULB, SPJ) + fiches élèves | `git revert 81d4cba` |
| `36394c9` | `AuthContext.jsx` | Ajout `viewAsRole`, `effectiveRole`, `isMdpOnly` pour la fonction aperçu | `git revert 36394c9` |
| `aa54eeb` | `AuthContext.jsx` | Ajout aliases `previewRole`/`setPreviewRole` → corrige la fonction "Aperçu en tant que" dans Admin | `git revert aa54eeb` |
| `486682e` | `App.jsx` | Route `/assistant-social` requiert rôle `financier` (pas `mdp`) | `git revert 486682e` |
| `6e3b425` | `Header.jsx` | Menu "Assist. social" visible uniquement pour admin+financier (pas mdp) | `git revert 6e3b425` |
| `1956e81` | `Home.jsx` | Restauration version sparklines : sparklines séparés impayés/réserve, calcul dynamique paiements−factures, `nb_eleves` pour frais, graphiques sur année scolaire août→juin, liens admin avec bons onglets (`?onglet=droits`, `?onglet=synchronisation`) | `git revert 1956e81` |
| ce commit | `netlify.toml` | Ajout `NODE_VERSION = "22"` → active les builds Netlify automatiques depuis GitHub | `git revert <ce-commit>` |

---

## Comment faire un rollback

### Rollback d'un fichier précis
```bash
# Revenir à la version d'un commit précis pour un fichier
git checkout <commit_hash> -- src/pages/MonFichier.jsx
git commit -m "rollback: revenir à version <commit_hash> pour MonFichier.jsx"
git push origin develop
```

### Rollback complet à une date précise
```bash
# Trouver le commit de référence
git log --oneline --before="2026-06-17"

# Créer une branche de rollback (ne PAS modifier develop directement)
git checkout -b rollback-YYYY-MM-DD <commit_hash>
# Demander à Claude de vérifier et redéployer
```

### Commits clés de référence
| État | Commit | Date |
|------|--------|------|
| Avant toutes les modifs de juin 2026 | `a5b8e3c` | ~2026-06-15 |
| Après ajout filtres multi-select | `274b3b4` | ~2026-06-16 |
| Après header + AssistantSocial | `81d4cba` | 2026-06-17 |
| État actuel (stable) | `1956e81` | 2026-06-18 |

---

## Règles de déploiement (rappel)

- **develop** → `develop--espmaritime.netlify.app` (prévisualisation)
- **main** → `espmaritime.netlify.app` (production)
- ⚠️ **Jamais déployer sur main sans mot-clé explicite de Renaud** : "go main", "ok sur main", "déploiement sur main"
- Toujours cloner `develop` depuis GitHub avant tout build — jamais utiliser des fichiers /tmp/ d'une session précédente
