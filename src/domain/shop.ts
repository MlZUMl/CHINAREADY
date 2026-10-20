// Points et boutique de personnalisation des compagnons.
//
// GAINS (une seule fois par jour et par objectif, attribués seulement quand l'action est réellement validée)
//   séance du jour (rendez-vous honoré, version minimale comprise) ... 300
//   calories notées (au moins 2 repas du journal avec des calories) .. 50
//   objectif d'eau atteint ............................................ 50
//   => 400 points au plus par jour.
//   Bonus de régularité : +200 une fois par semaine dès 3 « journées complètes » (les 3 objectifs).
//   3 jours sur 7 suffisent : manquer quelques jours ne fait rien perdre.
// Aucun point ne se perd, n'expire ou ne se retire. Pas de série à protéger.
//
// Anti-abus : les points d'un jour ne sont attribués que ce jour-là ou le lendemain (rattrapage
// d'un oubli de saisie). Remplir le journal d'il y a trois semaines ne rapporte rien.
//
// PRIX (repères : une semaine régulière ≈ 1 500 à 2 200 points)
//   Commun   300 – 500   : 1 à 2 jours (la première séance suffit pour le premier objet)
//   Rare     1 200 – 1 800 : environ 1 semaine régulière
//   Premium  3 500 – 8 000 : 2 à 5 semaines — des objectifs à moyen terme
//   Collection complète ≈ 45 000 points : 5 à 7 mois de régularité, ~4 mois au maximum.
// Chaque semaine, un objet rare ou premium est en « sélection » à −20 % pour varier la vitrine.
import type { Snapshot } from '../data/types'
import { addDays, weekStart, type Day } from '../lib/dates'
import { hash } from '../lib/ids'
import { dayRitual } from './ritual'
import { waterReached } from './discipline'

export const DAILY_POINTS = { seance: 300, calories: 50, eau: 50 } as const
export const WEEKLY_BONUS = 200
export const WEEKLY_BONUS_DAYS = 3
export type DailyGoal = keyof typeof DAILY_POINTS

export const GOAL_LABELS: Record<DailyGoal, string> = {
  seance: 'Séance du jour',
  calories: 'Calories notées',
  eau: 'Objectif d\'eau',
}
export const GOAL_HINTS: Record<DailyGoal, string> = {
  seance: 'Rendez-vous honoré, la version minimale compte',
  calories: 'Au moins 2 repas notés avec leurs calories',
  eau: 'Ton objectif en litres atteint',
}

/** Objectifs réellement validés un jour donné. */
export function goalsDone(s: Snapshot, day: Day): Record<DailyGoal, boolean> {
  const meals = new Set(s.food_entries.filter(f => f.day === day && f.kcal > 0).map(f => f.meal))
  return {
    seance: dayRitual(s, day, day).status === 'honore',
    calories: meals.size >= 2,
    eau: waterReached(s, day),
  }
}

export const pointsGrantId = (goal: DailyGoal, day: Day) => `points:${goal}:${day}`
export const weeklyBonusId = (week: Day) => `points:bonus-semaine:${week}`

export interface PointsSpec { id: string; ref: string; points: number; reason: string }

/** Points à attribuer maintenant (fenêtre : aujourd'hui et hier ; bonus de la semaine en cours ou de la précédente). */
export function expectedPoints(s: Snapshot, today: Day): PointsSpec[] {
  const out: PointsSpec[] = []
  for (const day of [addDays(today, -1), today]) {
    const done = goalsDone(s, day)
    for (const goal of Object.keys(DAILY_POINTS) as DailyGoal[]) {
      if (done[goal]) out.push({ id: pointsGrantId(goal, day), ref: goal, points: DAILY_POINTS[goal], reason: GOAL_LABELS[goal] })
    }
  }
  // Bonus de régularité : 3 journées complètes dans la semaine (jours déjà récompensés compris).
  const weeks = new Set([weekStart(today), weekStart(addDays(today, -1))])
  for (const week of weeks) {
    if (completeDays(s, week, today) >= WEEKLY_BONUS_DAYS) out.push({ id: weeklyBonusId(week), ref: 'bonus-semaine', points: WEEKLY_BONUS, reason: 'Bonus de régularité' })
  }
  return out
}

/** Journées complètes (3 objectifs récompensés) d'une semaine, d'après les points acquis + le jour en cours. */
export function completeDays(s: Snapshot, week: Day, today: Day): number {
  const got = new Set(s.reward_grants.filter(g => g.kind === 'points').map(g => g.id))
  let n = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i)
    if (d > today) break
    const recent = d >= addDays(today, -1)
    const done = recent ? goalsDone(s, d) : null
    const all = (Object.keys(DAILY_POINTS) as DailyGoal[]).every(g => got.has(pointsGrantId(g, d)) || Boolean(done?.[g]))
    if (all) n++
  }
  return n
}

export function pointsEarned(s: Snapshot): number {
  return s.reward_grants.reduce((n, g) => n + (g.kind === 'points' ? g.points ?? 0 : 0), 0)
}
export function pointsSpent(s: Snapshot): number {
  return s.shop_purchases.reduce((n, p) => n + p.price, 0)
}
/** Solde affiché (jamais négatif, même après un conflit entre deux appareils). */
export function balance(s: Snapshot): number {
  return Math.max(0, pointsEarned(s) - pointsSpent(s))
}
export function pointsToday(s: Snapshot, day: Day): number {
  return s.reward_grants.filter(g => g.kind === 'points' && g.id.endsWith(':' + day) && !g.id.includes('bonus')).reduce((n, g) => n + (g.points ?? 0), 0)
}

