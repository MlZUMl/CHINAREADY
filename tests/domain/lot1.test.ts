// Lot 1 : contrôle « sans porc », catalogue de recettes, objectif calorique, aliments, eau en litres, matériel.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { baseSnap } from '../helpers'
import { porkInText, porkVerdict, recipeHasPork } from '../../src/domain/pork'
import { RECIPES, parseCatalog, loadRemoteCatalog, recipeById, helloFreshUrl } from '../../src/domain/recipes'
import { bmrMifflin, calorieGoal, macroTargets, mealTarget, MEALS, remainingText, scale, sumEntries } from '../../src/domain/nutrition'
import { ciqualRowToItem, guessPortions, offToItem, searchFoods } from '../../src/domain/foods'
import { formatLitres, waterMl, waterGoalMl, waterReached, habitState, hasFoodOn, fruitOrVegOn } from '../../src/domain/discipline'
import { buildSession, EXERCISES } from '../../src/domain/exercises'
import { DataStore } from '../../src/data/store'
import { createActions } from '../../src/app/actions'
import { defaultCommitments } from '../../src/domain/defaults'
import type { FoodEntry, Snapshot } from '../../src/data/types'

const catalogFile = JSON.parse(readFileSync(join(__dirname, '../../public/data/recettes.json'), 'utf8'))
const ciqual = JSON.parse(readFileSync(join(__dirname, '../../public/data/ciqual.json'), 'utf8'))

describe('contrôle sans porc (permanent)', () => {
  it('repère le porc et ses dérivés, accents et majuscules compris', () => {
    for (const t of ['Lardons fumés', 'Jambon cru', 'GÉLATINE', 'Saucisson sec', 'chorizo doux', 'saindoux', 'Rillettes', 'pork belly', 'Bacon', 'filet mignon de porc'])
      expect(porkInText(t), t).toBe(true)
  })
  it('ne bloque pas les faux amis', () => {
    for (const t of ['Pâtes complètes', 'Pâte feuilletée', 'Jambon de dinde', 'Chorizo de volaille', 'Gélatine bovine', 'Lait de coco', 'Porridge', 'Pomme', 'Boulgour', 'Saucisse de volaille', 'sans porc', 'Rillettes de maquereau', 'Saucisse végétale au tofu', 'Spécialité végétale type jambon cuit'])
      expect(porkInText(t), t).toBe(false)
  })
  it('produits Open Food Facts : porc refusé, composition absente = à vérifier', () => {
    expect(porkVerdict({ name: 'Knacks', ingredients: 'viande de porc 80 %, eau, sel' })).toBe('porc')
    expect(porkVerdict({ name: 'Saucisses', ingredients: 'poulet, eau', categories: ['en:pork-sausages'] })).toBe('porc')
    expect(porkVerdict({ name: 'Bonbons', ingredients: 'sucre, sirop de glucose, gélatine' })).toBe('porc')
    expect(porkVerdict({ name: 'Biscuits', ingredients: '' })).toBe('inconnu')
    expect(porkVerdict({ name: 'Yaourt nature', ingredients: 'lait entier, ferments lactiques' })).toBe('ok')
  })
})

