// Synchronisation appareil <-> Supabase.
// Principe : l'appareil fonctionne toujours hors ligne ; chaque écriture locale est mise en file,
// puis envoyée dès que possible. Au retour, on récupère les changements faits ailleurs.
// Conflit : la version la plus récente (updated_at) l'emporte ; une modification locale
// pas encore envoyée n'est jamais écrasée.
import type { DataStore, OutboxEntry, Op } from './store'
import { TABLES, type Row, type TableName, type ProgressCapsule } from './types'
import { toDay } from '../lib/dates'

export interface Remote {
  upsert(table: TableName, rows: (Row & { user_id: string })[]): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  fetchSince(table: TableName, sinceIso: string | null): Promise<(Row & { user_id?: string })[]>
  fetchIds(table: TableName): Promise<string[]>
  uploadFile(path: string, blob: Blob): Promise<void>
  downloadFile(path: string): Promise<Blob>
  removeFiles(paths: string[]): Promise<void>
}

export type SyncStatus = 'hors-ligne' | 'pret' | 'en-cours' | 'erreur'

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0)

export class SyncEngine {
  status: SyncStatus = 'pret'
  lastError: string | null = null
  lastSyncAt: string | null = null
  private running: Promise<void> | null = null
  private listeners = new Set<() => void>()

  constructor(private store: DataStore, private remote: Remote, private userId: string) {}

  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { for (const l of this.listeners) l() }

  /**
   * À la connexion : si l'appareil contient des données créées hors compte, elles sont
   * rattachées au compte et envoyées ; si elles appartiennent à un autre compte, l'appareil
   * est vidé avant de récupérer les données du compte connecté.
   */
  async attach(): Promise<'adopte' | 'change' | 'meme'> {
    const owner = await this.store.getMeta<string>('owner')
    if (owner === this.userId) return 'meme'
    if (owner && owner !== this.userId) {
      await this.store.wipe()
      await this.store.setMeta('owner', this.userId)
      return 'change'
    }
    await this.store.enqueueAll()
    await this.store.setMeta('owner', this.userId)
    return 'adopte'
  }

  sync(): Promise<void> {
    if (!this.running) {
      this.running = this.run().finally(() => { this.running = null })
    }
    return this.running
  }

  private async run() {
    this.status = 'en-cours'; this.emit()
    try {
      await this.uploadPendingPhotos()
      await this.push()
      await this.pull()
      this.status = 'pret'
      this.lastError = null
      this.lastSyncAt = new Date().toISOString()
      await this.store.setMeta('lastSyncAt', this.lastSyncAt)
    } catch (err) {
      this.status = typeof navigator !== 'undefined' && navigator.onLine === false ? 'hors-ligne' : 'erreur'
      this.lastError = err instanceof Error ? err.message : String(err)
    }
    this.emit()
  }

  // ------------------------------------------------------------------ envoi
  async push() {
    const entries = await this.store.outbox()
    if (!entries.length) return
    // Dernière opération par ligne
    const latest = new Map<string, OutboxEntry>()
    for (const e of entries) latest.set(e.table + '/' + e.id, e)
    const seqs = entries.map(e => e.seq!)

    const storageDeletes = [...latest.values()].filter(e => e.table === '__storage').map(e => e.id)
    const byTable = new Map<TableName, { puts: string[]; dels: string[] }>()
    for (const e of latest.values()) {
      if (e.table === '__storage') continue
      const t = e.table as TableName
      if (!byTable.has(t)) byTable.set(t, { puts: [], dels: [] })
      const slot = byTable.get(t)!
      if (e.op === 'put') slot.puts.push(e.id); else slot.dels.push(e.id)
    }

    for (const t of TABLES) {
      const slot = byTable.get(t)
      if (!slot?.puts.length) continue
      const rows = slot.puts
        .map(id => this.store.get(t, id) as Row | undefined)
        .filter((r): r is Row => Boolean(r))
        .map(r => ({ ...r, user_id: this.userId }))
      for (let i = 0; i < rows.length; i += 400) await this.remote.upsert(t, rows.slice(i, i + 400))
    }
    // Suppressions : enfants d'abord
    for (const t of [...TABLES].reverse()) {
      const slot = byTable.get(t)
      if (slot?.dels.length) await this.remote.remove(t, slot.dels)
    }
    if (storageDeletes.length) await this.remote.removeFiles(storageDeletes)
    await this.store.clearOutbox(seqs)
  }

  // ------------------------------------------------------------------ réception
  async pull() {
    const pending = new Set((await this.store.outbox()).map(e => e.table + '/' + e.id))
    const today = toDay()
    const ops: Op[] = []
    for (const t of TABLES) {
      const since = await this.store.getMeta<string>('pull:' + t)
      const sinceIso = since ? new Date(Date.parse(since) - 5 * 60_000).toISOString() : null
      const rows = await this.remote.fetchSince(t, sinceIso)
      let max = since ?? null
      for (const r of rows) {
        const { user_id: _ignored, ...row } = r
        if (!max || time(row.updated_at) > time(max)) max = row.updated_at
        if (pending.has(t + '/' + row.id)) continue
        const local = this.store.get(t, row.id) as Row | undefined
        // Seulement ce qui est strictement plus récent : la marge de 5 minutes ci-dessus
        // renvoie des lignes déjà connues, qui ne doivent rien réécrire.
        if (!local || time(row.updated_at) > time(local.updated_at)) ops.push({ type: 'put', table: t, row: row as Row })
      }
      if (max) await this.store.setMeta('pull:' + t, max)

      // Une fois par jour : retirer ce qui a été supprimé depuis un autre appareil.
      const lastCheck = await this.store.getMeta<string>('idcheck:' + t)
      if (since && lastCheck !== today) {
        const remoteIds = new Set(await this.remote.fetchIds(t))
        for (const local of this.store.all(t) as Row[]) {
          if (!remoteIds.has(local.id) && !pending.has(t + '/' + local.id)) ops.push({ type: 'delete', table: t, id: local.id })
        }
        await this.store.setMeta('idcheck:' + t, today)
      }
    }
    if (ops.length) await this.store.commit(ops, { fromRemote: true })
    // Les récompenses se recalculent sur l'état fusionné (clés déterministes : pas de doublon possible).
    await this.store.commit([], { derive: true })
  }

  // ------------------------------------------------------------------ photos
  private async uploadPendingPhotos() {
    for (const c of this.store.all('progress_capsules') as ProgressCapsule[]) {
      if (!c.has_photo || c.photo_path) continue
      const blob = await this.store.getBlob('capsule:' + c.id)
      if (!blob) continue
      const path = `${this.userId}/${c.id}.jpg`
      await this.remote.uploadFile(path, blob)
      await this.store.commit([{ type: 'put', table: 'progress_capsules', row: { ...c, photo_path: path } as Row }], { derive: false })
    }
  }

  async photoFor(c: ProgressCapsule): Promise<Blob | undefined> {
    const local = await this.store.getBlob('capsule:' + c.id)
    if (local || !c.photo_path) return local
    const blob = await this.remote.downloadFile(c.photo_path)
    await this.store.putBlob('capsule:' + c.id, blob)
    return blob
  }
}
