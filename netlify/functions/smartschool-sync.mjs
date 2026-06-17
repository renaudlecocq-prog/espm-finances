/**
 * netlify/functions/smartschool-sync.mjs
 *
 * Synchronise élèves et personnel depuis Smartschool WS V3
 * vers les tables `eleves` et `personnel` de Supabase.
 *
 * Env vars requises :
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SMARTSCHOOL_ACCESS_CODE   (mot de passe du profil WS)
 *
 * Env vars optionnelles (valeurs par défaut codées en dur) :
 *   SUPABASE_URL              (https://iubxalsakqljilydnqss.supabase.co)
 *   SMARTSCHOOL_API_URL       (https://espmaritime.smartschool.be/webservices/V3)
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

async function supabaseUpsert(url, key, table, rows) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer:         'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase upsert ${table}: ${res.status} ${text.slice(0,200)}`)
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
  }).catch(() => {})
}

// ── SOAP helper ─────────────────────────────────────────────────────────────

async function soapCall(apiUrl, accessCode, method) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:soa="http://www.smartschool.be/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <soa:${method}>
      <soa:accesscode>${accessCode}</soa:accesscode>
    </soa:${method}>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction:     `"urn:${method}"`,
    },
    body: envelope,
  })
  if (!res.ok) throw new Error(`SOAP ${method}: HTTP ${res.status}`)
  return res.text()
}

// Extract JSON payload from SOAP <return> tag (handles CDATA)
function extractJson(xml) {
  const m = xml.match(/<[^:>]+:return[^>]*>([\s\S]*?)<\/[^:>]+:return>/i)
      || xml.match(/<return[^>]*>([\s\S]*?)<\/return>/i)
  if (!m) return []
  let raw = m[1].trim()
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  if (cdata) raw = cdata[1].trim()
  // Smartschool sometimes returns error codes as plain integers
  if (/^-?\d+$/.test(raw)) throw new Error(`Smartschool error code: ${raw}`)
  try { return JSON.parse(raw) } catch { return [] }
}

// ── Main ────────────────────────────────────────────────────────────────────

export default async function handler(req) {
  const origin  = req.headers.get('origin') || ''
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST')    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iubxalsakqljilydnqss.supabase.co'
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SS_URL       = process.env.SMARTSCHOOL_API_URL || 'https://espmaritime.smartschool.be/webservices/V3'
  const SS_CODE      = process.env.SMARTSCHOOL_ACCESS_CODE

  if (!SUPABASE_KEY) return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }), { status: 500, headers })
  if (!SS_CODE)      return new Response(JSON.stringify({ error: 'SMARTSCHOOL_ACCESS_CODE manquant' }), { status: 500, headers })

  let elevesCount    = 0
  let personnelCount = 0

  try {
    // ── Fetch all accounts via getAllAccountsExtended ───────────────────────
    const xml      = await soapCall(SS_URL, SS_CODE, 'getAllAccountsExtended')
    const accounts = extractJson(xml)
    const list     = Array.isArray(accounts) ? accounts : Object.values(accounts)

    if (!list.length) throw new Error('Aucun compte retourné par Smartschool')

    // ── Split by type ──────────────────────────────────────────────────────
    // Smartschool types: 'leerling' = élève, everything else = personnel
    const elevesRows    = []
    const personnelRows = []

    for (const a of list) {
      const type = (a.basisrol || a.type || a.role || '').toLowerCase()
      const isEleve = type === 'leerling' || type === 'student' || type === 'pupil'

      const smartschool_id = String(a.internnumber || a.username || a.id || '').trim()
      if (!smartschool_id) continue

      const nom    = (a.surname   || a.name      || '').trim()
      const prenom = (a.firstname || a.givenname || '').trim()
      const email  = a.email || null
      const classe = a.class || a.officialclass || a.classname || null

      if (isEleve) {
        elevesRows.push({ smartschool_id, nom, prenom, email, classe, actif: true })
      } else {
        personnelRows.push({ smartschool_id, nom, prenom, email, actif: true })
      }
    }

    // ── Upsert élèves ──────────────────────────────────────────────────────
    if (elevesRows.length > 0) {
      await supabaseUpsert(SUPABASE_URL, SUPABASE_KEY, 'eleves', elevesRows)
      // Désactiver les élèves absents de Smartschool
      const ids = elevesRows.map(r => r.smartschool_id)
      await fetch(
        `${SUPABASE_URL}/rest/v1/eleves?smartschool_id=not.in.(${ids.map(i => `"${i}"`).join(',')})&actif=eq.true`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal',
          },
          body: JSON.stringify({ actif: false }),
        }
      )
      elevesCount = elevesRows.length
    }

    // ── Upsert personnel ───────────────────────────────────────────────────
    if (personnelRows.length > 0) {
      await supabaseUpsert(SUPABASE_URL, SUPABASE_KEY, 'personnel', personnelRows)
      personnelCount = personnelRows.length
    }

    await insertSyncLog(SUPABASE_URL, SUPABASE_KEY, {
      type:               'sync',
      status:             'success',
      eleves_upserted:    elevesCount,
      personnel_upserted: personnelCount,
      details:            `OK — ${elevesCount} élèves, ${personnelCount} personnel`,
    })

    return new Response(JSON.stringify({ success: true, eleves: elevesCount, personnel: personnelCount }), { status: 200, headers })

  } catch (err) {
    const msg = err.message || String(err)
    console.error('[smartschool-sync]', msg)
    await insertSyncLog(SUPABASE_URL, SUPABASE_KEY, {
      type: 'sync', status: 'error',
      eleves_upserted: elevesCount, personnel_upserted: personnelCount,
      details: msg,
    })
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers })
  }
}
