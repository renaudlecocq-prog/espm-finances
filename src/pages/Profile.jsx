import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { useTheme } from '../contexts/ThemeContext'
import { Lock, Bell, Palette, Home, Eye, EyeOff, Check, AlertCircle, ChevronLeft } from 'lucide-react'

const DAYS  = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

function isMuted(schedule) {
  if (!schedule?.enabled) return false
  const now      = new Date()
  const day      = now.getDay()
  const nowMin   = now.getHours() * 60 + now.getMinutes()
  const muteDays = schedule.muteDays ?? []
  if (muteDays.length > 0 && !muteDays.includes(day)) return false
  const [ah, am] = (schedule.muteAfter  || '18:00').split(':').map(Number)
  const [bh, bm] = (schedule.muteBefore || '08:00').split(':').map(Number)
  const afterMin  = ah * 60 + am
  const beforeMin = bh * 60 + bm
  if (afterMin > beforeMin) return nowMin >= afterMin || nowMin < beforeMin   // overnight
  return nowMin >= afterMin && nowMin < beforeMin
}

export { isMuted }

export default function Profile() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('securite')

  // ── Sécurité ────────────────────────────────────────────────────────────
  const [oldPwd,     setOldPwd]     = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg,     setPwdMsg]     = useState(null)

  // ── Notifications ───────────────────────────────────────────────────────
  const [schedule,   setSchedule]   = useState({ enabled: false, muteAfter: '18:00', muteBefore: '08:00', muteDays: [0, 6] })
  const [notifSaving,setNotifSaving]= useState(false)
  const [notifMsg,   setNotifMsg]   = useState(null)

  const { dark, toggle } = useTheme()
  const hasPassword = profile?.has_password || user?.identities?.some(i => i.provider === 'email') || (user?.app_metadata?.providers ?? []).includes('email')

  useEffect(() => {
    if (profile?.notif_schedule && Object.keys(profile.notif_schedule).length > 0) {
      const s = profile.notif_schedule
      setSchedule({
        enabled:     s.enabled     ?? false,
        muteAfter:   s.muteAfter   ?? '18:00',
        muteBefore:  s.muteBefore  ?? '08:00',
        muteDays:    s.muteDays    ?? [0, 6],
      })
    }
  }, [profile])

  const handlePasswordSubmit = async e => {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas' }); return }
    if (newPwd.length < 8)     { setPwdMsg({ ok: false, text: 'Minimum 8 caractères requis' }); return }
    setPwdLoading(true)
    try {
      if (hasPassword) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPwd })
        if (signInErr) { setPwdMsg({ ok: false, text: 'Ancien mot de passe incorrect' }); return }
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      await supabase.from('profiles').update({ has_password: true }).eq('id', user.id)
      setPwdMsg({ ok: true, text: hasPassword ? 'Mot de passe modifié avec succès' : 'Mot de passe défini avec succès' })
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      setPwdMsg({ ok: false, text: err.message || 'Erreur inattendue' })
    } finally {
      setPwdLoading(false)
    }
  }

  const handleNotifSave = async () => {
    setNotifSaving(true); setNotifMsg(null)
    const { error } = await supabase.from('profiles').update({ notif_schedule: schedule }).eq('id', user.id)
    setNotifSaving(false)
    setNotifMsg(error ? { ok: false, text: 'Erreur lors de la sauvegarde' } : { ok: true, text: 'Préférences enregistrées' })
    setTimeout(() => setNotifMsg(null), 3000)
  }

  const toggleDay = d => setSchedule(s => ({
    ...s, muteDays: s.muteDays.includes(d) ? s.muteDays.filter(x => x !== d) : [...s.muteDays, d]
  }))

  const card = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6'

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mon profil"
        subtitle={profile ? `${profile.prenom} ${profile.nom} · ${profile.email}` : ''}
        leftActions={
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
            <ChevronLeft size={14} /> Retour
          </button>
        }
        tabs={[
          { key: 'securite',      label: 'Sécurité' },
          { key: 'notifications', label: 'Notifications' },
          { key: 'preferences',   label: 'Préférences' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto w-full space-y-4">

          {/* ── Sécurité ── */}
          {tab === 'securite' && (
            <div className={card}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                  <Lock size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">Mot de passe</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {hasPassword ? 'Modifier votre mot de passe de connexion' : 'Définir un mot de passe pour vous connecter par email'}
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {hasPassword && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Ancien mot de passe</label>
                    <input type={showPwd ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} required
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={8}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-indigo-400" />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Minimum 8 caractères</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Confirmer le nouveau mot de passe</label>
                  <input type={showPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>

                {pwdMsg && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${pwdMsg.ok ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-900' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900'}`}>
                    {pwdMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                    {pwdMsg.text}
                  </div>
                )}

                <button type="submit" disabled={pwdLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  {pwdLoading ? 'Enregistrement…' : hasPassword ? 'Modifier le mot de passe' : 'Définir le mot de passe'}
                </button>
              </form>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 'notifications' && (
            <div className={card}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950 flex items-center justify-center shrink-0">
                  <Bell size={18} className="text-orange-500 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">Plages silencieuses</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Badge et alertes temps réel coupés pendant les plages définies</p>
                </div>
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl mb-5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Activer les plages silencieuses</span>
                <button onClick={() => setSchedule(s => ({ ...s, enabled: !s.enabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${schedule.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-gray-800 rounded-full shadow transition-transform ${schedule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {schedule.enabled && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1.5">Silence à partir de</label>
                      <select value={schedule.muteAfter} onChange={e => setSchedule(s => ({ ...s, muteAfter: e.target.value }))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white dark:bg-gray-800">
                        {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1.5">Silence jusqu'à</label>
                      <select value={schedule.muteBefore} onChange={e => setSchedule(s => ({ ...s, muteBefore: e.target.value }))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white dark:bg-gray-800">
                        {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-2">Jours silencieux</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS.map((d, i) => (
                        <button key={i} onClick={() => toggleDay(i)}
                          className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors
                            ${schedule.muteDays.includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                      {schedule.muteDays.length === 0
                        ? `Tous les jours entre ${schedule.muteAfter} et ${schedule.muteBefore}`
                        : `Les ${schedule.muteDays.map(d => DAYS[d]).join(', ')} entre ${schedule.muteAfter} et ${schedule.muteBefore}`}
                    </p>
                  </div>
                </div>
              )}

              {notifMsg && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg mt-4 ${notifMsg.ok ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-900' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900'}`}>
                  {notifMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                  {notifMsg.text}
                </div>
              )}

              <button onClick={handleNotifSave} disabled={notifSaving}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                {notifSaving ? 'Enregistrement…' : 'Enregistrer les préférences'}
              </button>
            </div>
          )}

          {/* ── Préférences ── */}
          {tab === 'preferences' && (
            <>
              {[
                { icon: <Palette size={18} className="text-purple-500 dark:text-purple-400" />, bg: 'bg-purple-50 dark:bg-purple-950', title: 'Thème', desc: "Choisissez le thème visuel de l'application" },
                { icon: <Home     size={18} className="text-blue-500 dark:text-blue-400"   />, bg: 'bg-blue-50 dark:bg-blue-950',   title: "Page d'accueil", desc: 'Personnalisez les widgets de votre tableau de bord' },
              ].map(item => (
                <div key={item.title} className={`${card} flex items-center gap-4`}>
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-800 dark:text-gray-100">{item.title}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                  <span className="text-xs font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full shrink-0">À venir</span>
                </div>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
