// Points et boutique : attribution fiable (une fois par jour et par objectif), solde, achats, équipement.
import { describe, it, expect } from 'vitest'
import { baseSnap, workout } from '../helpers'
import { deriveOps, totalXp } from '../../src/domain/rewards'
import {
  SHOP, balance, equipList, expectedPoints, featuredItem, goalsDone, ownedItems, pointsEarned, priceOf, shopItem, etaText, DAILY_POINTS,
} from '../../src/domain/shop'
import { DataStore } from '../../src/data/store'
import { createActions } from '../../src/app/actions'
import type { FoodEntry, RewardGrant, Snapshot } from '../../src/data/types'

const food = (day: string, meal: FoodEntry['meal'], kcal = 300): FoodEntry => ({
  id: `${day}-${meal}-${kcal}`, day, meal, source: 'rapide', ref: null, name: 'Repas', brand: null, quantity: 1, unit: 'portion', grams: 0, portion_label: null,
  per100: null, kcal, protein: 0, carbs: 0, fat: 0, fiber: 0, details: {}, category: null, at: day + 'T12:00:00Z', created_at: '', updated_at: '',
})
const water = (day: string, ml: number) => ({ id: 'e' + day + ml, day, at: day + 'T09:00:00Z', glasses: 1, ml, created_at: '', updated_at: '' })

/** Applique le dérivateur comme le ferait le stockage. */
function derive(s: Snapshot, now: Date): Snapshot {
  const grants = deriveOps(s, now).filter(o => o.type === 'put' && o.table === 'reward_grants').map(o => (o as { row: RewardGrant }).row)
  return { ...s, reward_grants: [...s.reward_grants, ...grants] }
}
const pts = (s: Snapshot) => s.reward_grants.filter(g => g.kind === 'points').map(g => `${g.id}=${g.points}`).sort()

describe('gains quotidiens', () => {
  it('300 séance + 50 calories + 50 eau = 400 au plus par jour, une seule fois', () => {
    let s = baseSnap()
    s.workouts = [workout('2026-10-20', 20), workout('2026-10-20', 30)]
    s.food_entries = [food('2026-10-20', 'dejeuner'), food('2026-10-20', 'diner')]
    s.water_logs = [water('2026-10-20', 2000)]
    const now = new Date('2026-10-20T20:00:00+02:00')
    s = derive(s, now)
    expect(pts(s)).toEqual(['points:calories:2026-10-20=50', 'points:eau:2026-10-20=50', 'points:seance:2026-10-20=300'])
    // Recalculer mille fois ne redonne rien
    s = derive(derive(s, now), now)
    expect(pointsEarned(s)).toBe(400)
    // Les points ne comptent pas dans l'expérience
    expect(totalXp(s)).toBe(s.reward_grants.reduce((n, g) => n + g.xp, 0))
    expect(s.reward_grants.filter(g => g.kind === 'points').every(g => g.xp === 0)).toBe(true)
  })
  it('seulement si l\'action est réellement validée', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 5)] // sous la version minimale (10 min)
    s.food_entries = [food('2026-10-20', 'dejeuner'), food('2026-10-20', 'dejeuner', 120)] // un seul repas
    s.water_logs = [water('2026-10-20', 1900)]
    expect(goalsDone(s, '2026-10-20')).toEqual({ seance: false, calories: false, eau: false })
    expect(expectedPoints(s, '2026-10-20')).toEqual([])
  })
  it('anti-abus : un jour ancien rempli après coup ne rapporte rien ; la veille, oui', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-10', 20), workout('2026-10-19', 20)]
    const ids = expectedPoints(s, '2026-10-20').map(p => p.id)
    expect(ids).toContain('points:seance:2026-10-19')
    expect(ids).not.toContain('points:seance:2026-10-10')
  })
  it('bonus de régularité : +200 une fois par semaine dès 3 journées complètes', () => {
    let s = baseSnap()
    const days = ['2026-10-19', '2026-10-20', '2026-10-22']
    for (const d of days) {
      s.workouts.push(workout(d, 20))
      s.food_entries.push(food(d, 'dejeuner'), food(d, 'diner'))
      s.water_logs.push(water(d, 2000))
      s = derive(s, new Date(d + 'T21:00:00+02:00'))
    }
    expect(s.reward_grants.filter(g => g.id === 'points:bonus-semaine:2026-10-19')).toHaveLength(1)
    expect(pointsEarned(s)).toBe(3 * 400 + 200)
    s = derive(s, new Date('2026-10-23T21:00:00+02:00'))
    expect(s.reward_grants.filter(g => g.id.startsWith('points:bonus'))).toHaveLength(1)
  })
})

