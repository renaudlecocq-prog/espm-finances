// eleve-notes-pdf.mjs — v1.0
// GET /.netlify/functions/eleve-notes-pdf?eleveId=UUID
// Authorization: Bearer <JWT>
// Génère un PDF A4 avec toutes les notes d'un élève, groupées par catégorie
import { createClient } from '@supabase/supabase-js'

async function getSchoolSettings(supabase) {
  const D = {
    school_nom:           'Ecole',
    school_adresse_rue:   'Rue',
    school_adresse_cp:    '0000',
    school_adresse_ville: 'Ville',
    school_logo_url:      '',
  }
  try {
    const { data } = await supabase.from('app_settings').select('key, value')
    if (data) data.forEach(r => { if (r.value !== null && r.value !== '') D[r.key] = r.value })
  } catch {}
  return D
}

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const esc     = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmtDate = s => s ? new Date(s).toLocaleDateString('fr-BE', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

const CAT_LABELS = { anecdotes_proclamation: 'Anecdotes proclamation' }
const CAT_COLOR  = { anecdotes_proclamation: '#7c3aed' }
const CAT_BG     = { anecdotes_proclamation: '#f5f3ff' }

export const handler = async (event) => {
  const params  = event.queryStringParameters || {}
  const eleveId = params.eleveId
  const token   = (event.headers['authorization'] || '').replace(/^Bearer\s+/i, '')

  if (!token)   return { statusCode: 401, body: 'Token manquant' }
  if (!eleveId) return { statusCode: 400, body: 'eleveId manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode: 403, body: 'Non autorisé' }

  const ss = await getSchoolSettings(supabase)
  const _defaultLogoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'
  const logoUrl = ss.school_logo_url || _defaultLogoUrl

  const [{ data: eleve }, { data: notes }] = await Promise.all([
    supabase.from('eleves').select('id,nom,prenom,classe,photo_url').eq('id', eleveId).single(),
    supabase.from('eleve_notes').select('*').eq('eleve_id', eleveId).order('created_at', { ascending: false }),
  ])

  if (!eleve) return { statusCode: 404, body: 'Élève introuvable' }

  const allNotes = notes || []
  const today    = new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })

  // Grouper par catégorie
  const cats = {}
  for (const n of allNotes) {
    if (!cats[n.categorie]) cats[n.categorie] = []
    cats[n.categorie].push(n)
  }

  const catBlocks = Object.entries(cats).map(([catKey, catNotes]) => {
    const label = CAT_LABELS[catKey] || catKey
    const color = CAT_COLOR[catKey]  || '#6b7280'
    const bg    = CAT_BG[catKey]     || '#f9fafb'

    const rows = catNotes.map(n => `
      <div class="note-card">
        <div class="note-meta">
          <span class="note-auteur">${esc(n.auteur_nom || 'Auteur inconnu')}</span>
          <span class="note-date">${fmtDate(n.created_at)}</span>
        </div>
        ${n.titre ? `<div class="note-titre">${esc(n.titre)}</div>` : ''}
        <div class="note-contenu">${esc(n.contenu).replace(/\n/g, '<br>')}</div>
      </div>`).join('')

    return `
      <div class="cat-section">
        <div class="cat-header" style="background:${bg};border-left:4px solid ${color}">
          <span class="cat-label" style="color:${color}">${esc(label)}</span>
          <span class="cat-count" style="color:${color}">${catNotes.length} note${catNotes.length > 1 ? 's' : ''}</span>
        </div>
        ${rows}
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Notes — ${esc(eleve.nom)} ${esc(eleve.prenom)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif; }
  body { background:#f5f5f5; }
  @media print {
    body { background:white; }
    .print-btn { display:none !important; }
    @page { size:A4 portrait; margin:0; }
    .cat-section { break-inside:avoid; }
    .note-card   { break-inside:avoid; }
  }
  .print-btn {
    position:fixed; top:16px; right:16px; z-index:100;
    background:#2D1B2E; color:white; border:none; border-radius:8px;
    padding:10px 20px; font-size:13px; font-weight:600; cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,.2);
  }
  .page {
    width:210mm; min-height:297mm; display:flex; flex-direction:column;
    padding:12mm 15mm 0 15mm; margin:0 auto; background:white;
  }
  @media screen { .page { box-shadow:0 2px 16px rgba(0,0,0,.12); margin:20px auto; } }

  .header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:5mm; }
  .header-left img.logo-ecole { height:18mm; width:auto; }
  .header-right { text-align:right; }
  .school-name { font-size:11pt; font-weight:700; color:#2D1B2E; }
  .school-addr { font-size:8pt; color:#666; margin-top:2px; }
  .hr-main { border:none; border-top:2.5px solid #2D1B2E; margin:0 0 5mm 0; }

  .report-title { font-size:18pt; font-weight:900; color:#2D1B2E; font-family:Arial Black,Arial,sans-serif; }
  .report-sub   { font-size:8.5pt; color:#9ca3af; margin-top:1mm; }

  .eleve-block {
    display:flex; align-items:center; gap:5mm;
    border:1px solid #e5e7eb; border-radius:8px; padding:3mm 4mm; margin:4mm 0 6mm 0;
  }
  .eleve-photo {
    width:14mm; height:14mm; border-radius:50%; object-fit:cover;
    border:2px solid #2D1B2E; flex-shrink:0;
  }
  .eleve-initials {
    width:14mm; height:14mm; border-radius:50%; background:#2D1B2E; color:white;
    display:flex; align-items:center; justify-content:center;
    font-size:11pt; font-weight:700; flex-shrink:0;
  }
  .eleve-info-nom   { font-size:13pt; font-weight:700; color:#111827; }
  .eleve-info-class { font-size:9pt; color:#6b7280; margin-top:1mm; }
  .eleve-stats      { margin-left:auto; text-align:right; }
  .eleve-stats-val  { font-size:14pt; font-weight:800; color:#2D1B2E; }
  .eleve-stats-lbl  { font-size:7pt; color:#9ca3af; }

  .cat-section { margin-bottom:5mm; }
  .cat-header  {
    display:flex; align-items:center; justify-content:space-between;
    padding:2.5mm 3mm; border-radius:4px; margin-bottom:2mm;
  }
  .cat-label { font-size:8.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
  .cat-count { font-size:8pt; font-weight:600; }

  .note-card    { border:1px solid #e5e7eb; border-radius:6px; padding:3mm 4mm; margin-bottom:2mm; }
  .note-meta    { display:flex; align-items:center; gap:3mm; margin-bottom:1.5mm; }
  .note-auteur  { font-size:8pt; font-weight:600; color:#374151; }
  .note-date    { font-size:7.5pt; color:#9ca3af; }
  .note-titre   { font-size:9pt; font-weight:600; color:#111827; margin-bottom:1mm; }
  .note-contenu { font-size:9pt; color:#374151; line-height:1.5; }

  .empty-state { text-align:center; color:#9ca3af; font-size:10pt; font-style:italic; padding:12mm 0; }

  .footer { display:flex; justify-content:space-between; align-items:center; font-size:7pt; color:#bbb; border-top:1px solid #e8e8e8; padding:2mm 0 8mm 0; margin-top:auto; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>

<div class="page">
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="logo-ecole" src="${logoUrl}" alt="${esc(ss.school_nom)}">` : ''}
    </div>
    <div class="header-right">
      <div class="school-name">${esc(ss.school_nom)}</div>
      <div class="school-addr">${esc(ss.school_adresse_rue)} · ${esc(ss.school_adresse_cp)} ${esc(ss.school_adresse_ville)}</div>
    </div>
  </div>
  <hr class="hr-main">

  <div class="page-body">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:5mm">
      <div>
        <h1 class="report-title">NOTES DE SUIVI</h1>
        <div class="report-sub">Édité le <strong>${today}</strong> — Document confidentiel</div>
      </div>
    </div>

    <div class="eleve-block">
      ${eleve.photo_url
        ? `<img class="eleve-photo" src="${esc(eleve.photo_url)}" alt="${esc(eleve.prenom)}">`
        : `<div class="eleve-initials">${esc(eleve.prenom?.charAt(0) ?? '')}${esc(eleve.nom?.charAt(0) ?? '')}</div>`
      }
      <div>
        <div class="eleve-info-nom">${esc(eleve.nom)} ${esc(eleve.prenom)}</div>
        <div class="eleve-info-class">Classe : <strong>${esc(eleve.classe || '—')}</strong></div>
      </div>
      <div class="eleve-stats">
        <div class="eleve-stats-val">${allNotes.length}</div>
        <div class="eleve-stats-lbl">note${allNotes.length > 1 ? 's' : ''} au total</div>
      </div>
    </div>

    ${allNotes.length === 0
      ? `<div class="empty-state">Aucune note enregistrée pour cet élève.</div>`
      : catBlocks
    }
  </div>

  <div class="footer">
    <span><strong>${esc(ss.school_nom)}</strong> &nbsp;·&nbsp; ${esc(ss.school_tel_general)} &nbsp;·&nbsp; ${esc(ss.school_email_general)}${ss.school_bce ? ` &nbsp;·&nbsp; BCE N°&nbsp;${esc(ss.school_bce)}` : ''}</span>
    <span>Document confidentiel &nbsp;|&nbsp; Généré depuis <strong>ESPM<span style="color:#E86C00">+</span></strong></span>
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
