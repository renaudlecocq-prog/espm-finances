import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const [status,  setStatus]  = useState('Connexion en cours…')
  const [blocked, setBlocked] = useState(false)
  const [blockedMsg, setBlockedMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const code  = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setStatus('Smartschool a refusé la connexion : ' + error)
      setTimeout(() => navigate('/login'), 3000)
      return
    }
    if (!code) {
      navigate('/login')
      return
    }
    handleCallback(code)
  }, [])

  async function handleCallback(code) {
    try {
      setStatus('Vérification de votre compte Smartschool…')

      const res = await fetch('/.netlify/functions/smartschool-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, origin: window.location.origin }),
      })

      const data = await res.json()

      if (res.status === 403 && data.error === 'STUDENT_ACCOUNT_BLOCKED') {
        setBlocked(true)
        setBlockedMsg(data.message)
        return
      }

      if (data.error) {
        console.error('OAuth error:', data)
        setStatus('Erreur : ' + data.error)
        setTimeout(() => navigate('/login'), 4000)
        return
      }

      setStatus('Finalisation de la session…')

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      })

      if (verifyErr) {
        console.error('verifyOtp error:', verifyErr)
        setStatus('Erreur de session : ' + verifyErr.message)
        setTimeout(() => navigate('/login'), 4000)
        return
      }

      navigate('/')
    } catch (err) {
      console.error('Callback error:', err)
      setStatus('Erreur inattendue : ' + err.message)
      setTimeout(() => navigate('/login'), 4000)
    }
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="max-w-md w-full card p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-primary mb-3">Accès non autorisé</h2>
          <p className="text-sm text-primary-lighter leading-relaxed mb-6">{blockedMsg}</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={15} /> Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-primary font-medium">{status}</p>
        <p className="text-sm text-primary-lighter mt-2">Veuillez patienter…</p>
      </div>
    </div>
  )
}
