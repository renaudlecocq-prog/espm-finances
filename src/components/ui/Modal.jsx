import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-accent-light">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent-light transition-colors">
            <X size={18} className="text-primary-lighter" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
