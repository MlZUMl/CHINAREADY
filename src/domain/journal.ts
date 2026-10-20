// Journal plus rapide : reprendre un repas d'un autre jour, repas favoris.
// Les valeurs nutritionnelles sont recopiées telles quelles (figées au moment du premier ajout).
import type { FavoriteMeal, FoodEntry, MealSlot, Snapshot } from '../data/types'
import { addDays, type Day } from '../lib/dates'
import { sumEntries } from './nutrition'

export type EntryDraft = Omit<FoodEntry, 'created_at' | 'updated_at' | 'at'> & { at?: string }
export type FavoriteItem = FavoriteMeal['items'][number]

const STRIP = ['id', 'created_at', 'updated_at', 'day', 'meal', 'at'] as const

/** Partie « recopiable » d'une ligne du journal (sans date, repas ni identifiant). */
export function toItem(e: FoodEntry): FavoriteItem {
  const out: Record<string, unknown> = { ...e }
  for (const k of STRIP) delete out[k]
  return out as FavoriteItem
}

/**
 * Identifiant d'une ligne recopiée. Une recette garde son identifiant stable
 * (recette:jour:repas:id) : la recopier deux fois ne la double pas.
 */
export function copiedId(item: FavoriteItem, day: Day, meal: MealSlot, seed: string): string {
  if (item.source === 'recette' && item.ref) return `recette:${day}:${meal}:${item.ref}`
  return `copie:${day}:${meal}:${seed}`
}

/** Lignes à ajouter pour recopier des éléments dans un repas donné. */
export function draftsFrom(items: FavoriteItem[], day: Day, meal: MealSlot, seed: string): EntryDraft[] {
  return items.map((it, i) => ({ ...it, id: copiedId(it, day, meal, `${seed}:${i}`), day, meal }))
}

export interface CopySource { day: Day; entries: FoodEntry[]; kcal: number }

/**
 * Jours précédents où ce repas a été noté (les plus récents d'abord), pour « Reprendre un repas ».
 * On regarde jusqu'à `lookback` jours en arrière.
 */
export function copySources(s: Snapshot, day: Day, meal: MealSlot, lookback = 14, max = 7): CopySource[] {
  const out: CopySource[] = []
  for (let i = 1; i <= lookback && out.length < max; i++) {
    const d = addDays(day, -i)
    const entries = s.food_entries.filter(f => f.day === d && f.meal === meal).sort((a, b) => a.at.localeCompare(b.at))
    if (entries.length) out.push({ day: d, entries, kcal: sumEntries(entries).kcal })
  }
  return out
}

/** Calories d'un repas favori. */
export const favoriteKcal = (f: Pick<FavoriteMeal, 'items'>) => sumEntries(f.items).kcal

/** Favoris proposés pour un repas : ceux de ce repas d'abord, puis les autres, par nom. */
export function favoritesFor(s: Snapshot, meal: MealSlot): FavoriteMeal[] {
  return [...s.favorite_meals].sort((a, b) => Number(b.meal === meal) - Number(a.meal === meal) || a.name.localeCompare(b.name))
}

/** Nom proposé pour un nouveau favori : les deux premiers aliments. */
export function suggestFavoriteName(entries: Pick<FoodEntry, 'name'>[]): string {
  const names = entries.map(e => e.name.split(',')[0].trim()).filter(Boolean)
  if (!names.length) return ''
  const base = names.slice(0, 2).join(' + ')
  return (names.length > 2 ? `${base}…` : base).slice(0, 60)
}
