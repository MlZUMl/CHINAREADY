import { describe, it, expect } from 'vitest'
import { baseSnap, workout } from '../helpers'
import { deriveOps, expectedGrants, levelFor, xpForLevel } from '../../src/domain/rewards'
import { chooseMission, missionOps, MISSIONS } from '../../src/domain/missions'
import type { Snapshot, RewardGrant, UserMission } from '../../src/data/types'

/** Applique les opérations dérivées comme le ferait le stockage. */
function applyDerive(s: Snapshot, now: Date): { snap: Snapshot; added: RewardGrant[] } {
  const ops = deriveOps(s, now)
  const snap = { ...s, reward_grants: [...s.reward_grants], user_missions: [...s.user_missions] }
  const added: RewardGrant[] = []
  for (const op of ops) {
    if (op.type !== 'put') continue
    if (op.table === 'reward_grants') { snap.reward_grants.push(op.row as RewardGrant); added.push(op.row as RewardGrant) }
    if (op.table === 'user_missions') snap.user_missions = snap.user_missions.map(m => m.id === op.row.id ? op.row as UserMission : m)
  }
  return { snap, added }
}

const NOW = new Date('2026-10-20T18:00:00')

describe('récompenses', () => {
  it('niveaux : seuils croissants', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(60)
    expect(xpForLevel(3)).toBe(160)
    expect(levelFor(159).level).toBe(2)
    expect(levelFor(160).level).toBe(3)
  })

  it("une séance terminée donne XP, objet et badge — une seule fois, même si l'on recalcule", () => {
    const s = baseSnap()
    s.avatar_profiles = [{ id: 'avatar', character: 'a', style: 's', outfit: 'o', universe: 'chambre', name: null, equipped: {}, zones: {}, created_at: '', updated_at: '' }]
    s.workouts = [workout('2026-10-20', 20)]
    const first = applyDerive(s, NOW)
    const ids = first.added.map(g => g.id)
    expect(ids).toEqual(expect.arrayContaining(['xp:seance:' + s.workouts[0].id, 'xp:rdv:2026-10-20', 'item:tapis-yoga', 'badge:premier-pas', 'zone:chambre']))
    const second = applyDerive(first.snap, NOW)
    expect(second.added).toHaveLength(0)
    // Rejouer la même séance (même id) ne redonne rien
    const replay = applyDerive({ ...first.snap, workouts: [...first.snap.workouts, { ...s.workouts[0] }] }, NOW)
    expect(replay.added).toHaveLength(0)
  })

  it("l'avatar évolue : un objectif d'eau atteint fait apparaître une plante", () => {
    const s = baseSnap()
    s.avatar_profiles = [{ id: 'avatar', character: 'a', style: 's', outfit: 'o', universe: 'chambre', name: null, equipped: {}, zones: {}, created_at: '', updated_at: '' }]
    s.water_logs = Array.from({ length: 8 }, (_, i) => ({ id: 'e' + i, day: '2026-10-20', at: '2026-10-20T0' + (i + 1) + ':00:00', glasses: 1, created_at: '', updated_at: '' }))
    const { added } = applyDerive(s, NOW)
    expect(added.map(g => g.id)).toContain('item:pothos')
  })

  it('les récompenses ne sont jamais retirées après une journée manquée', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-01', 20)]
    const { snap } = applyDerive(s, new Date('2026-10-01T18:00:00'))
    const later = deriveOps(snap, new Date('2026-10-20T18:00:00'))
    expect(later.every(op => op.type === 'put')).toBe(true)
    expect(later.filter(op => op.type === 'put' && op.table === 'reward_grants').length).toBe(0)
  })

  it("au plus 2 séances récompensées par jour (pas de surenchère d'effort)", () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 10), workout('2026-10-20', 10), workout('2026-10-20', 10)]
    const seances = expectedGrants(s, '2026-10-20').filter(g => g.id.startsWith('xp:seance:'))
    expect(seances).toHaveLength(2)
  })

  it('badge secret « Le retour gagnant » : seulement après 2 rendez-vous manqués puis une reprise', () => {
    const s = baseSnap('2026-10-12')
    s.workouts = [workout('2026-10-12', 20)] // lundi
    expect(expectedGrants(s, '2026-10-15').some(g => g.id === 'badge:retour-gagnant')).toBe(false)
    s.workouts.push(workout('2026-10-15', 10)) // mardi et mercredi manqués, jeudi repris
    const g = expectedGrants(s, '2026-10-15')
    expect(g.some(x => x.id === 'badge:retour-gagnant')).toBe(true)
    expect(g.some(x => x.id === 'xp:reprise:2026-10-15')).toBe(true)
  })

  it('badge secret « La petite victoire » : une séance plus courte plutôt que rien', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 20, { version: 'usual' })]
    expect(expectedGrants(s, '2026-10-20').some(g => g.id === 'badge:petite-victoire')).toBe(false)
    s.workouts.push(workout('2026-10-21', 6, { planned_minutes: 6, version: 'min' }))
    expect(expectedGrants(s, '2026-10-21').some(g => g.id === 'badge:petite-victoire')).toBe(true)
  })

  it('aucune récompense liée au poids', () => {
    const s = baseSnap()
    s.weights = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, day: `2026-09-${String(i + 1).padStart(2, '0')}`, kg: 70 - i, note: null, created_at: '', updated_at: '' }))
    expect(expectedGrants(s, '2026-10-20')).toHaveLength(0)
  })
})

