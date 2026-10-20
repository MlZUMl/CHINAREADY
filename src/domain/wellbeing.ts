// Progrès hors balance : mensurations, sommeil, énergie, et bilan du mois qui croise les données.
// Les croisements sont des observations (« ce que montrent tes données »), jamais des causes ni des diagnostics,
// et ne s'affichent qu'avec assez de jours de chaque côté.
import type { BodyMeasurement, Snapshot } from '../data/types'
import { addDays, MONTHS, type Day } from '../lib/dates'
import { rendezvousStats } from './ritual'
import { waterReached } from './discipline'
import { calorieGoal, dayTotals } from './nutrition'
import { weightTrend } from './body'

export type MeasureKey = 'waist_cm' | 'hips_cm' | 'chest_cm' | 'thigh_cm' | 'arm_cm'
export const MEASURES: { key: MeasureKey; label: string; short: string; hint: string; min: number; max: number; start: number }[] = [
  { key: 'waist_cm', label: 'Tour de taille', short: 'Taille', hint: 'Au niveau du nombril, ventre détendu, après avoir expiré', min: 40, max: 200, start: 80 },
  { key: 'hips_cm', label: 'Tour de hanches', short: 'Hanches', hint: 'Au plus large des fesses, pieds joints', min: 50, max: 200, start: 100 },
  { key: 'chest_cm', label: 'Tour de poitrine', short: 'Poitrine', hint: 'Sous les bras, au plus fort de la poitrine', min: 50, max: 200, start: 92 },
  { key: 'thigh_cm', label: 'Tour de cuisse', short: 'Cuisse', hint: 'Au plus large, toujours la même jambe', min: 25, max: 120, start: 58 },
  { key: 'arm_cm', label: 'Tour de bras', short: 'Bras', hint: 'À mi-hauteur entre l\'épaule et le coude, bras relâché', min: 15, max: 80, start: 30 },
]

export const SLEEP_QUALITY: Record<1 | 2 | 3 | 4 | 5, string> = { 1: 'Très mauvaise', 2: 'Agitée', 3: 'Correcte', 4: 'Bonne', 5: 'Excellente' }

