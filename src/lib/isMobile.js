/**
 * Détection mobile synchrone — évaluée au chargement du module.
 * Utilise pointer:coarse (écrans tactiles) en priorité, puis UA en fallback.
 * Aucun timing issue, aucune dépendance au viewport width ou DPR.
 */
function detectMobile() {
  if (typeof window === 'undefined') return false
  // pointer:coarse = seul pointeur disponible est tactile (téléphone, tablette, fold)
  if (window.matchMedia('(pointer: coarse)').matches) return true
  // Fallback UA pour cas edge (Brave desktop mode sur Android)
  return /android|mobile/i.test(navigator.userAgent)
}

export const isMobileDevice = detectMobile()
