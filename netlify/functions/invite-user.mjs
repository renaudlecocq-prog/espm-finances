import { createClient } from '@supabase/supabase-js'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://iubxalsakqljilydnqss.supabase.co'
  const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_URL      = process.env.URL || 'https://espmaritime.netlify.app'

  if (!SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing service role key' }), { status: 500 })
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { email, role } = await req.json()
  if (!email || !role) {
    return new Response(JSON.stringify({ error: 'email and role are required' }), { status: 400 })
  }

  const VALID_ROLES = ['admin', 'financier', 'mdp', 'responsable']
  if (!VALID_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: SITE_URL + '/',
    data: { role },
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }

  return new Response(JSON.stringify({ success: true, id: data?.user?.id }), { status: 200 })
}

export const config = { path: '/api/invite-user' }
