import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TrelloBoardView from './TrelloBoardView'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import { CollabEditor } from '../salle/CollabEditor'
import { ListeEditor } from '../salle/ListeEditor'
import { supabase as supabaseClient } from '../lib/supabase'

const COLORS = [
  '#6366F1','#8B5CF6','#EC4899','#EF4444','#F97316',
  '#F59E0B','#10B981','#06B6D4','#3B82F6','#64748B',
  '#D946EF','#84CC16',
]
const EMOJIS = ['📁','📚','📋','📌','🎨','🔗','📸','📝','🎯','💡',
                '📊','🔧','❤️','⭐','🎓','🏫','🗂️','📦','🖼️','🎵',
                '📢','🔒','🌟','🏆','💼','🗒️','🔔','📅','🌈','🎉']

const softBg = (hex) => hex + '18'

// ── SortableFolderCard (wrapper DnD) ────────────────────────────────────────
function SortableFolderCard({ folder, previews, stats, subCount, onOpen, onEdit, onPin, onDelete, canEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `folder-${folder.id}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FolderCard folder={folder} previews={previews} stats={stats} subCount={subCount}
        onOpen={onOpen} onEdit={onEdit} onPin={onPin} onDelete={onDelete} canEdit={canEdit} />
    </div>
  )
}


// ── Menu contextuel (portal — évite le clipping overflow:hidden des cards) ────
function ContextMenu({ btnRef, items, onClose }) {
  const [pos, setPos] = useState(null)
  const menuRef = useRef(null)
  useEffect(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuH = items.length * 38 + 8
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < menuH + 16
      setPos({
        top: openUp ? rect.top - menuH - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - 158),
      })
    }
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current?.contains(e.target))
        onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  if (!pos) return null
  return ReactDOM.createPortal(
    <div ref={menuRef} style={{
      position: 'fixed', top: pos.top, left: pos.left,
      backgroundColor: '#fff', borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      minWidth: 158, zIndex: 9999, overflow: 'hidden',
      border: '1px solid #F3F4F6'
    }}>
      {items.map(item => (
        <button key={item.label} onClick={() => { item.action(); onClose() }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
            border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
            color: item.danger ? '#DC2626' : '#374151' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = item.danger ? '#FEF2F2' : '#F9FAFB'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

// ── SortableItemCard (wrapper DnD) ────────────────────────────────────────────
function SortableItemCard({ item, onDelete, canDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `item-${item.id}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard item={item} onDelete={onDelete} canDelete={canDelete} />
    </div>
  )
}

