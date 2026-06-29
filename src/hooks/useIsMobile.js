import { useState, useEffect } from 'react'

export function useIsMobile() {
  // Commence à false, se met à jour dès le premier effet
  // Évite les problèmes d'initialisation du viewport PWA
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
