// echelonnements-rapport-pdf.mjs — v2.0
// GET /.netlify/functions/echelonnements-rapport-pdf?statut=en_cours&token=JWT
// Une page A4 par plan, avec echeances individuelles + total payé + retard
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_EMAIL_ECO     = process.env.SCHOOL_EMAIL_ECO || 'economat@espmaritime.be'
const SCHOOL_TEL_ECO       = process.env.SCHOOL_TEL_ECO  || '02/210.20.96'
const SCHOOL_BCE           = process.env.SCHOOL_BCE       || ''

const esc     = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmt     = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'
const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-BE') : '—'

const STATUT_LABELS = { en_cours:'En cours', attente:'En attente', non_respecte:'Non respecté', termine:'Terminé' }
const STATUT_COLOR  = { en_cours:'#1d4ed8', attente:'#92400e', non_respecte:'#b91c1c', termine:'#15803d' }
const STATUT_BG     = { en_cours:'#dbeafe', attente:'#fef3c7', non_respecte:'#fee2e2', termine:'#dcfce7' }

function computeAlertStatus(ech, echeances, paiements) {
  const today = new Date(); today.setHours(0,0,0,0)
  if (!echeances?.length) return { type:'no_echeances' }
  const startDate = new Date((ech.date_debut || '') + 'T00:00:00')
  if (startDate > today) return { type:'not_started' }
  const totalPaid = (paiements||[])
    .filter(p => new Date(p.date+'T00:00:00') >= startDate)
    .reduce((s,p) => s + Number(p.montant), 0)
  let totalExpected = 0
  for (const e of echeances)
    if (new Date(e.date_echeance+'T00:00:00') <= today) totalExpected += Number(e.montant_prevu)
  if (totalExpected === 0) return { type:'upcoming', totalPaid }
  const retard = Math.max(0, totalExpected - totalPaid)
  return retard < 0.01
    ? { type:'ok', totalPaid, totalExpected }
    : { type:'late', retard, totalPaid, totalExpected }
}

