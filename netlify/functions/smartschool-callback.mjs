import { createClient } from '@supabase/supabase-js'

const PLATFORM     = 'https://espmaritime.smartschool.be'
const CLIENT_ID    = process.env.SMARTSCHOOL_CLIENT_ID || '4668f1e85fa4'
const REDIRECT_URI = 'https://espmaritime.netlify.app/auth/callback'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iubxalsakqljilydnqss.supabase.co'
const ALLOWED_ORIGINS = [
  'https://espmaritime.netlify.app',
  'https://espmaritime-staging.netlify.app',
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

// Rôles qui ne doivent jamais être écrasés par l'auto-détection Smartschool
const PROTECTED_ROLES = ['super_admin', 'admin', 'direction', 'financier', 'educatif', 'pedagogique']

export const handler = async (event) => {
  const reqOrigin = event.headers.origin || event.headers.Origin || ALLOWED_ORIGINS[0]
  const CORS = makeCors(reqOrigin)
  const json = (s, b) => jsonResp(s, b, CORS)

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' })

  try {
    const { code } = JSON.parse(event.body || '{}')
    if (!code) return json(400, { error: 'Missing code parameter' })

    const CLIENT_SECRET    = process.env.SMARTSCHOOL_CLIENT_SECRET
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!CLIENT_SECRET || !SERVICE_ROLE_KEY)
      return json(500, { error: 'Variables d\'environnement manquantes' })

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

    // 2. Infos utilisateur Smartschool
    const userRes  = await fetch(`${PLATFORM}/Api/V1/fulluserinfo?access_token=${access_token}`)
    const userInfo = await userRes.json()

    const isCoAccount  = userInfo.isCoAccount === 1
    const basisrolRaw  = String(userInfo.basisrol || '').toLowerCase().trim()

    // Élève = compte principal avec basisrol leerling/élève ou code 1
    const isStudent = !isCoAccount && (
      basisrolRaw.includes('leerling') ||
      basisrolRaw.includes('élève') || basisrolRaw.includes('eleve') ||
      basisrolRaw === '1'
    )
    if (isStudent) {
      return json(403, {
        error: 'STUDENT_ACCOUNT_BLOCKED',
        message: "Les comptes élèves n'ont pas accès à cette plateforme.",
      })
    }

    // Staff = Direction / Enseignant / Autre (FR) ou leerkracht / directeur / beheerder (NL) ou codes
    const isStaff = !isCoAccount && (
      basisrolRaw.includes('direction')     ||
      basisrolRaw.includes('enseignant')    ||
      basisrolRaw.includes('autre')         ||
      basisrolRaw.includes('leerkracht')    ||
      basisrolRaw.includes('directeur')     ||
      basisrolRaw.includes('beheerder')     ||
      basisrolRaw.includes('administratief') ||
      basisrolRaw === '0' || basisrolRaw === '13' || basisrolRaw === '30'
    )

    // Rôle à assigner selon Smartschool
    // isCoAccount = parent (compte secondaire d'un élève) → responsable
    // isStaff     = personnel → mdp
    // autre (compte principal non-élève, non-staff) → responsable par défaut
    const smartschoolRole = isStaff ? 'mdp' : 'responsable'

    const prenom = isCoAccount ? (userInfo.actualUserName    || userInfo.name    || '') : (userInfo.name    || '')
    const nom    = isCoAccount ? (userInfo.actualUserSurname || userInfo.surname || '') : (userInfo.surname || '')
    const email  = (userInfo.email && userInfo.email.includes('@'))
      ? userInfo.email : `${userInfo.username}@espmaritime.be`

    // 3. Supabase — trouver/créer l'utilisateur
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) throw listErr

    const existing = users.find(u => u.email === email)
    let userId

    if (existing) {
      userId = existing.id

      // Lire le rôle actuel — ne jamais écraser admin/financier
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).single()
      const currentRole    = prof?.role
      const roleToApply    = PROTECTED_ROLES.includes(currentRole) ? currentRole : smartschoolRole

      await supabase.from('profiles')
        .update({ nom, prenom, email, role: roleToApply })
        .eq('id', userId)
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { smartschool_username: userInfo.username, smartschool_userID: userInfo.userID },
      })
      if (createErr) throw createErr
      userId = newUser.user.id
      await supabase.from('profiles')
        .update({ nom, prenom, role: smartschoolRole })
        .eq('id', userId)
    }

    // 4. Lier le parent (co-account) à ses élèves via responsable_eleve
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

    // 5. Générer un magic link → token_hash pour connexion Supabase
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink', email,
      options: { redirectTo: 'https://espmaritime.netlify.app' },
    })
    if (linkErr) throw linkErr

    return json(200, { token_hash: linkData.properties.hashed_token, email, prenom, nom })

  } catch (err) {
    console.error('smartschool-callback error:', err)
    return json(500, { error: err.message || 'Erreur interne' })
  }
}