// ------------------------------------------------------------------ catalogue
export type Slot = 'tenue' | 'coiffure' | 'accessoire'
export type Tier = 'commun' | 'rare' | 'premium'
export interface ShopItem { id: string; name: string; slot: Slot; tier: Tier; price: number }

export const SLOT_LABELS: Record<Slot, string> = { tenue: 'Tenues', coiffure: 'Coiffures', accessoire: 'Accessoires' }
export const TIER_LABELS: Record<Tier, string> = { commun: 'Commun', rare: 'Rare', premium: 'Premium' }

export const SHOP: ShopItem[] = [
  // Tenues
  { id: 't-shirt-sport', name: 'T-shirt de sport', slot: 'tenue', tier: 'commun', price: 300 },
  { id: 'debardeur', name: 'Débardeur rayé', slot: 'tenue', tier: 'commun', price: 400 },
  { id: 'sweat', name: 'Sweat à capuche', slot: 'tenue', tier: 'commun', price: 500 },
  { id: 'mariniere', name: 'Marinière', slot: 'tenue', tier: 'rare', price: 1200 },
  { id: 'salopette', name: 'Salopette', slot: 'tenue', tier: 'rare', price: 1500 },
  { id: 'kimono', name: 'Kimono fleuri', slot: 'tenue', tier: 'rare', price: 1800 },
  { id: 'robe-soiree', name: 'Robe de soirée', slot: 'tenue', tier: 'premium', price: 3500 },
  { id: 'tenue-etoilee', name: 'Tenue étoilée', slot: 'tenue', tier: 'premium', price: 6000 },
  // Coiffures
  { id: 'frange', name: 'Petite frange', slot: 'coiffure', tier: 'commun', price: 300 },
  { id: 'meche', name: 'Mèche rebelle', slot: 'coiffure', tier: 'commun', price: 400 },
  { id: 'couettes', name: 'Couettes', slot: 'coiffure', tier: 'commun', price: 500 },
  { id: 'chignon', name: 'Chignon', slot: 'coiffure', tier: 'rare', price: 1200 },
  { id: 'boucles', name: 'Boucles', slot: 'coiffure', tier: 'rare', price: 1500 },
  { id: 'tresse', name: 'Longue tresse', slot: 'coiffure', tier: 'rare', price: 1800 },
  { id: 'carre', name: 'Carré lisse', slot: 'coiffure', tier: 'premium', price: 3500 },
  { id: 'meches-arc-en-ciel', name: 'Mèches arc-en-ciel', slot: 'coiffure', tier: 'premium', price: 6000 },
  // Accessoires
  { id: 'bandeau', name: 'Bandeau de sport', slot: 'accessoire', tier: 'commun', price: 350 },
  { id: 'noeud-papillon', name: 'Nœud papillon', slot: 'accessoire', tier: 'commun', price: 450 },
  { id: 'casquette', name: 'Casquette', slot: 'accessoire', tier: 'rare', price: 1300 },
  { id: 'casque-audio', name: 'Casque audio', slot: 'accessoire', tier: 'rare', price: 1600 },
  { id: 'ailes', name: 'Petites ailes', slot: 'accessoire', tier: 'premium', price: 5000 },
  { id: 'halo', name: 'Halo d\'étoiles', slot: 'accessoire', tier: 'premium', price: 8000 },
]

export const shopItem = (id: string) => SHOP.find(i => i.id === id)
export const isShopItem = (id: string) => SHOP.some(i => i.id === id)

/** Objet en sélection cette semaine (rare ou premium, −20 %), choisi sans hasard. */
export function featuredItem(week: Day): ShopItem {
  const pool = SHOP.filter(i => i.tier !== 'commun')
  return pool[hash('boutique' + week) % pool.length]
}
export const FEATURED_DISCOUNT = 0.2

export function priceOf(item: ShopItem, today: Day): number {
  return featuredItem(weekStart(today)).id === item.id ? Math.round(item.price * (1 - FEATURED_DISCOUNT) / 10) * 10 : item.price
}

export const ownedItems = (s: Snapshot) => new Set(s.shop_purchases.map(p => p.item_id))

/** Équipe un objet : un seul objet par emplacement ; les accessoires gagnés (nœud, chapeau…) restent. */
export function equipList(current: string[], itemId: string): string[] {
  const it = shopItem(itemId)
  if (!it) return current
  const kept = current.filter(id => shopItem(id)?.slot !== it.slot)
  return current.includes(itemId) ? current.filter(id => id !== itemId) : [...kept, itemId]
}

/** « environ 3 jours » pour atteindre un prix, au rythme d'une journée régulière (300 points). */
export function etaText(missing: number): string {
  if (missing <= 0) return ''
  const days = Math.ceil(missing / 300)
  if (days <= 1) return 'environ 1 journée réussie'
  if (days < 14) return `environ ${days} journées réussies`
  return `environ ${Math.round(days / 7)} semaines de régularité`
}
