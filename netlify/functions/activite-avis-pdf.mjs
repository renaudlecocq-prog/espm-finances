// activite-avis-pdf.mjs — v1.0
// GET /.netlify/functions/activite-avis-pdf?id=UUID&token=JWT
// Génère un avis parental pour une activité intramuros ou extramuros
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_EMAIL         = process.env.SCHOOL_EMAIL_SCHOOL || 'info@espmaritime.be'
const SCHOOL_TEL           = process.env.SCHOOL_TEL_SCHOOL   || '02/210.20.91'

const esc     = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-BE') : '—'
const fmtTime = s => s ? String(s).slice(0,5) : '—'
const fmt     = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'

const TRANSPORT_LABELS = {
  stib:        'STIB',
  sncb:        'SNCB',
  de_lijn:     'De Lijn',
  tec:         'TEC',
  flixbus:     'Flixbus',
  societe_car: 'Société de car',
  a_pied:      'À pied',
  autre:       'Autre',
  bus_scolaire:'Bus scolaire',
  train:       'Train',
}

function parseTransportStr(str) {
  if (!str) return { labels: [], autre: '' }
  const labels = []; let autre = ''
  for (const p of str.split(',').map(s => s.trim()).filter(Boolean)) {
    if (p.startsWith('autre:')) { labels.push('Autre : ' + p.slice(6)); autre = p.slice(6) }
    else labels.push(TRANSPORT_LABELS[p] || p)
  }
  return { labels: [...new Set(labels)], autre }
}

