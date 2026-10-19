import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfig, cloudConfigured } from '../lib/config'
import type { Remote } from './sync'
import type { Row, TableName } from './types'

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured()) return null
  if (!client) {
    const { supabaseUrl, supabaseKey } = getConfig()
    client = createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'elan-auth', flowType: 'implicit' },
    })
  }
  return client
}

const PAGE = 1000

export class SupabaseRemote implements Remote {
  constructor(private sb: SupabaseClient) {}

  async upsert(table: TableName, rows: (Row & { user_id: string })[]) {
    const { error } = await this.sb.from(table).upsert(rows, { onConflict: 'user_id,id' })
    if (error) throw new Error(`${table} : ${error.message}`)
  }

  async remove(table: TableName, ids: string[]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await this.sb.from(table).delete().in('id', ids.slice(i, i + 200))
      if (error) throw new Error(`${table} : ${error.message}`)
    }
  }

  async fetchSince(table: TableName, sinceIso: string | null) {
    const out: Row[] = []
    for (let from = 0; ; from += PAGE) {
      let q = this.sb.from(table).select('*').order('updated_at', { ascending: true }).range(from, from + PAGE - 1)
      if (sinceIso) q = q.gt('updated_at', sinceIso)
      const { data, error } = await q
      if (error) throw new Error(`${table} : ${error.message}`)
      out.push(...((data ?? []) as Row[]))
      if (!data || data.length < PAGE) break
    }
    return out
  }

  async fetchIds(table: TableName) {
    const ids: string[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb.from(table).select('id').range(from, from + PAGE - 1)
      if (error) throw new Error(`${table} : ${error.message}`)
      ids.push(...(data ?? []).map((r: { id: string }) => r.id))
      if (!data || data.length < PAGE) break
    }
    return ids
  }

  async uploadFile(path: string, blob: Blob) {
    const { error } = await this.sb.storage.from('capsules').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
    if (error) throw new Error('photo : ' + error.message)
  }

  async downloadFile(path: string) {
    const { data, error } = await this.sb.storage.from('capsules').download(path)
    if (error || !data) throw new Error('photo : ' + (error?.message ?? 'introuvable'))
    return data
  }

  async removeFiles(paths: string[]) {
    const { error } = await this.sb.storage.from('capsules').remove(paths)
    if (error) throw new Error('photo : ' + error.message)
  }
}
