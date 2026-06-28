// GuidePresentation.jsx — Infographie de présentation de la plateforme ESPM+
// Inspiré du modèle PTB Anderlecht, adapté aux couleurs et modules ESPM+

export default function GuidePresentation() {
  const css = `
    .gp-wrap *{box-sizing:border-box;margin:0;padding:0}
    .gp-wrap{font-family:'Inter',system-ui,sans-serif;color:#1a1025;line-height:1.5;background:#f4f2f7}

    /* Hero */
    .gp-hero{background:linear-gradient(135deg,#2D1B2E 0%,#4A2D4F 55%,#1a0d1c 100%);color:white;padding:56px 40px 48px;text-align:center;position:relative;overflow:hidden}
    .gp-hero::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");pointer-events:none}
    .gp-eyebrow{font-size:0.72rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:14px}
    .gp-title{font-size:2.4rem;font-weight:900;letter-spacing:-0.02em;margin-bottom:10px}
    .gp-title span{color:#C4B5FD}
    .gp-sub{font-size:1rem;color:rgba(255,255,255,0.72);margin-bottom:32px;max-width:620px;margin-left:auto;margin-right:auto}
    .gp-logo{width:64px;height:64px;margin:0 auto 20px;display:block}
    .gp-pills{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:4px}
    .gp-pill{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);color:white;padding:5px 16px;border-radius:20px;font-size:0.78rem;font-weight:500;backdrop-filter:blur(4px)}

    /* Layout */
    .gp-container{max-width:1100px;margin:0 auto;padding:40px 24px}
    .gp-section-label{font-size:0.68rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#7C3AED;margin-bottom:12px}
    .gp-section-title{font-size:1.5rem;font-weight:800;color:#2D1B2E;margin-bottom:6px;letter-spacing:-0.01em}
    .gp-section-desc{font-size:0.9rem;color:#666;margin-bottom:32px;max-width:640px}
    .gp-divider{height:2px;background:linear-gradient(90deg,#7C3AED,transparent);margin:48px 0;border-radius:2px;width:80px}

    /* KPI bar */
    .gp-kpi-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e0d9f0;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(44,27,46,0.1);margin-bottom:48px}
    .gp-kpi{background:white;padding:26px 20px;text-align:center}
    .gp-kpi-val{font-size:2rem;font-weight:900;color:#7C3AED;letter-spacing:-0.02em;line-height:1}
    .gp-kpi-label{font-size:0.75rem;color:#888;margin-top:6px;font-weight:500}
    @media(max-width:640px){.gp-kpi-bar{grid-template-columns:repeat(2,1fr)}}

    /* Module cards */
    .gp-modules-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:48px}
    @media(max-width:900px){.gp-modules-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:560px){.gp-modules-grid{grid-template-columns:1fr}}
    .gp-module-card{background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(44,27,46,0.08);transition:transform .2s,box-shadow .2s}
    .gp-module-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(44,27,46,0.15)}
    .gp-module-header{padding:18px 18px 12px;display:flex;align-items:center;gap:12px}
    .gp-module-icon{font-size:1.7rem;line-height:1;flex-shrink:0}
    .gp-module-name{font-size:1rem;font-weight:700;color:#2D1B2E}
    .gp-module-role{font-size:0.68rem;font-weight:600;padding:2px 8px;border-radius:10px;margin-top:3px;display:inline-block}
    .role-all{background:#f0fdf4;color:#166534}
    .role-fin{background:#eff6ff;color:#1e40af}
    .role-ped{background:#fdf4ff;color:#6b21a8}
    .role-admin{background:#fef2f2;color:#991b1b}
    .gp-module-body{padding:0 18px 18px}
    .gp-module-accent{height:3px;margin:0 18px 14px;border-radius:2px}
    .gp-feature-list{list-style:none;padding:0}
    .gp-feature-list li{display:flex;align-items:flex-start;gap:8px;font-size:0.81rem;color:#444;margin-bottom:7px;line-height:1.45}
    .gp-feature-list li::before{content:'›';color:#7C3AED;font-weight:700;flex-shrink:0}
    .gp-feature-tip{background:#faf8ff;border-left:3px solid #7C3AED;padding:8px 10px;border-radius:0 6px 6px 0;font-size:0.75rem;color:#555;margin-top:10px;line-height:1.5}
    .gp-feature-tip strong{color:#7C3AED}

    /* Roles */
    .gp-roles-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:48px}
    @media(max-width:800px){.gp-roles-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:500px){.gp-roles-grid{grid-template-columns:1fr}}
    .gp-role-card{background:white;border-radius:14px;padding:22px;box-shadow:0 2px 12px rgba(44,27,46,0.08);border-top:4px solid}
    .gp-role-title{font-size:1rem;font-weight:800;margin-bottom:4px}
    .gp-role-desc{font-size:0.77rem;color:#888;margin-bottom:14px}
    .gp-role-can{font-size:0.79rem;color:#444;margin-bottom:5px;display:flex;align-items:center;gap:6px}
    .gp-role-can.yes::before{content:'✓';color:#22c55e;font-weight:700}
    .gp-role-can.no::before{content:'✗';color:#ef4444;font-weight:700}

    /* Workflow */
    .gp-workflow{display:flex;gap:0;margin-bottom:48px;flex-wrap:wrap}
    .gp-wf-step{flex:1;min-width:130px;background:white;padding:18px 14px;text-align:center;position:relative;box-shadow:0 2px 8px rgba(44,27,46,0.07)}
    .gp-wf-step:first-child{border-radius:12px 0 0 12px}
    .gp-wf-step:last-child{border-radius:0 12px 12px 0}
    .gp-wf-step+.gp-wf-step::before{content:'›';position:absolute;left:-10px;top:50%;transform:translateY(-50%);font-size:1.2rem;color:#7C3AED;font-weight:900;z-index:1}
    .gp-wf-num{width:26px;height:26px;border-radius:50%;background:#7C3AED;color:white;font-size:0.72rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 7px}
    .gp-wf-icon{font-size:1.3rem;margin-bottom:5px}
    .gp-wf-name{font-size:0.79rem;font-weight:700;color:#2D1B2E;margin-bottom:2px}
    .gp-wf-detail{font-size:0.69rem;color:#888}

    /* Tech */
    .gp-tech-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:48px}
    @media(max-width:640px){.gp-tech-grid{grid-template-columns:1fr}}
    .gp-tech-card{background:white;border-radius:14px;padding:22px;box-shadow:0 2px 12px rgba(44,27,46,0.08)}
    .gp-tech-card-title{font-size:0.85rem;font-weight:700;color:#2D1B2E;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .gp-tech-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f0f7}
    .gp-tech-item:last-child{border-bottom:none}
    .gp-tech-badge{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
    .gp-tech-info{flex:1}
    .gp-tech-name{font-size:0.82rem;font-weight:600;color:#2D1B2E}
    .gp-tech-detail{font-size:0.73rem;color:#888;margin-top:1px}
    .gp-tech-tag{font-size:0.66rem;padding:2px 7px;border-radius:8px;background:#f0ecf8;color:#6D28D9;font-weight:600;margin-left:auto}

    /* Security */
    .gp-security-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:48px}
    @media(max-width:640px){.gp-security-grid{grid-template-columns:1fr}}
    .gp-security-item{background:white;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(44,27,46,0.07);display:flex;gap:12px;align-items:flex-start}
    .gp-security-icon{font-size:1.4rem;flex-shrink:0}
    .gp-security-title{font-size:0.84rem;font-weight:700;color:#2D1B2E;margin-bottom:4px}
    .gp-security-desc{font-size:0.74rem;color:#666;line-height:1.5}

    /* Highlight box */
    .gp-highlight-box{background:linear-gradient(135deg,#faf8ff,#f3f0ff);border:1.5px solid #ddd6fe;border-radius:14px;padding:22px;margin-bottom:48px}
    .gp-highlight-box-title{font-size:0.95rem;font-weight:700;color:#7C3AED;margin-bottom:10px}
    .gp-highlight-box p{font-size:0.84rem;color:#555;line-height:1.7}

    /* Checklist */
    .gp-checklist-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:48px}
    @media(max-width:640px){.gp-checklist-grid{grid-template-columns:1fr}}
    .gp-checklist-card{background:white;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(44,27,46,0.07)}
    .gp-checklist-header{font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px}
    .gp-checklist-body{font-size:0.81rem;color:#444;line-height:1.85}

    /* Modules group label */
    .gp-group-label{font-size:0.72rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin:24px 0 10px;padding-left:2px}

    /* Footer */
    .gp-footer{background:#2D1B2E;color:rgba(255,255,255,0.45);text-align:center;padding:22px;font-size:0.77rem}
    .gp-footer strong{color:rgba(255,255,255,0.75)}
  `

  return (
    <div className="gp-wrap">
      <style>{css}</style>

      <div className="gp-hero">
        <svg className="gp-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="rgba(255,255,255,0.12)"/>
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
          <text x="50" y="58" textAnchor="middle" fontSize="32" fontWeight="900" fill="white" fontFamily="Inter,sans-serif">M</text>
        </svg>
        <div className="gp-eyebrow">Présentation de la plateforme · ESPM+</div>
        <h1 className="gp-title">La plateforme de <span>l&apos;École Plurielle Maritime</span></h1>
        <p className="gp-sub">Un outil numérique intégré pour gérer les activités scolaires, la facturation, le suivi des élèves et la collaboration entre équipes.</p>
        <div className="gp-pills">
          <span className="gp-pill">🔒 Accès par invitation</span>
          <span className="gp-pill">🏫 Intégré Smartschool</span>
          <span className="gp-pill">📊 Temps réel</span>
          <span className="gp-pill">🇧🇪 Données en Europe</span>
          <span className="gp-pill">📱 100% web</span>
          <span className="gp-pill">🌙 Mode sombre</span>
        </div>
      </div>

      <div className="gp-container">

        <div style={{marginTop:40,marginBottom:12}} className="gp-section-label">En un coup d&apos;œil</div>
        <div className="gp-kpi-bar">
          <div className="gp-kpi"><div className="gp-kpi-val">12</div><div className="gp-kpi-label">modules disponibles</div></div>
          <div className="gp-kpi"><div className="gp-kpi-val">5</div><div className="gp-kpi-label">rôles utilisateur</div></div>
          <div className="gp-kpi"><div className="gp-kpi-val">SS</div><div className="gp-kpi-label">intégré Smartschool</div></div>
          <div className="gp-kpi"><div className="gp-kpi-val">🇩🇪</div><div className="gp-kpi-label">données Frankfurt, RGPD</div></div>
        </div>

        <div className="gp-section-label">Flux principal</div>
        <div className="gp-section-title">Comment ça marche ?</div>
        <p className="gp-section-desc">De la synchronisation Smartschool jusqu&apos;aux rapports PDF, voici le parcours typique d&apos;une année scolaire.</p>
        <div className="gp-workflow">
          <div className="gp-wf-step">
            <div className="gp-wf-num">1</div><div className="gp-wf-icon">🔄</div>
            <div className="gp-wf-name">Sync Smartschool</div><div className="gp-wf-detail">Élèves, classes, photos</div>
          </div>
          <div className="gp-wf-step">
            <div className="gp-wf-num">2</div><div className="gp-wf-icon">🎒</div>
            <div className="gp-wf-name">Créer l&apos;activité</div><div className="gp-wf-detail">Config + POP + publication</div>
          </div>
          <div className="gp-wf-step">
            <div className="gp-wf-num">3</div><div className="gp-wf-icon">🧾</div>
            <div className="gp-wf-name">Générer factures</div><div className="gp-wf-detail">Batch + PDF + Smartschool</div>
          </div>
          <div className="gp-wf-step">
            <div className="gp-wf-num">4</div><div className="gp-wf-icon">💳</div>
            <div className="gp-wf-name">Import paiements</div><div className="gp-wf-detail">CSV Belfius → soldes</div>
          </div>
          <div className="gp-wf-step">
            <div className="gp-wf-num">5</div><div className="gp-wf-icon">📊</div>
            <div className="gp-wf-name">Rapports &amp; bilans</div><div className="gp-wf-detail">PDF, Excel, Économe</div>
          </div>
        </div>

        <div className="gp-divider" />

        <div className="gp-section-label">Modules</div>
        <div className="gp-section-title">Ce que tu peux faire</div>
        <p className="gp-section-desc">Chaque module correspond à une dimension de la vie scolaire. Les accès sont configurables par rôle et par utilisateur.</p>

        <div className="gp-group-label">💰 Financier</div>
        <div className="gp-modules-grid">

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🎒</div>
              <div><div className="gp-module-name">Activités</div><span className="gp-module-role role-fin">activites_full · activites_own</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#7C3AED,#C4B5FD)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Créer des activités ponctuelles ou des voyages multi-jours</li>
                <li>Encoder les dépenses POP (frais réels) par catégorie</li>
                <li>Configurer les acomptes pour les voyages</li>
                <li>Publier → notif automatique Smartschool aux parents</li>
                <li>Générer le rapport PDF de l&apos;activité</li>
                <li>Archiver une fois terminée</li>
              </ul>
              <div className="gp-feature-tip"><strong>Astuce :</strong> Les profs voient uniquement <em>leurs</em> activités (rôle <em>activites_own</em>). L&apos;économe voit tout (<em>activites_full</em>).</div>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🧾</div>
              <div><div className="gp-module-name">Factures</div><span className="gp-module-role role-fin">factures</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#2563EB,#93C5FD)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Générer un batch de factures pour une activité ou un article</li>
                <li>Approuver ou ignorer ligne par ligne</li>
                <li>Télécharger le PDF de chaque facture ou du batch complet</li>
                <li>Notifier automatiquement les parents via Smartschool</li>
                <li>Suivre le statut : en attente, approuvé, partiellement facturé</li>
              </ul>
              <div className="gp-feature-tip"><strong>Note :</strong> Les voyages avec acomptes ont leur propre flux séparé, hors batch normal.</div>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">💳</div>
              <div><div className="gp-module-name">Paiements</div><span className="gp-module-role role-fin">paiements</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#059669,#6EE7B7)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Importer le fichier CSV de relevé Belfius</li>
                <li>Association automatique ou manuelle aux élèves</li>
                <li>Mise à jour des soldes en temps réel</li>
                <li>Récupérer les encodages depuis la page Économe</li>
              </ul>
              <div className="gp-feature-tip"><strong>Format :</strong> Fichier CSV Belfius standard (export depuis l&apos;extranet bancaire).</div>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">💰</div>
              <div><div className="gp-module-name">Soldes élèves</div><span className="gp-module-role role-fin">soldes</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#D97706,#FDE68A)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Vue financière complète par élève</li>
                <li>Détail des factures et paiements avec noms de batch</li>
                <li>Calcul chronologique des impayés</li>
                <li>Filtres par classe, statut financier, suivi social</li>
                <li>Accès rapide à la fiche élève complète</li>
              </ul>
              <div className="gp-feature-tip"><strong>Fiche élève :</strong> 4 onglets — Informations, Suivi social, Financier, Activités.</div>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🤝</div>
              <div><div className="gp-module-name">Suivi social</div><span className="gp-module-role role-admin">suivi_social — données sensibles</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#DC2626,#FCA5A5)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Gérer les échelonnements de paiement (PDF + rapport signé)</li>
                <li>Suivi des organismes tiers (CPAS, mutuelles…)</li>
                <li>Répertoire des organismes avec adresse et contacts</li>
                <li>Upload des rapports signés dans chaque dossier</li>
                <li>Montant total calculé automatiquement par organisme</li>
              </ul>
              <div className="gp-feature-tip"><strong>Sécurité :</strong> Accès strictement limité — données personnelles sensibles (RLS Supabase).</div>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🏦</div>
              <div><div className="gp-module-name">Économe</div><span className="gp-module-role role-fin">econome</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#7C3AED,#C4B5FD)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Comptabilité Fonctionnement et Couverture élèves</li>
                <li>Encodage POP (notes de frais, factures fournisseurs)</li>
                <li>Bilan mensuel croisé produits/charges + graphiques</li>
                <li>Suivi de projets avec lignes budgétaires</li>
                <li>Export Excel (SheetJS) + PDF bilan et projets</li>
                <li>60+ natures comptables préconfigurées</li>
              </ul>
            </div>
          </div>

        </div>

        <div className="gp-group-label">📚 Pédagogie</div>
        <div className="gp-modules-grid">

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">👥</div>
              <div><div className="gp-module-name">Élèves &amp; Groupes</div><span className="gp-module-role role-ped">eleves</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#7C3AED,#DDD6FE)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Liste complète avec filtres par classe, groupe, suivi social</li>
                <li>Groupes : RLMO, OBS D2/D3, AC D2/D3, Math/Sciences/Bio D3</li>
                <li>Aménagements raisonnables attestés</li>
                <li>Photos élèves synchronisées depuis Smartschool</li>
                <li>Fiche élève complète en 4 onglets</li>
              </ul>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🗂</div>
              <div><div className="gp-module-name">Compositions</div><span className="gp-module-role role-ped">compositions</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#0891B2,#A5F3FC)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Kanban drag-and-drop pour composer les classes</li>
                <li>Affichage des groupes, RLMO, troubles attestés</li>
                <li>Champs personnalisés (notes, observations)</li>
                <li>Photos élèves directement sur les cartes</li>
                <li>Sélection individuelle d&apos;élèves par nom</li>
                <li>Persistance locale entre sessions</li>
              </ul>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🎓</div>
              <div><div className="gp-module-name">Conseils de guidance</div><span className="gp-module-role role-ped">guidance</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#D97706,#FDE68A)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Encodage collaboratif pendant les conseils de classe</li>
                <li>Navigation rapide par classe et élève</li>
                <li>Commentaires structurés par compétence/domaine</li>
                <li>Génération assistée par IA (suggestions de formulations)</li>
                <li>Export et suivi par délibération</li>
              </ul>
              <div className="gp-feature-tip"><strong>Config :</strong> Admin → Conseils de guidance (modèles de commentaires).</div>
            </div>
          </div>

        </div>

        <div className="gp-group-label">🤝 Collaboration &amp; Support</div>
        <div className="gp-modules-grid">

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🏫</div>
              <div><div className="gp-module-name">Salle des profs</div><span className="gp-module-role role-ped">salle_profs</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#059669,#6EE7B7)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Dossiers et sous-dossiers réorganisables (drag &amp; drop)</li>
                <li>Tableaux Kanban collaboratifs (type Trello)</li>
                <li>Documents collaboratifs temps réel (TipTap + Yjs)</li>
                <li>Listes / tableurs collaboratifs avec colonnes libres et groupes</li>
                <li>Pages riches avec bloc &quot;tableau d&apos;élèves&quot; intégré</li>
              </ul>
              <div className="gp-feature-tip"><strong>Collaboration :</strong> Plusieurs profs peuvent éditer le même document simultanément.</div>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">🎫</div>
              <div><div className="gp-module-name">Helpdesk</div><span className="gp-module-role role-all">helpdesk · helpdesk_admin</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#DC2626,#FCA5A5)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Système de tickets pour les demandes internes</li>
                <li>Catégories et formulaires configurables (Admin)</li>
                <li>Fil de discussion par ticket avec participants multiples</li>
                <li>Détection automatique des doublons</li>
                <li>Statuts : Nouveau, En attente, Fermé</li>
              </ul>
            </div>
          </div>

          <div className="gp-module-card">
            <div className="gp-module-header">
              <div className="gp-module-icon">📦</div>
              <div><div className="gp-module-name">Articles</div><span className="gp-module-role role-fin">articles</span></div>
            </div>
            <div className="gp-module-accent" style={{background:'linear-gradient(90deg,#6B7280,#D1D5DB)'}} />
            <div className="gp-module-body">
              <ul className="gp-feature-list">
                <li>Catalogue d&apos;articles (minerval, assurance, photocopies…)</li>
                <li>Attribution à des classes ou élèves individuels</li>
                <li>Statut par article : À facturer / Facturé</li>
                <li>Intégration dans le flux de facturation</li>
              </ul>
            </div>
          </div>

        </div>

        <div className="gp-divider" />

        <div className="gp-section-label">Accès &amp; Permissions</div>
        <div className="gp-section-title">5 rôles, 5 niveaux</div>
        <p className="gp-section-desc">Chaque utilisateur reçoit un rôle de base à l&apos;invitation. Des permissions individuelles peuvent affiner cet accès feature par feature.</p>
        <div className="gp-roles-grid">
          <div className="gp-role-card" style={{borderColor:'#7c3aed'}}>
            <div className="gp-role-title" style={{color:'#7c3aed'}}>⚡ Super Admin</div>
            <div className="gp-role-desc">Accès total + gestion des super admins. Réservé SchoolPlus.</div>
            <div className="gp-role-can yes">Tous les modules sans exception</div>
            <div className="gp-role-can yes">Gérer les autres super admins</div>
            <div className="gp-role-can yes">Paramètres techniques avancés</div>
          </div>
          <div className="gp-role-card" style={{borderColor:'#ef4444'}}>
            <div className="gp-role-title" style={{color:'#ef4444'}}>🛡️ Admin</div>
            <div className="gp-role-desc">Accès complet — gestion des utilisateurs et toutes les données.</div>
            <div className="gp-role-can yes">Tous les modules financiers</div>
            <div className="gp-role-can yes">Administration utilisateurs &amp; droits</div>
            <div className="gp-role-can yes">Synchronisation Smartschool</div>
            <div className="gp-role-can yes">Suivi social (données sensibles)</div>
          </div>
          <div className="gp-role-card" style={{borderColor:'#3b82f6'}}>
            <div className="gp-role-title" style={{color:'#3b82f6'}}>👔 Direction</div>
            <div className="gp-role-desc">Accès financier complet + consultation élèves.</div>
            <div className="gp-role-can yes">Factures, paiements, soldes</div>
            <div className="gp-role-can yes">Élèves, groupes, fiche élève</div>
            <div className="gp-role-can yes">Organismes tiers</div>
            <div className="gp-role-can no">Administration système</div>
          </div>
          <div className="gp-role-card" style={{borderColor:'#22c55e'}}>
            <div className="gp-role-title" style={{color:'#22c55e'}}>🍎 MdP</div>
            <div className="gp-role-desc">Membre du personnel — pédagogie et collaboration.</div>
            <div className="gp-role-can yes">Ses activités (activites_own)</div>
            <div className="gp-role-can yes">Helpdesk — créer et répondre</div>
            <div className="gp-role-can yes">Salle des profs, Compositions</div>
            <div className="gp-role-can no">Données financières</div>
          </div>
          <div className="gp-role-card" style={{borderColor:'#9ca3af'}}>
            <div className="gp-role-title" style={{color:'#6b7280'}}>👨‍👩‍👧 Responsable</div>
            <div className="gp-role-desc">Parent ou élève majeur — tableau de bord enfant uniquement.</div>
            <div className="gp-role-can yes">Tableau de bord (ses enfants)</div>
            <div className="gp-role-can yes">Solde et factures de l&apos;enfant</div>
            <div className="gp-role-can no">Données des autres élèves</div>
            <div className="gp-role-can no">Modules pédagogiques</div>
          </div>
          <div className="gp-role-card" style={{borderColor:'#7C3AED',background:'#faf8ff'}}>
            <div className="gp-role-title" style={{color:'#7C3AED'}}>🎛️ Permissions individuelles</div>
            <div className="gp-role-desc">Chaque feature peut être accordée ou retirée indépendamment du rôle de base.</div>
            <div className="gp-role-can yes">Override par utilisateur (Admin → Droits)</div>
            <div className="gp-role-can yes">Granularité feature par feature</div>
            <div className="gp-role-can yes">Effectif immédiatement (realtime)</div>
          </div>
        </div>

        <div className="gp-divider" />

        <div className="gp-highlight-box">
          <div className="gp-highlight-box-title">🏫 Intégration Smartschool</div>
          <p>
            ESPM+ se connecte à Smartschool via l&apos;API officielle. La synchronisation (Admin → Synchronisation) importe automatiquement :<br /><br />
            <strong>Élèves</strong> — nom, prénom, classe, date de naissance, groupes pédagogiques (OBS/AC/Math/Sciences/Bio), aménagements raisonnables<br />
            <strong>Photos</strong> — directement depuis le profil Smartschool de chaque élève<br />
            <strong>Notifications</strong> — envoi automatique via Smartschool lors de la publication d&apos;une activité ou d&apos;une facture
          </p>
        </div>

        <div className="gp-section-label">Architecture technique</div>
        <div className="gp-section-title">Ce qui tourne derrière</div>
        <p className="gp-section-desc">Une stack moderne, entièrement hébergée en cloud — aucune installation requise.</p>
        <div className="gp-tech-grid">
          <div className="gp-tech-card">
            <div className="gp-tech-card-title">🖥️ Frontend</div>
            <div className="gp-tech-item">
              <div className="gp-tech-badge" style={{background:'#eff6ff'}}>⚛️</div>
              <div className="gp-tech-info"><div className="gp-tech-name">React + Vite</div><div className="gp-tech-detail">SPA — rendu client, build rapide avec Vite</div></div>
              <span className="gp-tech-tag">v18</span>
            </div>
            <div className="gp-tech-item">
              <div className="gp-tech-badge" style={{background:'#f0fdf4'}}>🎨</div>
              <div className="gp-tech-info"><div className="gp-tech-name">Tailwind CSS</div><div className="gp-tech-detail">Thème ESPM+ (primary #2D1B2E) + dark mode</div></div>
              <span className="gp-tech-tag">v3</span>
            </div>
            <div className="gp-tech-item">
              <div className="gp-tech-badge" style={{background:'#fef3c7'}}>🌐</div>
              <div className="gp-tech-info"><div className="gp-tech-name">Netlify</div><div className="gp-tech-detail">Hébergement · CDN · Branche staging auto</div></div>
              <span className="gp-tech-tag">Free tier</span>
            </div>
          </div>
          <div className="gp-tech-card">
            <div className="gp-tech-card-title">🗄️ Backend &amp; Données</div>
            <div className="gp-tech-item">
              <div className="gp-tech-badge" style={{background:'#eef2ff'}}>🐘</div>
              <div className="gp-tech-info"><div className="gp-tech-name">Supabase (PostgreSQL)</div><div className="gp-tech-detail">Base relationnelle · Serveur Frankfurt · RGPD ✓</div></div>
              <span className="gp-tech-tag">UE 🇩🇪</span>
            </div>
            <div className="gp-tech-item">
              <div className="gp-tech-badge" style={{background:'#f0fdf4'}}>🔒</div>
              <div className="gp-tech-info"><div className="gp-tech-name">Supabase Auth</div><div className="gp-tech-detail">Email + mot de passe · JWT · Invitation uniquement</div></div>
              <span className="gp-tech-tag">JWT</span>
            </div>
            <div className="gp-tech-item">
              <div className="gp-tech-badge" style={{background:'#fdf4ff'}}>📡</div>
              <div className="gp-tech-info"><div className="gp-tech-name">Supabase Realtime + Yjs</div><div className="gp-tech-detail">Collaboration temps réel (documents, listes) via WebSocket</div></div>
              <span className="gp-tech-tag">WebSocket</span>
            </div>
          </div>
        </div>

        <div className="gp-section-label">Sécurité</div>
        <div className="gp-section-title">Comment vos données sont protégées</div>
        <p className="gp-section-desc">La plateforme est conçue avec la protection des données comme priorité absolue.</p>
        <div className="gp-security-grid">
          <div className="gp-security-item">
            <div className="gp-security-icon">✉️</div>
            <div><div className="gp-security-title">Invitation uniquement</div><div className="gp-security-desc">Aucune inscription publique. Chaque compte est créé par un administrateur depuis le panneau Admin.</div></div>
          </div>
          <div className="gp-security-item">
            <div className="gp-security-icon">🇩🇪</div>
            <div><div className="gp-security-title">Données en Europe</div><div className="gp-security-desc">Stockées sur des serveurs en Allemagne (Frankfurt). Conforme au RGPD et à la loi belge.</div></div>
          </div>
          <div className="gp-security-item">
            <div className="gp-security-icon">🔐</div>
            <div><div className="gp-security-title">Row Level Security</div><div className="gp-security-desc">Chaque utilisateur ne voit que ce à quoi il a droit — protégé côté serveur par les politiques RLS Supabase.</div></div>
          </div>
          <div className="gp-security-item">
            <div className="gp-security-icon">🔑</div>
            <div><div className="gp-security-title">Mots de passe chiffrés</div><div className="gp-security-desc">Hachage bcrypt géré par Supabase Auth. Jamais stockés en clair.</div></div>
          </div>
          <div className="gp-security-item">
            <div className="gp-security-icon">🎛️</div>
            <div><div className="gp-security-title">Droits granulaires</div><div className="gp-security-desc">Permissions par feature, par rôle ET par utilisateur. Modifications effectives en temps réel.</div></div>
          </div>
          <div className="gp-security-item">
            <div className="gp-security-icon">🚫</div>
            <div><div className="gp-security-title">Zéro publicité</div><div className="gp-security-desc">Aucun cookie de traçage, aucune pub, aucune donnée vendue. Outil purement interne à l&apos;école.</div></div>
          </div>
        </div>

        <div className="gp-divider" />

        <div className="gp-section-label">Pour bien démarrer</div>
        <div className="gp-section-title">Checklist par moment clé</div>
        <p className="gp-section-desc">Ce que faire et quand le faire pour tirer le meilleur parti de la plateforme.</p>
        <div className="gp-checklist-grid">
          <div className="gp-checklist-card">
            <div className="gp-checklist-header" style={{color:'#7C3AED'}}>🎒 Début d&apos;année scolaire</div>
            <div className="gp-checklist-body">
              ✅ Synchroniser Smartschool (Admin → Sync)<br />
              ✅ Importer les photos élèves en masse<br />
              ✅ Vérifier les droits d&apos;accès (Admin → Droits)<br />
              ✅ Créer les articles récurrents (minerval, assurance…)<br />
              ✅ Générer les factures de début d&apos;année<br />
              ✅ Configurer les natures comptables Économe
            </div>
          </div>
          <div className="gp-checklist-card">
            <div className="gp-checklist-header" style={{color:'#059669'}}>🎫 Avant une activité</div>
            <div className="gp-checklist-body">
              ✅ Créer l&apos;activité (Activités → + Nouvelle)<br />
              ✅ Encoder les dépenses POP prévues<br />
              ✅ Définir la liste des participants<br />
              ✅ Configurer les acomptes (si voyage)<br />
              ✅ Passer en statut <strong>Publié</strong> → notif SS parents<br />
              ✅ Vérifier sur staging avant toute comms
            </div>
          </div>
          <div className="gp-checklist-card">
            <div className="gp-checklist-header" style={{color:'#2563EB'}}>💳 Après import Belfius</div>
            <div className="gp-checklist-body">
              ✅ Exporter le CSV depuis l&apos;extranet Belfius<br />
              ✅ Importer dans Paiements → Import CSV<br />
              ✅ Vérifier les associations non reconnues<br />
              ✅ Contrôler les soldes mis à jour<br />
              ✅ Encoder les frais fournisseurs (Économe → POP)<br />
              ✅ Récupérer les encodages Économe → Paiements
            </div>
          </div>
          <div className="gp-checklist-card">
            <div className="gp-checklist-header" style={{color:'#D97706'}}>🎓 Délibérations &amp; Conseils</div>
            <div className="gp-checklist-body">
              ✅ Ouvrir Compositions pour préparer les classes<br />
              ✅ Vérifier les groupes et troubles attestés<br />
              ✅ Encoder les décisions (Conseils de guidance)<br />
              ✅ Générer les rapports PDF des échelonnements<br />
              ✅ Mettre à jour les organismes tiers si besoin<br />
              ✅ Archiver les activités terminées
            </div>
          </div>
        </div>

      </div>

      <div className="gp-footer">
        <strong>ESPM+ · Plateforme de l&apos;École Secondaire Plurielle Maritime</strong> &mdash; outil interne confidentiel &mdash;{' '}
        <a href="https://espmaritime.netlify.app" style={{color:'#C4B5FD'}}>espmaritime.netlify.app</a>
      </div>
    </div>
  )
}
