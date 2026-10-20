// Objectif calorique et totaux du journal alimentaire.
// Règles fixées avec l'utilisatrice :
//  - objectif automatique (Mifflin-St Jeor × activité, rythme modéré par défaut), modifiable à la main ;
//  - jamais en dessous d'un plancher de sécurité (1 200 kcal femme / 1 500 kcal homme, et jamais sous le métabolisme de base) ;
//  - l'objectif ne baisse JAMAIS les jours de faible énergie et les calories du sport ne sont pas déduites ;
//  - au-delà de l'objectif, l'affichage reste neutre (pas de rouge, pas de « dépassement »).
import type { FoodEntry, MealSlot, NutritionSettings, Nutrients, Snapshot } from '../data/types'
import type { Day } from '../lib/dates'

export const MEALS: { id: MealSlot; label: string; share: number; emoji: string }[] = [
  { id: 'petit-dejeuner', label: 'Petit-déjeuner', share: 0.25, emoji: '☀️' },
  { id: 'dejeuner', label: 'Déjeuner', share: 0.35, emoji: '🍽️' },
  { id: 'collation', label: 'Collation', share: 0.10, emoji: '🍎' },
  { id: 'diner', label: 'Dîner', share: 0.30, emoji: '🌙' },
]
export const mealLabel = (m: MealSlot) => MEALS.find(x => x.id === m)?.label ?? m
/** « au déjeuner », « à la collation » */
export const toMeal = (m: MealSlot) => (m === 'collation' ? 'à la collation' : 'au ' + mealLabel(m).toLowerCase())

export const ACTIVITY: Record<NonNullable<NutritionSettings['activity']>, { label: string; hint: string; factor: number }> = {
  sedentaire: { label: 'Peu active', hint: 'Travail assis, peu de marche', factor: 1.2 },
  leger: { label: 'Légèrement active', hint: 'Debout une partie de la journée ou 1 à 3 séances par semaine', factor: 1.375 },
  modere: { label: 'Active', hint: 'Souvent debout ou 3 à 5 séances par semaine', factor: 1.55 },
  actif: { label: 'Très active', hint: 'Métier physique ou sport presque tous les jours', factor: 1.725 },
}

export const PACE: Record<NonNullable<NutritionSettings['pace']>, { label: string; hint: string; delta: number }> = {
  maintien: { label: 'Maintien', hint: 'Garder le poids actuel', delta: 0 },
  doux: { label: 'Rythme doux', hint: 'Environ −250 kcal par jour', delta: -250 },
  modere: { label: 'Rythme modéré', hint: 'Environ −500 kcal par jour (recommandé)', delta: -500 },
}

/** Dernier poids connu : pesée la plus récente, sinon poids de référence saisi. */
export function currentWeight(s: Snapshot): number | null {
  const last = [...s.weights].sort((a, b) => b.day.localeCompare(a.day))[0]
  return last?.kg ?? s.profiles[0]?.settings.nutrition?.weightKg ?? null
}

export interface GoalDetail {
  /** objectif retenu (kcal / jour) ou null si les informations manquent */
  goal: number | null
  source: 'manuel' | 'calcul' | 'incomplet'
  bmr: number | null
  tdee: number | null
  floor: number | null
  /** vrai si le plancher a relevé l'objectif calculé */
  floored: boolean
  missing: string[]
}

export function bmrMifflin(sex: 'F' | 'H', kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'H' ? 5 : -161)
}

