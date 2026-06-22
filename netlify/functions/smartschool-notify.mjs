/**
 * netlify/functions/smartschool-notify.mjs
 *
 * Envoie des notifications Smartschool (sendNotification SOAP V3, scope sendnotif)
 * lors d'événements ESPM+.
 *
 * Types supportés :
 *   - "facture"  → notification aux co-accounts (parents) de chaque élève facturé
 *   - "activite" → notification à la liste direction fixe
 *
 * Env vars requises :
 *   SMARTSCHOOL_ACCESS_CODE       mot de passe du profil WS NetlifyApp
 *
 * Env vars optionnelles :
 *   SMARTSCHOOL_API_URL           (défaut: https://espmaritime.smartschool.be/Webservices/V3)
 *   SMARTSCHOOL_TEST_RECIPIENT    si défini, TOUTES les notifications vont uniquement à cet
 *                                 identifiant → mode bêta (Renaud uniquement)
 *   SMARTSCHOOL_NOTIFY_DIRECTION  JSON array des identifiants Smartschool de la direction
 *                                 ex: ["175033","175076"]
 *                                 Ignoré si SMARTSCHOOL_TEST_RECIPIENT est défini
 */

const ALLOWED_ORIGINS = [
  'https://espmaritime.netlify.app',
  'https://develop--espmaritime.netlify.app',
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

/**
 * Envoie une notification via l'API SOAP V3 Smartschool (sendNotification).
 * Requiert le scope "sendnotif" sur le token OAuth.
 *
 * @param {object} opts
 * @param {string} opts.apiUrl        URL de l'endpoint SOAP
 * @param {string} opts.accessCode    Code d'accès WS
 * @param {string} opts.recipient     Identifiant interne Smartschool de l'élève/utilisateur
 * @param {number} opts.coAccount     0 = compte principal, 1 = co-account 1, 2 = co-account 2
 * @param {string} opts.title         Titre de la notification (court)
 * @param {string} opts.description   Corps de la notification (plain text, pas de HTML)
 * @param {string} opts.link          URL à ouvrir lors du clic sur la notification
 */
async function sendNotification({ apiUrl, accessCode, recipient, coAccount, title, description, link }) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://espmaritime.smartschool.be/Webservices/V3">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ns1:sendNotification SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <accesscode xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(accessCode)}</accesscode>
      <title xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(title)}</title>
      <description xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(description)}</description>
      <userIdentifier xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(recipient)}</userIdentifier>
      <coaccount xsi:type="xsd:int" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${coAccount ?? 0}</coaccount>
      <link xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(link ?? '')}</link>
    </ns1:sendNotification>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  try {
    const res = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction:     '"urn:sendNotification"',
      },
      body: envelope,
    })
    const text = await res.text()
    const match = text.match(/<return[^>]*>(-?\d+)<\/return>/)
    const ssCode = match ? parseInt(match[1]) : -999
    const ok = res.ok && ssCode === 0
    return { recipient, coAccount, ok, status: res.status, ssCode }
  } catch (err) {
    return { recipient, coAccount, ok: false, error: err.message }
  }
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || ''
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers })
  }

  const accessCode    = process.env.SMARTSCHOOL_ACCESS_CODE
  const apiUrl        = process.env.SMARTSCHOOL_API_URL || 'https://espmaritime.smartschool.be/Webservices/V3'
  const testRecipient = process.env.SMARTSCHOOL_TEST_RECIPIENT   // ex: "renaud.lecocq" (mode bêta)

  if (!accessCode) {
    return new Response(JSON.stringify({ error: 'SMARTSCHOOL_ACCESS_CODE non configuré' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const { type } = payload
  const results  = []
  const isTest   = Boolean(testRecipient)

  // ── Facture validée ──────────────────────────────────────────────────────────
  if (type === 'facture') {
    const { students = [] } = payload

    for (const student of students) {
      const internalNumber = student.internal_number
      if (!internalNumber && !isTest) continue

      const recipient   = testRecipient || internalNumber
      const title       = 'Nouvelle facture — ESPM+'
      const description = isTest
        ? `[TEST] Facture émise pour ${student.prenom} ${student.nom}. Consultez ESPM+ pour les détails.`
        : `Une facture a été émise pour ${student.prenom} ${student.nom}. Consultez ESPM+ pour les détails.`
      const link = 'https://espmaritime.netlify.app'

      if (isTest) {
        // Mode bêta : une seule notif au compte principal de Renaud
        const r = await sendNotification({ apiUrl, accessCode, recipient, coAccount: 0, title, description, link })
        results.push(r)
      } else {
        // Production : notif aux deux co-accounts (parents) de l'élève
        const [r1, r2] = await Promise.all([
          sendNotification({ apiUrl, accessCode, recipient, coAccount: 1, title, description, link }),
          sendNotification({ apiUrl, accessCode, recipient, coAccount: 2, title, description, link }),
        ])
        results.push(r1, r2)
      }
    }

  // ── Activité publiée ─────────────────────────────────────────────────────────
  } else if (type === 'activite') {
    const { intitule, responsableNom, activiteId } = payload

    const recipients = isTest
      ? [testRecipient]
      : (() => {
          try { return JSON.parse(process.env.SMARTSCHOOL_NOTIFY_DIRECTION || '[]') }
          catch { return [] }
        })()

    const title       = 'Nouvelle activité — ESPM+'
    const description = isTest
      ? `[TEST] ${responsableNom} a publié une activité : "${intitule}".`
      : `${responsableNom} a publié une activité : "${intitule}".`
    const link = activiteId
      ? `https://espmaritime.netlify.app/activites?open=${activiteId}`
      : 'https://espmaritime.netlify.app/activites'

    await Promise.all(
      recipients.map(async (r) => {
        const res = await sendNotification({ apiUrl, accessCode, recipient: r, coAccount: 0, title, description, link })
        results.push(res)
      })
    )

  } else {
    return new Response(JSON.stringify({ error: `Type inconnu : ${type}` }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const nbOk = results.filter(r => r.ok).length
  console.log(`[smartschool-notify] type=${type} sent=${nbOk}/${results.length}${isTest ? ' [BETA/TEST]' : ''}`)

  return new Response(JSON.stringify({ ok: true, sent: nbOk, total: results.length, results }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
