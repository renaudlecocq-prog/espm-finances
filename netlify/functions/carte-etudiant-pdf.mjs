// carte-etudiant-pdf.mjs
// GET /.netlify/functions/carte-etudiant-pdf?ids=UUID,UUID,...&token=SUPABASE_JWT
// Retourne une page HTML auto-print avec les cartes d'étudiant (69.8 × 54 mm)
// Format Dymo LabelWriter — monochrome — recto + verso par étudiant

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iubxalsakqljilydnqss.supabase.co'
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function anneeScolaire() {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

function getAnneeEtude(classe) {
  if (!classe) return '—'
  const match = classe.match(/^(\d)/)
  if (!match) return classe
  const n = parseInt(match[1])
  const suf = n === 1 ? 'ère' : 'ème'
  return `${n}${suf} année`
}

function renderRecto(e, annee, logoUrl) {
  const sortieMidi = e.sortie_midi === true
  const licencie   = e.licenciement === true
  const hasSortie  = e.sortie_midi !== null && e.sortie_midi !== undefined
  const hasLic     = e.licenciement !== null && e.licenciement !== undefined

  const chkSortieOui = sortieMidi                ? 'check__box check__box--filled' : 'check__box'
  const chkSortieNon = !sortieMidi && hasSortie  ? 'check__box check__box--filled' : 'check__box'
  const chkLicOui    = licencie                  ? 'check__box check__box--filled' : 'check__box'
  const chkLicNon    = !licencie  && hasLic      ? 'check__box check__box--filled' : 'check__box'

  const photoHtml = e.photo_url
    ? `<img src="${esc(e.photo_url)}" alt="Photo" crossorigin="anonymous">`
    : `<span class="ph">Photo</span>`

  return `<article class="card card--mono">
  <div class="card__header">
    <img class="card__logo" src="${esc(logoUrl)}" alt="ESPM">
    <span class="card__annee">${esc(annee)}</span>
  </div>
  <div class="card__body">
    <div class="card__photo">${photoHtml}</div>
    <div class="card__fields">
      <div class="field"><span class="field__label">Prénom</span><span class="field__value">${esc(e.prenom)}</span></div>
      <div class="field"><span class="field__label">Nom</span><span class="field__value">${esc(e.nom)}</span></div>
      <div class="field"><span class="field__label">Année</span><span class="field__value">${esc(getAnneeEtude(e.classe))}</span></div>
      <div class="field"><span class="field__label">Matricule</span><span class="field__value field__value--mono">${esc(e.matricule || '—')}</span></div>
    </div>
  </div>
  <div class="card__perms">
    <div class="perm">
      <span class="perm__label">Sortie à midi</span>
      <div class="checks">
        <span class="check"><span class="${chkSortieOui}"></span><span class="check__txt">Oui</span></span>
        <span class="check"><span class="${chkSortieNon}"></span><span class="check__txt">Non</span></span>
      </div>
    </div>
    <div class="perm">
      <span class="perm__label">Licenciements</span>
      <div class="checks">
        <span class="check"><span class="${chkLicOui}"></span><span class="check__txt">Oui</span></span>
        <span class="check"><span class="${chkLicNon}"></span><span class="check__txt">Non</span></span>
      </div>
    </div>
  </div>
</article>`
}

function renderVerso(e) {
  const qrValue = e.valeur_scanner || e.smartschool_internal_number || e.matricule || e.id
  return `<article class="card card--mono js-verso" data-qr="${esc(qrValue)}" data-mat="${esc(e.matricule || '')}">
  <div class="card__verso">
    <div class="card__qr js-qr"></div>
    <div class="matricule">
      <div class="matricule__label">Matricule</div>
      <div class="matricule__value">${esc(e.matricule || '—')}</div>
    </div>
  </div>
  <div class="brand">
    <div class="brand__tile">
      <svg viewBox="0 0 100 100">
        <polygon points="32,50 68,50 61,68 39,68" fill="#fff"/>
        <polygon points="16,44 50,28 84,44 50,60" fill="#fff"/>
        <line x1="84" y1="44" x2="84" y2="60" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
        <rect x="81" y="58" width="6" height="13" rx="1.5" fill="#fff"/>
        <rect x="77.5" y="61.5" width="13" height="6" rx="1.5" fill="#fff"/>
      </svg>
    </div>
    <span class="brand__word">ESPM+</span>
    <span class="brand__school">École Secondaire<br>Plurielle Maritime</span>
  </div>
</article>`
}

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url   = new URL(req.url)
  const ids   = url.searchParams.get('ids')
  const token = url.searchParams.get('token')

  if (!ids || !token) return new Response('Paramètres manquants', { status: 400 })

  const baseUrl = process.env.URL || `https://${req.headers.get('host')}`

  // Authentifier via le token utilisateur (pattern identique aux autres fonctions PDF)
  const sb = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorisé', { status: 401 })
  const idList = ids.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200)

  const { data: eleves, error } = await sb.from('eleves')
    .select('id, nom, prenom, matricule, classe, photo_url, smartschool_internal_number, sortie_midi, licenciement, valeur_scanner')
    .in('id', idList)
    .order('nom').order('prenom')

  if (error || !eleves) return new Response('Erreur lors du chargement des élèves', { status: 500 })

  const annee   = anneeScolaire()
  const logoUrl = baseUrl + '/logo-ecole-mono.png'

  const pages = eleves.map(e => renderRecto(e, annee, logoUrl) + '\n' + renderVerso(e)).join('\n')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Cartes étudiants — ${annee}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" crossorigin="anonymous"><\/script>
