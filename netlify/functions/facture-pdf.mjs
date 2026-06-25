// facture-pdf.mjs — v1.4
// GET /.netlify/functions/facture-pdf?factureId=UUID&token=SUPABASE_JWT

import { createClient } from '@supabase/supabase-js'

// ── Récupération des paramètres école depuis Supabase ──────────────────────
async function getSchoolSettings(supabase) {
  const D = {
    school_nom:           'Ecole',
    school_adresse_rue:   'Rue',
    school_adresse_cp:    '0000',
    school_adresse_ville: 'Ville',
    school_bce:           '',
    school_logo_url:      '',
    school_email_general: 'info@school.be',
    school_tel_general:   '00/000.00.00',
    school_email_eco:     'eco@school.be',
    school_tel_eco:       '00/000.00.00',
    school_nom_eco:       'M. Economat',
    school_email_as:      'as@school.be',
    school_tel_as:        '00/000.00.00',
    school_nom_as:        'M. Assistantsocial',
    school_iban:          'BE00 0000 0000 0000',
    school_beneficiaire:  'Ecole',
  }
  try {
    const { data } = await supabase.from('app_settings').select('key, value')
    if (data) data.forEach(r => { if (r.value !== null && r.value !== '') D[r.key] = r.value })
  } catch (e) { /* fallback */ }
  return D
}


const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY

