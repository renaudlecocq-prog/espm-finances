import { createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { createMockClient } from '../lib/supabaseMock'
import demoData from '../data/demoData'

// Tables qui doivent passer par le vrai Supabase même en mode démo
// (auth, droits utilisateurs, logs de synchro)
const REAL_TABLES = new Set(['profiles', 'sync_log', 'auth'])

const isDemoMode =
  typeof window !== 'undefined' &&
  sessionStorage.getItem('espm_demo') === 'true'

if (isDemoMode) {
  const mock = createMockClient(demoData)
  const originalFrom = supabase.from.bind(supabase)
  // Monkey-patch synchrone avant tout rendu React :
  // - tables réelles (profiles, sync_log) → vrai Supabase
  // - tout le reste → mock
  supabase.from = (table) => {
    if (REAL_TABLES.has(table)) return originalFrom(table)
    return mock.from(table)
  }
}

const DemoContext = createContext({ demoMode: isDemoMode, toggleDemo: () => {} })

export function DemoProvider({ children }) {
  const toggleDemo = () => {
    sessionStorage.setItem('espm_demo', isDemoMode ? 'false' : 'true')
    window.location.reload()
  }
  return (
    <DemoContext.Provider value={{ demoMode: isDemoMode, toggleDemo }}>
      {children}
    </DemoContext.Provider>
  )
}

export const useDemo = () => useContext(DemoContext)
