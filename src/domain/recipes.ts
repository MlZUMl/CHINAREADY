// Recettes halal façon « box repas » : quantités pour UNE portion, étapes simples.
// Aucune valeur calorique : le suivi alimentaire de l'appli se fait sans chiffres.
import type { Ingredient, MealPlan, UserRecipe } from '../data/types'

export interface Recipe {
  id: string
  title: string
  minutes: number
  moment: 'midi-soir' | 'matin' | 'gouter'
  tags: string[]
  emoji: string
  ingredients: (Ingredient & { pantry?: boolean })[]
  steps: string[]
  markers: ('proteines' | 'legumes' | 'feculents' | 'fruit' | 'fait_maison' | 'plaisir')[]
}

const BOUCHERIE = 'Boucherie halal'
const POISSON = 'Poissonnerie'
const FL = 'Fruits et légumes'
const CREM = 'Crèmerie et œufs'
const EPI = 'Épicerie'
const BOUL = 'Boulangerie'
const PLACARD = 'Placard (à vérifier)'

const i = (name: string, qty: number | null, unit: string, aisle: string, pantry = false) => ({ name, qty, unit, aisle, pantry })

export const RECIPES: Recipe[] = [
  { id: 'poulet-citron-four', title: 'Poulet rôti au citron et légumes du four', minutes: 45, moment: 'midi-soir', emoji: '🍋', tags: ['poulet', 'four', 'batch'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Cuisses de poulet halal', 1, 'pièce', BOUCHERIE), i('Pommes de terre grenaille', 200, 'g', FL), i('Carottes', 1, 'pièce', FL), i('Oignon rouge', 0.5, 'pièce', FL), i('Citron', 0.5, 'pièce', FL), i('Ail', 1, 'gousse', FL), i('Thym', 1, 'c. à café', PLACARD, true), i('Huile d\'olive', 1, 'c. à soupe', PLACARD, true)],
    steps: ['Préchauffe le four à 200 °C.', 'Coupe les pommes de terre en deux, les carottes en bâtonnets et l\'oignon en quartiers.', 'Dispose légumes et poulet sur une plaque, arrose d\'huile, ajoute ail écrasé, thym, sel et poivre.', 'Presse le demi-citron dessus et glisse les écorces entre les légumes.', 'Enfourne 35 à 40 minutes, jusqu\'à ce que le poulet soit doré et bien cuit.'] },
  { id: 'bowl-teriyaki', title: 'Bowl de poulet teriyaki, riz et brocoli', minutes: 25, moment: 'midi-soir', emoji: '🥢', tags: ['poulet', 'rapide'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Blanc de poulet halal', 130, 'g', BOUCHERIE), i('Riz basmati', 70, 'g', EPI), i('Brocoli', 150, 'g', FL), i('Sauce soja', 1.5, 'c. à soupe', EPI), i('Miel', 1, 'c. à café', EPI), i('Gingembre frais', 1, 'cm', FL), i('Graines de sésame', 1, 'c. à café', PLACARD, true)],
    steps: ['Fais cuire le riz selon le paquet.', 'Cuis le brocoli en fleurettes 5 minutes à la vapeur ou dans l\'eau bouillante.', 'Coupe le poulet en morceaux et fais-le dorer 6 à 8 minutes à la poêle.', 'Mélange soja, miel et gingembre râpé, verse sur le poulet et laisse napper 1 minute.', 'Sers riz, brocoli et poulet dans un bol, parsème de sésame.'] },
  { id: 'salade-grecque-poulet', title: 'Salade grecque au poulet grillé', minutes: 20, moment: 'midi-soir', emoji: '🥗', tags: ['poulet', 'rapide', 'fraicheur'], markers: ['proteines', 'legumes', 'fait_maison'],
    ingredients: [i('Blanc de poulet halal', 120, 'g', BOUCHERIE), i('Concombre', 0.5, 'pièce', FL), i('Tomates', 2, 'pièce', FL), i('Feta', 40, 'g', CREM), i('Olives noires', 6, 'pièce', EPI), i('Oignon rouge', 0.25, 'pièce', FL), i('Origan', 1, 'pincée', PLACARD, true), i('Huile d\'olive', 1, 'c. à soupe', PLACARD, true), i('Pain pita', 1, 'pièce', BOUL)],
    steps: ['Fais griller le poulet assaisonné d\'origan 5 à 6 minutes de chaque côté.', 'Coupe concombre, tomates et oignon rouge.', 'Ajoute la feta en cubes et les olives.', 'Arrose d\'huile d\'olive, sale légèrement, poivre.', 'Tranche le poulet sur la salade et sers avec la pita tiède.'] },
  { id: 'shakshuka', title: 'Shakshuka aux œufs et poivrons', minutes: 25, moment: 'midi-soir', emoji: '🍳', tags: ['vegetarien', 'rapide'], markers: ['proteines', 'legumes', 'fait_maison'],
    ingredients: [i('Œufs', 2, 'pièce', CREM), i('Tomates concassées', 200, 'g', EPI), i('Poivron rouge', 0.5, 'pièce', FL), i('Oignon', 0.5, 'pièce', FL), i('Cumin', 0.5, 'c. à café', PLACARD, true), i('Paprika doux', 0.5, 'c. à café', PLACARD, true), i('Pain complet', 1, 'tranche', BOUL)],
    steps: ['Fais revenir l\'oignon et le poivron émincés 5 minutes.', 'Ajoute épices et tomates, laisse mijoter 8 minutes.', 'Creuse deux puits, casse les œufs dedans.', 'Couvre et laisse cuire 5 à 6 minutes, jusqu\'à ce que les blancs soient pris.', 'Sers avec le pain grillé.'] },
  { id: 'saumon-patate-douce', title: 'Saumon au four, patate douce et haricots verts', minutes: 30, moment: 'midi-soir', emoji: '🐟', tags: ['poisson', 'four'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Pavé de saumon', 1, 'pièce', POISSON), i('Patate douce', 1, 'petite', FL), i('Haricots verts', 150, 'g', FL), i('Citron', 0.25, 'pièce', FL), i('Aneth', 1, 'c. à café', PLACARD, true), i('Huile d\'olive', 1, 'c. à soupe', PLACARD, true)],
    steps: ['Préchauffe le four à 200 °C.', 'Coupe la patate douce en cubes, arrose d\'huile et enfourne 15 minutes.', 'Ajoute le saumon sur la plaque, avec aneth et un filet de citron, et poursuis 12 minutes.', 'Pendant ce temps, cuis les haricots verts 8 minutes à l\'eau bouillante.', 'Sers le tout ensemble.'] },
  { id: 'curry-pois-chiches', title: 'Curry doux de pois chiches au lait de coco', minutes: 30, moment: 'midi-soir', emoji: '🍛', tags: ['vegetarien', 'batch'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Pois chiches cuits', 120, 'g', EPI), i('Lait de coco', 100, 'ml', EPI), i('Tomates concassées', 100, 'g', EPI), i('Oignon', 0.5, 'pièce', FL), i('Carotte', 1, 'pièce', FL), i('Curry doux', 1, 'c. à café', PLACARD, true), i('Riz basmati', 70, 'g', EPI)],
    steps: ['Lance la cuisson du riz.', 'Fais revenir oignon et carotte en dés 5 minutes, ajoute le curry.', 'Ajoute tomates, lait de coco et pois chiches.', 'Laisse mijoter 15 minutes à feu doux.', 'Sers sur le riz.'] },
  { id: 'tajine-poulet', title: 'Tajine de poulet aux carottes et olives', minutes: 50, moment: 'midi-soir', emoji: '🫕', tags: ['poulet', 'batch', 'mijote'], markers: ['proteines', 'legumes', 'fait_maison'],
    ingredients: [i('Hauts de cuisse de poulet halal', 2, 'pièce', BOUCHERIE), i('Carottes', 2, 'pièce', FL), i('Oignon', 0.5, 'pièce', FL), i('Olives vertes', 6, 'pièce', EPI), i('Citron confit', 0.25, 'pièce', EPI), i('Ras el hanout', 1, 'c. à café', PLACARD, true), i('Coriandre fraîche', 1, 'bouquet', FL), i('Semoule', 60, 'g', EPI)],
    steps: ['Fais dorer le poulet dans une cocotte, réserve.', 'Fais revenir l\'oignon émincé avec le ras el hanout.', 'Remets le poulet, ajoute les carottes en rondelles et un verre d\'eau.', 'Couvre et laisse mijoter 30 minutes, ajoute olives et citron confit les 10 dernières minutes.', 'Sers avec la semoule et la coriandre.'] },
  { id: 'boulettes-boeuf', title: 'Boulettes de bœuf sauce tomate et semoule', minutes: 35, moment: 'midi-soir', emoji: '🍅', tags: ['boeuf', 'batch'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Bœuf haché halal', 120, 'g', BOUCHERIE), i('Tomates concassées', 200, 'g', EPI), i('Oignon', 0.5, 'pièce', FL), i('Persil', 1, 'bouquet', FL), i('Cumin', 0.5, 'c. à café', PLACARD, true), i('Semoule', 60, 'g', EPI)],
    steps: ['Mélange le bœuf avec persil haché, cumin, sel et poivre, forme des boulettes.', 'Fais-les dorer 5 minutes à la poêle.', 'Ajoute oignon émincé et tomates, laisse mijoter 15 minutes.', 'Prépare la semoule avec de l\'eau bouillante.', 'Sers les boulettes nappées de sauce sur la semoule.'] },
  { id: 'wraps-poulet', title: 'Wraps de poulet croustillant et crudités', minutes: 25, moment: 'midi-soir', emoji: '🌯', tags: ['poulet', 'rapide'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Blanc de poulet halal', 120, 'g', BOUCHERIE), i('Tortillas', 2, 'pièce', BOUL), i('Salade', 1, 'poignée', FL), i('Tomate', 1, 'pièce', FL), i('Yaourt nature', 2, 'c. à soupe', CREM), i('Chapelure', 2, 'c. à soupe', EPI), i('Paprika', 0.5, 'c. à café', PLACARD, true)],
    steps: ['Préchauffe le four à 210 °C.', 'Coupe le poulet en lanières, roule-les dans chapelure et paprika.', 'Enfourne 15 minutes en retournant à mi-cuisson.', 'Mélange le yaourt avec sel, poivre et un peu de citron si tu veux.', 'Garnis les tortillas de salade, tomate, poulet et sauce.'] },
  { id: 'omelette-champignons', title: 'Omelette aux champignons et persil', minutes: 15, moment: 'midi-soir', emoji: '🍄', tags: ['vegetarien', 'rapide'], markers: ['proteines', 'legumes', 'fait_maison'],
    ingredients: [i('Œufs', 3, 'pièce', CREM), i('Champignons de Paris', 100, 'g', FL), i('Persil', 0.5, 'bouquet', FL), i('Salade verte', 1, 'poignée', FL), i('Pain complet', 1, 'tranche', BOUL)],
    steps: ['Fais revenir les champignons émincés 5 minutes.', 'Bats les œufs avec le persil, sel et poivre.', 'Verse sur les champignons et cuis à feu doux 3 à 4 minutes.', 'Plie l\'omelette et sers avec la salade et le pain.'] },
  { id: 'soupe-lentilles', title: 'Soupe de lentilles corail au cumin', minutes: 30, moment: 'midi-soir', emoji: '🥣', tags: ['vegetarien', 'batch', 'reconfort'], markers: ['proteines', 'legumes', 'fait_maison'],
    ingredients: [i('Lentilles corail', 70, 'g', EPI), i('Carotte', 1, 'pièce', FL), i('Oignon', 0.5, 'pièce', FL), i('Tomates concassées', 100, 'g', EPI), i('Cumin', 1, 'c. à café', PLACARD, true), i('Citron', 0.25, 'pièce', FL), i('Pain', 1, 'tranche', BOUL)],
    steps: ['Fais revenir oignon et carotte en dés avec le cumin.', 'Ajoute lentilles rincées, tomates et 400 ml d\'eau.', 'Laisse cuire 20 minutes.', 'Mixe, ajuste le sel, ajoute un filet de citron.', 'Sers avec le pain.'] },
  { id: 'bowl-thon', title: 'Bowl de thon, riz, avocat et concombre', minutes: 20, moment: 'midi-soir', emoji: '🥑', tags: ['poisson', 'rapide', 'fraicheur'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Thon au naturel', 1, 'boîte', EPI), i('Riz', 70, 'g', EPI), i('Avocat', 0.5, 'pièce', FL), i('Concombre', 0.5, 'pièce', FL), i('Tomates cerises', 6, 'pièce', FL), i('Sauce soja', 1, 'c. à soupe', EPI)],
    steps: ['Fais cuire le riz et laisse-le tiédir.', 'Coupe avocat, concombre et tomates.', 'Égoutte le thon.', 'Dresse le bol et arrose d\'un peu de sauce soja.'] },
  { id: 'chili-boeuf', title: 'Chili au bœuf et haricots rouges', minutes: 40, moment: 'midi-soir', emoji: '🌶️', tags: ['boeuf', 'batch'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Bœuf haché halal', 110, 'g', BOUCHERIE), i('Haricots rouges', 100, 'g', EPI), i('Tomates concassées', 150, 'g', EPI), i('Poivron', 0.5, 'pièce', FL), i('Oignon', 0.5, 'pièce', FL), i('Épices chili douces', 1, 'c. à café', PLACARD, true), i('Riz', 60, 'g', EPI)],
    steps: ['Fais revenir oignon et poivron 5 minutes.', 'Ajoute le bœuf et fais-le colorer.', 'Ajoute épices, tomates et haricots égouttés.', 'Laisse mijoter 20 minutes.', 'Sers avec le riz.'] },
  { id: 'pates-poulet-tomates', title: 'Pâtes complètes au poulet, tomates cerises et basilic', minutes: 20, moment: 'midi-soir', emoji: '🍝', tags: ['poulet', 'rapide'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Pâtes complètes', 80, 'g', EPI), i('Blanc de poulet halal', 110, 'g', BOUCHERIE), i('Tomates cerises', 10, 'pièce', FL), i('Ail', 1, 'gousse', FL), i('Basilic', 0.5, 'bouquet', FL), i('Parmesan', 15, 'g', CREM)],
    steps: ['Cuis les pâtes.', 'Fais dorer le poulet en dés avec l\'ail.', 'Ajoute les tomates cerises coupées en deux, laisse compoter 4 minutes.', 'Mélange avec les pâtes, le basilic et le parmesan.'] },
  { id: 'brochettes-yaourt', title: 'Brochettes de poulet au yaourt et taboulé', minutes: 35, moment: 'midi-soir', emoji: '🍢', tags: ['poulet', 'fraicheur'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Blanc de poulet halal', 130, 'g', BOUCHERIE), i('Yaourt nature', 2, 'c. à soupe', CREM), i('Semoule', 50, 'g', EPI), i('Tomate', 1, 'pièce', FL), i('Concombre', 0.25, 'pièce', FL), i('Menthe fraîche', 0.5, 'bouquet', FL), i('Citron', 0.5, 'pièce', FL), i('Paprika', 0.5, 'c. à café', PLACARD, true)],
    steps: ['Mélange le poulet en cubes avec yaourt, paprika, sel ; laisse 10 minutes.', 'Prépare la semoule, laisse refroidir.', 'Ajoute tomate, concombre, menthe et jus de citron.', 'Enfile le poulet sur des pics et fais-le griller 10 à 12 minutes.', 'Sers avec le taboulé.'] },
  { id: 'parmentier-patate-douce', title: 'Parmentier de patate douce au bœuf', minutes: 50, moment: 'midi-soir', emoji: '🥧', tags: ['boeuf', 'four', 'batch', 'reconfort'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Bœuf haché halal', 110, 'g', BOUCHERIE), i('Patate douce', 1, 'pièce', FL), i('Oignon', 0.5, 'pièce', FL), i('Carotte', 1, 'pièce', FL), i('Lait', 30, 'ml', CREM), i('Emmental râpé', 15, 'g', CREM)],
    steps: ['Cuis la patate douce en cubes 15 minutes, écrase-la avec le lait.', 'Fais revenir oignon, carotte râpée et bœuf.', 'Préchauffe le four à 200 °C.', 'Dans un plat : la viande, puis la purée, puis le fromage.', 'Gratine 15 minutes.'] },
  { id: 'cabillaud-papillote', title: 'Cabillaud en papillote, légumes et riz', minutes: 30, moment: 'midi-soir', emoji: '🐠', tags: ['poisson', 'four', 'leger'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Dos de cabillaud', 1, 'pièce', POISSON), i('Carotte', 1, 'pièce', FL), i('Poireau', 0.5, 'pièce', FL), i('Citron', 0.5, 'pièce', FL), i('Riz', 60, 'g', EPI), i('Huile d\'olive', 1, 'c. à café', PLACARD, true)],
    steps: ['Préchauffe le four à 190 °C et lance le riz.', 'Émince carotte et poireau en julienne.', 'Sur une feuille de papier cuisson : légumes, poisson, citron, huile, sel, poivre.', 'Ferme la papillote et enfourne 18 minutes.', 'Sers avec le riz.'] },
  { id: 'salade-quinoa', title: 'Salade de quinoa, pois chiches et feta', minutes: 20, moment: 'midi-soir', emoji: '🫘', tags: ['vegetarien', 'rapide', 'batch', 'fraicheur'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Quinoa', 60, 'g', EPI), i('Pois chiches cuits', 80, 'g', EPI), i('Tomates cerises', 8, 'pièce', FL), i('Concombre', 0.25, 'pièce', FL), i('Feta', 30, 'g', CREM), i('Citron', 0.5, 'pièce', FL), i('Huile d\'olive', 1, 'c. à soupe', PLACARD, true)],
    steps: ['Cuis le quinoa 12 minutes, rince à l\'eau froide.', 'Coupe tomates et concombre, émiette la feta.', 'Mélange tout avec les pois chiches.', 'Assaisonne d\'huile d\'olive, citron, sel et poivre.'] },
  { id: 'frittata', title: 'Frittata pommes de terre et poivrons', minutes: 30, moment: 'midi-soir', emoji: '🥚', tags: ['vegetarien', 'batch'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Œufs', 3, 'pièce', CREM), i('Pommes de terre', 1, 'pièce', FL), i('Poivron', 0.5, 'pièce', FL), i('Oignon', 0.25, 'pièce', FL), i('Salade verte', 1, 'poignée', FL)],
    steps: ['Cuis les pommes de terre en fines rondelles 8 minutes à la poêle.', 'Ajoute poivron et oignon émincés, 5 minutes.', 'Verse les œufs battus et assaisonnés.', 'Couvre et cuis à feu doux 10 minutes.', 'Sers en parts avec la salade.'] },
  { id: 'kefta-agneau', title: 'Kefta d\'agneau, sauce yaourt-menthe et salade', minutes: 30, moment: 'midi-soir', emoji: '🥙', tags: ['agneau'], markers: ['proteines', 'legumes', 'fait_maison'],
    ingredients: [i('Agneau haché halal', 120, 'g', BOUCHERIE), i('Yaourt nature', 3, 'c. à soupe', CREM), i('Menthe fraîche', 0.5, 'bouquet', FL), i('Tomate', 1, 'pièce', FL), i('Concombre', 0.25, 'pièce', FL), i('Pain pita', 1, 'pièce', BOUL), i('Cumin', 0.5, 'c. à café', PLACARD, true)],
    steps: ['Mélange l\'agneau avec cumin, menthe hachée, sel et poivre ; forme des boudins.', 'Fais-les griller 8 à 10 minutes.', 'Mélange le yaourt avec un peu de menthe.', 'Sers avec tomate, concombre et pita.'] },
  { id: 'riz-saute', title: 'Riz sauté aux œufs et petits légumes', minutes: 20, moment: 'midi-soir', emoji: '🍚', tags: ['vegetarien', 'rapide', 'anti-gaspi'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Riz cuit (de la veille)', 150, 'g', EPI), i('Œufs', 2, 'pièce', CREM), i('Petits pois surgelés', 60, 'g', EPI), i('Carotte', 1, 'pièce', FL), i('Oignon nouveau', 1, 'pièce', FL), i('Sauce soja', 1, 'c. à soupe', EPI)],
    steps: ['Fais sauter carotte en dés et petits pois 4 minutes.', 'Ajoute le riz et fais-le dorer.', 'Pousse sur le côté, brouille les œufs, puis mélange tout.', 'Ajoute la sauce soja et l\'oignon nouveau.'] },
  { id: 'poulet-basquaise', title: 'Poulet basquaise et riz', minutes: 40, moment: 'midi-soir', emoji: '🫑', tags: ['poulet', 'batch', 'mijote'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Hauts de cuisse de poulet halal', 2, 'pièce', BOUCHERIE), i('Poivrons', 1, 'pièce', FL), i('Tomates concassées', 150, 'g', EPI), i('Oignon', 0.5, 'pièce', FL), i('Ail', 1, 'gousse', FL), i('Chorizo de volaille halal (facultatif)', 20, 'g', BOUCHERIE), i('Riz', 60, 'g', EPI)],
    steps: ['Fais dorer le poulet, réserve.', 'Fais revenir oignon, ail et poivrons en lanières.', 'Ajoute tomates, chorizo et poulet ; couvre.', 'Laisse mijoter 25 minutes.', 'Sers avec le riz.'] },
  { id: 'veloute-butternut', title: 'Velouté de butternut et tartine au fromage frais', minutes: 35, moment: 'midi-soir', emoji: '🎃', tags: ['vegetarien', 'reconfort', 'batch'], markers: ['legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Butternut', 300, 'g', FL), i('Carotte', 1, 'pièce', FL), i('Oignon', 0.5, 'pièce', FL), i('Fromage frais', 30, 'g', CREM), i('Pain complet', 2, 'tranche', BOUL), i('Œuf dur (facultatif)', 1, 'pièce', CREM)],
    steps: ['Fais revenir l\'oignon, ajoute butternut et carotte en cubes.', 'Couvre d\'eau et cuis 20 minutes.', 'Mixe, sale et poivre.', 'Tartine le pain de fromage frais.', 'Sers ensemble, avec un œuf dur pour plus de tenue.'] },
  { id: 'bol-petit-dej', title: 'Bol yaourt, flocons d\'avoine, fruits et dattes', minutes: 5, moment: 'matin', emoji: '🥣', tags: ['vegetarien', 'rapide', 'sans cuisson'], markers: ['proteines', 'fruit', 'feculents', 'fait_maison'],
    ingredients: [i('Yaourt grec', 150, 'g', CREM), i('Flocons d\'avoine', 30, 'g', EPI), i('Fruit de saison', 1, 'pièce', FL), i('Dattes', 2, 'pièce', EPI)],
    steps: ['Verse le yaourt dans un bol.', 'Ajoute les flocons, le fruit coupé et les dattes en morceaux.'] },
  { id: 'tartine-avocat-oeuf', title: 'Tartine avocat et œuf', minutes: 10, moment: 'matin', emoji: '🥑', tags: ['vegetarien', 'rapide'], markers: ['proteines', 'legumes', 'feculents', 'fait_maison'],
    ingredients: [i('Pain complet', 1, 'tranche', BOUL), i('Avocat', 0.5, 'pièce', FL), i('Œuf', 1, 'pièce', CREM), i('Tomates cerises', 4, 'pièce', FL)],
    steps: ['Fais griller le pain.', 'Cuis l\'œuf mollet 6 minutes.', 'Écrase l\'avocat sur la tartine, ajoute l\'œuf et les tomates.'] },
  { id: 'mousse-chocolat', title: 'Mousse au chocolat noir', minutes: 15, moment: 'gouter', emoji: '🍫', tags: ['dessert', 'plaisir', 'vegetarien'], markers: ['plaisir', 'fait_maison'],
    ingredients: [i('Chocolat noir 70 %', 25, 'g', EPI), i('Œuf', 1, 'pièce', CREM), i('Fleur de sel', 1, 'pincée', PLACARD, true)],
    steps: ['Fais fondre le chocolat doucement.', 'Sépare le blanc du jaune ; mélange le jaune au chocolat tiédi.', 'Monte le blanc en neige avec une pincée de sel.', 'Incorpore délicatement, verse dans une verrine.', 'Laisse prendre 2 heures au frais, puis savoure.'] },
  { id: 'pomme-four', title: 'Pomme au four à la cannelle', minutes: 25, moment: 'gouter', emoji: '🍎', tags: ['dessert', 'plaisir', 'vegetarien'], markers: ['fruit', 'plaisir', 'fait_maison'],
    ingredients: [i('Pomme', 1, 'pièce', FL), i('Cannelle', 0.5, 'c. à café', PLACARD, true), i('Miel', 1, 'c. à café', EPI), i('Yaourt nature', 2, 'c. à soupe', CREM)],
    steps: ['Préchauffe le four à 180 °C.', 'Évide la pomme, saupoudre de cannelle, ajoute le miel.', 'Enfourne 20 minutes.', 'Sers tiède avec le yaourt.'] },
]

export function recipeById(id: string, user: UserRecipe[] = []): (Recipe | (UserRecipe & { emoji: string; moment: 'midi-soir'; markers: never[] })) | undefined {
  const r = RECIPES.find(r => r.id === id)
  if (r) return r
  const u = user.find(u => u.id === id)
  return u ? { ...u, emoji: '📝', moment: 'midi-soir', markers: [] } : undefined
}

// ------------------------------------------------------------------ liste de courses
export interface ShoppingItem { key: string; name: string; qty: number | null; unit: string; aisle: string; pantry: boolean; recipes: string[] }

const round = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 4) / 4)

export function shoppingList(plan: MealPlan | undefined, user: UserRecipe[] = []): ShoppingItem[] {
  if (!plan) return []
  const map = new Map<string, ShoppingItem>()
  for (const slot of plan.slots) {
    const r = recipeById(slot.recipe_id, user)
    if (!r) continue
    const factor = 'servings' in r && !RECIPES.some(x => x.id === r.id) ? slot.portions / Math.max(1, r.servings) : slot.portions
    for (const ing of r.ingredients as (Ingredient & { pantry?: boolean })[]) {
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

export function formatQty(item: Pick<ShoppingItem, 'qty' | 'unit'>): string {
  if (item.qty === null) return ''
  const q = Number.isInteger(item.qty) ? String(item.qty) : String(item.qty).replace('.', ',')
  return `${q} ${item.unit}`
}

/** Texte prêt à donner à Claude dans Chrome pour remplir un panier drive. */
export function claudeCartPrompt(items: ShoppingItem[], store = 'mon drive habituel'): string {
  const lines = items.filter(i => !i.pantry).map(i => `- ${i.name}${i.qty !== null ? ' : ' + formatQty(i) : ''}`)
  const pantry = items.filter(i => i.pantry).map(i => i.name)
  return [
    `Remplis mon panier sur ${store} avec cette liste de courses.`,
    'Règles : viande et charcuterie uniquement halal ; aucun produit contenant du porc ou de l\'alcool ;',
    'prends le meilleur rapport qualité-prix, en formats adaptés aux quantités ; ne valide pas la commande, laisse-moi vérifier le panier.',
    '',
    ...lines,
    ...(pantry.length ? ['', `À vérifier dans mes placards (n'ajoute que si je te le confirme) : ${pantry.join(', ')}.`] : []),
  ].join('\n')
}
