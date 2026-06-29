// carte-etudiant-pdf.mjs
// GET /.netlify/functions/carte-etudiant-pdf?ids=UUID,...&token=JWT
// Génère un PDF binaire avec pages exactement 69.8 × 54 mm (Dymo LabelWriter)
// 2 pages par élève : recto (photo + champs + cases) + verso (QR + matricule)

import { createClient }                    from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode                               from 'qrcode'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iubxalsakqljilydnqss.supabase.co'
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Constantes géométriques ──────────────────────────────────────────────────
// 1mm = 2.8346pt  — pages Dymo : 69.8mm × 54mm
const PW  = 197.9   // 69.8mm en pt
const PH  = 153.1   // 54mm en pt
const MM  = 2.8346  // pt par mm
const PAD = 9.6     // padding horizontal standard

// Zones recto
const HEADER_H = 34.6  // 12.2mm — logo + année
const PERMS_H  = 31.0  // 10.9mm — sortie midi + licenciements
const BODY_Y   = PERMS_H
const BODY_H   = PH - HEADER_H - PERMS_H   // 87.5pt ≈ 30.9mm

// Zone verso
const BRAND_H  = 22.7  // 8mm — bandeau ESPM+
const QR_SIZE  = 27 * MM  // 76.5pt

// Couleurs
const BLK  = rgb(0, 0, 0)
const WHT  = rgb(1, 1, 1)
const LGRY = rgb(0.94, 0.94, 0.94)
const MGRY = rgb(0.42, 0.42, 0.42)

// ── Utilitaires ──────────────────────────────────────────────────────────────
function anneeScolaire() {
  const m = new Date().getMonth() + 1, y = new Date().getFullYear()
  return m >= 8 ? `${y}-${y+1}` : `${y-1}-${y}`
}

function getAnneeEtude(classe) {
  if (!classe) return '-'
  const n = parseInt((classe.match(/^(\d)/) || [])[1])
  if (!n) return classe
  return `${n}${n === 1 ? 'ere' : 'eme'} annee`
}

// Supprimer les caractères hors WinAnsi (garde accents français standard)
function safe(s) {
  if (!s) return '-'
  return String(s)
    .replace(/’/g, "'").replace(/‘/g, "'")
    .replace(/“|”/g, '"').replace(/–|—/g, '-')
    .replace(/[^\x20-\xFF]/g, '?')
}

async function fetchBytes(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return new Uint8Array(await r.arrayBuffer())
  } catch { return null }
}

// Dessin QR code via matrice pure JS (pas de canvas)
function drawQR(page, value, x, y, size) {
  const qr   = QRCode.create(String(value), { errorCorrectionLevel: 'M' })
  const mods = qr.modules
  const n    = mods.size
  const cell = size / n

  page.drawRectangle({ x, y, width: size, height: size, color: WHT })
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (mods.data[row * n + col]) {
        page.drawRectangle({
          x: x + col * cell,
          y: y + (n - 1 - row) * cell,
          width: cell + 0.1,
          height: cell + 0.1,
          color: BLK,
        })
      }
    }
  }
}

