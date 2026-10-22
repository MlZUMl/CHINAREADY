// Séries des graphiques : eau, activité, poids et échelles.
import { describe, it, expect } from 'vitest'
import { baseSnap, workout, T } from '../helpers'
import type { WaterLog } from '../../src/data/types'
import { activitySeries, activitySummary, niceCeil, niceScale, waterSeries, waterSummary, weeklyDeltas, weightStats, weightWindow } from '../../src/domain/series'

const water = (day: string, ml: number, i = 0): WaterLog => ({ id: `${day}-${i}`, day, at: day + 'T10:00:00.000Z', glasses: 1, ml, ...T(day + 'T10:00:00.000Z') })

describe('eau', () => {
  it('7 jours, du plus ancien à aujourd\'hui, objectif atteint à 2 L', () => {
    const s = baseSnap()
    s.water_logs = [water('2026-10-20', 1500), water('2026-10-20', 600, 1), water('2026-10-19', 1200), water('2026-10-17', 2000)]
    const ser = waterSeries(s, '2026-10-20', 7)
    expect(ser).toHaveLength(7)
    expect(ser[0].day).toBe('2026-10-14')
    expect(ser[6]).toMatchObject({ day: '2026-10-20', ml: 2100, goal: 2000, reached: true })
    expect(ser[5]).toMatchObject({ ml: 1200, reached: false })
    expect(ser[1].ml).toBe(0)
    const sum = waterSummary(ser)
    expect(sum).toMatchObject({ daysReached: 2, days: 7, total: 5300 })
    // moyenne seulement sur les jours où de l'eau est notée : (2100 + 1200 + 2000) / 3
    expect(sum.avgMl).toBe(1767)
  })
  it('aucune donnée : pas de moyenne inventée', () => {
    expect(waterSummary(waterSeries(baseSnap(), '2026-10-20', 7)).avgMl).toBeNull()
  })
})

describe('activité', () => {
  it('minutes par jour, séances terminées seulement', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 20), workout('2026-10-20', 10), workout('2026-10-18', 30), workout('2026-10-19', 25, { completed: false })]
    const ser = activitySeries(s, '2026-10-20', 7)
    expect(ser[6]).toMatchObject({ minutes: 30, sessions: 2 })
    expect(ser[4]).toMatchObject({ day: '2026-10-18', minutes: 30, sessions: 1 })
    expect(ser[5].minutes).toBe(0)
    expect(activitySummary(ser)).toEqual({ activeDays: 2, days: 7, sessions: 3, minutes: 60 })
  })
})

describe('échelles', () => {
  it('bornes rondes autour des valeurs', () => {
    const sc = niceScale(68.2, 70.9)
    expect(sc.min).toBeLessThanOrEqual(68.2)
    expect(sc.max).toBeGreaterThanOrEqual(70.9)
    expect(sc.ticks.length).toBeGreaterThanOrEqual(2)
    expect(sc.ticks[0]).toBe(sc.min)
    expect(sc.ticks[sc.ticks.length - 1]).toBe(sc.max)
  })
  it('une seule valeur : échelle quand même lisible', () => {
    const sc = niceScale(70, 70)
    expect(sc.min).toBeLessThan(70)
    expect(sc.max).toBeGreaterThan(70)
  })
  it('plafond des barres', () => {
    expect(niceCeil(2300, 500)).toBe(2500)
    expect(niceCeil(0, 500)).toBe(500)
  })
})

describe('poids', () => {
  const pts = [
    { day: '2026-07-01', kg: 74, trend: 74 }, { day: '2026-09-10', kg: 72, trend: 73 },
    { day: '2026-10-06', kg: 71.5, trend: 72.2 }, { day: '2026-10-20', kg: 71, trend: 71.6 },
  ]
  it('8 semaines : les pesées récentes ; tout : l\'historique', () => {
    expect(weightWindow(pts, 'tout', '2026-10-20')).toHaveLength(4)
    // 1er juillet est à plus de 56 jours : écarté
    expect(weightWindow(pts, '8s', '2026-10-20').map(p => p.day)).toEqual(['2026-09-10', '2026-10-06', '2026-10-20'])
  })
  it('trop peu de pesées récentes : on garde les dernières', () => {
    expect(weightWindow(pts, '8s', '2026-12-31').length).toBeGreaterThanOrEqual(2)
  })
  it('écart de tendance et extrêmes', () => {
    const st = weightStats(pts)!
    expect(st.delta).toBe(-2.4)
    expect(st).toMatchObject({ min: 71, max: 74, count: 4 })
    expect(weightStats([])).toBeNull()
  })
})

describe('variation du poids semaine par semaine', () => {
  const pt = (day: string, trend: number) => ({ day, kg: trend, trend })
  // 2026-10-26 est un lundi ; aujourd'hui = mardi 27
  const today = '2026-10-27'
  it('compare la tendance de fin de semaine à celle de la semaine d\'avant (baisse négative)', () => {
    const pts = [pt('2026-10-12', 70), pt('2026-10-14', 69.7), pt('2026-10-20', 69.2), pt('2026-10-27', 69.3)]
    const w = weeklyDeltas(pts, today, 3)
    expect(w.map(x => x.start)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
    expect(w[0].delta).toBeNull() // pas de point de départ avant la 1re semaine
    expect(w[1].delta).toBe(-0.5)
    expect(w[2].delta).toBe(0.1)
  })
  it('laisse vide une semaine sans pesée', () => {
    const pts = [pt('2026-10-05', 70), pt('2026-10-14', 69.5)]
    const w = weeklyDeltas(pts, today, 3)
    expect(w[0].delta).toBe(-0.5)
    expect(w[1].delta).toBeNull()
    expect(w[2].delta).toBeNull()
  })
})
