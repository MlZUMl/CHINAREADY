// Construit public/data/recettes.json (catalogue chargé à l'exécution, modifiable sans reconstruire)
// et src/content/recettes.json (copie embarquée, utilisée hors ligne ou si le fichier distant est invalide).
//   npm run recettes
// Pour chaque recette : calories et macronutriments par portion (table Ciqual 2020, Anses),
// coût estimé, allergènes indicatifs, repères, photo Pexels — et contrôle « sans porc » bloquant.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { RECETTES } from './recettes-source.mjs'
import { recipeHasPork } from '../src/domain/pork'

type Ing = [string, number, string, number, number, string, boolean]
const root = new URL('..', import.meta.url).pathname

const ciqual = JSON.parse(readFileSync(root + 'public/data/ciqual.json', 'utf8'))
const foods = new Map<number, any[]>(ciqual.aliments.map((a: any[]) => [a[0], a]))
const excluded = new Set(readFileSync(root + 'scripts/data/ciqual-exclus-porc.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean))

// Prix indicatifs en € par kg (grande surface, France, 2026) — pour une estimation, pas un devis.
const PRIX: Record<number, number> = {
  36019: 9.5, 4023: 3, 20009: 1.6, 20034: 2, 13009: 4, 11000: 9, 11038: 40, 17270: 10, 11082: 1.5, 11015: 40,
  36017: 13, 9119: 3.5, 20057: 3.5, 11104: 8, 31008: 12, 11074: 8, 15010: 12, 20019: 2.5, 20047: 3, 12061: 14,
  13032: 10, 20238: 3, 11035: 40, 7180: 6, 22000: 5, 20048: 2.5, 20087: 4.5, 11042: 30, 11049: 30, 7110: 5,
  26036: 25, 4101: 3, 20061: 5, 11093: 40, 20532: 3, 18041: 5, 11005: 30, 11094: 40, 13033: 10, 11089: 30,
  9681: 2.5, 6250: 14, 11014: 40, 7815: 7, 20031: 4, 19593: 2.5, 7500: 4, 20056: 5, 25604: 8, 20535: 5,
  26039: 15, 13004: 7, 20172: 6, 20524: 3, 20041: 4, 9870: 3, 11033: 40, 12120: 25, 11027: 40, 19041: 1.1,
  12118: 11, 26043: 25, 20039: 3, 9340: 9, 4008: 1.8, 21504: 18, 9104: 1.5, 20084: 3, 20323: 6, 20138: 2.5,
  12805: 16, 22010: 5, 20059: 8, 19436: 4.5, 9102: 3.5, 10021: 22, 9810: 1.8, 19860: 4.5, 13067: 6, 7262: 6,
  11008: 4, 9121: 4.5, 25948: 0.3, 26264: 4, 19590: 10, 20270: 12, 11021: 8, 6201: 25, 9863: 6, 26129: 18,
  20014: 2, 15203: 15, 11048: 60, 20587: 4, 11013: 5, 11018: 3, 25947: 0.3, 20020: 3, 20064: 2.5, 13046: 8,
  36304: 14, 20097: 6, 20016: 3, 9311: 2.5, 13039: 2.5, 13011: 8, 13997: 9, 15000: 18, 13005: 2, 13028: 15,
  17130: 3, 11003: 40, 16400: 11, 31074: 15, 11025: 30, 19646: 3, 13014: 8, 13021: 4, 18100: 12,
}

// Allergènes majeurs (règlement UE 1169/2011) — indicatifs : les étiquettes font foi.
const ALLERGENES: Record<string, number[]> = {
  gluten: [7180, 7110, 7815, 7500, 9681, 9870, 9810, 9863, 7262, 26264, 9311, 11104],
  lait: [12061, 19593, 12120, 19041, 12118, 12805, 19436, 19860, 19590, 16400, 19646],
  'œufs': [22000, 22010, 9863, 26264],
  poissons: [26036, 26043, 26039, 26129],
  'crustacés': [10021],
  soja: [11104],
  'sésame': [15010, 15203],
  'fruits à coque': [15000],
  moutarde: [11021, 11013],
  'céleri': [25947, 25948],
  sulfites: [13046, 11018],
}

// Photos libres de droits (licence Pexels) — une photo différente par recette.
const PHOTOS: Record<string, number> = {
  'poulet-citron-four': 4589140, 'bowl-teriyaki': 105588, 'salade-grecque-poulet': 17194483, shakshuka: 35672958,
  'saumon-patate-douce': 5670958, 'curry-pois-chiches': 4149256, 'tajine-poulet': 2291603, 'boulettes-boeuf': 36958915,
  'wraps-poulet': 12464909, 'omelette-champignons': 27331092, 'soupe-lentilles': 40135526, 'bowl-thon': 4828099,
  'chili-boeuf': 6358974, 'pates-poulet-tomates': 10456299, 'brochettes-yaourt': 15388077, 'parmentier-patate-douce': 36040894,
  'cabillaud-papillote': 12918197, 'salade-quinoa': 36143709, frittata: 5639217, 'kefta-agneau': 32986492,
  'riz-saute': 32845321, 'poulet-basquaise': 35156470, 'veloute-butternut': 4663236, 'poulet-curry-coco': 10692534,
  'saumon-poireaux': 27672770, 'pates-crevettes-citron': 4518889, 'dhal-lentilles': 28674710, 'fajitas-poulet': 33332968,
  'burger-boeuf-maison': 4253700, 'risotto-champignons': 31779539, 'gnocchis-tomate-mozza': 31911031, 'poulet-moutarde': 31987728,
  'boeuf-brocoli-nouilles': 5836630, 'colin-pane-puree': 18303027, 'buddha-bowl': 17597408, 'quiche-sans-pate': 65173,
  'salade-lentilles-feta': 39148701, 'soupe-poulet-nouilles': 34326230, 'tajine-legumes': 2287528, 'escalope-dinde-champignons': 18265289,
  'steak-frites-four': 27643030, 'saumon-sesame-nouilles': 39641630, 'chou-fleur-roti-pois-chiches': 29283884, 'bol-petit-dej': 15378364,
  'tartine-avocat-oeuf': 7936964, 'porridge-fruits-rouges': 11532336, 'pancakes-avoine-banane': 14263510, 'oeufs-brouilles-toast': 27221311,
  'mousse-chocolat': 32172000, 'pomme-four': 39780581, 'fromage-blanc-fruits': 29516115, 'bouchees-dattes-cacao': 27850069,
}

const EMOJI: Record<string, string> = {
  'poulet-citron-four': '🍋', 'bowl-teriyaki': '🥢', 'salade-grecque-poulet': '🥗', shakshuka: '🍳', 'saumon-patate-douce': '🐟',
  'curry-pois-chiches': '🍛', 'tajine-poulet': '🫕', 'boulettes-boeuf': '🍅', 'wraps-poulet': '🌯', 'omelette-champignons': '🍄',
  'soupe-lentilles': '🥣', 'bowl-thon': '🥑', 'chili-boeuf': '🌶️', 'pates-poulet-tomates': '🍝', 'brochettes-yaourt': '🍢',
  'parmentier-patate-douce': '🥧', 'cabillaud-papillote': '🐠', 'salade-quinoa': '🫘', frittata: '🥚', 'kefta-agneau': '🥙',
  'riz-saute': '🍚', 'poulet-basquaise': '🫑', 'veloute-butternut': '🎃', 'poulet-curry-coco': '🍛', 'saumon-poireaux': '🐟',
  'pates-crevettes-citron': '🦐', 'dhal-lentilles': '🥘', 'fajitas-poulet': '🌮', 'burger-boeuf-maison': '🍔', 'risotto-champignons': '🍄',
  'gnocchis-tomate-mozza': '🍅', 'poulet-moutarde': '🍗', 'boeuf-brocoli-nouilles': '🥡', 'colin-pane-puree': '🐟', 'buddha-bowl': '🥗',
  'quiche-sans-pate': '🥧', 'salade-lentilles-feta': '🥗', 'soupe-poulet-nouilles': '🍜', 'tajine-legumes': '🫕', 'escalope-dinde-champignons': '🍽️',
  'steak-frites-four': '🥩', 'saumon-sesame-nouilles': '🍜', 'chou-fleur-roti-pois-chiches': '🥦', 'bol-petit-dej': '🥣', 'tartine-avocat-oeuf': '🥑',
  'porridge-fruits-rouges': '🫐', 'pancakes-avoine-banane': '🥞', 'oeufs-brouilles-toast': '🍳', 'mousse-chocolat': '🍫', 'pomme-four': '🍎',
  'fromage-blanc-fruits': '🍓', 'bouchees-dattes-cacao': '🌰',
}

const r1 = (x: number) => Math.round(x * 10) / 10
const errors: string[] = []
const ids = new Set<string>()
const photos = new Set<number>()

const out = (RECETTES as any[]).map(r => {
  if (ids.has(r.id)) errors.push(`${r.id} : identifiant en double`)
  ids.add(r.id)
  const ings = r.ingredients as Ing[]
  const n = { kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0, sucres: 0 }
  let cout = 0
  const groups: Record<string, number> = {}
  const allergenes = new Set<string>()
  for (const [label, , , grams, code] of ings) {
    const f = foods.get(code)
    if (!f) { errors.push(`${r.id} : code Ciqual ${code} inconnu (${label})`); continue }
    if (f[9]) errors.push(`${r.id} : ${label} → « ${f[1]} » est marqué incertain (porc possible)`)
    if (excluded.has(f[1])) errors.push(`${r.id} : ${label} → « ${f[1]} » contient du porc`)
    const k = grams / 100
    n.kcal += (f[3] ?? 0) * k; n.proteines += (f[4] ?? 0) * k; n.glucides += (f[5] ?? 0) * k
    n.lipides += (f[6] ?? 0) * k; n.fibres += (f[7] ?? 0) * k; n.sucres += (f[8] ?? 0) * k
    if (PRIX[code] === undefined) errors.push(`${r.id} : pas de prix pour ${code} (${label})`)
    cout += (PRIX[code] ?? 0) * grams / 1000
    groups[f[2]] = (groups[f[2]] ?? 0) + grams
    for (const [a, codes] of Object.entries(ALLERGENES)) if (codes.includes(code)) allergenes.add(a)
  }
  if (recipeHasPork({ title: r.titre, ingredients: ings.map(x => ({ name: x[0] })), steps: r.etapes })) errors.push(`${r.id} : le texte mentionne du porc`)
  const photo = PHOTOS[r.id]
  if (!photo) errors.push(`${r.id} : pas de photo`)
  else if (photos.has(photo)) errors.push(`${r.id} : photo ${photo} déjà utilisée`)
  photos.add(photo)
  const g = (...codes: string[]) => codes.reduce((s, c) => s + (groups[c] ?? 0), 0)
  const marqueurs = [
    n.proteines >= 15 ? 'proteines' : null,
    g('0201') >= 80 ? 'legumes' : null,
    g('0202', '0203', '0301', '0302') >= 40 ? 'feculents' : null,
    g('0204') >= 50 ? 'fruit' : null,
    'fait_maison',
    r.tags.includes('dessert') || r.tags.includes('plaisir') ? 'plaisir' : null,
  ].filter(Boolean)
  return {
    id: r.id, titre: r.titre, minutes: r.minutes, moment: r.moment, tags: r.tags, emoji: EMOJI[r.id] ?? '🍽️',
    photo: photo ? { id: photo, url: `https://images.pexels.com/photos/${photo}/pexels-photo-${photo}.jpeg?auto=compress&cs=tinysrgb&w=900`, page: `https://www.pexels.com/photo/${photo}/`, credit: 'Pexels' } : null,
    ingredients: ings.map(([label, qty, unit, grams, ciqual, rayon, placard]) => ({ label, qty, unit, grams, ciqual, rayon, placard })),
    etapes: r.etapes,
    nutrition: { kcal: Math.round(n.kcal), proteines: r1(n.proteines), glucides: r1(n.glucides), lipides: r1(n.lipides), fibres: r1(n.fibres), sucres: r1(n.sucres) },
    cout: Math.round(cout * 100) / 100,
    allergenes: [...allergenes],
    marqueurs,
    sans_porc: true,
  }
})

if (out.length < 40 || out.length > 60) errors.push(`${out.length} recettes : il en faut entre 40 et 60`)
if (errors.length) { console.error('Catalogue refusé :\n- ' + errors.join('\n- ')); process.exit(1) }

const doc = {
  version: 1,
  genere_le: new Date().toISOString().slice(0, 10),
  sources: {
    nutrition: 'Table de composition nutritionnelle Ciqual 2020 (Anses), Licence Ouverte Etalab 2.0',
    photos: 'Pexels (licence Pexels : usage libre, attribution appréciée)',
    cout: 'Estimation à partir de prix moyens en grande surface, 2026',
  },
  recettes: out,
}
const json = JSON.stringify(doc, null, 1)
writeFileSync(root + 'public/data/recettes.json', json)
mkdirSync(root + 'src/content', { recursive: true })
writeFileSync(root + 'src/content/recettes.json', json)
for (const r of out) console.log(`${r.nutrition.kcal.toString().padStart(4)} kcal  P${String(r.nutrition.proteines).padStart(5)}  ${r.cout.toFixed(2)} €  ${r.titre}`)
console.log(`\n${out.length} recettes écrites (aucune ne contient de porc).`)
