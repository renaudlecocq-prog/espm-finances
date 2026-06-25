// organismes-tiers-rapport-pdf.mjs — v2.0
// GET /.netlify/functions/organismes-tiers-rapport-pdf?otId=UUID&token=JWT
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


const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const esc     = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmt     = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'
const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_LABELS = { en_cours:'En cours', attente:'En attente', termine:'Terminé', refuse:'Refusé' }
const STATUT_COLOR  = { en_cours:'#1d4ed8', attente:'#92400e', termine:'#15803d', refuse:'#b91c1c' }
const STATUT_BG     = { en_cours:'#dbeafe', attente:'#fef3c7', termine:'#dcfce7', refuse:'#fee2e2' }

export const handler = async (event) => {
  const params = event.queryStringParameters || {}
  const token  = params.token
  const otId   = params.otId

  if (!token) return { statusCode:401, body:'Token manquant' }
  if (!otId)  return { statusCode:400, body:'otId manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const ss = await getSchoolSettings(supabase)
  const { data:{ user }, error:authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode:403, body:'Non autorisé' }

  const _defaultLogoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'
  const logoUrl = ss.school_logo_url || _defaultLogoUrl

  const [{ data:ot }, { data:articles }] = await Promise.all([
    supabase.from('organismes_tiers')
      .select(`*, eleve:eleve_id(
        id, nom, prenom, classe, date_naissance,
        prenom_responsable_1, nom_responsable_1,
        prenom_responsable_2, nom_responsable_2,
        prenom_coaccount1, nom_coaccount1,
        prenom_coaccount2, nom_coaccount2,
        rue, code_postal, commune
      )`)
      .eq('id', otId).single(),
    supabase.from('organismes_tiers_articles')
      .select('*').eq('ot_id', otId).order('ordre').order('created_at'),
  ])

  if (!ot) return { statusCode:404, body:'Organisme tiers introuvable' }

  const eleve  = ot.eleve || {}
  const today  = new Date().toLocaleDateString('fr-BE')
  const sc     = STATUT_COLOR[ot.statut] || '#6b7280'
  const sb     = STATUT_BG[ot.statut]   || '#f3f4f6'
  const total  = (articles||[]).reduce((s,a) => s + Number(a.montant), 0)

  const resp1 = [eleve.prenom_responsable_1 || eleve.prenom_coaccount1, eleve.nom_responsable_1 || eleve.nom_coaccount1].filter(Boolean).join(' ')
  const resp2 = [eleve.prenom_responsable_2 || eleve.prenom_coaccount2, eleve.nom_responsable_2 || eleve.nom_coaccount2].filter(Boolean).join(' ')
  const adresseEleve1 = eleve.rue || ''
  const adresseEleve2 = [eleve.code_postal, eleve.commune].filter(Boolean).join(' ')
  const comm = [eleve.nom, eleve.prenom, eleve.classe].filter(Boolean).join(' ')

  const articleRows = (articles||[]).map(a => `
    <tr>
      <td>${esc(a.titre)}</td>
      <td class="r">${fmt(a.montant)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Demande de prise en charge — ${esc(eleve.nom)} ${esc(eleve.prenom)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif; }
  body { background:#f5f5f5; }
  @media print {
    body { background:white; }
    .print-btn { display:none !important; }
    @page { size:A4 portrait; margin:0; }
  }
  @media screen { .page { box-shadow:0 2px 16px rgba(0,0,0,.12); margin:20px auto; } }
  .print-btn {
    position:fixed; top:16px; right:16px; z-index:100;
    background:#2D1B2E; color:white; border:none; border-radius:8px;
    padding:10px 20px; font-size:13px; font-weight:600; cursor:pointer;
  }
  .page {
    width:210mm; min-height:297mm; display:flex; flex-direction:column;
    padding:12mm 15mm 0 15mm; margin:0 auto; background:white;
  }
  .header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:5mm; }
  .logo-ecole { height:18mm; width:auto; }
  .header-right { text-align:right; }
  .school-name { font-size:11pt; font-weight:700; color:#2D1B2E; }
  .school-addr { font-size:8pt; color:#666; margin-top:2px; }
  .hr-main { border:none; border-top:2.5px solid #2D1B2E; margin:0 0 5mm 0; }
  .title-row { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:6mm; gap:8mm; }
  .title-left { flex:1; }
  .doc-title { font-size:18pt; font-weight:900; color:#2D1B2E; font-family:Arial Black,Arial,sans-serif; line-height:1.1; }
  .doc-meta { font-size:8.5pt; color:#9ca3af; margin-top:2mm; }
  .doc-meta strong { color:#374151; }
  .statut-badge { display:inline-block; padding:3px 12px; border-radius:20px; font-size:9pt; font-weight:700; margin-top:3mm; }
  .org-box { border:1px solid #e5e7eb; border-radius:8px; padding:4mm 5mm; min-width:56mm; max-width:62mm; font-size:9pt; line-height:1.55; }
  .org-box .org-type { font-size:7.5pt; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.05em; margin-bottom:1.5mm; }
  .org-box .org-name { font-size:10.5pt; font-weight:700; color:#111827; }
  .org-box .org-addr { color:#374151; margin-top:1mm; }
  .section-title { font-size:7.5pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; margin-bottom:2mm; margin-top:4mm; }
  .eleve-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:5mm; }
  .eleve-cell { padding:2.5mm 4mm; border-bottom:1px solid #f3f4f6; font-size:8.5pt; }
  .eleve-cell .lbl { color:#9ca3af; font-size:7.5pt; margin-bottom:0.5mm; }
  .eleve-cell .val { color:#111827; font-weight:500; }
  .eleve-cell.full { grid-column:1/-1; }
  .page-body { flex:1; }
  table { width:100%; border-collapse:collapse; font-size:9pt; }
  thead th { background:#2D1B2E; color:white; font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:3px 6px; text-align:left; }
  thead th.r { text-align:right; }
  tbody tr { border-bottom:1px solid #f3f4f6; }
  tbody td { padding:3.5px 6px; color:#374151; }
  td.r { text-align:right; }
  .totaux-wrap { display:flex; justify-content:flex-end; margin-top:2mm; margin-bottom:5mm; }
  .totaux { width:auto; min-width:64mm; border-collapse:collapse; font-size:9pt; }
  .totaux td { padding:2px 6px; color:#374151; }
  .totaux td.r { text-align:right; }
  .totaux tr.final td { font-weight:800; font-size:11pt; color:#2D1B2E; border-top:2px solid #2D1B2E; padding-top:4px; }
  .hr-thin { border:none; border-top:1px solid #e5e7eb; margin:0 0 3mm 0; }
  .sect { padding:3mm 4mm; margin-bottom:3mm; border-radius:8px; }
  .sect.orange { background:#fff7ed; border-left:3px solid #E86C00; }
  .sect h3 { font-size:8.5pt; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2mm; }
  .sect p { font-size:8.5pt; color:#374151; margin-bottom:1.5mm; line-height:1.5; }
  .sect p:last-child { margin-bottom:0; }
  .mono { font-family:monospace; font-size:9pt; font-weight:600; letter-spacing:.04em; }
  .comm { font-weight:700; color:#2D1B2E; }
  .sign-wrap { margin-top:8mm; padding:0 2mm; }
  .sign-date { font-size:8pt; color:#374151; margin-bottom:7mm; }
  .sign-cols { display:flex; justify-content:space-between; gap:14mm; }
  .sign-col { flex:1; text-align:center; }
  .sign-col .sign-label { font-size:7.5pt; font-weight:600; color:#374151; margin-bottom:16mm; }
  .sign-col .sign-line { border-top:1px solid #374151; padding-top:2mm; }
  .sign-col .sign-sub { font-size:7pt; color:#6b7280; }
  .footer { font-size:7pt; color:#bbb; text-align:center; border-top:1px solid #e8e8e8; padding:2mm 0 8mm 0; margin-top:5mm; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖸 Imprimer / Enregistrer en PDF</button>

<div class="page">

  <div class="header">
    <img class="logo-ecole" src="${logoUrl}" alt="${ss.school_nom}">
    <div class="header-right">
      <div class="school-name">${ss.school_nom}</div>
      <div class="school-addr">Avenue Jean Dubrucq 175 &nbsp;·&nbsp; 1080 Molenbeek-Saint-Jean</div>
      <div class="school-addr">IBAN&nbsp;: ${esc(ss.school_iban)}</div>
    </div>
  </div>
  <hr class="hr-main">

  <div class="page-body">

    <div class="title-row">
      <div class="title-left">
        <h1 class="doc-title">DEMANDE DE PRISE<br>EN CHARGE</h1>
        <div class="doc-meta">Généré le <strong>${today}</strong></div>

      </div>

      <div class="org-box">
        <div class="org-type">${esc((ot.organisme||'').toUpperCase())}</div>
        ${ot.institution ? `<div class="org-name">${esc(ot.institution)}</div>` : `<div class="org-name">${esc((ot.organisme||'').toUpperCase())}</div>`}
        ${ot.rue         ? `<div class="org-addr">${esc(ot.rue)}</div>` : ''}
        ${(ot.code_postal||ot.commune) ? `<div class="org-addr">${esc([ot.code_postal,ot.commune].filter(Boolean).join(' '))}</div>` : ''}
      </div>
    </div>

    <div class="section-title">Coordonnées de l'élève</div>
    <div class="eleve-grid">
      <div class="eleve-cell">
        <div class="lbl">Nom</div>
        <div class="val">${esc(eleve.nom || '—')}</div>
      </div>
      <div class="eleve-cell">
        <div class="lbl">Prénom</div>
        <div class="val">${esc(eleve.prenom || '—')}</div>
      </div>
      <div class="eleve-cell">
        <div class="lbl">Classe</div>
        <div class="val">${esc(eleve.classe || '—')}</div>
      </div>
      <div class="eleve-cell">
        <div class="lbl">Date de naissance</div>
        <div class="val">${fmtDate(eleve.date_naissance)}</div>
      </div>
      ${resp1 ? `<div class="eleve-cell">
        <div class="lbl">Responsable 1</div>
        <div class="val">${esc(resp1)}</div>
      </div>` : ''}
      ${resp2 ? `<div class="eleve-cell">
        <div class="lbl">Responsable 2</div>
        <div class="val">${esc(resp2)}</div>
      </div>` : ''}
      ${adresseEleve1 ? `<div class="eleve-cell full">
        <div class="lbl">Adresse</div>
        <div class="val">${esc(adresseEleve1)}${adresseEleve2 ? ` &nbsp;·&nbsp; ${esc(adresseEleve2)}` : ''}</div>
      </div>` : ''}
      ${ot.notes ? `<div class="eleve-cell full">
        <div class="lbl">Notes</div>
        <div class="val" style="font-style:italic;color:#6b7280">${esc(ot.notes)}</div>
      </div>` : ''}
    </div>

    <div class="section-title">Articles à charge</div>
    ${articles?.length ? `
    <table>
      <thead>
        <tr>
          <th>Désignation</th>
          <th class="r" style="width:28mm">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${articleRows}
      </tbody>
    </table>
    <div class="totaux-wrap">
      <table class="totaux">
        <tr class="final">
          <td style="white-space:nowrap">MONTANT DEMANDÉ</td>
          <td class="r" style="white-space:nowrap">${fmt(total)}</td>
        </tr>
      </table>
    </div>` : '<p style="color:#9ca3af;font-style:italic;font-size:9pt;margin:3mm 0 5mm">Aucun article renseigné.</p>'}

    <hr class="hr-thin">

    <div class="sect orange">
      <h3>Informations de paiement</h3>
      <p><strong>Bénéficiaire&nbsp;:</strong> ${esc(ss.school_beneficiaire)}</p>
      <p><strong>IBAN&nbsp;:</strong> <span class="mono">${esc(ss.school_iban)}</span></p>
      <p><strong>Communication&nbsp;:</strong> <span class="comm">${esc(comm)}</span></p>
      <p><strong>Montant demandé&nbsp;:</strong> ${fmt(total)}</p>
    </div>

  </div>

  <div class="sign-wrap">
    <div class="sign-date">Fait à Molenbeek-Saint-Jean, le ___________________________</div>
    <div class="sign-cols">
      <div class="sign-col">
        <div class="sign-label">Signature du responsable légal</div>
        <div class="sign-line"><div class="sign-sub">Nom et signature</div></div>
      </div>
      <div class="sign-col">
        <div class="sign-label">Signature du représentant de l'école</div>
        <div class="sign-line"><div class="sign-sub">Nom et signature</div></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <strong>${ss.school_nom_as}</strong>, Assistant social &nbsp;—&nbsp; ${esc(ss.school_email_as)} · ${esc(ss.school_tel_as)} &nbsp;|&nbsp; Rapport généré depuis <strong>ESPM<span style="color:#E86C00">+</span></strong>
  </div>

</div>
</body>
</html>`

  return {
    statusCode: 200,
    headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' },
    body: html,
  }
}
