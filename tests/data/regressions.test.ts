// Corrections apportées lors de la reprise du projet : chacune a son test.
import { describe, it, expect } from 'vitest'
import { DataStore } from '../../src/data/store'
import { SyncEngine } from '../../src/data/sync'
import { createActions } from '../../src/app/actions'
import { deriveOps } from '../../src/domain/rewards'
import { recommend } from '../../src/domain/recommend'
import { chooseMission } from '../../src/domain/missions'
import { commitmentRate } from '../../src/domain/discipline'
import { FakeServer } from './fake-remote'
import { baseSnap, workout } from '../helpers'
import type { Workout } from '../../src/data/types'

const UID = 'aaaaaaaa-0000-4000-8000-00000000000a'
let n = 0
const dbName = () => 'reg-' + (++n) + '-' + Math.random().toString(36).slice(2)
const w = (id: string, extra: Partial<Workout> = {}): Workout => ({ ...workout('2026-10-20', 20), id, ...extra })

describe('synchronisation : pas de boucle, pas de réécriture inutile', () => {
  it('une synchronisation sans nouveauté ne réveille ni l\'écran ni un nouvel envoi', async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    s.setDeriver(snap => deriveOps(snap))
    const sync = new SyncEngine(s, srv.as(UID), UID)
    await sync.attach()
    await s.put('workouts', w('w1'))
    await sync.sync()
    let touched = 0, local = 0
    s.subscribe(() => touched++)
    s.onLocalWrite(() => local++)
    await sync.sync()
    await sync.sync()
    expect(local).toBe(0)
    expect(touched).toBe(0)
  })

  it('les données reçues ne déclenchent pas d\'envoi, et une ligne déjà connue n\'est pas réécrite', async () => {
    const srv = new FakeServer()
    const a = await DataStore.open(dbName()); const sa = new SyncEngine(a, srv.as(UID), UID); await sa.attach()
    await a.put('workouts', w('w1')); await sa.sync()
    const b = await DataStore.open(dbName()); const sb = new SyncEngine(b, srv.as(UID), UID); await sb.attach()
    let local = 0
    b.onLocalWrite(() => local++)
    await sb.sync()
    expect(b.get('workouts', 'w1')).toBeDefined()
    expect(local).toBe(0)
    expect(await b.outboxCount()).toBe(0)
    let touched = 0
    b.subscribe(() => touched++)
    await sb.sync() // la marge de 5 minutes renvoie w1 : rien ne doit être réécrit
    expect(touched).toBe(0)
  })

  it('une écriture locale prévient bien l\'envoi', async () => {
    const s = await DataStore.open(dbName())
    let local = 0
    s.onLocalWrite(() => local++)
    await s.put('workouts', w('w9'))
    expect(local).toBe(1)
  })
})

describe('actions', () => {
  it('le journal du jour reste unique même enregistré deux fois de suite', async () => {
    const s = await DataStore.open(dbName())
    const act = createActions(s)
    await act.saveJournal('2026-10-20', 'Bonne journée', null)
    await act.saveJournal('2026-10-20', 'Bonne journée, finalement fatiguée', null)
    expect(s.all('journal_entries')).toHaveLength(1)
    expect(s.all('journal_entries')[0].text).toMatch(/fatiguée/)
  })

  it('retirer la photo d\'une capsule l\'efface ici et dans l\'espace en ligne', async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    const sync = new SyncEngine(s, srv.as(UID), UID); await sync.attach()
    const act = createActions(s)
    await act.createCapsule({ open_on: null, locked: false, weight_kg: null, energy: 3, habits: null, difficulties: null, workouts_count: 2, success: null, note: null, future_message: 'Tiens bon' }, new Blob(['img'], { type: 'image/jpeg' }))
    const c = s.all('progress_capsules')[0]
    await sync.sync()
    expect(srv.files.size).toBe(1)
    await act.removeCapsulePhoto(c.id)
    await sync.sync()
    expect(srv.files.size).toBe(0)
    expect(await s.getBlob('capsule:' + c.id)).toBeUndefined()
    expect(s.get('progress_capsules', c.id)?.has_photo).toBe(false)
  })

  it('supprimer une capsule efface aussi sa photo en ligne', async () => {
    const srv = new FakeServer()
    const s = await DataStore.open(dbName())
    const sync = new SyncEngine(s, srv.as(UID), UID); await sync.attach()
    const act = createActions(s)
    await act.createCapsule({ open_on: '2026-11-19', locked: true, weight_kg: 62.4, energy: 2, habits: null, difficulties: null, workouts_count: 0, success: null, note: null, future_message: 'Secret' }, new Blob(['img'], { type: 'image/jpeg' }))
    await sync.sync()
    const c = s.all('progress_capsules')[0]
    await act.deleteCapsule(c.id)
    await sync.sync()
    expect(srv.files.size).toBe(0)
    expect(srv.rows('progress_capsules', UID)).toHaveLength(0)
  })
})

