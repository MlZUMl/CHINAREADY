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
//   Compagnon (22 objets) ≈ 47 000 pts ; avatar (28 objets) ≈ 51 500 pts. Personne n'a besoin de tout :
//   un objet commun par jour réussi, un rare par semaine, un premium par mois de régularité.
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
export type Target = 'compagnon' | 'avatar'
/** Emplacement d'un accessoire de l'avatar (un objet par emplacement : on peut porter lunettes ET boucles d'oreilles). */
export type AvatarSpot = 'yeux' | 'oreilles' | 'tete' | 'cou' | 'main'
export interface ShopItem { id: string; name: string; slot: Slot; tier: Tier; price: number; target: Target; spot?: AvatarSpot }

export const SLOT_LABELS: Record<Slot, string> = { tenue: 'Tenues', coiffure: 'Coiffures', accessoire: 'Accessoires' }
export const TIER_LABELS: Record<Tier, string> = { commun: 'Commun', rare: 'Rare', premium: 'Premium' }

export const SHOP: ShopItem[] = [
  // Tenues
  { id: 't-shirt-sport', name: 'T-shirt de sport', slot: 'tenue', tier: 'commun', price: 300, target: 'compagnon' },
  { id: 'debardeur', name: 'Débardeur rayé', slot: 'tenue', tier: 'commun', price: 400, target: 'compagnon' },
  { id: 'sweat', name: 'Sweat à capuche', slot: 'tenue', tier: 'commun', price: 500, target: 'compagnon' },
  { id: 'mariniere', name: 'Marinière', slot: 'tenue', tier: 'rare', price: 1200, target: 'compagnon' },
  { id: 'salopette', name: 'Salopette', slot: 'tenue', tier: 'rare', price: 1500, target: 'compagnon' },
  { id: 'kimono', name: 'Kimono fleuri', slot: 'tenue', tier: 'rare', price: 1800, target: 'compagnon' },
  { id: 'robe-soiree', name: 'Robe de soirée', slot: 'tenue', tier: 'premium', price: 3500, target: 'compagnon' },
  { id: 'tenue-etoilee', name: 'Tenue étoilée', slot: 'tenue', tier: 'premium', price: 6000, target: 'compagnon' },
  // Coiffures
  { id: 'frange', name: 'Petite frange', slot: 'coiffure', tier: 'commun', price: 300, target: 'compagnon' },
  { id: 'meche', name: 'Mèche rebelle', slot: 'coiffure', tier: 'commun', price: 400, target: 'compagnon' },
  { id: 'couettes', name: 'Couettes', slot: 'coiffure', tier: 'commun', price: 500, target: 'compagnon' },
  { id: 'chignon', name: 'Chignon', slot: 'coiffure', tier: 'rare', price: 1200, target: 'compagnon' },
  { id: 'boucles', name: 'Boucles', slot: 'coiffure', tier: 'rare', price: 1500, target: 'compagnon' },
  { id: 'tresse', name: 'Longue tresse', slot: 'coiffure', tier: 'rare', price: 1800, target: 'compagnon' },
  { id: 'carre', name: 'Carré lisse', slot: 'coiffure', tier: 'premium', price: 3500, target: 'compagnon' },
  { id: 'meches-arc-en-ciel', name: 'Mèches arc-en-ciel', slot: 'coiffure', tier: 'premium', price: 6000, target: 'compagnon' },
  // Accessoires
  { id: 'bandeau', name: 'Bandeau de sport', slot: 'accessoire', tier: 'commun', price: 350, target: 'compagnon' },
  { id: 'noeud-papillon', name: 'Nœud papillon', slot: 'accessoire', tier: 'commun', price: 450, target: 'compagnon' },
  { id: 'casquette', name: 'Casquette', slot: 'accessoire', tier: 'rare', price: 1300, target: 'compagnon' },
  { id: 'casque-audio', name: 'Casque audio', slot: 'accessoire', tier: 'rare', price: 1600, target: 'compagnon' },
  { id: 'ailes', name: 'Petites ailes', slot: 'accessoire', tier: 'premium', price: 5000, target: 'compagnon' },
  { id: 'halo', name: 'Halo d\'étoiles', slot: 'accessoire', tier: 'premium', price: 8000, target: 'compagnon' },
  // ---------------- Avatar : tenues
  { id: 'av-tshirt', name: 'T-shirt blanc', slot: 'tenue', tier: 'commun', price: 300, target: 'avatar' },
  { id: 'av-sport', name: 'Tenue de sport', slot: 'tenue', tier: 'commun', price: 400, target: 'avatar' },
  { id: 'av-pull-raye', name: 'Pull rayé', slot: 'tenue', tier: 'commun', price: 450, target: 'avatar' },
  { id: 'av-chemise-jean', name: 'Chemise en jean', slot: 'tenue', tier: 'commun', price: 500, target: 'avatar' },
  { id: 'av-yoga', name: 'Tenue de yoga', slot: 'tenue', tier: 'rare', price: 1200, target: 'avatar' },
  { id: 'av-robe-ete', name: 'Robe d\'été fleurie', slot: 'tenue', tier: 'rare', price: 1400, target: 'avatar' },
  { id: 'av-doudoune', name: 'Doudoune', slot: 'tenue', tier: 'rare', price: 1500, target: 'avatar' },
  { id: 'av-kimono', name: 'Kimono', slot: 'tenue', tier: 'rare', price: 1600, target: 'avatar' },
  { id: 'av-abaya', name: 'Abaya élégante', slot: 'tenue', tier: 'rare', price: 1800, target: 'avatar' },
  { id: 'av-robe-doree', name: 'Robe de soirée dorée', slot: 'tenue', tier: 'premium', price: 3500, target: 'avatar' },
  { id: 'av-sport-premium', name: 'Ensemble sport premium', slot: 'tenue', tier: 'premium', price: 4000, target: 'avatar' },
  { id: 'av-manteau-etoile', name: 'Manteau étoilé', slot: 'tenue', tier: 'premium', price: 6000, target: 'avatar' },
  // ---------------- Avatar : coiffures
  { id: 'av-queue', name: 'Queue de cheval', slot: 'coiffure', tier: 'commun', price: 300, target: 'avatar' },
  { id: 'av-tresse', name: 'Tresse', slot: 'coiffure', tier: 'commun', price: 400, target: 'avatar' },
  { id: 'av-frange', name: 'Frange droite', slot: 'coiffure', tier: 'commun', price: 500, target: 'avatar' },
  { id: 'av-afro', name: 'Afro', slot: 'coiffure', tier: 'rare', price: 1200, target: 'avatar' },
  { id: 'av-carre-plongeant', name: 'Carré plongeant', slot: 'coiffure', tier: 'rare', price: 1400, target: 'avatar' },
  { id: 'av-couettes', name: 'Couettes', slot: 'coiffure', tier: 'rare', price: 1500, target: 'avatar' },
  { id: 'av-ondules', name: 'Longs ondulés', slot: 'coiffure', tier: 'rare', price: 1800, target: 'avatar' },
  { id: 'av-chignon-fleuri', name: 'Chignon fleuri', slot: 'coiffure', tier: 'premium', price: 3500, target: 'avatar' },
  { id: 'av-turban', name: 'Turban élégant', slot: 'coiffure', tier: 'premium', price: 4000, target: 'avatar' },
  { id: 'av-meches-roses', name: 'Mèches roses', slot: 'coiffure', tier: 'premium', price: 5000, target: 'avatar' },
  // ---------------- Avatar : accessoires
  { id: 'av-lunettes', name: 'Lunettes rondes', slot: 'accessoire', tier: 'commun', price: 350, target: 'avatar', spot: 'yeux' },
  { id: 'av-boucles', name: 'Boucles d\'oreilles', slot: 'accessoire', tier: 'commun', price: 400, target: 'avatar', spot: 'oreilles' },
  { id: 'av-foulard', name: 'Foulard', slot: 'accessoire', tier: 'rare', price: 1200, target: 'avatar', spot: 'cou' },
  { id: 'av-casque', name: 'Casque audio', slot: 'accessoire', tier: 'rare', price: 1300, target: 'avatar', spot: 'tete' },
  { id: 'av-sac', name: 'Sac de sport', slot: 'accessoire', tier: 'rare', price: 1500, target: 'avatar', spot: 'main' },
  { id: 'av-couronne', name: 'Couronne de fleurs', slot: 'accessoire', tier: 'premium', price: 4500, target: 'avatar', spot: 'tete' },
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

// ------------------------------------------------------------------ avatar : objets portés
/** Clé de l'objet porté dans avatar_profiles.equipped (espace « perso: », distinct des emplacements du décor). */
export function avatarKey(item: ShopItem): string {
  return item.slot === 'accessoire' ? `perso:${item.spot ?? 'tete'}` : `perso:${item.slot}`
}

/** Ce que porte l'avatar : objet de la boutique s'il y en a un, sinon les choix de départ (gratuits). */
export function avatarLook(a: { style: string; outfit: string; equipped: Record<string, string> }) {
  const extras = Object.entries(a.equipped).filter(([k]) => k.startsWith('perso:') && k !== 'perso:tenue' && k !== 'perso:coiffure').map(([, v]) => v)
  return { style: a.equipped['perso:coiffure'] ?? a.style, outfit: a.equipped['perso:tenue'] ?? a.outfit, extras }
}

/** Met / retire un objet de la boutique sur l'avatar. */
export function avatarEquip(equipped: Record<string, string>, itemId: string): Record<string, string> {
  const it = shopItem(itemId)
  if (!it || it.target !== 'avatar') return equipped
  const key = avatarKey(it)
  const next = { ...equipped }
  if (next[key] === itemId) delete next[key]
  else next[key] = itemId
  return next
}

export const isWorn = (item: ShopItem, comp: { accessories: string[] } | undefined, avatar: { equipped: Record<string, string> } | undefined) =>
  item.target === 'avatar' ? avatar?.equipped[avatarKey(item)] === item.id : Boolean(comp?.accessories.includes(item.id))

/** Équipe un objet : un seul objet par emplacement ; les accessoires gagnés (nœud, chapeau…) restent. */
export function equipList(current: string[], itemId: string): string[] {
  const it = shopItem(itemId)
  if (!it) return current
  const kept = current.filter(id => { const o = shopItem(id); return !o || o.target !== 'compagnon' || o.slot !== it.slot })
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
