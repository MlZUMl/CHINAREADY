// Sources d'aliments du journal : table Ciqual (Anses, embarquée dans l'appli),
// Open Food Facts (produits de marque, recherche et code-barres, appelée depuis le téléphone),
// aliments personnels. Toutes passent par le contrôle « sans porc ».
import type { CustomFood, FoodPortion, Nutrients } from '../data/types'
import { porkVerdict, type PorkVerdict } from './pork'

export interface FoodItem {
  source: 'ciqual' | 'off' | 'perso'
  ref: string
  name: string
  brand: string | null
  per100: Nutrients
  /** liquide : quantité saisie en ml */
  liquid: boolean
  /** masse volumique (g par ml) pour les liquides */
  density: number
  portions: FoodPortion[]
  category: string | null
  pork: PorkVerdict
  image?: string | null
  barcode?: string | null
}

// ------------------------------------------------------------------ Ciqual
interface CiqualFile { aliments: (string | number | null)[][]; sous_groupes: Record<string, string> }
let ciqualPromise: Promise<FoodItem[]> | null = null
let ciqualCache: FoodItem[] | null = null

export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9%]+/g, ' ').trim()

const CATEGORY: Record<string, string> = {
  '0201': 'legumes', '0202': 'feculents', '0203': 'legumineuses', '0204': 'fruits', '0205': 'oleagineux',
  '0301': 'feculents', '0302': 'feculents', '0401': 'proteines', '0402': 'proteines', '0404': 'proteines', '0405': 'proteines',
  '0406': 'proteines', '0407': 'proteines', '0408': 'proteines', '0409': 'proteines', '0410': 'proteines', '0411': 'proteines',
  '0501': 'laitiers', '0502': 'laitiers', '0503': 'laitiers', '0504': 'laitiers', '0601': 'boissons', '0602': 'boissons', '0603': 'boissons',
  '0701': 'sucre', '0702': 'sucre', '0703': 'sucre', '0704': 'sucre', '0705': 'sucre', '0706': 'sucre', '0709': 'sucre', '0801': 'sucre', '0802': 'sucre', '0803': 'sucre',
  '0901': 'matieres-grasses', '0902': 'matieres-grasses', '0903': 'matieres-grasses',
}

export function ciqualRowToItem(a: (string | number | null)[]): FoodItem {
  const [code, nom, sg, kcal, p, c, f, fib, sug] = a as [number, string, string, number | null, number | null, number | null, number | null, number | null, number | null]
  const name = String(nom)
  const liquid = isLiquid(name, String(sg))
  return {
    source: 'ciqual', ref: String(code), name, brand: null,
    per100: { kcal: kcal ?? 0, protein: p ?? 0, carbs: c ?? 0, fat: f ?? 0, fiber: fib ?? 0, sugar: sug ?? undefined },
    liquid, density: /huile/i.test(name) ? 0.92 : 1, portions: guessPortions(name, String(sg)), category: CATEGORY[String(sg)] ?? null, pork: 'ok',
  }
}

/** Charge la table Ciqual (une fois). Les aliments au statut « porc incertain » sont exclus. */
export function loadCiqual(base = './'): Promise<FoodItem[]> {
  if (ciqualCache) return Promise.resolve(ciqualCache)
  ciqualPromise ??= fetch(base + 'data/ciqual.json')
    .then(r => { if (!r.ok) throw new Error('Table Ciqual indisponible'); return r.json() as Promise<CiqualFile> })
    .then(d => (ciqualCache = d.aliments.filter(a => !a[9]).map(ciqualRowToItem)))
    .catch(e => { ciqualPromise = null; throw e })
  return ciqualPromise
}