describe('missions', () => {
  const um = (key: string, extra: Partial<UserMission> = {}): UserMission => ({ id: '2026-10-20:' + key, mission_key: key, day: '2026-10-20', status: 'active', mystery: false, accepted_at: null, completed_at: null, expires_on: null, reward_key: null, created_at: '', updated_at: '', ...extra })

  it('ne peut pas être validée sans remplir sa condition', () => {
    const s = baseSnap()
    s.user_missions = [um('marche-10')]
    expect(missionOps(s, '2026-10-20', NOW.toISOString())).toHaveLength(0)
    s.workouts = [workout('2026-10-20', 8, { kind: 'externe', activity: 'marche' })]
    expect(missionOps(s, '2026-10-20', NOW.toISOString())).toHaveLength(0) // 8 min < 10
    s.workouts = [workout('2026-10-20', 12, { kind: 'externe', activity: 'marche' })]
    const done = missionOps(s, '2026-10-20', NOW.toISOString())
    expect(done[0].status).toBe('terminee')
  })

  it("une mission mystère doit être lancée (objectif révélé) avant d'être réussie", () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 12, { kind: 'externe', activity: 'marche' })]
    s.user_missions = [um('marche-10', { status: 'disponible', mystery: true })]
    expect(missionOps(s, '2026-10-20', NOW.toISOString())).toHaveLength(0)
    s.user_missions = [um('marche-10', { status: 'active', mystery: true })]
    expect(missionOps(s, '2026-10-20', NOW.toISOString())[0].status).toBe('terminee')
  })

  it('une mission réussie rapporte une seule fois, et une mission mystère offre un objet exclusif', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 12, { kind: 'externe', activity: 'marche' })]
    s.user_missions = [um('marche-10', { mystery: true })]
    const a = applyDerive(s, NOW)
    expect(a.added.map(g => g.id)).toEqual(expect.arrayContaining(['xp:mission:2026-10-20:marche-10', 'item:cristal-rose']))
    expect(applyDerive(a.snap, NOW).added).toHaveLength(0)
  })

  it('les missions non faites expirent le lendemain', () => {
    const s = baseSnap()
    s.user_missions = [um('journal-ressenti')]
    expect(missionOps(s, '2026-10-21', NOW.toISOString())[0].status).toBe('expiree')
  })

  it("aucune mission de mouvement un jour de repos, et rien d'exigeant si l'énergie est au plus bas", () => {
    const s = baseSnap()
    const saturday = '2026-10-24'
    for (let k = 0; k < 10; k++) {
      const m = chooseMission({ ...s, user_missions: [] }, saturday)
      expect(MISSIONS.find(x => x.key === m!.key)!.movement).toBeFalsy()
    }
    s.daily_checkins = [{ id: '2026-10-20', day: '2026-10-20', energy: 1, minutes: null, need: null, created_at: '', updated_at: '' }]
    const m = chooseMission(s, '2026-10-20')!
    expect(m.difficulty).toBe(1)
  })

  it('le choix de la mission est déterministe (mêmes données, même mission)', () => {
    const s = baseSnap()
    expect(chooseMission(s, '2026-10-20')?.key).toBe(chooseMission(s, '2026-10-20')?.key)
  })
})
