// Recettes originales façon « box repas », SANS PORC (contrôle permanent).
// Le catalogue vient de data/recettes.json : une copie est embarquée dans l'appli (hors ligne),
// et la version en ligne (elan/data/recettes.json sur GitHub) la remplace au démarrage si elle
// est valide — on peut donc ajouter ou corriger des recettes sans reconstruire l'appli.
// Toute recette dont le texte mentionne du porc est écartée, même si le fichier la contient.
import type { Ingredient, MealMarker, MealPlan, Nutrients, UserRecipe } from '../data/types'
import bundled from '../content/recettes.json'
import { recipeHasPork } from './pork'

export interface RecipeIngredient extends Ingredient { grams: number | null; ciqual: number | null; pantry?: boolean }
export interface RecipePhoto { url: string; page: string; credit: string }

export interface Recipe {
  id: string
  title: string
  minutes: number
  moment: 'midi-soir' | 'matin' | 'gouter'
  tags: string[]
  emoji: string
  photo: RecipePhoto | null
  ingredients: RecipeIngredient[]
  steps: string[]
  markers: MealMarker[]
  /** valeurs pour UNE portion (null si inconnues, ex. recette perso sans valeurs) */
  nutrition: Nutrients | null
  /** coût estimé par portion, en euros */
  cost: number | null
  allergens: string[]
  /** recette du catalogue (quantités pour 1 portion) ou recette perso (pour `servings` personnes) */
  catalog: boolean
  servings: number
  sourceUrl?: string | null
}

interface RawRecipe {
  id: string; titre: string; minutes: number; moment: Recipe['moment']; tags: string[]; emoji?: string
  photo?: { url: string; page: string; credit?: string } | null
  ingredients: { label: string; qty: number | null; unit: string; grams?: number | null; ciqual?: number | null; rayon: string; placard?: boolean }[]
  etapes: string[]
  nutrition?: { kcal: number; proteines: number; glucides: number; lipides: number; fibres: number; sucres?: number } | null
  cout?: number | null; allergenes?: string[]; marqueurs?: string[]
}

const MARKERS: MealMarker[] = ['proteines', 'legumes', 'feculents', 'fruit', 'fait_maison', 'plaisir']

/** Convertit et valide une recette du fichier JSON. Renvoie null si elle est invalide ou contient du porc. */
export function parseRecipe(r: RawRecipe): Recipe | null {
  if (!r || typeof r.id !== 'string' || typeof r.titre !== 'string' || !Array.isArray(r.ingredients) || !Array.isArray(r.etapes)) return null
  const ingredients: RecipeIngredient[] = r.ingredients.map(i => ({
    name: String(i.label), qty: typeof i.qty === 'number' ? i.qty : null, unit: String(i.unit ?? ''), aisle: String(i.rayon ?? 'Épicerie'),
    grams: typeof i.grams === 'number' ? i.grams : null, ciqual: typeof i.ciqual === 'number' ? i.ciqual : null, pantry: Boolean(i.placard),
  }))
  const recipe: Recipe = {
    id: r.id, title: r.titre, minutes: Number(r.minutes) || 0, moment: ['midi-soir', 'matin', 'gouter'].includes(r.moment) ? r.moment : 'midi-soir',
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [], emoji: r.emoji || '🍽️',
    photo: r.photo?.url && /^https:\/\//.test(r.photo.url) ? { url: r.photo.url, page: r.photo.page, credit: r.photo.credit ?? 'Pexels' } : null,
    ingredients, steps: r.etapes.map(String),
    markers: (r.marqueurs ?? ['fait_maison']).filter((m): m is MealMarker => MARKERS.includes(m as MealMarker)),
    nutrition: r.nutrition ? { kcal: r.nutrition.kcal, protein: r.nutrition.proteines, carbs: r.nutrition.glucides, fat: r.nutrition.lipides, fiber: r.nutrition.fibres, sugar: r.nutrition.sucres } : null,
    cost: typeof r.cout === 'number' ? r.cout : null, allergens: r.allergenes ?? [], catalog: true, servings: 1,
  }
  if (recipeHasPork(recipe)) return null
  return recipe
}

export function parseCatalog(doc: unknown): Recipe[] {
  const list = (doc as { recettes?: RawRecipe[] })?.recettes
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: Recipe[] = []
  for (const raw of list) {
    const r = parseRecipe(raw)
    if (r && !seen.has(r.id)) { seen.add(r.id); out.push(r) }
  }
  return out
}

/** Catalogue courant (modifié sur place quand la version en ligne arrive). */
export const RECIPES: Recipe[] = parseCatalog(bundled)

/** Remplace le catalogue par la version en ligne si elle est exploitable. Renvoie vrai si elle a été adoptée. */
export async function loadRemoteCatalog(base = './', fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await fetcher(base + 'data/recettes.json', { cache: 'no-cache' })
    if (!r.ok) return false
    const list = parseCatalog(await r.json())
    if (list.length < 10) return false
    RECIPES.splice(0, RECIPES.length, ...list)
    return true
  } catch {
    return false
  }
}

