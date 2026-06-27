import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CollabEditor } from './CollabEditor'
import { useTheme } from '../contexts/ThemeContext'

function DocIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export function SalleDocuments() {
  const { user } = useAuth()
  const { dark } = useTheme()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [openDoc, setOpenDoc] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [renameName, setRenameName] = useState('')

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('salle_documents')
      .select('id, name, created_by, created_at, updated_at')
      .order('updated_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  async function createDoc() {
    setCreating(true)
    const { data, error } = await supabase
      .from('salle_documents')
      .insert({ name: 'Sans titre', created_by: user.id })
      .select()
      .single()
    setCreating(false)
    if (!error && data) {
      setDocs(prev => [data, ...prev])
      setOpenDoc(data)
    }
  }

  async function deleteDoc(doc) {
    await supabase.from('salle_documents').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    if (openDoc?.id === doc.id) setOpenDoc(null)
    setDeleteTarget(null)
  }

  async function renameDoc() {
    if (!renameName.trim()) return
    await supabase
      .from('salle_documents')
      .update({ name: renameName.trim() })
      .eq('id', renaming.id)
    setDocs(prev => prev.map(d => d.id === renaming.id ? { ...d, name: renameName.trim() } : d))
    if (openDoc?.id === renaming.id) setOpenDoc(prev => ({ ...prev, name: renameName.trim() }))
    setRenaming(null)
    setRenameName('')
  }

  function formatDate(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Vue éditeur
  if (openDoc) {
    return (
      <div className="flex flex-col h-full">
        {/* Header éditeur */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <button
            onClick={() => setOpenDoc(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Documents
          </button>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          {renaming?.id === openDoc.id ? (
            <form onSubmit={(e) => { e.preventDefault(); renameDoc() }} className="flex items-center gap-2">
              <input
                autoFocus
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                onBlur={renameDoc}
                className="text-sm font-medium bg-white dark:bg-gray-700 border border-blue-400 rounded px-2 py-0.5 focus:outline-none text-gray-900 dark:text-gray-100"
              />
            </form>
          ) : (
            <button
              onClick={() => { setRenaming(openDoc); setRenameName(openDoc.name) }}
              className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              {openDoc.name}
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* Éditeur collaboratif */}
        <div className="flex-1 overflow-hidden">
          <CollabEditor
            key={openDoc.id}
            supabase={supabase}
            document={openDoc}
            user={user}
            dark={dark}
          />
        </div>
      </div>
    )
  }

  // Vue liste
  return (
    <div className="flex flex-col h-full">
      {/* Header liste */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documents collaboratifs</h2>
        <button
          onClick={createDoc}
          disabled={creating}
          className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau document
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
            <DocIcon />
            <p className="mt-3 text-sm">Aucun document — créez-en un !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {docs.map(doc => (
              <div
                key={doc.id}
                onClick={() => setOpenDoc(doc)}
                className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5">
                    <DocIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">{doc.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Modifié le {formatDate(doc.updated_at)}
                    </p>
                  </div>
                </div>

                {/* Actions (visible au hover) */}
                <div
                  className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setRenaming(doc); setRenameName(doc.name) }}
                    title="Renommer"
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {doc.created_by === user?.id && (
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      title="Supprimer"
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Modal renommage inline */}
                {renaming?.id === doc.id && (
                  <div
                    className="absolute inset-0 bg-white dark:bg-gray-800 rounded-xl p-4 flex flex-col gap-2 z-10 border border-blue-400"
                    onClick={e => e.stopPropagation()}
                  >
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Renommer</label>
                    <input
                      autoFocus
                      value={renameName}
                      onChange={e => setRenameName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameDoc(); if (e.key === 'Escape') { setRenaming(null); setRenameName('') } }}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-400"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setRenaming(null); setRenameName('') }} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1">Annuler</button>
                      <button onClick={renameDoc} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors">OK</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Supprimer le document ?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              « {deleteTarget.name} » sera supprimé définitivement.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Annuler</button>
              <button onClick={() => deleteDoc(deleteTarget)} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