describe('recommandations et missions', () => {
  const s = baseSnap()
  const sport = s.commitments.find(c => c.kind === 'sport')
  const prefs = s.energy_preferences[0]
  const checkin = (energy: any, minutes: any = null, need: any = null) => ({ id: 'd', day: '2026-10-20', energy, minutes, need, created_at: '', updated_at: '' })

  it("l'option recommandée reste la bonne après le dédoublonnage", () => {
    // Fatiguée avec 10 minutes : la version minimale (10 min) est recommandée, sans doublon.
    const r = recommend({ checkin: checkin(2, 10), sport, prefs, isRendezvousDay: true, preferMinimum: true })
    expect(r.options[r.primary].version).toBe('min')
    const keys = r.options.map(o => o.version + o.minutes + o.focus)
    expect(new Set(keys).size).toBe(keys.length)
    for (const energy of [1, 2, 3, 4, 5]) for (const minutes of [5, 10, 15, 20, 30, 45]) for (const need of [null, 'reprendre', 'detente', 'bouger']) {
      const x = recommend({ checkin: checkin(energy, minutes, need), sport, prefs, isRendezvousDay: true })
      expect(x.options[x.primary]).toBeDefined()
      expect(x.options.every(o => o.minutes <= minutes)).toBe(true)
    }
  })

  it('la mission du verre du réveil n\'est proposée que le matin, et le choix est stable', () => {
    const morning = new Date('2026-10-20T08:00:00')
    const evening = new Date('2026-10-20T20:00:00')
    const keysEvening = new Set<string>()
    for (let d = 1; d <= 28; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`
      keysEvening.add(chooseMission(s, day, new Date(day + 'T20:00:00'))!.key)
    }
    expect(keysEvening.has('eau-reveil')).toBe(false)
    expect(chooseMission(s, '2026-10-20', morning)?.key).toBe(chooseMission(s, '2026-10-20', morning)?.key)
    expect(chooseMission(s, '2026-10-20', evening)).toBeTruthy()
  })
})

describe('régularité', () => {
  it('part des engagements tenus : version minimale comprise, repos justifié exclu, journée en cours non comptée tant qu\'elle n\'est pas tenue', () => {
    const s = baseSnap('2026-10-19')
    // Lundi 19 : séance faite ; mardi 20 : repos pour épuisement ; mercredi 21 (aujourd'hui) : rien encore.
    s.workouts = [workout('2026-10-19', 10)]
    s.ritual_events = [{ id: 'r', day: '2026-10-20', action: 'repos', reason: 'epuisee', at: '2026-10-20T15:00:00Z', created_at: '', updated_at: '' }]
    s.commitments = s.commitments.filter(c => c.kind === 'sport')
    const r = commitmentRate(s, '2026-10-19', '2026-10-21', '2026-10-21')
    expect(r).toEqual({ planned: 1, done: 1, rate: 1 })
  })
})

describe('nouveau compte', () => {
  it("aucun rendez-vous « manqué » ni « reprise » pour les jours d'avant la création du compte", async () => {
    const { resumeState } = await import('../../src/domain/discipline')
    const { rendezvousStats } = await import('../../src/domain/ritual')
    const { analyze } = await import('../../src/domain/analysis')
    const s = baseSnap('2026-10-20') // engagements créés le mardi 20 octobre
    expect(resumeState(s, '2026-10-20').needed).toBe(false)
    const st = rendezvousStats(s, '2026-09-23', '2026-10-20', '2026-10-20')
    expect(st.missed).toBe(0)
    expect(st.rate).toBeNull()
    expect(analyze(s, '2026-10-20').insights).toHaveLength(0)
  })
})