export const handler = async (event) => {
  const params = event.queryStringParameters || {}
  const token  = params.token
  const statut = params.statut || null

  if (!token) return { statusCode:401, body:'Token manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data:{ user }, error:authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode:403, body:'Non autorisé' }

  // Logo
  let logoUrl = ''
  try {
    const __dir = dirname(fileURLToPath(import.meta.url))
    const buf = readFileSync(join(__dir,'../../public/logo-ecole.png'))
    logoUrl = 'data:image/png;base64,' + buf.toString('base64')
  } catch {}

  // Données
  let echQ = supabase.from('echelonnements')
    .select('*, eleve:eleve_id(id,nom,prenom,classe)')
    .order('eleve(nom)')
  if (statut) echQ = echQ.eq('statut', statut)

  const [{ data:echs }, { data:echData }, { data:paies }] = await Promise.all([
    echQ,
    supabase.from('echeances').select('*').order('numero_mois'),
    supabase.from('paiements').select('id,date,montant,eleve_id').order('date'),
  ])

  // Maps
  const eMap = {}
  for (const e of (echData||[])) {
    if (!eMap[e.echelonnement_id]) eMap[e.echelonnement_id] = []
    eMap[e.echelonnement_id].push(e)
  }
  const pMap = {}
  for (const p of (paies||[])) {
    if (!pMap[p.eleve_id]) pMap[p.eleve_id] = []
    pMap[p.eleve_id].push(p)
  }

  const today = new Date().toLocaleDateString('fr-BE')
  const statutLabel = statut ? (STATUT_LABELS[statut]||statut) : 'Tous statuts'
  const rows = echs || []

  // Génération des pages
  const pages = rows.map((ech, idx) => {
    const eleve    = ech.eleve || {}
    const echAnces = eMap[ech.id] || []
    const paiments = pMap[eleve.id] || []
    const alert    = computeAlertStatus(ech, echAnces, paiments)

    const totalPrevu = echAnces.reduce((s,e) => s+Number(e.montant_prevu), 0)
    const startDate  = ech.date_debut ? new Date(ech.date_debut+'T00:00:00') : null
    const totalPaid  = startDate
      ? paiments.filter(p => new Date(p.date+'T00:00:00') >= startDate).reduce((s,p)=>s+Number(p.montant),0)
      : 0
    const retardAmt  = alert.retard || 0

    // Couleur statut
    const sc = STATUT_COLOR[ech.statut] || '#6b7280'
    const sb = STATUT_BG[ech.statut]   || '#f3f4f6'

    // Tableau des échéances
    const nowTs = Date.now()
    let cumul = 0
    const echRows = echAnces
      .slice().sort((a,b) => a.numero_mois - b.numero_mois)
      .map(e => {
        const dueTs  = new Date(e.date_echeance+'T00:00:00').getTime()
        const isPast = dueTs <= nowTs
        const prevCumul = cumul
        cumul += Number(e.montant_prevu)
        const paidForThis = Math.min(Number(e.montant_prevu), Math.max(0, totalPaid - prevCumul))
        const isLate = isPast && paidForThis < Number(e.montant_prevu) - 0.01

        let statutIcon, statutCls
        if (!isPast)         { statutIcon='⏰'; statutCls='color:#6b7280' }
        else if (isLate)     { statutIcon='⚠'; statutCls='color:#b91c1c;font-weight:600' }
        else                 { statutIcon='✓'; statutCls='color:#15803d;font-weight:600' }

        return `<tr>
          <td style="text-align:center;color:#9ca3af;font-size:8pt">M${e.numero_mois}</td>
          <td>${fmtDate(e.date_echeance)}</td>
          <td style="text-align:right;font-weight:600">${fmt(e.montant_prevu)}</td>
          <td style="text-align:center;${statutCls}">${statutIcon} ${isPast ? (isLate ? 'En retard' : 'Payé') : 'À venir'}</td>
        </tr>`
      }).join('')

    const isLast = idx === rows.length - 1
    return `
<div class="page" style="${isLast ? '' : 'page-break-after:always'}">
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
    <!-- Titre + badge statut -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:5mm">
      <div>
        <h1 class="plan-title">PLAN D'ÉCHELONNEMENT</h1>
        <div class="plan-subtitle">Édité le <strong>${today}</strong></div>
      </div>
      <span style="background:${sb};color:${sc};padding:3px 12px;border-radius:20px;font-size:9pt;font-weight:700">
        ${esc(STATUT_LABELS[ech.statut]||ech.statut)}
      </span>
    </div>

    <!-- Info élève -->
    <div class="info-block">
      <div class="info-row"><span class="lbl">Élève</span><span class="val"><strong>${esc(eleve.nom)} ${esc(eleve.prenom)}</strong></span></div>
      <div class="info-row"><span class="lbl">Classe</span><span class="val">${esc(eleve.classe||'—')}</span></div>
      <div class="info-row"><span class="lbl">Début</span><span class="val">${fmtDate(ech.date_debut)}</span></div>
      <div class="info-row"><span class="lbl">Fin estimée</span><span class="val">${echAnces.length ? fmtDate(echAnces[echAnces.length-1].date_echeance) : '—'}</span></div>
      <div class="info-row"><span class="lbl">Nbre d'échéances</span><span class="val">${esc(ech.nombre_echeances||'—')}</span></div>
      ${ech.remarque ? `<div class="info-row"><span class="lbl">Remarque</span><span class="val" style="font-style:italic;color:#6b7280">${esc(ech.remarque)}</span></div>` : ''}
    </div>

    <!-- Cards financières -->
    <div class="cards">
      <div class="card-item">
        <div class="card-val">${fmt(totalPrevu)}</div>
        <div class="card-lbl">Total prévu</div>
      </div>
      <div class="card-item">
        <div class="card-val" style="color:#15803d">${fmt(totalPaid)}</div>
        <div class="card-lbl">Total payé</div>
      </div>
      <div class="card-item">
        <div class="card-val" style="color:${retardAmt > 0 ? '#b91c1c' : '#15803d'}">${retardAmt > 0 ? '-' : ''}${fmt(retardAmt)}</div>
        <div class="card-lbl">Retard</div>
      </div>
      <div class="card-item">
        <div class="card-val" style="color:#6b7280">${fmt(Math.max(0, totalPrevu - totalPaid))}</div>
        <div class="card-lbl">Solde restant</div>
      </div>
    </div>

    <!-- Tableau des échéances -->
    ${echAnces.length ? `
    <div class="table-title">Suivi des échéances</div>
    <table>
      <thead>
        <tr>
          <th class="c">#</th>
          <th>Date</th>
          <th class="r">Montant prévu</th>
          <th class="c">Statut</th>
        </tr>
      </thead>
      <tbody>${echRows}</tbody>
    </table>` : '<p style="color:#9ca3af;font-style:italic;margin-top:4mm">Aucune échéance enregistrée.</p>'}
  </div>

  <div class="footer">
    École Secondaire Plurielle Maritime — ASBL${SCHOOL_BCE ? ` — BCE N° ${esc(SCHOOL_BCE)}` : ''} — Avenue Jean Dubrucq 175, 1080 Molenbeek-Saint-Jean — ${esc(SCHOOL_EMAIL_ECO)} · ${esc(SCHOOL_TEL_ECO)} &nbsp;|&nbsp; Rapport édité depuis <strong>ESPM<span style="color:#E86C00">+</span></strong>
  </div>
</div>`
  }).join('\n')

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
    @page { size:A4 portrait; margin:0; }
  }
  .print-btn {
    position:fixed; top:16px; right:16px; z-index:100;
    background:#2D1B2E; color:white; border:none; border-radius:8px;
    padding:10px 20px; font-size:13px; font-weight:600; cursor:pointer;
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

  .page-body { flex:1; }

  .plan-title { font-size:18pt; font-weight:900; color:#2D1B2E; font-family:Arial Black,Arial,sans-serif; }
  .plan-subtitle { font-size:8.5pt; color:#9ca3af; margin-top:1mm; }

  .info-block { border:1px solid #e5e7eb; border-radius:8px; padding:3mm 4mm; margin-bottom:4mm; }
  .info-row { display:flex; gap:4mm; padding:1.5mm 0; border-bottom:1px solid #f9fafb; font-size:9pt; }
  .info-row:last-child { border-bottom:none; }
  .lbl { color:#9ca3af; width:36mm; shrink:0; }
  .val { color:#111827; flex:1; }

  .cards { display:flex; gap:3mm; margin-bottom:5mm; }
  .card-item { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:3mm 4mm; text-align:center; }
  .card-val { font-size:12pt; font-weight:800; color:#2D1B2E; }
  .card-lbl { font-size:7pt; color:#9ca3af; margin-top:1mm; }

  .table-title { font-size:8pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; margin-bottom:2mm; }
  table { width:100%; border-collapse:collapse; font-size:9pt; }
  thead th { background:#2D1B2E; color:white; font-size:7.5pt; font-weight:600;
    text-transform:uppercase; letter-spacing:.04em; padding:3px 6px; text-align:left; }
  thead th.r { text-align:right; }
  thead th.c { text-align:center; }
  tbody tr { border-bottom:1px solid #f3f4f6; }
  tbody td { padding:3.5px 6px; color:#374151; }

  .footer { font-size:7pt; color:#bbb; text-align:center; border-top:1px solid #e8e8e8; padding:2mm 0 8mm 0; margin-top:4mm; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF — ${rows.length} plan${rows.length!==1?'s':''}</button>

${rows.length === 0
  ? `<div class="page"><div style="text-align:center;padding:30mm 0;color:#9ca3af;font-size:11pt">Aucun plan d'échelonnement pour ce filtre.</div></div>`
  : pages}
</body>
</html>`

  return {
    statusCode: 200,
    headers: { 'Content-Type':'text/html; charset=utf-8' },
    body: html,
  }
}