export function userRecipeToRecipe(u: UserRecipe): Recipe {
  return {
    id: u.id, title: u.title, minutes: u.minutes ?? 0, moment: 'midi-soir', tags: u.tags, emoji: '📝',
    photo: u.photo_url && /^https:\/\//.test(u.photo_url) ? { url: u.photo_url, page: u.source_url ?? u.photo_url, credit: 'ma photo' } : null,
    ingredients: u.ingredients.map(i => ({ ...i, grams: null, ciqual: null })), steps: u.steps, markers: ['fait_maison'],
    nutrition: u.nutrition ?? null, cost: null, allergens: [], catalog: false, servings: Math.max(1, u.servings), sourceUrl: u.source_url ?? null,
  }
}

export function recipeById(id: string, user: UserRecipe[] = []): Recipe | undefined {
  const r = RECIPES.find(r => r.id === id)
  if (r) return r
  const u = user.find(u => u.id === id)
  return u ? userRecipeToRecipe(u) : undefined
}

export function allRecipes(user: UserRecipe[] = []): Recipe[] {
  return [...RECIPES, ...user.map(userRecipeToRecipe)]
}

/** Lien de recherche HelloFresh (simple lien : aucune donnée n'est récupérée sur leur site). */
export const helloFreshUrl = (title: string) => `https://www.hellofresh.fr/recipes/search?q=${encodeURIComponent(title)}`

export const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten', lait: 'Lait', 'œufs': 'Œufs', poissons: 'Poissons', 'crustacés': 'Crustacés', soja: 'Soja', 'sésame': 'Sésame',
  'fruits à coque': 'Fruits à coque', moutarde: 'Moutarde', 'céleri': 'Céleri', sulfites: 'Sulfites', arachides: 'Arachides', lupin: 'Lupin', mollusques: 'Mollusques',
}

export const formatEuros = (x: number) => x.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

// ------------------------------------------------------------------ liste de courses
export interface ShoppingItem { key: string; name: string; qty: number | null; unit: string; aisle: string; pantry: boolean; recipes: string[] }

const round = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 4) / 4)

export function shoppingList(plan: MealPlan | undefined, user: UserRecipe[] = []): ShoppingItem[] {
  if (!plan) return []
  const map = new Map<string, ShoppingItem>()
  for (const slot of plan.slots) {
    const r = recipeById(slot.recipe_id, user)
    if (!r) continue
    const factor = r.catalog ? slot.portions : slot.portions / Math.max(1, r.servings)
    for (const ing of r.ingredients) {
      const key = `${ing.name.toLowerCase()}|${ing.unit}`
      const prev = map.get(key)
      const qty = ing.qty === null ? null : ing.qty * factor
      if (prev) {
        prev.qty = prev.qty === null || qty === null ? null : prev.qty + qty
        if (!prev.recipes.includes(r.title)) prev.recipes.push(r.title)
      } else {
        map.set(key, { key, name: ing.name, qty, unit: ing.unit, aisle: ing.aisle, pantry: Boolean(ing.pantry), recipes: [r.title] })
      }
    }
  }
  return [...map.values()].map(x => ({ ...x, qty: x.qty === null ? null : round(x.qty) }))
    .sort((a, b) => Number(a.pantry) - Number(b.pantry) || a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name))
}

const PLURAL: Record<string, string> = { 'pièce': 'pièces', tranche: 'tranches', gousse: 'gousses', 'poignée': 'poignées', feuille: 'feuilles', 'boîte': 'boîtes', pincée: 'pincées', petite: 'petites', noisette: 'noisettes', bouquet: 'bouquets' }

export function formatQty(item: Pick<ShoppingItem, 'qty' | 'unit'>): string {
  if (item.qty === null) return ''
  const q = Number.isInteger(item.qty) ? String(item.qty) : String(Math.round(item.qty * 100) / 100).replace('.', ',')
  const unit = item.qty >= 2 && PLURAL[item.unit] ? PLURAL[item.unit] : item.unit
  return `${q} ${unit}`
}

export const TAG_LABELS: Record<string, string> = {
  vegetarien: 'végétarien', boeuf: 'bœuf', rapide: 'rapide', batch: 'à préparer d\'avance', four: 'au four', mijote: 'mijoté', reconfort: 'réconfort',
  fraicheur: 'fraîcheur', leger: 'léger', 'anti-gaspi': 'anti-gaspi', 'sans cuisson': 'sans cuisson', plaisir: 'plaisir', dessert: 'dessert',
}

/** Texte prêt à donner à Claude dans Chrome pour remplir un panier drive. */
export function claudeCartPrompt(items: ShoppingItem[], store = 'mon drive habituel'): string {
  const lines = items.filter(i => !i.pantry).map(i => `- ${i.name}${i.qty !== null ? ' : ' + formatQty(i) : ''}`)
  const pantry = items.filter(i => i.pantry).map(i => i.name)
  return [
    `Remplis mon panier sur ${store} avec cette liste de courses.`,
    'Règles : aucun produit contenant du porc ou un dérivé du porc (lardons, jambon, gélatine de porc, saindoux…) ; aucun produit contenant de l\'alcool ;',
    'vérifie la liste des ingrédients en cas de doute ; prends le meilleur rapport qualité-prix, en formats adaptés aux quantités ; ne valide pas la commande, laisse-moi vérifier le panier.',
    '',
    ...lines,
    ...(pantry.length ? ['', `À vérifier dans mes placards (n'ajoute que si je te le confirme) : ${pantry.join(', ')}.`] : []),
  ].join('\n')
}
