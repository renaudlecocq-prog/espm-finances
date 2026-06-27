/**
 * SupabaseYjsProvider
 * Synchronise un document Yjs entre tous les clients via Supabase Realtime broadcast.
 * Sauvegarde l'état complet en base avec un debounce de 2s.
 *
 * Options :
 *   tableName   — table Supabase cible (défaut: 'salle_documents')
 *   onSynced    — callback appelé quand le canal est prêt
 */
import * as Y from 'yjs'

function uint8ToBase64(u8) {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin)
}

function base64ToUint8(b64) {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

export class SupabaseYjsProvider {
  constructor(ydoc, supabase, documentId, { onSynced, tableName = 'salle_documents' } = {}) {
    this.ydoc = ydoc
    this.supabase = supabase
    this.documentId = documentId
    this.onSynced = onSynced
    this.tableName = tableName
    this.channel = null
    this._saveTimer = null
    this._destroyed = false
    this._handleUpdate = this._handleUpdate.bind(this)
    this._init()
  }

  async _init() {
    // 1. Charger l'état existant depuis la DB
    const { data } = await this.supabase
      .from(this.tableName)
      .select('yjs_state')
      .eq('id', this.documentId)
      .single()

    if (!this._destroyed && data?.yjs_state) {
      try {
        Y.applyUpdate(this.ydoc, base64ToUint8(data.yjs_state), 'db')
      } catch (e) {
        console.warn('[YjsProvider] Erreur chargement état initial', e)
      }
    }

    if (this._destroyed) return

    // 2. Souscrire au canal Realtime
    this.channel = this.supabase
      .channel(`${this.tableName}-${this.documentId}`)
      .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
        if (this._destroyed) return
        try {
          const update = base64ToUint8(payload.update)
          Y.applyUpdate(this.ydoc, update, 'remote')
        } catch (e) {
          console.warn('[YjsProvider] Erreur application update', e)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.onSynced?.()
        }
      })

    // 3. Écouter les changements locaux
    this.ydoc.on('update', this._handleUpdate)
  }

  _handleUpdate(update, origin) {
    if (this._destroyed) return
    if (origin === 'remote' || origin === 'db') return

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: { update: uint8ToBase64(update) },
      })
    }

    clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => { this._saveToDb() }, 2000)
  }

  async _saveToDb() {
    if (this._destroyed) return
    try {
      const state = Y.encodeStateAsUpdate(this.ydoc)
      await this.supabase
        .from(this.tableName)
        .update({ yjs_state: uint8ToBase64(state), updated_at: new Date().toISOString() })
        .eq('id', this.documentId)
    } catch (e) {
      console.warn('[YjsProvider] Erreur sauvegarde', e)
    }
  }

  async flush() {
    clearTimeout(this._saveTimer)
    await this._saveToDb()
  }

  destroy() {
    this._destroyed = true
    clearTimeout(this._saveTimer)
    this.ydoc.off('update', this._handleUpdate)
    if (this.channel) {
      this.supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}