describe('boutique', () => {
  it('catalogue équilibré : 3 rayons, 3 raretés, prix croissants', () => {
    expect(new Set(SHOP.map(i => i.id)).size).toBe(SHOP.length)
    for (const slot of ['tenue', 'coiffure', 'accessoire']) for (const tier of ['commun', 'rare', 'premium'])
      expect(SHOP.some(i => i.slot === slot && i.tier === tier), slot + tier).toBe(true)
    const max = (t: string) => Math.max(...SHOP.filter(i => i.tier === t).map(i => i.price))
    const min = (t: string) => Math.min(...SHOP.filter(i => i.tier === t).map(i => i.price))
    expect(max('commun')).toBeLessThan(min('rare'))
    expect(max('rare')).toBeLessThan(min('premium'))
    expect(min('commun')).toBeLessThanOrEqual(DAILY_POINTS.seance) // une séance suffit pour le premier objet
    const total = SHOP.reduce((n, i) => n + i.price, 0)
    expect(total / 2200).toBeGreaterThan(15) // plus de 15 semaines même au rythme maximal
  })
  it('sélection de la semaine : un objet rare ou premium à −20 %, stable dans la semaine', () => {
    const f = featuredItem('2026-10-19')
    expect(f.tier).not.toBe('commun')
    expect(priceOf(f, '2026-10-21')).toBe(Math.round(f.price * 0.8 / 10) * 10)
    expect(priceOf(f, '2026-10-26')).toBe(featuredItem('2026-10-26').id === f.id ? priceOf(f, '2026-10-26') : f.price)
  })
  it('un seul objet par emplacement ; les accessoires gagnés restent', () => {
    let list = ['noeud', 'frange']
    list = equipList(list, 'couettes')
    expect(list).toEqual(['noeud', 'couettes'])
    list = equipList(list, 'sweat')
    expect(list).toEqual(['noeud', 'couettes', 'sweat'])
    expect(equipList(list, 'sweat')).toEqual(['noeud', 'couettes'])
    expect(etaText(250)).toBe('environ 1 journée réussie')
    expect(etaText(5000)).toBe('environ 2 semaines de régularité')
  })
})

describe('achats (stockage réel)', () => {
  it('déduit le bon prix, débloque et équipe ; refuse sans assez de points ou en double', async () => {
    const store = await DataStore.open('shop-' + Math.random())
    store.setDeriver(snap => deriveOps(snap)) // comme dans l'appli (AppProvider)
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1, 2, 3, 4, 5], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'Mochi', waterMl: 2000, equipment: ['tapis'] })
    await expect(actions.buyItem('frange')).rejects.toThrow('SOLDE')
    // Séance du jour validée : le stockage attribue 300 points dans la même écriture
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await actions.saveWorkout({ day, started_at: d.toISOString(), ended_at: d.toISOString(), kind: 'guidee', activity: 'renfo', program: null, planned_minutes: 20, actual_minutes: 20, version: 'usual', completed: true, source: 'rituel', energy: 3, note: null })
    await actions.saveWorkout({ day, started_at: d.toISOString(), ended_at: d.toISOString(), kind: 'guidee', activity: 'renfo', program: null, planned_minutes: 20, actual_minutes: 20, version: 'usual', completed: true, source: 'libre', energy: 3, note: null })
    expect(balance(store.snapshot())).toBe(300)
    const item = shopItem('frange')!
    const paid = await actions.buyItem('frange')
    expect(paid).toBe(priceOf(item, day))
    expect(balance(store.snapshot())).toBe(300 - paid)
    expect(ownedItems(store.snapshot()).has('frange')).toBe(true)
    expect(store.snapshot().companion_profiles[0].accessories).toContain('frange')
    await expect(actions.buyItem('frange')).rejects.toThrow('DEJA')
    await expect(actions.buyItem('halo')).rejects.toThrow('SOLDE')
    await actions.toggleCosmetic('frange')
    expect(store.snapshot().companion_profiles[0].accessories).not.toContain('frange')
    expect(store.snapshot().shop_purchases).toHaveLength(1) // retirer n'efface pas l'achat
    store.close()
  })
})

