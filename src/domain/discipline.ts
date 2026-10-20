// Régularité : reprises, horaires favorables, durées terminées, habitudes qui s'installent.
// Uniquement des faits tirés des données enregistrées ; aucun score global.
import type { Commitment, Snapshot } from '../data/types'
import { addDays, isoWeekday, weekStart, type Day, daysBetween } from '../lib/dates'
import { dayRitual, sportCommitment } from './ritual'

// ------------------------------------------------------------------ habitudes du jour
export type HabitState = 'usual' | 'min' | 'none'

/** Millilitres d'une entrée d'eau (les plus anciennes ne connaissent que les verres de 25 cl). */
export const entryMl = (w: { ml?: number | null; glasses: number }) => (typeof w.ml === 'number' && w.ml > 0 ? w.ml : w.glasses * 250)

/** Eau bue un jour donné, en millilitres. */
export function waterMl(s: Snapshot, day: Day): number {
  return s.water_logs.filter(w => w.day === day).reduce((n, w) => n + entryMl(w), 0)
}

/** Objectif d'eau en millilitres (2 L par défaut). */
export function waterGoalMl(s: Snapshot): number {
  const p = s.profiles[0]
  return p?.water_goal_ml ?? 2000
}

export const waterReached = (s: Snapshot, day: Day) => waterMl(s, day) >= waterGoalMl(s)

/** « 0,75 L » — deux décimales sous 1 L si besoin, sinon une. */
export function formatLitres(ml: number, digits?: number): string {
  const d = digits ?? (ml % 100 === 0 ? 1 : 2)
  return (ml / 1000).toFixed(d).replace('.', ',') + ' L'
}

/** Jours où un repas est noté (journal alimentaire ou anciens repas qualitatifs). */
export function foodDays(s: Snapshot): Set<Day> {
  const set = new Set<Day>()
  for (const m of s.meals) set.add(m.day)
  for (const f of s.food_entries) set.add(f.day)
  return set
}

export const hasFoodOn = (s: Snapshot, day: Day) => s.food_entries.some(f => f.day === day) || s.meals.some(m => m.day === day)

/** Nombre de repas distincts notés un jour donné. */
export function mealsCountOn(s: Snapshot, day: Day): number {
  const slots = new Set<string>()
  for (const f of s.food_entries) if (f.day === day) slots.add(f.meal)
  for (const m of s.meals) if (m.day === day) slots.add('ancien:' + m.id)
  return slots.size
}

/** Recettes cuisinées et notées : { jour, recette, heure }, toutes sources confondues. */
export function recipeLogs(s: Snapshot): { day: Day; recipe_id: string; at: string }[] {
  const out: { day: Day; recipe_id: string; at: string }[] = []
  for (const m of s.meals) if (m.recipe_id) out.push({ day: m.day, recipe_id: m.recipe_id, at: m.at })
  for (const f of s.food_entries) if (f.source === 'recette' && f.ref) out.push({ day: f.day, recipe_id: f.ref, at: f.at })
  return out
}

/** Un fruit ou des légumes notés ce jour-là. */
export function fruitOrVegOn(s: Snapshot, day: Day): boolean {
  if (s.meals.some(m => m.day === day && (m.markers.includes('fruit') || m.markers.includes('legumes')))) return true
  return s.food_entries.some(f => f.day === day && (f.category === 'legumes' || f.category === 'fruits' || (f.details.markers ?? []).some(k => k === 'fruit' || k === 'legumes')))
}

/** État d'une habitude un jour donné : déduit des données pour sport/eau/repas, coché à la main sinon. */
export function habitState(s: Snapshot, c: Commitment, day: Day): HabitState {
  if (c.kind === 'sport') {
    const r = dayRitual(s, day, day)
    return r.version === 'usual' || r.version === 'plus' ? 'usual' : r.version === 'min' ? 'min' : 'none'
  }
  if (c.kind === 'eau') {
    const ml = waterMl(s, day)
    return ml >= waterGoalMl(s) ? 'usual' : ml > 0 ? 'min' : 'none'
  }
  if (c.kind === 'repas') {
    const n = mealsCountOn(s, day)
    return n >= 2 ? 'usual' : n >= 1 ? 'min' : 'none'
  }
  const check = s.habit_checks.find(h => h.commitment_id === c.id && h.day === day)
  return check ? check.version : 'none'
}

