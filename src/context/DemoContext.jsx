import { createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { createMockClient } from '../lib/supabaseMock'
import demoData from '../data/demoData'

// ── Application synchrone du mode demo avant tout rendu React ────────────
// sessionStorage est lu au chargement du module (avant les useEffect).
const isDemoMode =
  typeof window !== 'undefined' &&
  sessionStorage.getItem('espm_demo') === 'true'

if (isDemoMode) {
  const mock = createMockClient(demoData)
  // Monkey-patch : remplace supabase.from() par le client mock
  // Les autres methodes (auth, storage, etc.) restent reelles.
  supabase._originalFrom = supabase.from.bind(supabase)
  supabase.from = mock.from
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
