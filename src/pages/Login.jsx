import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react'

const SMARTSCHOOL_OAUTH_URL =
  'https://espmaritime.smartschool.be/OAuth' +
  '?client_id=4668f1e85fa4' +
  '&redirect_uri=' + encodeURIComponent('https://espmaritime.netlify.app/auth/callback') +
  '&response_type=code' +
  '&scope=' + encodeURIComponent('fulluserinfo groupinfo')

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [showEmail, setShowEmail] = useState(false)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) { setError(err.message); return }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-espm.png" alt="ESPM" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary">Finances ESPM</h1>
          <p className="text-sm text-primary-lighter mt-1">Espace de gestion financière</p>
        </div>

        <div className="card space-y-3">
          {/* Bouton Smartschool SSO */}
          <a
            href={SMARTSCHOOL_OAUTH_URL}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary-light transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="white" fillOpacity="0.2"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">S</text>
            </svg>
            Se connecter avec Smartschool
          </a>

          {/* Toggle connexion e-mail */}
          <button
            onClick={() => { setShowEmail(!showEmail); setError('') }}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-primary-lighter font-medium hover:border-accent hover:text-primary transition-colors"
          >
            <Mail size={18} />
            Connexion par e-mail
            <ChevronDown size={16} className={`ml-auto transition-transform ${showEmail ? 'rotate-180' : ''}`} />
          </button>

          {showEmail && (
            <form onSubmit={handleSubmit} className="space-y-3 pt-1">
              <div>
                <label className="label">Adresse e-mail</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-lighter" />
                  <input className="input pl-8" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="nom@exemple.be" autoFocus />
                </div>
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-lighter" />
                  <input className="input pl-8 pr-10" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-lighter hover:text-primary">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2 py-2.5">
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-primary-lighter mt-6">École Secondaire Plurielle Maritime · 2025–2026</p>
      </div>
    </div>
  )
}
