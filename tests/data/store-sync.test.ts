import { describe, it, expect } from 'vitest'
import { DataStore } from '../../src/data/store'
import { SyncEngine } from '../../src/data/sync'
import { FakeServer } from './fake-remote'
import type { Workout, RewardGrant } from '../../src/data/types'

let n = 0
const dbName = () => 'test-' + (++n) + '-' + Math.random().toString(36).slice(2)
const UID = 'aaaaaaaa-0000-4000-8000-00000000000a'
const OTHER = 'bbbbbbbb-0000-4000-8000-00000000000b'

const workout = (id: string, extra: Partial<Workout> = {}): Workout => ({
  id, day: '2026-10-20', started_at: '2026-10-20T15:15:00.000Z', ended_at: '2026-10-20T15:35:00.000Z',
  kind: 'guidee', activity: 'renfo', program: null, planned_minutes: 20, actual_minutes: 20, version: 'usual',
  completed: true, source: 'rituel', energy: 3, note: null, created_at: '', updated_at: '', ...extra,
})

describe('stockage local', () => {
  it('une séance enregistrée reste présente après rechargement', async () => {
    const name = dbName()
    const s1 = await DataStore.open(name)
    await s1.put('workouts', workout('w1'))
    s1.close()
    const s2 = await DataStore.open(name)
    expect(s2.get('workouts', 'w1')?.actual_minutes).toBe(20)
    expect(s2.get('workouts', 'w1')?.created_at).toBeTruthy()
  })

  it('les récompenses dérivées sont écrites dans la même transaction et signalées une fois', async () => {
    const name = dbName()
    const s = await DataStore.open(name)
    s.setDeriver(snap => snap.workouts.filter(w => !snap.reward_grants.some(g => g.id === 'xp:' + w.id))
      .map(w => ({ type: 'put' as const, table: 'reward_grants' as const, row: { id: 'xp:' + w.id, kind: 'xp', ref: 'seance', xp: 20, reason: 'Séance', granted_at: '' } as any })))
    const seen: RewardGrant[][] = []
    s.onGrants(g => seen.push(g))
    await s.put('workouts', workout('w1'))
    await s.put('workouts', workout('w1', { note: 'modifiée' })) // même séance, re-modifiée
    expect(seen).toHaveLength(1)
    expect(s.all('reward_grants')).toHaveLength(1)
    s.close()
    const again = await DataStore.open(name)
    expect(again.all('reward_grants')).toHaveLength(1)
  })

  it("les données reçues du serveur ne repartent pas dans la file d'envoi", async () => {
    const s = await DataStore.open(dbName())
    await s.commit([{ type: 'put', table: 'workouts', row: workout('r1', { updated_at: '2026-10-20T10:00:00Z', created_at: '2026-10-20T10:00:00Z' }) }], { fromRemote: true })
    expect(await s.outboxCount()).toBe(0)
    await s.put('workouts', workout('l1'))
    expect(await s.outboxCount()).toBe(1)
  })
})

describe('synchronisation', () => {
  it("les données créées hors compte sont rattachées puis envoyées à la connexion", async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    await s.put('workouts', workout('w1'))
    const sync = new SyncEngine(s, srv.as(UID), UID)
    expect(await sync.attach()).toBe('adopte')
    await sync.sync()
    expect(sync.status).toBe('pret')
    expect(srv.rows('workouts', UID).map(r => r.id)).toEqual(['w1'])
    expect(await s.outboxCount()).toBe(0)
  })

  it('un second appareil récupère les données, et la version la plus récente gagne', async () => {
    const srv = new FakeServer()
    const a = await DataStore.open(dbName())
    const syncA = new SyncEngine(a, srv.as(UID), UID)
    await syncA.attach()
    await a.put('workouts', workout('w1'))
    await syncA.sync()

    const b = await DataStore.open(dbName())
    const syncB = new SyncEngine(b, srv.as(UID), UID)
    await syncB.attach()
    await syncB.sync()
    expect(b.get('workouts', 'w1')?.actual_minutes).toBe(20)

    await new Promise(r => setTimeout(r, 5))
    await b.put('workouts', { ...b.get('workouts', 'w1')!, note: 'depuis B' })
    await syncB.sync()
    await syncA.sync()
    expect(a.get('workouts', 'w1')?.note).toBe('depuis B')
  })

  it("une modification locale non envoyée n'est jamais écrasée par le serveur", async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    const sync = new SyncEngine(s, srv.as(UID), UID)
    await sync.attach()
    await s.put('workouts', workout('w1', { note: 'local' }))
    // Le serveur possède une version plus récente, mais la modification locale est en attente
    srv.table('workouts').set(UID + '|w1', { ...workout('w1', { note: 'serveur' }), user_id: UID, updated_at: '2030-01-01T00:00:00Z', created_at: '2030-01-01T00:00:00Z' })
    await sync.pull()
    expect(s.get('workouts', 'w1')?.note).toBe('local')
  })

  it("une suppression faite sur un appareil disparaît de l'autre", async () => {
    const srv = new FakeServer()
    const a = await DataStore.open(dbName()); const sa = new SyncEngine(a, srv.as(UID), UID); await sa.attach()
    await a.put('workouts', workout('w1')); await a.put('workouts', workout('w2')); await sa.sync()
    const b = await DataStore.open(dbName()); const sb = new SyncEngine(b, srv.as(UID), UID); await sb.attach(); await sb.sync()
    await a.remove('workouts', 'w1'); await sa.sync()
    await b.setMeta('idcheck:workouts', '1999-01-01')
    await sb.sync()
    expect(b.get('workouts', 'w1')).toBeUndefined()
    expect(b.get('workouts', 'w2')).toBeDefined()
  })

  it("se connecter avec un autre compte vide l'appareil (pas de mélange entre comptes)", async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    const s1 = new SyncEngine(s, srv.as(UID), UID); await s1.attach()
    await s.put('workouts', workout('w1')); await s1.sync()
    const s2 = new SyncEngine(s, srv.as(OTHER), OTHER)
    expect(await s2.attach()).toBe('change')
    await s2.sync()
    expect(s.all('workouts')).toHaveLength(0)
    expect(srv.rows('workouts', OTHER)).toHaveLength(0)
    expect(srv.rows('workouts', UID)).toHaveLength(1)
  })

  it('les photos de capsule sont envoyées dans le dossier privé de leur propriétaire', async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    const sync = new SyncEngine(s, srv.as(UID), UID); await sync.attach()
    await s.putBlob('capsule:c1', new Blob(['img'], { type: 'image/jpeg' }))
    await s.put('progress_capsules', { id: 'c1', created_day: '2026-10-20', open_on: null, locked: false, has_photo: true, photo_path: null, weight_kg: null, energy: null, habits: null, difficulties: null, workouts_count: null, success: null, note: null, future_message: 'coucou', snapshot: {}, opened_at: null, reopen_note: null, unlock_requested_at: null } as any)
    await sync.sync()
    expect(srv.files.has(`${UID}/c1.jpg`)).toBe(true)
    expect(srv.rows('progress_capsules', UID)[0].photo_path).toBe(`${UID}/c1.jpg`)
  })
})