export const handler = async (event) => {
  const authHeader = (event.headers?.authorization || event.headers?.Authorization || '')
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

  const [{ data:act }, { data:profiles }] = await Promise.all([
    supabase.from('activites').select('*').eq('id', id).single(),
    supabase.from('profiles').select('id, nom, prenom'),
  ])
  if (!act) return { statusCode:404, body:'Activité introuvable' }

  const byId = Object.fromEntries((profiles||[]).map(p => [p.id, `${p.prenom||''} ${p.nom||''}`.trim()]))
  const today = new Date().toLocaleDateString('fr-BE')

  const typeLabel = act.type === 'intramuros' ? 'Intramuros' : act.type === 'extramuros' ? 'Extramuros' : 'Voyage scolaire'
  const typeColor = act.type === 'intramuros' ? '#3b82f6' : act.type === 'extramuros' ? '#f97316' : '#8b5cf6'
  const typeBg    = act.type === 'intramuros' ? '#eff6ff' : act.type === 'extramuros' ? '#fff7ed' : '#f5f3ff'

  const responsableNom  = byId[act.responsable_id] || '—'
  const accompagnants   = (act.accompagnateur_ids || []).map(id => byId[id] || id).filter(Boolean)

  const { labels: transportLabels } = parseTransportStr(act.type_transport || '')

  // Heures selon type
  let heuresHtml = ''
  if (act.type === 'intramuros') {
    heuresHtml = `<tr><th>Heures</th><td>${fmtTime(act.heure_debut)} – ${fmtTime(act.heure_fin)}</td></tr>`
  } else {
    heuresHtml = `
      <tr><th>Heure de départ</th><td>${fmtTime(act.heure_depart)}</td></tr>
      <tr><th>Heure de retour</th><td>${fmtTime(act.heure_retour)}</td></tr>`
  }

  // Date
  let dateHtml = fmtDate(act.date_debut)
  if (act.date_fin && act.date_fin !== act.date_debut) dateHtml += ` au ${fmtDate(act.date_fin)}`

  // Montant par élève
  const nbEleves = Number(act.nb_eleves || 0)
  const total    = Number(act.montant_total || 0)
  const pop      = Number(act.pop || 0)
  const parEleve = nbEleves > 0 ? (total - pop) / nbEleves : null

  // Lieu de RDV / retour (extramuros)
  let lieuRows = ''
  if (act.type !== 'intramuros') {
    if (act.lieu_rdv) lieuRows += `<tr><th>Lieu de rendez-vous</th><td>${esc(act.lieu_rdv)}</td></tr>`
    if (act.lieu_retour) lieuRows += `<tr><th>Lieu de retour</th><td>${esc(act.lieu_retour)}</td></tr>`
  }

  // Transport
  let transportRows = ''
  if (transportLabels.length > 0 && act.type !== 'intramuros') {
    transportRows = `<tr><th>Transport</th><td>${transportLabels.map(l => esc(l)).join(', ')}</td></tr>`
    // Détails SNCB / TEC / Flixbus
    const tList = (act.type_transport || '').split(',').map(s => s.trim())
    const hasSncb    = tList.some(t => t === 'sncb')
    const hasTec     = tList.some(t => t === 'tec')
    const hasFlixbus = tList.some(t => t === 'flixbus')
    if ((hasSncb || hasTec || hasFlixbus) && act.gare_depart) {
      transportRows += `<tr><th>Gare de départ</th><td>${esc(act.gare_depart)}</td></tr>`
    }
    if ((hasSncb || hasTec || hasFlixbus) && act.gare_arrivee) {
      transportRows += `<tr><th>Gare d'arrivée</th><td>${esc(act.gare_arrivee)}</td></tr>`
    }
    if ((hasSncb || hasTec || hasFlixbus) && act.heure_depart_retour) {
      transportRows += `<tr><th>Heure départ (retour)</th><td>${fmtTime(act.heure_depart_retour)}</td></tr>`
    }
    if (hasSncb && act.pmr) {
      transportRows += `<tr><th>Accessibilité PMR</th><td>${esc(act.pmr)}</td></tr>`
    }
    if (hasTec && act.ligne_tec) {
      transportRows += `<tr><th>Ligne TEC</th><td>${esc(act.ligne_tec)}</td></tr>`
    }
  }

  // Montant
  let montantRow = ''
  if (parEleve !== null && parEleve > 0) {
    montantRow = `<tr><th>Montant par élève</th><td><strong>${fmt(parEleve)}</strong></td></tr>`
  } else if (parEleve === 0 && total > 0) {
    montantRow = `<tr><th>Montant par élève</th><td>Gratuit</td></tr>`
  }

  // Accompagnants
  const accompHtml = accompagnants.length > 0
    ? accompagnants.map(n => esc(n)).join(', ')
    : '—'

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Avis — ${esc(act.intitule)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif }
  body { background:#f5f5f5; padding:0 }
  .page {
    background:#fff;
    width:210mm; min-height:297mm;
    margin:10mm auto;
    padding:20mm 22mm 18mm 22mm;
    display:flex; flex-direction:column;
    box-shadow:0 2px 16px rgba(0,0,0,.12);
  }
  /* Header */
  .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:10mm; padding-bottom:6mm; border-bottom:2px solid #e5e7eb }
  .header-left { display:flex; align-items:center; gap:4mm }
  .logo-ecole { height:14mm; width:auto }
  .school-name { font-size:10pt; font-weight:700; color:#2D1B2E }
  .school-addr { font-size:7.5pt; color:#666; margin-top:1mm; line-height:1.5 }
  .header-right { text-align:right; font-size:7.5pt; color:#888 }
  /* Badge type */
  .type-badge {
    display:inline-block;
    background:${typeBg};
    color:${typeColor};
    border:1px solid ${typeColor}40;
    border-radius:6px;
    font-size:8pt; font-weight:700;
    padding:1.5mm 4mm;
    text-transform:uppercase; letter-spacing:.5px;
    margin-bottom:4mm;
  }
  /* Titre */
  h1 { font-size:18pt; font-weight:800; color:#1a1a2e; margin-bottom:2mm; line-height:1.2 }
  .date-line { font-size:9pt; color:#888; margin-bottom:6mm }
  /* Salutation + description */
  .salutation { font-size:10.5pt; color:#374151; margin-bottom:3mm }
  .description { font-size:10pt; color:#374151; line-height:1.6; margin-bottom:7mm; white-space:pre-wrap }
  /* Tableau infos pratiques */
  .section-title { font-size:8pt; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#6b7280; margin-bottom:2mm }
  .info-table { width:100%; border-collapse:collapse; margin-bottom:6mm }
  .info-table th, .info-table td { padding:2mm 3mm; text-align:left; font-size:9.5pt; border-bottom:1px solid #f0f0f0 }
  .info-table th { width:45mm; color:#6b7280; font-weight:600; white-space:nowrap }
  .info-table td { color:#111827 }
  .info-table tr:last-child th, .info-table tr:last-child td { border-bottom:none }
  /* Staff */
  .staff-section { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:3.5mm 4mm; margin-bottom:7mm }
  .staff-row { display:flex; gap:8mm; font-size:9.5pt }
  .staff-item { flex:1 }
  .staff-label { font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#9ca3af; margin-bottom:1mm }
  .staff-value { color:#111827; font-weight:600 }
  /* Question */
  .question-box { background:#f0f9ff; border-left:3px solid #3b82f6; padding:3mm 4mm; font-size:9pt; color:#1e40af; margin-bottom:6mm; line-height:1.5 }
  /* Spacer + footer */
  .spacer { flex:1 }
  .footer { border-top:1px solid #e5e7eb; padding-top:3mm; display:flex; justify-content:space-between; font-size:7pt; color:#9ca3af }
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
    <div class="header-left">
      <img src="${logoUrl}" alt="Logo" class="logo-ecole">
      <div>
        <div class="school-name">École Secondaire Plurielle Maritime</div>
        <div class="school-addr">Avenue Jean Dubrucq 175 · 1080 Molenbeek-Saint-Jean<br>${esc(SCHOOL_TEL)} — ${esc(SCHOOL_EMAIL)}</div>
      </div>
    </div>
    <div class="header-right">
      Généré le ${today}
    </div>
  </div>

  <!-- Type badge + Titre -->
  <div class="type-badge">${esc(typeLabel)}</div>
  <h1>${esc(act.intitule)}</h1>
  <div class="date-line">${dateHtml}</div>

  <!-- Salutation + description -->
  <p class="salutation">Chers parents, chers responsables,</p>
  ${act.description ? `<p class="description">${esc(act.description)}</p>` : ''}

  <!-- Informations pratiques -->
  <div class="section-title">Informations pratiques</div>
  <table class="info-table">
    ${act.lieu ? `<tr><th>Lieu</th><td>${esc(act.lieu)}</td></tr>` : ''}
    ${heuresHtml}
    ${lieuRows}
    ${transportRows}
    ${montantRow}
  </table>

  <!-- Staff -->
  <div class="staff-section">
    <div class="staff-row">
      <div class="staff-item">
        <div class="staff-label">Responsable</div>
        <div class="staff-value">${esc(responsableNom)}</div>
      </div>
      ${accompagnants.length > 0 ? `<div class="staff-item">
        <div class="staff-label">Accompagnant${accompagnants.length > 1 ? 's' : ''}</div>
        <div class="staff-value">${accompHtml}</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Question -->
  <div class="question-box">
    Pour toute question, veuillez vous adresser par Smartschool à l'éducateur.trice de votre enfant.
  </div>

  <div class="spacer"></div>

  <!-- Footer -->
  <div class="footer">
    <span>École Secondaire Plurielle Maritime — ${esc(SCHOOL_TEL)} — ${esc(SCHOOL_EMAIL)}</span>
    <span>Avis généré le ${today}</span>
  </div>
</div>
<script>
  window.onload = () => window.print()
</script>
</body>
</html>`

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  }
}
