// Menu de la semaine adapté à l'objectif calorique.
// Pour chaque jour : petit-déjeuner, déjeuner et dîner choisis parmi les recettes (toutes sans porc)
// pour que le total s'approche de l'objectif, en gardant ~10 % pour une collation libre.
// Aucun hasard : le même objectif, la même semaine donnent le même menu (départage par hachage).
import type { MealSlot, PlanSlot } from '../data/types'
import { addDays, type Day } from '../lib/dates'
import { hash } from '../lib/ids'
import { mealTarget } from './nutrition'
import { recipeHasPork } from './pork'
import type { Recipe } from './recipes'

export type Moment = PlanSlot['moment']
export const MOMENTS: { id: Moment; label: string; meal: MealSlot }[] = [
  { id: 'matin', label: 'Matin', meal: 'petit-dejeuner' },
  { id: 'midi', label: 'Midi', meal: 'dejeuner' },
  { id: 'soir', label: 'Soir', meal: 'diner' },
]
export const momentMeal = (m: Moment): MealSlot => MOMENTS.find(x => x.id === m)!.meal
/** Part de l'objectif laissée à la collation (non planifiée). */
export const SNACK_SHARE = 0.1

export const ALLERGENS = ['gluten', 'lait', 'œufs', 'poissons', 'crustacés', 'fruits à coque', 'soja', 'sésame', 'céleri', 'moutarde', 'sulfites'] as const

export interface MenuOptions {
  goal: number
  week: Day
  portions: number
  moments: Moment[]
  /** allergènes à éviter */
  avoid: string[]
  /** recettes déjà au menu à conserver */
  keep: PlanSlot[]
}

const kindFor = (m: Moment): Recipe['moment'] => (m === 'matin' ? 'matin' : 'midi-soir')

/** Recettes utilisables pour un moment (valeurs connues, sans les allergènes évités, sans porc). */
export function candidates(recipes: Recipe[], m: Moment, avoid: string[]): Recipe[] {
  return recipes.filter(r => r.moment === kindFor(m) && r.nutrition && r.nutrition.kcal > 0
    && !r.allergens.some(a => avoid.includes(a)) && !recipeHasPork(r))
}

/** Cible calorique d'un moment, le dîner compensant ce qui est déjà prévu dans la journée. */
export function momentTarget(goal: number, m: Moment, planned: { matin?: number; midi?: number }): number {
  if (m !== 'soir') return mealTarget(goal, momentMeal(m))
  const rest = goal * (1 - SNACK_SHARE) - (planned.matin ?? mealTarget(goal, 'petit-dejeuner')) - (planned.midi ?? mealTarget(goal, 'dejeuner'))
  return Math.max(goal * 0.2, Math.min(goal * 0.45, rest))
}

interface ScoreCtx { target: number; uses: Map<string, number>; yesterday?: string; sameDay: string[]; seed: string; moment: Moment }

function score(r: Recipe, c: ScoreCtx): number {
  const err = Math.abs(r.nutrition!.kcal - c.target) / c.target
  const used = c.uses.get(r.id) ?? 0
  const rep = used * (c.moment === 'matin' ? 0.08 : 0.4)
  const yday = c.yesterday === r.id ? (c.moment === 'matin' ? 0.1 : 0.5) : 0
  const same = c.sameDay.includes(r.id) ? 2 : 0
  return err + rep + yday + same + (hash(c.seed + r.id) / 2 ** 32) * 0.01
}

const kcalOf = (id: string | undefined, recipes: Recipe[]) => (id ? recipes.find(r => r.id === id)?.nutrition?.kcal : undefined)

/** Menu complet de la semaine (recettes conservées + nouvelles). */
export function buildWeekMenu(recipes: Recipe[], o: MenuOptions): PlanSlot[] {
  const out: PlanSlot[] = []
  const uses = new Map<string, number>()
  const days = Array.from({ length: 7 }, (_, i) => addDays(o.week, i))
  for (const k of o.keep) if (days.includes(k.day)) uses.set(k.recipe_id, (uses.get(k.recipe_id) ?? 0) + 1)
  for (const day of days) {
    const planned: { matin?: number; midi?: number } = {}
    const sameDay: string[] = []
    for (const m of MOMENTS.map(x => x.id)) {
      const kept = o.keep.find(k => k.day === day && k.moment === m)
      if (kept) {
        out.push(kept)
        sameDay.push(kept.recipe_id)
        if (m !== 'soir') planned[m] = kcalOf(kept.recipe_id, recipes)
        continue
      }
      if (!o.moments.includes(m)) continue
      const pool = candidates(recipes, m, o.avoid)
      if (!pool.length) continue
      const yesterday = out.find(x => x.day === addDays(day, -1) && x.moment === m)?.recipe_id
      const ctx: ScoreCtx = { target: momentTarget(o.goal, m, planned), uses, yesterday, sameDay, seed: o.week + day + m, moment: m }
      const best = [...pool].sort((a, b) => score(a, ctx) - score(b, ctx))[0]
      out.push({ day, moment: m, recipe_id: best.id, portions: o.portions })
      uses.set(best.id, (uses.get(best.id) ?? 0) + 1)
      sameDay.push(best.id)
      if (m !== 'soir') planned[m] = best.nutrition!.kcal
    }
  }
  return out
}

/** Une autre recette pour ce créneau (la meilleure après celle en place, sans doublon dans la semaine si possible). */
export function swapFor(recipes: Recipe[], slots: PlanSlot[], slot: PlanSlot, goal: number | null, avoid: string[], exclude: string[] = []): string | null {
  const all = candidates(recipes, slot.moment, avoid).filter(r => r.id !== slot.recipe_id)
  if (!all.length) return null
  const fresh = all.filter(r => !exclude.includes(r.id))
  const pool = fresh.length ? fresh : all
  const uses = new Map<string, number>()
  for (const s of slots) uses.set(s.recipe_id, (uses.get(s.recipe_id) ?? 0) + 1)
  const sameDay = slots.filter(s => s.day === slot.day && s.moment !== slot.moment).map(s => s.recipe_id)
  const planned = {
    matin: kcalOf(slots.find(s => s.day === slot.day && s.moment === 'matin')?.recipe_id, recipes),
    midi: kcalOf(slots.find(s => s.day === slot.day && s.moment === 'midi')?.recipe_id, recipes),
  }
  const current = kcalOf(slot.recipe_id, recipes) ?? 500
  const target = goal ? momentTarget(goal, slot.moment, planned) : current
  // `exclude` : recettes déjà proposées à ce créneau, pour faire défiler les idées.
  const ctx: ScoreCtx = { target, uses, sameDay, seed: slot.day + slot.moment + slot.recipe_id, moment: slot.moment }
  return [...pool].sort((a, b) => score(a, ctx) - score(b, ctx))[0].id
}

/** Calories prévues pour UNE portion de chaque recette d'une journée. */
export function plannedKcal(recipes: Recipe[], slots: PlanSlot[], day: Day): { kcal: number; unknown: number } {
  let kcal = 0
  let unknown = 0
  for (const s of slots.filter(x => x.day === day)) {
    const k = kcalOf(s.recipe_id, recipes)
    if (k === undefined) unknown++
    else kcal += k
  }
  return { kcal: Math.round(kcal), unknown }
}