export function isHabitDay(c: Commitment, day: Day) {
  return c.active && c.days.includes(isoWeekday(day))
}

// ------------------------------------------------------------------ reprises
/** Jours où un rendez-vous a été honoré après au moins 2 rendez-vous manqués d'affilée. */
export function reprises(s: Snapshot, today: Day, lookback = 365): Day[] {
  const c = sportCommitment(s)
  if (!c) return []
  const first = s.commitments.map(x => x.created_at).filter(Boolean).sort()[0]
  let start = addDays(today, -lookback)
  if (first && first.slice(0, 10) > start) start = first.slice(0, 10)
  const out: Day[] = []
  let missedRun = 0
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const r = dayRitual(s, d, today)
    if (!r.scheduled && r.status !== 'honore') continue
    if (r.status === 'manque') missedRun++
    else if (r.status === 'honore') { if (missedRun >= 2) out.push(d); missedRun = 0 }
    // repos et petits pas ne cassent pas la série et ne la remettent pas à zéro
  }
  return out
}

export interface ResumeState {
  needed: boolean
  missedRendezvous: number
  daysAway: number
}

/** Faut-il proposer l'écran « reprise » ? (2 rendez-vous manqués d'affilée, ou 3 jours sans ouvrir l'appli) */
export function resumeState(s: Snapshot, today: Day): ResumeState {
  const c = sportCommitment(s)
  let missed = 0
  for (let i = 1; i <= 14 && c; i++) {
    const d = addDays(today, -i)
    const r = dayRitual(s, d, today)
    if (!r.scheduled && r.status !== 'honore') continue
    if (r.status === 'manque') missed++
    else if (r.status === 'repos' || r.status === 'petit-pas') continue
    else break
  }
  const previous = s.day_presence.map(p => p.day).filter(d => d < today).sort().pop()
  const daysAway = previous ? daysBetween(previous, today) : 0
  const todayDone = dayRitual(s, today, today).status === 'honore'
  return { needed: !todayDone && (missed >= 2 || daysAway >= 3), missedRendezvous: missed, daysAway }
}

// ------------------------------------------------------------------ moments et durées
export type TimeSlot = 'matin' | 'midi' | 'apres-midi' | 'fin-de-journee' | 'soir'
export const SLOT_LABELS: Record<TimeSlot, string> = {
  matin: 'le matin', midi: 'le midi', 'apres-midi': "l'après-midi", 'fin-de-journee': 'en fin de journée', soir: 'le soir',
}

export function slotOf(iso: string): TimeSlot {
  const h = new Date(iso).getHours()
  if (h < 11) return 'matin'
  if (h < 14) return 'midi'
  if (h < 17) return 'apres-midi'
  if (h < 19) return 'fin-de-journee'
  return 'soir'
}

export function bestSlots(s: Snapshot, from: Day, to: Day) {
  const counts = new Map<TimeSlot, number>()
  for (const w of s.workouts) {
    if (!w.completed || w.day < from || w.day > to) continue
    const slot = slotOf(w.started_at)
    counts.set(slot, (counts.get(slot) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return { total, slots: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slot, n]) => ({ slot, n, share: n / total })) }
}

export type DurationBucket = 'court' | 'moyen' | 'long'
export const BUCKET_LABELS: Record<DurationBucket, string> = { court: '15 min ou moins', moyen: '16 à 25 min', long: 'plus de 25 min' }
export function bucketOf(minutes: number): DurationBucket {
  return minutes <= 15 ? 'court' : minutes <= 25 ? 'moyen' : 'long'
}

