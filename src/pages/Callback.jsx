import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EDGE_URL = 'https://iubxalsakqljilydnqss.supabase.co/functions/v1/smartschool-oauth'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YnhhbHNha3FsamlseWRucXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTM1ODgsImV4cCI6MjA2MTc2OTU4OH0.ky5Hk9I8RYD3W-XD4z0p-C2zfLQRTa1KZ7WKSJvPVTk'

export default function Callback() {
  const [status, setStatus] = useState('Authentification Smartschool en cours…')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setError('Code OAuth manquant dans l\'URL')
      return
    }

    ;(async () => {
      try {
        setStatus('Échange du code Smartschool…')
        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'apikey': ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })
        const data = await res.json()

        if (data.error === 'STUDENT_ACCOUNT_BLOCKED') {
          setError(data.message || 'Compte élève non autorisé.')
          return
        }
        if (data.error || !data.token_hash) {
          setError(data.error || 'Réponse inattendue de la fonction OAuth')
          return
        }

        setStatus('Connexion à la plateforme…')
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        })
        if (verifyErr) {
          setError('Erreur de vérification : ' + verifyErr.message)
          return
        }

        navigate('/', { replace: true })
      } catch (e) {
        setError('Erreur réseau : ' + e.message)
      }
    })()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
      <div className="card p-8 w-full max-w-sm text-center">
        {error ? (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Connexion échouée</h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            <a href="/login" className="btn-primary inline-flex">Retour à la connexion</a>
          </>
        ) : (
          <>
            <div className="inline-block w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}
