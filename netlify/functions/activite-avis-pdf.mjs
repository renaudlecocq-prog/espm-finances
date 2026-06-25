// activite-avis-pdf.mjs — v1.0
// GET /.netlify/functions/activite-avis-pdf?id=UUID&token=JWT
// Génère un avis parental pour une activité intramuros ou extramuros
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
  const ss = await getSchoolSettings(supabase)
  const { data:{ user }, error:authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode:403, body:'Non autorisé' }

  const _defaultLogoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'
  const logoUrl = ss.school_logo_url || _defaultLogoUrl

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
    // Détails transport (gares, PMR, etc.) intentionnellement omis de l'avis parents
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
  .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10mm; padding-bottom:6mm; border-bottom:1.5px solid #e5e7eb }
  .logo-ecole { height:16mm; width:auto; display:block }
  .header-right { text-align:right }
  .school-name-bold { font-size:11pt; font-weight:700; color:#1a1a2e; margin-bottom:1.5mm }
  .school-addr { font-size:8pt; color:#888; line-height:1.5 }
  /* Type + Titre inline */
  .title-row { display:flex; align-items:baseline; gap:3mm; margin-bottom:2mm }
  .type-badge {
    display:inline-block;
    background:${typeBg};
    color:${typeColor};
    border:1px solid ${typeColor}40;
    border-radius:5px;
    font-size:7.5pt; font-weight:700;
    padding:1mm 3mm;
    text-transform:uppercase; letter-spacing:.4px;
    white-space:nowrap;
    flex-shrink:0;
  }
  h1 { font-size:16pt; font-weight:800; color:#1a1a2e; line-height:1.2; margin:0 }
  .date-line { font-size:9pt; color:#888; margin-bottom:6mm }
  /* Salutation + description */
  .salutation { font-size:10.5pt; color:#374151; margin-bottom:3mm; font-family:'Helvetica Neue',Arial,sans-serif }
  .description { font-size:10.5pt; color:#374151; line-height:1.6; margin-bottom:7mm; white-space:pre-wrap; font-family:'Helvetica Neue',Arial,sans-serif }
  /* Infos supplémentaires */
  .infos-sup { font-size:9.5pt; color:#374151; line-height:1.6; margin-bottom:6mm; white-space:pre-wrap; background:#f9fafb; border-left:3px solid #e5e7eb; padding:2.5mm 4mm; border-radius:0 4px 4px 0 }
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
  .footer { border-top:1px solid #e5e7eb; padding-top:3mm; display:flex; justify-content:space-between; align-items:center; font-size:7pt; color:#9ca3af }
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
      <div class="school-name-bold">${ss.school_nom}</div>
      <div class="school-addr">${ss.school_adresse_rue} · ${ss.school_adresse_cp} ${ss.school_adresse_ville}</div>
    </div>
  </div>

  <!-- Type badge + Titre inline -->
  <div class="title-row">
    <h1>${esc(act.intitule)}</h1>
    <span class="type-badge">${esc(typeLabel)}</span>
  </div>
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

  ${act.informations_supplementaires ? `
  <!-- Informations supplémentaires -->
  <div class="section-title">Informations supplémentaires</div>
  <div class="infos-sup">${esc(act.informations_supplementaires)}</div>` : ''}

  <!-- Question -->
  <div class="question-box">
    Pour toute question, veuillez vous adresser par Smartschool à l'éducateur.trice de votre enfant.
  </div>

  <div class="spacer"></div>

  <!-- Footer -->
  <div class="footer">
    <span>${ss.school_nom} — ${esc(ss.school_tel_general)} — ${esc(ss.school_email_general)}</span>
    <span class="footer-brand">Document généré par ESPM<span>+</span> le ${today}</span>
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
