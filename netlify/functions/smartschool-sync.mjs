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
 *   SMARTSCHOOL_API_URL       (https://espmaritime.smartschool.be/Webservices/V3)
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

async function supabaseUpsert(url, key, table, rows, onConflict = 'smartschool_username') {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
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
  // getAllAccountsExtended nécessite code + recursive explicites (Smartschool v2026)
  const extraParams = method === 'getAllAccountsExtended'
    ? `<soa:code></soa:code><soa:recursive>1</soa:recursive>`
    : ''
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:soa="http://www.smartschool.be/webservices">
  <soapenv:Header/>
  <soapenv:Body>
    <soa:${method}>
      <soa:accesscode>${accessCode}</soa:accesscode>
      ${extraParams}
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
  const SS_URL       = process.env.SMARTSCHOOL_API_URL || 'https://espmaritime.smartschool.be/Webservices/V3'
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
    // basisrol: '1' = élève, '0'/'13'/'30' = personnel
    const elevesRows    = []
    const personnelRows = []

    for (const a of list) {
      const basisrol = String(a.basisrol ?? '').trim()
      const isEleve  = basisrol === '1'

      const smartschool_internal_number = String(
        a.internnummer || a.internnumber || ''
      ).trim() || null
      const smartschool_username = String(
        a.gebruikersnaam || a.username || ''
      ).trim() || null
      if (!smartschool_username && !smartschool_internal_number) continue

      const nom    = (a.naam     || a.surname   || a.name      || '').trim()
      const prenom = (a.voornaam || a.firstname  || a.givenname || '').trim()
      const email  = a.email || null

      // Classe : groupe officiel de type klas (getAllAccountsExtended)
      const klasGroup = Array.isArray(a.groups)
        ? a.groups.find(g => g.isKlas === true && g.isOfficial === true)
        : null
      const classe = klasGroup?.name?.trim() || null

      // Groupes non-klas (pour Compositions) : tous les groupes sauf la klas officielle
      const groupes_ss = Array.isArray(a.groups)
        ? a.groups
            .filter(g => !(g.isKlas === true && g.isOfficial === true))
            .map(g => g.name?.trim())
            .filter(Boolean)
        : []

      // Troubles attestés — champs profil directs (noms français, découverts via getUserDetails)
      const t1 = String(a['Troubles attestés']               || '').trim()
      const t2 = String(a['Aménagements raisonnables']       || '').trim()
      const t3 = String(a['Difficultés sans troubles attestés'] || '').trim()
      const amenagements_raisonnables = [t1, t2, t3].filter(Boolean).join(" — ") || null

      // Sexe — champ standard Smartschool (geslacht : m/v/x)
      const geslacht = String(a.geslacht || a.sex || "").trim().toLowerCase()
      const sexe = geslacht === "m" ? "M" : geslacht === "v" || geslacht === "f" ? "F" : geslacht === "x" ? "X" : null

      // Sortie à midi, Licenciement, Valeur à scanner (carte d'étudiant)
      const sortie_raw = a['Sortie à midi'] ?? a['sortie_midi'] ?? null
      const sortie_midi = sortie_raw === true ? true : sortie_raw === false ? false
        : typeof sortie_raw === 'string' ? (sortie_raw.trim().toLowerCase() === 'oui' || sortie_raw.trim() === '1') : null
      const lic_raw = a['Licenciement'] ?? a['licenciement'] ?? null
      const licenciement = lic_raw === true ? true : lic_raw === false ? false
        : typeof lic_raw === 'string' ? (lic_raw.trim().toLowerCase() === 'oui' || lic_raw.trim() === '1') : null
      const valeur_scanner = String(
        a["Valeur à scanner afin d'identifier l'élève"] ??
        a['Valeur à scanner'] ?? a['valeur_scanner'] ??
        a['barcodevalue'] ?? a['barcodeValue'] ??
        smartschool_internal_number ?? ''
      ).trim() || null

      if (isEleve) {
        elevesRows.push({ smartschool_username, smartschool_internal_number, nom, prenom, email, classe, groupes_ss, amenagements_raisonnables, sexe, sortie_midi, licenciement, valeur_scanner, actif: true })
      } else {
        personnelRows.push({ smartschool_username, smartschool_internal_number, nom, prenom, email, actif: true })
      }
    }

    // ── Upsert élèves ──────────────────────────────────────────────────────
    if (elevesRows.length > 0) {
      await supabaseUpsert(SUPABASE_URL, SUPABASE_KEY, 'eleves', elevesRows)
      // Désactiver les élèves absents de Smartschool
      const usernames = elevesRows.map(r => r.smartschool_username).filter(Boolean)
      if (usernames.length > 0) await fetch(
        `${SUPABASE_URL}/rest/v1/eleves?smartschool_username=not.in.(${usernames.map(i => `"${i}"`).join(',')})&actif=eq.true`,
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

    // Debug : identifier les champs photo/foto dans les données brutes Smartschool
    const firstEleve = list.find(a => String(a.basisrol ?? '').trim() === '1')
    const sampleKeys = firstEleve ? Object.keys(firstEleve).sort() : []
    const photoKeys  = sampleKeys.filter(k => /photo|foto|picture|image|bild|profi/i.test(k))

    return new Response(JSON.stringify({
      success: true, eleves: elevesCount, personnel: personnelCount,
      _debug_sample_keys: sampleKeys,
      _debug_photo_keys: photoKeys,
    }), { status: 200, headers })

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
