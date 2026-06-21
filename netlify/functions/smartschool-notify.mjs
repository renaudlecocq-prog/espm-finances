/**
 * netlify/functions/smartschool-notify.mjs
 *
 * Envoie des messages Smartschool (sendMsg SOAP V3) lors d'événements ESPM+.
 *
 * Types supportés :
 *   - "facture"  → message aux co-accounts (parents) de chaque élève facturé
 *   - "activite" → message à la liste direction fixe
 *
 * Env vars requises :
 *   SMARTSCHOOL_ACCESS_CODE       mot de passe du profil WS NetlifyApp
 *
 * Env vars optionnelles :
 *   SMARTSCHOOL_API_URL           (défaut: https://espmaritime.smartschool.be/Webservices/V3)
 *   SMARTSCHOOL_NOTIFY_SENDER     identifiant Smartschool de l'expéditeur (ex: compte ESPM+)
 *                                 Si absent, 'Null' = pas d'expéditeur affiché
 *   SMARTSCHOOL_TEST_RECIPIENT    si défini, TOUS les messages vont uniquement à cet identifiant
 *                                 avec préfixe [TEST] → utiliser pour valider sans spammer
 *   SMARTSCHOOL_NOTIFY_DIRECTION  JSON array des identifiants Smartschool de la direction
 *                                 ex: ["lecocq.r","dupont.m","martin.a","henry.s"]
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

async function sendMsg({ apiUrl, accessCode, recipient, coAccount, title, body, sender }) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:soa="http://www.smartschool.be/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <soa:sendMsg>
      <soa:accesscode>${escapeXml(accessCode)}</soa:accesscode>
      <soa:userIdentifier>${escapeXml(recipient)}</soa:userIdentifier>
      <soa:title>${escapeXml(title)}</soa:title>
      <soa:body>${escapeXml(body)}</soa:body>
      <soa:senderIdentifier>${escapeXml(sender || 'Null')}</soa:senderIdentifier>
      <soa:coaccount>${coAccount ?? 0}</soa:coaccount>
    </soa:sendMsg>
  </soapenv:Body>
</soapenv:Envelope>`

  try {
    const res = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction:     '"urn:sendMsg"',
      },
      body: envelope,
    })
    const text = await res.text()
    const match = text.match(/<return[^>]*>(-?\d+)<\/return>/)
    const ssCode = match ? parseInt(match[1]) : -999
    const ok = res.ok && ssCode > 0
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
  const sender        = process.env.SMARTSCHOOL_NOTIFY_SENDER || 'Null'
  const testRecipient = process.env.SMARTSCHOOL_TEST_RECIPIENT

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

  if (type === 'facture') {
    const { students = [] } = payload
    const isTest = Boolean(testRecipient)

    for (const student of students) {
      const internalNumber = student.internal_number
      if (!internalNumber && !isTest) continue

      const recipient = testRecipient || internalNumber
      const msgTitle  = isTest ? `[TEST] Nouvelle facture — ESPM+` : `Nouvelle facture — ESPM+`
      const msgBody   = `Bonjour,\n\nUne nouvelle facture a été émise pour ${student.prenom} ${student.nom}.\n\nConsultez-la sur : https://espmaritime.netlify.app`

      if (isTest) {
        const r = await sendMsg({ apiUrl, accessCode, recipient, coAccount: 0, title: msgTitle, body: msgBody, sender })
        results.push(r)
      } else {
        const [r1, r2] = await Promise.all([
          sendMsg({ apiUrl, accessCode, recipient, coAccount: 1, title: msgTitle, body: msgBody, sender }),
          sendMsg({ apiUrl, accessCode, recipient, coAccount: 2, title: msgTitle, body: msgBody, sender }),
        ])
        results.push(r1, r2)
      }
    }

  } else if (type === 'activite') {
    const { intitule, responsableNom, activiteId } = payload
    const isTest = Boolean(testRecipient)

    let recipients = []
    if (isTest) {
      recipients = [testRecipient]
    } else {
      try {
        recipients = JSON.parse(process.env.SMARTSCHOOL_NOTIFY_DIRECTION || '[]')
      } catch {
        recipients = []
      }
    }

    const msgTitle = isTest ? `[TEST] Nouvelle activité — ESPM+` : `Nouvelle activité — ESPM+`
    const lienActivite = activiteId
      ? `https://espmaritime.netlify.app/activites?open=${activiteId}`
      : `https://espmaritime.netlify.app/activites`
    const msgBody  = `Bonjour,\n\nUne nouvelle activité a été publiée par ${responsableNom} : "${intitule}".\n\nConsultez-la sur : ${lienActivite}`

    await Promise.all(
      recipients.map(async (r) => {
        const res = await sendMsg({ apiUrl, accessCode, recipient: r, coAccount: 0, title: msgTitle, body: msgBody, sender })
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
  console.log(`[smartschool-notify] type=${type} sent=${nbOk}/${results.length}${testRecipient ? ' [TEST]' : ''}`)

  return new Response(JSON.stringify({ ok: true, sent: nbOk, total: results.length, results }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
