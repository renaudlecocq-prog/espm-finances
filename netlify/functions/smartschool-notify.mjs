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
 *   SMARTSCHOOL_TEST_RECIPIENT    si défini, TOUS les messages vont uniquement à cet identifiant
 *                                 avec préfixe [TEST] → utiliser pour valider sans spammer
 *   SMARTSCHOOL_NOTIFY_DIRECTION  JSON array des identifiants Smartschool de la direction
 *                                 ex: ["175033","175076"]
 *                                 Ignoré si SMARTSCHOOL_TEST_RECIPIENT est défini
 *
 * Note: senderIdentifier omis intentionnellement — les messages apparaissent comme
 * "Indisponible" (aucune réponse possible), ce qui est le comportement voulu.
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

async function sendMsg({ apiUrl, accessCode, recipient, coAccount, title, body }) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://espmaritime.smartschool.be/Webservices/V3">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ns1:sendMsg SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <accesscode xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(accessCode)}</accesscode>
      <userIdentifier xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(recipient)}</userIdentifier>
      <title xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(title)}</title>
      <body xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${escapeXml(body)}</body>
      <coaccount xsi:type="xsd:int" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${coAccount ?? 0}</coaccount>
    </ns1:sendMsg>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

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
    const ok = res.ok && ssCode === 0   // ssCode=0 = succès Smartschool
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
      const msgBody   = `<p>Bonjour,</p><p>Une nouvelle facture a été émise pour <strong>${student.prenom} ${student.nom}</strong>.</p><p><a href="https://espmaritime.netlify.app" style="display:inline-block;background-color:#E86C00;color:#ffffff;padding:9px 18px;border-radius:6px;text-decoration:none;font-weight:bold;font-family:Arial,sans-serif;font-size:14px;">↗ ESPM+</a></p>`

      if (isTest) {
        const r = await sendMsg({ apiUrl, accessCode, recipient, coAccount: 0, title: msgTitle, body: msgBody })
        results.push(r)
      } else {
        const [r1, r2] = await Promise.all([
          sendMsg({ apiUrl, accessCode, recipient, coAccount: 1, title: msgTitle, body: msgBody }),
          sendMsg({ apiUrl, accessCode, recipient, coAccount: 2, title: msgTitle, body: msgBody }),
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
    const msgBody  = `<p>Bonjour,</p><p>Une nouvelle activité a été publiée par <strong>${responsableNom}</strong> : "${intitule}".</p><p><a href="${lienActivite}" style="display:inline-block;background-color:#E86C00;color:#ffffff;padding:9px 18px;border-radius:6px;text-decoration:none;font-weight:bold;font-family:Arial,sans-serif;font-size:14px;">↗ ESPM+</a></p>`

    await Promise.all(
      recipients.map(async (r) => {
        const res = await sendMsg({ apiUrl, accessCode, recipient: r, coAccount: 0, title: msgTitle, body: msgBody })
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
