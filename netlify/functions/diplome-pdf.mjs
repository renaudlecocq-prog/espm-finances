// diplome-pdf.mjs
// POST /.netlify/functions/diplome-pdf
// body: { ids: [UUID,...], token: JWT, annee_scolaire: "2025-2026", date_proclamation: "27 juin 2026" }
// Génère un PDF A4 paysage avec les diplômes de proclamation — Puppeteer + gabarit HTML

import { createClient } from '@supabase/supabase-js'
import chromium       from '@sparticuz/chromium'
import puppeteer      from 'puppeteer-core'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iubxalsakqljilydnqss.supabase.co'
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const TEMPLATE   = readFileSync(join(__dirname, 'templates/gabarit-diplome-espm.html'), 'utf-8')

function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function anneeScolaireAuto() {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

function buildHtml(eleves, annee_scolaire, date_proclamation) {
  const headMatch = TEMPLATE.match(/<head>([\s\S]*?)<\/head>/)
  const headInner = headMatch ? headMatch[1] : ''

  const bodyStart  = TEMPLATE.indexOf('<body>') + '<body>'.length
  const bodyEnd    = TEMPLATE.lastIndexOf('</body>')
  const pageTemplate = TEMPLATE.slice(bodyStart, bodyEnd).trim()

  const pages = eleves.map((e, idx) => {
    const pageHtml = pageTemplate
      .replaceAll('{{PRENOM}}', escapeHtml(e.prenom || ''))
      .replaceAll('{{NOM}}',    escapeHtml(e.nom || ''))
      .replaceAll('{{ANNEE_SCOLAIRE}}',    escapeHtml(annee_scolaire))
      .replaceAll('{{DATE_PROCLAMATION}}', escapeHtml(date_proclamation))

    if (idx === 0) return pageHtml
    return pageHtml.replace('<div class="d-page">', '<div class="d-page" style="page-break-before:always;">')
  })

  const printCss = `
    <style>
      body { background: #ffffff !important; display: block !important; min-height: 0 !important; padding: 0; margin: 0; }
      .d-page { box-shadow: none !important; margin: 0 !important; }
      @page { size: A4 landscape; margin: 0; }
    </style>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
${headInner}
${printCss}
</head>
<body>
${pages.join('\n')}
</body>
</html>`
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch { return new Response('JSON invalide', { status: 400 }) }

  const { ids, token, annee_scolaire, date_proclamation } = body
  if (!Array.isArray(ids) || ids.length === 0 || !token) {
    return new Response('Parametres manquants', { status: 400 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SRK)
  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return new Response('Non autorise', { status: 401 })

  const { data: eleves, error } = await sb
    .from('eleves')
    .select('id, nom, prenom, classe')
    .in('id', ids.slice(0, 200))
    .order('nom').order('prenom')

  if (error || !eleves) return new Response('Erreur chargement eleves', { status: 500 })

  const annee = annee_scolaire || anneeScolaireAuto()
  const date  = date_proclamation || ''

  const html = buildHtml(eleves, annee, date)

  let browser
  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
      headless:        chromium.headless,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })

    const pdf = await page.pdf({
      format:          'A4',
      landscape:       true,
      printBackground: true,
      margin:          { top: 0, right: 0, bottom: 0, left: 0 },
    })

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="diplomes-proclamation-${annee.replace(/\s/g,'')}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('diplome-pdf error:', err)
    return new Response('Erreur generation PDF: ' + err.message, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