<style>
  :root { --aubergine:#2D1B2E; --orange:#F16410; }
  *{ box-sizing:border-box; margin:0; padding:0; }

  @media screen {
    body { background:#E8E5E7; padding:20px; display:flex; flex-wrap:wrap; gap:16px; }
  }
  @media print {
    body { background:#fff; padding:0; margin:0; }
    .card { page-break-after:always; }
    .card:last-child { page-break-after:avoid; }
  }
  @page { size:69.8mm 54mm; margin:0; }

  .card {
    width:69.8mm; height:54mm;
    border:0.3mm solid #000;
    background:#fff; color:#000;
    display:flex; flex-direction:column;
    overflow:hidden;
    font-family:'Space Grotesk', Arial, sans-serif;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

  /* Header */
  .card__header {
    height:11mm; flex:none;
    display:flex; align-items:center; justify-content:space-between;
    padding:0 3.4mm;
    border-bottom:0.35mm solid #000;
  }
  .card__logo { height:7mm; width:auto; display:block; }
  .card__annee {
    font-family:'Space Mono', monospace;
    font-size:5pt; font-weight:700;
    letter-spacing:.06em; color:#555;
  }

  /* Corps */
  .card__body {
    flex:1; display:flex; align-items:center;
    gap:3.4mm; padding:0 3.4mm;
  }
  .card__photo {
    width:22mm; height:22mm; border-radius:50%;
    border:0.4mm solid #000; flex:none;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden; position:relative; background:#f5f5f5;
  }
  .card__photo .ph { font-size:5pt; letter-spacing:.12em; text-transform:uppercase; color:#999; }
  .card__photo img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

  .card__fields {
    flex:1; display:grid; grid-template-columns:1fr 1fr;
    gap:2.4mm 3mm; align-content:center;
  }
  .field { display:flex; flex-direction:column; gap:0.5mm; min-width:0; }
  .field__label {
    font-weight:600; font-size:4.6pt;
    letter-spacing:.11em; text-transform:uppercase;
    line-height:1; color:#000;
  }
  .field__value { font-weight:700; font-size:9pt; line-height:1.02; color:#000; }
  .field__value--mono { font-family:'Space Mono',monospace; font-size:8pt; letter-spacing:.02em; }

  /* Autorisations */
  .card__perms {
    flex:none; display:flex; align-items:center;
    justify-content:space-between; gap:2mm;
    padding:2.2mm 3.4mm;
    border-top:0.35mm solid #000;
  }
  .perm { display:flex; flex-direction:column; gap:1.1mm; }
  .perm__label { font-weight:700; font-size:4.5pt; letter-spacing:.1em; text-transform:uppercase; color:#000; }
  .checks { display:flex; align-items:center; gap:2.8mm; }
  .check { display:inline-flex; align-items:center; gap:1mm; }
  .check__box {
    width:1.9mm; height:1.9mm;
    border:0.3mm solid #000; border-radius:0.3mm;
    background:transparent; flex:none;
  }
  .check__box--filled { background:#000; }
  .check__txt { font-weight:700; font-size:5.4pt; color:#000; line-height:1; }

  /* Verso */
  .card__verso {
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:3mm 3.4mm 1mm;
  }
  .card__qr { width:27mm; height:27mm; flex:none; }
  .card__qr img { width:100%; height:100%; display:block; }
  .matricule { text-align:center; margin-top:2.2mm; }
  .matricule__label {
    font-weight:700; font-size:5pt;
    letter-spacing:.2em; text-transform:uppercase;
    line-height:1; color:#000;
  }
  .matricule__value {
    font-family:'Space Mono',monospace;
    font-weight:700; font-size:12pt;
    letter-spacing:.07em; line-height:1; margin-top:1mm; color:#000;
  }

  /* Bandeau ESPM+ verso */
  .brand {
    flex:none; display:flex; align-items:center;
    gap:1.4mm; padding:2.4mm 3.4mm;
    border-top:0.35mm solid #000;
  }
  .brand__tile {
    width:5mm; height:5mm; border-radius:1.2mm;
    display:flex; align-items:center; justify-content:center;
    flex:none; background:#000;
  }
  .brand__tile svg { width:72%; height:72%; }
  .brand__word { font-weight:700; font-size:8pt; letter-spacing:-.01em; color:#000; }
  .brand__school {
    margin-left:auto; font-family:'Space Mono',monospace;
    font-size:4.6pt; letter-spacing:.13em;
    text-transform:uppercase; line-height:1.3;
    text-align:right; color:#000;
  }
<\/style>
<\/head>
<body>
${pages}
<script>
(function() {
  function makeQR() {
    if (!window.QRCode) { return setTimeout(makeQR, 100); }
    document.querySelectorAll('.js-verso').forEach(function(verso) {
      var val = verso.getAttribute('data-qr');
      if (!val) return;
      var box = verso.querySelector('.js-qr');
      if (!box) return;
      var tmp = document.createElement('div');
      tmp.style.cssText = 'position:absolute;left:-9999px;top:0;';
      document.body.appendChild(tmp);
      new QRCode(tmp, { text: val, width: 540, height: 540, colorDark: '#000000', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
      var cv = tmp.querySelector('canvas');
      var data = cv ? cv.toDataURL('image/png') : ((tmp.querySelector('img') || {}).src);
      document.body.removeChild(tmp);
      if (data) { box.innerHTML = '<img src="' + data + '" alt="QR">'; }
    });
    setTimeout(function() { window.print(); }, 500);
  }
  document.addEventListener('DOMContentLoaded', makeQR);
})();
<\/script>
<\/body>
<\/html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
