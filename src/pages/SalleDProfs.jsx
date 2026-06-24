import { useState, useEffect, useCallback, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'

// ── Palette de couleurs ───────────────────────────────────────────────────────
const COLORS = [
  '#6366F1','#8B5CF6','#EC4899','#EF4444','#F97316',
  '#F59E0B','#10B981','#06B6D4','#3B82F6','#64748B',
  '#D946EF','#84CC16',
]

// ── Palette d'emojis ──────────────────────────────────────────────────────────
const EMOJIS = ['📁','📚','📋','📌','🎨','🔗','📸','📝','🎯','💡',
                '📊','🔧','❤️','⭐','🎓','🏫','🗂️','📦','🖼️','🎵',
                '📢','🔒','🌟','🏆','💼','🗒️','🔔','📅','🌈','🎉']

// ── Couleur douce pour fond de carte ─────────────────────────────────────────
const softBg = (hex) => hex + '18'

// ── Formater la taille ────────────────────────────────────────────────────────
const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ── Icône de type d'item ──────────────────────────────────────────────────────
function TypeIcon({ type, color, size = 32 }) {
  const icons = {
    image:    { emoji: '🖼️', bg: '#DBEAFE', fg: '#2563EB' },
    document: { emoji: '📄', bg: '#FEE2E2', fg: '#DC2626' },
    link:     { emoji: '🔗', bg: '#D1FAE5', fg: '#059669' },
    note:     { emoji: '📝', bg: '#FEF3C7', fg: '#D97706' },
  }
  const t = icons[type] || icons.note
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25,
      backgroundColor: color || t.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>
      {t.emoji}
    </div>
  )
}

// ── Carte dossier ─────────────────────────────────────────────────────────────
// ── Mini-carte polaroid pour l'éventail ──────────────────────────────────────
function MiniCard({ item, rotate, tx, ty, zIdx }) {
  const [err, setErr] = useState(false)
  const TYPE_BG = { image: '#DBEAFE', document: '#FEE2E2', link: '#D1FAE5', note: '#FFFBEB' }
  const TYPE_EMOJI = { image: '🖼️', document: '📄', link: '🔗', note: '📝' }
  return (
    <div style={{
      position: 'absolute', width: 100, height: 125, borderRadius: 8,
      boxShadow: '0 3px 10px rgba(0,0,0,0.22)',
      transform: `rotate(${rotate}deg) translate(${tx}px, ${ty}px)`,
      zIndex: zIdx, overflow: 'hidden',
      backgroundColor: item.type === 'image' && item.file_url && !err ? '#fff' : TYPE_BG[item.type] || '#F3F4F6',
      border: '2.5px solid #fff',
    }}>
      {item.type === 'image' && item.file_url && !err ? (
        <img src={item.file_url} alt="" onError={() => setErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>
          {TYPE_EMOJI[item.type] || '📁'}
        </div>
      )}
    </div>
  )
}

// ── Résumé des stats d'un dossier ─────────────────────────────────────────────
function FolderStatLine({ stats }) {
  if (!stats) return <span style={{ fontSize: 12, color: '#D1D5DB' }}>Vide</span>
  const labels = {
    image: (n) => `${n} image${n > 1 ? 's' : ''}`,
    document: (n) => `${n} doc${n > 1 ? 's' : ''}`,
    link: (n) => `${n} lien${n > 1 ? 's' : ''}`,
    note: (n) => `${n} note${n > 1 ? 's' : ''}`,
  }
  const parts = Object.entries(stats)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => labels[type]?.(n))
    .filter(Boolean)
  if (parts.length === 0) return <span style={{ fontSize: 12, color: '#D1D5DB' }}>Vide</span>
  return (
    <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>
      {parts.join(' · ')}
    </span>
  )
}

