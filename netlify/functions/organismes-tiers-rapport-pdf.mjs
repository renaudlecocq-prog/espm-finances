// organismes-tiers-rapport-pdf.mjs — v1.0
// GET /.netlify/functions/organismes-tiers-rapport-pdf?otId=UUID&token=JWT
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_EMAIL_AS      = process.env.SCHOOL_EMAIL_AS || 'as@espmaritime.be'
const SCHOOL_TEL_AS        = process.env.SCHOOL_TEL_AS   || '02/210.20.91'

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
  const { data:{ user }, error:authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode:403, body:'Non autorisé' }

  const logoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'

  const [{ data:ot }, { data:articles }] = await Promise.all([
    supabase.from('organismes_tiers')
      .select('*, eleve:eleve_id(id,nom,prenom,classe)')
      .eq('id', otId).single(),
    supabase.from('organismes_tiers_articles')
      .select('*').eq('ot_id', otId).order('ordre').order('created_at'),
  ])

  if (!ot) return { statusCode:404, body:'Organisme tiers introuvable' }

  const eleve   = ot.eleve || {}
  const today   = new Date().toLocaleDateString('fr-BE')
  const sc      = STATUT_COLOR[ot.statut] || '#6b7280'
  const sb      = STATUT_BG[ot.statut]   || '#f3f4f6'
  const total   = (articles||[]).reduce((s,a) => s + Number(a.montant), 0)

  const articleRows = (articles||[]).map(a => `
    <tr>
      <td>${esc(a.titre)}</td>
      <td style="text-align:right;font-weight:600">${fmt(a.montant)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Demande organisme tiers — ${esc(eleve.nom)} ${esc(eleve.prenom)}</title>
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
  .page-body { flex:1; }

  .doc-title { font-size:18pt; font-weight:900; color:#2D1B2E; font-family:Arial Black,Arial,sans-serif; }
  .doc-subtitle { font-size:8.5pt; color:#9ca3af; margin-top:1mm; }

  .info-block { border:1px solid #e5e7eb; border-radius:8px; padding:3mm 4mm; margin-bottom:4mm; }
  .info-row { display:flex; gap:4mm; padding:1.5mm 0; border-bottom:1px solid #f9fafb; font-size:9pt; }
  .info-row:last-child { border-bottom:none; }
  .lbl { color:#9ca3af; width:36mm; flex-shrink:0; }
  .val { color:#111827; flex:1; }

  .table-title { font-size:8pt; font-weight:700; color:#6b7280; text-transform:uppercase;
    letter-spacing:.05em; margin-bottom:2mm; margin-top:5mm; }
  table { width:100%; border-collapse:collapse; font-size:9pt; }
  thead th { background:#2D1B2E; color:white; font-size:7.5pt; font-weight:600;
    text-transform:uppercase; letter-spacing:.04em; padding:3px 6px; text-align:left; }
  thead th.r { text-align:right; }
  tbody tr { border-bottom:1px solid #f3f4f6; }
  tbody td { padding:3.5px 6px; color:#374151; }
  .total-row td { font-weight:700; font-size:10pt; color:#2D1B2E; border-top:2px solid #2D1B2E;
    padding-top:4px; }

  .footer { font-size:7pt; color:#bbb; text-align:center; border-top:1px solid #e8e8e8;
    padding:2mm 0 8mm 0; margin-top:4mm; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>

<div class="page">
  <div class="header">
    <img class="logo-ecole" src="${logoUrl}" alt="École Secondaire Plurielle Maritime">
    <div class="header-right">
      <div class="school-name">École Secondaire Plurielle Maritime</div>
      <div class="school-addr">Avenue Jean Dubrucq 175 · 1080 Molenbeek-Saint-Jean</div>
    </div>
  </div>
  <hr class="hr-main">

  <div class="page-body">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:5mm">
      <div>
        <h1 class="doc-title">DEMANDE DE PRISE EN CHARGE</h1>
        <div class="doc-subtitle">Généré le <strong>${today}</strong></div>
      </div>
      <span style="background:${sb};color:${sc};padding:3px 12px;border-radius:20px;font-size:9pt;font-weight:700">
        ${esc(STATUT_LABELS[ot.statut] || ot.statut || '')}
      </span>
    </div>

    <!-- Infos élève + organisme -->
    <div class="info-block">
      <div class="info-row"><span class="lbl">Élève</span><span class="val"><strong>${esc(eleve.nom)} ${esc(eleve.prenom)}</strong></span></div>
      <div class="info-row"><span class="lbl">Classe</span><span class="val">${esc(eleve.classe)}</span></div>
      <div class="info-row"><span class="lbl">Organisme</span><span class="val"><strong>${esc((ot.organisme||'').toUpperCase())}</strong></span></div>
      ${ot.institution ? `<div class="info-row"><span class="lbl">Institution</span><span class="val">${esc(ot.institution)}</span></div>` : ''}
      ${ot.rue ? `<div class="info-row"><span class="lbl">Adresse</span><span class="val">${esc(ot.rue)}</span></div>` : ''}
      ${(ot.code_postal || ot.commune) ? `<div class="info-row"><span class="lbl"></span><span class="val">${esc([ot.code_postal, ot.commune].filter(Boolean).join(' '))}</span></div>` : ''}
      ${ot.notes  ? `<div class="info-row"><span class="lbl">Notes</span><span class="val">${esc(ot.notes)}</span></div>` : ''}
    </div>

    <!-- Articles -->
    <div class="table-title">Articles à charge</div>
    ${articles?.length ? `
    <table>
      <thead>
        <tr>
          <th>Désignation</th>
          <th class="r">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${articleRows}
        <tr class="total-row">
          <td>TOTAL DEMANDÉ</td>
          <td style="text-align:right">${fmt(total)}</td>
        </tr>
      </tbody>
    </table>` : '<p style="color:#9ca3af;font-style:italic;margin-top:4mm">Aucun article renseigné.</p>'}

  </div>

  <!-- Signature -->
  <div style="margin-top:12mm; padding:0 4mm;">
    <p style="font-size:8pt; color:#374151; margin-bottom:8mm;">
      Fait à Molenbeek-Saint-Jean, le ___________________________
    </p>
    <div style="display:flex; justify-content:space-between; gap:16mm;">
      <div style="flex:1; text-align:center;">
        <p style="font-size:7.5pt; color:#374151; font-weight:600; margin-bottom:18mm;">Signature du responsable légal</p>
        <div style="border-top:1px solid #374151; padding-top:2mm;">
          <p style="font-size:7pt; color:#6b7280;">Nom et signature</p>
        </div>
      </div>
      <div style="flex:1; text-align:center;">
        <p style="font-size:7.5pt; color:#374151; font-weight:600; margin-bottom:18mm;">Signature du représentant de l'école</p>
        <div style="border-top:1px solid #374151; padding-top:2mm;">
          <p style="font-size:7pt; color:#6b7280;">Nom et signature</p>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <strong>Jérôme Mignolet</strong>, Assistant social &nbsp;—&nbsp; ${esc(SCHOOL_EMAIL_AS)} · ${esc(SCHOOL_TEL_AS)} &nbsp;|&nbsp; Rapport généré depuis <strong>ESPM<span style="color:#E86C00">+</span></strong>
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
