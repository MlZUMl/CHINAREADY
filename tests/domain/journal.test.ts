// Journal plus rapide : reprendre un repas, repas favoris.
import { describe, it, expect } from 'vitest'
import { baseSnap } from '../helpers'
import type { FoodEntry } from '../../src/data/types'
import { copySources, draftsFrom, favoritesFor, suggestFavoriteName, toItem, favoriteKcal } from '../../src/domain/journal'
import { DataStore } from '../../src/data/store'
import { createActions } from '../../src/app/actions'
import { deriveOps } from '../../src/domain/rewards'
import { addDays, toDay } from '../../src/lib/dates'

const fe = (extra: Partial<FoodEntry>): FoodEntry => ({
  id: Math.random().toString(36), day: '2026-10-19', meal: 'petit-dejeuner', source: 'ciqual', ref: '1', name: 'Flocons d\'avoine', brand: null, quantity: 40, unit: 'g', grams: 40,
  portion_label: null, per100: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 }, kcal: 148, protein: 5.2, carbs: 24, fat: 2.8, fiber: 4, details: {}, category: 'feculents',
  at: '2026-10-19T07:30:00Z', created_at: 'x', updated_at: 'x', ...extra,
})

describe('reprendre un repas', () => {
  it('jours précédents où ce repas a été noté, les plus récents d\'abord', () => {
    const s = baseSnap()
    s.food_entries = [
      fe({ day: '2026-10-19' }), fe({ day: '2026-10-19', name: 'Banane', kcal: 90, ref: '2' }),
      fe({ day: '2026-10-17', name: 'Yaourt', kcal: 60 }), fe({ day: '2026-10-19', meal: 'diner' }),
      fe({ day: '2026-10-01' }), // trop ancien
    ]
    const src = copySources(s, '2026-10-20', 'petit-dejeuner')
    expect(src.map(x => [x.day, x.entries.length, x.kcal])).toEqual([['2026-10-19', 2, 238], ['2026-10-17', 1, 60]])
  })
  it('les lignes recopiées gardent leurs valeurs, changent de jour, de repas et d\'identifiant', () => {
    const e = fe({})
    const [d] = draftsFrom([toItem(e)], '2026-10-20', 'collation', 'seed')
    expect(d).toMatchObject({ day: '2026-10-20', meal: 'collation', kcal: 148, name: 'Flocons d\'avoine', id: 'copie:2026-10-20:collation:seed:0' })
    expect(d).not.toHaveProperty('at')
    expect(d).not.toHaveProperty('created_at')
    // une recette garde son identifiant stable : pas de doublon
    const r = draftsFrom([toItem(fe({ source: 'recette', ref: 'shakshuka', unit: 'portion' }))], '2026-10-20', 'diner', 's')
    expect(r[0].id).toBe('recette:2026-10-20:diner:shakshuka')
  })
})

describe('repas favoris', () => {
  it('nom proposé, calories, ordre (ceux du repas d\'abord)', () => {
    expect(suggestFavoriteName([{ name: 'Flocons d\'avoine, crus' }, { name: 'Banane' }, { name: 'Lait' }])).toBe('Flocons d\'avoine + Banane…')
    const s = baseSnap()
    const items = [toItem(fe({})), toItem(fe({ kcal: 90 }))]
    s.favorite_meals = [
      { id: 'a', name: 'Salade', meal: 'dejeuner', items, created_at: '', updated_at: '' },
      { id: 'b', name: 'Bol', meal: 'petit-dejeuner', items, created_at: '', updated_at: '' },
    ]
    expect(favoriteKcal(s.favorite_meals[0])).toBe(238)
    expect(favoritesFor(s, 'petit-dejeuner').map(f => f.id)).toEqual(['b', 'a'])
  })
})

describe('actions (stockage réel)', () => {
  it('« comme hier », favori enregistré puis rajouté, points du journal, porc refusé', async () => {
    const store = await DataStore.open('journal-' + Math.random())
    store.setDeriver(snap => deriveOps(snap))
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'M', waterMl: 2000, equipment: [] })
    const today = toDay()
    const yesterday = addDays(today, -1)
    await actions.saveFoodEntry({ ...fe({ day: yesterday }), id: undefined })
    await actions.saveFoodEntry({ ...fe({ day: yesterday, name: 'Banane', kcal: 90 }), id: undefined })
    expect(await actions.copyMeal(yesterday, 'petit-dejeuner', today, 'petit-dejeuner')).toBe(2)
    expect(await actions.copyMeal(yesterday, 'petit-dejeuner', today, 'petit-dejeuner')).toBe(2) // second appui : pas de doublon
    let s = store.snapshot()
    expect(s.food_entries.filter(f => f.day === today)).toHaveLength(2)
    expect(s.reward_grants.some(g => g.id === `points:calories:${today}`)).toBe(false) // un seul repas noté

    const mine = s.food_entries.filter(f => f.day === today)
    const id = await actions.saveFavorite('  Mon bol  ', 'petit-dejeuner', mine)
    s = store.snapshot()
    expect(s.favorite_meals[0]).toMatchObject({ id, name: 'Mon bol', meal: 'petit-dejeuner' })
    expect(s.favorite_meals[0].items).toHaveLength(2)
    expect(await actions.logFavorite(id, today, 'collation')).toBe(2)
    expect(store.snapshot().food_entries.filter(f => f.day === today && f.meal === 'collation').map(f => f.kcal).sort()).toEqual([148, 90].sort())
    expect(store.snapshot().reward_grants.some(g => g.id === `points:calories:${today}`)).toBe(true) // 2 repas notés : +50 points
    await expect(actions.saveFavorite('X', 'diner', [fe({ name: 'Rillettes de porc' })])).rejects.toThrow('PORC')
    await expect(actions.saveFavorite('  ', 'diner', mine)).rejects.toThrow('VIDE')
    await actions.deleteFavorite(id)
    expect(store.snapshot().favorite_meals).toHaveLength(0)
    store.close()
  })
})