// ── Carte Trello board (dans la grille) ───────────────────────────────────────
function TrelloBoardCard({ board, onOpen, onEdit, onPin, onDelete, onMove, canEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } =
    useSortable({ id: `board-${board.id}` })
  const sortStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isSortDragging ? 0.35 : 1 }
  const [menu, setMenu] = useState(false)
  const btnRef = useRef(null)
  return (
    <div ref={setNodeRef} style={sortStyle} {...attributes} {...listeners}>
    <div onClick={!isSortDragging ? onOpen : undefined}
      className="cursor-grab-custom"
      style={{
        borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff',
        boxShadow: board.pinned
          ? `0 0 0 2px ${board.color}, 0 4px 20px ${board.color}40`
          : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s', position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = board.pinned ? `0 0 0 2px ${board.color},0 8px 24px ${board.color}50` : '0 8px 24px rgba(0,0,0,0.13)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = board.pinned ? `0 0 0 2px ${board.color},0 4px 20px ${board.color}40` : '0 2px 8px rgba(0,0,0,0.08)' }}>
      {/* Bandeau */}
      <div style={{ height: 145, backgroundColor: board.color, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Motif kanban décoratif */}
        <div style={{ display: 'flex', gap: 8, opacity: 0.3 }}>
          {[4, 6, 3].map((n, i) => (
            <div key={i} style={{ width: 28, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Array.from({ length: n }).map((_, j) => (
                <div key={j} style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 3 }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 24 }}>{board.emoji}</div>
        {board.pinned && (
          <div style={{ position: 'absolute', top: 8, left: 8,
            backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999,
            padding: '2px 6px', fontSize: 11, fontWeight: 700, color: board.color }}>📌</div>
        )}
        {/* Badge tableau */}
        <div style={{ position: 'absolute', top: 8, left: board.pinned ? 40 : 8,
          backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6,
          padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#fff', backdropFilter: 'blur(4px)' }}>
          TABLEAU
        </div>
        {canEdit && (
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}
            onClick={e => e.stopPropagation()}>
            <button ref={btnRef} onClick={() => setMenu(m => !m)}
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 999,
                width: 28, height: 28, cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>⋯</button>
            {menu && (
              <ContextMenu btnRef={btnRef} onClose={() => setMenu(false)} items={[
                { label: board.pinned ? '📌 Désépingler' : '📌 Épingler', action: onPin },
                { label: '✏️ Modifier', action: onEdit },
                { label: '📂 Déplacer vers…', action: () => { onMove?.() } },
                { label: '🗑️ Supprimer', action: onDelete, danger: true },
              ]} />
            )}
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{ padding: '10px 13px 13px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#111',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
          {board.name}
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Tableau Kanban</span>
      </div>
    </div>
    </div>
  )
}

// ── Modal création/édition board Trello ───────────────────────────────────────
function BoardModal({ initial, onClose, onSave }) {
  const [name,  setName]  = useState(initial?.name  || '')
  const [color, setColor] = useState(initial?.color || COLORS[2])
  const [emoji, setEmoji] = useState(initial?.emoji || '📋')
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true); setSaveError('')
    try { await onSave({ name: name.trim(), color, emoji }) }
    catch(err) { setSaveError(err.message || 'Erreur'); setSaving(false) }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ height: 80, backgroundColor: color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>{emoji}</span>
          <div style={{ display: 'flex', gap: 6, opacity: 0.4 }}>
            {[4,6,3].map((n,i) => (
              <div key={i} style={{ width: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Array.from({length:n}).map((_,j) => (
                  <div key={j} style={{ height: 7, backgroundColor: '#fff', borderRadius: 2 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 20 }}>
            {initial ? 'Modifier le tableau' : 'Nouveau tableau Kanban'}
          </h3>
          {saveError && <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{saveError}</div>}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nom</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Ex : Projets en cours"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14, border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = color} onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Icône</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: 'none',
                    backgroundColor: emoji===e ? color+'25' : '#F9FAFB', cursor: 'pointer', fontSize: 18,
                    outline: emoji===e ? `2px solid ${color}` : 'none' }}>{e}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Couleur</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: c, border: 'none', cursor: 'pointer',
                    outline: color===c ? `3px solid ${c}` : 'none', outlineOffset: 2,
                    transform: color===c ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.1s' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' }}>Annuler</button>
            <button onClick={handleSave} disabled={!name.trim() || saving}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', backgroundColor: color, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: (!name.trim() || saving) ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(0)} Ko`
  return `${(bytes/(1024*1024)).toFixed(1)} Mo`
}

// ── Mini-carte polaroid ───────────────────────────────────────────────────────
function MiniCard({ item, rotate, tx, ty, zIdx, size = 100 }) {
  const [err, setErr] = useState(false)
  const h = Math.round(size * 1.25)
  const TYPE_BG    = { image:'#DBEAFE', document:'#FEE2E2', link:'#D1FAE5', note:'#FFFBEB' }
  const TYPE_EMOJI = { image:'🖼️', document:'📄', link:'🔗', note:'📝' }
  return (
    <div style={{
      position:'absolute', width:size, height:h, borderRadius:Math.round(size*0.08),
      boxShadow:'0 3px 10px rgba(0,0,0,0.22)',
      transform:`rotate(${rotate}deg) translate(${tx}px,${ty}px)`,
      zIndex:zIdx, overflow:'hidden',
      backgroundColor: item.type==='image' && item.file_url && !err ? '#fff' : TYPE_BG[item.type]||'#F3F4F6',
      border:'2.5px solid #fff',
    }}>
      {item.type==='image' && item.file_url && !err ? (
        <img src={item.file_url} alt="" onError={()=>setErr(true)}
          style={{width:'100%',height:'100%',objectFit:'cover'}} />
      ) : (
        <div style={{width:'100%',height:'100%',display:'flex',
          alignItems:'center',justifyContent:'center',fontSize:Math.round(size*0.44)}}>
          {TYPE_EMOJI[item.type]||'📁'}
        </div>
      )}
    </div>
  )
}

// ── Éventail ─────────────────────────────────────────────────────────────────
function FanPreview({ previews, cardSize = 100 }) {
  const cw = Math.round(cardSize * 2.3)
  const ch = Math.round(cardSize * 1.3)
  const FAN = [
    { rotate:-11, tx:Math.round(-cardSize*0.54), ty:Math.round(cardSize*0.08) },
    { rotate:-3,  tx:Math.round(-cardSize*0.10), ty:0 },
    { rotate: 6,  tx:Math.round( cardSize*0.34), ty:Math.round(cardSize*0.06) },
  ]
  return (
    <div style={{position:'relative',width:cw,height:ch}}>
      {previews.slice(0,3).map((item,i)=>(
        <MiniCard key={item.id} item={item}
          rotate={FAN[i].rotate} tx={FAN[i].tx} ty={FAN[i].ty} zIdx={i+1}
          size={cardSize} />
      ))}
    </div>
  )
}

// ── Stats compactes ───────────────────────────────────────────────────────────
function StatLine({ stats, subCount }) {
  const labels = {
    image:(n)=>`${n} image${n>1?'s':''}`,
    document:(n)=>`${n} doc${n>1?'s':''}`,
    link:(n)=>`${n} lien${n>1?'s':''}`,
    note:(n)=>`${n} note${n>1?'s':''}`,
  }
  const parts = []
  if (subCount > 0) parts.push(`${subCount} dossier${subCount>1?'s':''}`)
  if (stats) Object.entries(stats).filter(([,n])=>n>0).forEach(([t,n])=>{
    if (labels[t]) parts.push(labels[t](n))
  })
  if (parts.length===0) return <span style={{fontSize:11,color:'#D1D5DB'}}>Vide</span>
  return <span style={{fontSize:11,color:'#9CA3AF',lineHeight:1.4}}>{parts.join(' · ')}</span>
}

// ── Carte dossier (2 tailles) ─────────────────────────────────────────────────
function FolderCard({ folder, previews, stats, subCount=0, onOpen, onEdit, onPin, onDelete, onMove, canEdit, compact=false }) {
  const [menu,setMenu] = useState(false)
  const btnRef = useRef(null)

  const headerH  = compact ? 110 : 145
  const cardSize = compact ? 62  : 100
  const emojiBadgeSize = compact ? 26 : 38

  return (
    <div onClick={onOpen}
      style={{borderRadius:14,overflow:'hidden',cursor:'pointer',
        boxShadow: folder.pinned
          ? `0 0 0 2px ${folder.color},0 4px 20px ${folder.color}40`
          : '0 2px 8px rgba(0,0,0,0.08)',
        transition:'all 0.2s',position:'relative',backgroundColor:'#fff'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow=folder.pinned?`0 0 0 2px ${folder.color},0 8px 24px ${folder.color}50`:'0 8px 24px rgba(0,0,0,0.13)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=folder.pinned?`0 0 0 2px ${folder.color},0 4px 20px ${folder.color}40`:'0 2px 8px rgba(0,0,0,0.08)'}}>

      {/* Bandeau */}
      <div style={{height:headerH,backgroundColor:folder.color,
        display:'flex',alignItems:'center',justifyContent:'center',
        position:'relative',overflow:'hidden'}}>
        {previews&&previews.length>0 && <div style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0.08)'}}/>}
        {previews&&previews.length>0 ? (
          <FanPreview previews={previews} cardSize={cardSize} />
        ) : (
          <span style={{fontSize:compact?30:38,position:'relative',zIndex:1}}>{folder.emoji}</span>
        )}
        {previews&&previews.length>0 && (
          <div style={{position:'absolute',bottom:6,right:8,
            backgroundColor:'rgba(255,255,255,0.88)',borderRadius:999,
            width:emojiBadgeSize,height:emojiBadgeSize,display:'flex',
            alignItems:'center',justifyContent:'center',fontSize:emojiBadgeSize*0.53,zIndex:10}}>
            {folder.emoji}
          </div>
        )}
        {folder.pinned && (
          <div style={{position:'absolute',top:8,left:8,
            backgroundColor:'rgba(255,255,255,0.9)',borderRadius:999,
            padding:'2px 6px',fontSize:11,fontWeight:700,color:folder.color,zIndex:10}}>
            📌
          </div>
        )}
        {canEdit && (
          <div style={{position:'absolute',top:8,right:8,zIndex:20}}
            onClick={e=>e.stopPropagation()}>
            <button ref={btnRef} onClick={()=>setMenu(m=>!m)}
              style={{backgroundColor:'rgba(255,255,255,0.9)',border:'none',
                borderRadius:999,width:28,height:28,cursor:'pointer',
                fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',color:'#374151'}}>
              ⋯
            </button>
            {menu&&(
              <ContextMenu btnRef={btnRef} onClose={()=>setMenu(false)} items={[
                {label:folder.pinned?'📌 Désépingler':'📌 Épingler',action:onPin},
                {label:'✏️ Modifier',action:onEdit},
                {label:'📂 Déplacer vers…',action:()=>{onMove?.()}},
                {label:'🗑️ Supprimer',action:onDelete,danger:true},
              ]} />
            )}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div style={{padding:compact?'9px 12px 12px':'10px 13px 13px'}}>
        <div style={{fontWeight:700,fontSize:compact?13:13,color:'#111',
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:3}}>
          {folder.name}
        </div>
        <StatLine stats={stats} subCount={subCount} />
      </div>
    </div>
  )
}

// ── Carte item ────────────────────────────────────────────────────────────────
function ItemCard({ item, onDelete, canDelete }) {
  const [imgError,setImgError] = useState(false)
  const handleClick = ()=>{
    if(item.type==='link'&&item.content) window.open(item.content,'_blank','noopener')
    else if(item.file_url) window.open(item.file_url,'_blank','noopener')
  }
  return (
    <div onClick={handleClick}
      style={{borderRadius:12,overflow:'hidden',backgroundColor:'#fff',
        boxShadow:'0 1px 4px rgba(0,0,0,0.07)',transition:'all 0.15s',
        cursor:item.type==='link'||item.file_url?'pointer':'default',
        border:'1px solid #F3F4F6'}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)';e.currentTarget.style.transform='translateY(-2px)'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.07)';e.currentTarget.style.transform='translateY(0)'}}>

      {item.type==='image'&&item.file_url&&!imgError ? (
        <div style={{height:140,overflow:'hidden',backgroundColor:'#F9FAFB'}}>
          <img src={item.file_url} alt={item.title||''} onError={()=>setImgError(true)}
            style={{width:'100%',height:'100%',objectFit:'cover'}} />
        </div>
      ) : item.type==='note' ? (
        <div style={{height:80,backgroundColor:'#FFFBEB',padding:'12px 14px',
          fontSize:13,color:'#78350F',overflow:'hidden',lineHeight:1.5,borderBottom:'1px solid #FEF3C7'}}>
          {item.content||item.title||''}
        </div>
      ) : (
        <div style={{height:80,backgroundColor:softBg(
            item.type==='document'?'#EF4444':item.type==='link'?'#10B981':'#6366F1'),
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>
          {item.type==='document'?'📄':item.type==='link'?'🔗':'🖼️'}
        </div>
      )}

      <div style={{padding:'10px 12px 12px'}}>
        <div style={{fontWeight:600,fontSize:13,color:'#111',marginBottom:3,
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {item.title||item.file_name||item.content||'Sans titre'}
        </div>
        {item.type==='link'&&item.content&&(
          <div style={{fontSize:11,color:'#6B7280',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {(()=>{try{return new URL(item.content).hostname}catch{return item.content}})()}
          </div>
        )}
        {item.description&&(
          <div style={{fontSize:11,color:'#9CA3AF',marginTop:2,overflow:'hidden',
            display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
            {item.description}
          </div>
        )}
        {item.file_size&&<div style={{fontSize:10,color:'#D1D5DB',marginTop:4}}>{fmtSize(item.file_size)}</div>}
      </div>

      {canDelete&&(
        <div style={{borderTop:'1px solid #F9FAFB',padding:'6px 12px',textAlign:'right'}}
          onClick={e=>e.stopPropagation()}>
          <button onClick={onDelete}
            style={{fontSize:11,color:'#D1D5DB',background:'none',border:'none',cursor:'pointer',fontWeight:500}}
            onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
            onMouseLeave={e=>e.currentTarget.style.color='#D1D5DB'}>
            Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Modal dossier ─────────────────────────────────────────────────────────────
function FolderModal({ initial, onClose, onSave }) {
  const [name,setName]   = useState(initial?.name  || '')
  const [color,setColor] = useState(initial?.color || COLORS[0])
  const [emoji,setEmoji] = useState(initial?.emoji || '📁')
  const [saving,setSaving] = useState(false)
  const [saveError,setSaveError] = useState('')
  const handleSave = async ()=>{
    if(!name.trim()) return
    setSaving(true); setSaveError('')
    try { await onSave({name:name.trim(),color,emoji}) }
    catch(err){ setSaveError(err.message||'Erreur lors de la sauvegarde'); setSaving(false) }
  }
  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{backgroundColor:'#fff',borderRadius:16,width:'100%',maxWidth:460,
        boxShadow:'0 20px 60px rgba(0,0,0,0.25)',overflow:'hidden'}}>
        <div style={{height:100,backgroundColor:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>{emoji}</div>
        <div style={{padding:'20px 24px 24px'}}>
          <h3 style={{fontWeight:700,fontSize:16,color:'#111',marginBottom:20}}>
            {initial?'Modifier le dossier':'Nouveau dossier'}
          </h3>
          {saveError&&<div style={{backgroundColor:'#FEE2E2',color:'#DC2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:14}}>{saveError}</div>}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Nom</label>
            <input value={name} onChange={e=>setName(e.target.value)} autoFocus placeholder="Ex : Ressources pédagogiques"
              style={{width:'100%',padding:'9px 12px',borderRadius:8,fontSize:14,border:'1.5px solid #E5E7EB',outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor=color} onBlur={e=>e.target.style.borderColor='#E5E7EB'}
              onKeyDown={e=>e.key==='Enter'&&handleSave()} />
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:8}}>Icône</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {EMOJIS.map(e=>(
                <button key={e} onClick={()=>setEmoji(e)}
                  style={{width:36,height:36,borderRadius:8,border:'none',
                    backgroundColor:emoji===e?color+'25':'#F9FAFB',cursor:'pointer',fontSize:18,lineHeight:1,
                    outline:emoji===e?`2px solid ${color}`:'none'}}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:8}}>Couleur</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {COLORS.map(c=>(
                <button key={c} onClick={()=>setColor(c)}
                  style={{width:28,height:28,borderRadius:999,backgroundColor:c,border:'none',cursor:'pointer',
                    outline:color===c?`3px solid ${c}`:'none',outlineOffset:2,
                    transform:color===c?'scale(1.15)':'scale(1)',transition:'all 0.1s'}} />
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,border:'1.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:14,fontWeight:600,color:'#374151'}}>Annuler</button>
            <button onClick={handleSave} disabled={!name.trim()||saving}
              style={{flex:1,padding:'10px',borderRadius:10,border:'none',backgroundColor:color,color:'#fff',cursor:'pointer',fontSize:14,fontWeight:600,opacity:(!name.trim()||saving)?0.6:1}}>
              {saving?'Enregistrement…':initial?'Modifier':'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout d'item ────────────────────────────────────────────────────────

// ── Modal "Déplacer vers" ─────────────────────────────────────────────────────
function MoveToModal({ entity, folders, currentFolderId, onClose, onMove }) {
  const [saving, setSaving] = useState(false)
  const available = folders.filter(f => f.id !== currentFolderId && f.id !== entity?.id)
  const handleMove = async (targetFolderId) => {
    setSaving(true)
    await onMove(entity, targetFolderId)
    setSaving(false)
    onClose()
  }
  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1050,padding:16}}>
      <div style={{backgroundColor:'#fff',borderRadius:16,width:'100%',maxWidth:400,
        maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #F3F4F6',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#111'}}>
            📂 Déplacer vers un dossier
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
          {available.length === 0 ? (
            <div style={{textAlign:'center',padding:'32px 16px',color:'#9CA3AF',fontSize:13}}>
              Aucun autre dossier disponible.<br/>Créez un dossier d'abord.
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {currentFolderId && (
                <button onClick={()=>handleMove(null)} disabled={saving}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                    borderRadius:10,border:'1.5px dashed #E5E7EB',background:'#fff',
                    cursor:'pointer',textAlign:'left',width:'100%',
                    fontSize:13,color:'#6B7280',fontWeight:500}}
                  onMouseEnter={e=>{e.currentTarget.style.backgroundColor='#F9FAFB';e.currentTarget.style.borderColor='#9CA3AF'}}
                  onMouseLeave={e=>{e.currentTarget.style.backgroundColor='#fff';e.currentTarget.style.borderColor='#E5E7EB'}}>
                  <span style={{fontSize:20}}>🏠</span>
                  <span>Racine (retirer du dossier)</span>
                </button>
              )}
              {available.map(f => (
                <button key={f.id} onClick={()=>handleMove(f.id)} disabled={saving}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                    borderRadius:10,border:'1.5px solid #E5E7EB',background:'#fff',
                    cursor:'pointer',textAlign:'left',width:'100%',
                    fontSize:13,color:'#374151',fontWeight:500}}
                  onMouseEnter={e=>{e.currentTarget.style.backgroundColor=f.color+'18';e.currentTarget.style.borderColor=f.color}}
                  onMouseLeave={e=>{e.currentTarget.style.backgroundColor='#fff';e.currentTarget.style.borderColor='#E5E7EB'}}>
                  <div style={{width:32,height:32,borderRadius:8,backgroundColor:f.color,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    {f.emoji}
                  </div>
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{padding:'12px 16px',borderTop:'1px solid #F3F4F6'}}>
          <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:10,
            border:'1.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151'}}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

function AddItemModal({ folder, tab, onClose, onAdded, onCreateBoard, onCreateDoc, onCreateListe }) {
  const { user } = useAuth()
  const fileRef   = useRef(null)
  const [type,setType]               = useState('link')
  const [title,setTitle]             = useState('')
  const [content,setContent]         = useState('')
  const [description,setDescription] = useState('')
  const [file,setFile]               = useState(null)
  const [saving,setSaving]           = useState(false)
  const [error,setError]             = useState('')
  const [compressing,setCompressing] = useState(false)
  const TYPES = [
    {key:'link',    label:'Lien',       emoji:'🔗'},
    {key:'image',   label:'Image',      emoji:'🖼️'},
    {key:'pdf',     label:'PDF',        emoji:'📕'},
    {key:'word',    label:'Word',       emoji:'📘'},
    {key:'kanban',  label:'Tableau',    emoji:'📋'},
    ...(tab==='shared'?[{key:'collab_doc',label:'Document',emoji:'📝'}]:[]),
    {key:'liste',      label:'Liste',      emoji:'📊'},
  ]
  const handleFileChange = async(e)=>{
    const f=e.target.files[0]; if(!f) return
    if(type==='image'){
      setCompressing(true)
      try{const c=await imageCompression(f,{maxSizeMB:1,maxWidthOrHeight:1920,useWebWorker:true});setFile(c)}
      catch{setFile(f)}
      setCompressing(false)
    } else setFile(f)
    if(!title) setTitle(f.name.replace(/\.[^.]+$/,''))
  }
  const handleSpecialAction = ()=>{
    if(type==='kanban'){ onClose(); onCreateBoard?.() }
    if(type==='collab_doc'){ onClose(); onCreateDoc?.() }
    if(type==='liste'){ onClose(); onCreateListe?.() }
  }
  const handleSave = async()=>{
    setError(''); setSaving(true)
    try{
      let fileUrl=null,fileName=null,fileSize=null
      if(file){
        const ext=file.name.split('.').pop()
        const path=`${user.id}/${folder.id}/${Date.now()}.${ext}`
        const{error:upErr}=await supabase.storage.from('padlet-files').upload(path,file)
        if(upErr) throw upErr
        const{data:urlData}=supabase.storage.from('padlet-files').getPublicUrl(path)
        fileUrl=urlData.publicUrl; fileName=file.name; fileSize=file.size
      }
      const{error:insErr}=await supabase.from('padlet_items').insert({
        folder_id:folder.id,type,
        title:title||null,
        content:type==='link'?content:null,
        description:description||null,
        file_url:fileUrl,file_name:fileName,file_size:fileSize,created_by:user.id,
      })
      if(insErr) throw insErr
      onAdded()
    }catch(e){setError(e.message)}
    finally{setSaving(false)}
  }
  const isValid=()=>{
    if(type==='link') return content.trim().length>0
    if(type==='kanban'||type==='collab_doc'||type==='liste') return true
    return file!==null
  }
  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{backgroundColor:'#fff',borderRadius:16,width:'100%',maxWidth:480,
        maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #F3F4F6',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#111'}}>
            Ajouter dans <span style={{color:folder.color}}>{folder.emoji} {folder.name}</span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'18px 20px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20}}>
            {TYPES.map(t=>(
              <button key={t.key} onClick={()=>{setType(t.key);setFile(null);setContent('')}}
                style={{padding:'8px 4px',borderRadius:10,border:'2px solid',
                  borderColor:type===t.key?folder.color:'#E5E7EB',
                  backgroundColor:type===t.key?softBg(folder.color):'#fff',
                  cursor:'pointer',fontSize:12,fontWeight:600,
                  color:type===t.key?folder.color:'#6B7280'}}>
                <div style={{fontSize:18,marginBottom:2}}>{t.emoji}</div>{t.label}
              </button>
            ))}
          </div>
          {error&&<div style={{backgroundColor:'#FEE2E2',color:'#DC2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:14}}>{error}</div>}
          {type==='link'&&<>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>URL *</label>
              <input value={content} onChange={e=>setContent(e.target.value)} placeholder="https://…"
                style={{width:'100%',padding:'8px 10px',borderRadius:7,fontSize:13,border:'1.5px solid #E5E7EB',outline:'none',boxSizing:'border-box'}} />
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Titre</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titre du lien"
                style={{width:'100%',padding:'8px 10px',borderRadius:7,fontSize:13,border:'1.5px solid #E5E7EB',outline:'none',boxSizing:'border-box'}} />
            </div>
          </>}
          {(type==='image'||type==='pdf'||type==='word')&&<>
            <div style={{marginBottom:14}}>
              <div onClick={()=>fileRef.current?.click()}
                style={{border:'2px dashed #E5E7EB',borderRadius:10,padding:'24px 16px',textAlign:'center',cursor:'pointer',backgroundColor:'#F9FAFB',transition:'all 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=folder.color;e.currentTarget.style.backgroundColor=softBg(folder.color)}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#E5E7EB';e.currentTarget.style.backgroundColor='#F9FAFB'}}>
                {compressing?<div style={{color:'#6B7280',fontSize:13}}>⏳ Compression…</div>
                :file?<div>
                  <div style={{fontSize:24,marginBottom:6}}>{type==='image'?'🖼️':type==='pdf'?'📕':'📘'}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{file.name}</div>
                  <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{fmtSize(file.size)}</div>
                  <div style={{fontSize:11,color:folder.color,marginTop:4}}>Cliquer pour changer</div>
                </div>:<div>
                  <div style={{fontSize:32,marginBottom:8}}>{type==='image'?'🖼️':type==='pdf'?'📕':'📘'}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:4}}>
                    {type==='image'?'Cliquer pour ajouter une image':type==='pdf'?'Cliquer pour ajouter un PDF':'Cliquer pour ajouter un document Word'}
                  </div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>
                    {type==='image'?'JPG, PNG, WebP · max 25 Mo (compressé auto)':type==='pdf'?'PDF · max 25 Mo':'DOC, DOCX · max 25 Mo'}
                  </div>
                </div>}
              </div>
              <input ref={fileRef} type="file" style={{display:'none'}}
                accept={type==='image'?'image/*':type==='pdf'?'.pdf':'.doc,.docx'} onChange={handleFileChange} />
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Titre</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titre optionnel"
                style={{width:'100%',padding:'8px 10px',borderRadius:7,fontSize:13,border:'1.5px solid #E5E7EB',outline:'none',boxSizing:'border-box'}} />
            </div>
          </>}
          {type==='kanban'&&(
            <div style={{textAlign:'center',padding:'24px 16px',backgroundColor:'#F9FAFB',borderRadius:10,marginBottom:14}}>
              <div style={{fontSize:40,marginBottom:8}}>📋</div>
              <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Nouveau tableau Kanban</div>
              <div style={{fontSize:12,color:'#9CA3AF'}}>Vous pourrez choisir le nom et la couleur à l'étape suivante.</div>
            </div>
          )}
          {type==='collab_doc'&&(
            <div style={{textAlign:'center',padding:'24px 16px',background:'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(99,102,241,0.08))',borderRadius:10,marginBottom:14}}>
              <div style={{fontSize:40,marginBottom:8}}>📝</div>
              <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Nouveau document collaboratif</div>
              <div style={{fontSize:12,color:'#9CA3AF'}}>Le document sera créé et ouvert immédiatement.<br/>Vous pourrez le renommer et l'éditer en direct.</div>
            </div>
          )}
          {type==='liste'&&(
            <div style={{textAlign:'center',padding:'24px 16px',background:'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.08))',borderRadius:10,marginBottom:14}}>
              <div style={{fontSize:40,marginBottom:8}}>📊</div>
              <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Nouvelle liste d'élèves</div>
              <div style={{fontSize:12,color:'#9CA3AF'}}>Choisissez les élèves et les colonnes à l'étape suivante.<br/>La liste se synchronise en temps réel.</div>
            </div>
          )}
          {type!=='kanban'&&type!=='collab_doc'&&type!=='liste'&&(
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>Description</label>
              <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optionnel"
                style={{width:'100%',padding:'8px 10px',borderRadius:7,fontSize:13,border:'1.5px solid #E5E7EB',outline:'none',boxSizing:'border-box'}} />
            </div>
          )}
        </div>
        <div style={{padding:'14px 20px',borderTop:'1px solid #F3F4F6',display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,border:'1.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151'}}>Annuler</button>
          <button onClick={type==='kanban'||type==='collab_doc'||type==='liste'?handleSpecialAction:handleSave}
            disabled={(type!=='kanban'&&type!=='collab_doc'&&type!=='liste')&&(!isValid()||saving||compressing)}
            style={{flex:2,padding:'10px',borderRadius:10,border:'none',backgroundColor:folder.color,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,
              opacity:((type!=='kanban'&&type!=='collab_doc'&&type!=='liste')&&(!isValid()||saving||compressing))?0.6:1}}>
            {saving?'Ajout…':type==='kanban'?'Créer le tableau':type==='collab_doc'?'Créer le document':type==='liste'?'Configurer la liste':'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Filtre par type ───────────────────────────────────────────────────────────
// ── ListeCard avec menu contextuel ───────────────────────────────────────────
function ListeCard({ liste, onOpen, onRename, onMove, onDelete, canEdit }) {
  const [menu, setMenu] = useState(false)
  const btnRef = useRef(null)
  const items = [
    { label: '✏️ Renommer',        action: onRename },
    { label: '📂 Déplacer vers…',  action: onMove },
    { label: '🗑️ Supprimer',       action: onDelete, danger: true },
  ]
  return (
    <div style={{borderRadius:14,overflow:'hidden',backgroundColor:'#fff',
      boxShadow:'0 2px 8px rgba(0,0,0,0.08)',transition:'all 0.2s',position:'relative'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.13)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'}}>
      <div onClick={onOpen} style={{cursor:'pointer'}}>
        <div style={{height:80,background:'linear-gradient(135deg,#10B981,#3B82F6)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,position:'relative'}}>
          📊
          {canEdit && (
            <button ref={btnRef} onClick={e=>{e.stopPropagation();setMenu(v=>!v)}}
              style={{position:'absolute',top:6,right:6,background:'rgba(255,255,255,0.9)',border:'none',
                borderRadius:999,width:26,height:26,cursor:'pointer',fontSize:13,
                display:'flex',alignItems:'center',justifyContent:'center',color:'#374151'}}>
              ⋯
            </button>
          )}
        </div>
        <div style={{padding:'10px 12px 12px'}}>
          <div style={{fontWeight:700,fontSize:13,color:'#111',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{liste.name}</div>
          <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>Liste · {(liste.eleve_ids||[]).length} élève{(liste.eleve_ids||[]).length!==1?'s':''}</div>
        </div>
      </div>
      {menu && <ContextMenu btnRef={btnRef} items={items} onClose={()=>setMenu(false)} />}
    </div>
  )
}

// ── DocCard avec menu contextuel ──────────────────────────────────────────────
function DocCard({ doc, onOpen, onRename, onMove, onDelete, canEdit }) {
  const [menu, setMenu] = useState(false)
  const btnRef = useRef(null)
  const items = [
    { label: '✏️ Renommer',        action: onRename },
    { label: '📂 Déplacer vers…',  action: onMove },
    { label: '🗑️ Supprimer',       action: onDelete, danger: true },
  ]
  return (
    <div style={{borderRadius:14,overflow:'hidden',backgroundColor:'#fff',
      boxShadow:'0 2px 8px rgba(0,0,0,0.08)',transition:'all 0.2s',position:'relative'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.13)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'}}>
      <div onClick={onOpen} style={{cursor:'pointer'}}>
        <div style={{height:80,background:'linear-gradient(135deg,#3B82F6,#6366F1)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,position:'relative'}}>
          📝
          {canEdit && (
            <button ref={btnRef} onClick={e=>{e.stopPropagation();setMenu(v=>!v)}}
              style={{position:'absolute',top:6,right:6,background:'rgba(255,255,255,0.9)',border:'none',
                borderRadius:999,width:26,height:26,cursor:'pointer',fontSize:13,
                display:'flex',alignItems:'center',justifyContent:'center',color:'#374151'}}>
              ⋯
            </button>
          )}
        </div>
        <div style={{padding:'10px 12px 12px'}}>
          <div style={{fontWeight:700,fontSize:13,color:'#111',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{doc.name}</div>
          <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>Document collaboratif</div>
        </div>
      </div>
      {menu && <ContextMenu btnRef={btnRef} items={items} onClose={()=>setMenu(false)} />}
    </div>
  )
}



// ── MultiSearchSelect (réutilisé depuis Articles) ─────────────────────────────
function MultiSearchSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const filtered = useMemo(() => options.filter(o => o.toLowerCase().includes(q.toLowerCase())), [options, q])
  const isSelected = v => Array.isArray(value) && value.includes(v)
  const toggle = v => {
    const arr = Array.isArray(value) ? value : []
    onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  }
  const selectedOptions = options.filter(o => isSelected(o))
  return (
    <div ref={ref} style={{position:'relative'}}>
      <div onClick={() => setOpen(o => !o)}
        style={{border:'1.5px solid #E5E7EB',borderRadius:10,padding:'8px 12px',cursor:'pointer',
          minHeight:38,display:'flex',flexWrap:'wrap',gap:4,alignItems:'center',backgroundColor:'#fff'}}>
        {selectedOptions.length === 0 && <span style={{color:'#9CA3AF',fontSize:13,flex:1}}>{placeholder}</span>}
        {selectedOptions.map(o => (
          <span key={o} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(45,27,46,0.08)',
            color:'#2D1B2E',fontSize:12,borderRadius:999,padding:'2px 8px',fontWeight:600}}>
            {o}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(o) }}
              style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:14,lineHeight:1,padding:0}}>×</button>
          </span>
        ))}
        <svg style={{marginLeft:'auto',flexShrink:0,color:'#9CA3AF'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {open && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:4,
          backgroundColor:'#fff',border:'1.5px solid #E5E7EB',borderRadius:10,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:100,maxHeight:220,display:'flex',flexDirection:'column'}}>
          <div style={{padding:'8px 10px',borderBottom:'1px solid #F3F4F6'}}>
            <div style={{position:'relative'}}>
              <svg style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF'}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Rechercher…"
                style={{width:'100%',paddingLeft:24,paddingRight:8,paddingTop:5,paddingBottom:5,
                  fontSize:13,border:'1.5px solid #E5E7EB',borderRadius:8,outline:'none',boxSizing:'border-box'}} />
            </div>
          </div>
          <div style={{overflowY:'auto'}}>
            {filtered.length === 0 && <p style={{color:'#9CA3AF',fontSize:12,textAlign:'center',padding:'10px 0'}}>Aucun résultat</p>}
            {filtered.map(o => {
              const sel = isSelected(o)
              return (
                <button key={o} type="button" onClick={() => toggle(o)}
                  style={{width:'100%',textAlign:'left',padding:'8px 12px',fontSize:13,border:'none',
                    cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                    backgroundColor:sel?'rgba(45,27,46,0.04)':'transparent',
                    color:sel?'#2D1B2E':'#374151',fontWeight:sel?600:400}}>
                  <span style={{width:16,height:16,borderRadius:4,border:`2px solid ${sel?'#2D1B2E':'#D1D5DB'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                    backgroundColor:sel?'#2D1B2E':'transparent'}}>
                    {sel && <span style={{color:'#fff',fontSize:10,lineHeight:1}}>✓</span>}
                  </span>
                  {o}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal création liste d'élèves ─────────────────────────────────────────────
function ListeModal({ folder, tab, onClose, onCreate }) {
  const [step, setStep] = useState(1)     // 1 = nom, 2 = sélection élèves
  const [name, setName] = useState('')
  const [allEleves, setAllEleves] = useState([])
  const [selClasses, setSelClasses] = useState([])
  const [selGroupes, setSelGroupes] = useState([])
  const [loading, setLoading] = useState(false)

  // Charger tous les élèves au montage
  useEffect(() => {
    supabase.from('eleves').select('id,nom,prenom,classe,groupes_ss')
      .order('classe').order('nom').order('prenom')
      .then(({ data }) => setAllEleves(data || []))
  }, [])

  const getEleveGroupes = (e) => {
    const g = e.groupes_ss
    if (!g) return []
    if (Array.isArray(g)) return g
    try { const p = JSON.parse(g); return Array.isArray(p) ? p : [] } catch { return [] }
  }

  // Dériver classes et groupes uniques
  const classes = [...new Set(allEleves.map(e => e.classe).filter(Boolean))].sort()
  const groupes = [...new Set(
    allEleves.flatMap(e => getEleveGroupes(e))
  )].sort()

  // Dériver les IDs sélectionnés depuis selClasses + selGroupes
  const selected = useMemo(() => {
    const ids = new Set()
    selClasses.forEach(c => allEleves.filter(e => e.classe === c).forEach(e => ids.add(e.id)))
    selGroupes.forEach(g => allEleves.filter(e => getEleveGroupes(e).includes(g)).forEach(e => ids.add(e.id)))
    return ids
  }, [selClasses, selGroupes, allEleves])

  const handleCreate = () => {
    if (!name.trim()) { setStep(2); return }
    onCreate(name.trim(), [...selected])
  }

  return (
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{backgroundColor:'#fff',borderRadius:16,width:'100%',maxWidth:520,
        maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>

        {/* Header */}
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #F3F4F6',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:'#111'}}>
              📊 Nouvelle liste d'élèves
            </div>
            <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>Étape {step}/2</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:20,lineHeight:1}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'18px 20px'}}>
          {step === 1 && (
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
                Nom de la liste
              </label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
                placeholder="ex. Présence — voyage 6e, Remédiation maths…"
                style={{width:'100%',padding:'10px 12px',borderRadius:8,fontSize:14,
                  border:'1.5px solid #E5E7EB',outline:'none',boxSizing:'border-box',marginBottom:8}}
                onFocus={e => e.target.style.borderColor='#2D1B2E'}
                onBlur={e => e.target.style.borderColor='#E5E7EB'}
              />
              <div style={{fontSize:11,color:'#9CA3AF'}}>Vous choisirez les élèves à l'étape suivante.</div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:16}}>
                Sélectionner les élèves — <span style={{color:'#2D1B2E'}}>{selected.size} sélectionné{selected.size!==1?'s':''}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF',marginBottom:6}}>📚 Classes</div>
                  <MultiSearchSelect options={classes} value={selClasses} onChange={setSelClasses} placeholder="Choisir des classes…" />
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF',marginBottom:6}}>👥 Groupes SS</div>
                  <MultiSearchSelect options={groupes} value={selGroupes} onChange={setSelGroupes} placeholder="Choisir des groupes…" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 20px',borderTop:'1px solid #F3F4F6',display:'flex',gap:10}}>
          {step===2 && (
            <button onClick={()=>setStep(1)}
              style={{padding:'10px 16px',borderRadius:10,border:'1.5px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151'}}>
              ← Retour
            </button>
          )}
          <button onClick={onClose}
            style={{flex:step===1?1:0,padding:'10px',borderRadius:10,border:'1.5px solid #E5E7EB',
              background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151'}}>
            Annuler
          </button>
          {step===1 ? (
            <button onClick={()=>name.trim()&&setStep(2)}
              disabled={!name.trim()}
              style={{flex:2,padding:'10px',borderRadius:10,border:'none',
                backgroundColor:name.trim()?'#2D1B2E':'#E5E7EB',
                color:name.trim()?'#fff':'#9CA3AF',
                cursor:name.trim()?'pointer':'default',fontSize:13,fontWeight:600}}>
              Suivant →
            </button>
          ) : (
            <button onClick={handleCreate}
              disabled={selected.size===0}
              style={{flex:2,padding:'10px',borderRadius:10,border:'none',
                backgroundColor:selected.size>0?'#2D1B2E':'#E5E7EB',
                color:selected.size>0?'#fff':'#9CA3AF',
                cursor:selected.size>0?'pointer':'default',fontSize:13,fontWeight:600}}>
              Créer la liste ({selected.size} élève{selected.size!==1?'s':''})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


function TypeFilter({ subFolders, items, boards, docs, listes, value, onChange }) {
  const counts = {
    all:    subFolders.length + items.length + (boards?.length||0) + (docs?.length||0) + (listes?.length||0),
    folder: subFolders.length,
    image:  items.filter(i=>i.type==='image').length,
    pdf:    items.filter(i=>i.type==='pdf'||i.type==='document').length,
    word:   items.filter(i=>i.type==='word').length,
    link:   items.filter(i=>i.type==='link').length,
    kanban: boards?.length||0,
    collab: docs?.length||0,
    liste:  listes?.length||0,
  }
  const buttons = [
    {key:'all',    label:'Tout',      emoji:''},
    {key:'folder', label:'Dossiers',  emoji:'📁'},
    {key:'image',  label:'Images',    emoji:'🖼️'},
    {key:'pdf',    label:'PDF',       emoji:'📕'},
    {key:'word',   label:'Word',      emoji:'📘'},
    {key:'link',   label:'Liens',     emoji:'🔗'},
    {key:'kanban', label:'Tableaux',  emoji:'📋'},
    {key:'collab', label:'Docs',      emoji:'📝'},
    {key:'liste',  label:'Listes',    emoji:'📊'},
  ].filter(b => b.key==='all' || counts[b.key]>0)

  if (buttons.length <= 2) return null  // seulement "Tout" + 1 type → inutile

  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:20}}>
      {buttons.map(b=>(
        <button key={b.key} onClick={()=>onChange(b.key)}
          style={{padding:'5px 12px',borderRadius:999,border:'1.5px solid',
            borderColor:value===b.key?'#2D1B2E':'#E5E7EB',
            backgroundColor:value===b.key?'#2D1B2E':'#fff',
            color:value===b.key?'#fff':'#6B7280',
            fontSize:12,fontWeight:600,cursor:'pointer',
            display:'flex',alignItems:'center',gap:4}}>
          {b.emoji&&<span style={{fontSize:14}}>{b.emoji}</span>}
          {b.label}
          <span style={{fontSize:11,opacity:0.7,marginLeft:2}}>{counts[b.key]}</span>
        </button>
      ))}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function SalleDProfs() {
  const { user, isAdmin } = useAuth()

  // Navigation
  const [openBoard,   setOpenBoard]   = useState(null)  // tableau Trello ouvert
  const [openColDoc,  setOpenColDoc]  = useState(null)  // doc collaboratif ouvert
  const [openListe,   setOpenListe]   = useState(null)  // liste élèves ouverte
  const [folderBoards, setFolderBoards] = useState([])   // boards dans le dossier courant
  const [folderDocs,   setFolderDocs]   = useState([])   // docs collab dans le dossier courant
  const [folderListes, setFolderListes] = useState([])   // listes élèves dans le dossier courant
  const [triggerAddList, setTriggerAddList] = useState(false)
  const [allItems,   setAllItems]   = useState([])  // grille racine fusionnée
  const [dragActive, setDragActive] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )
  const [boards,     setBoards]     = useState([])
  const [boardModal, setBoardModal] = useState(false)
  const [editBoard,  setEditBoard]  = useState(null)
  const [tab,        setTab]       = useState('shared')
  const [folderPath, setFolderPath] = useState([])   // [] = racine, [f1] = dans f1, [f1,f2] = dans f1/f2

  // Dossiers racine
  const [folders,        setFolders]        = useState([])
  const [folderStats,    setFolderStats]    = useState({})
  const [folderPreviews, setFolderPreviews] = useState({})
  const [loading,        setLoading]        = useState(true)

  // Contenu d'un dossier ouvert
  const [subFolders,        setSubFolders]        = useState([])
  const [subStats,          setSubStats]          = useState({})
  const [subPreviews,       setSubPreviews]        = useState({})
  const [items,             setItems]             = useState([])
  const [typeFilter,        setTypeFilter]        = useState('all')
  const [contentLoading,    setContentLoading]    = useState(false)

  // Modals
  const [folderModal,  setFolderModal]  = useState(false)
  const [editFolder,   setEditFolder]   = useState(null)
  const [addItemModal, setAddItemModal] = useState(false)
  const [moveTarget,  setMoveTarget]   = useState(null)  // { entity, entityType: 'board'|'folder'|'doc' }
  const [listeModal,   setListeModal]   = useState(false)

  const currentFolder = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null

  // ── Helpers stats/previews ─────────────────────────────────────────────────
  const computeStatsAndPreviews = (items, subFolderList) => {
    const stats = {}; const previews = {}
    // Items
    ;(items||[]).forEach(item => {
      if (!stats[item.folder_id])    stats[item.folder_id]    = {image:0,document:0,link:0,note:0}
      if (stats[item.folder_id][item.type] !== undefined) stats[item.folder_id][item.type]++
      if (!previews[item.folder_id]) previews[item.folder_id] = []
      if (previews[item.folder_id].length < 3) previews[item.folder_id].push(item)
    })
    // Sous-dossiers comme preview si dossier encore vide
    ;(subFolderList||[]).forEach(sf => {
      // pseudo-item pour preview éventail du parent
      if (!previews[sf.parent_id]) previews[sf.parent_id] = []
    })
    return {stats,previews}
  }

  // ── Charger tableaux Trello ───────────────────────────────────────────────
  const loadBoards = useCallback(async () => {
    try {
      let q = supabase.from('trello_boards').select('*').eq('type', tab)
      if (tab === 'personal') q = q.eq('created_by', user.id)
      const { data, error } = await q.order('position', { ascending: true })
      if (error) throw error
      setBoards(data || [])
    } catch(err) {
      console.error('loadBoards:', err)
    }
  }, [tab, user.id])

  // ── Charger dossiers racine ────────────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('padlet_folders').select('*')
        .eq('type', tab).is('parent_id', null)
      if (tab==='personal') q = q.eq('created_by', user.id)
      const {data, error} = await q.order('position',{ascending:true})
      if (error) throw error
      const list = data || []
      setFolders(list)
      if (list.length > 0) {
        const {data:padletItemsData} = await supabase.from('padlet_items')
          .select('id,folder_id,type,file_url,content').in('folder_id',list.map(f=>f.id)).order('created_at')
        const {stats,previews} = computeStatsAndPreviews(padletItemsData, [])
        setFolderStats(stats); setFolderPreviews(previews)
      } else {
        setFolderStats({}); setFolderPreviews({})
      }
    } catch(err) {
      console.error('loadFolders:', err)
      setFolders([])
    } finally {
      setLoading(false)
    }
  }, [tab, user.id])

  useEffect(()=>{loadFolders();loadBoards();setFolderPath([]);setOpenBoard(null)}, [loadFolders, loadBoards])

  // Fusionner folders + boards orphelins (folder_id=null) pour la grille racine
  useEffect(() => {
    const orphanBoards = boards.filter(b => !b.folder_id)
    const combined = [
      ...folders.map(f => ({ ...f, _itemType: 'folder', _sortId: `folder-${f.id}` })),
      ...orphanBoards.map(b => ({ ...b, _itemType: 'board',  _sortId: `board-${b.id}` })),
    ].sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    setAllItems(combined)
  }, [folders, boards])

  // ── Charger contenu d'un dossier ───────────────────────────────────────────
  const loadFolderContent = useCallback(async (folder) => {
    setContentLoading(true); setTypeFilter('all')
    try {
      const [{data:subs,error:e1},{data:its,error:e2},{data:bds,error:e3},{data:docs,error:e4},{data:lsts,error:e5}] = await Promise.all([
        supabase.from('padlet_folders').select('*')
          .eq('parent_id',folder.id).order('pinned',{ascending:false}).order('created_at'),
        supabase.from('padlet_items').select('*')
          .eq('folder_id',folder.id).order('created_at'),
        supabase.from('trello_boards').select('*')
          .eq('folder_id',folder.id).order('position',{ascending:true}),
        supabase.from('salle_documents').select('*')
          .eq('folder_id',folder.id).order('updated_at',{ascending:false}),
        supabase.from('salle_listes').select('*')
          .eq('folder_id',folder.id).order('updated_at',{ascending:false}),
      ])
      if (e1) throw e1; if (e2) throw e2
      const subList = subs || []
      setSubFolders(subList)
      setItems(its || [])
      setFolderBoards(bds || [])
      setFolderDocs(docs || [])
      setFolderListes(lsts || [])
      if (subList.length > 0) {
        const {data:subItems} = await supabase.from('padlet_items')
          .select('id,folder_id,type,file_url,content').in('folder_id',subList.map(f=>f.id)).order('created_at')
        const {stats,previews} = computeStatsAndPreviews(subItems, [])
        setSubStats(stats); setSubPreviews(previews)
      } else {
        setSubStats({}); setSubPreviews({})
      }
    } catch(err) {
      console.error('loadFolderContent:', err)
    } finally {
      setContentLoading(false)
    }
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigateTo = (folder) => {
    setFolderPath(prev => [...prev, folder])
    loadFolderContent(folder)
  }
  const navigateToIndex = (idx) => {
    const newPath = folderPath.slice(0, idx+1)
    setFolderPath(newPath)
    loadFolderContent(newPath[newPath.length-1])
  }
  const navigateToRoot = () => { setFolderPath([]); setSubFolders([]); setItems([]) }

  // ── CRUD dossiers ──────────────────────────────────────────────────────────
  const createFolder = async (data) => {
    const {error} = await supabase.from('padlet_folders').insert({
      ...data, type: tab,
      parent_id: currentFolder?.id || null,
      created_by: user.id,
    })
    if (error) throw error
    setFolderModal(false)
    currentFolder ? loadFolderContent(currentFolder) : loadFolders()
  }
  const updateFolder = async (data) => {
    const {error} = await supabase.from('padlet_folders').update({...data,updated_at:new Date().toISOString()}).eq('id',editFolder.id)
    if (error) throw error
    setEditFolder(null)
    currentFolder ? loadFolderContent(currentFolder) : loadFolders()
  }
  const togglePin = async (folder) => {
    await supabase.from('padlet_folders').update({pinned:!folder.pinned}).eq('id',folder.id)
    currentFolder ? loadFolderContent(currentFolder) : loadFolders()
  }
  const deleteFolder = async (folder) => {
    if(!window.confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`)) return
    await supabase.from('padlet_folders').delete().eq('id',folder.id)
    currentFolder ? loadFolderContent(currentFolder) : loadFolders()
  }
  // ── CRUD boards Trello ────────────────────────────────────────────────────
  const createBoard = async (data) => {
    const payload = { ...data, type: tab, created_by: user.id }
    if (currentFolder) payload.folder_id = currentFolder.id
    const { error } = await supabase.from('trello_boards').insert(payload)
    if (error) throw error
    if (currentFolder) { loadFolderContent(currentFolder) } else { await loadBoards() }
    setBoardModal(false)
  }
  const createColDoc = async () => {
    const { data, error } = await supabase.from('salle_documents')
      .insert({ name: 'Sans titre', created_by: user.id, folder_id: currentFolder?.id || null })
      .select().single()
    if (error) { console.error(error); return }
    setFolderDocs(prev => [data, ...prev])
    setOpenColDoc(data)
  }

  const renameListe = async (liste) => {
    const newName = window.prompt('Renommer la liste :', liste.name)
    if (!newName || !newName.trim() || newName.trim() === liste.name) return
    await supabase.from('salle_listes').update({ name: newName.trim() }).eq('id', liste.id)
    setFolderListes(prev => prev.map(l => l.id === liste.id ? { ...l, name: newName.trim() } : l))
  }

  const deleteListe = async (liste) => {
    if (!window.confirm(`Supprimer la liste "${liste.name}" ?`)) return
    await supabase.from('salle_listes').delete().eq('id', liste.id)
    setFolderListes(prev => prev.filter(l => l.id !== liste.id))
  }

  const renameDoc = async (doc) => {
    const newName = window.prompt('Renommer le document :', doc.name)
    if (!newName || !newName.trim() || newName.trim() === doc.name) return
    await supabase.from('salle_documents').update({ name: newName.trim() }).eq('id', doc.id)
    setFolderDocs(prev => prev.map(d => d.id === doc.id ? { ...d, name: newName.trim() } : d))
  }

  const deleteDoc = async (doc) => {
    if (!window.confirm(`Supprimer le document "${doc.name}" ?`)) return
    await supabase.from('salle_documents').delete().eq('id', doc.id)
    setFolderDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  const createListe = async (name, eleveIds) => {
    const { data, error } = await supabase.from('salle_listes')
      .insert({ name: name || 'Sans titre', created_by: user.id, folder_id: currentFolder?.id || null, eleve_ids: eleveIds, type: tab })
      .select().single()
    if (error) { console.error(error); return }
    setFolderListes(prev => [data, ...prev])
    setOpenListe(data)
  }

  const moveEntity = async (entity, targetFolderId) => {
    try {
      const type = moveTarget?.entityType
      if (type === 'board') {
        await supabase.from('trello_boards').update({ folder_id: targetFolderId }).eq('id', entity.id)
      } else if (type === 'folder') {
        await supabase.from('padlet_folders').update({ parent_id: targetFolderId }).eq('id', entity.id)
      } else if (type === 'doc') {
        await supabase.from('salle_documents').update({ folder_id: targetFolderId }).eq('id', entity.id)
      } else if (type === 'liste') {
        await supabase.from('salle_listes').update({ folder_id: targetFolderId }).eq('id', entity.id)
      }
      await loadFolders()
      if (currentFolder) await loadFolderContent(currentFolder)
    } catch(err) {
      console.error('moveEntity:', err)
    }
  }

  // Liste plate de tous les dossiers racine + sous-dossiers pour le MoveToModal
  const allFoldersList = [...folders, ...subFolders]
  const updateBoard = async (data) => {
    const { error } = await supabase.from('trello_boards').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editBoard.id)
    if (error) throw error
    await loadBoards()
    setEditBoard(null)
  }
  const togglePinBoard = async (board) => {
    await supabase.from('trello_boards').update({ pinned: !board.pinned }).eq('id', board.id)
    await loadBoards()
  }
  const deleteBoard = async (board) => {
    if (!window.confirm(`Supprimer le tableau "${board.name}" et tout son contenu ?`)) return
    await supabase.from('trello_boards').delete().eq('id', board.id)
    await loadBoards()
  }

  // ── Drag & drop grille racine ────────────────────────────────────────────
  const handleRootDragStart = ({ active }) => setDragActive(active.id)
  const handleRootDragEnd = async ({ active, over }) => {
    setDragActive(null)
    if (!over || active.id === over.id) return
    const oldIdx = allItems.findIndex(i => i._sortId === active.id)
    const newIdx = allItems.findIndex(i => i._sortId === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(allItems, oldIdx, newIdx)
    setAllItems(reordered)
    // Persister les positions
    const folderUpdates = reordered.filter(i => i._itemType === 'folder')
      .map((i, idx) => supabase.from('padlet_folders').update({ position: idx }).eq('id', i.id))
    const boardUpdates = reordered.filter(i => i._itemType === 'board')
      .map((i, idx) => supabase.from('trello_boards').update({ position: idx }).eq('id', i.id))
    await Promise.all([...folderUpdates, ...boardUpdates])
  }

  // ── DnD items dans dossier ──────────────────────────────────────────────────
  const [itemsDragActive, setItemsDragActive] = useState(null)

  const handleItemDragStart = ({ active }) => setItemsDragActive(active.id)
  const handleItemDragEnd = async ({ active, over }) => {
    setItemsDragActive(null)
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => `item-${i.id}` === active.id)
    const newIdx = items.findIndex(i => `item-${i.id}` === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove([...items], oldIdx, newIdx)
    setItems(reordered)
    await Promise.all(
      reordered.map((it, idx) => supabase.from('padlet_items').update({ position: idx }).eq('id', it.id))
    )
  }

  const deleteItem = async (item) => {
    await supabase.from('padlet_items').delete().eq('id',item.id)
    if(item.file_url){
      const path=item.file_url.split('/padlet-files/')[1]
      if(path) await supabase.storage.from('padlet-files').remove([path])
    }
    setItems(prev=>prev.filter(i=>i.id!==item.id))
  }

  const canEdit = (obj) => isAdmin || obj.created_by === user.id

  // ── Données filtrées ───────────────────────────────────────────────────────
  const filteredSubFolders = typeFilter==='all'||typeFilter==='folder' ? subFolders : []
  const filteredItems = typeFilter==='all'||typeFilter==='folder' ? items
    : typeFilter==='folder' ? []
    : items.filter(i=>i.type===typeFilter)

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    {key:'shared',   label:'Salle des profs'},
    {key:'personal', label:'Mon casier'},
  ]

  // Titre PageHeader
  const headerTitle = openListe
    ? openListe.name
    : openColDoc
    ? openColDoc.name
    : openBoard
    ? openBoard.name
    : currentFolder
    ? currentFolder.name
    : tab==='shared' ? 'Salle des profs' : 'Mon casier'

  const headerSubtitle = openListe
    ? 'Liste d\'élèves'
    : openColDoc
    ? 'Document collaboratif'
    : openBoard
    ? 'Tableau Kanban'
    : currentFolder
    ? (() => {
        const total = subFolders.length + items.length + folderBoards.length + folderDocs.length + folderListes.length
        return `${total} élément${total!==1?'s':''}`
      })()
    : `${folders.length} dossier${folders.length!==1?'s':''}`

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        leftActions={(currentFolder || openBoard || openListe) ? (
          <div style={{display:'flex',alignItems:'center',gap:0}}>
            {/* Breadcrumb */}
            <button onClick={() => { navigateToRoot(); setOpenBoard(null); setOpenColDoc(null) }}
              style={{background:'none',border:'none',cursor:'pointer',
                color:'rgba(255,255,255,0.70)',fontSize:12,fontWeight:500,
                padding:'4px 8px',borderRadius:6,lineHeight:1,display:'flex',alignItems:'center'}}
              onMouseEnter={e=>{e.currentTarget.style.color='white';e.currentTarget.style.backgroundColor='rgba(255,255,255,0.10)'}}
              onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.70)';e.currentTarget.style.backgroundColor='transparent'}}>
              {tab==='shared'?'Salle des profs':'Mon casier'}
            </button>
            {folderPath.map((f,i)=>(
              <span key={f.id} style={{display:'flex',alignItems:'center',gap:0}}>
                <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} style={{flexShrink:0,display:'block'}}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                {i < folderPath.length-1 ? (
                  <button onClick={()=>navigateToIndex(i)}
                    style={{background:'none',border:'none',cursor:'pointer',
                      color:'rgba(255,255,255,0.70)',fontSize:12,fontWeight:500,
                      padding:'4px 6px',borderRadius:6,lineHeight:1,display:'flex',alignItems:'center'}}
                    onMouseEnter={e=>{e.currentTarget.style.color='white';e.currentTarget.style.backgroundColor='rgba(255,255,255,0.10)'}}
                    onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.70)';e.currentTarget.style.backgroundColor='transparent'}}>
                    {f.emoji} {f.name}
                  </button>
                ) : null}
              </span>
            ))}
            <div style={{width:1,height:16,backgroundColor:'rgba(255,255,255,0.20)',margin:'0 6px'}}/>
          </div>
        ) : undefined}
        tabs={(!currentFolder && !openBoard && !openListe) ? tabs : undefined}
        activeTab={tab}
        onTabChange={(!currentFolder && !openBoard && !openListe) ? setTab : undefined}
        actions={
          <div style={{display:'flex',gap:8}}>
            {currentFolder && !openBoard && !openColDoc && !openListe && (
              <button onClick={()=>setAddItemModal(true)}
                style={{padding:'7px 14px',borderRadius:8,border:'1.5px solid rgba(255,255,255,0.4)',
                  backgroundColor:'transparent',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
                + Élément
              </button>
            )}
            {!currentFolder && !openBoard && !openColDoc && !openListe && (
              <button onClick={()=>setFolderModal(true)}
                style={{padding:'7px 16px',borderRadius:8,border:'none',
                  backgroundColor:'#fff',color:'#2D1B2E',cursor:'pointer',fontSize:13,fontWeight:700}}>
                + Dossier
              </button>
            )}
            {openBoard && (
              <button onClick={()=>setTriggerAddList(true)}
                style={{padding:'7px 16px',borderRadius:8,border:'none',
                  backgroundColor:'#fff',color:'#2D1B2E',cursor:'pointer',fontSize:13,fontWeight:700}}>
                + Liste
              </button>
            )}
          </div>
        }
      />

      {/* ── Vue doc collaboratif ouvert ── */}
      {openColDoc && (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <button
              onClick={() => setOpenColDoc(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{openColDoc.name}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CollabEditor
              key={openColDoc.id}
              supabase={supabaseClient}
              document={openColDoc}
              user={user}
              dark={false}
            />
          </div>
        </div>
      )}


      {/* ── Vue liste élèves ouverte ── */}
      {openListe && (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <button
              onClick={() => setOpenListe(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{openListe.name}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ListeEditor
              key={openListe.id}
              liste={openListe}
              canEdit={isAdmin || openListe.created_by === user.id}
              onTitleChange={(updated) => setOpenListe(updated)}
            />
          </div>
        </div>
      )}

      <div className={(openColDoc || openListe) ? 'hidden' : 'p-6'}>
        {/* ── Vue tableau Trello ouvert ── */}
        {openBoard && (
          <TrelloBoardView board={openBoard} onBack={() => setOpenBoard(null)}
            triggerAddList={triggerAddList}
            onAddListTriggered={() => setTriggerAddList(false)} />
        )}

        {/* ── Vue racine ── */}
        {!currentFolder && !openBoard && (
          loading ? (
            <div style={{textAlign:'center',color:'#9CA3AF',padding:60}}>Chargement…</div>
          ) : allItems.length === 0 ? (
            <div style={{textAlign:'center',padding:80}}>
              <div style={{fontSize:48,marginBottom:16}}>{tab==='shared'?'🏫':'🗂️'}</div>
              <div style={{fontSize:16,fontWeight:600,color:'#374151',marginBottom:8}}>
                {tab==='shared'?'La salle des profs est vide':'Votre casier est vide'}
              </div>
              <div style={{fontSize:14,color:'#9CA3AF',marginBottom:24}}>Créez votre premier dossier.</div>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>setFolderModal(true)}
                  style={{padding:'10px 20px',borderRadius:10,border:'none',backgroundColor:'#2D1B2E',color:'#fff',cursor:'pointer',fontSize:14,fontWeight:600}}>
                  + Dossier
                </button>
              </div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter}
              onDragStart={handleRootDragStart} onDragEnd={handleRootDragEnd}>
              <SortableContext items={allItems.map(i => i._sortId)} strategy={rectSortingStrategy}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:18}}>
                  {allItems.map(item => item._itemType === 'folder' ? (
                    <SortableFolderCard key={`folder-${item.id}`} folder={item}
                      previews={folderPreviews[item.id]} stats={folderStats[item.id]}
                      onOpen={()=>navigateTo(item)} onEdit={()=>setEditFolder(item)}
                      onPin={()=>togglePin(item)} onDelete={()=>deleteFolder(item)}
                      onMove={()=>setMoveTarget({entity:item,entityType:'folder'})}
                      canEdit={canEdit(item)} />
                  ) : (
                    <TrelloBoardCard key={`board-${item.id}`} board={item}
                      onOpen={()=>setOpenBoard(item)} onEdit={()=>setEditBoard(item)}
                      onPin={()=>togglePinBoard(item)} onDelete={()=>deleteBoard(item)}
                      onMove={()=>setMoveTarget({entity:item,entityType:'board'})}
                      canEdit={canEdit(item)} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {dragActive && (() => {
                  const item = allItems.find(i => i._sortId === dragActive)
                  if (!item) return null
                  return item._itemType === 'folder' ? (
                    <div style={{borderRadius:14,backgroundColor:'#fff',
                      boxShadow:'0 12px 40px rgba(0,0,0,0.2)',opacity:0.9,overflow:'hidden',transform:'rotate(2deg)'}}>
                      <div style={{height:145,backgroundColor:item.color}}/>
                      <div style={{padding:'10px 13px 13px',fontWeight:700,fontSize:13}}>{item.name}</div>
                    </div>
                  ) : (
                    <div style={{borderRadius:14,backgroundColor:'#fff',
                      boxShadow:'0 12px 40px rgba(0,0,0,0.2)',opacity:0.9,overflow:'hidden',transform:'rotate(2deg)'}}>
                      <div style={{height:145,backgroundColor:item.color}}/>
                      <div style={{padding:'10px 13px 13px',fontWeight:700,fontSize:13}}>{item.name}</div>
                    </div>
                  )
                })()}
              </DragOverlay>
            </DndContext>
          )
        )}

        {/* ── Vue dossier ouvert ── */}
        {currentFolder && (
          contentLoading ? (
            <div style={{textAlign:'center',color:'#9CA3AF',padding:60}}>Chargement…</div>
          ) : subFolders.length===0 && items.length===0 && folderBoards.length===0 && folderDocs.length===0 && folderListes.length===0 ? (
            <div style={{textAlign:'center',padding:80}}>
              <div style={{fontSize:48,marginBottom:16}}>{currentFolder.emoji}</div>
              <div style={{fontSize:16,fontWeight:600,color:'#374151',marginBottom:8}}>Ce dossier est vide</div>
              <div style={{fontSize:14,color:'#9CA3AF',marginBottom:24}}>Ajoutez des sous-dossiers, images, liens, tableaux, documents collaboratifs ou listes d'élèves.</div>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>setFolderModal(true)}
                  style={{padding:'10px 20px',borderRadius:10,border:'1.5px solid #2D1B2E',backgroundColor:'#fff',color:'#2D1B2E',cursor:'pointer',fontSize:14,fontWeight:600}}>
                  + Dossier
                </button>
                <button onClick={()=>setAddItemModal(true)}
                  style={{padding:'10px 20px',borderRadius:10,border:'none',backgroundColor:currentFolder.color,color:'#fff',cursor:'pointer',fontSize:14,fontWeight:600}}>
                  + Élément
                </button>
              </div>
            </div>
          ) : (
            <>
              <TypeFilter subFolders={subFolders} items={items} boards={folderBoards} docs={folderDocs} listes={folderListes} value={typeFilter} onChange={setTypeFilter} />
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragStart={handleItemDragStart} onDragEnd={handleItemDragEnd}>
                <SortableContext items={filteredItems.map(i => `item-${i.id}`)} strategy={rectSortingStrategy}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
                    {filteredSubFolders.map(sf=>(
                      <FolderCard key={sf.id} folder={sf} compact
                        previews={subPreviews[sf.id]} stats={subStats[sf.id]}
                        onOpen={()=>navigateTo(sf)} onEdit={()=>setEditFolder(sf)}
                        onPin={()=>togglePin(sf)} onDelete={()=>deleteFolder(sf)}
                        onMove={()=>setMoveTarget({entity:sf,entityType:'folder'})}
                        canEdit={canEdit(sf)} />
                    ))}
                    {filteredItems.map(item=>(
                      <SortableItemCard key={item.id} item={item}
                        onDelete={()=>deleteItem(item)} canDelete={canEdit(item)} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {itemsDragActive && (() => {
                    const it = items.find(i => `item-${i.id}` === itemsDragActive)
                    if (!it) return null
                    return <ItemCard item={it} onDelete={()=>{}} canDelete={false} />
                  })()}
                </DragOverlay>
              </DndContext>
              {/* Boards dans le dossier */}
              {(typeFilter==='all'||typeFilter==='kanban') && folderBoards.length>0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginTop:14}}>
                  {folderBoards.map(board=>(
                    <TrelloBoardCard key={board.id} board={board}
                      onOpen={()=>setOpenBoard(board)} onEdit={()=>setEditBoard(board)}
                      onPin={()=>togglePinBoard(board)} onDelete={()=>deleteBoard(board)}
                      onMove={()=>setMoveTarget({entity:board,entityType:'board'})}
                      canEdit={canEdit(board)} />
                  ))}
                </div>
              )}
              {/* Listes d'élèves dans le dossier */}
              {(typeFilter==='all'||typeFilter==='liste') && folderListes.length>0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginTop:14}}>
                  {folderListes.map(liste=>(
                    <ListeCard key={liste.id} liste={liste}
                      onOpen={()=>setOpenListe(liste)}
                      onRename={()=>renameListe(liste)}
                      onMove={()=>setMoveTarget({entity:liste,entityType:'liste'})}
                      onDelete={()=>deleteListe(liste)}
                      canEdit={canEdit(liste)} />
                  ))}
                </div>
              )}
              {/* Docs collaboratifs dans le dossier */}
              {(typeFilter==='all'||typeFilter==='collab') && folderDocs.length>0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginTop:14}}>
                  {folderDocs.map(doc=>(
                    <DocCard key={doc.id} doc={doc}
                      onOpen={()=>setOpenColDoc(doc)}
                      onRename={()=>renameDoc(doc)}
                      onMove={()=>setMoveTarget({entity:doc,entityType:'doc'})}
                      onDelete={()=>deleteDoc(doc)}
                      canEdit={canEdit(doc)} />
                  ))}
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Modals */}
      {folderModal && <FolderModal onClose={()=>setFolderModal(false)} onSave={createFolder} />}
      {editFolder  && <FolderModal initial={editFolder} onClose={()=>setEditFolder(null)} onSave={updateFolder} />}
      {boardModal  && <BoardModal onClose={()=>setBoardModal(false)} onSave={createBoard} />}
      {editBoard   && <BoardModal initial={editBoard} onClose={()=>setEditBoard(null)} onSave={updateBoard} />}
      {addItemModal && currentFolder && (
        <AddItemModal
          folder={currentFolder}
          tab={tab}
          onClose={()=>setAddItemModal(false)}
          onAdded={()=>{ setAddItemModal(false); loadFolderContent(currentFolder); loadFolders() }}
          onCreateBoard={()=>setBoardModal(true)}
          onCreateDoc={()=>createColDoc()}
          onCreateListe={()=>{ setAddItemModal(false); setListeModal(true) }}
        />
      )}
      {listeModal && currentFolder && (
        <ListeModal
          folder={currentFolder}
          tab={tab}
          onClose={()=>setListeModal(false)}
          onCreate={(name,eleveIds)=>{ setListeModal(false); createListe(name,eleveIds) }}
        />
      )}
      {moveTarget && (
        <MoveToModal
          entity={moveTarget.entity}
          folders={allFoldersList}
          currentFolderId={moveTarget.entity.folder_id ?? moveTarget.entity.parent_id ?? null}
          onClose={()=>setMoveTarget(null)}
          onMove={moveEntity}
        />
      )}
    </>
  )
}
