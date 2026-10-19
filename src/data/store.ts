// Stockage local (IndexedDB) + état en mémoire.
// Toute écriture passe par commit() : une seule transaction écrit les lignes,
// les récompenses qui en découlent et la file d'envoi vers Supabase (outbox).
import { openDB, type IDBPDatabase } from 'idb'
import { TABLES, type Row, type Snapshot, type TableName, type Tables, type RewardGrant } from './types'
import { nowIso } from '../lib/dates'

export type Op =
  | { type: 'put'; table: TableName; row: Row }
  | { type: 'delete'; table: TableName; id: string }

export interface OutboxEntry {
  seq?: number
  table: TableName | '__storage'
  id: string
  op: 'put' | 'delete'
  at: string
}

export type Deriver = (snap: Snapshot) => Op[]
type Listener = () => void

const DB_VERSION = 1

export class DataStore {
  private mem = new Map<TableName, Map<string, Row>>()
  private listeners = new Set<Listener>()
  private localListeners = new Set<Listener>()
  private grantListeners = new Set<(g: RewardGrant[]) => void>()
  private cached: Snapshot | null = null
  private deriver: Deriver | null = null
  version = 0

  private constructor(private db: IDBPDatabase) {
    for (const t of TABLES) this.mem.set(t, new Map())
  }

  static async open(name = 'elan'): Promise<DataStore> {
    const db = await openDB(name, DB_VERSION, {
      upgrade(db) {
        for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' })
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
      },
    })
    const store = new DataStore(db)
    await store.load()
    return store
  }

  private async load() {
    for (const t of TABLES) {
      const rows = (await this.db.getAll(t)) as Row[]
      const m = this.mem.get(t)!
      m.clear()
      for (const r of rows) m.set(r.id, r)
    }
    this.touch()
  }

  close() { this.db.close() }

  // ------------------------------------------------------------------ lecture
  snapshot(): Snapshot {
    if (!this.cached) {
      const s = {} as Record<TableName, Row[]>
      for (const t of TABLES) s[t] = [...this.mem.get(t)!.values()]
      this.cached = s as Snapshot
    }
    return this.cached
  }

  get<K extends TableName>(table: K, id: string): Tables[K] | undefined {
    return this.mem.get(table)!.get(id) as Tables[K] | undefined
  }