describe('catalogue de recettes', () => {
  it('entre 40 et 60 recettes, identifiants et photos uniques, aucune trace de porc', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(40)
    expect(RECIPES.length).toBeLessThanOrEqual(60)
    expect(new Set(RECIPES.map(r => r.id)).size).toBe(RECIPES.length)
    expect(new Set(RECIPES.map(r => r.photo?.url)).size).toBe(RECIPES.length)
    expect(RECIPES.every(r => r.photo && r.photo.url.startsWith('https://images.pexels.com/'))).toBe(true)
    expect(RECIPES.some(r => recipeHasPork(r))).toBe(false)
    expect(catalogFile.recettes.every((r: { sans_porc: boolean }) => r.sans_porc)).toBe(true)
  })
  it('les 27 anciennes recettes existent toujours (les menus déjà planifiés restent valides)', () => {
    const old = ['poulet-citron-four', 'bowl-teriyaki', 'salade-grecque-poulet', 'shakshuka', 'saumon-patate-douce', 'curry-pois-chiches', 'tajine-poulet', 'boulettes-boeuf', 'wraps-poulet', 'omelette-champignons', 'soupe-lentilles', 'bowl-thon', 'chili-boeuf', 'pates-poulet-tomates', 'brochettes-yaourt', 'parmentier-patate-douce', 'cabillaud-papillote', 'salade-quinoa', 'frittata', 'kefta-agneau', 'riz-saute', 'poulet-basquaise', 'veloute-butternut', 'bol-petit-dej', 'tartine-avocat-oeuf', 'mousse-chocolat', 'pomme-four']
    for (const id of old) expect(recipeById(id), id).toBeTruthy()
  })
  it('valeurs nutritionnelles, coût et allergènes cohérents', () => {
    for (const r of RECIPES) {
      expect(r.nutrition!.kcal, r.id).toBeGreaterThan(100)
      expect(r.nutrition!.kcal, r.id).toBeLessThan(900)
      // énergie ≈ 4 P + 4 G + 9 L (+ 2 fibres) à 15 % près
      const est = 4 * r.nutrition!.protein + 4 * r.nutrition!.carbs + 9 * r.nutrition!.fat + 2 * r.nutrition!.fiber
      expect(Math.abs(est - r.nutrition!.kcal) / r.nutrition!.kcal, r.id).toBeLessThan(0.15)
      expect(r.cost!, r.id).toBeGreaterThan(0.2)
      expect(r.cost!, r.id).toBeLessThan(8)
    }
    expect(recipeById('saumon-patate-douce')!.allergens).toContain('poissons')
    expect(recipeById('pates-crevettes-citron')!.allergens).toEqual(expect.arrayContaining(['gluten', 'crustacés']))
  })
  it('une recette avec du porc glissée dans le fichier en ligne est écartée', () => {
    const doc = structuredClone(catalogFile)
    doc.recettes.push({ ...doc.recettes[0], id: 'piege', titre: 'Pâtes aux lardons', etapes: ['Fais revenir les lardons.'] })
    doc.recettes.push({ ...doc.recettes[0], id: 'piege2', titre: 'Salade', ingredients: [{ label: 'Jambon blanc', qty: 1, unit: 'tranche', rayon: 'Boucherie' }] })
    const list = parseCatalog(doc)
    expect(list.find(r => r.id === 'piege')).toBeUndefined()
    expect(list.find(r => r.id === 'piege2')).toBeUndefined()
    expect(list).toHaveLength(catalogFile.recettes.length)
  })
  it('le fichier en ligne remplace la copie embarquée seulement s\'il est valide', async () => {
    const before = RECIPES.length
    const ok = await loadRemoteCatalog('./', (async () => new Response('{"recettes": []}')) as typeof fetch)
    expect(ok).toBe(false)
    expect(RECIPES.length).toBe(before)
    const doc = structuredClone(catalogFile)
    doc.recettes[0].titre = 'Titre corrigé en ligne'
    expect(await loadRemoteCatalog('./', (async () => new Response(JSON.stringify(doc))) as typeof fetch)).toBe(true)
    expect(RECIPES[0].title).toBe('Titre corrigé en ligne')
    expect(await loadRemoteCatalog('./', (async () => { throw new Error('hors ligne') }) as typeof fetch)).toBe(false)
  })
  it('lien HelloFresh = simple recherche, sans récupération de contenu', () => {
    expect(helloFreshUrl('Shakshuka aux œufs')).toBe('https://www.hellofresh.fr/recipes/search?q=Shakshuka%20aux%20%C5%93ufs')
  })
})

function withNutrition(s: Snapshot, n: Record<string, unknown>, kg?: number): Snapshot {
  const p = s.profiles[0]
  s.profiles = [{ ...p, settings: { ...p.settings, nutrition: n } }]
  if (kg) s.weights = [{ id: '2026-10-19', day: '2026-10-19', kg, note: null, created_at: '', updated_at: '' }]
  return s
}

