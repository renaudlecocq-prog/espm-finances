import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('fr-BE', { day:'2-digit', month:'short', year:'numeric' })
    + ' à ' + d.toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit' })
}
const ACTION_LABEL = {
  created:          (d, name) => `${name} a créé cette carte`,
  updated:          (d, name) => `${name} a modifié ${d?.field==='title'?'le titre':'la description'}`,
  moved:            (d, name) => `${name} a déplacé de "${d?.from_list}" → "${d?.to_list}"`,
  completed:        (d, name) => `${name} a marqué comme terminée`,
  reopened:         (d, name) => `${name} a réouvert`,
  item_checked:     (d, name) => `${name} a coché "${d?.item_title}"`,
  item_unchecked:   (d, name) => `${name} a décoché "${d?.item_title}"`,
}

// ── SortableCard (carte kanban) ───────────────────────────────────────────────
function SortableCard({ card, profiles, onOpen, onToggle, canEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const creator = profiles[card.created_by]
  const total = card._checklistTotal || 0
  const done  = card._checklistDone  || 0
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        style={{
          backgroundColor: '#fff', borderRadius: 10, padding: '10px 12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.09)', border: '1px solid #F3F4F6',
          cursor: 'grab', userSelect: 'none', marginBottom: 8,
          opacity: card.completed ? 0.6 : 1,
          borderLeft: card.completed ? '3px solid #10B981' : '3px solid transparent',
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.09)' }}
        {...listeners}
      >
        {/* Titre + checkbox */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggle(card) }}
            style={{
              flexShrink: 0, marginTop: 1, width: 16, height: 16, borderRadius: 4,
              border: `2px solid ${card.completed ? '#10B981' : '#D1D5DB'}`,
              backgroundColor: card.completed ? '#10B981' : '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {card.completed && <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>✓</span>}
          </button>
          <div
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onOpen(card) }}
            style={{ flex: 1, cursor: 'pointer' }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.4,
              textDecoration: card.completed ? 'line-through' : 'none',
            }}>{card.title}</div>
            {card.description && (
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {card.description}
              </div>
            )}
          </div>
        </div>
        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>
            {creator && <span title={`Créé par ${creator.first_name} ${creator.last_name}`}>
              {creator.first_name?.[0]}{creator.last_name?.[0]}
            </span>}
          </div>
          {total > 0 && (
            <div style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 999,
              backgroundColor: done === total ? '#D1FAE5' : '#F3F4F6',
              color: done === total ? '#059669' : '#6B7280',
            }}>
              ✓ {done}/{total}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────
function KanbanColumn({ list, cards, profiles, onAddCard, onOpen, onToggle, onRenameList, onDeleteList, canEdit, boardColor }) {
  const [addingCard, setAddingCard] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [listName, setListName] = useState(list.name)
  const menuRef = useRef(null)
  const addRef = useRef(null)

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  useEffect(() => { if (addingCard) addRef.current?.focus() }, [addingCard])

  const handleAdd = async () => {
    if (!newTitle.trim()) { setAddingCard(false); return }
    await onAddCard(list.id, newTitle.trim())
    setNewTitle(''); setAddingCard(false)
  }

  const completed = cards.filter(c => c.completed).length

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: list.id })

  return (
    <div style={{
      flexShrink: 0, width: 280, backgroundColor: '#F8FAFC', borderRadius: 14,
      padding: '12px 10px', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)',
    }}>
      {/* Header colonne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
        {editing ? (
          <input value={listName} onChange={e => setListName(e.target.value)} autoFocus
            onBlur={() => { onRenameList(list.id, listName); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onRenameList(list.id, listName); setEditing(false) } }}
            style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: '3px 6px', borderRadius: 6,
              border: `1.5px solid ${boardColor}`, outline: 'none', backgroundColor: '#fff' }} />
        ) : (
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1F2937', cursor: canEdit ? 'pointer' : 'default' }}
            onClick={() => canEdit && setEditing(true)}>
            {list.name}
          </span>
        )}
        {completed > 0 && (
          <span style={{ fontSize: 10, color: '#6B7280', backgroundColor: '#E5E7EB',
            borderRadius: 999, padding: '1px 6px' }}>{completed}/{cards.length}</span>
        )}
        {cards.length > 0 && completed === 0 && (
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{cards.length}</span>
        )}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(m => !m)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
              fontSize: 16, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}>⋯</button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 24, backgroundColor: '#fff',
              borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              minWidth: 160, zIndex: 100, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
              {[
                { label: '✏️ Renommer', action: () => { setEditing(true); setMenuOpen(false) } },
                { label: '🗑️ Supprimer la liste', action: () => { onDeleteList(list.id, list.name); setMenuOpen(false) }, danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                    border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                    color: item.danger ? '#DC2626' : '#374151' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = item.danger ? '#FEF2F2' : '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div ref={setDropRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 2,
        minHeight: 40, borderRadius: 8,
        transition: 'background 0.15s',
        backgroundColor: isOver && cards.length === 0 ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <SortableCard key={card.id} card={card} profiles={profiles}
              onOpen={onOpen} onToggle={onToggle} canEdit={canEdit} />
          ))}
        </SortableContext>
      </div>

      {/* Ajouter carte */}
      {addingCard ? (
        <div style={{ marginTop: 6 }}>
          <textarea ref={addRef} value={newTitle} onChange={e => setNewTitle(e.target.value)} rows={2}
            placeholder="Titre de la carte…" autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } if (e.key === 'Escape') { setAddingCard(false); setNewTitle('') } }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${boardColor}`,
              fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={handleAdd}
              style={{ padding: '6px 12px', borderRadius: 7, border: 'none', backgroundColor: boardColor,
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ajouter</button>
            <button onClick={() => { setAddingCard(false); setNewTitle('') }}
              style={{ padding: '6px 10px', borderRadius: 7, border: 'none', backgroundColor: '#F3F4F6',
                color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCard(true)}
          style={{ marginTop: 6, width: '100%', padding: '7px 10px', borderRadius: 8,
            border: '1.5px dashed #D1D5DB', backgroundColor: 'transparent',
            color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = boardColor; e.currentTarget.style.color = boardColor }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF' }}>
          + Ajouter une carte
        </button>
      )}
    </div>
  )
}

// ── CardDetailModal ───────────────────────────────────────────────────────────
function CardDetailModal({ card, lists, profiles, boardColor, boardType, onClose, onSave, onDelete, onAddItem, onToggleItem, onDeleteItem }) {
  const { user } = useAuth()
  const [title, setTitle]       = useState(card.title)
  const [desc,  setDesc]        = useState(card.description || '')
  const [newItem, setNewItem]   = useState('')
  const [activity, setActivity] = useState([])
  const [dirty, setDirty]       = useState(false)
  // ── Autosave (espace partagé uniquement) ────────────────────────────────────
  const isShared      = boardType !== 'personal'
  const saveTimerRef  = useRef(null)
  const [saving,   setSaving]  = useState(false)
  const [savedAt,  setSavedAt] = useState(null)

  const currentList = lists.find(l => l.id === card.list_id)

  useEffect(() => {
    supabase.from('trello_activity').select('*').eq('card_id', card.id)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setActivity(data || []))
  }, [card.id])

  // Déclenche un save avec debounce (1s) ou immédiat
  const scheduleAutoSave = (newTitle, newDesc, immediate = false) => {
    if (!isShared) return          // casier → save manuel uniquement
    if (!newTitle.trim()) return
    clearTimeout(saveTimerRef.current)
    const doSave = async () => {
      setSaving(true)
      await onSave(card.id, { title: newTitle.trim(), description: newDesc })
      setSaving(false)
      setSavedAt(new Date())
      setDirty(false)
    }
    if (immediate) doSave()
    else saveTimerRef.current = setTimeout(doSave, 1000)
  }

  // Nettoyage timer au démontage
  useEffect(() => () => clearTimeout(saveTimerRef.current), [])

  // Save manuel (espace perso ou fallback)
  const handleSave = () => {
    if (!title.trim()) return
    if (isShared) { scheduleAutoSave(title, desc, true) }
    else { onSave(card.id, { title: title.trim(), description: desc }); setDirty(false) }
  }

  const handleAddItem = async () => {
    if (!newItem.trim()) return
    await onAddItem(card.id, newItem.trim())  // parent met à jour openCard
    setNewItem('')
  }

  const handleToggleItem = async (item) => {
    await onToggleItem(item)  // parent met à jour openCard
  }

  const handleDeleteItem = async (item) => {
    await onDeleteItem(item.id, item.card_id)  // parent met à jour openCard
  }

  const checkItems = card._checklistItems || []
  const donePct = checkItems.length > 0 ? Math.round(checkItems.filter(i => i.checked).length / checkItems.length * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, padding: '40px 16px', overflowY: 'auto' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 620,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', marginBottom: 40 }}>

        {/* Bandeau couleur */}
        <div style={{ height: 8, backgroundColor: boardColor }} />

        <div style={{ padding: '20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <textarea value={title} onChange={e => { setTitle(e.target.value); setDirty(true); scheduleAutoSave(e.target.value, desc) }} rows={2}
              onBlur={() => dirty && scheduleAutoSave(title, desc, true)}
              style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#111', border: 'none',
                outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                padding: '4px 0', borderBottom: dirty ? `2px solid ${boardColor}` : '2px solid transparent' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              {isShared && saving && <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap' }}>Enregistrement…</span>}
              {isShared && !saving && savedAt && <span style={{ fontSize: 10, color: '#10B981', whiteSpace: 'nowrap' }}>✓ {savedAt.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                  fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Dans la liste */}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>
            Dans <span style={{ color: '#374151', fontWeight: 600 }}>{currentList?.name}</span>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>📝 Description</div>
            <textarea value={desc} onChange={e => { setDesc(e.target.value); setDirty(true); scheduleAutoSave(title, e.target.value) }} rows={3}
              placeholder="Ajouter une description…"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
                border: '1.5px solid #E5E7EB', outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: '#F9FAFB' }}
              onFocus={e => e.target.style.borderColor = boardColor}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; dirty && scheduleAutoSave(title, desc, true) }} />
          </div>

          {/* Bouton sauvegarder : uniquement pour le casier (autosave dans l'espace partagé) */}
          {dirty && !isShared && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={handleSave}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none',
                  backgroundColor: boardColor, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Enregistrer
              </button>
              <button onClick={() => { setTitle(card.title); setDesc(card.description || ''); setDirty(false) }}
                style={{ marginLeft: 8, padding: '7px 12px', borderRadius: 8, border: 'none',
                  backgroundColor: '#F3F4F6', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          )}

          {/* Checklist */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: checkItems.length > 0 ? 8 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>☑️ Checklist</div>
              {checkItems.length > 0 && (
                <span style={{ fontSize: 11, color: donePct === 100 ? '#059669' : '#6B7280',
                  fontWeight: 600 }}>{donePct}%</span>
              )}
            </div>
            {checkItems.length > 0 && (
              <div style={{ height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${donePct}%`, backgroundColor: donePct === 100 ? '#10B981' : boardColor, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
            {checkItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                borderBottom: '1px solid #F9FAFB' }}>
                <button onClick={() => handleToggleItem(item)}
                  style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4,
                    border: `2px solid ${item.checked ? '#10B981' : '#D1D5DB'}`,
                    backgroundColor: item.checked ? '#10B981' : '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.checked && <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>✓</span>}
                </button>
                <span style={{ flex: 1, fontSize: 13, color: '#374151',
                  textDecoration: item.checked ? 'line-through' : 'none',
                  opacity: item.checked ? 0.6 : 1 }}>{item.title}</span>
                {item.checked && item.checked_by && profiles[item.checked_by] && (
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                    {profiles[item.checked_by].first_name?.[0]}{profiles[item.checked_by].last_name?.[0]}
                  </span>
                )}
                <button onClick={() => handleDeleteItem(item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB',
                    fontSize: 14, padding: '0 2px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input value={newItem} onChange={e => setNewItem(e.target.value)}
                placeholder="Nouvel élément…" onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 7, fontSize: 13,
                  border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = boardColor}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
              <button onClick={handleAddItem}
                style={{ padding: '6px 12px', borderRadius: 7, border: 'none',
                  backgroundColor: boardColor, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+</button>
            </div>
          </div>

          {/* Activité — seulement dans les tableaux partagés */}
          {boardType !== 'personal' && activity.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>🕒 Activité</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {activity.map(evt => {
                  const p = profiles[evt.user_id]
                  const name = p ? `${p.first_name} ${p.last_name}` : 'Quelqu\'un'
                  const label = ACTION_LABEL[evt.action]?.(evt.detail, name) || `${name} a effectué une action`
                  return (
                    <div key={evt.id} style={{ display: 'flex', gap: 8, padding: '6px 0',
                      borderBottom: '1px solid #F9FAFB' }}>
                      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                        backgroundColor: boardColor + '25', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 11, fontWeight: 700, color: boardColor }}>
                        {p?.first_name?.[0]}{p?.last_name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#374151' }}>{label}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtDate(evt.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>
              Créé par {profiles[card.created_by]
                ? `${profiles[card.created_by].first_name} ${profiles[card.created_by].last_name}`
                : '—'} · {fmtDate(card.created_at)}
            </div>
            <button onClick={() => onDelete(card)}
              style={{ fontSize: 12, color: '#D1D5DB', background: 'none', border: 'none',
                cursor: 'pointer', fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}>
              🗑️ Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TrelloBoardView ───────────────────────────────────────────────────────────
export default function TrelloBoardView({ board, onBack, triggerAddList, onAddListTriggered }) {
  const { user, isAdmin } = useAuth()
  const [lists,    setLists]    = useState([])
  const [cards,    setCards]    = useState({})  // { listId: [card, ...] }
  const [profiles, setProfiles] = useState({})  // { userId: profile }
  const [loading,  setLoading]  = useState(true)
  const [activeCard, setActiveCard] = useState(null)
  const [openCard,  setOpenCard]  = useState(null)
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Déclenché depuis le header parent
  useEffect(() => {
    if (triggerAddList) {
      setAddingList(true)
      onAddListTriggered?.()
    }
  }, [triggerAddList])

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: lstData }, { data: cardData }] = await Promise.all([
        supabase.from('trello_lists').select('*').eq('board_id', board.id).order('position'),
        supabase.from('trello_cards').select('*').eq('board_id', board.id).order('position'),
      ])
      const listArr = lstData || []
      setLists(listArr)

      // Load checklist items for all cards
      const cardArr = cardData || []
      let allItems = []
      if (cardArr.length > 0) {
        const { data: itemData } = await supabase.from('trello_checklist_items')
          .select('*').in('card_id', cardArr.map(c => c.id)).order('position')
        allItems = itemData || []
      }

      // Attach checklist stats to cards
      const cardMap = {}
      listArr.forEach(l => { cardMap[l.id] = [] })
      cardArr.forEach(card => {
        const items = allItems.filter(i => i.card_id === card.id)
        card._checklistItems = items
        card._checklistTotal = allItems.filter(i => i.card_id === card.id).length
        card._checklistDone  = allItems.filter(i => i.card_id === card.id && i.checked).length
        if (cardMap[card.list_id]) cardMap[card.list_id].push(card)
      })
      setCards(cardMap)

      // Load profiles for all involved users (always include current user)
      const userIds = new Set([
        user.id,
        ...cardArr.map(c => c.created_by),
        ...cardArr.filter(c => c.completed_by).map(c => c.completed_by),
        ...allItems.filter(i => i.checked_by).map(i => i.checked_by),
      ])
      if (userIds.size > 0) {
        const { data: profileData } = await supabase.from('profiles')
          .select('id,first_name,last_name').in('id', [...userIds])
        const pMap = {}
        ;(profileData || []).forEach(p => { pMap[p.id] = p })
        setProfiles(pMap)
      }
    } catch(err) {
      console.error('TrelloBoardView load:', err)
    } finally {
      setLoading(false)
    }
  }, [board.id])

  useEffect(() => { load() }, [load])

  // ── CRUD lists ──────────────────────────────────────────────────────────────
  const addList = async () => {
    if (!newListName.trim()) { setAddingList(false); return }
    const pos = lists.length
    const { data } = await supabase.from('trello_lists').insert({
      board_id: board.id, name: newListName.trim(), position: pos, created_by: user.id,
    }).select().single()
    if (data) { setLists(prev => [...prev, data]); setCards(prev => ({ ...prev, [data.id]: [] })) }
    setNewListName(''); setAddingList(false)
  }

  const renameList = async (listId, name) => {
    if (!name.trim()) return
    await supabase.from('trello_lists').update({ name: name.trim() }).eq('id', listId)
    setLists(prev => prev.map(l => l.id === listId ? { ...l, name: name.trim() } : l))
  }

  const deleteList = async (listId, listName) => {
    if (!window.confirm(`Supprimer la liste "${listName}" et toutes ses cartes ?`)) return
    await supabase.from('trello_lists').delete().eq('id', listId)
    setLists(prev => prev.filter(l => l.id !== listId))
    setCards(prev => { const n = { ...prev }; delete n[listId]; return n })
  }

  // ── CRUD cards ──────────────────────────────────────────────────────────────
  const addCard = async (listId, title) => {
    const existing = cards[listId] || []
    const { data } = await supabase.from('trello_cards').insert({
      board_id: board.id, list_id: listId, title, position: existing.length, created_by: user.id,
    }).select().single()
    if (data) {
      data._checklistItems = []; data._checklistTotal = 0; data._checklistDone = 0
      setCards(prev => ({ ...prev, [listId]: [...(prev[listId] || []), data] }))
      // Log activity
      await supabase.from('trello_activity').insert({ card_id: data.id, board_id: board.id, user_id: user.id, action: 'created' })
    }
  }

  const saveCard = async (cardId, updates) => {
    const { error } = await supabase.from('trello_cards').update({
      ...updates, updated_at: new Date().toISOString(), updated_by: user.id,
    }).eq('id', cardId)
    if (!error) {
      setCards(prev => {
        const n = { ...prev }
        Object.keys(n).forEach(lid => {
          n[lid] = n[lid].map(c => c.id === cardId ? { ...c, ...updates } : c)
        })
        return n
      })
      await supabase.from('trello_activity').insert({
        card_id: cardId, board_id: board.id, user_id: user.id, action: 'updated',
        detail: { field: updates.title ? 'title' : 'description' },
      })
    }
    if (openCard?.id === cardId) setOpenCard(prev => ({ ...prev, ...updates }))
  }

  const toggleCard = async (card) => {
    const now = new Date().toISOString()
    const completed = !card.completed
    await supabase.from('trello_cards').update({
      completed, completed_by: completed ? user.id : null,
      completed_at: completed ? now : null,
    }).eq('id', card.id)
    setCards(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(lid => {
        n[lid] = n[lid].map(c => c.id === card.id
          ? { ...c, completed, completed_by: completed ? user.id : null, completed_at: completed ? now : null }
          : c)
      })
      return n
    })
    await supabase.from('trello_activity').insert({
      card_id: card.id, board_id: board.id, user_id: user.id,
      action: completed ? 'completed' : 'reopened',
    })
  }

  const deleteCard = async (card) => {
    if (!window.confirm(`Supprimer la carte "${card.title}" ?`)) return
    await supabase.from('trello_cards').delete().eq('id', card.id)
    setCards(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(lid => { n[lid] = n[lid].filter(c => c.id !== card.id) })
      return n
    })
    setOpenCard(null)
  }

  // ── CRUD checklist ──────────────────────────────────────────────────────────
  const addChecklistItem = async (cardId, title) => {
    const existingCard = Object.values(cards).flat().find(c => c.id === cardId)
    const pos = (existingCard?._checklistItems?.length || 0)
    const { data } = await supabase.from('trello_checklist_items').insert({
      card_id: cardId, title, position: pos, created_by: user.id,
    }).select().single()
    // Construire l'item localement si Supabase ne le retourne pas (RLS SELECT)
    const newItem = data || {
      id: `local-${Date.now()}`, card_id: cardId, title, position: pos,
      created_by: user.id, checked: false, checked_by: null, checked_at: null,
      created_at: new Date().toISOString(),
    }
    // Mettre à jour cards (stats) et openCard (affichage modal)
    setCards(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(lid => {
        n[lid] = n[lid].map(c => {
          if (c.id !== cardId) return c
          const its = [...(c._checklistItems || []), newItem]
          return { ...c, _checklistItems: its, _checklistTotal: its.length }
        })
      })
      return n
    })
    setOpenCard(prev => {
      if (!prev || prev.id !== cardId) return prev
      const its = [...(prev._checklistItems || []), newItem]
      return { ...prev, _checklistItems: its, _checklistTotal: its.length }
    })
    return newItem
  }

  const toggleChecklistItem = async (item) => {
    const checked = !item.checked
    const now = new Date().toISOString()
    await supabase.from('trello_checklist_items').update({
      checked, checked_by: checked ? user.id : null, checked_at: checked ? now : null,
    }).eq('id', item.id)
    const updated = { ...item, checked, checked_by: checked ? user.id : null, checked_at: checked ? now : null }
    // Update checklist stats on card
    setCards(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(lid => {
        n[lid] = n[lid].map(c => {
          if (c.id !== item.card_id) return c
          const newItems = c._checklistItems.map(i => i.id === item.id ? updated : i)
          return { ...c, _checklistItems: newItems, _checklistDone: newItems.filter(i => i.checked).length }
        })
      })
      return n
    })
    // Mettre à jour openCard aussi
    setOpenCard(prev => {
      if (!prev || prev.id !== item.card_id) return prev
      const newItems = (prev._checklistItems || []).map(i => i.id === item.id ? updated : i)
      return { ...prev, _checklistItems: newItems, _checklistDone: newItems.filter(i => i.checked).length }
    })
    // Log
    const foundCard = Object.values(cards).flat().find(c => c.id === item.card_id)
    if (foundCard) await supabase.from('trello_activity').insert({
      card_id: item.card_id, board_id: board.id, user_id: user.id,
      action: checked ? 'item_checked' : 'item_unchecked',
      detail: { item_title: item.title },
    })
    return updated
  }

  const deleteChecklistItem = async (itemId, cardId) => {
    await supabase.from('trello_checklist_items').delete().eq('id', itemId)
    setCards(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(lid => {
        n[lid] = n[lid].map(c => {
          if (c.id !== cardId) return c
          const its = (c._checklistItems || []).filter(i => i.id !== itemId)
          return { ...c, _checklistItems: its, _checklistTotal: its.length, _checklistDone: its.filter(i=>i.checked).length }
        })
      })
      return n
    })
    setOpenCard(prev => {
      if (!prev || prev.id !== cardId) return prev
      const its = (prev._checklistItems || []).filter(i => i.id !== itemId)
      return { ...prev, _checklistItems: its, _checklistTotal: its.length, _checklistDone: its.filter(i=>i.checked).length }
    })
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => {
    const card = Object.values(cards).flat().find(c => c.id === active.id)
    setActiveCard(card || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveCard(null)
    if (!over || active.id === over.id) return

    // Find source list
    let srcListId = null
    let dstListId = null
    Object.entries(cards).forEach(([lid, cardsInList]) => {
      if (cardsInList.some(c => c.id === active.id)) srcListId = lid
    })

    // over.id could be a card id OR a list id
    if (cards[over.id] !== undefined) {
      dstListId = over.id
    } else {
      Object.entries(cards).forEach(([lid, cardsInList]) => {
        if (cardsInList.some(c => c.id === over.id)) dstListId = lid
      })
    }

    if (!srcListId || !dstListId) return

    if (srcListId === dstListId) {
      // Reorder within same list
      const listCards = [...cards[srcListId]]
      const oldIdx = listCards.findIndex(c => c.id === active.id)
      const newIdx = listCards.findIndex(c => c.id === over.id)
      if (oldIdx === newIdx) return
      const reordered = arrayMove(listCards, oldIdx, newIdx)
      setCards(prev => ({ ...prev, [srcListId]: reordered }))
      // Persist new positions
      await Promise.all(reordered.map((c, i) =>
        supabase.from('trello_cards').update({ position: i }).eq('id', c.id)
      ))
    } else {
      // Move to different list
      const srcCards = cards[srcListId].filter(c => c.id !== active.id)
      const movedCard = cards[srcListId].find(c => c.id === active.id)
      if (!movedCard) return

      const overIdx = cards[dstListId].findIndex(c => c.id === over.id)
      const dstCards = [...cards[dstListId]]
      const insertAt = overIdx === -1 ? dstCards.length : overIdx
      dstCards.splice(insertAt, 0, { ...movedCard, list_id: dstListId })

      setCards(prev => ({ ...prev, [srcListId]: srcCards, [dstListId]: dstCards }))

      // Persist
      await supabase.from('trello_cards').update({ list_id: dstListId, position: insertAt }).eq('id', active.id)
      await Promise.all(srcCards.map((c, i) => supabase.from('trello_cards').update({ position: i }).eq('id', c.id)))
      await Promise.all(dstCards.map((c, i) => supabase.from('trello_cards').update({ position: i }).eq('id', c.id)))

      // Log move
      const srcList = lists.find(l => l.id === srcListId)
      const dstList = lists.find(l => l.id === dstListId)
      await supabase.from('trello_activity').insert({
        card_id: active.id, board_id: board.id, user_id: user.id, action: 'moved',
        detail: { from_list: srcList?.name, to_list: dstList?.name },
      })
    }
  }

  const canEdit = (obj) => isAdmin || (obj && obj.created_by === user.id)

  if (loading) return (
    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 60 }}>Chargement du tableau…</div>
  )

  return (
    <div style={{ height: '100%' }}>
      {/* Board body */}
      <div style={{
        display: 'flex', gap: 14, overflowX: 'auto', padding: '20px 24px',
        alignItems: 'flex-start', minHeight: 'calc(100vh - 140px)',
        background: `linear-gradient(135deg, ${board.color}15 0%, transparent 60%)`,
      }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {lists.map(list => (
            <KanbanColumn key={list.id} list={list} cards={cards[list.id] || []}
              profiles={profiles} boardColor={board.color}
              onAddCard={addCard} onOpen={c => setOpenCard(c)}
              onToggle={toggleCard} onRenameList={renameList}
              onDeleteList={deleteList} canEdit={true} />
          ))}
          <DragOverlay>
            {activeCard && (
              <div style={{ backgroundColor: '#fff', borderRadius: 10, padding: '10px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid #E5E7EB',
                width: 264, opacity: 0.95, transform: 'rotate(2deg)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{activeCard.title}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Ajouter liste — formulaire inline (déclenché depuis le header) */}
        {addingList && (
          <div style={{ flexShrink: 0, width: 280 }}>
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 }}>
              <input value={newListName} onChange={e => setNewListName(e.target.value)} autoFocus
                placeholder="Nom de la liste…"
                onKeyDown={e => { if (e.key === 'Enter') addList(); if (e.key === 'Escape') { setAddingList(false); setNewListName('') } }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
                  border: `1.5px solid ${board.color}`, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addList}
                  style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none',
                    backgroundColor: board.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Ajouter
                </button>
                <button onClick={() => { setAddingList(false); setNewListName('') }}
                  style={{ padding: '7px 10px', borderRadius: 8, border: 'none',
                    backgroundColor: '#E5E7EB', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card detail modal */}
      {openCard && (
        <CardDetailModal
          card={openCard}
          lists={lists}
          profiles={profiles}
          boardColor={board.color}
          boardType={board.type}
          onClose={() => setOpenCard(null)}
          onSave={saveCard}
          onDelete={deleteCard}
          onAddItem={addChecklistItem}
          onToggleItem={toggleChecklistItem}
          onDeleteItem={deleteChecklistItem}
        />
      )}
    </div>
  )
}
