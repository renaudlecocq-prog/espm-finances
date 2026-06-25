// activite-voyage-rapport-pdf.mjs — v2.0
// GET /.netlify/functions/activite-voyage-rapport-pdf?id=UUID
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

const CAT_LABELS = {
  activite:'Activité', hebergement:'Hébergement', nourriture:'Nourriture',
  transport:'Transport', urgences:'Urgences', autres:'Autres',
}

export const handler = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
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

  const [{ data:act }, { data:depenses }, { data:absents }, { data:profiles }] = await Promise.all([
    supabase.from('activites').select('*').eq('id', id).single(),
    supabase.from('activite_depenses').select('*').eq('activite_id', id).order('categorie').order('ordre').order('created_at'),
    supabase.from('activite_absents').select('eleve_id').eq('activite_id', id),
    supabase.from('profiles').select('id, nom, prenom'),
  ])
  if (!act) return { statusCode:404, body:'Activité introuvable' }

  const byId = Object.fromEntries((profiles||[]).map(p => [p.id, `${p.prenom||''} ${p.nom||''}`.trim()]))
  const today = new Date().toLocaleDateString('fr-BE')
  const deps = depenses || []
  const absCount = (absents || []).length
  const nbEleves = Number(act.nb_eleves || 0)
  const nbPresents = Math.max(0, nbEleves - absCount)

  const typeColor = '#8b5cf6'
  const typeBg    = '#f5f3ff'

  const responsable  = byId[act.responsable_id] || '—'
  const accomps      = (act.accompagnateur_ids || []).map(i => byId[i]||i).filter(Boolean)

  const montantTotal   = deps.reduce((s,d) => s + parseFloat(d.montant_total||0), 0)
  const montantIncomp  = deps.filter(d=>d.incompressible).reduce((s,d)=>s+parseFloat(d.montant_total||0),0)
  const parEleveReel   = nbEleves > 0 ? montantTotal / nbEleves : 0
  const parEleveAbsent = nbEleves > 0 ? montantIncomp / nbEleves : 0
  const mpeAnnonce     = parseFloat(act.montant_par_eleve_annonce || 0)

  // Grouper dépenses par catégorie
  const catOrder = ['activite','hebergement','nourriture','transport','urgences','autres']
  const grouped = {}
  deps.forEach(d => {
    const cat = d.categorie || 'autres'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(d)
  })
  const sortedCats = catOrder.filter(c => grouped[c])
    .concat(Object.keys(grouped).filter(c => !catOrder.includes(c)))

  let depRows = ''
  if (deps.length === 0) {
    depRows = `<tr><td colspan="5" class="empty">Aucune dépense enregistrée</td></tr>`
  } else {
    sortedCats.forEach(cat => {
      const catDeps  = grouped[cat]
      const catTotal = catDeps.reduce((s,d) => s + parseFloat(d.montant_total||0), 0)
      const catMpe   = nbEleves > 0 ? catTotal / nbEleves : 0
      const catLabel = CAT_LABELS[cat] || cat

      depRows += `<tr class="cat-header"><td colspan="5">${esc(catLabel)}</td></tr>`
      catDeps.forEach(d => {
        const effNb = d.nb_eleves_override != null ? d.nb_eleves_override
          : (d.incompressible ? nbEleves : nbPresents)
        const mpe = effNb > 0 ? parseFloat(d.montant_total||0)/effNb : 0
        const badges = []
        if (d.incompressible) badges.push('<span class="badge-incomp">Incompressible</span>')
        if (d.avance) badges.push('<span class="badge-avance">Avance</span>')
        depRows += `<tr>
      <td class="dep-intitule">${esc(d.intitule||'—')}${badges.length?' &nbsp;'+badges.join(' '):''}</td>
      <td class="text-right">${fmt(d.montant_total)}</td>
      <td class="text-right">${effNb} élèves</td>
      <td class="text-right">${mpe>0?mpe.toFixed(2)+' €':'—'}</td>
      <td>${esc(d.paye_par||'—')}</td>
    </tr>`
      })
      depRows += `<tr class="cat-subtotal">
      <td>Sous-total ${esc(catLabel)}</td>
      <td class="text-right">${fmt(catTotal)}</td>
      <td></td>
      <td class="text-right">${nbEleves>0?catMpe.toFixed(2)+' €':'—'}</td>
      <td></td>
    </tr>`
    })
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport voyage — ${esc(act.intitule)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif }
  body { background:#f5f5f5; padding:0 }
  .page {
    background:#fff; width:210mm; min-height:297mm;
    margin:10mm auto; padding:20mm 22mm 18mm 22mm;
    display:flex; flex-direction:column;
    box-shadow:0 2px 16px rgba(0,0,0,.12);
  }
  .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10mm; padding-bottom:6mm; border-bottom:1.5px solid #e5e7eb }
  .logo-ecole { height:16mm; width:auto }
  .header-right { text-align:right }
  .school-name-bold { font-size:11pt; font-weight:700; color:#1a1a2e; margin-bottom:1.5mm }
  .school-addr { font-size:8pt; color:#888; line-height:1.5 }
  .title-row { display:flex; align-items:center; gap:4mm; margin-bottom:2mm; flex-wrap:wrap }
  h1 { font-size:15pt; font-weight:800; color:#1a1a2e; line-height:1.2; flex:1 }
  .type-badge { display:inline-block; background:${typeBg}; color:${typeColor}; border:1px solid ${typeColor}40; border-radius:5px; font-size:7.5pt; font-weight:700; padding:1mm 3mm; text-transform:uppercase; letter-spacing:.4px; white-space:nowrap; flex-shrink:0 }
  .date-line { font-size:9pt; color:#888; margin-bottom:6mm }
  .section-title { font-size:8pt; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#6b7280; margin-bottom:2mm; margin-top:5mm; padding-bottom:1mm; border-bottom:1px solid #f3f4f6 }
  .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:3mm; margin-bottom:5mm }
  .kpi-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:3mm; text-align:center }
  .kpi-label { font-size:7.5pt; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.4px; margin-bottom:1mm }
  .kpi-value { font-size:13pt; font-weight:800; color:#111827 }
  .kpi-value.purple { color:#7c3aed }
  .kpi-value.amber  { color:#b45309 }
  .info-table { width:100%; border-collapse:collapse; margin-bottom:4mm }
  .info-table th, .info-table td { padding:2mm 3mm; text-align:left; font-size:9pt; border-bottom:1px solid #f0f0f0 }
  .info-table th { width:45mm; color:#6b7280; font-weight:600; white-space:nowrap }
  .info-table td { color:#111827 }
  .dep-table { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:4mm }
  .dep-table th { background:#f5f3ff; padding:2.5mm 3mm; text-align:left; font-weight:700; color:#374151; border-bottom:2px solid #c4b5fd; white-space:nowrap }
  .dep-table td { padding:2.5mm 3mm; border-bottom:1px solid #f0f0f0; color:#111827; vertical-align:middle }
  .dep-table .text-right { text-align:right; white-space:nowrap }
  .dep-table .empty { text-align:center; color:#9ca3af; font-style:italic }
  .dep-table tr.cat-header td { background:#f5f3ff; color:${typeColor}; font-weight:700; font-size:8pt; text-transform:uppercase; letter-spacing:.5px; padding:2mm 3mm; border-top:2px solid #c4b5fd; border-bottom:1px solid #c4b5fd }
  .dep-table tr.cat-subtotal td { background:#fafafa; font-weight:700; font-size:8pt; color:#374151; border-top:1px dashed #d1d5db; border-bottom:2px solid #e5e7eb; font-style:italic }
  .badge-incomp { display:inline-block; background:#dcfce7; color:#15803d; border-radius:3px; font-size:7pt; padding:0.5mm 2mm; font-weight:700 }
  .badge-avance { display:inline-block; background:#dbeafe; color:#1d4ed8; border-radius:3px; font-size:7pt; padding:0.5mm 2mm; font-weight:700 }
  .totals-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; margin-bottom:5mm }
  .total-box { border-radius:6px; border:1px solid; padding:3mm 4mm; text-align:center }
  .total-box.main  { background:#f5f3ff; border-color:#c4b5fd }
  .total-box.green { background:#f0fdf4; border-color:#86efac }
  .total-box.amber { background:#fffbeb; border-color:#fcd34d }
  .total-label { font-size:7.5pt; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:.4px; margin-bottom:1mm }
  .total-value { font-size:12pt; font-weight:800 }
  .total-box.main  .total-value { color:#5b21b6 }
  .total-box.green .total-value { color:#15803d }
  .total-box.amber .total-value { color:#b45309 }
  .spacer { flex:1 }
  .footer { border-top:1px solid #e5e7eb; padding-top:3mm; display:flex; justify-content:space-between; align-items:center; font-size:7pt; color:#9ca3af; margin-top:4mm }
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

  <div class="header">
    <img src="${logoUrl}" alt="Logo" class="logo-ecole">
    <div class="header-right">
      <div class="school-name-bold">${ss.school_nom}</div>
      <div class="school-addr">${ss.school_adresse_rue}</div>
    </div>
  </div>

  <div class="title-row">
    <h1>${esc(act.intitule)}</h1>
    <span class="type-badge">Rapport — Voyage scolaire</span>
  </div>
  <div class="date-line">
    ${fmtDate(act.date_debut)}${act.date_fin && act.date_fin !== act.date_debut ? ` au ${fmtDate(act.date_fin)}` : ''}
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="kpi-label">Élèves</div>
      <div class="kpi-value">${nbEleves}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Absents</div>
      <div class="kpi-value amber">${absCount}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Montant annoncé / élève</div>
      <div class="kpi-value purple">${mpeAnnonce > 0 ? fmt(mpeAnnonce) : '—'}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Lieu</div>
      <div class="kpi-value" style="font-size:9pt">${esc(act.lieu||'—')}</div>
    </div>
  </div>

  <div class="section-title">Informations</div>
  <table class="info-table">
    <tr><th>Responsable</th><td>${esc(responsable)}</td></tr>
    ${accomps.length > 0 ? `<tr><th>Accompagnants</th><td>${accomps.map(a=>esc(a)).join(', ')}</td></tr>` : ''}
    <tr><th>Départ — Retour</th><td>${fmtDate(act.date_debut)} — ${fmtDate(act.date_fin)}</td></tr>

  </table>

  <div class="section-title">Détail des dépenses</div>
  <table class="dep-table">
    <thead>
      <tr>
        <th>Intitulé</th>
        <th class="text-right">Montant</th>
        <th class="text-right">Nb élèves</th>
        <th class="text-right">Par élève</th>
        <th>Payé par</th>
      </tr>
    </thead>
    <tbody>${depRows}</tbody>
  </table>

  <div class="totals-grid">
    <div class="total-box main">
      <div class="total-label">Montant total réel</div>
      <div class="total-value">${fmt(montantTotal)}</div>
    </div>
    <div class="total-box green">
      <div class="total-label">Facturé aux élèves présents</div>
      <div class="total-value">${fmt(parEleveReel)}</div>
    </div>
    <div class="total-box amber">
      <div class="total-label">Facturé aux élèves absents</div>
      <div class="total-value">${absCount > 0 ? fmt(parEleveAbsent) : '—'}</div>
    </div>
  </div>

  <div class="spacer"></div>
  <div class="footer">
    <span>${ss.school_nom} — ${esc(ss.school_tel_general)} — ${esc(ss.school_email_general)}</span>
    <span class="footer-brand">Document généré par ESPM<span>+</span> le ${today}</span>
  </div>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  }
}