describe('objectif calorique', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmrMifflin('F', 70, 165, 30)).toBeCloseTo(1420.25, 2)
    expect(bmrMifflin('H', 80, 180, 40)).toBeCloseTo(1730, 0)
  })
  it('rythme modéré par défaut, jamais sous le plancher (métabolisme de base, 1 200 kcal)', () => {
    const s = withNutrition(baseSnap(), { sex: 'F', birthYear: 1996, heightCm: 165, activity: 'sedentaire' }, 70)
    const g = calorieGoal(s, '2026-10-20')
    // 1 420 × 1,2 = 1 704 ; − 500 = 1 204 < métabolisme de base → relevé à 1 420
    expect(g.tdee).toBe(1704)
    expect(g.floored).toBe(true)
    expect(g.goal).toBe(1420)
    const active = calorieGoal(withNutrition(baseSnap(), { sex: 'F', birthYear: 1996, heightCm: 165, activity: 'modere', pace: 'modere' }, 70), '2026-10-20')
    expect(active.goal).toBe(Math.round((1420.25 * 1.55 - 500) / 10) * 10)
    expect(active.floored).toBe(false)
  })
  it('la dernière pesée est utilisée ; il manque des infos → pas d\'objectif inventé', () => {
    expect(calorieGoal(baseSnap(), '2026-10-20')).toMatchObject({ goal: null, source: 'incomplet' })
    const s = withNutrition(baseSnap(), { sex: 'F', birthYear: 1996, heightCm: 165, activity: 'leger', weightKg: 90 }, 70)
    expect(calorieGoal(s, '2026-10-20').bmr).toBe(1420)
  })
  it('ne baisse jamais les jours de faible énergie et ne déduit pas le sport', () => {
    const s = withNutrition(baseSnap(), { sex: 'F', birthYear: 1996, heightCm: 165, activity: 'leger' }, 70)
    const before = calorieGoal(s, '2026-10-20').goal
    s.daily_checkins = [{ id: '2026-10-20', day: '2026-10-20', energy: 1, minutes: 5, need: 'detente', created_at: '', updated_at: '' }]
    s.workouts = [{ id: 'w', day: '2026-10-20', started_at: '', ended_at: '', kind: 'guidee', activity: 'cardio', program: null, planned_minutes: 45, actual_minutes: 45, version: 'plus', completed: true, source: 'libre', energy: 1, note: null, created_at: '', updated_at: '' }]
    expect(calorieGoal(s, '2026-10-20').goal).toBe(before)
  })
  it('objectif manuel, répartition par repas et macros', () => {
    const s = withNutrition(baseSnap(), { manualGoal: 1800 })
    expect(calorieGoal(s, '2026-10-20')).toMatchObject({ goal: 1800, source: 'manuel' })
    expect(MEALS.reduce((n, m) => n + mealTarget(1800, m.id), 0)).toBe(1800)
    expect(macroTargets(1800)).toEqual({ protein: 113, carbs: 203, fat: 60, fiber: 30 })
  })
  it('au-delà de l\'objectif, affichage neutre', () => {
    expect(remainingText(1200, 1800)).toEqual({ big: '600 kcal', small: 'restantes' })
    expect(remainingText(2000, 1800).small).toMatch(/notées sur 1.800 kcal prévues/)
  })
})

