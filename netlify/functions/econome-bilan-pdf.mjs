// econome-bilan-pdf.mjs — v1.0
// GET /.netlify/functions/econome-bilan-pdf?annee=2025&token=SUPABASE_JWT

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY

function fmtEur(v) {
  return Number(v || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

const MOIS_LABELS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url   = new URL(req.url)
  const annee = parseInt(url.searchParams.get('annee') || new Date().getFullYear())
  const token = url.searchParams.get('token')
  if (!token) return new Response('Non autorisé', { status: 401 })

  const supa = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await supa.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorisé', { status: 401 })

  const [{ data: natures }, { data: txs }] = await Promise.all([
    supa.from('comptable_natures').select('*').order('libelle'),
    supa.from('comptable_transactions')
      .select('*')
      .gte('date', `${annee}-01-01`)
      .lte('date', `${annee}-12-31`)
      .order('date'),
  ])

  const pivot = {}
  for (const tx of (txs || [])) {
    const m = new Date(tx.date + 'T00:00:00').getMonth() + 1
    if (!pivot[tx.nature_id]) pivot[tx.nature_id] = {}
    if (!pivot[tx.nature_id][m]) pivot[tx.nature_id][m] = 0
    pivot[tx.nature_id][m] += (tx.montant_entree || 0) - (tx.montant_sortie || 0)
  }

  const moisActifs = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter(m => (txs || []).some(t => new Date(t.date + 'T00:00:00').getMonth() + 1 === m))

  const produitsNatures    = (natures || []).filter(n => n.type_flux === 'produit')
  const chargesNatures     = (natures || []).filter(n => n.type_flux === 'charge' || n.type_flux === 'neutre')
  const couvertureNatures  = chargesNatures.filter(n => n.in_couverture)

  function getMoisVal(natId, m) { return Math.abs(pivot[natId]?.[m] || 0) }
  function getTotalNat(natId) { return moisActifs.reduce((s, m) => s + Math.abs(pivot[natId]?.[m] || 0), 0) }

  function groupByCat(nats) {
    const cats = {}
    for (const n of nats) {
      const cat = n.categorie || 'Sans catégorie'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(n)
    }
    return cats
  }

  const prodCats  = groupByCat(produitsNatures)
  const chargCats = groupByCat(chargesNatures)
  const couvrCats = groupByCat(couvertureNatures)

  const totalProduitsAnnee = produitsNatures.reduce((s, n) => s + getTotalNat(n.id), 0)
  const totalChargesAnnee  = chargesNatures.reduce((s, n) => s + getTotalNat(n.id), 0)
  const totalCouvrAnnee    = couvertureNatures.reduce((s, n) => s + getTotalNat(n.id), 0)
  const soldeGeneral = totalProduitsAnnee - totalChargesAnnee

  const moisHeaders = moisActifs.map(m => `<th>${MOIS_LABELS[m]}</th>`).join('')

  function renderSection(title, cats, colorClass) {
    if (Object.keys(cats).length === 0) return ''
    let html = `<tr class="section-header"><td colspan="${moisActifs.length + 2}">${esc(title)}</td></tr>`
    let sectionTotal = 0
    for (const [cat, nats] of Object.entries(cats)) {
      const catTotal = nats.reduce((s, n) => s + getTotalNat(n.id), 0)
      sectionTotal += catTotal
      html += `<tr class="cat-row">
        <td>${esc(cat)}</td>
        ${moisActifs.map(m => { const v = nats.reduce((s,n) => s + getMoisVal(n.id, m), 0); return `<td>${v ? fmtEur(v) : '—'}</td>` }).join('')}
        <td class="${colorClass}">${fmtEur(catTotal)}</td>
      </tr>`
      for (const n of nats) {
        const tot = getTotalNat(n.id)
        if (!tot) continue
        html += `<tr class="nature-row">
          <td class="nature-label">${esc(n.libelle)}</td>
          ${moisActifs.map(m => `<td>${getMoisVal(n.id, m) ? fmtEur(getMoisVal(n.id, m)) : ''}</td>`).join('')}
          <td>${fmtEur(tot)}</td>
        </tr>`
      }
    }
    html += `<tr class="subtotal-row">
      <td>TOTAL ${esc(title)}</td>
      ${moisActifs.map(m => { const v = Object.values(cats).flat().reduce((s, n) => s + getMoisVal(n.id, m), 0); return `<td>${v ? fmtEur(v) : '—'}</td>` }).join('')}
      <td class="${colorClass} bold">${fmtEur(sectionTotal)}</td>
    </tr>`
    return html
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bilan Économe ${annee}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  .meta { font-size: 10px; color: #9ca3af; margin-bottom: 20px; }
  .cards { display: flex; gap: 14px; margin-bottom: 28px; }
  .card { flex: 1; border-radius: 8px; padding: 12px 14px; }
  .card-r { background:#fef2f2; border:1px solid #fecaca; }
  .card-g { background:#f0fdf4; border:1px solid #bbf7d0; }
  .card-b { background:#eff6ff; border:1px solid #bfdbfe; }
  .cl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
  .card-r .cl { color:#ef4444; } .card-g .cl { color:#22c55e; } .card-b .cl { color:#3b82f6; }
  .ca { font-size:15px; font-weight:700; }
  .card-r .ca { color:#dc2626; } .card-g .ca { color:#16a34a; } .card-b .ca { color:#2563eb; }
  h2 { font-size:12px; font-weight:700; margin:20px 0 8px; padding:5px 10px;
       background:#f1f5f9; border-left:3px solid #6366f1; border-radius:4px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; font-size:10px; }
  th { background:#f8fafc; text-align:right; padding:4px 6px; font-weight:600;
       border-bottom:2px solid #e2e8f0; color:#64748b; white-space:nowrap; }
  th:first-child { text-align:left; }
  td { padding:3px 6px; border-bottom:1px solid #f1f5f9; text-align:right; }
  td:first-child { text-align:left; }
  tr.section-header td { background:#6366f1; color:white; font-weight:700;
    font-size:10px; text-transform:uppercase; padding:5px 10px; }
  tr.cat-row td { background:#f8fafc; font-weight:600; }
  tr.nature-row td { color:#4b5563; }
  td.nature-label { padding-left:18px; }
  tr.subtotal-row td { font-weight:700; background:#f1f5f9; border-top:2px solid #e2e8f0; }
  tr.solde-row td { font-weight:700; font-size:11px; background:#fff; border-top:3px solid #6366f1; }
  .text-red { color:#dc2626; } .text-green { color:#16a34a; } .bold { font-weight:700; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #e5e7eb;
    font-size:9px; color:#9ca3af; display:flex; justify-content:space-between; }
  @media print { body { padding:8mm; } @page { margin:8mm; size:A4 landscape; } }
</style>
</head>
<body>
<h1>Bilan Économe — ${annee}</h1>
<p class="subtitle">École Secondaire Plurielle Maritime</p>
<p class="meta">Généré le ${fmtDate(new Date().toISOString().split('T')[0])} · ${(txs||[]).length} transaction(s) · ${moisActifs.length} mois actif(s)</p>

<div class="cards">
  <div class="card card-g"><div class="cl">Total produits</div><div class="ca">${fmtEur(totalProduitsAnnee)}</div></div>
  <div class="card card-r"><div class="cl">Total charges</div><div class="ca">${fmtEur(totalChargesAnnee)}</div></div>
  <div class="card ${soldeGeneral>=0?'card-g':'card-r'}"><div class="cl">Solde général</div><div class="ca">${soldeGeneral>=0?'+':''}${fmtEur(soldeGeneral)}</div></div>
  <div class="card card-b"><div class="cl">Couverture élèves</div><div class="ca">${fmtEur(totalCouvrAnnee)}</div></div>
</div>

<h2>Vue générale — Produits &amp; Charges</h2>
<table>
  <thead><tr><th style="width:220px">Nature / Catégorie</th>${moisHeaders}<th style="width:85px">Total ${annee}</th></tr></thead>
  <tbody>
    ${renderSection('PRODUITS', prodCats, 'text-green')}
    ${renderSection('CHARGES', chargCats, 'text-red')}
    <tr class="solde-row">
      <td>SOLDE ${annee}</td>
      ${moisActifs.map(m => {
        const p = produitsNatures.reduce((s,n) => s+getMoisVal(n.id,m),0)
        const c = chargesNatures.reduce((s,n) => s+getMoisVal(n.id,m),0)
        const s = p-c
        return `<td class="${s>=0?'text-green':'text-red'}">${s!==0?(s>0?'+':'−')+fmtEur(Math.abs(s)):'—'}</td>`
      }).join('')}
      <td class="${soldeGeneral>=0?'text-green':'text-red'} bold">${soldeGeneral>=0?'+':'−'}${fmtEur(Math.abs(soldeGeneral))}</td>
    </tr>
  </tbody>
</table>

<h2>Couverture élèves</h2>
<table>
  <thead><tr><th style="width:220px">Nature / Catégorie</th>${moisHeaders}<th style="width:85px">Total ${annee}</th></tr></thead>
  <tbody>
    ${renderSection('DÉPENSES ÉLÈVES', couvrCats, 'text-red')}
    ${renderSection('ENCAISSEMENTS', prodCats, 'text-green')}
    <tr class="solde-row">
      <td>SOLDE COUVERTURE</td>
      ${moisActifs.map(m => {
        const enc = produitsNatures.reduce((s,n) => s+getMoisVal(n.id,m),0)
        const dep = couvertureNatures.reduce((s,n) => s+getMoisVal(n.id,m),0)
        const s = enc-dep
        return `<td class="${s>=0?'text-green':'text-red'}">${s!==0?(s>0?'+':'−')+fmtEur(Math.abs(s)):'—'}</td>`
      }).join('')}
      <td class="${(totalProduitsAnnee-totalCouvrAnnee)>=0?'text-green':'text-red'} bold">${(totalProduitsAnnee-totalCouvrAnnee)>=0?'+':'−'}${fmtEur(Math.abs(totalProduitsAnnee-totalCouvrAnnee))}</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <span>ESPM+ — Module Économe</span>
  <span>Bilan ${annee} — Document généré automatiquement</span>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
