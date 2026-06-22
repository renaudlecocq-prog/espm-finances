// activites-rapport-pdf.mjs — v1.0
// GET /.netlify/functions/activites-rapport-pdf?token=JWT
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_EMAIL         = process.env.SCHOOL_EMAIL_SCHOOL || 'info@espmaritime.be'
const SCHOOL_TEL           = process.env.SCHOOL_TEL_SCHOOL   || '02/210.20.91'

const esc     = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmt     = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'
const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-BE') : '—'
const fmtTime = s => s ? s.slice(0,5) : '—'

const TYPE_LABELS   = { intramuros:'Intramuros', extramuros:'Extramuros', voyage:'Voyage scolaire' }
const TYPE_COLOR    = { intramuros:'#3b82f6', extramuros:'#f97316', voyage:'#8b5cf6' }
const TYPE_BG       = { intramuros:'#eff6ff', extramuros:'#fff7ed', voyage:'#f5f3ff' }
const TRANSPORT_LBL = { bus_scolaire:'Bus scolaire', train:'Train', a_pied:'À pied', autre:'Autre' }
const MOIS_FR       = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const MOIS_SCOLAIRE = [8,9,10,11,0,1,2,3,4,5,6,7]

export const handler = async (event) => {
  // Token : Authorization header (prioritaire) ou query param (fallback)
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const params     = event.queryStringParameters || {}
  const token      = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (params.token ? decodeURIComponent(params.token) : null)

  if (!token) return { statusCode:401, body:'Token manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data:{ user }, error:authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return {
    statusCode:403,
    body: `Non autorisé${authErr ? ': ' + authErr.message : ''}`,
  }

  const logoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'

  const [activitesRes, profilesRes] = await Promise.all([
    supabase.from('activites').select('*').neq('statut','archive').order('date_debut'),
    supabase.from('profiles').select('id, nom, prenom').order('nom'),
  ])

  const activites = activitesRes.data || []
  const profiles  = profilesRes.data || []
  const byId      = Object.fromEntries(profiles.map(p => [p.id, `${p.prenom||''} ${p.nom||''}`.trim()]))
  const today     = new Date().toLocaleDateString('fr-BE')

  // 1. Par type
  const parType = { intramuros:0, extramuros:0, voyage:0 }
  activites.forEach(a => { if (parType[a.type] !== undefined) parType[a.type]++ })

  // 2. Par responsable
  const parResp = {}
  activites.forEach(a => {
    if (!a.responsable_id) return
    parResp[a.responsable_id] = (parResp[a.responsable_id] || 0) + 1
  })
  const parRespSorted = Object.entries(parResp)
    .map(([id, n]) => ({ nom: byId[id] || id, n }))
    .sort((a,b) => b.n - a.n)

  // 3. Par classe
  const parClasse = {}
  activites.forEach(a => {
    ;(a.classes_incluses || []).forEach(c => { parClasse[c] = (parClasse[c] || 0) + 1 })
  })
  const parClasseSorted = Object.entries(parClasse).sort(([a],[b]) => a.localeCompare(b))

  // 4. Coûts par type
  const coutParType = { intramuros:0, extramuros:0, voyage:0 }
  activites.forEach(a => { if (coutParType[a.type] !== undefined) coutParType[a.type] += Number(a.montant_total||0) })
  const coutTotal = Object.values(coutParType).reduce((s,v)=>s+v,0)

  // 5. Coût moyen par élève (montant - POP / nb_eleves)
  let totalEleves = 0, totalMontantEleves = 0
  activites.forEach(a => {
    const n = Number(a.nb_eleves||0)
    const m = Number(a.montant_total||0)
    const p = Number(a.pop||0)
    if (n > 0) { totalEleves += n; totalMontantEleves += (m - p) }
  })
  const coutMoyenParEleve = totalEleves > 0 ? totalMontantEleves / totalEleves : 0

  // 6. POP par type
  const popParType = { intramuros:0, extramuros:0, voyage:0 }
  activites.forEach(a => { if (popParType[a.type] !== undefined) popParType[a.type] += Number(a.pop||0) })
  const popTotal = Object.values(popParType).reduce((s,v)=>s+v,0)

  // 7. Par mois (ordre scolaire)
  const parMois = {}
  for (let m=0; m<12; m++) parMois[m] = { intramuros:0, extramuros:0, voyage:0 }
  activites.forEach(a => {
    if (!a.date_debut) return
    const m = new Date(a.date_debut+'T00:00:00').getMonth()
    if (parMois[m][a.type] !== undefined) parMois[m][a.type]++
  })
  const moisAvecData = MOIS_SCOLAIRE.filter(m => {
    const d = parMois[m]
    return d.intramuros + d.extramuros + d.voyage > 0
  })

  // SVG chart
  const svgW = 760, svgH = 180, padL = 28, padB = 28, padT = 12, padR = 8
  const chartW = svgW - padL - padR
  const chartH = svgH - padB - padT
  const maxVal = Math.max(1, ...moisAvecData.map(m => parMois[m].intramuros + parMois[m].extramuros + parMois[m].voyage))
  const nMois  = moisAvecData.length || 1
  const grpW   = chartW / nMois
  const barW   = Math.min(16, grpW * 0.22)
  const gap    = 1.5
  const types3 = ['intramuros','extramuros','voyage']

  let bars = '', gridLines = ''
  moisAvecData.forEach((m, idx) => {
    const x0 = padL + idx * grpW + (grpW - 3*barW - 2*gap) / 2
    types3.forEach((t, ti) => {
      const val = parMois[m][t]
      if (!val) return
      const bh = Math.max(2, (val / maxVal) * chartH)
      const bx = x0 + ti*(barW+gap)
      const by = padT + chartH - bh
      bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" fill="${TYPE_COLOR[t]}" rx="2"/>`
      if (val > 0) bars += `<text x="${(bx+barW/2).toFixed(1)}" y="${(by-3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${TYPE_COLOR[t]}" font-weight="600">${val}</text>`
    })
    const lx = padL + idx * grpW + grpW/2
    bars += `<text x="${lx.toFixed(1)}" y="${svgH-6}" text-anchor="middle" font-size="9" fill="#6b7280">${MOIS_FR[m]}</text>`
  })
  const ySteps = Math.min(maxVal, 4)
  for (let i=1; i<=ySteps; i++) {
    const y = padT + chartH - (i/ySteps)*chartH
    const v = Math.round((i/ySteps)*maxVal)
    gridLines += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${svgW-padR}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`
    gridLines += `<text x="${padL-4}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#9ca3af">${v}</text>`
  }
  const svgChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:auto">
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+chartH}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${padL}" y1="${padT+chartH}" x2="${svgW-padR}" y2="${padT+chartH}" stroke="#d1d5db" stroke-width="1"/>
  ${gridLines}${bars}
</svg>`

  // Activités groupées
  const typeOrder = ['intramuros','extramuros','voyage']
  let actListHtml = ''
  for (const type of typeOrder) {
    const list = activites.filter(a => a.type === type).sort((a,b) => (a.date_debut||'').localeCompare(b.date_debut||''))
    if (!list.length) continue
    const rows = list.map(a => {
      const responsable   = byId[a.responsable_id] || '—'
      const accompagnants = (a.accompagnateur_ids||[]).map(id => byId[id]||'?').join(', ') || '—'
      const classes       = (a.classes_incluses||[]).join(', ') || '—'
      const nb            = Number(a.nb_eleves||0)
      const total         = Number(a.montant_total||0)
      const pop           = Number(a.pop||0)
      const parEleve      = nb > 0 ? (total - pop) / nb : 0
      let heures = '—'
      if (type === 'intramuros') {
        heures = a.heure_debut && a.heure_fin ? `${fmtTime(a.heure_debut)} – ${fmtTime(a.heure_fin)}` : '—'
      } else {
        heures = a.heure_depart && a.heure_retour ? `${fmtTime(a.heure_depart)} – ${fmtTime(a.heure_retour)}` : '—'
      }
      let dateLabel = fmtDate(a.date_debut)
      if (a.date_fin && a.date_fin !== a.date_debut) dateLabel += '<br>' + fmtDate(a.date_fin)
      return `<tr>
        <td><strong>${esc(a.intitule)}</strong></td>
        <td class="c">${dateLabel}</td>
        <td class="c">${esc(heures)}</td>
        <td>${esc(classes)}</td>
        <td>${esc(responsable)}</td>
        <td>${esc(accompagnants)}</td>
        <td class="r">${total > 0 ? fmt(total) : '—'}</td>
        <td class="r">${parEleve > 0 ? fmt(parEleve) : '—'}</td>
        <td class="r">${pop > 0 ? fmt(pop) : '—'}</td>
        <td class="c">${type !== 'intramuros' ? esc(TRANSPORT_LBL[a.type_transport]||a.type_transport||'—') : '—'}</td>
      </tr>`
    }).join('')
    actListHtml += `
    <div class="type-section" style="--tc:${TYPE_COLOR[type]};--tb:${TYPE_BG[type]}">
      <h3 class="type-header">${esc(TYPE_LABELS[type])} <span class="type-count">${list.length} activité${list.length>1?'s':''}</span></h3>
      <table class="act-table">
        <thead><tr>
          <th>Activité</th><th>Date</th><th>Heures</th><th>Classes / Groupes</th>
          <th>Responsable</th><th>Accompagnants</th>
          <th>Prix total</th><th>Prix/élève</th><th>POP</th><th>Transport</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport des activités</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif}
  body{background:#f5f5f5}
  @media print{
    body{background:white}
    .print-btn{display:none!important}
    @page{size:A4 landscape;margin:12mm 15mm 15mm 15mm}
    .page{box-shadow:none!important;margin:0!important;padding:0!important;min-height:unset;width:100%!important}
  }
  @media screen{.page{box-shadow:0 2px 16px rgba(0,0,0,.12);margin:20px auto}}
  .print-btn{position:fixed;top:16px;right:16px;z-index:100;background:#2D1B2E;color:white;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer}
  .page{width:297mm;min-height:210mm;display:flex;flex-direction:column;padding:12mm 15mm 8mm 15mm;margin:0 auto;background:white}
  .header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:4mm}
  .logo-ecole{height:15mm;width:auto}
  .header-right{text-align:right}
  .school-name{font-size:10.5pt;font-weight:700;color:#2D1B2E}
  .school-addr{font-size:8pt;color:#666;margin-top:2px}
  .hr-main{border:none;border-top:2.5px solid #2D1B2E;margin:0 0 4mm 0}
  .doc-title{font-size:18pt;font-weight:900;color:#2D1B2E;font-family:Arial Black,Arial,sans-serif}
  .doc-meta{font-size:8pt;color:#9ca3af;margin-top:1mm;margin-bottom:5mm}
  .stats-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;margin-bottom:5mm}
  .stat-card{border:1px solid #e5e7eb;border-radius:6px;padding:3.5mm}
  .stat-title{font-size:7.5pt;font-weight:700;color:#2D1B2E;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2.5mm}
  .stat-table{width:100%;border-collapse:collapse;font-size:8pt}
  .stat-table td{padding:1.5mm 2mm;border-bottom:1px solid #f3f4f6}
  .stat-table td:last-child{text-align:right;font-weight:600}
  .stat-table tr:last-child td{border-bottom:none;font-weight:700}
  .stat-pill{display:inline-block;padding:1px 6px;border-radius:99px;font-size:7.5pt;font-weight:700}
  .big-stat{text-align:center;padding:5mm 0}
  .big-stat .val{font-size:20pt;font-weight:900;color:#2D1B2E}
  .big-stat .lbl{font-size:7.5pt;color:#9ca3af;margin-top:1.5mm}
  .chart-card{border:1px solid #e5e7eb;border-radius:6px;padding:3.5mm;margin-bottom:5mm}
  .chart-title{font-size:7.5pt;font-weight:700;color:#2D1B2E;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2mm}
  .legend{display:flex;gap:8mm;margin-bottom:2mm}
  .legend-item{display:flex;align-items:center;gap:2mm;font-size:8pt;color:#374151}
  .legend-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0}
  .type-section{margin-bottom:6mm}
  .type-header{font-size:9.5pt;font-weight:700;color:var(--tc);background:var(--tb);padding:2mm 4mm;border-radius:4px 4px 0 0;border-left:4px solid var(--tc);display:flex;align-items:center;gap:3mm}
  .type-count{font-size:8pt;font-weight:500;color:#6b7280}
  .act-table{width:100%;border-collapse:collapse;font-size:7.5pt}
  .act-table thead tr{background:#f9fafb}
  .act-table th{padding:2mm 2.5mm;text-align:left;font-size:7pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;border-bottom:1.5px solid #e5e7eb;white-space:nowrap}
  .act-table td{padding:2mm 2.5mm;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .act-table tr:last-child td{border-bottom:none}
  .act-table .r{text-align:right;white-space:nowrap}
  .act-table .c{text-align:center;white-space:nowrap}
  .footer{margin-top:auto;padding-top:4mm;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
<div class="page">
  <div class="header">
    <img src="${logoUrl}" alt="Logo" class="logo-ecole"/>
    <div class="header-right">
      <div class="school-name">École Secondaire Plurielle Maritime</div>
      <div class="school-addr">Avenue Jean Dubrucq 175 · 1080 Molenbeek-Saint-Jean</div>
      <div class="school-addr">${esc(SCHOOL_TEL)} — ${esc(SCHOOL_EMAIL)}</div>
    </div>
  </div>
  <hr class="hr-main"/>
  <div class="doc-title">Rapport des Activités</div>
  <div class="doc-meta">Généré le ${today} · ${activites.length} activité${activites.length!==1?'s':''} (hors archives)</div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-title">Activités par type</div>
      <table class="stat-table">
        ${Object.entries(TYPE_LABELS).map(([t,l])=>`<tr><td><span class="stat-pill" style="background:${TYPE_BG[t]};color:${TYPE_COLOR[t]}">${l}</span></td><td>${parType[t]}</td></tr>`).join('')}
        <tr><td>Total</td><td>${activites.length}</td></tr>
      </table>
    </div>
    <div class="stat-card">
      <div class="stat-title">Activités par responsable</div>
      <table class="stat-table">
        ${parRespSorted.map(r=>`<tr><td>${esc(r.nom)}</td><td>${r.n}</td></tr>`).join('')}
      </table>
    </div>
    <div class="stat-card">
      <div class="stat-title">Activités par classe</div>
      <table class="stat-table">
        ${parClasseSorted.map(([c,n])=>`<tr><td>${esc(c)}</td><td>${n}</td></tr>`).join('')}
      </table>
    </div>
    <div class="stat-card">
      <div class="stat-title">Coût total par type</div>
      <table class="stat-table">
        ${Object.entries(TYPE_LABELS).map(([t,l])=>`<tr><td><span class="stat-pill" style="background:${TYPE_BG[t]};color:${TYPE_COLOR[t]}">${l}</span></td><td>${fmt(coutParType[t])}</td></tr>`).join('')}
        <tr><td>Total</td><td>${fmt(coutTotal)}</td></tr>
      </table>
    </div>
    <div class="stat-card">
      <div class="stat-title">Intervention POP par type</div>
      <table class="stat-table">
        ${Object.entries(TYPE_LABELS).map(([t,l])=>`<tr><td><span class="stat-pill" style="background:${TYPE_BG[t]};color:${TYPE_COLOR[t]}">${l}</span></td><td>${fmt(popParType[t])}</td></tr>`).join('')}
        <tr><td>Total POP</td><td>${fmt(popTotal)}</td></tr>
      </table>
    </div>
    <div class="stat-card">
      <div class="big-stat">
        <div class="val">${fmt(coutMoyenParEleve)}</div>
        <div class="lbl">Coût moyen par élève</div>
        <div class="lbl" style="margin-top:3mm;font-size:7pt">(montant total – POP) ÷ nb élèves</div>
      </div>
    </div>
  </div>

  <div class="chart-card">
    <div class="chart-title">Nombre d'activités par mois</div>
    <div class="legend">
      <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>Intramuros</div>
      <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div>Extramuros</div>
      <div class="legend-item"><div class="legend-dot" style="background:#8b5cf6"></div>Voyage scolaire</div>
    </div>
    ${moisAvecData.length === 0
      ? '<p style="font-size:8pt;color:#9ca3af;padding:8mm 0;text-align:center">Aucune activité avec date enregistrée</p>'
      : svgChart}
  </div>

  ${actListHtml || '<p style="font-size:9pt;color:#9ca3af;text-align:center;padding:8mm 0">Aucune activité enregistrée.</p>'}

  <div class="footer">
    <span>École Secondaire Plurielle Maritime — ${esc(SCHOOL_TEL)} — ${esc(SCHOOL_EMAIL)}</span>
    <span>Rapport généré par ESPM<span style="color:#f97316;font-weight:700">+</span> le ${today}</span>
  </div>
</div>
</body>
</html>`

  return {
    statusCode: 200,
    headers: { 'Content-Type':'text/html; charset=utf-8' },
    body: html,
  }
}
