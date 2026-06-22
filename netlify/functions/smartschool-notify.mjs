/**
 * netlify/functions/smartschool-notify.mjs
 *
 * Envoie des messages Smartschool (inbox) via SOAP V3 sendMsg.
 *
 * Note : sendNotification (push) n'est pas disponible via SOAP V3 ni via REST
 * client_credentials (sub vide → HTTP 500). sendMsg (inbox) est la seule méthode
 * fiable avec les droits actuels.
 *
 * Types :
 *   - "facture"  → message aux co-accounts (parents) de chaque élève facturé
 *   - "activite" → message à la liste direction fixe
 *
 * Env vars requises :
 *   SMARTSCHOOL_ACCESS_CODE  code d'accès SOAP V3
 *
 * Env vars optionnelles :
 *   SMARTSCHOOL_API_URL           (défaut: https://espmaritime.smartschool.be/Webservices/V3)
 *   SMARTSCHOOL_TEST_RECIPIENT    si défini → mode bêta (tous les messages vont à ce compte)
 *   SMARTSCHOOL_NOTIFY_DIRECTION  JSON array des identifiants Smartschool de la direction
 */

const ALLOWED_ORIGINS = [
  'https://espmaritime.netlify.app',
  'https://develop--espmaritime.netlify.app',
  'https://espmaritime-staging.netlify.app',
  'http://localhost:5173',
]

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function sendMsg({ apiUrl, accessCode, recipient, coAccount, title, body }) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://espmaritime.smartschool.be/Webservices/V3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/">
  <SOAP-ENV:Body>
    <ns1:sendMsg SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <accesscode xsi:type="xsd:string">${escapeXml(accessCode)}</accesscode>
      <userIdentifier xsi:type="xsd:string">${escapeXml(recipient)}</userIdentifier>
      <title xsi:type="xsd:string">${escapeXml(title)}</title>
      <body xsi:type="xsd:string">${escapeXml(body)}</body>
      <coaccount xsi:type="xsd:int">${coAccount ?? 0}</coaccount>
    </ns1:sendMsg>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  try {
    const res  = await fetch(apiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '"urn:sendMsg"' },
      body:    envelope,
    })
    const text = await res.text()
    const match = text.match(/<return[^>]*>(-?\d+)<\/return>/)
    const ssCode = match ? parseInt(match[1], 10) : null
    const ok = ssCode === 0
    console.log(`[sendMsg] recipient=${recipient} coAccount=${coAccount} ssCode=${ssCode} ok=${ok}`)
    return { recipient, coAccount, ok, ssCode }
  } catch (err) {
    return { recipient, coAccount, ok: false, error: err.message }
  }
}

export default async function handler(req) {
  const origin  = req.headers.get('origin') || ''
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers })

  const accessCode    = process.env.SMARTSCHOOL_ACCESS_CODE
  const apiUrl        = process.env.SMARTSCHOOL_API_URL || 'https://espmaritime.smartschool.be/Webservices/V3'
  const testRecipient = process.env.SMARTSCHOOL_TEST_RECIPIENT

  if (!accessCode) {
    return new Response(JSON.stringify({ error: 'SMARTSCHOOL_ACCESS_CODE non configuré' }), {
      status:  500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  let payload
  try { payload = await req.json() }
  catch { return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }) }

  const { type } = payload
  const results  = []
  const isTest   = Boolean(testRecipient)

  // ── Facture validée ──────────────────────────────────────────────────────────
  if (type === 'facture') {
    const { students = [] } = payload

    for (const student of students) {
      const internalNumber = student.internal_number
      if (!internalNumber && !isTest) continue

      const recipient = testRecipient || internalNumber
      const title     = 'Nouvelle facture — ESPM+'
      const body      = isTest
        ? `[TEST] Une facture a été émise pour ${student.prenom} ${student.nom}.\nConsultez ESPM+ pour les détails : https://espmaritime.netlify.app`
        : `Une facture a été émise pour ${student.prenom} ${student.nom}.\nConsultez ESPM+ pour les détails : https://espmaritime.netlify.app`

      if (isTest) {
        const r = await sendMsg({ apiUrl, accessCode, recipient, coAccount: 0, title, body })
        results.push(r)
      } else {
        const [r1, r2] = await Promise.all([
          sendMsg({ apiUrl, accessCode, recipient, coAccount: 1, title, body }),
          sendMsg({ apiUrl, accessCode, recipient, coAccount: 2, title, body }),
        ])
        results.push(r1, r2)
      }
    }

  // ── Activité publiée ─────────────────────────────────────────────────────────
  } else if (type === 'activite') {
    const { intitule, responsableNom, activiteId } = payload

    const recipients = isTest
      ? [testRecipient]
      : (() => { try { return JSON.parse(process.env.SMARTSCHOOL_NOTIFY_DIRECTION || '[]') } catch { return [] } })()

    const link  = activiteId
      ? `https://espmaritime.netlify.app/activites?open=${activiteId}`
      : 'https://espmaritime.netlify.app/activites'
    const title = 'Nouvelle activité — ESPM+'
    const body  = isTest
      ? `[TEST] ${responsableNom} a publié une activité : "${intitule}".\n${link}`
      : `${responsableNom} a publié une activité : "${intitule}".\n${link}`

    await Promise.all(
      recipients.map(async (r) => {
        const res = await sendMsg({ apiUrl, accessCode, recipient: r, coAccount: 0, title, body })
        results.push(res)
      })
    )

  } else {
    return new Response(JSON.stringify({ error: `Type inconnu : ${type}` }), {
      status:  400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const nbOk = results.filter(r => r.ok).length
  console.log(`[smartschool-notify] type=${type} sent=${nbOk}/${results.length}${isTest ? ' [BETA/TEST]' : ''}`)

  return new Response(JSON.stringify({ ok: true, sent: nbOk, total: results.length, results }), {
    status:  200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
