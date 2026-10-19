// Poids (pesée hebdomadaire, tendance lissée) et cycle (estimations, jamais de diagnostic).
import type { CycleDay, Weight } from '../data/types'
import { addDays, daysBetween, type Day } from '../lib/dates'

export interface TrendPoint { day: Day; kg: number; trend: number }

/** Moyenne mobile exponentielle : gomme les variations d'eau d'une pesée à l'autre. */
export function weightTrend(weights: Weight[], alpha = 0.5): TrendPoint[] {
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day))
  const out: TrendPoint[] = []
  let t: number | null = null
  for (const w of sorted) {
    const kg = Number(w.kg)
    t = t === null ? kg : alpha * kg + (1 - alpha) * t
    out.push({ day: w.day, kg, trend: Math.round(t * 10) / 10 })
  }
  return out
}

/** Évolution de la tendance sur ~4 semaines, formulée sans jugement. */
export function trendSummary(points: TrendPoint[]): string | null {
  if (points.length < 3) return null
  const last = points[points.length - 1]
  const ref = [...points].reverse().find(p => daysBetween(p.day, last.day) >= 21)
  if (!ref) return null
  const diff = Math.round((last.trend - ref.trend) * 10) / 10
  if (Math.abs(diff) < 0.3) return 'Tendance stable sur le mois. La régularité compte autant que la balance.'
  return diff < 0
    ? `Tendance en légère baisse sur le mois (${diff} kg).`
    : `Tendance en légère hausse sur le mois (+${diff} kg). Une variation normale peut venir de l'eau ou du cycle.`
}

// ------------------------------------------------------------------ cycle
export interface CycleInfo {
  starts: Day[]
  avgCycle: number | null
  avgPeriod: number | null
  nextStart: Day | null
}

export function periodDays(cycle: CycleDay[]): Day[] {
  return cycle.filter(c => c.period).map(c => c.day).sort()
}

export function cycleInfo(cycle: CycleDay[]): CycleInfo {
  const days = periodDays(cycle)
  const starts: Day[] = []
  const lengths: number[] = []
  let runStart: Day | null = null
  let prev: Day | null = null
  for (const d of days) {
    if (!prev || daysBetween(prev, d) > 2) {
      if (runStart && prev) lengths.push(daysBetween(runStart, prev) + 1)
      starts.push(d)
      runStart = d
    }
    prev = d
  }
  if (runStart && prev) lengths.push(daysBetween(runStart, prev) + 1)
  const gaps = starts.slice(1).map((d, i) => daysBetween(starts[i], d)).filter(g => g >= 21 && g <= 45)
  const avgCycle = gaps.length ? Math.round(gaps.slice(-6).reduce((a, b) => a + b, 0) / gaps.slice(-6).length) : null
  const avgPeriod = lengths.length ? Math.round(lengths.slice(-6).reduce((a, b) => a + b, 0) / lengths.slice(-6).length) : null
  const nextStart = avgCycle && starts.length ? addDays(starts[starts.length - 1], avgCycle) : null
  return { starts, avgCycle, avgPeriod, nextStart }
}

/** Jours de règles estimés (pour l'affichage façon calendrier) — toujours présentés comme une estimation. */
export function predictedPeriod(info: CycleInfo): Day[] {
  if (!info.nextStart) return []
  return Array.from({ length: info.avgPeriod ?? 5 }, (_, i) => addDays(info.nextStart!, i))
}

export const SYMPTOMS = ['crampes', 'fatigue', 'ballonnements', 'maux de tête', 'humeur changeante', 'envie de sucré', 'sensibilité', 'peau']
