// articles-rapport-pdf.mjs — v1.0
// GET /.netlify/functions/articles-rapport-pdf
// Authorization: Bearer <JWT>
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

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const fmt = n => Number(n||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'

const CATEGORIES = ['Frais obligatoires', 'Fournitures scolaires', 'Vêtements', 'Divers']
const CAT_COLOR = {
  'Frais obligatoires':    '#2563eb',
  'Fournitures scolaires': '#16a34a',
  'Vêtements':             '#9333ea',
  'Divers':                '#d97706',
}
const CAT_BG = {
  'Frais obligatoires':    '#eff6ff',
  'Fournitures scolaires': '#f0fdf4',
  'Vêtements':             '#faf5ff',
  'Divers':                '#fffbeb',
}

export const handler = async (event) => {
  // Auth via Authorization header (prioritaire) ou query param
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const params     = event.queryStringParameters || {}
  const token      = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (params.token ? decodeURIComponent(params.token) : null)
  if (!token) return { statusCode: 401, body: 'Token manquant' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const ss = await getSchoolSettings(supabase)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode: 403, body: `Non autorisé${authErr ? ': ' + authErr.message : ''}` }

  const _defaultLogoUrl = (process.env.URL || 'https://espmaritime.netlify.app') + '/logo-ecole.png'
  const logoUrl = ss.school_logo_url || _defaultLogoUrl
  const today   = new Date().toLocaleDateString('fr-BE')

  // ── Fetch en parallèle ──────────────────────────────────────────────────
  const [attribRes, lignesRes, facturesRes, paiementsRes, echsRes, otsRes] = await Promise.all([
    supabase.from('article_attributions')
      .select('id, article_id, nb_eleves, prix_unitaire_applique, quantite, statut_facturation, article:article_id(nom, categorie, prix_unitaire)'),
    supabase.from('facture_lignes')
      .select('id, facture_id, montant, article_attribution_id')
      .not('article_attribution_id', 'is', null),
    supabase.from('factures')
      .select('id, eleve_id, montant'),
    supabase.from('paiements')
      .select('eleve_id, montant'),
    supabase.from('echelonnements')
      .select('eleve_id')
      .eq('statut', 'en_cours'),
    supabase.from('organismes_tiers')
      .select('eleve_id')
      .eq('statut', 'en_cours'),
  ])

  const attrs    = attribRes.data    || []
  const lignes   = lignesRes.data    || []
  const factures = facturesRes.data  || []
  const paies    = paiementsRes.data || []
  const echs     = echsRes.data      || []
  const ots      = otsRes.data       || []

  // ── Solde par élève (positif = crédit, négatif = dette) ────────────────
  const soldeMap = {}
  paies.forEach(p   => { soldeMap[p.eleve_id] = (soldeMap[p.eleve_id] || 0) + Number(p.montant) })
  factures.forEach(f => { soldeMap[f.eleve_id] = (soldeMap[f.eleve_id] || 0) - Number(f.montant) })

  // ── Élèves avec échelonnement actif / OT en cours ──────────────────────
  const echEleves = new Set(echs.map(e => e.eleve_id))
  const otEleves  = new Set(ots.map(o => o.eleve_id))

  // ── facture_id → eleve_id ───────────────────────────────────────────────
  const factureEleveMap = {}
  factures.forEach(f => { factureEleveMap[f.id] = f.eleve_id })

  // ── lignes par attribution ──────────────────────────────────────────────
  const lignesByAttr = {}
  lignes.forEach(l => {
    const k = l.article_attribution_id
    if (!lignesByAttr[k]) lignesByAttr[k] = []
    lignesByAttr[k].push(l)
  })

  // ── Calcul par article ──────────────────────────────────────────────────
  const byArticle = {}

  for (const attr of attrs) {
    const articleId = attr.article_id
    const art       = attr.article || {}
    if (!byArticle[articleId]) {
      byArticle[articleId] = {
        nom:            art.nom       || '?',
        categorie:      art.categorie || 'Divers',
        prix_unitaire:  Number(art.prix_unitaire || 0),
        total_attribue: 0,
        total_facture:  0,
        total_paye:     0,
        total_impaye:   0,
        total_ech:      0,
        total_ot:       0,
      }
    }
    const nb   = Number(attr.nb_eleves || 0)
    const prix = Number(attr.prix_unitaire_applique ?? art.prix_unitaire ?? 0)
    const qte  = Number(attr.quantite || 1)
    byArticle[articleId].total_attribue += nb * prix * qte

    // Lignes de facture pour cette attribution
    for (const ligne of (lignesByAttr[attr.id] || [])) {
      const montant = Number(ligne.montant || 0)
      const eleveId = factureEleveMap[ligne.facture_id]
      const solde   = soldeMap[eleveId] || 0
      byArticle[articleId].total_facture += montant
      if (solde >= 0) {
        // Élève a un solde positif : la dette est couverte
        byArticle[articleId].total_paye += montant
      } else {
        byArticle[articleId].total_impaye += montant
        if (echEleves.has(eleveId)) byArticle[articleId].total_ech += montant
        if (otEleves.has(eleveId))  byArticle[articleId].total_ot  += montant
      }
    }
  }

  // ── Totaux par catégorie ────────────────────────────────────────────────
  const byCategorie = {}
  for (const [, stats] of Object.entries(byArticle)) {
    const cat = stats.categorie
    if (!byCategorie[cat]) byCategorie[cat] = []
    byCategorie[cat].push(stats)
  }

  const ZERO = { total_attribue:0, total_facture:0, total_paye:0, total_impaye:0, total_ech:0, total_ot:0 }
  const sum  = (acc, item) => ({
    total_attribue: acc.total_attribue + item.total_attribue,
    total_facture:  acc.total_facture  + item.total_facture,
    total_paye:     acc.total_paye     + item.total_paye,
    total_impaye:   acc.total_impaye   + item.total_impaye,
    total_ech:      acc.total_ech      + item.total_ech,
    total_ot:       acc.total_ot       + item.total_ot,
  })

  const catTotals  = Object.fromEntries(Object.entries(byCategorie).map(([cat, items]) => [cat, items.reduce(sum, {...ZERO})]))
  const grandTotal = Object.values(catTotals).reduce(sum, {...ZERO})

  // ── HTML table rows ────────────────────────────────────────────────────
  const breakdown = (ech, ot, impaye) => {
    if (impaye <= 0) return '<span class="na">—</span>'
    let parts = []
    if (ech > 0) parts.push(`<span class="pill ech">Éch. en cours : ${fmt(ech)}</span>`)
    if (ot  > 0) parts.push(`<span class="pill ot">OT en attente : ${fmt(ot)}</span>`)
    return parts.length ? parts.join('') : '<span class="na">—</span>'
  }

  let rows = ''
  for (const cat of CATEGORIES) {
    if (!byCategorie[cat]?.length) continue
    const items = [...byCategorie[cat]].sort((a,b) => a.nom.localeCompare(b.nom, 'fr'))
    const t     = catTotals[cat]
    const color = CAT_COLOR[cat] || '#374151'
    const bg    = CAT_BG[cat]   || '#f9fafb'

    rows += `<tr class="cat-head" style="background:${bg}">
      <td colspan="6" style="color:${color};border-left:3px solid ${color}">${esc(cat)}</td>
    </tr>`

    for (const item of items) {
      rows += `<tr>
        <td class="ind">${esc(item.nom)}</td>
        <td class="r">${fmt(item.total_attribue)}</td>
        <td class="r">${fmt(item.total_facture)}</td>
        <td class="r">${fmt(item.total_paye)}</td>
        <td class="r${item.total_impaye > 0 ? ' rouge' : ''}">${fmt(item.total_impaye)}</td>
        <td>${breakdown(item.total_ech, item.total_ot, item.total_impaye)}</td>
      </tr>`
    }

    rows += `<tr class="sub">
      <td>Sous-total ${esc(cat)}</td>
      <td class="r">${fmt(t.total_attribue)}</td>
      <td class="r">${fmt(t.total_facture)}</td>
      <td class="r">${fmt(t.total_paye)}</td>
      <td class="r${t.total_impaye > 0 ? ' rouge' : ''}">${fmt(t.total_impaye)}</td>
      <td>${breakdown(t.total_ech, t.total_ot, t.total_impaye)}</td>
    </tr>`
  }

  rows += `<tr class="grand">
    <td>TOTAL GÉNÉRAL</td>
    <td class="r">${fmt(grandTotal.total_attribue)}</td>
    <td class="r">${fmt(grandTotal.total_facture)}</td>
    <td class="r">${fmt(grandTotal.total_paye)}</td>
    <td class="r${grandTotal.total_impaye > 0 ? ' rouge-inv' : ''}">${fmt(grandTotal.total_impaye)}</td>
    <td>
      ${grandTotal.total_ech > 0 ? `<span class="pill ech-inv">Éch. en cours : ${fmt(grandTotal.total_ech)}</span>` : ''}
      ${grandTotal.total_ot  > 0 ? `<span class="pill ot-inv">OT en attente : ${fmt(grandTotal.total_ot)}</span>`  : ''}
      ${grandTotal.total_ech === 0 && grandTotal.total_ot === 0 && grandTotal.total_impaye > 0 ? '<span style="color:rgba(255,255,255,0.55);font-size:7.5pt">—</span>' : ''}
    </td>
  </tr>`

  // ── HTML complet ───────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport des articles — ESPM+</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif}
  body{background:#f5f5f5}
  @media print{
    body{background:white}
    .print-btn{display:none!important}
    @page{size:A4 portrait;margin:12mm 15mm 15mm 15mm}
    .page{box-shadow:none!important;margin:0!important;padding:0!important;min-height:unset;width:100%!important}
  }
  @media screen{.page{box-shadow:0 2px 16px rgba(0,0,0,.12);margin:20px auto}}
  .print-btn{position:fixed;top:16px;right:16px;z-index:100;background:#2D1B2E;color:white;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  .page{width:210mm;min-height:297mm;display:flex;flex-direction:column;padding:12mm 15mm 8mm 15mm;margin:0 auto;background:white}
  .header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:4mm}
  .logo-ecole{height:15mm;width:auto}
  .header-right{text-align:right}
  .school-name{font-size:10.5pt;font-weight:700;color:#2D1B2E}
  .school-addr{font-size:8pt;color:#666;margin-top:2px}
  .hr-main{border:none;border-top:2.5px solid #2D1B2E;margin:0 0 4mm 0}
  .doc-title{font-size:18pt;font-weight:900;color:#2D1B2E;font-family:Arial Black,Arial,sans-serif;letter-spacing:-.5px}
  .doc-meta{font-size:8pt;color:#9ca3af;margin-top:1mm;margin-bottom:4mm}
  .note{font-size:7.5pt;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:2.5mm 3mm;margin-bottom:5mm;line-height:1.4}
  table{width:100%;border-collapse:collapse;font-size:8pt}
  thead tr{background:#f3f4f6}
  th{padding:2.5mm 2.5mm;text-align:left;font-size:7pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #e5e7eb;white-space:nowrap}
  th.r{text-align:right}
  td{padding:2mm 2.5mm;border-bottom:1px solid #f3f4f6;vertical-align:middle;line-height:1.35}
  td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  td.rouge{color:#b91c1c;font-weight:600}
  td.rouge-inv{color:#fca5a5;font-weight:600}
  td.ind{padding-left:5mm}
  .na{color:#d1d5db;font-size:7.5pt}
  .cat-head td{font-size:8pt;font-weight:700;padding:3mm 2.5mm 2.5mm;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:.06em;border-top:4mm solid transparent}
  .cat-head:first-child td{border-top:none}
  .sub td{background:#f9fafb;font-weight:700;border-top:1.5px solid #e5e7eb;border-bottom:2.5px solid #e5e7eb}
  .grand td{background:#2D1B2E;color:white;font-weight:700;font-size:9pt;border:none}
  .pill{display:inline-block;padding:1.5px 5px;border-radius:99px;font-size:7pt;font-weight:600;margin-right:3px;margin-bottom:2px;white-space:nowrap}
  .pill.ech{background:#dbeafe;color:#1d4ed8}
  .pill.ot{background:#fef3c7;color:#92400e}
  .pill.ech-inv{background:#1e3a8a;color:#bfdbfe}
  .pill.ot-inv{background:#78350f;color:#fde68a}
  .footer{margin-top:auto;padding-top:4mm;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
<div class="page">
  <div class="header">
    <img src="${logoUrl}" alt="Logo" class="logo-ecole"/>
    <div class="header-right">
      <div class="school-name">${ss.school_nom}</div>
      <div class="school-addr">${ss.school_adresse_rue} · ${ss.school_adresse_cp} ${ss.school_adresse_ville}</div>
      <div class="school-addr">${esc(ss.school_tel_general)} — ${esc(ss.school_email_general)}</div>
    </div>
  </div>
  <hr class="hr-main"/>
  <div class="doc-title">Rapport des Articles</div>

  <div class="note">
    ℹ️ <strong>Montant attribué</strong> = total calculé (nb élèves × prix × qté), toutes attributions confondues. 
    <strong>Montant facturé</strong> = sommes effectivement émises en facture. 
    <strong>Montant payé</strong> = part facturée dont l'élève présente un solde positif (paiements ≥ factures). 
    <strong>Montant impayé</strong> = part facturée restant due — dont <em>échelonnement en cours</em> (élève avec plan de paiement actif) et <em>OT en attente</em> (organisme tiers avec demande en cours).
  </div>

  <table>
    <thead>
      <tr>
        <th>Article</th>
        <th class="r">Montant attribué</th>
        <th class="r">Montant facturé</th>
        <th class="r">Montant payé</th>
        <th class="r">Montant impayé</th>
        <th>Dont</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <span>${ss.school_nom} — ${esc(ss.school_tel_general)} — ${esc(ss.school_email_general)}</span>
    <span>Rapport généré par ESPM<span style="color:#f97316;font-weight:700">+</span> le ${today}</span>
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