// ── Carte dossier ─────────────────────────────────────────────────────────────
function FolderCard({ folder, previews, stats, onOpen, onEdit, onPin, onDelete, canEdit }) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }
    if (menu) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  // Disposition éventail : jusqu'à 3 cartes
  const FAN = [
    { rotate: -11, tx: -54, ty: 8 },
    { rotate: -3,  tx: -10, ty: 0 },
    { rotate:  6,  tx: 34,  ty: 6 },
  ]

  return (
    <div onClick={onOpen}
      style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        boxShadow: folder.pinned
          ? `0 0 0 2px ${folder.color}, 0 4px 20px ${folder.color}40`
          : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s', position: 'relative', backgroundColor: '#fff' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = folder.pinned ? `0 0 0 2px ${folder.color}, 0 8px 24px ${folder.color}50` : '0 8px 24px rgba(0,0,0,0.13)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = folder.pinned ? `0 0 0 2px ${folder.color}, 0 4px 20px ${folder.color}40` : '0 2px 8px rgba(0,0,0,0.08)' }}>

      {/* Bandeau couleur avec éventail */}
      <div style={{ height: 160, backgroundColor: folder.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        overflow: 'hidden' }}>
        {/* Fond légèrement assombri si items */}
        {previews && previews.length > 0 && (
          <div style={{ position: 'absolute', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.08)' }} />
        )}
        {previews && previews.length > 0 ? (
          <div style={{ position: 'relative', width: 230, height: 130 }}>
            {previews.slice(0, 3).map((item, i) => (
              <MiniCard key={item.id} item={item}
                rotate={FAN[i].rotate} tx={FAN[i].tx} ty={FAN[i].ty} zIdx={i + 1} />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 38, position: 'relative', zIndex: 1 }}>{folder.emoji}</span>
        )}
        {/* Badge emoji dossier quand il y a un éventail */}
        {previews && previews.length > 0 && (
          <div style={{ position: 'absolute', bottom: 6, right: 8,
            backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999,
            width: 38, height: 38, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, zIndex: 10 }}>
            {folder.emoji}
          </div>
        )}
        {folder.pinned && (
          <div style={{ position: 'absolute', top: 8, left: 8,
            backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999,
            padding: '2px 6px', fontSize: 11, fontWeight: 700, color: folder.color, zIndex: 10 }}>
            📌
          </div>
        )}
        {/* Menu options */}
        {canEdit && (
          <div ref={menuRef} style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenu(m => !m)}
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: 'none',
                borderRadius: 999, width: 28, height: 28, cursor: 'pointer',
                fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#374151' }}>
              ⋯
            </button>
            {menu && (
              <div style={{ position: 'absolute', right: 0, top: 32, backgroundColor: '#fff',
                borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                minWidth: 140, zIndex: 100, overflow: 'hidden', border: '1px solid #F3F4F6' }}>
                {[
                  { label: folder.pinned ? '📌 Désépingler' : '📌 Épingler', action: onPin },
                  { label: '✏️ Modifier', action: onEdit },
                  { label: '🗑️ Supprimer', action: onDelete, danger: true },
                ].map(item => (
                  <button key={item.label} onClick={() => { item.action(); setMenu(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 14px', border: 'none', background: 'none',
                      cursor: 'pointer', fontSize: 13,
                      color: item.danger ? '#DC2626' : '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = item.danger ? '#FEF2F2' : '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>
          {folder.name}
        </div>
        <FolderStatLine stats={stats} />
      </div>
    </div>
  )
}

// ── Carte item ────────────────────────────────────────────────────────────────
function ItemCard({ item, onDelete, canDelete }) {
  const [imgError, setImgError] = useState(false)

  const cardStyle = {
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    transition: 'all 0.15s', cursor: item.type === 'link' ? 'pointer' : 'default',
    border: '1px solid #F3F4F6',
  }

  const handleClick = () => {
    if (item.type === 'link' && item.content) window.open(item.content, '_blank', 'noopener')
    if (item.file_url) window.open(item.file_url, '_blank', 'noopener')
  }

  return (
    <div style={cardStyle}
      onClick={handleClick}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>

      {/* Aperçu image */}
      {item.type === 'image' && item.file_url && !imgError ? (
        <div style={{ height: 140, overflow: 'hidden', backgroundColor: '#F9FAFB' }}>
          <img src={item.file_url} alt={item.title || ''} onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : item.type === 'note' ? (
        <div style={{ height: 80, backgroundColor: '#FFFBEB', padding: '12px 14px',
          fontSize: 13, color: '#78350F', overflow: 'hidden',
          lineHeight: 1.5, borderBottom: '1px solid #FEF3C7' }}>
          {item.content || item.title || ''}
        </div>
      ) : (
        <div style={{ height: 80, backgroundColor: softBg(
            item.type === 'document' ? '#EF4444' :
            item.type === 'link' ? '#10B981' : '#6366F1'),
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
          {item.type === 'document' ? '📄' : item.type === 'link' ? '🔗' : '🖼️'}
        </div>
      )}

      {/* Infos */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#111', marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title || item.file_name || item.content || 'Sans titre'}
        </div>
        {item.type === 'link' && item.content && (
          <div style={{ fontSize: 11, color: '#6B7280',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(() => { try { return new URL(item.content).hostname } catch { return item.content } })()}
          </div>
        )}
        {item.description && item.type !== 'note' && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' }}>
            {item.description}
          </div>
        )}
        {item.file_size && (
          <div style={{ fontSize: 10, color: '#D1D5DB', marginTop: 4 }}>{fmtSize(item.file_size)}</div>
        )}
      </div>

      {/* Supprimer */}
      {canDelete && (
        <div style={{ borderTop: '1px solid #F9FAFB', padding: '6px 12px', textAlign: 'right' }}
          onClick={e => e.stopPropagation()}>
          <button onClick={onDelete}
            style={{ fontSize: 11, color: '#D1D5DB', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: 500 }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}>
            Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Modal dossier (création / édition) ───────────────────────────────────────
function FolderModal({ initial, onClose, onSave }) {
  const [name,  setName]  = useState(initial?.name  || '')
  const [color, setColor] = useState(initial?.color || COLORS[0])
  const [emoji, setEmoji] = useState(initial?.emoji || '📁')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), color, emoji })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Aperçu */}
        <div style={{ height: 100, backgroundColor: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
          {emoji}
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 20 }}>
            {initial ? 'Modifier le dossier' : 'Nouveau dossier'}
          </h3>

          {/* Nom */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nom
            </label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="Ex : Ressources pédagogiques"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
                border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = color}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>

          {/* Emoji */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Icône</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: 'none',
                    backgroundColor: emoji === e ? color + '25' : '#F9FAFB',
                    cursor: 'pointer', fontSize: 18, lineHeight: 1,
                    outline: emoji === e ? `2px solid ${color}` : 'none' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Couleur */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Couleur</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: c, border: 'none',
                    cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.1s' }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10,
              border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={!name.trim() || saving}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                backgroundColor: color, color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, opacity: (!name.trim() || saving) ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout d'item ────────────────────────────────────────────────────────
function AddItemModal({ folder, onClose, onAdded }) {
  const { user } = useAuth()
  const fileRef   = useRef(null)
  const [type,        setType]        = useState('link')
  const [title,       setTitle]       = useState('')
  const [content,     setContent]     = useState('')
  const [description, setDescription] = useState('')
  const [file,        setFile]        = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [compressing, setCompressing] = useState(false)

  const TYPES = [
    { key: 'link',     label: 'Lien',     emoji: '🔗' },
    { key: 'image',    label: 'Image',    emoji: '🖼️' },
    { key: 'document', label: 'Document', emoji: '📄' },
    { key: 'note',     label: 'Note',     emoji: '📝' },
  ]

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (type === 'image') {
      setCompressing(true)
      try {
        const compressed = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
        setFile(compressed)
      } catch { setFile(f) }
      setCompressing(false)
    } else {
      setFile(f)
    }
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      let fileUrl = null, fileName = null, fileSize = null

      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${folder.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('padlet-files').upload(path, file)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('padlet-files').getPublicUrl(path)
        fileUrl = urlData.publicUrl
        fileName = file.name
        fileSize = file.size
      }

      const { error: insErr } = await supabase.from('padlet_items').insert({
        folder_id: folder.id, type,
        title: title || null,
        content: (type === 'link' || type === 'note') ? content : null,
        description: description || null,
        file_url: fileUrl, file_name: fileName, file_size: fileSize,
        created_by: user.id,
      })
      if (insErr) throw insErr
      onAdded()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const isValid = () => {
    if (type === 'link') return content.trim().length > 0
    if (type === 'note') return content.trim().length > 0
    if (type === 'image' || type === 'document') return file !== null
    return false
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
            Ajouter dans{' '}
            <span style={{ color: folder.color }}>{folder.emoji} {folder.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: '#9CA3AF', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {TYPES.map(t => (
              <button key={t.key} onClick={() => { setType(t.key); setFile(null); setContent('') }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '2px solid',
                  borderColor: type === t.key ? folder.color : '#E5E7EB',
                  backgroundColor: type === t.key ? softBg(folder.color) : '#fff',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: type === t.key ? folder.color : '#6B7280' }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '8px 12px',
              borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>
          )}

          {/* Lien */}
          {type === 'link' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>URL *</label>
                <input value={content} onChange={e => setContent(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                    border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Titre</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre du lien"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                    border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          {/* Note */}
          {type === 'note' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Titre</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre optionnel"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                    border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Contenu *</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
                  placeholder="Votre note…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                    border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box',
                    resize: 'vertical', backgroundColor: '#FFFBEB' }} />
              </div>
            </>
          )}

          {/* Image / Document */}
          {(type === 'image' || type === 'document') && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #E5E7EB', borderRadius: 10, padding: '24px 16px',
                    textAlign: 'center', cursor: 'pointer', backgroundColor: '#F9FAFB',
                    transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = folder.color; e.currentTarget.style.backgroundColor = softBg(folder.color) }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#F9FAFB' }}>
                  {compressing ? (
                    <div style={{ color: '#6B7280', fontSize: 13 }}>⏳ Compression en cours…</div>
                  ) : file ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{type === 'image' ? '🖼️' : '📄'}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{fmtSize(file.size)}</div>
                      <div style={{ fontSize: 11, color: folder.color, marginTop: 4 }}>Cliquer pour changer</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{type === 'image' ? '🖼️' : '📄'}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {type === 'image' ? 'Cliquer pour ajouter une image' : 'Cliquer pour ajouter un document'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {type === 'image' ? 'JPG, PNG, WebP · max 25 Mo (compressé automatiquement)' : 'PDF, Word · max 25 Mo'}
                      </div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }}
                  accept={type === 'image' ? 'image/*' : '.pdf,.doc,.docx'}
                  onChange={handleFileChange} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Titre</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre optionnel"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                    border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          {/* Description commune */}
          {type !== 'note' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionnel"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                  border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6',
          display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10,
            border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: '#374151' }}>Annuler</button>
          <button onClick={handleSave} disabled={!isValid() || saving || compressing}
            style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none',
              backgroundColor: folder.color, color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              opacity: (!isValid() || saving || compressing) ? 0.6 : 1 }}>
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function SalleDProfs() {
  const { user, isAdmin } = useAuth()
  const [tab,           setTab]           = useState('shared')
  const [folders,       setFolders]       = useState([])
  const [folderStats,    setFolderStats]    = useState({})   // { folderId: { image, document, link, note } }
  const [folderPreviews, setFolderPreviews] = useState({})   // { folderId: [item, ...] (max 3) }
  const [openFolder,    setOpenFolder]    = useState(null)
  const [items,         setItems]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [itemsLoading,  setItemsLoading]  = useState(false)
  const [folderModal,   setFolderModal]   = useState(false)
  const [editFolder,    setEditFolder]    = useState(null)
  const [addItemModal,  setAddItemModal]  = useState(false)

  // ── Charger dossiers ────────────────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    setLoading(true)
    const q = supabase.from('padlet_folders').select('*').eq('type', tab)
    if (tab === 'personal') q.eq('created_by', user.id)

    const { data } = await q.order('pinned', { ascending: false }).order('created_at')
    const list = data || []
    setFolders(list)

    if (list.length > 0) {
      const { data: allItems } = await supabase
        .from('padlet_items')
        .select('id, folder_id, type, file_url, content')
        .in('folder_id', list.map(f => f.id))
        .order('created_at', { ascending: true })
      const stats = {}
      const previews = {}
      ;(allItems || []).forEach(item => {
        // Stats par type
        if (!stats[item.folder_id]) stats[item.folder_id] = { image: 0, document: 0, link: 0, note: 0 }
        if (stats[item.folder_id][item.type] !== undefined) stats[item.folder_id][item.type]++
        // Éventail : max 3 items par dossier
        if (!previews[item.folder_id]) previews[item.folder_id] = []
        if (previews[item.folder_id].length < 3) previews[item.folder_id].push(item)
      })
      setFolderStats(stats)
      setFolderPreviews(previews)
    } else {
      setFolderStats({})
      setFolderPreviews({})
    }
    setLoading(false)
  }, [tab, user.id])

  useEffect(() => { loadFolders(); setOpenFolder(null) }, [loadFolders])

  // ── Charger items d'un dossier ──────────────────────────────────────────
  const loadItems = useCallback(async (folder) => {
    setItemsLoading(true)
    const { data } = await supabase.from('padlet_items')
      .select('*').eq('folder_id', folder.id).order('created_at')
    setItems(data || [])
    setItemsLoading(false)
  }, [])

  const openFolderView = (folder) => {
    setOpenFolder(folder)
    loadItems(folder)
  }

  // ── CRUD dossiers ────────────────────────────────────────────────────────
  const createFolder = async (data) => {
    await supabase.from('padlet_folders').insert({ ...data, type: tab, created_by: user.id })
    setFolderModal(false)
    loadFolders()
  }

  const updateFolder = async (data) => {
    await supabase.from('padlet_folders').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editFolder.id)
    setEditFolder(null)
    loadFolders()
    if (openFolder?.id === editFolder.id) setOpenFolder(prev => ({ ...prev, ...data }))
  }

  const togglePin = async (folder) => {
    await supabase.from('padlet_folders').update({ pinned: !folder.pinned }).eq('id', folder.id)
    loadFolders()
  }

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`)) return
    await supabase.from('padlet_folders').delete().eq('id', folder.id)
    if (openFolder?.id === folder.id) setOpenFolder(null)
    loadFolders()
  }

  const deleteItem = async (item) => {
    await supabase.from('padlet_items').delete().eq('id', item.id)
    if (item.file_url) {
      const path = item.file_url.split('/padlet-files/')[1]
      if (path) await supabase.storage.from('padlet-files').remove([path])
    }
    setItems(prev => prev.filter(i => i.id !== item.id))
    setFolderStats(prev => {
      const s = { ...(prev[openFolder.id] || { image:0, document:0, link:0, note:0 }) }
      if (s[item.type] !== undefined) s[item.type] = Math.max(0, s[item.type] - 1)
      return { ...prev, [openFolder.id]: s }
    })
    setFolderPreviews(prev => {
      const p = (prev[openFolder.id] || []).filter(i => i.id !== item.id)
      return { ...prev, [openFolder.id]: p }
    })
  }

  const canEdit = (obj) => isAdmin || obj.created_by === user.id

  const tabs = [
    { key: 'shared',   label: 'Salle des profs' },
    { key: 'personal', label: 'Mon casier' },
  ]

  return (
    <>
      <PageHeader
        title={openFolder
          ? `${openFolder.emoji} ${openFolder.name}`
          : tab === 'shared' ? 'Salle des profs' : 'Mon casier'}
        subtitle={openFolder
          ? (() => { const s = folderStats[openFolder.id]; const t = s ? Object.values(s).reduce((a,b)=>a+b,0) : items.length; return `${t} élément${t!==1?'s':''}` })()
          : `${folders.length} dossier${folders.length !== 1 ? 's' : ''}`}
        leftActions={openFolder ? (
          <>
            <button onClick={() => setOpenFolder(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.70)',
                fontSize: 12, fontWeight: 500, padding: '4px 8px', borderRadius: 6 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.70)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
              {tab === 'shared' ? 'Salle des profs' : 'Mon casier'}
            </button>
            <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.20)', margin: '0 2px' }} />
          </>
        ) : undefined}
        tabs={!openFolder ? tabs : undefined}
        activeTab={tab}
        onTabChange={!openFolder ? setTab : undefined}
        actions={
          <button
            onClick={() => openFolder ? setAddItemModal(true) : setFolderModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none',
              backgroundColor: '#fff', color: '#2D1B2E', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {openFolder ? '+ Ajouter' : '+ Nouveau dossier'}
          </button>
        }
      />

      <div className="p-6">
        {/* ── Vue dossiers ── */}
        {!openFolder && (
          loading ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Chargement…</div>
          ) : folders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {tab === 'shared' ? '🏫' : '🗂️'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                {tab === 'shared' ? 'La salle des profs est vide' : 'Votre casier est vide'}
              </div>
              <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 24 }}>
                Créez votre premier dossier pour commencer à organiser vos ressources.
              </div>
              <button onClick={() => setFolderModal(true)}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none',
                  backgroundColor: '#2D1B2E', color: '#fff', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600 }}>
                + Créer un dossier
              </button>
            </div>
          ) : (
            <>
              {/* Épinglés */}
              {folders.some(f => f.pinned) && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                    📌 Épinglés
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
                    {folders.filter(f => f.pinned).map(folder => (
                      <FolderCard key={folder.id} folder={folder}
                        previews={folderPreviews[folder.id]}
                        stats={folderStats[folder.id]}
                        onOpen={() => openFolderView(folder)}
                        onEdit={() => setEditFolder(folder)}
                        onPin={() => togglePin(folder)}
                        onDelete={() => deleteFolder(folder)}
                        canEdit={canEdit(folder)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Tous */}
              {folders.some(f => !f.pinned) && (
                <div>
                  {folders.some(f => f.pinned) && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                      Tous les dossiers
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
                    {folders.filter(f => !f.pinned).map(folder => (
                      <FolderCard key={folder.id} folder={folder}
                        previews={folderPreviews[folder.id]}
                        stats={folderStats[folder.id]}
                        onOpen={() => openFolderView(folder)}
                        onEdit={() => setEditFolder(folder)}
                        onPin={() => togglePin(folder)}
                        onDelete={() => deleteFolder(folder)}
                        canEdit={canEdit(folder)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}

        {/* ── Vue dossier ouvert ── */}
        {openFolder && (
          itemsLoading ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Chargement…</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{openFolder.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Ce dossier est vide
              </div>
              <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 24 }}>
                Ajoutez des images, documents, liens ou notes.
              </div>
              <button onClick={() => setAddItemModal(true)}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none',
                  backgroundColor: openFolder.color, color: '#fff', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600 }}>
                + Ajouter un élément
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {items.map(item => (
                <ItemCard key={item.id} item={item}
                  onDelete={() => deleteItem(item)}
                  canDelete={canEdit(item)} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {folderModal && (
        <FolderModal onClose={() => setFolderModal(false)} onSave={createFolder} />
      )}
      {editFolder && (
        <FolderModal initial={editFolder} onClose={() => setEditFolder(null)} onSave={updateFolder} />
      )}
      {addItemModal && openFolder && (
        <AddItemModal folder={openFolder} onClose={() => setAddItemModal(false)}
          onAdded={() => { setAddItemModal(false); loadItems(openFolder); loadFolders() }} />
      )}
    </>
  )
}
