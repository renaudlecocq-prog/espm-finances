import { useState, useEffect, useCallback, useRef } from 'react'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PAGE_EMOJIS = ['📄','📝','📋','📌','💡','🎯','📊','🔧','📚','🗒️',
                     '🏫','📢','🌟','🎉','🔔','📅','🎨','💼','🗂️','📦']

// ── Modal confirmation suppression ──────────────────────────────────────────
function DeleteModal({ page, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="text-2xl mb-3 text-center">{page.emoji}</div>
        <h3 className="text-base font-semibold text-center text-gray-900 dark:text-white mb-2">
          Supprimer « {page.titre} » ?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal création / édition page ───────────────────────────────────────────
function PageFormModal({ initial, onSave, onCancel }) {
  const [titre, setTitre] = useState(initial?.titre || '')
  const [emoji, setEmoji] = useState(initial?.emoji || '📄')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!titre.trim()) return
    onSave({ titre: titre.trim(), emoji })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {initial ? 'Renommer la page' : 'Nouvelle page'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Icône</label>
            <div className="flex flex-wrap gap-1.5">
              {PAGE_EMOJIS.map(e => (
                <button key={e} type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors
                    ${emoji === e ? 'bg-primary/10 ring-2 ring-primary dark:bg-accent/20 dark:ring-accent' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titre</label>
            <input
              autoFocus
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Nom de la page"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-accent"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={!titre.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-primary dark:bg-accent text-white text-sm font-medium disabled:opacity-40 transition-colors">
              {initial ? 'Renommer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Éditeur BlockNote ────────────────────────────────────────────────────────
function PageEditor({ page, onBack, onTitleChange, canEdit }) {
  const { user } = useAuth()
  const saveTimer = useRef(null)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [renamingModal, setRenamingModal] = useState(false)
  const isFirstChange = useRef(true)

  // Initialiser l'éditeur avec le contenu existant
  const editor = useCreateBlockNote({
    initialContent: (() => {
      try {
        const parsed = typeof page.content === 'string'
          ? JSON.parse(page.content)
          : page.content
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined
      } catch {
        return undefined
      }
    })(),
  })

  const save = useCallback(async (blocks) => {
    setSaveStatus('saving')
    const { error } = await supabase
      .from('salle_pages')
      .update({ content: blocks, updated_by: user.id })
      .eq('id', page.id)
    setSaveStatus(error ? 'unsaved' : 'saved')
  }, [page.id, user.id])

  // ← API correcte pour BlockNote 0.51+ : useEditorChange (hook)
  useEditorChange(editor, () => {
    if (isFirstChange.current) {
      isFirstChange.current = false
      return
    }
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(editor.document), 1500)
  })

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  // Realtime : recharger si quelqu'un d'autre a modifié
  useEffect(() => {
    const channel = supabase
      .channel(`page-${page.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'salle_pages',
        filter: `id=eq.${page.id}`,
      }, (payload) => {
        if (payload.new.updated_by === user.id) return
        try {
          const blocks = typeof payload.new.content === 'string'
            ? JSON.parse(payload.new.content) : payload.new.content
          if (Array.isArray(blocks) && blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks)
          }
        } catch {}
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [page.id, user.id, editor])

  const statusColor = saveStatus === 'saving' ? 'text-yellow-500'
    : saveStatus === 'unsaved' ? 'text-orange-500'
    : 'text-green-500 dark:text-green-400'
  const statusLabel = saveStatus === 'saving' ? 'Sauvegarde…'
    : saveStatus === 'unsaved' ? 'Non sauvegardé'
    : 'Sauvegardé ✓'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Pages
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <button onClick={() => canEdit && setRenamingModal(true)}
          className={`flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200
            ${canEdit ? 'hover:text-primary dark:hover:text-accent cursor-pointer' : 'cursor-default'} transition-colors`}>
          <span>{page.emoji}</span>
          <span>{page.titre}</span>
          {canEdit && (
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          )}
        </button>
        <span className={`ml-auto text-xs ${statusColor} transition-colors`}>{statusLabel}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <BlockNoteView editor={editor} editable={canEdit} theme="light" style={{ minHeight: '100%' }} />
      </div>

      {renamingModal && (
        <PageFormModal
          initial={{ titre: page.titre, emoji: page.emoji }}
          onSave={async ({ titre, emoji }) => {
            await supabase.from('salle_pages').update({ titre, emoji }).eq('id', page.id)
            onTitleChange({ ...page, titre, emoji })
            setRenamingModal(false)
          }}
          onCancel={() => setRenamingModal(false)}
        />
      )}
    </div>
  )
}

// ── Carte page (liste) ───────────────────────────────────────────────────────
function PageCard({ page, onOpen, onEdit, onDelete, onPin, canEdit }) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }
    if (menu) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const date = new Date(page.updated_at).toLocaleDateString('fr-BE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div onClick={() => onOpen(page)}
      className={`group relative bg-white dark:bg-gray-800 rounded-xl border cursor-pointer transition-all
        ${page.pinned
          ? 'border-primary/40 dark:border-accent/40 shadow-md shadow-primary/10'
          : 'border-gray-100 dark:border-gray-700 hover:border-primary/30 dark:hover:border-accent/30 hover:shadow-md'}`}>
      <div className="h-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-700/60 rounded-t-xl flex items-center justify-center text-4xl select-none">
        {page.emoji}
      </div>
      <div className="p-3">
        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{page.titre}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Modifié le {date}</p>
      </div>
      {page.pinned && (
        <div className="absolute top-2 left-2 bg-primary dark:bg-accent text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
          Épinglé
        </div>
      )}
      {canEdit && (
        <div ref={menuRef} className="absolute top-2 right-2">
          <button onClick={e => { e.stopPropagation(); setMenu(m => !m) }}
            className="w-7 h-7 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          </button>
          {menu && (
            <div className="absolute right-0 top-8 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20"
              onClick={e => e.stopPropagation()}>
              <button onClick={e => { e.stopPropagation(); onOpen(page); setMenu(false) }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <span>📖</span> Ouvrir
              </button>
              <button onClick={e => { e.stopPropagation(); onEdit(page); setMenu(false) }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <span>✏️</span> Renommer
              </button>
              <button onClick={e => { e.stopPropagation(); onPin(page); setMenu(false) }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <span>{page.pinned ? '📌' : '📍'}</span> {page.pinned ? 'Désépingler' : 'Épingler'}
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <button onClick={e => { e.stopPropagation(); onDelete(page); setMenu(false) }}
                className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                <span>🗑️</span> Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Composant principal SallePages ───────────────────────────────────────────
export default function SallePages({ pageType = 'shared' }) {
  const { user, can } = useAuth()
  const canEdit = can('salle_profs') || pageType === 'personal'

  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPage, setOpenPage] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)

  const loadPages = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('salle_pages')
      .select('*')
      .eq('type', pageType)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    if (pageType === 'personal') q = q.eq('created_by', user.id)
    const { data } = await q
    setPages(data || [])
    setLoading(false)
  }, [pageType, user.id])

  useEffect(() => { loadPages() }, [loadPages])

  useEffect(() => {
    const channel = supabase
      .channel(`salle-pages-list-${pageType}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'salle_pages',
        filter: `type=eq.${pageType}`,
      }, () => loadPages())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [pageType, loadPages])

  const createPage = async ({ titre, emoji }) => {
    const { data } = await supabase
      .from('salle_pages')
      .insert({ titre, emoji, type: pageType, created_by: user.id, content: [] })
      .select().single()
    setCreateModal(false)
    if (data) setOpenPage(data)
  }

  const renamePage = async ({ titre, emoji }) => {
    await supabase.from('salle_pages').update({ titre, emoji }).eq('id', editModal.id)
    setEditModal(null)
  }

  const deletePage = async () => {
    await supabase.from('salle_pages').delete().eq('id', deleteModal.id)
    if (openPage?.id === deleteModal.id) setOpenPage(null)
    setDeleteModal(null)
  }

  const pinPage = async (page) => {
    await supabase.from('salle_pages').update({ pinned: !page.pinned }).eq('id', page.id)
  }

  if (openPage) {
    return (
      <PageEditor
        page={openPage}
        canEdit={canEdit}
        onBack={() => setOpenPage(null)}
        onTitleChange={(updated) => {
          setOpenPage(updated)
          setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
        }}
      />
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {pageType === 'shared' ? '📄 Pages partagées' : '📄 Mes pages'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-accent text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Nouvelle page
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement…
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Aucune page pour l'instant</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Créez votre première page collaborative.</p>
          {canEdit && (
            <button onClick={() => setCreateModal(true)}
              className="px-4 py-2 bg-primary dark:bg-accent text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
              + Nouvelle page
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {pages.map(page => (
            <PageCard key={page.id} page={page} canEdit={canEdit}
              onOpen={setOpenPage} onEdit={setEditModal} onPin={pinPage} onDelete={setDeleteModal} />
          ))}
        </div>
      )}

      {createModal && <PageFormModal onSave={createPage} onCancel={() => setCreateModal(false)} />}
      {editModal && <PageFormModal initial={editModal} onSave={renamePage} onCancel={() => setEditModal(null)} />}
      {deleteModal && <DeleteModal page={deleteModal} onConfirm={deletePage} onCancel={() => setDeleteModal(null)} />}
    </div>
  )
}