const r1 = (n: number) => Math.round(n * 10) / 10
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
/** 7,5 → « 7 h 30 » */
export function fmtHours(h: number): string {
  const m = Math.round(h * 60)
  const hh = Math.floor(m / 60), mm = m % 60
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`
}
/** −2,5 cm / +1 cm */
export const fmtDiff = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${String(Math.abs(r1(n))).replace('.', ',')} ${unit}`

export function measureSeries(rows: BodyMeasurement[], key: MeasureKey): { day: Day; value: number }[] {
  return rows.filter(r => r[key] != null).sort((a, b) => a.day.localeCompare(b.day)).map(r => ({ day: r.day, value: Number(r[key]) }))
}

/** Évolution d'une mesure entre deux dates (première et dernière mesure de la période). */
export function measureChange(rows: BodyMeasurement[], key: MeasureKey, from?: Day, to?: Day) {
  const s = measureSeries(rows, key).filter(p => (!from || p.day >= from) && (!to || p.day <= to))
  if (!s.length) return null
  const first = s[0], last = s[s.length - 1]
  return { first, last, diff: r1(last.value - first.value), count: s.length }
}

export const lastMeasurement = (rows: BodyMeasurement[]) => [...rows].sort((a, b) => b.day.localeCompare(a.day))[0] ?? null

/** Sommeil et énergie sur une période. Le sommeil est noté le matin pour la nuit précédente. */
export function sleepEnergy(s: Snapshot, from: Day, to: Day) {
  const rows = s.daily_checkins.filter(c => c.day >= from && c.day <= to)
  const hours = rows.map(c => c.sleep_hours).filter((h): h is number => h != null).map(Number)
  const quality = rows.map(c => c.sleep_quality).filter((q): q is NonNullable<typeof q> => q != null)
  const energy = rows.map(c => c.energy).filter((e): e is NonNullable<typeof e> => e != null)
  return {
    sleepAvg: hours.length ? r1(avg(hours)!) : null, sleepNights: hours.length,
    qualityAvg: quality.length ? r1(avg(quality)!) : null,
    energyAvg: energy.length ? r1(avg(energy)!) : null, energyDays: energy.length,
  }
}

export interface Crossing { key: string; text: string }
const MIN_EACH = 3

/** Croisements entre sommeil, séances et énergie sur la période (observations seulement). */
export function crossings(s: Snapshot, from: Day, to: Day): Crossing[] {
  const out: Crossing[] = []
  const ck = new Map(s.daily_checkins.map(c => [c.day, c]))
  const trained = (d: Day) => s.workouts.some(w => w.day === d && w.completed && w.actual_minutes >= 5)
  const days: Day[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  const fmtE = (n: number) => String(r1(n)).replace('.', ',')

  // 1. Nuit de 7 h ou plus → énergie du jour
  const long: number[] = [], short: number[] = []
  for (const d of days) {
    const c = ck.get(d)
    if (c?.sleep_hours == null || c.energy == null) continue
    ;(Number(c.sleep_hours) >= 7 ? long : short).push(c.energy)
  }
  if (long.length >= MIN_EACH && short.length >= MIN_EACH && Math.abs(avg(long)! - avg(short)!) >= 0.5) {
    out.push({ key: 'sommeil-energie', text: `Après une nuit de 7 h ou plus, ton énergie était en moyenne de ${fmtE(avg(long)!)}/5, contre ${fmtE(avg(short)!)}/5 après une nuit plus courte.` })
  }
  // 2. Séance → énergie du lendemain
  const after: number[] = [], none: number[] = []
  for (const d of days) {
    const e = ck.get(addDays(d, 1))?.energy
    if (e == null || addDays(d, 1) > to) continue
    ;(trained(d) ? after : none).push(e)
  }
  if (after.length >= MIN_EACH && none.length >= MIN_EACH && Math.abs(avg(after)! - avg(none)!) >= 0.5) {
    out.push({ key: 'seance-energie', text: `Le lendemain d'une séance, ton énergie était en moyenne de ${fmtE(avg(after)!)}/5, contre ${fmtE(avg(none)!)}/5 les autres jours.` })
  }
  // 3. Séance → sommeil de la nuit suivante
  const sAfter: number[] = [], sNone: number[] = []
  for (const d of days) {
    const h = ck.get(addDays(d, 1))?.sleep_hours
    if (h == null || addDays(d, 1) > to) continue
    ;(trained(d) ? sAfter : sNone).push(Number(h))
  }
  if (sAfter.length >= MIN_EACH && sNone.length >= MIN_EACH && Math.abs(avg(sAfter)! - avg(sNone)!) >= 0.33) {
    out.push({ key: 'seance-sommeil', text: `Les nuits qui suivent une séance, tu as dormi en moyenne ${fmtHours(avg(sAfter)!)}, contre ${fmtHours(avg(sNone)!)} les autres nuits.` })
  }
  return out
}

export interface MonthReview {
  label: string
  from: Day
  to: Day
  days: number
  sessions: number
  minutes: number
  honored: number
  planned: number
  foodDays: number
  avgKcal: number | null
  goal: number | null
  waterDays: number
  sleepAvg: number | null
  sleepNights: number
  energyAvg: number | null
  weight: { start: number; end: number; diff: number } | null
  measures: { label: string; diff: number; last: number }[]
  crossings: Crossing[]
}

/** Bilan d'un mois (« 2026-10 »), arrêté à aujourd'hui pour le mois en cours. */
export function monthReview(s: Snapshot, month: string, today: Day): MonthReview {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01` as Day
  const end = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01` as Day, -1)
  const to = end > today ? today : end
  const inMonth = <T extends { day: Day }>(xs: T[]) => xs.filter(x => x.day >= from && x.day <= to)
  const workouts = inMonth(s.workouts).filter(w => w.completed)
  const rdv = rendezvousStats(s, from, to, today)
  const dayList: Day[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) dayList.push(d)
  const foodDays = dayList.filter(d => new Set(s.food_entries.filter(f => f.day === d && f.kcal > 0).map(f => f.meal)).size >= 2)
  const kcal = avg(foodDays.map(d => dayTotals(s, d).kcal))
  const se = sleepEnergy(s, from, to)
  const trend = weightTrend(s.weights).filter(p => p.day >= from && p.day <= to)
  const measures = MEASURES.map(mm => ({ mm, ch: measureChange(s.body_measurements, mm.key, from, to) }))
    .filter(x => x.ch && x.ch.count >= 2).map(x => ({ label: x.mm.label, diff: x.ch!.diff, last: x.ch!.last.value }))
  return {
    label: `${MONTHS[m - 1]} ${y}`, from, to, days: dayList.length,
    sessions: workouts.length, minutes: workouts.reduce((n, w) => n + w.actual_minutes, 0),
    honored: rdv.honored, planned: rdv.scheduled - (rdv.rests - rdv.restsNoDesire),
    foodDays: foodDays.length, avgKcal: kcal === null ? null : Math.round(kcal), goal: calorieGoal(s, today).goal,
    waterDays: dayList.filter(d => waterReached(s, d)).length,
    sleepAvg: se.sleepAvg, sleepNights: se.sleepNights, energyAvg: se.energyAvg,
    weight: trend.length >= 2 ? { start: trend[0].trend, end: trend[trend.length - 1].trend, diff: r1(trend[trend.length - 1].trend - trend[0].trend) } : null,
    measures, crossings: crossings(s, from, to),
  }
}

export const monthOf = (d: Day) => d.slice(0, 7)
export function shiftMonth(month: string, k: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
