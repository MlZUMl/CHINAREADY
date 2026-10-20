// Séries pour les graphiques : poids, eau et activité. Fonctions pures, sans écran.
import type { Snapshot } from '../data/types'
import { addDays, daysBetween, type Day } from '../lib/dates'
import { waterGoalMl, waterMl } from './discipline'

export interface WaterDay { day: Day; ml: number; goal: number; reached: boolean }
export interface ActivityDay { day: Day; minutes: number; sessions: number }

export const RANGES = { '7': 7, '30': 30 } as const
export type DaysRange = keyof typeof RANGES

/** Eau bue chaque jour sur les `days` derniers jours (aujourd'hui compris), du plus ancien au plus récent. */
export function waterSeries(s: Snapshot, today: Day, days: number): WaterDay[] {
  const goal = waterGoalMl(s)
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1))
    const ml = waterMl(s, day)
    return { day, ml, goal, reached: ml >= goal }
  })
}

/** Minutes d'activité terminée par jour (séances guidées et activités notées). */
export function activitySeries(s: Snapshot, today: Day, days: number): ActivityDay[] {
  const done = s.workouts.filter(w => w.completed)
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1))
    const ws = done.filter(w => w.day === day)
    return { day, minutes: ws.reduce((n, w) => n + (w.actual_minutes || 0), 0), sessions: ws.length }
  })
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function waterSummary(series: WaterDay[]) {
  const total = sum(series.map(d => d.ml))
  return {
    daysReached: series.filter(d => d.reached).length,
    days: series.length,
    /** moyenne sur les jours où de l'eau est notée (un jour oublié ne tire pas la moyenne vers le bas) */
    avgMl: (() => { const logged = series.filter(d => d.ml > 0); return logged.length ? Math.round(sum(logged.map(d => d.ml)) / logged.length) : null })(),
    total,
  }
}

export function activitySummary(series: ActivityDay[]) {
  return {
    activeDays: series.filter(d => d.minutes > 0).length,
    days: series.length,
    sessions: sum(series.map(d => d.sessions)),
    minutes: sum(series.map(d => d.minutes)),
  }
}

/** Valeur de l'axe vertical : bornes « rondes » et repères réguliers. */
export function niceScale(lo: number, hi: number, wanted = 3): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1 }
  const raw = (hi - lo) / Math.max(1, wanted - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { min, max, ticks }
}

/** Plafond « rond » pour des barres (ex. 2 300 → 2 500). */
export function niceCeil(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step) * step)
}

export interface WeightPoint { day: Day; kg: number; trend: number }
export type WeightRange = '8s' | 'tout'

/** Pesées affichées : les 8 dernières semaines, ou tout l'historique. */
export function weightWindow(points: WeightPoint[], range: WeightRange, today: Day): WeightPoint[] {
  if (range === 'tout') return points
  const win = points.filter(p => daysBetween(p.day, today) <= 56)
  return win.length >= 2 ? win : points.slice(-8)
}

export function weightStats(points: WeightPoint[]) {
  if (!points.length) return null
  const first = points[0], last = points[points.length - 1]
  const r1 = (n: number) => Math.round(n * 10) / 10
  return {
    first, last, count: points.length,
    delta: r1(last.trend - first.trend),
    min: Math.min(...points.map(p => p.kg)),
    max: Math.max(...points.map(p => p.kg)),
  }
}
