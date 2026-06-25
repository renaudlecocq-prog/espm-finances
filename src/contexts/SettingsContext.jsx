import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SettingsContext = createContext({})

const DEFAULTS = {
  school_nom:           'École Secondaire Plurielle Maritime',
  school_adresse_rue:   'Avenue Jean Dubrucq 175',
  school_adresse_cp:    '1080',
  school_adresse_ville: 'Molenbeek-Saint-Jean',
  school_bce:           '',
  school_logo_url:      '',
  school_email_general: 'info@espmaritime.be',
  school_tel_general:   '02/210.20.91',
  school_email_eco:     'economat@espmaritime.be',
  school_tel_eco:       '02/210.20.96',
  school_nom_eco:       'Monsieur Lecocq',
  school_email_as:      'as@espmaritime.be',
  school_tel_as:        '02/210.20.91',
  school_nom_as:        'Jérôme Mignolet',
  school_iban:          'BE17 0910 2167 8721',
  school_beneficiaire:  'École Secondaire Plurielle Maritime',
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('key, value')
    if (!error && data) {
      const map = {}
      data.forEach(r => { map[r.key] = r.value ?? '' })
      setSettings({ ...DEFAULTS, ...map })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const s = (key) => settings[key] ?? DEFAULTS[key] ?? ''
  const adresse = () => `${s('school_adresse_rue')} · ${s('school_adresse_cp')} ${s('school_adresse_ville')}`

  return (
    <SettingsContext.Provider value={{ settings, loading, reload: load, s, adresse }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