const ORG_LABELS = { cpas: 'CPAS', ulb: 'ULB', spj: 'SPJ', autre: 'Organisme tiers' }

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEur(v) {
  return Number(v || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const factureId = url.searchParams.get('factureId')
  const token     = url.searchParams.get('token')
  if (!factureId || !token) return new Response('Paramètres manquants', { status: 400 })

  const supa = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await supa.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorisé', { status: 401 })

  const [{ data: facture }, { data: lignes }] = await Promise.all([
    supa.from('factures')
      .select('*, eleve:eleve_id(*), batch:batch_id(numero,nom)')
      .eq('id', factureId).single(),
    supa.from('facture_lignes')
      .select('*').eq('facture_id', factureId).order('type').order('categorie'),
  ])
  if (!facture) return new Response('Facture introuvable', { status: 404 })

  const eleve = facture.eleve
  const [{ data: echs }, { data: orgs }] = await Promise.all([
    supa.from('echelonnements').select('*').eq('eleve_id', eleve.id).eq('statut', 'en_cours')
      .order('created_at', { ascending: false }).limit(1),
    supa.from('organismes_tiers').select('*').eq('eleve_id', eleve.id).in('statut', ['en_cours', 'valide'])
      .order('created_at', { ascending: false }).limit(1),
  ])
  const ech = echs?.[0]
  const org = orgs?.[0]

  const nomResp = [eleve.prenom_responsable_1, eleve.nom_responsable_1].filter(Boolean).join(' ')
    || [eleve.prenom_coaccount1, eleve.nom_coaccount1].filter(Boolean).join(' ')
    || `Famille ${eleve.nom}`

  const adresseLigne1 = eleve.rue || ''
  const adresseLigne2 = [eleve.code_postal, eleve.commune].filter(Boolean).join(' ')
  const dateLimite    = addDays(facture.date, 30)
  const soldeAv       = Number(facture.solde_avant || 0)
  const resteApayer   = Math.max(0, Number(facture.montant) - soldeAv - Number(facture.paye || 0))
  const articles      = (lignes || []).filter(l => l.type === 'article')
  const activites     = (lignes || []).filter(l => l.type === 'activite')

  // Communication structurée : Nom Prénom Classe
  const comm = [eleve.nom, eleve.prenom, eleve.classe].filter(Boolean).join(' ')

  const _defaultLogoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'
  const logoUrl = ss.school_logo_url || _defaultLogoUrl
  const hasAide = !!ech || !!org

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Facture ${esc(facture.numero)} — ${esc(eleve.prenom)} ${esc(eleve.nom)}</title>
<style>
@page { size: A4; margin: 0; }
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,Helvetica,sans-serif; font-size:10pt; color:#1a1a1a; background:#f5f5f5; }
@media screen { .page { box-shadow:0 2px 16px rgba(0,0,0,.12); margin:20px auto; } }
@media print { body { background:white; } }
.btn-print {
  position:fixed; top:12px; right:12px;
  background:#2D1B2E; color:#fff; border:none;
  padding:9px 18px; cursor:pointer; border-radius:6px;
  font-size:13px; font-family:Arial,sans-serif; z-index:9999;
}
.btn-print:hover { background:#3e2640; }
@media print { .btn-print { display:none !important; } }

.page { width:210mm; min-height:297mm; display:flex; flex-direction:column; background:white; padding:12mm 15mm 0 15mm; }
.page-body { flex:1; }

/* EN-TÊTE : logo + ESPM+ côte à côte à gauche */
.header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4mm; }
.header-left { display:flex; align-items:center; gap:4mm; }
.logo-ecole { height:18mm; display:block; }
.espm-plus { font-size:13pt; font-weight:900; color:#bbb; letter-spacing:-0.5px; }
.header-right { text-align:right; }
.school-name { font-size:10pt; font-weight:700; color:#2D1B2E; margin-bottom:1mm; }
.school-addr { font-size:8pt; color:#555; line-height:1.6; }

.hr-main { border:none; border-top:2.5px solid #2D1B2E; margin:0 0 5mm 0; }
.hr-thin  { border:none; border-top:1px solid #e0e0e0; margin:4mm 0; }

/* ZONE TITRE + ADRESSE FENÊTRE DROITE */
.zone-top { display:flex; align-items:flex-start; gap:8mm; margin-bottom:5mm; }
.col-title { flex:1; }
.col-title h1 { font-size:18pt; font-weight:900; color:#2D1B2E; letter-spacing:2px; margin-bottom:2mm; }
.col-title .ref { font-size:8.5pt; color:#888; margin-bottom:4mm; }
.col-title .meta { font-size:8.5pt; line-height:1.9; }
.col-title .meta .lbl { color:#999; }
.col-title .meta .val { font-weight:700; color:#222; }
.col-title .meta .val-orange { font-weight:700; color:#E86C00; }

.col-adresse {
  width:82mm; flex-shrink:0;
  padding:4mm 5mm;
  border:1px dashed #ccc;
  line-height:1.65; font-size:10.5pt;
}
@media print { .col-adresse { border-color:transparent; } }
.col-adresse .a-nom { font-weight:700; }

/* TABLE LIGNES */
table.lignes { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:2mm; }
table.lignes thead th { background:#2D1B2E; color:#fff; padding:2.5mm 3.5mm; text-align:left; font-size:8pt; font-weight:600; }
table.lignes thead th.r { text-align:right; width:28mm; }
table.lignes tbody .cat-row td { background:#f0edf5; color:#5a3a6a; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:2mm 3.5mm; }
table.lignes tbody td { padding:2mm 3.5mm; border-bottom:1px solid #f0f0f0; }
table.lignes tbody tr.data:last-of-type td { border-bottom:none; }
table.lignes tbody tr.data:nth-child(even) td { background:#fafafa; }
.r { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }

/* TOTAUX */
.totaux-wrap { display:flex; justify-content:flex-end; margin:2mm 0 5mm; }
table.totaux { width:78mm; font-size:9pt; border-collapse:collapse; }
table.totaux td { padding:1.5mm 3mm; }
table.totaux .r { text-align:right; font-variant-numeric:tabular-nums; }
table.totaux .final td { border-top:2.5px solid #2D1B2E; font-size:11pt; font-weight:900; color:#2D1B2E; padding-top:2.5mm; }

/* SECTIONS */
.sect { padding:3mm 4mm; margin-bottom:3mm; border-left:3px solid #E86C00; background:#fffbf7; }
.sect.mauve { border-color:#B89AAB; background:#f7f4fa; }
.sect.neutre { border-color:#cbd5e1; background:#f8fafc; }
.sect h3 { font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#E86C00; margin-bottom:2mm; }
.sect.mauve h3 { color:#7a5a8a; }
.sect.neutre h3 { color:#64748b; }
.sect p { font-size:8.5pt; line-height:1.6; margin-bottom:1.5mm; }
.sect p:last-child { margin-bottom:0; }
.mono { font-family:'Courier New',monospace; font-weight:700; letter-spacing:1px; }
.comm { font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:10pt; color:#2D1B2E; }

/* PIED DE PAGE */
.footer { font-size:7pt; color:#bbb; text-align:center; border-top:1px solid #e8e8e8; padding:2mm 0 8mm 0; margin-top:4mm; }
</style>
</head>
<body>
<button class="btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>

<div class="page">

  <!-- EN-TÊTE : logo + ESPM+ à gauche | nom école + adresse à droite -->
  <div class="header">
    <div class="header-left">
      <img class="logo-ecole" src="${logoUrl}" alt="${ss.school_nom}">

    </div>
    <div class="header-right">
      <div class="school-name">${ss.school_nom}</div>
      <div class="school-addr">
        ${ss.school_adresse_rue} · ${ss.school_adresse_cp} ${ss.school_adresse_ville}<br>
        ${ss.school_iban ? `IBAN : <strong>${esc(ss.school_iban)}</strong>` : ''}
      </div>
    </div>
  </div>
  <hr class="hr-main">
  <div class="page-body">

  <!-- TITRE + ADRESSE FENÊTRE -->
  <div class="zone-top">
    <div class="col-title">
      <h1>FACTURE</h1>
      <p class="ref">N°&nbsp;${esc(facture.numero || '—')}&nbsp;·&nbsp;${esc(facture.batch?.nom || facture.batch?.numero || '')}</p>
      <div class="meta">
        <div><span class="lbl">Élève&nbsp;: </span><span class="val">${esc(eleve.prenom)} ${esc(eleve.nom)}</span></div>
        <div><span class="lbl">Classe&nbsp;: </span><span class="val">${esc(eleve.classe || '—')}</span></div>
        <div><span class="lbl">Date de facturation&nbsp;: </span><span class="val">${fmtDate(facture.date)}</span></div>
        <div><span class="lbl">Date limite&nbsp;: </span><span class="val-orange">${fmtDate(dateLimite)}</span></div>
      </div>
    </div>
    <div class="col-adresse">
      <p class="a-nom">${esc(nomResp)}</p>
      ${adresseLigne1 ? `<p>${esc(adresseLigne1)}</p>` : ''}
      ${adresseLigne2 ? `<p>${esc(adresseLigne2)}</p>` : ''}
    </div>
  </div>

  <hr class="hr-thin">

  <!-- LIGNES -->
  <table class="lignes">
    <thead><tr><th>Désignation</th><th class="r">Montant</th></tr></thead>
    <tbody>
      ${articles.length ? `<tr class="cat-row"><td colspan="2">Articles</td></tr>${articles.map(l => `<tr class="data"><td>${esc(l.libelle)}${l.categorie ? ` <span style="font-size:7.5pt;color:#ccc">— ${esc(l.categorie)}</span>` : ''}</td><td class="r">${fmtEur(l.montant)}</td></tr>`).join('')}` : ''}
      ${activites.length ? `<tr class="cat-row"><td colspan="2">Activités</td></tr>${activites.map(l => `<tr class="data"><td>${esc(l.libelle)}</td><td class="r">${fmtEur(l.montant)}</td></tr>`).join('')}` : ''}
      ${!articles.length && !activites.length ? `<tr><td colspan="2" style="text-align:center;color:#bbb;padding:6mm">Aucune ligne</td></tr>` : ''}
    </tbody>
  </table>

  <!-- TOTAUX -->
  <div class="totaux-wrap">
    <table class="totaux">
      <tr><td>Total facturé</td><td class="r">${fmtEur(facture.montant)}</td></tr>
      ${facture.solde_avant && Number(facture.solde_avant) !== 0 ? `<tr><td style="color:#999">Solde antérieur</td><td class="r" style="color:#999">${fmtEur(facture.solde_avant)}</td></tr>` : ''}
      ${Number(facture.paye || 0) > 0 ? `<tr><td style="color:#16a34a">Déjà payé</td><td class="r" style="color:#16a34a">− ${fmtEur(facture.paye)}</td></tr>` : ''}
      <tr class="final"><td>RESTE À PAYER</td><td class="r">${fmtEur(resteApayer)}</td></tr>
    </table>
  </div>

  <hr class="hr-thin">

  <!-- PAIEMENT -->
  <div class="sect">
    <h3>Informations de paiement</h3>
    <p><strong>Bénéficiaire&nbsp;:</strong> ${esc(ss.school_beneficiaire)}</p>
    <p><strong>IBAN&nbsp;:</strong> <span class="mono">${esc(ss.school_iban)}</span></p>
    <p><strong>Communication&nbsp;:</strong> <span class="comm">${esc(comm)}</span></p>
    <p><strong>Date limite&nbsp;:</strong> ${fmtDate(dateLimite)} (30 jours à dater de la facturation)</p>
  </div>

  ${ech ? `<div class="sect mauve">
    <h3>Plan d'échelonnement en cours</h3>
    <p>Un plan de paiement échelonné est actuellement en cours pour cet élève.${ech.mensualite || ech.montant_par_mois ? ` Mensualité&nbsp;: <strong>${fmtEur(ech.mensualite || ech.montant_par_mois)}</strong>` : ''}${ech.date_debut ? ` — à partir du <strong>${fmtDate(ech.date_debut)}</strong>` : ''}${ech.fin ? ` jusqu'au <strong>${fmtDate(ech.fin)}</strong>` : ''}.</p>
    ${ech.remarque ? `<p style="color:#666;font-style:italic">${esc(ech.remarque)}</p>` : ''}
  </div>` : ''}

  ${org ? `<div class="sect mauve">
    <h3>Prise en charge par organisme tiers</h3>
    <p>Un organisme tiers est impliqué dans le suivi financier de cet élève&nbsp;: <strong>${esc(ORG_LABELS[org.organisme] || org.organisme)}</strong> — Statut&nbsp;: ${org.statut === 'valide' ? 'Validé ✓' : 'En cours'}${org.montant_accorde ? ` — Montant accordé&nbsp;: <strong>${fmtEur(org.montant_accorde)}</strong>` : ''}.</p>
    ${org.notes ? `<p style="color:#666;font-style:italic">${esc(org.notes)}</p>` : ''}
  </div>` : ''}

  <!-- CONTACTS -->
  <div class="sect neutre">
    <h3>Nous contacter</h3>
    <p>Les responsables légaux peuvent à tout moment contacter l'<strong>assistant social de l'école, ${ss.school_nom_as}</strong>, par Smartschool ou au <strong>${esc(ss.school_tel_as)}</strong> pour prendre un rendez-vous.</p>
    <p>Pour toute précision concernant cette facture, prenez contact avec l'<strong>économe de l'école, ${ss.school_nom_eco}</strong>, par Smartschool ou au <strong>${esc(ss.school_tel_eco)}</strong>.</p>
  </div>

  <!-- PIED DE PAGE -->
  </div><!-- /page-body -->
  <div class="footer">
    ${esc(ss.school_email_eco)} · ${esc(ss.school_tel_eco)}${ss.school_bce ? ` — BCE N°&nbsp;${esc(ss.school_bce)}` : ''} &nbsp;|&nbsp; Cette facture a été générée depuis <strong>ESPM<span style="color:#E86C00">+</span></strong>
  </div>

</div>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
