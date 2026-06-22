/**
 * netlify/functions/smartschool-notify.mjs
 *
 * Envoie des notifications Smartschool lors d'événements ESPM+.
 *
 * Méthode : SOAP V3 sendNotification avec authentification OAuth2 Bearer
 *   - Le token est obtenu via client_credentials (machine-to-machine, sans redirect)
 *   - Smartschool retourne HTTP 200 + body vide = succès
 *
 * Types supportés :
 *   - "facture"  → notification aux co-accounts (parents) de chaque élève facturé
 *   - "activite" → notification à la liste direction fixe
 *
 * Env vars requises :
 *   SMARTSCHOOL_CLIENT_ID       identifiant OAuth2 de l'application ESPM+
 *   SMARTSCHOOL_CLIENT_SECRET   secret OAuth2
 *
 * Env vars optionnelles :
 *   SMARTSCHOOL_API_URL           (défaut: https://espmaritime.smartschool.be/Webservices/V3)
 *   SMARTSCHOOL_OAUTH_URL         (défaut: https://espmaritime.smartschool.be/OAuth/index/token)
 *   SMARTSCHOOL_TEST_RECIPIENT    si défini → mode bêta (toutes les notifs vont à cet identifiant)
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

/**
 * Obtient un token OAuth2 via client_credentials (machine-to-machine).
 * Scope : sendnotif — ne nécessite pas de redirect URI ni d'intervention utilisateur.
 */
async function getOAuthToken(oauthUrl, clientId, clientSecret) {
  const res = await fetch(oauthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'sendnotif',
    }).toString(),
  })
  if (!res.ok) throw new Error(`OAuth token error: HTTP ${res.status}`)
  const data = await res.json()
  if (!data.access_token) throw new Error('Pas de access_token dans la réponse OAuth')
  return data.access_token
}

/**
 * Envoie une notification push via SOAP V3 sendNotification authentifié OAuth Bearer.
 * Smartschool retourne HTTP 200 avec body vide = succès.
 */
async function sendNotification({ apiUrl, oauthToken, recipient, coAccount, title, description, link }) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://espmaritime.smartschool.be/Webservices/V3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ns1:sendNotification SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <accesscode xsi:type="xsd:string">OAUTH</accesscode>
      <title xsi:type="xsd:string">${escapeXml(title)}</title>
      <description xsi:type="xsd:string">${escapeXml(description)}</description>
      <userIdentifier xsi:type="xsd:string">${escapeXml(recipient)}</userIdentifier>
      <coaccount xsi:type="xsd:int">${coAccount ?? 0}</coaccount>
      <link xsi:type="xsd:string">${escapeXml(link ?? '')}</link>
    </ns1:sendNotification>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  try {
    const res = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'text/xml; charset=utf-8',
        'SOAPAction':    '"urn:sendNotification"',
        'Authorization': `Bearer ${oauthToken}`,
      },
      body: envelope,
    })
    const text = await res.text()
    // Smartschool retourne HTTP 200 + body vide = succès (authentification OAuth)
    const ok = res.ok && text.trim() === ''
    console.log(`[sendNotification] recipient=${recipient} coAccount=${coAccount} HTTP=${res.status} bodyLen=${text.length} ok=${ok}`)
    return { recipient, coAccount, ok, status: res.status }
  } catch (err) {
    return { recipient, coAccount, ok: false, error: err.message }
  }
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || ''
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers })

  const clientId     = process.env.SMARTSCHOOL_CLIENT_ID
  const clientSecret = process.env.SMARTSCHOOL_CLIENT_SECRET
  const apiUrl       = process.env.SMARTSCHOOL_API_URL   || 'https://espmaritime.smartschool.be/Webservices/V3'
  const oauthUrl     = process.env.SMARTSCHOOL_OAUTH_URL || 'https://espmaritime.smartschool.be/OAuth/index/token'
  const testRecipient = process.env.SMARTSCHOOL_TEST_RECIPIENT

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'SMARTSCHOOL_CLIENT_ID / CLIENT_SECRET non configurés' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  let payload
  try { payload = await req.json() }
  catch { return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }) }

  // Obtenir un token OAuth frais pour cette invocation
  let oauthToken
  try {
    oauthToken = await getOAuthToken(oauthUrl, clientId, clientSecret)
    console.log('[smartschool-notify] OAuth token OK')
  } catch (err) {
    console.error('[smartschool-notify] OAuth token error:', err.message)
    return new Response(JSON.stringify({ error: 'Impossible d\'obtenir le token OAuth: ' + err.message }), {
      status: 500,
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
        ? `[TEST] Une facture a été émise pour ${student.prenom} ${student.nom}. Consultez ESPM+ pour les détails.`
        : `Une facture a été émise pour ${student.prenom} ${student.nom}. Consultez ESPM+ pour les détails.`
      const link = 'https://espmaritime.netlify.app'

      if (isTest) {
        const r = await sendNotification({ apiUrl, oauthToken, recipient, coAccount: 0, title, description, link })
        results.push(r)
      } else {
        const [r1, r2] = await Promise.all([
          sendNotification({ apiUrl, oauthToken, recipient, coAccount: 1, title, description, link }),
          sendNotification({ apiUrl, oauthToken, recipient, coAccount: 2, title, description, link }),
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

    const title       = 'Nouvelle activité — ESPM+'
    const description = isTest
      ? `[TEST] ${responsableNom} a publié une activité : "${intitule}".`
      : `${responsableNom} a publié une activité : "${intitule}".`
    const link = activiteId
      ? `https://espmaritime.netlify.app/activites?open=${activiteId}`
      : 'https://espmaritime.netlify.app/activites'

    await Promise.all(
      recipients.map(async (r) => {
        const res = await sendNotification({ apiUrl, oauthToken, recipient: r, coAccount: 0, title, description, link })
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
