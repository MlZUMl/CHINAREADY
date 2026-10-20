// Programmes sportifs progressifs, niveau des séances, illustrations des exercices.
import { describe, it, expect } from 'vitest'
import { baseSnap, workout } from '../helpers'
import { PROGRAMS, programProgress, programSessions, sessionUrl } from '../../src/domain/programs'
import { buildSession, EXERCISES } from '../../src/domain/exercises'
import { ILLUSTRATED } from '../../src/art/ExerciseArt'
import { parsePath } from '../../src/lib/router'

describe('programmes', () => {
  it('4 à 8 semaines, 3 séances par semaine, durée et niveau qui ne baissent jamais', () => {
    for (const p of PROGRAMS) {
      expect(p.weeks).toBeGreaterThanOrEqual(4)
      expect(p.weeks).toBeLessThanOrEqual(8)
      expect(p.plan).toHaveLength(p.weeks)
      for (let w = 1; w < p.weeks; w++) {
        expect(p.plan[w].minutes).toBeGreaterThanOrEqual(p.plan[w - 1].minutes)
        expect(p.plan[w].level).toBeGreaterThanOrEqual(p.plan[w - 1].level)
      }
      const s = programSessions(p)
      expect(s).toHaveLength(p.weeks * p.perWeek)
      expect(new Set(s.map(x => x.title)).size).toBe(s.length)
    }
  })

  it('l\'avancement se déduit des séances enregistrées depuis le début du programme', () => {
    const s = baseSnap()
    const p = PROGRAMS.find(x => x.id === 'tonifier')!
    s.profiles[0].settings.program = { id: 'tonifier', start: '2026-10-12' }
    const [s1, s2, s3, s4] = programSessions(p)
    s.workouts = [
      workout('2026-10-10', 15, { program: s1.title }), // avant le démarrage : ne compte pas
      workout('2026-10-13', 15, { program: s1.title }),
      workout('2026-10-15', 15, { program: s2.title }),
      workout('2026-10-16', 15, { program: 'Mixte · 15 min' }),
    ]
    let pr = programProgress(s, '2026-10-20')!
    expect([pr.doneCount, pr.next?.title, pr.week]).toEqual([2, s3.title, 1])
    s.workouts.push(workout('2026-10-18', 15, { program: s3.title }))
    pr = programProgress(s, '2026-10-20')!
    expect([pr.next?.title, pr.next?.week, pr.next?.minutes, pr.next?.level]).toEqual([s4.title, 2, 15, 2])
    expect(programProgress(baseSnap(), '2026-10-20')).toBeNull()
  })

  it('l\'adresse de séance porte la durée, le type, le niveau et le titre', () => {
    const x = programSessions(PROGRAMS[0])[0]
    const { route, query } = parsePath(sessionUrl(x, 'rituel'))
    expect(route).toBe('/seance')
    expect([query.get('min'), query.get('focus'), query.get('niveau'), query.get('programme'), query.get('source')]).toEqual(['10', 'mixte', '1', x.title, 'rituel'])
  })
})

describe('niveau des séances', () => {
  it('le niveau du programme fixe l\'intensité ; une énergie basse ramène toujours au doux', () => {
    const tonique = buildSession({ minutes: 20, focus: 'renfo', level: 3, energy: 3, equipment: ['tapis', 'halteres'] })
    expect(tonique.intensity).toBe('tonique')
    expect(tonique.blocks.find(b => b.phase === 'corps')!.seconds).toBe(45)
    const fatiguee = buildSession({ minutes: 20, focus: 'renfo', level: 3, energy: 2, equipment: ['tapis'] })
    expect(fatiguee.intensity).toBe('douce')
    expect(fatiguee.blocks.every(b => b.exercise.intensity === 1)).toBe(true)
    expect(buildSession({ minutes: 20, focus: 'renfo', energy: 4 }).intensity).toBe('tonique') // sans programme : comme avant
    for (const level of [1, 2, 3] as const) expect(buildSession({ minutes: 25, focus: 'cardio', level }).totalSeconds).toBe(25 * 60)
  })
})

describe('illustrations', () => {
  it('chaque exercice de la bibliothèque a sa propre illustration', () => {
    expect(EXERCISES.filter(e => !ILLUSTRATED.includes(e.id)).map(e => e.id)).toEqual([])
  })
})
