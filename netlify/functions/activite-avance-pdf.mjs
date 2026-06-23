// activite-avance-pdf.mjs — v1.0
// GET /.netlify/functions/activite-avance-pdf?id=UUID
// Génère un formulaire de demande d'avance pour un voyage scolaire
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_EMAIL         = process.env.SCHOOL_EMAIL_SCHOOL || 'info@espmaritime.be'
const SCHOOL_TEL           = process.env.SCHOOL_TEL_SCHOOL   || '02/210.20.91'

const esc  = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmt  = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'

export const handler = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const params     = event.queryStringParameters || {}
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7)
    : (params.token ? decodeURIComponent(params.token) : null)
  const id = params.id

  if (!token) return { statusCode:401, body:'Token manquant' }
  if (!id)    return { statusCode:400, body:'id manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data:{ user }, error:authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode:403, body:'Non autorisé' }

  const logoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'

  const [{ data:act }, { data:depenses }] = await Promise.all([
    supabase.from('activites').select('*').eq('id', id).single(),
    supabase.from('activite_depenses').select('*').eq('activite_id', id).order('ordre').order('created_at'),
  ])
  if (!act) return { statusCode:404, body:'Activité introuvable' }

  const avanceDeps = (depenses || []).filter(d => d.avance)
  const today = new Date().toLocaleDateString('fr-BE')
  const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-BE') : '—'

  const typeColor = '#8b5cf6'
  const typeBg    = '#f5f3ff'

  // Tableau des dépenses avance
  const depRows = avanceDeps.length > 0
    ? avanceDeps.map(d => `
      <tr>
        <td>${esc(d.intitule || '—')}</td>
        <td class="text-right">${fmt(d.montant_total)}</td>
        <td>${esc(d.paye_par || '—')}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="empty">Aucune dépense marquée "Avance"</td></tr>`

  const totalAvance = avanceDeps.reduce((s,d) => s + parseFloat(d.montant_total||0), 0)

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Demande d'avance — ${esc(act.intitule)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif }
  body { background:#f5f5f5; padding:0 }
  .page {
    background:#fff; width:210mm; min-height:297mm;
    margin:10mm auto; padding:20mm 22mm 18mm 22mm;
    display:flex; flex-direction:column;
    box-shadow:0 2px 16px rgba(0,0,0,.12);
  }
  /* Header */
  .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10mm; padding-bottom:6mm; border-bottom:1.5px solid #e5e7eb }
  .logo-ecole { height:16mm; width:auto; display:block }
  .header-right { text-align:right }
  .school-name-bold { font-size:11pt; font-weight:700; color:#1a1a2e; margin-bottom:1.5mm }
  .school-addr { font-size:8pt; color:#888; line-height:1.5 }
  /* Title */
  .title-row { display:flex; align-items:baseline; gap:3mm; margin-bottom:2mm }
  .type-badge {
    display:inline-block; background:${typeBg}; color:${typeColor};
    border:1px solid ${typeColor}40; border-radius:5px;
    font-size:7.5pt; font-weight:700; padding:1mm 3mm;
    text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; flex-shrink:0;
  }
  h1 { font-size:15pt; font-weight:800; color:#1a1a2e; line-height:1.2; margin:0 }
  .date-line { font-size:9pt; color:#888; margin-bottom:6mm }
  /* Section titles */
  .section-title { font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#6b7280; margin-bottom:1.5mm; margin-top:4mm }
  /* Identity 2-col grid */
  .id-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 6mm; margin-bottom:4mm; align-items:stretch }
  .id-col { display:flex; flex-direction:column; gap:2mm }
  .id-field { display:flex; flex-direction:column; gap:0.5mm; flex:1 }
  .id-label { font-size:7.5pt; color:#6b7280; font-weight:600 }
  .id-blank { border-bottom:1px solid #374151; min-height:5mm; padding-bottom:0.5mm; font-size:8.5pt; color:#111827 }
  .id-blank-tall { border:1px solid #d1d5db; border-radius:3px; flex:1; min-height:32mm; padding:2mm; font-size:8.5pt; color:#111827 }
  .id-col-right { display:flex; flex-direction:column; gap:0.5mm }
  /* Date field */
  .date-blank { display:inline-block; border-bottom:1px solid #374151; width:50mm; vertical-align:bottom }
  /* Dépenses table */
  .dep-table { width:100%; border-collapse:collapse; margin-bottom:4mm; font-size:9pt }
  .dep-table th { background:#f9fafb; padding:2mm 3mm; text-align:left; font-weight:700; color:#374151; border-bottom:2px solid #e5e7eb; font-size:8.5pt }
  .dep-table td { padding:2mm 3mm; border-bottom:1px solid #f0f0f0; color:#111827 }
  .dep-table .text-right { text-align:right; font-weight:600 }
  .dep-table .empty { text-align:center; color:#9ca3af; font-style:italic }
  .dep-total { display:flex; justify-content:flex-end; margin-bottom:5mm }
  .dep-total-box { background:#f5f3ff; border:1px solid #8b5cf640; border-radius:6px; padding:2.5mm 5mm; font-size:10pt; font-weight:700; color:#5b21b6 }
  /* Mention importante */
  .mention-box { background:#fef9c3; border-left:3px solid #ca8a04; padding:3mm 4mm; font-size:9.5pt; color:#713f12; margin-bottom:6mm; line-height:1.5; font-weight:600 }
  /* Signatures */
  .sig-section { margin-top:auto; padding-top:5mm }
  .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:10mm }
  .sig-box { }
  .sig-label { font-size:8.5pt; color:#374151; font-weight:600; margin-bottom:2mm }
  .sig-line { border-bottom:1px solid #374151; height:15mm; margin-bottom:1.5mm }
  .sig-date { font-size:8pt; color:#9ca3af }
  /* Spacer + footer */
  .spacer { flex:1; min-height:3mm }
  .footer { border-top:1px solid #e5e7eb; padding-top:3mm; display:flex; justify-content:space-between; align-items:center; font-size:7pt; color:#9ca3af; margin-top:auto }
  .footer-brand span { color:#f97316; font-weight:700 }
  @media print {
    body { background:#fff; padding:0 }
    .page { box-shadow:none; margin:0; width:100%; min-height:100vh }
    @page { size:A4; margin:0 }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <img src="${logoUrl}" alt="Logo" class="logo-ecole">
    <div class="header-right">
      <div class="school-name-bold">École Secondaire Plurielle Maritime</div>
      <div class="school-addr">Avenue Jean Dubrucq 175 · 1080 Molenbeek-Saint-Jean</div>
    </div>
  </div>

  <!-- Title -->
  <div class="title-row">
    <h1>${esc(act.intitule)}</h1>
    <span class="type-badge">Demande d'avance</span>
  </div>

  <!-- Identité -->
  <div class="section-title">Coordonnées du membre du personnel</div>
  <div class="id-grid">
    <!-- Col gauche : Nom, Prénom, IBAN, Téléphone -->
    <div class="id-col">
      <div class="id-field">
        <div class="id-label">Nom</div><div class="id-blank"></div>
      </div>
      <div class="id-field">
        <div class="id-label">Prénom</div><div class="id-blank"></div>
      </div>
      <div class="id-field">
        <div class="id-label">IBAN</div><div class="id-blank"></div>
      </div>
      <div class="id-field">
        <div class="id-label">Téléphone</div><div class="id-blank"></div>
      </div>
    </div>
    <!-- Col droite : Adresse (grande zone) -->
    <div class="id-col-right">
      <div class="id-label">Adresse</div>
      <div class="id-blank-tall"></div>
    </div>
  </div>

  <!-- Date de remise -->
  <div class="date-row section-title" style="display:flex; align-items:center; gap:3mm; flex-wrap:wrap">
    <span>Date de la remise de la demande d'avance :</span>
    <span class="date-blank"></span>
  </div>

  <!-- Dépenses avance -->
  <div class="section-title" style="margin-top:5mm">Demande d'avance pour les dépenses suivantes</div>
  <table class="dep-table">
    <thead>
      <tr>
        <th>Intitulé</th>
        <th class="text-right">Montant</th>
        <th>Payé par</th>
      </tr>
    </thead>
    <tbody>
      ${depRows}
    </tbody>
  </table>
  ${avanceDeps.length > 0 ? `
  <div class="dep-total">
    <div class="dep-total-box">Total avance : ${fmt(totalAvance)}</div>
  </div>` : ''}

  <!-- Mention importante -->
  <div class="mention-box">
    ⚠ Les documents justificatifs originaux doivent être remis dès que possible à l'économe.
  </div>

  <!-- Signatures -->
  <div class="spacer"></div>
  <div class="sig-section">
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-label">Signature du membre du personnel</div>
        <div class="sig-line"></div>
        <div class="sig-date">Date : _______________</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Signature pour accord de la direction</div>
        <div class="sig-line"></div>
        <div class="sig-date">Date : _______________</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>École Secondaire Plurielle Maritime — ${esc(SCHOOL_TEL)} — ${esc(SCHOOL_EMAIL)}</span>
    <span class="footer-brand">Document généré par ESPM<span>+</span> le ${today}</span>
  </div>
</div>
</body>
</html>`

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  }
}