// ── Page RECTO ───────────────────────────────────────────────────────────────
async function buildRecto(pdfDoc, e, annee, fb, fr) {
  const page = pdfDoc.addPage([PW, PH])

  // Fond blanc + bordure
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHT })
  page.drawRectangle({ x: 0.4, y: 0.4, width: PW - 0.8, height: PH - 0.8,
    borderColor: BLK, borderWidth: 0.85 })

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerY = PH - HEADER_H
  page.drawLine({ start: {x:0, y:headerY}, end: {x:PW, y:headerY}, thickness: 0.85, color: BLK })

  // Logo
  if (e._logo) {
    try {
      const img = await pdfDoc.embedPng(e._logo)
      const h = 19.5, w = img.width * (h / img.height)
      page.drawImage(img, { x: PAD, y: headerY + (HEADER_H - h) / 2, width: w, height: h })
    } catch {}
  }

  // Année scolaire
  const aw = fb.widthOfTextAtSize(annee, 6)
  page.drawText(annee, { x: PW - PAD - aw, y: headerY + (HEADER_H - 6) / 2, size: 6, font: fb, color: MGRY })

  // ── Zone permissions ───────────────────────────────────────────────────────
  page.drawLine({ start: {x:0, y:PERMS_H}, end: {x:PW, y:PERMS_H}, thickness: 0.85, color: BLK })

  function drawPerm(label, val, hasVal, px) {
    page.drawText(label, { x: px, y: PERMS_H - 9.5, size: 4.5, font: fb, color: BLK })
    const BOX = 5.4, CY = 3.2
    // Oui
    page.drawRectangle({ x: px, y: CY, width: BOX, height: BOX, borderColor: BLK, borderWidth: 0.85 })
    if (hasVal && val === true)  page.drawRectangle({ x: px+1.1, y: CY+1.1, width: BOX-2.2, height: BOX-2.2, color: BLK })
    page.drawText('Oui', { x: px + BOX + 2, y: CY + 0.5, size: 5.4, font: fb, color: BLK })
    // Non
    const nX = px + BOX + 14
    page.drawRectangle({ x: nX, y: CY, width: BOX, height: BOX, borderColor: BLK, borderWidth: 0.85 })
    if (hasVal && val === false) page.drawRectangle({ x: nX+1.1, y: CY+1.1, width: BOX-2.2, height: BOX-2.2, color: BLK })
    page.drawText('Non', { x: nX + BOX + 2, y: CY + 0.5, size: 5.4, font: fb, color: BLK })
  }

  const hasSortie = e.sortie_midi !== null && e.sortie_midi !== undefined
  const hasLic    = e.licenciement !== null && e.licenciement !== undefined
  drawPerm('SORTIE A MIDI',  e.sortie_midi,  hasSortie, PAD)
  drawPerm('LICENCIEMENTS',  e.licenciement, hasLic,    PW / 2 + 5)

  // ── Photo ──────────────────────────────────────────────────────────────────
  const PS = 22 * MM  // 62.4pt
  const PX = PAD
  const PY = BODY_Y + (BODY_H - PS) / 2

  page.drawRectangle({ x: PX, y: PY, width: PS, height: PS, color: LGRY, borderColor: BLK, borderWidth: 0.85 })

  if (e._photo) {
    try {
      let img
      try { img = await pdfDoc.embedJpg(e._photo) } catch { img = await pdfDoc.embedPng(e._photo) }
      const d = img.scaleToFit(PS - 1.6, PS - 1.6)
      page.drawImage(img, {
        x: PX + 0.8 + (PS - 1.6 - d.width) / 2,
        y: PY + 0.8 + (PS - 1.6 - d.height) / 2,
        width: d.width, height: d.height,
      })
    } catch {}
  }

  // ── Champs 2×2 ─────────────────────────────────────────────────────────────
  const FX = PX + PS + 9.6
  const FW = PW - FX - PAD
  const CW = FW / 2
  const CH = BODY_H / 2

  const fields = [
    { lbl: 'PRENOM',    val: safe(e.prenom) },
    { lbl: 'NOM',       val: safe(e.nom) },
    { lbl: 'ANNEE',     val: getAnneeEtude(e.classe) },
    { lbl: 'MATRICULE', val: safe(e.matricule) },
  ]

  fields.forEach(({ lbl, val }, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const fx  = FX + col * CW
    const fy  = BODY_Y + BODY_H - (row + 1) * CH

    page.drawText(lbl, { x: fx, y: fy + CH * 0.62, size: 4.8, font: fb, color: BLK })

    // Adapter la taille si le texte est trop long
    let vSize = 9.5
    let v = val
    while (v.length > 1 && fb.widthOfTextAtSize(v, vSize) > CW - 3) {
      vSize -= 0.5
      if (vSize < 7) { v = v.slice(0, -1); vSize = 9.5 }
    }
    page.drawText(v, { x: fx, y: fy + CH * 0.2, size: vSize, font: fb, color: BLK })
  })
}