/** Recherche plein texte tolérante (accents, ordre des mots). Les aliments bruts et courts passent en premier. */
export function searchFoods(items: FoodItem[], query: string, limit = 40): FoodItem[] {
  const tokens = normalize(query).split(' ').filter(t => t.length >= 2 || /\d/.test(t))
  if (!tokens.length) return []
  const scored: { it: FoodItem; score: number }[] = []
  for (const it of items) {
    const n = normalize(it.name + ' ' + (it.brand ?? ''))
    const words = n.split(' ')
    let score = 0, ok = true
    for (const t of tokens) {
      const exact = words.some(w => w === t || w === t + 's' || w + 's' === t)
      const start = exact || words.some(w => w.startsWith(t))
      if (!start && !n.includes(t)) { ok = false; break }
      score += exact ? 6 : start ? 4 : 1
    }
    if (!ok) continue
    if (n.startsWith(tokens[0])) score += 5
    if (/\bcru(e|es|s)?\b/.test(n)) score += 1
    if (/preemballe|appertise/.test(n)) score -= 1
    score -= n.length / 40
    scored.push({ it, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.it)
}

function isLiquid(name: string, sg: string): boolean {
  if (/^060/.test(sg) || sg === '0501' || sg === '0102' || sg === '1101') return true
  return /^(lait|boisson|jus|nectar|soupe|bouillon|huile|vinaigre|sirop|eau |the |cafe |smoothie|limonade|soda)/i.test(normalize(name) + ' ')
}

/** Portions usuelles proposées en plus des grammes. */
export function guessPortions(name: string, sg: string): FoodPortion[] {
  const n = normalize(name)
  const P = (label: string, grams: number): FoodPortion => ({ label, grams })
  if (/^oeuf/.test(n)) return [P('1 œuf moyen', 55), P('2 œufs', 110)]
  if (/^(pain|baguette)/.test(n)) return n.includes('mie') ? [P('1 tranche', 25)] : [P('1 tranche', 40), P('1/4 de baguette', 60)]
  if (/^yaourt|^fromage blanc|skyr/.test(n)) return [P('1 pot', 125), P('1 bol', 200)]
  if (/^fromage|^camembert|^emmental|^comte|^feta|^mozzarella|^parmesan|^chevre/.test(n)) return [P('1 portion', 30)]
  if (/^lait|^boisson/.test(n)) return [P('1 verre', 200), P('1 bol', 300)]
  if (/^huile/.test(n)) return [P('1 c. à soupe', 10), P('1 c. à café', 4)]
  if (/^beurre|margarine/.test(n)) return [P('1 noisette', 5), P('1 c. à soupe', 15)]
  if (/^(riz|pates|semoule|quinoa|boulgour|couscous|lentille|pois chiche|haricot)/.test(n)) return /cuit|appertis/.test(n) ? [P('1 assiette', 200), P('1 portion', 150)] : [P('1 portion crue', 70)]
  if (/^pomme de terre|^patate/.test(n)) return [P('1 moyenne', 150)]
  if (/^pomme\b/.test(n)) return [P('1 pomme', 150)]
  if (/^banane/.test(n)) return [P('1 banane', 120)]
  if (/^orange/.test(n)) return [P('1 orange', 150)]
  if (/^kiwi/.test(n)) return [P('1 kiwi', 75)]
  if (/^poire/.test(n)) return [P('1 poire', 160)]
  if (/^clementine|^mandarine/.test(n)) return [P('1 fruit', 60)]
  if (/^(fraise|framboise|myrtille|cerise|raisin)/.test(n)) return [P('1 bol', 125)]
  if (/^avocat/.test(n)) return [P('1/2 avocat', 70)]
  if (/^tomate/.test(n)) return n.includes('cerise') ? [P('5 tomates cerises', 75)] : [P('1 tomate', 100)]
  if (/^(chocolat)/.test(n)) return [P('1 carré', 5), P('1 barre', 20)]
  if (/^(biscuit|cookie|gateau)/.test(n)) return [P('1 biscuit', 10)]
  if (/^(amande|noix|noisette|cacahuete|pistache)/.test(n)) return [P('1 poignée', 25)]
  if (/^(miel|confiture|sucre|sirop)/.test(n)) return [P('1 c. à café', 7), P('1 c. à soupe', 20)]
  if (sg.startsWith('040')) return [P('1 portion', 120)]
  if (sg === '0201') return [P('1 portion', 150)]
  if (sg === '0204') return [P('1 fruit moyen', 130)]
  return []
}

// ------------------------------------------------------------------ Open Food Facts
const OFF = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_size,serving_quantity,quantity,product_quantity_unit,ingredients_text,ingredients_text_fr,categories_tags,labels_tags,image_front_small_url'

export function offToItem(p: any): FoodItem | null {
  if (!p) return null
  const nu = p.nutriments ?? {}
  const kcal = num(nu['energy-kcal_100g']) ?? (num(nu['energy_100g']) !== null ? Math.round(num(nu['energy_100g'])! / 4.184) : null)
  if (kcal === null) return null
  const name = String(p.product_name_fr || p.product_name || p.generic_name_fr || '').trim()
  if (!name) return null
  const qty = String(p.quantity ?? '')
  const liquid = /\b\d+([.,]\d+)?\s*(ml|cl|l)\b/i.test(qty) || p.product_quantity_unit === 'ml' || nu['energy-kcal_unit'] === 'ml'
  const portions: FoodPortion[] = []
  const sq = num(p.serving_quantity)
  if (sq && sq > 0 && sq < 2000) portions.push({ label: p.serving_size ? `1 portion (${String(p.serving_size).slice(0, 24)})` : '1 portion', grams: sq })
  const ingredients = String(p.ingredients_text_fr || p.ingredients_text || '')
  return {
    source: 'off', ref: String(p.code), name, brand: p.brands ? String(p.brands).split(',')[0].trim() : null,
    per100: { kcal, protein: num(nu.proteins_100g) ?? 0, carbs: num(nu.carbohydrates_100g) ?? 0, fat: num(nu.fat_100g) ?? 0, fiber: num(nu.fiber_100g) ?? 0, sugar: num(nu.sugars_100g) ?? undefined },
    liquid, density: 1, portions, category: null,
    pork: porkVerdict({ name, ingredients, categories: p.categories_tags ?? [], labels: p.labels_tags ?? [] }),
    image: p.image_front_small_url ?? null, barcode: String(p.code),
  }
}

const num = (x: unknown): number | null => {
  const n = typeof x === 'string' ? Number(x.replace(',', '.')) : typeof x === 'number' ? x : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Recherche de produits de marque. Les produits contenant du porc sont retirés des résultats. */
export async function searchOff(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&lc=fr&fields=${FIELDS}`
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(r.status === 429 ? 'Trop de recherches d\'affilée : réessaie dans une minute.' : 'Open Food Facts ne répond pas pour le moment.')
  const d = await r.json()
  return (d.products ?? []).map(offToItem).filter((x: FoodItem | null): x is FoodItem => Boolean(x) && x!.pork !== 'porc')
}

/** Produit par code-barres. null = inconnu de la base. Les produits avec porc reviennent avec pork = 'porc' (à refuser). */
export async function productByBarcode(code: string, signal?: AbortSignal): Promise<FoodItem | null> {
  const r = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal, headers: { Accept: 'application/json' } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error('Open Food Facts ne répond pas pour le moment.')
  const d = await r.json()
  if (d.status === 0 || !d.product) return null
  return offToItem({ code, ...d.product })
}

export function customToItem(c: CustomFood): FoodItem {
  return {
    source: 'perso', ref: c.id, name: c.name, brand: c.brand, per100: c.per100, liquid: c.unit === 'ml', density: 1,
    portions: c.portions, category: null, pork: porkVerdict({ name: c.name, ingredients: c.name }) === 'porc' ? 'porc' : 'ok', barcode: c.barcode,
  }
}

export const isBarcode = (s: string) => /^[0-9]{8,14}$/.test(s.trim())
