// TEMPORAIRE — à supprimer après diagnostic
export default function DebugMobile() {
  const info = {
    'pointer:coarse': window.matchMedia('(pointer: coarse)').matches,
    'any-pointer:coarse': window.matchMedia('(any-pointer: coarse)').matches,
    'hover:none': window.matchMedia('(hover: none)').matches,
    maxTouchPoints: navigator.maxTouchPoints,
    innerWidth: window.innerWidth,
    'screen.width': window.screen.width,
    UA: navigator.userAgent.slice(0, 80),
  }
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#000', color: '#0f0', fontSize: 10, padding: 6,
      fontFamily: 'monospace', lineHeight: 1.4
    }}>
      {Object.entries(info).map(([k, v]) => (
        <div key={k}><b>{k}:</b> {String(v)}</div>
      ))}
    </div>
  )
}
