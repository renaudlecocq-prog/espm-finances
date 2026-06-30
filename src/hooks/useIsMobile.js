import { isMobileDevice } from '../lib/isMobile'

/**
 * Hook mobile — retourne la valeur synchrone de isMobileDevice.
 * Pas de useEffect, pas de timing issue.
 */
export function useIsMobile() {
  return isMobileDevice
}