describe('boutique de l\'avatar', () => {
  it('tenues, coiffures et accessoires pour l\'avatar, mêmes raretés', async () => {
    const { SHOP, avatarEquip, avatarLook, avatarKey } = await import('../../src/domain/shop')
    const av = SHOP.filter(i => i.target === 'avatar')
    expect(av.filter(i => i.slot === 'tenue').length).toBeGreaterThanOrEqual(10)
    expect(av.filter(i => i.slot === 'coiffure').length).toBeGreaterThanOrEqual(10)
    expect(av.filter(i => i.slot === 'accessoire').every(i => i.spot)).toBe(true)
    for (const tier of ['commun', 'rare', 'premium']) expect(av.some(i => i.tier === tier)).toBe(true)
    // un objet par emplacement ; lunettes et boucles d'oreilles se cumulent ; les choix de départ restent
    let eq: Record<string, string> = { 'chambre:table': 'lampe-douce' }
    eq = avatarEquip(eq, 'av-queue')
    eq = avatarEquip(eq, 'av-tresse')
    eq = avatarEquip(eq, 'av-lunettes')
    eq = avatarEquip(eq, 'av-boucles')
    expect(eq).toEqual({ 'chambre:table': 'lampe-douce', 'perso:coiffure': 'av-tresse', 'perso:yeux': 'av-lunettes', 'perso:oreilles': 'av-boucles' })
    expect(avatarLook({ style: 'longs', outfit: 'jogging', equipped: eq })).toEqual({ style: 'av-tresse', outfit: 'jogging', extras: ['av-lunettes', 'av-boucles'] })
    eq = avatarEquip(eq, 'av-tresse') // retirer
    expect(avatarLook({ style: 'longs', outfit: 'jogging', equipped: eq }).style).toBe('longs')
    expect(avatarKey(av.find(i => i.id === 'av-couronne')!)).toBe('perso:tete')
  })
  it('achat pour l\'avatar : débloqué, porté, compagnon inchangé', async () => {
    const { DataStore } = await import('../../src/data/store')
    const store = await DataStore.open('shop-av-' + Math.random())
    store.setDeriver(snap => deriveOps(snap))
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1, 2, 3, 4, 5, 6, 7], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'Mochi', waterMl: 2000, equipment: [] })
    await actions.createAvatar({ character: 'aube', style: 'longs', outfit: 'jogging', universe: 'cocon', name: 'Lina' })
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await actions.saveWorkout({ day, started_at: d.toISOString(), ended_at: d.toISOString(), kind: 'guidee', activity: 'renfo', program: null, planned_minutes: 20, actual_minutes: 20, version: 'usual', completed: true, source: 'rituel', energy: 3, note: null })
    const before = store.snapshot().companion_profiles[0].accessories
    await actions.buyItem('av-queue')
    const s = store.snapshot()
    expect(s.avatar_profiles[0].equipped['perso:coiffure']).toBe('av-queue')
    expect(s.companion_profiles[0].accessories).toEqual(before)
    await actions.toggleCosmetic('av-queue')
    expect(store.snapshot().avatar_profiles[0].equipped['perso:coiffure']).toBeUndefined()
    store.close()
  })
})
