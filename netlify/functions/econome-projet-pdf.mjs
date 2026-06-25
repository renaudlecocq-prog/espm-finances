// econome-projet-pdf.mjs — v1.0
// GET /.netlify/functions/econome-projet-pdf?projetId=UUID&token=SUPABASE_JWT

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

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url     = new URL(req.url)
  const projetId = url.searchParams.get('projetId')
  const token    = url.searchParams.get('token')
  if (!projetId || !token) return new Response('Paramètres manquants', { status: 400 })

  const supa = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await supa.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorisé', { status: 401 })

  const [{ data: projet }, { data: lignes }, { data: natures }] = await Promise.all([
    supa.from('comptable_projets').select('*').eq('id', projetId).single(),
    supa.from('comptable_projet_lignes').select('*').eq('projet_id', projetId).order('date'),
    supa.from('comptable_natures').select('id,libelle,type_flux'),
  ])

  if (!projet) return new Response('Projet introuvable', { status: 404 })

  const natMap = {}
  for (const n of (natures || [])) natMap[n.id] = n

  // Grouper par catégorie
  const cats = projet.categories || []
  const grouped = {}
  for (const cat of cats) grouped[cat] = []
  grouped['__sans__'] = []

  for (const l of (lignes || [])) {
    const cat = l.categorie || '__sans__'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(l)
  }

  // Totaux
  const totalEntree = (lignes || []).reduce((s, l) => s + (l.montant_entree || 0), 0)
  const totalSortie = (lignes || []).reduce((s, l) => s + (l.montant_sortie || 0), 0)
  const solde = totalEntree - totalSortie

  function renderCatRows(catLignes) {
    if (!catLignes || catLignes.length === 0) return ''
    return catLignes.map(l => {
      const nat = natMap[l.nature_id]
      return `<tr>
        <td>${fmtDate(l.date || l.date_ligne)}</td>
        <td>${esc(l.commentaire || l.note || '—')}</td>
        <td>${esc(nat?.libelle || '—')}</td>
        <td class="text-green">${l.montant_entree ? fmtEur(l.montant_entree) : ''}</td>
        <td class="text-red">${l.montant_sortie ? fmtEur(l.montant_sortie) : ''}</td>
      </tr>`
    }).join('')
  }

  let tableBody = ''
  for (const cat of [...cats, '__sans__']) {
    const catLignes = grouped[cat] || []
    if (catLignes.length === 0) continue
    const catEntree = catLignes.reduce((s, l) => s + (l.montant_entree || 0), 0)
    const catSortie = catLignes.reduce((s, l) => s + (l.montant_sortie || 0), 0)
    const catLabel = cat === '__sans__' ? 'Sans catégorie' : cat
    tableBody += `
      <tr class="cat-header"><td colspan="3">${esc(catLabel)}</td><td class="text-green">${catEntree?fmtEur(catEntree):''}</td><td class="text-red">${catSortie?fmtEur(catSortie):''}</td></tr>
      ${renderCatRows(catLignes)}
      <tr class="cat-subtotal">
        <td colspan="3">Sous-total — ${esc(catLabel)}</td>
        <td class="text-green bold">${catEntree ? fmtEur(catEntree) : '—'}</td>
        <td class="text-red bold">${catSortie ? fmtEur(catSortie) : '—'}</td>
      </tr>`
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Projet — ${esc(projet.nom)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 6px; }
  .meta { font-size: 10px; color: #9ca3af; margin-bottom: 20px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:9px; font-weight:700; text-transform:uppercase; }
  .badge-open   { background:#dcfce7; color:#16a34a; }
  .badge-closed { background:#f1f5f9; color:#64748b; }
  .cards { display:flex; gap:14px; margin-bottom:24px; }
  .card { flex:1; border-radius:8px; padding:12px 14px; }
  .card-r { background:#fef2f2; border:1px solid #fecaca; }
  .card-g { background:#f0fdf4; border:1px solid #bbf7d0; }
  .card-s { background:${solde>=0?'#f0fdf4':'#fef2f2'}; border:1px solid ${solde>=0?'#bbf7d0':'#fecaca'}; }
  .cl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
  .card-r .cl { color:#ef4444; } .card-g .cl { color:#22c55e; }
  .card-s .cl { color:${solde>=0?'#22c55e':'#ef4444'}; }
  .ca { font-size:15px; font-weight:700; }
  .card-r .ca { color:#dc2626; } .card-g .ca { color:#16a34a; }
  .card-s .ca { color:${solde>=0?'#16a34a':'#dc2626'}; }
  .desc { font-size:10px; color:#4b5563; margin-bottom:20px; background:#f8fafc; padding:10px 12px; border-radius:6px; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:#f8fafc; text-align:left; padding:5px 8px; font-weight:600;
       border-bottom:2px solid #e2e8f0; color:#64748b; }
  th:nth-child(4), th:nth-child(5) { text-align:right; }
  td { padding:3px 8px; border-bottom:1px solid #f1f5f9; }
  td:nth-child(4), td:nth-child(5) { text-align:right; }
  tr.cat-header td { background:#6366f1; color:white; font-weight:700; font-size:10px;
    text-transform:uppercase; padding:5px 10px; }
  tr.cat-subtotal td { background:#f1f5f9; font-weight:700; border-top:2px solid #e2e8f0; }
  tr.total-row td { font-weight:700; font-size:11px; background:#fff; border-top:3px solid #6366f1; }
  .text-green { color:#16a34a; } .text-red { color:#dc2626; } .bold { font-weight:700; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #e5e7eb;
    font-size:9px; color:#9ca3af; display:flex; justify-content:space-between; }
  @media print { body { padding:8mm; } @page { margin:8mm; } }
</style>
</head>
<body>
<h1>${esc(projet.nom)} <span class="badge ${projet.cloture ? 'badge-closed' : 'badge-open'}">${projet.cloture ? 'Clôturé' : 'En cours'}</span></h1>
<p class="subtitle">Projet — Module Économe · ESPM+</p>
<p class="meta">Généré le ${fmtDate(new Date().toISOString().split('T')[0])} · ${(lignes||[]).length} ligne(s)</p>

${projet.description ? `<div class="desc">${esc(projet.description)}</div>` : ''}

<div class="cards">
  <div class="card card-g"><div class="cl">Total entrées</div><div class="ca">${fmtEur(totalEntree)}</div></div>
  <div class="card card-r"><div class="cl">Total sorties</div><div class="ca">${fmtEur(totalSortie)}</div></div>
  <div class="card card-s"><div class="cl">Solde</div><div class="ca">${solde>=0?'+':''}${fmtEur(solde)}</div></div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:80px">Date</th>
      <th>Libellé</th>
      <th style="width:130px">Nature</th>
      <th style="width:90px">Entrée</th>
      <th style="width:90px">Sortie</th>
    </tr>
  </thead>
  <tbody>
    ${tableBody}
    <tr class="total-row">
      <td colspan="3">TOTAL PROJET</td>
      <td class="text-green bold">${totalEntree ? fmtEur(totalEntree) : '—'}</td>
      <td class="text-red bold">${totalSortie ? fmtEur(totalSortie) : '—'}</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <span>ESPM+ — Module Économe</span>
  <span>Projet "${esc(projet.nom)}" — Document généré automatiquement</span>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
