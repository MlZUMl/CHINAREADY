import { describe, it, expect } from 'vitest'
import { buildSession } from '../../src/domain/exercises'
import { recommend } from '../../src/domain/recommend'
import { baseSnap } from '../helpers'
import { sportCommitment, isRendezvousDay, dayRitual, rendezvousStats } from '../../src/domain/ritual'

describe('séances guidées', () => {
  for (const minutes of [5, 10, 15, 20, 30, 45]) {
    it(`une séance de ${minutes} min dure exactement ${minutes} min`, () => {
      for (const focus of ['renfo', 'mobilite', 'cardio', 'mixte'] as const) {
        const s = buildSession({ minutes, focus, energy: 3, equipment: ['tapis', 'elastique', 'halteres'], seed: 'x' })
        expect(s.totalSeconds).toBe(minutes * 60)
        expect(s.blocks.every(b => b.seconds > 0 && b.rest >= 0)).toBe(true)
        expect(s.blocks.some(b => b.phase === 'corps')).toBe(true)
      }
    })
  }
  it("énergie basse : uniquement des exercices doux, repos plus longs, pas de cardio", () => {
    const s = buildSession({ minutes: 10, focus: 'cardio', energy: 1, equipment: ['tapis'] })
    expect(s.focus).toBe('mobilite')
    expect(s.blocks.every(b => b.exercise.intensity === 1)).toBe(true)
    expect(s.intensity).toBe('douce')
  })
  it("respecte le matériel disponible", () => {
    const s = buildSession({ minutes: 30, focus: 'renfo', energy: 4, equipment: [] })
    expect(s.blocks.every(b => !b.exercise.equipment)).toBe(true)
  })
})

describe('mode journée sans énergie', () => {
  const s = baseSnap()
  const sport = sportCommitment(s)
  const prefs = s.energy_preferences[0]
  const checkin = (energy: any, minutes: any = null, need: any = null) => ({ id: 'd', day: '2026-10-20', energy, minutes, need, created_at: '', updated_at: '' })

  it('épuisée avec 10 minutes : marche douce ou mobilité, message rassurant, notifications limitées', () => {
    const r = recommend({ checkin: checkin(1, 10), sport, prefs, isRendezvousDay: true })
    expect(r.options.every(o => o.minutes <= 10)).toBe(true)
    expect(r.options.map(o => o.focus)).toEqual(expect.arrayContaining(['mobilite']))
    expect(r.message).toMatch(/Pas besoin de tout réussir/)
    expect(r.quiet).toBe(true)
    expect(r.tone).toBe('doux')
  })
  it('en forme avec 30 minutes : séance prévue + alternative plus ambitieuse, au choix', () => {
    const r = recommend({ checkin: checkin(4, 30), sport, prefs, isRendezvousDay: true })
    expect(r.options[r.primary].id).toBe('habituelle')
    expect(r.options.some(o => o.id === 'plus' && o.minutes === 30)).toBe(true)
    expect(r.options.length).toBeGreaterThanOrEqual(2)
  })
  it("ne touche jamais à l'alimentation : aucune donnée nutritionnelle, aucun repas modifié", () => {
    const snap = baseSnap()
    snap.meals = [{ id: 'm1', day: '2026-10-20', moment: 'midi', title: 'Soupe', recipe_id: null, markers: ['legumes'], feeling: null, note: null, at: '', created_at: '', updated_at: '' }]
    const before = JSON.stringify(snap)
    const r = recommend({ checkin: checkin(1, 5), sport: sportCommitment(snap), prefs, isRendezvousDay: true })
    expect(JSON.stringify(snap)).toBe(before)
    expect(JSON.stringify(r)).not.toMatch(/calor|kcal|manger moins|repas/i)
  })
  it('mode désactivé : les réponses du check-in sont ignorées', () => {
    const r = recommend({ checkin: checkin(1, 5), sport, prefs: { ...prefs, enabled: false }, isRendezvousDay: true })
    expect(r.quiet).toBe(false)
    expect(r.options[0].id).toBe('habituelle')
  })
  it("jour de repos : rien n'est imposé, le repos est présenté positivement", () => {
    const r = recommend({ checkin: checkin(3), sport, prefs, isRendezvousDay: false })
    expect(r.restDay).toBe(true)
    expect(r.message).toMatch(/repos fait partie du programme/)
  })
  it('moins de temps que le minimum : un petit pas de 5 minutes pour garder le lien', () => {
    const r = recommend({ checkin: checkin(3, 5), sport, prefs, isRendezvousDay: true })
    expect(r.options[r.primary].minutes).toBe(5)
  })
})

describe('rituel : jours et heure configurés', () => {
  it('utilise les jours et l\'heure du réglage, modifiables', () => {
    const s = baseSnap()
    const c = sportCommitment(s)!
    expect(c.cue_time).toBe('17:15')
    expect(isRendezvousDay(c, '2026-10-19')).toBe(true) // lundi
    expect(isRendezvousDay(c, '2026-10-24')).toBe(false) // samedi
    const custom = { ...c, days: [2, 4], cue_time: '18:30' }
    expect(isRendezvousDay(custom, '2026-10-19')).toBe(false)
    expect(isRendezvousDay(custom, '2026-10-20')).toBe(true)
  })
  it('statuts : honoré dès la version minimale, petit pas en dessous, repos choisi, manqué', () => {
    const s = baseSnap()
    s.workouts = [
      { ...workoutRow('2026-10-19', 10) },
      { ...workoutRow('2026-10-20', 5) },
    ]
    s.ritual_events = [{ id: 'r', day: '2026-10-21', action: 'repos', reason: 'epuisee', at: '2026-10-21T15:00:00Z', created_at: '', updated_at: '' }]
    expect(dayRitual(s, '2026-10-19', '2026-10-23').status).toBe('honore')
    expect(dayRitual(s, '2026-10-20', '2026-10-23').status).toBe('petit-pas')
    expect(dayRitual(s, '2026-10-21', '2026-10-23').status).toBe('repos')
    expect(dayRitual(s, '2026-10-22', '2026-10-23').status).toBe('manque')
    expect(dayRitual(s, '2026-10-23', '2026-10-23').status).toBe('a-venir')
    const st = rendezvousStats(s, '2026-10-19', '2026-10-23', '2026-10-23')
    expect(st).toMatchObject({ scheduled: 4, honored: 1, smallSteps: 1, rests: 1, missed: 1 })
    expect(st.rate).toBeCloseTo(1 / 3)
  })
})

function workoutRow(day: string, minutes: number) {
  return { id: 'w-' + day, day, started_at: day + 'T15:15:00Z', ended_at: day + 'T15:30:00Z', kind: 'guidee' as const, activity: 'mixte', program: null, planned_minutes: minutes, actual_minutes: minutes, version: 'min' as const, completed: true, source: 'rituel' as const, energy: null, note: null, created_at: '', updated_at: '' }
}

describe('épuisée avec 10 minutes', () => {
  it('propose à la fois la mobilité douce et la marche tranquille', () => {
    const s = baseSnap()
    const r = recommend({ checkin: { id: 'd', day: '2026-10-20', energy: 1, minutes: 10, need: null, created_at: '', updated_at: '' } as any, sport: sportCommitment(s), prefs: s.energy_preferences[0], isRendezvousDay: true })
    expect(r.options.map(o => o.label)).toEqual(expect.arrayContaining(['Mobilité douce', 'Marche tranquille']))
  })
})
