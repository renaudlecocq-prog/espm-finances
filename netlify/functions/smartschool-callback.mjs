import { createClient } from '@supabase/supabase-js'

const PLATFORM     = 'https://espmaritime.smartschool.be'
const CLIENT_ID    = process.env.SMARTSCHOOL_CLIENT_ID || '4668f1e85fa4'
const SUPABASE_URL = process.env.SUPABASE_URL          || 'https://iubxalsakqljilydnqss.supabase.co'
const ALLOWED_ORIGINS = [
  'https://espmaritime.netlify.app',
  'https://develop--espmaritime.netlify.app',
]

function makeCors(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function jsonResp(statusCode, body, cors) {
  return { statusCode, headers: cors, body: JSON.stringify(body) }
}

export const handler = async (event) => {
  const reqOrigin = event.headers.origin || event.headers.Origin || ALLOWED_ORIGINS[0]
  const CORS = makeCors(reqOrigin)
  const json = (s, b) => jsonResp(s, b, CORS)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' })

  try {
    const { code, origin: bodyOrigin } = JSON.parse(event.body || '{}')
    const siteOrigin = ALLOWED_ORIGINS.includes(bodyOrigin) ? bodyOrigin : reqOrigin
    const REDIRECT_URI = siteOrigin + '/auth/callback'
    if (!code) return json(400, { error: 'Missing code parameter' })

    const CLIENT_SECRET    = process.env.SMARTSCHOOL_CLIENT_SECRET
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!CLIENT_SECRET || !SERVICE_ROLE_KEY)
      return json(500, { error: 'Variables d\'environnement manquantes (SMARTSCHOOL_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY)' })

    // 1. Échange du code OAuth → access_token
    const tokenRes = await fetch(`${PLATFORM}/OAuth/index/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI,
      }).toString(),
    })
    if (!tokenRes.ok) {
      const detail = await tokenRes.text()
      return json(400, { error: 'Échange de token Smartschool échoué', detail })
    }
    const tokenData    = await tokenRes.json()
    const access_token = tokenData.access_token
    if (!access_token) return json(400, { error: 'Pas d\'access_token reçu', detail: tokenData })

    // 2. Infos utilisateur
    const userRes  = await fetch(`${PLATFORM}/Api/V1/fulluserinfo?access_token=${access_token}`)
    const userInfo = await userRes.json()

    const isCoAccount = userInfo.isCoAccount === 1
    const prenom = isCoAccount ? (userInfo.actualUserName    || userInfo.name    || '') : (userInfo.name    || '')
    const nom    = isCoAccount ? (userInfo.actualUserSurname || userInfo.surname || '') : (userInfo.surname || '')

    const basisrolRaw = String(userInfo.basisrol || '').toLowerCase()
    const isStudent = !isCoAccount && (basisrolRaw.includes('leerling') || basisrolRaw === '1')
    if (isStudent) {
      return json(403, {
        error: 'STUDENT_ACCOUNT_BLOCKED',
        message: "Les comptes élèves principaux n'ont pas accès à cette plateforme.",
      })
    }

    const isStaff = !isCoAccount && (
      basisrolRaw.includes('leerkracht') || basisrolRaw.includes('directeur') ||
      basisrolRaw.includes('beheerder')  || basisrolRaw.includes('administratief') ||
      basisrolRaw === '0' || basisrolRaw === '13' || basisrolRaw === '30'
    )
    // Personnel → mdp ; non-staff (parents) → aucun rôle auto (l'admin assigne responsable manuellement)

    const email = (userInfo.email && userInfo.email.includes('@'))
      ? userInfo.email : `${userInfo.username}@espmaritime.be`

    // 3. Supabase — trouver/créer l'utilisateur
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) throw listErr

    const existing = users.find(u => u.email === email)
    let userId

    if (existing) {
      userId = existing.id
      await supabase.from('profiles').update({ nom, prenom, email }).eq('id', userId)
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { smartschool_username: userInfo.username, smartschool_userID: userInfo.userID },
      })
      if (createErr) throw createErr
      userId = newUser.user.id
      const profilePatch = { nom, prenom }
      if (isStaff) profilePatch.role = 'mdp'
      else         profilePatch.role = 'responsable'  // parents (co-accounts) → responsable dès le 1er login
      await supabase.from('profiles').update(profilePatch).eq('id', userId)
    }

    // 4. Lier le responsable à ses élèves (co-accounts = parents)
    if (isCoAccount && email) {
      const { data: elevesParent } = await supabase
        .from('eleves').select('id')
        .or(`email_coaccount1.eq.${email},email_coaccount2.eq.${email}`)
      if (elevesParent && elevesParent.length > 0) {
        await supabase.from('responsable_eleve').upsert(
          elevesParent.map(e => ({ responsable_id: userId, eleve_id: e.id })),
          { onConflict: 'responsable_id,eleve_id', ignoreDuplicates: true }
        )
      }
    }

    // 5. Générer un magic link → token_hash
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink', email,
      options: { redirectTo: siteOrigin },
    })
    if (linkErr) throw linkErr

    return json(200, {
      token_hash: linkData.properties.hashed_token,
      email, prenom, nom,
    })

  } catch (err) {
    console.error('smartschool-callback error:', err)
    return json(500, { error: err.message || 'Erreur interne' })
  }
}