export function calorieGoal(s: Snapshot, today: Day): GoalDetail {
  const n = s.profiles[0]?.settings.nutrition ?? {}
  const kg = currentWeight(s)
  const missing: string[] = []
  if (!n.birthYear) missing.push('année de naissance')
  if (!n.heightCm) missing.push('taille')
  if (!kg) missing.push('poids')
  const sex = n.sex ?? 'F'
  let bmr: number | null = null, tdee: number | null = null, floor: number | null = null, computed: number | null = null, floored = false
  if (!missing.length) {
    const age = Number(today.slice(0, 4)) - n.birthYear!
    bmr = Math.round(bmrMifflin(sex, kg!, n.heightCm!, age))
    tdee = Math.round(bmr * ACTIVITY[n.activity ?? 'sedentaire'].factor)
    floor = Math.max(sex === 'H' ? 1500 : 1200, bmr)
    const raw = tdee + PACE[n.pace ?? 'modere'].delta
    floored = raw < floor
    computed = roundTo(Math.max(raw, floor), 10)
  }
  if (n.manualGoal && n.manualGoal >= 800) return { goal: Math.round(n.manualGoal), source: 'manuel', bmr, tdee, floor, floored: false, missing }
  return { goal: computed, source: computed ? 'calcul' : 'incomplet', bmr, tdee, floor, floored, missing }
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step

export interface MacroTargets { protein: number; carbs: number; fat: number; fiber: number }
/** Répartition indicative : 25 % protéines, 45 % glucides, 30 % lipides ; 30 g de fibres. */
export function macroTargets(goal: number): MacroTargets {
  return { protein: Math.round(goal * 0.25 / 4), carbs: Math.round(goal * 0.45 / 4), fat: Math.round(goal * 0.30 / 9), fiber: 30 }
}

export function mealTarget(goal: number, meal: MealSlot): number {
  return roundTo(goal * (MEALS.find(m => m.id === meal)?.share ?? 0.25), 5)
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

export function sumEntries(entries: Pick<FoodEntry, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'>[]): Nutrients {
  const t = entries.reduce((acc, e) => ({
    kcal: acc.kcal + (e.kcal || 0), protein: acc.protein + (e.protein || 0), carbs: acc.carbs + (e.carbs || 0),
    fat: acc.fat + (e.fat || 0), fiber: acc.fiber + (e.fiber || 0),
  }), { ...ZERO })
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), fiber: r1(t.fiber) }
}

export const entriesOn = (s: Snapshot, day: Day) => s.food_entries.filter(f => f.day === day).sort((a, b) => a.at.localeCompare(b.at))
export const dayTotals = (s: Snapshot, day: Day) => sumEntries(entriesOn(s, day))

/** Valeurs pour une quantité donnée, à partir de valeurs pour 100 g (ou 100 ml). */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const k = grams / 100
  return { kcal: Math.round(per100.kcal * k), protein: r1(per100.protein * k), carbs: r1(per100.carbs * k), fat: r1(per100.fat * k), fiber: r1(per100.fiber * k), sugar: per100.sugar !== undefined ? r1(per100.sugar * k) : undefined }
}

export function multiply(n: Nutrients, f: number): Nutrients {
  return { kcal: Math.round(n.kcal * f), protein: r1(n.protein * f), carbs: r1(n.carbs * f), fat: r1(n.fat * f), fiber: r1(n.fiber * f), sugar: n.sugar !== undefined ? r1(n.sugar * f) : undefined }
}

const r1 = (x: number) => Math.round(x * 10) / 10

/** Texte du reste à manger — neutre au-delà de l'objectif. */
export function remainingText(eaten: number, goal: number | null): { big: string; small: string } {
  if (!goal) return { big: fmtKcal(eaten), small: 'mangées aujourd\'hui' }
  const left = goal - eaten
  if (left >= 0) return { big: fmtKcal(left), small: 'restantes' }
  return { big: fmtKcal(eaten), small: `notées sur ${fmtKcal(goal)} prévues` }
}

export const fmtKcal = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} kcal`
export const fmtG = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('fr-FR')} g`

/** Moment de repas suggéré selon l'heure. */
export function defaultMealSlot(d: Date = new Date()): MealSlot {
  const h = d.getHours()
  return h < 10.5 ? 'petit-dejeuner' : h < 15 ? 'dejeuner' : h < 18 ? 'collation' : 'diner'
}
