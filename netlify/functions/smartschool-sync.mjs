/**
 * netlify/functions/smartschool-sync.mjs
 *
 * Synchronise les élèves et le personnel depuis Smartschool (WS V3)
 * vers les tables `eleves` et `personnel` de Supabase.
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL            (ex: https://iubxalsakqljilydnqss.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SMARTSCHOOL_API_URL     (ex: https://espmaritime.smartschool.be/webservices/V3)
 *   SMARTSCHOOL_ACCESS_CODE (code d'accès API Smartschool)
 */

const ALLOWED_ORIGINS = [
  'https://espmaritime.netlify.app',
  'https://develop--espmaritime.netlify.app',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function supabaseRpc(url, key, table, method, body) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method,
    headers: {
      apikey:          key,
      Authorization:   `Bearer ${key}`,
      'Content-Type':  'application/json',
      Prefer:          'resolution=merge-duplicates,return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`)
  }
}

async function insertSyncLog(url, key, data) {
  await fetch(`${url}/rest/v1/sync_log`, {
    method: 'POST',
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(data),
  })
}

// ── Smartschool SOAP helper ────────────────────────────────────────────────

async function soapCall(apiUrl, accessCode, methodName, extraParams = '') {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:soa="http://www.smartschool.be/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <soa:${methodName}>
      <soa:accesscode>${accessCode}</soa:accesscode>
      ${extraParams}
    </soa:${methodName}>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction:     `"${methodName}"`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Smartschool SOAP ${methodName}: HTTP ${res.status}`)
  return res.text()
}

// Minimal XML parser for Smartschool responses (returns inner text of first match)
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\/(?:[^:>]+:)?${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

// Parse getAllAccountsExtended / getAllStudents response
// Returns array of objects from <param1> JSON payload
function parseAccountsResponse(xml) {
  const raw = extractTag(xml, 'return')
  // Smartschool returns JSON inside the SOAP response
  try {
    return JSON.parse(raw)
  } catch {
    // Sometimes it's wrapped in <![CDATA[...]]>
    const cdataMatch = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
    if (cdataMatch) {
      try { return JSON.parse(cdataMatch[1]) } catch { return [] }
    }
    return []
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function handler(req) {
  const origin = req.headers.get('origin') || ''
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST')    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })

  const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://iubxalsakqljilydnqss.supabase.co'
  const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SS_API_URL    = process.env.SMARTSCHOOL_API_URL    || 'https://espmaritime.smartschool.be/webservices/V3'
  const SS_CODE       = process.env.SMARTSCHOOL_ACCESS_CODE

  if (!SUPABASE_KEY) return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }), { status: 500, headers })
  if (!SS_CODE)      return new Response(JSON.stringify({ error: 'SMARTSCHOOL_ACCESS_CODE manquant' }), { status: 500, headers })

  let elevesCount     = 0
  let personnelCount  = 0
  let errorMessage    = null

  try {
    // ── 1. Fetch all students ──────────────────────────────────────────────
    const studentsXml  = await soapCall(SS_API_URL, SS_CODE, 'getAllStudents')
    const studentsRaw  = parseAccountsResponse(studentsXml)
    const students     = Array.isArray(studentsRaw) ? studentsRaw : Object.values(studentsRaw)

    const elevesRows = students.map(s => ({
      smartschool_id:  String(s.internnumber || s.username || s.id || ''),
      nom:             s.surname || s.name || '',
      prenom:          s.firstname || s.givenname || '',
      email:           s.email || null,
      classe:          s.class || s.classname || null,
      actif:           true,
    })).filter(r => r.smartschool_id)

    if (elevesRows.length > 0) {
      await supabaseRpc(SUPABASE_URL, SUPABASE_KEY, 'eleves', 'POST', elevesRows)
      // Mark students not in Smartschool as inactive
      const activeIds = elevesRows.map(r => r.smartschool_id)
      await fetch(`${SUPABASE_URL}/rest/v1/eleves?smartschool_id=not.in.(${activeIds.map(id => `"${id}"`).join(',')})`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ actif: false }),
      })
    }
    elevesCount = elevesRows.length

    // ── 2. Fetch all staff ────────────────────────────────────────────────
    const staffXml   = await soapCall(SS_API_URL, SS_CODE, 'getAllPersonnel')
    const staffRaw   = parseAccountsResponse(staffXml)
    const staff      = Array.isArray(staffRaw) ? staffRaw : Object.values(staffRaw)

    const personnelRows = staff.map(p => ({
      smartschool_id: String(p.internnumber || p.username || p.id || ''),
      nom:            p.surname || p.name || '',
      prenom:         p.firstname || p.givenname || '',
      email:          p.email || null,
      actif:          true,
    })).filter(r => r.smartschool_id)

    if (personnelRows.length > 0) {
      await supabaseRpc(SUPABASE_URL, SUPABASE_KEY, 'personnel', 'POST', personnelRows)
    }
    personnelCount = personnelRows.length

    // ── 3. Log success ────────────────────────────────────────────────────
    await insertSyncLog(SUPABASE_URL, SUPABASE_KEY, {
      type:               'sync',
      status:             'success',
      eleves_upserted:    elevesCount,
      personnel_upserted: personnelCount,
      details:            `Synchronisation réussie — ${elevesCount} élèves, ${personnelCount} personnel`,
    })

    return new Response(JSON.stringify({
      success: true,
      eleves:  elevesCount,
      personnel: personnelCount,
    }), { status: 200, headers })

  } catch (err) {
    errorMessage = err.message || String(err)
    console.error('[smartschool-sync] Error:', errorMessage)

    await insertSyncLog(SUPABASE_URL, SUPABASE_KEY, {
      type:               'sync',
      status:             'error',
      eleves_upserted:    elevesCount,
      personnel_upserted: personnelCount,
      details:            errorMessage,
    }).catch(() => {})

    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers })
  }
}