describe('aliments', () => {
  const items = ciqual.aliments.filter((a: unknown[]) => !a[9]).map(ciqualRowToItem)
  it('recherche Ciqual tolérante aux accents, aliment simple en premier', () => {
    expect(searchFoods(items, 'pomme')[0].name).toMatch(/^Pomme/)
    expect(searchFoods(items, 'oeuf dur')[0].name).toBe('Oeuf, dur')
    expect(searchFoods(items, 'poulet filet').some(i => i.ref === '36017')).toBe(true)
    expect(searchFoods(items, 'epinard').length).toBeGreaterThan(0)
  })
  it('la table embarquée ne contient aucun produit à base de porc', () => {
    expect(items.some((i: { name: string }) => porkInText(i.name))).toBe(false)
  })
  it('quantités : recalcul pour 150 g, portions usuelles', () => {
    const pomme = items.find((i: { ref: string }) => i.ref === '13039')
    expect(scale(pomme.per100, 150).kcal).toBe(78)
    expect(guessPortions('Oeuf, cru', '0410')[0]).toEqual({ label: '1 œuf moyen', grams: 55 })
    expect(items.find((i: { ref: string }) => i.ref === '19041').liquid).toBe(true)
  })
  it('Open Food Facts : valeurs pour 100 g, portion, porc détecté', () => {
    const it1 = offToItem({ code: '3017620422003', product_name_fr: 'Pâte à tartiner', brands: 'Marque, Autre', quantity: '400 g', serving_quantity: 15, serving_size: '15 g',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0, sugars_100g: 56.3 }, ingredients_text_fr: 'sucre, huile de palme, noisettes 13 %' })!
    expect(it1).toMatchObject({ source: 'off', brand: 'Marque', liquid: false, pork: 'ok' })
    expect(it1.portions[0].grams).toBe(15)
    expect(offToItem({ code: '1', product_name: 'Jus', quantity: '1 L', nutriments: { 'energy-kcal_100g': 45 }, ingredients_text: 'orange' })!.liquid).toBe(true)
    expect(offToItem({ code: '2', product_name: 'Saucisses de Strasbourg', nutriments: { 'energy-kcal_100g': 280 }, ingredients_text: 'viande de porc' })!.pork).toBe('porc')
    expect(offToItem({ code: '3', product_name: 'Sans valeurs', nutriments: {} })).toBeNull()
  })
})

const fe = (extra: Partial<FoodEntry>): FoodEntry => ({
  id: Math.random().toString(36), day: '2026-10-20', meal: 'dejeuner', source: 'ciqual', ref: '1', name: 'X', brand: null, quantity: 100, unit: 'g', grams: 100,
  portion_label: null, per100: null, kcal: 100, protein: 1, carbs: 1, fat: 1, fiber: 1, details: {}, category: null, at: '2026-10-20T12:00:00Z', created_at: '', updated_at: '', ...extra,
})

describe('journal et habitudes', () => {
  it('totaux, jours notés et habitude « repas » à partir du journal', () => {
    const s = baseSnap()
    s.food_entries = [fe({ kcal: 300.4 }), fe({ kcal: 200.4, meal: 'diner', category: 'legumes' })]
    expect(sumEntries(s.food_entries).kcal).toBe(501)
    expect(hasFoodOn(s, '2026-10-20')).toBe(true)
    expect(fruitOrVegOn(s, '2026-10-20')).toBe(true)
    const repas = s.commitments.find(c => c.kind === 'repas')!
    expect(habitState(s, repas, '2026-10-20')).toBe('usual')
  })
})

describe('eau en litres', () => {
  it('additionne millilitres et anciens verres, objectif 2 L par défaut', () => {
    const s = baseSnap()
    s.water_logs = [
      { id: 'a', day: '2026-10-20', at: '2026-10-20T08:00:00Z', glasses: 2, created_at: '', updated_at: '' },
      { id: 'b', day: '2026-10-20', at: '2026-10-20T09:00:00Z', glasses: 1, ml: 330, created_at: '', updated_at: '' },
    ]
    expect(waterMl(s, '2026-10-20')).toBe(830)
    expect(waterGoalMl(s)).toBe(2000)
    expect(waterReached(s, '2026-10-20')).toBe(false)
    expect(formatLitres(750)).toBe('0,75 L')
    expect(formatLitres(2000, 1)).toBe('2,0 L')
  })
})

describe('matériel et séances', () => {
  it('corde et vélo d\'appartement seulement s\'ils sont cochés', () => {
    const without = buildSession({ minutes: 20, focus: 'cardio', energy: 4, equipment: ['tapis'], seed: 'a' })
    expect(without.blocks.some(b => b.exercise.equipment === 'corde' || b.exercise.equipment === 'velo_appart')).toBe(false)
    const rope = buildSession({ minutes: 30, focus: 'cardio', energy: 4, equipment: ['corde'], seed: 'b' })
    expect(rope.blocks.some(b => b.exercise.equipment === 'corde')).toBe(true)
    expect(rope.totalSeconds).toBe(30 * 60)
  })
  it('vélo d\'appartement : la partie cardio reste sur le vélo, sans aller-retour', () => {
    const s = buildSession({ minutes: 20, focus: 'cardio', energy: 3, equipment: ['velo_appart', 'tapis'], seed: 'c' })
    expect(s.blocks.filter(b => b.phase === 'corps').every(b => b.exercise.equipment === 'velo_appart')).toBe(true)
    const renfo = buildSession({ minutes: 20, focus: 'mixte', energy: 3, equipment: ['velo_appart', 'tapis'], seed: 'c' })
    expect(renfo.blocks.some(b => b.exercise.equipment === 'velo_appart')).toBe(false)
    expect(EXERCISES.filter(e => e.equipment === 'velo_appart').length).toBeGreaterThanOrEqual(3)
  })
})

