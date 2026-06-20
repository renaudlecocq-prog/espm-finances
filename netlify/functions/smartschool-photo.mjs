/**
 * netlify/functions/smartschool-photo.mjs
 *
 * Retourne la photo d'un élève via Smartschool getAccountPhoto.
 * POST { username: 'string' }  →  { photo: 'data:image/jpeg;base64,...' }
 */

const ALLOWED_ORIGINS = [
  'https://espmaritime.netlify.app',
  'https://espmaritime-staging.netlify.app',
  'https://develop--espmaritime.netlify.app',
]

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function getAccountPhoto(apiUrl, accessCode, username) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:soa="http://www.smartschool.be/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <soa:getAccountPhoto>
      <soa:accesscode>${accessCode}</soa:accesscode>
      <soa:userIdentifier>${username}</soa:userIdentifier>
    </soa:getAccountPhoto>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction:     '"urn:getAccountPhoto"',
    },
    body: envelope,
  })
  if (!res.ok) throw new Error(`SOAP HTTP ${res.status}`)
  const xml = await res.text()

  // Extraire la valeur de retour
  const m = xml.match(/<[^:>]+:return[^>]*>([\s\S]*?)<\/[^:>]+:return>/i)
           || xml.match(/<return[^>]*>([\s\S]*?)<\/return>/i)
  if (!m) throw new Error('No return in SOAP response')

  let raw = m[1].trim()
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  if (cdata) raw = cdata[1].trim()

  // Smartschool renvoie un entier négatif en cas d'erreur
  if (/^-?\d+$/.test(raw)) throw new Error(`Smartschool error: ${raw}`)

  // raw est la photo en base64
  return raw
}

export default async function handler(req) {
  const origin  = req.headers.get('origin') || ''
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })

  const SS_URL  = process.env.SMARTSCHOOL_API_URL  || 'https://espmaritime.smartschool.be/Webservices/V3'
  const SS_CODE = process.env.SMARTSCHOOL_ACCESS_CODE

  if (!SS_CODE)
    return new Response(JSON.stringify({ error: 'SMARTSCHOOL_ACCESS_CODE manquant' }), { status: 500, headers })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers })
  }

  const { username } = body
  if (!username)
    return new Response(JSON.stringify({ error: 'username requis' }), { status: 400, headers })

  try {
    const b64 = await getAccountPhoto(SS_URL, SS_CODE, username)
    if (!b64)
      return new Response(JSON.stringify({ photo: null }), { status: 200, headers })
    return new Response(
      JSON.stringify({ photo: `data:image/jpeg;base64,${b64}` }),
      { status: 200, headers }
    )
  } catch (err) {
    // Pas de photo = pas une erreur fatale
    return new Response(JSON.stringify({ photo: null, error: err.message }), { status: 200, headers })
  }
}
