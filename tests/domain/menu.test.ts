// Menu de la semaine adapté à l'objectif calorique.
import { describe, it, expect } from 'vitest'
import { RECIPES, shoppingList } from '../../src/domain/recipes'
import { buildWeekMenu, candidates, momentTarget, plannedKcal, swapFor, SNACK_SHARE } from '../../src/domain/menu'
import { recipeHasPork } from '../../src/domain/pork'
import { addDays } from '../../src/lib/dates'

const WEEK = '2026-10-19'
const opts = (goal: number, extra = {}) => ({ goal, week: WEEK, portions: 2, moments: ['matin', 'midi', 'soir'] as const, avoid: [], keep: [], ...extra })

describe('menu adapté', () => {
  it('3 repas par jour pendant 7 jours, sans porc, déterministe', () => {
    const slots = buildWeekMenu(RECIPES, { ...opts(1450), moments: ['matin', 'midi', 'soir'] })
    expect(slots).toHaveLength(21)
    expect(slots.every(s => s.portions === 2)).toBe(true)
    expect(slots.some(s => recipeHasPork(RECIPES.find(r => r.id === s.recipe_id)!))).toBe(false)
    expect(buildWeekMenu(RECIPES, { ...opts(1450), moments: ['matin', 'midi', 'soir'] })).toEqual(slots)
  })

  it('chaque journée s\'approche de l\'objectif moins la collation (±12 %)', () => {
    for (const goal of [1300, 1450, 1600, 1750]) {
      const slots = buildWeekMenu(RECIPES, { ...opts(goal), moments: ['matin', 'midi', 'soir'] })
      for (let i = 0; i < 7; i++) {
        const { kcal } = plannedKcal(RECIPES, slots, addDays(WEEK, i))
        const aim = goal * (1 - SNACK_SHARE)
        expect(Math.abs(kcal - aim) / aim, `objectif ${goal}, jour ${i} : ${kcal} kcal`).toBeLessThan(0.12)
      }
    }
  })

  it('objectif au plancher (1 200 kcal) : jamais plus de 20 % au-dessus', () => {
    const slots = buildWeekMenu(RECIPES, { ...opts(1200), moments: ['matin', 'midi', 'soir'] })
    for (let i = 0; i < 7; i++) expect(plannedKcal(RECIPES, slots, addDays(WEEK, i)).kcal).toBeLessThan(1080 * 1.2)
  })

  it('objectif élevé : les plats du catalogue plafonnent, le manque est signalé plutôt que caché', () => {
    const slots = buildWeekMenu(RECIPES, { ...opts(2200), moments: ['matin', 'midi', 'soir'] })
    const { kcal } = plannedKcal(RECIPES, slots, WEEK)
    expect(kcal).toBeGreaterThan(2200 * 0.6)
  })

  it('varié : pas deux fois le même plat le même jour, déjeuners et dîners peu répétés', () => {
    const slots = buildWeekMenu(RECIPES, { ...opts(1450), moments: ['matin', 'midi', 'soir'] })
    for (let i = 0; i < 7; i++) {
      const d = slots.filter(s => s.day === addDays(WEEK, i) && s.moment !== 'matin').map(s => s.recipe_id)
      expect(new Set(d).size).toBe(d.length)
    }
    const mains = slots.filter(s => s.moment !== 'matin').map(s => s.recipe_id)
    expect(new Set(mains).size).toBeGreaterThanOrEqual(10)
  })

  it('le dîner compense ce qui est déjà prévu dans la journée', () => {
    expect(momentTarget(1500, 'soir', { matin: 300, midi: 500 })).toBe(550)
    expect(momentTarget(1500, 'soir', { matin: 600, midi: 900 })).toBe(300) // plancher 20 %
  })

  it('allergènes évités, recettes déjà choisies conservées, moments au choix', () => {
    const keep = [{ day: WEEK, moment: 'soir' as const, recipe_id: 'chili-boeuf', portions: 4 }]
    const slots = buildWeekMenu(RECIPES, { ...opts(1450), moments: ['soir'], avoid: ['gluten', 'lait'], keep })
    expect(slots).toHaveLength(7)
    expect(slots[0]).toEqual(keep[0])
    for (const s of slots.slice(1)) expect(RECIPES.find(r => r.id === s.recipe_id)!.allergens).not.toContain('gluten')
    expect(candidates(RECIPES, 'matin', []).every(r => r.moment === 'matin')).toBe(true)
  })

  it('« autre idée » fait défiler des recettes différentes', () => {
    const slots = buildWeekMenu(RECIPES, { ...opts(1450), moments: ['midi', 'soir'] })
    const slot = slots[0]
    const seen = [slot.recipe_id]
    for (let k = 0; k < 4; k++) {
      const next = swapFor(RECIPES, slots, { ...slot, recipe_id: seen[seen.length - 1] }, 1450, [], seen)!
      expect(seen).not.toContain(next)
      seen.push(next)
    }
  })

  it('la liste de courses se remplit à partir du menu (portions comprises)', () => {
    const slots = buildWeekMenu(RECIPES, { ...opts(1450), moments: ['matin', 'midi', 'soir'] })
    const list = shoppingList({ id: WEEK, week_start: WEEK, slots, checked: [], created_at: '', updated_at: '' })
    expect(list.length).toBeGreaterThan(20)
    const one = shoppingList({ id: WEEK, week_start: WEEK, slots: [{ ...slots[1], portions: 1 }], checked: [], created_at: '', updated_at: '' })
    const two = shoppingList({ id: WEEK, week_start: WEEK, slots: [{ ...slots[1], portions: 2 }], checked: [], created_at: '', updated_at: '' })
    const q = (l: typeof one) => l.find(i => i.qty !== null)!
    expect(q(two).qty).toBeCloseTo(q(one).qty! * 2)
  })
})