describe('actions', () => {
  it('ajouter une recette au journal est idempotent ; refuse un aliment au porc', async () => {
    const store = await DataStore.open('lot1-' + Math.random())
    const actions = createActions(store)
    await actions.completeOnboarding({ name: 'A', ritual: { days: [1, 2, 3, 4, 5], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'Mochi', waterMl: 2000, equipment: ['tapis', 'corde'] })
    const r1 = await actions.logRecipe('shakshuka', '2026-10-20', 'diner', 1)
    const r2 = await actions.logRecipe('shakshuka', '2026-10-20', 'diner', 2)
    expect(r1?.existed).toBe(false)
    expect(r2?.existed).toBe(true)
    const rows = store.snapshot().food_entries
    expect(rows).toHaveLength(1)
    expect(rows[0].kcal).toBe(recipeById('shakshuka')!.nutrition!.kcal * 2)
    await expect(actions.saveFoodEntry({ day: '2026-10-20', meal: 'diner', source: 'rapide', ref: null, name: 'Croque au jambon', brand: null, quantity: 1, unit: 'portion', grams: 0, portion_label: null, per100: null, kcal: 400, protein: 0, carbs: 0, fat: 0, fiber: 0, details: {}, category: null })).rejects.toThrow('PORC')
    await expect(actions.saveUserRecipe({ id: 'p', title: 'Quiche', minutes: 30, servings: 2, ingredients: [{ name: '100 g de lardons', qty: null, unit: '', aisle: '' }], steps: [], tags: [] })).rejects.toThrow('PORC')
    expect(store.snapshot().profiles[0].water_goal_ml).toBe(2000)
    expect(store.snapshot().notification_preferences[0].hydration_times).toHaveLength(5)
    store.close()
  })
  it('eau : ajout en millilitres, modification et suppression d\'une entrée', async () => {
    const store = await DataStore.open('lot1-eau-' + Math.random())
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'M', waterMl: 1800, equipment: [] })
    await actions.addWater('2026-10-20', 330)
    await actions.addWater('2026-10-20', 150)
    const [a] = store.snapshot().water_logs
    await actions.updateWater(a.id, 500)
    expect(waterMl(store.snapshot(), '2026-10-20')).toBe(store.snapshot().water_logs.find(w => w.id !== a.id)!.ml! + 500)
    await actions.deleteWater(a.id)
    expect(store.snapshot().water_logs).toHaveLength(1)
    store.close()
  })
  it('mise à niveau locale : 2 L et 5 rappels d\'eau pour un profil existant, une seule fois', async () => {
    const store = await DataStore.open('lot1-up-' + Math.random())
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'M', waterMl: 2000, equipment: [] })
    const p = store.snapshot().profiles[0]
    const np = store.snapshot().notification_preferences[0]
    // simule un profil d'avant la mise à jour
    await store.commit([{ type: 'put', table: 'profiles', row: { ...p, water_goal_ml: undefined, settings: { ...p.settings, upgrades: [] } } as any },
      { type: 'put', table: 'notification_preferences', row: { ...np, hydration: false, hydration_times: ['10:30', '14:30', '16:30'] } }], { derive: false })
    await actions.ensureUpgrades()
    expect(store.snapshot().profiles[0].water_goal_ml).toBe(2000)
    expect(store.snapshot().notification_preferences[0]).toMatchObject({ hydration: true, hydration_times: ['09:30', '11:30', '13:30', '15:30', '18:30'] })
    await actions.updateNotifPrefs({ hydration: false })
    await actions.ensureUpgrades()
    expect(store.snapshot().notification_preferences[0].hydration).toBe(false)
    store.close()
  })
})

export const _unused = defaultCommitments
