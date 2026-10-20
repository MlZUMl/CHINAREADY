// Contrôle « sans porc » — permanent, impossible à désactiver.
// Utilisé partout où un aliment ou une recette entre dans l'appli : catalogue de recettes
// (à la construction ET au chargement), recherche Open Food Facts, code-barres, aliments
// et recettes personnels. Dans le doute, on bloque ou on demande une vérification explicite.

export type PorkVerdict = 'ok' | 'porc' | 'inconnu'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')

// Expressions sûres retirées avant la recherche (elles contiennent un mot « à risque » sans porc).
const SAFE = [
  /\b(jambon|saucisses?|chorizo|merguez|knacks?|lardons?|rillettes?|pate|terrine|bacon|salami)\s+(de|d'|au|a la|aux|100 ?%)\s*(dinde|poulet|volaille|boeuf|veau|agneau|canard|saumon|thon|poisson|crabe|maquereau|sardines?|truite|crevettes?|legumes?|vegetal(e|es)?|soja|tofu|seitan)\b/g,
  /\b(saucisses?|jambon|chorizo|lardons?|bacon)\s+vegetal(e|es)?\b/g,
  /\b(dinde|poulet|volaille|boeuf|veau|agneau|canard|vegetal(e|es)?)\s+(facon|type)\s+(jambon|bacon|chorizo|lardons?)\b/g,
  /\bgelatine\s+(bovine|de boeuf|de poisson|halal|vegetale|d'origine vegetale)\b/g,
  /\bsans (porc|gelatine|lardons?|jambon)\b/g,
  /\b(pork|porc)[- ]free\b/g,
  /\bpate(s)? (a|de|feuilletee|brisee|sablee|a pizza)\b/g,
]

const PORK = /\b(porc|porcs|porcine?|cochon|cochons|lard|lards|lardons?|lardes?|jambons?|jambonneau|bacon|chorizo|saucissons?|saucisses?|rillettes?|pancetta|coppa|guanciale|speck|mortadelle|salami|andouilles?|andouillettes?|boudins?|chipolatas?|cervelas|saindoux|gelatine|gelatines|pork|ham|hams|gelatin|pig|swine|e441)\b/

/** Analyse un texte libre (nom, ingrédients, étapes). */
export function porkInText(text: string | null | undefined): boolean {
  if (!text) return false
  let t = norm(text)
  for (const re of SAFE) t = t.replace(re, ' ')
  return PORK.test(t)
}

// Catégories Open Food Facts qui signalent du porc.
const PORK_TAGS = /(^|:)(pork|porc|pork-meat|hams|jambons|bacons|lards|pork-sausages|saucisses-de-porc|salamis|chorizos|rillettes|cured-hams|dry-sausages|saucissons)(-|$)/

export interface PorkCheckInput {
  name?: string | null
  ingredients?: string | null
  categories?: string[] | null
  labels?: string[] | null
}

/**
 * Verdict pour un produit : « porc » (bloqué), « inconnu » (composition absente : vérification
 * demandée à l'utilisatrice), « ok ».
 */
export function porkVerdict(p: PorkCheckInput): PorkVerdict {
  if (porkInText(p.name) || porkInText(p.ingredients)) return 'porc'
  if ((p.categories ?? []).some(c => PORK_TAGS.test(c))) return 'porc'
  if (!p.ingredients || p.ingredients.trim().length < 3) return 'inconnu'
  return 'ok'
}

/** Une recette (catalogue ou perso) : titre, ingrédients et étapes. */
export function recipeHasPork(r: { title: string; ingredients: { name?: string; label?: string }[]; steps?: string[] }): boolean {
  if (porkInText(r.title)) return true
  if (r.ingredients.some(i => porkInText(i.name ?? i.label ?? ''))) return true
  return (r.steps ?? []).some(s => porkInText(s))
}
