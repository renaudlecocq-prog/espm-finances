// echelonnements-rapport-pdf.mjs — v1.0
// GET /.netlify/functions/echelonnements-rapport-pdf?statut=en_cours&token=JWT
// Génère un rapport HTML/PDF A4 des échelonnements
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const SUPABASE_URL           = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_IBAN            = process.env.SCHOOL_IBAN || 'BE17 0910 2167 8721'
const SCHOOL_EMAIL_ECO       = process.env.SCHOOL_EMAIL_ECO || 'economat@espmaritime.be'
const SCHOOL_TEL_ECO         = process.env.SCHOOL_TEL_ECO || '02/210.20.96'
const SCHOOL_BCE             = process.env.SCHOOL_BCE || ''

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmt = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_LABELS = { en_cours: 'En cours', non_respecte: 'Non respecté', termine: 'Terminé' }
const STATUT_COLORS = { en_cours: '#1d4ed8', non_respecte: '#b91c1c', termine: '#15803d' }
const STATUT_BG    = { en_cours: '#dbeafe', non_respecte: '#fee2e2', termine: '#dcfce7' }

const addMonths = (dateStr, n) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('fr-BE')
}

export const handler = async (event) => {
  const params  = event.queryStringParameters || {}
  const token   = params.token
  const statut  = params.statut || null  // null = tous

  if (!token) return { statusCode: 401, body: 'Token manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode: 403, body: 'Non autorisé' }

  // Récupérer logo
  let logoUrl = ''
  try {
    const __dir = dirname(fileURLToPath(import.meta.url))
    const logoPath = join(__dir, '../../public/logo-ecole.png')
    const logoData = readFileSync(logoPath)
    logoUrl = 'data:image/png;base64,' + logoData.toString('base64')
  } catch {}

  // Requête échelonnements
  let query = supabase
    .from('echelonnements')
    .select('*, eleve:eleve_id(nom,prenom,classe)')
    .order('statut')
    .order('eleve(nom)')

  if (statut) query = query.eq('statut', statut)

  const { data: rows, error: dbErr } = await query
  if (dbErr) return { statusCode: 500, body: dbErr.message }

  const today = new Date().toLocaleDateString('fr-BE')
  const statutLabel = statut ? STATUT_LABELS[statut] || statut : 'Tous statuts'

  // Totaux
  const total = rows.reduce((s, r) => s + Number(r.montant || 0), 0)
  const nbEnCours     = rows.filter(r => r.statut === 'en_cours').length
  const nbNonRespecte = rows.filter(r => r.statut === 'non_respecte').length
  const nbTermine     = rows.filter(r => r.statut === 'termine').length

  // Grouper par statut pour affichage
  const ORDER = ['en_cours', 'non_respecte', 'termine']
  const grouped = {}
  for (const r of rows) {
    const s = r.statut || 'en_cours'
    if (!grouped[s]) grouped[s] = []
    grouped[s].push(r)
  }

  // Génération des lignes de tableau
  const genRows = (list) => list.map(r => {
    const eleve = r.eleve || {}
    const mensualite = r.montant && r.nombre_echeances ? Number(r.montant) / Number(r.nombre_echeances) : null
    const dateFin = r.date_debut && r.nombre_echeances ? addMonths(r.date_debut, Number(r.nombre_echeances)) : '—'
    const statColor = STATUT_COLORS[r.statut] || '#6b7280'
    const statBg    = STATUT_BG[r.statut]    || '#f3f4f6'
    return `
      <tr>
        <td><strong>${esc(eleve.nom)}</strong> ${esc(eleve.prenom)}</td>
        <td>${esc(eleve.classe || '—')}</td>
        <td style="text-align:center">
          <span style="background:${statBg};color:${statColor};padding:1.5px 7px;border-radius:20px;font-size:7.5pt;font-weight:600;white-space:nowrap">
            ${esc(STATUT_LABELS[r.statut] || r.statut)}
          </span>
        </td>
        <td style="text-align:right;font-weight:600">${fmt(r.montant)}</td>
        <td style="text-align:center">${esc(r.nombre_echeances || '—')}</td>
        <td style="text-align:right;color:#6b7280">${mensualite !== null ? fmt(mensualite) : '—'}</td>
        <td style="text-align:center">${fmtDate(r.date_debut)}</td>
        <td style="text-align:center;color:#6b7280">${dateFin}</td>
        <td style="font-size:7.5pt;color:#6b7280;max-width:80px">${esc(r.remarque || '')}</td>
      </tr>`
  }).join('')

  const genSection = (statutKey, list) => `
    <tr class="section-header">
      <td colspan="9" style="background:${STATUT_BG[statutKey]};color:${STATUT_COLORS[statutKey]};
          font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px">
        ${esc(STATUT_LABELS[statutKey] || statutKey)} — ${list.length} plan${list.length > 1 ? 's' : ''}
        &nbsp;·&nbsp; Total : ${fmt(list.reduce((s,r)=>s+Number(r.montant||0),0))}
      </td>
    </tr>
    ${genRows(list)}`

  // Si filtré par statut unique : table plate, sinon : sections groupées
  let tableBody = ''
  if (statut && rows.length > 0) {
    tableBody = genRows(rows)
  } else {
    tableBody = ORDER.filter(s => grouped[s]?.length).map(s => genSection(s, grouped[s])).join('')
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport échelonnements — ${today}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif; }
  body { background:#f5f5f5; }
  @media print {
    body { background:white; }
    .print-btn { display:none !important; }
    @page { size:A4 landscape; margin:12mm 10mm; }
  }

  /* Bouton impression */
  .print-btn {
    position:fixed; top:16px; right:16px; z-index:100;
    background:#2D1B2E; color:white; border:none; border-radius:8px;
    padding:10px 20px; font-size:13px; font-weight:600; cursor:pointer;
  }

  .page {
    width:297mm; min-height:210mm;
    display:flex; flex-direction:column;
    padding:10mm 12mm 0 12mm;
    margin:0 auto;
    background:white;
  }
  @media screen { .page { box-shadow:0 2px 16px rgba(0,0,0,.12); margin:20px auto; } }

  /* HEADER */
  .header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:5mm; }
  .header-left img.logo-ecole { height:18mm; width:auto; }
  .header-right { text-align:right; }
  .school-name { font-size:12pt; font-weight:700; color:#2D1B2E; }
  .school-addr { font-size:8pt; color:#666; margin-top:2px; line-height:1.5; }
  .hr-main { border:none; border-top:2.5px solid #2D1B2E; margin:0 0 5mm 0; }

  /* TITLE */
  .report-title { margin-bottom:5mm; }
  .report-title h1 { font-size:16pt; font-weight:900; color:#2D1B2E; letter-spacing:.02em; font-family:Arial Black,Arial,sans-serif; }
  .report-title .subtitle { font-size:9pt; color:#666; margin-top:1mm; }

  /* SUMMARY CARDS */
  .summary { display:flex; gap:4mm; margin-bottom:6mm; }
  .sum-card { flex:1; border:1px solid #e5e7eb; border-radius:6px; padding:3mm 4mm; }
  .sum-card .sum-val { font-size:14pt; font-weight:800; color:#2D1B2E; }
  .sum-card .sum-lbl { font-size:7.5pt; color:#9ca3af; margin-top:0.5mm; }

  /* TABLE */
  .page-body { flex:1; }
  table { width:100%; border-collapse:collapse; font-size:8pt; }
  thead th {
    background:#2D1B2E; color:white; font-size:7.5pt; font-weight:600;
    text-transform:uppercase; letter-spacing:.04em;
    padding:4px 6px; text-align:left;
  }
  thead th.r { text-align:right; }
  thead th.c { text-align:center; }
  tbody tr { border-bottom:1px solid #f3f4f6; }
  tbody tr:hover { background:#fafafa; }
  tbody td { padding:4px 6px; vertical-align:top; color:#374151; }
  .section-header td { border-bottom:none !important; }

  /* FOOTER */
  .footer { font-size:7pt; color:#bbb; text-align:center; border-top:1px solid #e8e8e8; padding:2mm 0 8mm 0; margin-top:4mm; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF — ${rows.length} plan${rows.length !== 1 ? 's' : ''}</button>

<div class="page">
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="logo-ecole" src="${logoUrl}" alt="École Secondaire Plurielle Maritime">` : ''}
    </div>
    <div class="header-right">
      <div class="school-name">École Secondaire Plurielle Maritime</div>
      <div class="school-addr">Avenue Jean Dubrucq 175 · 1080 Molenbeek-Saint-Jean</div>
    </div>
  </div>

  <hr class="hr-main">

  <div class="page-body">
    <div class="report-title">
      <h1>RAPPORT D'ÉCHELONNEMENT</h1>
      <div class="subtitle">
        Édité le <strong>${today}</strong>
        &nbsp;·&nbsp; Filtre : <strong>${esc(statutLabel)}</strong>
        &nbsp;·&nbsp; ${rows.length} plan${rows.length !== 1 ? 's' : ''} — Montant total : <strong>${fmt(total)}</strong>
      </div>
    </div>

    <div class="summary">
      <div class="sum-card">
        <div class="sum-val" style="color:#1d4ed8">${nbEnCours}</div>
        <div class="sum-lbl">En cours</div>
      </div>
      <div class="sum-card">
        <div class="sum-val" style="color:#b91c1c">${nbNonRespecte}</div>
        <div class="sum-lbl">Non respecté${nbNonRespecte > 1 ? 's' : ''}</div>
      </div>
      <div class="sum-card">
        <div class="sum-val" style="color:#15803d">${nbTermine}</div>
        <div class="sum-lbl">Terminé${nbTermine > 1 ? 's' : ''}</div>
      </div>
      <div class="sum-card" style="flex:2">
        <div class="sum-val">${fmt(total)}</div>
        <div class="sum-lbl">Montant total planifié</div>
      </div>
    </div>

    ${rows.length === 0
      ? `<div style="text-align:center;color:#9ca3af;padding:20mm 0;font-size:10pt">Aucun échelonnement trouvé pour ce filtre.</div>`
      : `<table>
        <thead>
          <tr>
            <th>Élève</th>
            <th>Classe</th>
            <th class="c">Statut</th>
            <th class="r">Montant</th>
            <th class="c">Échéances</th>
            <th class="r">Mensualité</th>
            <th class="c">Début</th>
            <th class="c">Fin estimée</th>
            <th>Remarque</th>
          </tr>
        </thead>
        <tbody>
          ${tableBody}
        </tbody>
      </table>`
    }
  </div>

  <div class="footer">
    École Secondaire Plurielle Maritime — ASBL${SCHOOL_BCE ? ` — BCE N° ${esc(SCHOOL_BCE)}` : ''} — Avenue Jean Dubrucq 175, 1080 Molenbeek-Saint-Jean — ${esc(SCHOOL_EMAIL_ECO)} · ${esc(SCHOOL_TEL_ECO)} &nbsp;|&nbsp; Rapport édité depuis <strong>ESPM<span style="color:#E86C00">+</span></strong>
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
