/**
 * Détection mobile — 3 niveaux de fallback pour couvrir les navigateurs
 * en mode "Desktop site" (comme Brave/Chrome sur foldable Honor Magic V3).
 *
 * 1. pointer:coarse — cas standard (touch primary)
 * 2. UA Android/iOS  — mode desktop partiel (viewport modifié mais UA conservé)
 * 3. maxTouchPoints > 0 — mode desktop complet avec UA spoofé
 *    (invariant : un vrai desktop sans écran tactile aura toujours 0)
 */
function detectMobile() {
  if (typeof window === 'undefined') return false

  // 1. Pointeur tactile primaire
  if (window.matchMedia('(pointer: coarse)').matches) return true

  // 2. User-Agent Android/iOS (présent même en mode desktop standard)
  if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) return true

  // 3. Appareil tactile — couvre le mode "Request Desktop Site" total
  //    Un desktop sans écran tactile retourne 0
  if (navigator.maxTouchPoints > 0) return true

  return false
}

export const isMobileDevice = detectMobile()
