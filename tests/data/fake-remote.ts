import type { Remote } from '../../src/data/sync'
import type { Row, TableName } from '../../src/data/types'

/** Serveur simulé : mêmes règles que Supabase (clé user_id+id, isolation par utilisatrice). */
export class FakeServer {
  tables = new Map<string, Map<string, Row & { user_id: string }>>()
  files = new Map<string, Blob>()
  clock = Date.parse('2026-10-20T08:00:00Z')
  private key(uid: string, id: string) { return uid + '|' + id }
  table(t: string) { if (!this.tables.has(t)) this.tables.set(t, new Map()); return this.tables.get(t)! }
  as(userId: string): Remote {
    const srv = this
    return {
      async upsert(t, rows) {
        for (const r of rows) {
          if (r.user_id !== userId) throw new Error('RLS: refusé')
          srv.table(t).set(srv.key(userId, r.id), { ...r })
        }
      },
      async remove(t, ids) { for (const id of ids) srv.table(t).delete(srv.key(userId, id)) },
      async fetchSince(t, since) {
        return [...srv.table(t).values()].filter(r => r.user_id === userId && (!since || Date.parse(r.updated_at) > Date.parse(since)))
          .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
      },
      async fetchIds(t) { return [...srv.table(t).values()].filter(r => r.user_id === userId).map(r => r.id) },
      async uploadFile(path, blob) { if (!path.startsWith(userId + '/')) throw new Error('RLS: refusé'); srv.files.set(path, blob) },
      async downloadFile(path) { const b = srv.files.get(path); if (!b) throw new Error('introuvable'); return b },
      async removeFiles(paths) { for (const p of paths) srv.files.delete(p) },
    }
  }
  rows(t: TableName, userId: string) { return [...this.table(t).values()].filter(r => r.user_id === userId) }
}
