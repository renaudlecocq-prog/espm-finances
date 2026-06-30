/**
 * Détection mobile avec override manuel (localStorage).
 * Sur les foldables/HarmonyOS, toutes les APIs automatiques peuvent échouer.
 * L'override manuel est prioritaire et persistant.
 */
function detectMobile() {
  if (typeof window === 'undefined') return false

  // Override manuel prioritaire
  const override = localStorage.getItem('espm_layout_mode')
  if (override === 'mobile') return true
  if (override === 'desktop') return false

  // Détections automatiques (best-effort)
  if (window.matchMedia('(pointer: coarse)').matches) return true
  if (window.matchMedia('(any-pointer: coarse)').matches) return true
  if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) return true
  if (navigator.maxTouchPoints > 0) return true

  return false
}

export const isMobileDevice = detectMobile()

export function setLayoutMode(mode) {
  // mode: 'mobile' | 'desktop' | null (auto)
  if (mode === null) localStorage.removeItem('espm_layout_mode')
  else localStorage.setItem('espm_layout_mode', mode)
  window.location.reload()
}