// ── Page VERSO ───────────────────────────────────────────────────────────────
async function buildVerso(pdfDoc, e, fb) {
  const page = pdfDoc.addPage([PW, PH])

  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHT })
  page.drawRectangle({ x: 0.4, y: 0.4, width: PW - 0.8, height: PH - 0.8,
    borderColor: BLK, borderWidth: 0.85 })

  // ── Bandeau ESPM+ ──────────────────────────────────────────────────────────
  page.drawLine({ start: {x:0, y:BRAND_H}, end: {x:PW, y:BRAND_H}, thickness: 0.85, color: BLK })

  const TILE = 14.2, tX = PAD, tY = (BRAND_H - TILE) / 2
  page.drawRectangle({ x: tX, y: tY, width: TILE, height: TILE, color: BLK })
  page.drawText('E+', { x: tX + 1.8, y: tY + 4.5, size: 6.5, font: fb, color: WHT })
  page.drawText('ESPM+', { x: tX + TILE + 4, y: tY + 4.5, size: 8.5, font: fb, color: BLK })

  const s1 = 'ECOLE SECONDAIRE', s2 = 'PLURIELLE MARITIME'
  const sw = Math.max(fb.widthOfTextAtSize(s1, 4.5), fb.widthOfTextAtSize(s2, 4.5))
  page.drawText(s1, { x: PW - PAD - sw, y: tY + 9.5, size: 4.5, font: fb, color: BLK })
  page.drawText(s2, { x: PW - PAD - sw, y: tY + 3.5, size: 4.5, font: fb, color: BLK })

  // ── QR + matricule ─────────────────────────────────────────────────────────
  // Layout (bas vers haut): mat_value(14pt) + gap(3) + mat_label(5pt) + gap(7) + QR(76.5pt)
  const ZONE_H  = PH - BRAND_H
  const TOTAL_H = 14 + 3 + 5 + 7 + QR_SIZE
  const startY  = BRAND_H + (ZONE_H - TOTAL_H) / 2

  // Valeur matricule
  const matVal  = safe(e.matricule)
  const matVSz  = 12
  const matVW   = fb.widthOfTextAtSize(matVal, matVSz)
  page.drawText(matVal, { x: (PW - matVW) / 2, y: startY, size: matVSz, font: fb, color: BLK })

  // Label matricule
  const matLbl  = 'MATRICULE'
  const matLW   = fb.widthOfTextAtSize(matLbl, 5)
  page.drawText(matLbl, { x: (PW - matLW) / 2, y: startY + 14 + 3, size: 5, font: fb, color: BLK })

  // QR code — valeur depuis valeur_scanner, sinon smartschool_internal_number
  const qrVal = e.valeur_scanner || e.smartschool_internal_number || e.matricule || e.id
  const qrY   = startY + 14 + 3 + 5 + 7
  const qrX   = (PW - QR_SIZE) / 2
  drawQR(page, qrVal, qrX, qrY, QR_SIZE)
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url   = new URL(req.url)
  const ids   = url.searchParams.get('ids')
  const token = url.searchParams.get('token')

  if (!ids || !token) return new Response('Parametres manquants', { status: 400 })

  const baseUrl = process.env.URL || `https://${req.headers.get('host')}`

  // Auth
  const sb = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorise', { status: 401 })

  // Données élèves
  const idList = ids.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200)
  const { data: eleves, error } = await sb.from('eleves')
    .select('id, nom, prenom, matricule, classe, photo_url, smartschool_internal_number, sortie_midi, licenciement, valeur_scanner')
    .in('id', idList).order('nom').order('prenom')

  if (error || !eleves) return new Response('Erreur chargement eleves', { status: 500 })

  // Logo (une seule fois)
  const logoBytes = await fetchBytes(`${baseUrl}/logo-ecole-mono.png`)

  // Photos (par lots de 10)
  for (let i = 0; i < eleves.length; i += 10) {
    await Promise.all(eleves.slice(i, i + 10).map(async e => {
      e._logo  = logoBytes
      if (e.photo_url) e._photo = await fetchBytes(e.photo_url)
    }))
  }

  // Génération PDF
  const pdfDoc  = await PDFDocument.create()
  pdfDoc.setTitle(`Cartes etudiants ${anneeScolaire()}`)
  pdfDoc.setCreator('ESPM+')

  const fb = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fr = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const annee = anneeScolaire()

  for (const e of eleves) {
    await buildRecto(pdfDoc, e, annee, fb, fr)
    await buildVerso(pdfDoc, e, fb)
  }

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cartes-etudiants-${annee}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