  all<K extends TableName>(table: K): Tables[K][] {
    return this.snapshot()[table]
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Appelé uniquement après une écriture faite sur cet appareil (donc à envoyer au serveur). */
  onLocalWrite(fn: Listener): () => void {
    this.localListeners.add(fn)
    return () => this.localListeners.delete(fn)
  }

  onGrants(fn: (g: RewardGrant[]) => void): () => void {
    this.grantListeners.add(fn)
    return () => this.grantListeners.delete(fn)
  }

  setDeriver(fn: Deriver | null) { this.deriver = fn }

  private touch() {
    this.cached = null
    this.version++
    for (const l of this.listeners) l()
  }

  // ------------------------------------------------------------------ écriture
  /**
   * Applique les opérations, puis les opérations dérivées (récompenses),
   * le tout dans une seule transaction IndexedDB. `fromRemote` = données reçues
   * du serveur : elles ne repartent pas dans la file d'envoi.
   */
  async commit(ops: Op[], opts: { fromRemote?: boolean; derive?: boolean } = {}): Promise<RewardGrant[]> {
    const fromRemote = opts.fromRemote ?? false
    const derive = opts.derive ?? !fromRemote
    const now = nowIso()
    const prepared: Op[] = ops.map(op => {
      if (op.type !== 'put' || fromRemote) return op
      const existing = this.mem.get(op.table)!.get(op.row.id)
      return { ...op, row: { ...op.row, created_at: existing?.created_at || op.row.created_at || now, updated_at: now } }
    })

    // Application en mémoire (pour que le calcul des récompenses voie l'état final)
    const backup = new Map<string, Row | undefined>()
    const apply = (op: Op) => {
      const m = this.mem.get(op.table)!
      const key = op.table + '/' + (op.type === 'put' ? op.row.id : op.id)
      if (!backup.has(key)) backup.set(key, m.get(op.type === 'put' ? op.row.id : op.id))
      if (op.type === 'put') m.set(op.row.id, op.row)
      else m.delete(op.id)
    }
    prepared.forEach(apply)
    if (prepared.length) this.cached = null

    let derived: Op[] = []
    if (derive && this.deriver) {
      derived = this.deriver(this.snapshot()).map(op =>
        op.type === 'put' ? { ...op, row: { ...op.row, created_at: op.row.created_at || now, updated_at: now } } : op)
      derived.forEach(apply)
    }
    const all = [...prepared, ...derived]
    // Rien à écrire (ex. recalcul des récompenses sans nouveauté) : aucune notification,
    // sinon chaque synchronisation en déclencherait une autre, sans fin.
    if (!all.length) return []

    try {
      const stores = [...new Set(all.map(o => o.table)), ...(fromRemote ? [] : ['outbox'])] as string[]
      const tx = this.db.transaction(stores as any, 'readwrite')
      for (const op of all) {
        const st = tx.objectStore(op.table as any)
        if (op.type === 'put') await st.put(op.row)
        else await st.delete(op.id)
        if (!fromRemote) {
          const entry: OutboxEntry = { table: op.table, id: op.type === 'put' ? op.row.id : op.id, op: op.type, at: now }
          await tx.objectStore('outbox' as any).add(entry)
        }
      }
      await tx.done
    } catch (err) {
      // Échec d'écriture : on restaure l'état mémoire pour ne pas afficher une donnée non enregistrée.
      for (const [key, row] of backup) {
        const [table, ...rest] = key.split('/')
        const id = rest.join('/')
        const m = this.mem.get(table as TableName)!
        if (row) m.set(id, row); else m.delete(id)
      }
      this.touch()
      throw err
    }

    this.touch()
    if (!fromRemote) for (const l of this.localListeners) l()
    const grants = derived.filter(o => o.type === 'put' && o.table === 'reward_grants').map(o => (o as any).row as RewardGrant)
    if (grants.length) for (const l of this.grantListeners) l(grants)
    return grants
  }

  put<K extends TableName>(table: K, row: Partial<Tables[K]> & { id: string }) {
    return this.commit([{ type: 'put', table, row: row as Row }])
  }

  remove(table: TableName, id: string) {
    return this.commit([{ type: 'delete', table, id }])
  }

  // ------------------------------------------------------------------ file d'envoi
  async outbox(): Promise<OutboxEntry[]> {
    return (await this.db.getAll('outbox')) as OutboxEntry[]
  }

  async outboxCount(): Promise<number> {
    return this.db.count('outbox')
  }

  async clearOutbox(seqs: number[]) {
    const tx = this.db.transaction('outbox', 'readwrite')
    for (const s of seqs) await tx.store.delete(s)
    await tx.done
  }

  async enqueueStorageDelete(path: string) {
    await this.db.add('outbox', { table: '__storage', id: path, op: 'delete', at: nowIso() } as OutboxEntry)
  }

  /** Met toutes les lignes locales en file d'envoi (première connexion d'un appareil déjà utilisé). */
  async enqueueAll() {
    const tx = this.db.transaction('outbox', 'readwrite')
    const at = nowIso()
    for (const t of TABLES) for (const id of this.mem.get(t)!.keys()) await tx.store.add({ table: t, id, op: 'put', at })
    await tx.done
  }

  // ------------------------------------------------------------------ méta & fichiers
  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key)) as T | undefined
  }

  async setMeta(key: string, value: unknown) {
    await this.db.put('meta', value, key)
  }

  async putBlob(key: string, blob: Blob) { await this.db.put('blobs', blob, key) }
  async getBlob(key: string): Promise<Blob | undefined> { return (await this.db.get('blobs', key)) as Blob | undefined }
  async deleteBlob(key: string) { await this.db.delete('blobs', key) }

  /** Efface toutes les données de cet appareil (utilisé pour « supprimer mes données » ou changer de compte). */
  async wipe() {
    const names = [...TABLES, 'outbox', 'meta', 'blobs']
    const tx = this.db.transaction(names as any, 'readwrite')
    for (const n of names) await tx.objectStore(n as any).clear()
    await tx.done
    for (const t of TABLES) this.mem.get(t)!.clear()
    this.touch()
  }
}
