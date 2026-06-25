// econome-bilan-pdf.mjs — v2.0
// GET /.netlify/functions/econome-bilan-pdf?annee=2025&token=SUPABASE_JWT

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHOOL_EMAIL  = process.env.SCHOOL_EMAIL_ECO   || 'economat@espmaritime.be'
const SCHOOL_TEL    = process.env.SCHOOL_TEL_ECO     || '02/210.20.96'

const esc    = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmtEur = v => Number(v || 0).toLocaleString('fr-BE', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €'
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('fr-BE', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'

const MOIS_LABELS = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url   = new URL(req.url)
  const annee = parseInt(url.searchParams.get('annee') || new Date().getFullYear())
  const token = url.searchParams.get('token')
  if (!token) return new Response('Non autorisé', { status: 401 })

  const supa = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await supa.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorisé', { status: 401 })

  const logoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'

  // ── Charger natures, transactions et POP ────────────────────────────────
  const [{ data: natures }, { data: txs }, { data: pop }] = await Promise.all([
    supa.from('comptable_natures').select('*').order('libelle'),
    supa.from('comptable_transactions')
      .select('date_operation, nature_id, nature_libelle, montant_entree, montant_sortie')
      .gte('date_operation', `${annee}-01-01`)
      .lte('date_operation', `${annee}-12-31`),
    supa.from('comptable_pop_lignes')
      .select('date_transmission, nature_id, nature_libelle, montant')
      .eq('annee', annee),
  ])

  // ── Agréger par nature × mois (même logique que BilanTab) ───────────────
  const natMap = {}
  for (const n of (natures || [])) natMap[n.id] = n

  const agg = {}
  let nonClasses = 0

  const ensureNature = (natId, natLib) => {
    if (!agg[natId]) {
      const nat = natMap[natId]
      agg[natId] = {
        id: natId,
        libelle: nat?.libelle || natLib || natId,
        categorie: nat?.categorie || '—',
        type_flux: nat?.type_flux || 'neutre',
        in_couverture: nat?.in_couverture || false,
        mois: Array(13).fill(0),
      }
    }
    return agg[natId]
  }

  for (const tx of (txs || [])) {
    if (!tx.nature_id) { nonClasses++; continue }
    const nat = natMap[tx.nature_id]
    if (!nat || nat.type_flux === 'neutre') continue
    const m = parseInt((tx.date_operation || '').split('-')[1]) || 0
    if (m < 1 || m > 12) continue
    const entry = ensureNature(tx.nature_id, tx.nature_libelle)
    if (nat.type_flux === 'produit') entry.mois[m] += Number(tx.montant_entree || 0)
    else                              entry.mois[m] += Number(tx.montant_sortie || 0)
  }
  for (const pl of (pop || [])) {
    if (!pl.nature_id) { nonClasses++; continue }
    const nat = natMap[pl.nature_id]
    if (!nat || nat.type_flux === 'neutre') continue
    const m = parseInt((pl.date_transmission || '').split('-')[1]) || 0
    if (m < 1 || m > 12) continue
    const entry = ensureNature(pl.nature_id, pl.nature_libelle)
    entry.mois[m] += Number(pl.montant || 0)
  }
  for (const e of Object.values(agg)) {
    e.total = e.mois.slice(1).reduce((s, v) => s + v, 0)
  }

  const sortFn = arr => arr.sort((a, b) =>
    (a.categorie||'').localeCompare(b.categorie||'') || (a.libelle||'').localeCompare(b.libelle||'')
  )

  const produitsNatures   = sortFn(Object.values(agg).filter(e => e.type_flux === 'produit'))
  const chargesNatures    = sortFn(Object.values(agg).filter(e => e.type_flux === 'charge'))
  const couvertureNatures = sortFn(Object.values(agg).filter(e => e.type_flux === 'charge' && e.in_couverture))

  // Mois actifs
  const moisActifs = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter(m => Object.values(agg).some(e => e.mois[m] !== 0))

  function getTotalNat(e) { return moisActifs.reduce((s, m) => s + (e.mois[m] || 0), 0) }

  function groupByCat(nats) {
    const cats = {}
    for (const n of nats) {
      const c = n.categorie || 'Sans catégorie'
      if (!cats[c]) cats[c] = []
      cats[c].push(n)
    }
    return cats
  }

  const totalProduitsAnnee = produitsNatures.reduce((s, n) => s + getTotalNat(n), 0)
  const totalChargesAnnee  = chargesNatures.reduce((s, n) => s + getTotalNat(n), 0)
  const totalCouvrAnnee    = couvertureNatures.reduce((s, n) => s + getTotalNat(n), 0)
  const soldeGeneral = totalProduitsAnnee - totalChargesAnnee
  const soldeCouv    = totalProduitsAnnee - totalCouvrAnnee

  const txCount = (txs||[]).length + (pop||[]).length
  const today   = fmtDate(new Date().toISOString().split('T')[0])

  const moisTh = moisActifs.map(m => `<th>${MOIS_LABELS[m]}</th>`).join('')

  // ── Rendu d'une section avec numéros de lignes ──────────────────────────
  let lineCounter = [0]  // mutable via array pour closure

  function renderSection(title, cats, colorClass, bgColor) {
    if (!Object.keys(cats).length) return ''
    let html = `
    <tr class="section-hdr" style="background:${bgColor}">
      <td colspan="${moisActifs.length + 3}"> ${esc(title)}</td>
    </tr>`
    let sectionTotal = 0
    for (const [cat, nats] of Object.entries(cats)) {
      const catTotal = nats.reduce((s, n) => s + getTotalNat(n), 0)
      sectionTotal += catTotal
      html += `<tr class="cat-hdr" style="page-break-inside:avoid">
        <td></td>
        <td colspan="1" class="cat-label">${esc(cat)}</td>
        ${moisActifs.map(m => {
          const v = nats.reduce((s,n) => s + (n.mois[m]||0), 0)
          return `<td>${v ? fmtEur(v) : '—'}</td>`
        }).join('')}
        <td class="${colorClass}">${fmtEur(catTotal)}</td>
      </tr>`
      for (const n of nats) {
        const tot = getTotalNat(n)
        if (!tot) continue
        lineCounter[0]++
        html += `<tr class="nat-row">
          <td class="ln">${lineCounter[0]}</td>
          <td class="nat-label">${esc(n.libelle)}</td>
          ${moisActifs.map(m => `<td>${n.mois[m] ? fmtEur(n.mois[m]) : ''}</td>`).join('')}
          <td class="tot">${fmtEur(tot)}</td>
        </tr>`
      }
    }
    html += `<tr class="subtot">
      <td></td><td>TOTAL ${esc(title)}</td>
      ${moisActifs.map(m => {
        const v = Object.values(cats).flat().reduce((s, n) => s + (n.mois[m]||0), 0)
        return `<td>${v ? fmtEur(v) : '—'}</td>`
      }).join('')}
      <td class="${colorClass} bold">${fmtEur(sectionTotal)}</td>
    </tr>`
    return html
  }

  // ── Tableau Vue générale ─────────────────────────────────────────────────
  lineCounter[0] = 0
  const genTable = `
  <table>
    <thead>
      <tr>
        <th class="th-ln">#</th>
        <th style="width:220px;text-align:left">Nature / Catégorie</th>
        ${moisTh}
        <th style="width:85px">Total ${annee}</th>
      </tr>
    </thead>
    <tbody>
      ${renderSection('PRODUITS', groupByCat(produitsNatures), 'text-green', '#f0fdf4')}
      ${renderSection('CHARGES',  groupByCat(chargesNatures),  'text-red',   '#fef2f2')}
      <tr class="solde-row">
        <td></td><td>SOLDE ${annee}</td>
        ${moisActifs.map(m => {
          const p = produitsNatures.reduce((s,n) => s+(n.mois[m]||0), 0)
          const c = chargesNatures.reduce((s,n) => s+(n.mois[m]||0), 0)
          const s = p-c
          return `<td class="${s>=0?'text-green':'text-red'}">${s!==0?(s>0?'+':'−')+fmtEur(Math.abs(s)):'—'}</td>`
        }).join('')}
        <td class="${soldeGeneral>=0?'text-green':'text-red'} bold">${soldeGeneral>=0?'+':'−'}${fmtEur(Math.abs(soldeGeneral))}</td>
      </tr>
    </tbody>
  </table>`

  // ── Tableau Couverture élèves ────────────────────────────────────────────
  lineCounter[0] = 0
  const couvrTable = `
  <table>
    <thead>
      <tr>
        <th class="th-ln">#</th>
        <th style="width:220px;text-align:left">Nature / Catégorie</th>
        ${moisTh}
        <th style="width:85px">Total ${annee}</th>
      </tr>
    </thead>
    <tbody>
      ${renderSection('DÉPENSES ÉLÈVES', groupByCat(couvertureNatures), 'text-red',   '#fef2f2')}
      ${renderSection('ENCAISSEMENTS',   groupByCat(produitsNatures),   'text-green', '#f0fdf4')}
      <tr class="solde-row">
        <td></td><td>SOLDE COUVERTURE</td>
        ${moisActifs.map(m => {
          const enc = produitsNatures.reduce((s,n) => s+(n.mois[m]||0), 0)
          const dep = couvertureNatures.reduce((s,n) => s+(n.mois[m]||0), 0)
          const s = enc-dep
          return `<td class="${s>=0?'text-green':'text-red'}">${s!==0?(s>0?'+':'−')+fmtEur(Math.abs(s)):'—'}</td>`
        }).join('')}
        <td class="${soldeCouv>=0?'text-green':'text-red'} bold">${soldeCouv>=0?'+':'−'}${fmtEur(Math.abs(soldeCouv))}</td>
      </tr>
    </tbody>
  </table>`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bilan Économe ${annee}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a;background:#f5f5f5}
  @media print{
    body{background:white}
    .print-btn{display:none!important}
    @page{size:A4 landscape;margin:12mm 15mm 15mm 15mm}
    .page{box-shadow:none!important;margin:0!important;padding:0!important;min-height:unset;width:100%!important}
    .page-break{page-break-before:always}
    .no-break{page-break-inside:avoid}
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
  .cards{display:flex;gap:10px;margin-bottom:5mm}
  .card{flex:1;border-radius:6px;padding:3mm 4mm}
  .card-r{background:#fef2f2;border:1px solid #fecaca}
  .card-g{background:#f0fdf4;border:1px solid #bbf7d0}
  .card-b{background:#eff6ff;border:1px solid #bfdbfe}
  .card-a{background:#f5f3ff;border:1px solid #ddd6fe}
  .cl{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  .card-r .cl{color:#ef4444}.card-g .cl{color:#22c55e}.card-b .cl{color:#3b82f6}.card-a .cl{color:#7c3aed}
  .ca{font-size:13pt;font-weight:700}
  .card-r .ca{color:#dc2626}.card-g .ca{color:#16a34a}.card-b .ca{color:#2563eb}.card-a .ca{color:#7c3aed}
  h2{font-size:10.5pt;font-weight:700;margin:5mm 0 2.5mm;padding:3px 8px;
     background:#f1f5f9;border-left:3px solid #6366f1;border-radius:3px}
  table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:4mm}
  th{background:#f8fafc;text-align:right;padding:3px 5px;font-weight:600;
     border-bottom:2px solid #e2e8f0;color:#64748b;white-space:nowrap;font-size:8pt}
  th:nth-child(2){text-align:left}
  td{padding:2.5px 5px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap}
  td:nth-child(2){text-align:left;white-space:normal}
  .th-ln{width:22px;color:#d1d5db;font-weight:500}
  .ln{color:#d1d5db;font-size:7.5pt;text-align:right}
  tr.section-hdr td{color:white;font-weight:700;font-size:8pt;text-transform:uppercase;padding:4px 8px}
  tr.cat-hdr td{background:#f8fafc;font-weight:600}
  td.cat-label{padding-left:10px;font-size:8.5pt}
  tr.nat-row td{color:#374151}
  td.nat-label{padding-left:18px}
  td.tot{font-weight:600}
  tr.subtot td{font-weight:700;background:#f1f5f9;border-top:1.5px solid #e2e8f0}
  tr.solde-row td{font-weight:700;font-size:9.5pt;border-top:3px solid #6366f1}
  .text-green{color:#16a34a}.text-red{color:#dc2626}.bold{font-weight:700}
  .footer{margin-top:auto;padding-top:4mm;border-top:1px solid #e5e7eb;
    display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}
  .page-num{font-size:7.5pt;color:#9ca3af}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>

<!-- ── PAGE 1 : Vue générale ─────────────────────────────────────────── -->
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
  <div class="doc-title">Bilan Économe — ${annee}</div>
  <div class="doc-meta">Généré le ${today} · ${txCount} transaction(s) · ${moisActifs.length} mois actif(s)${nonClasses ? ` · ⚠ ${nonClasses} sans nature` : ''}</div>

  <div class="cards">
    <div class="card card-g"><div class="cl">Total produits</div><div class="ca">${fmtEur(totalProduitsAnnee)}</div></div>
    <div class="card card-r"><div class="cl">Total charges</div><div class="ca">${fmtEur(totalChargesAnnee)}</div></div>
    <div class="card ${soldeGeneral>=0?'card-g':'card-r'}"><div class="cl">Solde général</div><div class="ca">${soldeGeneral>=0?'+':''}${fmtEur(soldeGeneral)}</div></div>
    <div class="card card-a"><div class="cl">Couverture élèves</div><div class="ca">${fmtEur(totalCouvrAnnee)}</div></div>
  </div>

  <h2>Vue générale — Produits &amp; Charges</h2>
  ${genTable}

  <div class="footer">
    <span>ESPM+ — Module Économe</span>
    <span>Bilan ${annee} — Document généré automatiquement — Page 1 / 2</span>
  </div>
</div>

<!-- ── PAGE 2 : Couverture élèves ────────────────────────────────────── -->
<div class="page page-break">
  <div class="header">
    <img src="${logoUrl}" alt="Logo" class="logo-ecole"/>
    <div class="header-right">
      <div class="school-name">École Secondaire Plurielle Maritime</div>
      <div class="school-addr">Avenue Jean Dubrucq 175 · 1080 Molenbeek-Saint-Jean</div>
      <div class="school-addr">${esc(SCHOOL_TEL)} — ${esc(SCHOOL_EMAIL)}</div>
    </div>
  </div>
  <hr class="hr-main"/>
  <div class="doc-title">Bilan Économe — ${annee}</div>
  <div class="doc-meta">Couverture élèves — Frais engagés vs encaissements parents</div>

  <h2>Couverture élèves</h2>
  <p style="font-size:8pt;color:#6b7280;margin-bottom:4mm">
    Natures marquées "couverture" (ExtraMuros, Voyages, Frais pédagogiques, Achats-événements) confrontées aux encaissements des parents.
  </p>
  ${couvrTable}

  <div class="footer">
    <span>ESPM+ — Module Économe</span>
    <span>Bilan ${annee} — Document généré automatiquement — Page 2 / 2</span>
  </div>
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