/** Séances guidées commencées vs terminées, par durée prévue. */
export function completionByDuration(s: Snapshot, from: Day, to: Day) {
  const out: Record<DurationBucket, { started: number; finished: number }> = {
    court: { started: 0, finished: 0 }, moyen: { started: 0, finished: 0 }, long: { started: 0, finished: 0 },
  }
  for (const w of s.workouts) {
    if (w.kind !== 'guidee' || !w.planned_minutes || w.day < from || w.day > to) continue
    const b = out[bucketOf(w.planned_minutes)]
    b.started++
    if (w.completed && w.actual_minutes >= w.planned_minutes * 0.8) b.finished++
  }
  return out
}

// ------------------------------------------------------------------ automatisme
export type Automaticity = 'automatique' | 'en-bonne-voie' | 'a-renforcer' | 'trop-tot'

/** Sur les 6 dernières semaines complètes : une semaine « tenue » = au moins 80 % des jours prévus faits (version mini comprise). */
export function automaticity(s: Snapshot, c: Commitment, today: Day): { level: Automaticity; weeksHeld: number; weeksCounted: number } {
  const createdDay = c.created_at ? c.created_at.slice(0, 10) : today
  let held = 0
  let counted = 0
  const thisWeek = weekStart(today)
  for (let w = 1; w <= 6; w++) {
    const ws = addDays(thisWeek, -7 * w)
    if (addDays(ws, 6) < createdDay) continue
    let planned = 0, done = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i)
      if (d < createdDay || !isHabitDay(c, d)) continue
      if (c.kind === 'sport' && dayRitual(s, d, today).status === 'repos' && dayRitual(s, d, today).restReason !== 'pas_envie') continue
      planned++
      if (habitState(s, c, d) !== 'none') done++
    }
    if (!planned) continue
    counted++
    if (done / planned >= 0.8) held++
  }
  if (counted < 3) return { level: 'trop-tot', weeksHeld: held, weeksCounted: counted }
  const ratio = held / counted
  return { level: ratio >= 0.66 ? 'automatique' : ratio >= 0.34 ? 'en-bonne-voie' : 'a-renforcer', weeksHeld: held, weeksCounted: counted }
}

/** Jours où au moins une action a été enregistrée (séance, eau, repas, check-in, habitude). */
export function activeDays(s: Snapshot): Set<Day> {
  const set = new Set<Day>()
  for (const w of s.workouts) set.add(w.day)
  for (const w of s.water_logs) set.add(w.day)
  for (const d of foodDays(s)) set.add(d)
  for (const c of s.daily_checkins) set.add(c.day)
  for (const h of s.habit_checks) set.add(h.day)
  return set
}

/** Semaines « actives » : au moins 3 jours avec une action. */
export function activeWeeks(s: Snapshot): number {
  const perWeek = new Map<Day, number>()
  for (const d of activeDays(s)) perWeek.set(weekStart(d), (perWeek.get(weekStart(d)) ?? 0) + 1)
  return [...perWeek.values()].filter(n => n >= 3).length
}

/**
 * Part des engagements tenus sur une période (version minimale comprise), toutes habitudes
 * confondues. Les repos choisis pour fatigue ou imprévu ne comptent pas comme des jours prévus.
 * Le jour en cours n'est compté que s'il est déjà tenu (il n'est pas fini).
 */
export function commitmentRate(s: Snapshot, from: Day, to: Day, today: Day): { planned: number; done: number; rate: number | null } {
  let planned = 0, done = 0
  for (const c of s.commitments) {
    if (!c.active) continue
    const createdDay = c.created_at ? c.created_at.slice(0, 10) : from
    for (let d = from < createdDay ? createdDay : from; d <= to && d <= today; d = addDays(d, 1)) {
      if (!isHabitDay(c, d)) continue
      if (c.kind === 'sport') {
        const r = dayRitual(s, d, today)
        if (r.status === 'repos' && r.restReason !== 'pas_envie') continue
      }
      const ok = habitState(s, c, d) !== 'none'
      if (d === today && !ok) continue
      planned++
      if (ok) done++
    }
  }
  return { planned, done, rate: planned ? done / planned : null }
}
