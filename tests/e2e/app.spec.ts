// Parcours réels dans le navigateur (Chromium), écran de 360 × 740 px.
import { test, expect, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) }

// Mardi 20 octobre 2026, 17 h 20 (heure de Paris) : jour de rendez-vous, juste après l'heure prévue.
const TUESDAY_1720 = new Date('2026-10-20T17:20:00+02:00')

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'aucun défilement horizontal').toBeLessThanOrEqual(0)
}

async function onboard(page: Page, name = 'Lina') {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Élan' })).toBeVisible()
  await noHorizontalScroll(page)
  await page.getByPlaceholder('Ton prénom').fill(name)
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(page.getByRole('heading', { name: 'Ton rendez-vous sportif' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByRole('heading', { name: 'Choisis ton compagnon' })).toBeVisible()
  await page.getByRole('button', { name: /Lapin/ }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByRole('heading', { name: 'Eau et matériel' })).toBeVisible()
  await expect(page.getByText('2,0 L', { exact: true })).toBeVisible()
  // Matériel : coche visible, récapitulatif avant validation
  await page.getByRole('button', { name: /Corde à sauter/ }).click()
  await expect(page.getByRole('button', { name: /Corde à sauter/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('recap-materiel')).toContainText('Tapis, Corde à sauter')
  await expect(page.getByTestId('recap-materiel')).toContainText('cardio à la corde')
  await page.getByRole('button', { name: 'Valider ce matériel et continuer' }).click()
  await expect(page.getByRole('heading', { name: 'Sauvegarde et rappels' })).toBeVisible()
  await page.getByRole('button', { name: 'Plus tard' }).click()
  await page.getByRole('button', { name: 'Entrer dans mon univers' }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`(Bonjour|Bonsoir) ${name}`) })).toBeVisible()
  // Nouveau compte : aucune « reprise » proposée, rien n'est compté avant le premier jour
  await expect(page.getByText("Une seule petite action aujourd'hui")).toHaveCount(0)
}

// Image PNG 1 × 1 servie à la place des photos Pexels (aucun appel réseau réel pendant les tests).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: TUESDAY_1720 })
  await page.route('https://images.pexels.com/**', r => r.fulfill({ contentType: 'image/png', body: PNG }))
  // Open Food Facts : jamais appelé pour de vrai pendant les tests
  await page.route('https://world.openfoodfacts.org/**', r => r.fulfill({ status: 503, body: '' }))
})

// Réponses Open Food Facts simulées
const OFF_SEARCH = { products: [
  { code: '3250390000001', product_name_fr: 'Galettes de riz chocolat noir', brands: 'Marque A', quantity: '100 g', serving_quantity: 12, serving_size: '1 galette (12 g)',
    nutriments: { 'energy-kcal_100g': 470, proteins_100g: 7, carbohydrates_100g: 63, fat_100g: 20, fiber_100g: 6 }, ingredients_text_fr: 'riz, chocolat noir 50 %' },
  { code: '3250390000002', product_name_fr: 'Galettes saveur lardons', brands: 'Marque B', nutriments: { 'energy-kcal_100g': 480 }, ingredients_text_fr: 'maïs, arôme, poudre de porc' },
] }
const OFF_PORK = { status: 1, product: { product_name_fr: 'Saucisses de Strasbourg', brands: 'Marque C', nutriments: { 'energy-kcal_100g': 280, proteins_100g: 12, carbohydrates_100g: 2, fat_100g: 25 }, ingredients_text_fr: 'viande de porc, eau, sel' } }
const OFF_YAOURT = { status: 1, product: { product_name_fr: 'Skyr nature', brands: 'Marque D', quantity: '450 g', serving_quantity: 150, serving_size: '150 g',
  nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10, carbohydrates_100g: 4, fat_100g: 0.2 }, ingredients_text_fr: 'lait écrémé, ferments' } }

test('accueil, rituel de 17 h 15 en mode épuisée, séance réelle, récompense unique et persistance', async ({ page }) => {
  await onboard(page)
  await shot(page, '01-accueil')
  await noHorizontalScroll(page)
  // Le rendez-vous est à l'heure : la carte invite à commencer
  await expect(page.getByText("C'est l'heure. On y va ?")).toBeVisible()

  // Check-in : épuisée, 10 minutes
  await page.getByRole('radio', { name: 'Épuisée' }).first().click()
  await page.getByRole('group', { name: 'Temps disponible' }).getByRole('button', { name: '10 min' }).click()
  await page.getByRole('button', { name: "C'est noté" }).click()
  await expect(page.getByText('Épuisée · 10 min dispo')).toBeVisible()
  await page.getByRole('button', { name: /Préparer ma séance/ }).click()

  // Écran de préparation : options douces, rien sur l'alimentation
  await expect(page.getByRole('heading', { name: 'Journée à petite énergie' })).toBeVisible()
  await expect(page.getByText('Pas besoin de tout réussir aujourd')).toBeVisible()
  for (const b of ['Séance courte', 'Reporter de 15 min', "Repos aujourd'hui"]) await expect(page.getByRole('button', { name: new RegExp(b) })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/kcal|calorie|manger moins/i)
  await shot(page, '02-rituel-epuisee')
  await noHorizontalScroll(page)

  // Séance réelle : démarrer, pause, reprendre, puis laisser le temps s'écouler
  await page.getByRole('button', { name: /Je commence \(10 min\)/ }).click()
  await expect(page.getByText(/Mobilité et étirements · 10 min/)).toBeVisible()
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('en pause')).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre' }).click()
  await shot(page, '03-seance')
  await page.clock.fastForward(10 * 60_000 + 2_000)
  await expect(page.getByRole('heading', { name: '10 min pour toi' })).toBeVisible()
  await expect(page.locator('main').getByText(/points d'expérience/)).toBeVisible()
  await expect(page.locator('main').getByText('Tapis de yoga')).toBeVisible()
  await shot(page, '04-recap')
  const xpBefore = await page.locator('main').getByText(/\+\d+ points d'expérience/).innerText()
  expect(Number(xpBefore.match(/\d+/)![0])).toBeGreaterThan(0)

  // Rechargement : la séance est toujours là, et les récompenses ne sont pas redonnées
  await page.reload()
  await expect(page.getByRole('heading', { name: '10 min pour toi' })).toBeVisible() // le récapitulatif, pas une nouvelle séance
  await expect(page.locator('main').getByText(xpBefore)).toBeVisible()
  await page.getByRole('button', { name: "Retour à l'accueil" }).click()
  await page.getByRole('link', { name: 'Activité' }).click()
  await expect(page.getByText(/Mobilité et étirements · 10 min/).first()).toBeVisible()
  await page.getByRole('link', { name: 'Accueil' }).click()
  await expect(page.getByText(/rendez-vous honoré/i).first()).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('eau en litres : boutons rapides, objectif, modification et suppression d\'une entrée', async ({ page }) => {
  await onboard(page)
  const water = page.getByLabel('Hydratation')
  for (let i = 0; i < 4; i++) await water.getByRole('button', { name: 'Ajouter 0,5 L' }).click()
  await expect(page.getByTestId('eau-total')).toHaveText('2,0 L sur 2,0 L')
  await expect(page.getByRole('status').filter({ hasText: /Objectif d'eau atteint|Pothos|Nouvel objet/ }).first()).toBeVisible()
  // Mission du jour : facultative, objectif affiché
  await expect(page.getByLabel('Mission du jour')).toBeVisible()
  // Le journal détaillé : modifier une entrée, en supprimer une, quantité personnalisée
  await page.getByRole('link', { name: 'Repas' }).click()
  const w2 = page.getByLabel('Hydratation')
  await w2.getByRole('button', { name: /Modifier 50 cl/ }).first().click()
  await page.getByLabel('Quantité en centilitres').fill('33')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('eau-total')).toHaveText('1,83 L sur 2,0 L')
  await w2.getByRole('button', { name: /Modifier 33 cl/ }).click()
  await page.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByTestId('eau-total')).toHaveText('1,5 L sur 2,0 L')
  await w2.getByRole('button', { name: 'Autre quantité' }).click()
  await page.getByLabel('Quantité en centilitres').fill('15')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('eau-total')).toHaveText('1,65 L sur 2,0 L')
  await shot(page, '05-eau')
  await noHorizontalScroll(page)
})

test('journal alimentaire : objectif, recherche Ciqual, marques sans porc, code-barres, ajout rapide, recette idempotente', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Repas' }).click()
  // Objectif calorique calculé (Mifflin-St Jeor), modifiable
  await page.getByRole('button', { name: 'Définir mon objectif' }).click()
  await page.getByLabel('Année de naissance').fill('1996')
  await page.getByLabel('Taille en centimètres').fill('165')
  await page.getByLabel('Poids en kilos').fill('70')
  await page.getByRole('button', { name: /Légèrement active/ }).click()
  await expect(page.getByText(/1\s450 kcal par jour/)).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('kcal-restantes')).toContainText('1')
  await expect(page.getByTestId('total-dejeuner')).toHaveText('0 kcal / 505 kcal')

  // Recherche Ciqual : pomme, 150 g, recalcul en direct
  await page.getByRole('button', { name: 'Ajouter au déjeuner' }).click()
  await page.getByLabel('Rechercher un aliment').fill('pomme pulpe peau crue')
  await page.getByRole('button', { name: /^Pomme, pulpe et peau, crue/ }).first().click()
  await page.getByRole('group', { name: 'Unité' }).getByRole('button', { name: 'grammes' }).click()
  await page.getByRole('textbox', { name: 'Quantité', exact: true }).fill('150')
  await expect(page.getByTestId('kcal-quantite')).toHaveText('150 g · 78 kcal')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Ajouté au déjeuner' })).toBeVisible()

  // Marques (Open Food Facts simulé) : le produit au porc est retiré
  await page.unroute('https://world.openfoodfacts.org/**')
  await page.route('https://world.openfoodfacts.org/cgi/search.pl**', r => r.fulfill({ json: OFF_SEARCH }))
  await page.route('https://world.openfoodfacts.org/api/v2/product/3250390000009.json**', r => r.fulfill({ json: OFF_PORK }))
  await page.route('https://world.openfoodfacts.org/api/v2/product/3250390000010.json**', r => r.fulfill({ json: OFF_YAOURT }))
  await page.getByLabel('Rechercher un aliment').fill('galettes')
  await page.getByRole('button', { name: /Chercher « galettes » parmi les marques/ }).click()
  await expect(page.getByRole('button', { name: /Galettes de riz chocolat noir/ })).toBeVisible()
  await expect(page.getByText('Galettes saveur lardons')).toHaveCount(0)
  await page.getByRole('button', { name: /Galettes de riz chocolat noir/ }).click()
  await page.getByRole('textbox', { name: 'Quantité', exact: true }).fill('2')
  await expect(page.getByTestId('kcal-quantite')).toHaveText('24 g · 113 kcal')
  await page.getByRole('dialog').getByRole('group', { name: 'Repas' }).getByRole('button', { name: 'Collation' }).click()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

  // Code-barres : produit au porc refusé, produit connu ajouté
  await page.getByRole('tab', { name: 'Scanner' }).click()
  await page.getByLabel('Code-barres').fill('3250390000009')
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByRole('alert')).toContainText('contient du porc')
  await page.getByLabel('Code-barres').fill('3250390000010')
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText('Skyr nature')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

  // Ajout rapide
  await page.getByRole('tab', { name: 'Rapide' }).click()
  await page.getByLabel('Calories').fill('250')
  await page.getByRole('group', { name: 'Repas' }).last().getByRole('button', { name: 'Dîner' }).click()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByLabel('Dîner').getByText('250 kcal').first()).toBeVisible()

  // Journal : totaux par repas et pour la journée (78 + 90 + 113 + 250)
  await expect(page.getByTestId('kcal-mangees')).toHaveText('531 kcal')
  await expect(page.getByTestId('total-dejeuner')).toContainText('168 kcal')
  await shot(page, '06-journal')
  await noHorizontalScroll(page)

  // Modifier une quantité depuis le journal
  await page.getByLabel('Déjeuner').getByRole('button', { name: /Pomme, pulpe et peau/ }).click()
  await page.getByRole('textbox', { name: 'Quantité', exact: true }).fill('300')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('kcal-mangees')).toHaveText('609 kcal')

  // Recette : ajoutée deux fois au même repas = une seule ligne
  await page.getByRole('tab', { name: 'Recettes' }).click()
  await page.getByLabel('Rechercher une recette').fill('shakshuka')
  await page.getByRole('button', { name: /Shakshuka aux œufs et poivrons/ }).first().click()
  await expect(page.getByText('✓ Sans porc')).toBeVisible()
  await expect(page.getByRole('link', { name: /Voir sur HelloFresh/ })).toHaveAttribute('href', /hellofresh\.fr\/recipes\/search\?q=Shakshuka/)
  await expect(page.getByRole('link', { name: /Photo : Pexels/ })).toBeVisible()
  await shot(page, '07-recette')
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Ajouter à mon journal' }).click()
    await page.getByRole('dialog').getByRole('group', { name: 'Repas' }).getByRole('button', { name: 'Dîner' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^(Ajouter|Mettre à jour)/ }).click()
  }
  await page.goto('./#/repas?onglet=journal')
  await expect(page.getByLabel('Dîner').getByRole('button', { name: /Shakshuka/ })).toHaveCount(1)
  await expect(page.getByTestId('kcal-mangees')).toHaveText(/^1\s007 kcal$/)
  // Calories visibles sur l'accueil aussi
  await page.getByRole('link', { name: 'Accueil' }).click()
  await expect(page.getByTestId('kcal-mangees')).toHaveText(/^1\s007 kcal$/)
})

test('recettes sans porc, menu et liste de courses pour Claude', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await onboard(page)
  await page.goto('./#/repas?onglet=recettes')
  await expect(page.getByText('Toutes les recettes sont sans porc.', { exact: false })).toBeVisible()
  expect(await page.locator('.recipe-card').count()).toBeGreaterThanOrEqual(40)
  await shot(page, '08-recettes')
  // Recette perso : refusée si elle contient du porc
  await page.getByRole('button', { name: 'Ajouter ma propre recette' }).click()
  await page.getByLabel('Nom').fill('Pâtes crémeuses aux champignons')
  await page.getByLabel(/Ingrédients/).fill('200 g de pâtes\n100 g de lardons')
  await expect(page.getByRole('alert')).toContainText('porc')
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await page.getByLabel(/Ingrédients/).fill('200 g de pâtes\n100 g de champignons')
  await page.getByLabel('Lien de la recette').fill('https://exemple.fr/pates')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByRole('group', { name: 'Filtres' }).getByRole('button', { name: 'Mes recettes' }).click()
  await page.getByRole('button', { name: /Pâtes crémeuses aux champignons/ }).first().click()
  await expect(page.getByRole('link', { name: /Recette d'origine/ })).toHaveAttribute('href', 'https://exemple.fr/pates')
  await page.goBack()

  await page.getByRole('tab', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Compléter les dîners' }).click()
  await expect(page.getByRole('button', { name: 'Retirer du menu' }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Courses' }).click()
  await expect(page.getByRole('heading', { name: 'Faire remplir le panier par Claude' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Boucherie' }).or(page.getByRole('heading', { name: 'Poissonnerie' })).first()).toBeVisible()
  await page.getByRole('button', { name: /Copier la liste pour Claude/ }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/aucun produit contenant du porc/)
  expect(text).not.toMatch(/halal/i)
  expect(text).toMatch(/ne valide pas la commande/)
  await shot(page, '09-courses')
  await noHorizontalScroll(page)
})

test('capsule scellée : invisible avant la date, ouverture à la date prévue', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Progrès' }).click()
  await page.getByRole('tab', { name: 'Capsules' }).click()
  await page.getByRole('button', { name: 'Créer une capsule' }).click()
  await page.getByLabel(/Qu'aimerais-tu que ton toi du futur/).fill('Souviens-toi : tu as commencé un mardi soir, fatiguée, et tu es venue quand même.')
  await page.getByRole('button', { name: 'Sceller ma capsule' }).click()
  await page.getByRole('button', { name: 'Sceller', exact: true }).click()
  await expect(page.getByText("S'ouvre dans 30 jours")).toBeVisible()
  await page.getByText("S'ouvre dans 30 jours").click()
  await expect(page.getByRole('heading', { name: /Elle s'ouvrira le/ })).toBeVisible()
  await expect(page.getByText('Souviens-toi')).toHaveCount(0)
  await shot(page, '07-capsule-scellee')

  // 31 jours plus tard
  await page.clock.setSystemTime(new Date('2026-11-20T10:00:00+01:00'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Ouvrir ma capsule' })).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir ma capsule' }).click()
  await expect(page.getByText(/Souviens-toi : tu as commencé/)).toBeVisible()
  await expect(page.getByText('Avant / maintenant')).toBeVisible()
  await shot(page, '08-capsule-ouverte')
})

test('univers : création du personnage, décoration réelle, objets conservés', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Univers' }).click()
  await expect(page.getByRole('heading', { name: 'Crée ton personnage' })).toBeVisible()
  await page.getByRole('group', { name: 'Style' }).getByRole('button', { name: 'Voile' }).click()
  await page.getByRole('button', { name: 'Entrer dans mon univers' }).click()
  await expect(page.getByRole('img', { name: 'Scène de ton univers' })).toBeVisible()
  await expect(page.getByText(/Mes objets \(2\)/)).toBeVisible() // lampe et tapis de bienvenue
  await page.getByRole('button', { name: 'Décorer' }).click()
  await page.getByRole('button', { name: 'Emplacement libre : table' }).click()
  await page.getByRole('button', { name: /Lampe douce/ }).click()
  await page.getByRole('button', { name: 'Terminé' }).click()
  await expect(page.getByRole('button', { name: /Lampe douce \(emplacement table\)/ })).toBeVisible()
  await shot(page, '09-univers')
  await noHorizontalScroll(page)
  await page.reload()
  await expect(page.getByRole('button', { name: /Lampe douce \(emplacement table\)/ })).toBeVisible()
  // Compagnon : personnalisation
  await page.getByRole('tab', { name: 'Compagnon' }).click()
  await expect(page.getByRole('heading', { name: 'Pompon' })).toBeVisible()
  await shot(page, '10-compagnon')
})

test("engagements : l'heure modifiée est utilisée par le rituel ; repos sans culpabilité", async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Profil et réglages' }).click()
  await page.getByRole('button', { name: /Mes engagements/ }).click()
  await page.getByRole('button', { name: /Mon rendez-vous sport/ }).click()
  await page.getByLabel('Heure du rendez-vous (et du rappel)').fill('18:30')
  await expect(page.getByText(/à 18 h 30/).first()).toBeVisible()
  await shot(page, '11-engagement')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.goto('./#/')
  // 17 h 20 : le rendez-vous de 18 h 30 n'est pas encore là
  await expect(page.getByText(/Mon rendez-vous · 18 h 30/)).toBeVisible()
  await expect(page.getByText("C'est l'heure. On y va ?")).toHaveCount(0)
  // Repos « juste pas envie » : l'appli propose d'abord 5 minutes, sans reproche
  await page.getByRole('button', { name: /Préparer ma séance/ }).click()
  await page.getByRole('button', { name: /Repos aujourd'hui/ }).click()
  await page.getByRole('button', { name: "Je n'ai juste pas envie" }).click()
  await expect(page.getByText('Commence par cinq minutes, puis décide')).toBeVisible()
  await page.getByRole('button', { name: 'Repos quand même' }).click()
  await expect(page.getByText('Le repos fait partie du plan.')).toBeVisible()
  await noHorizontalScroll(page)
})

test('reprise après une pause : rien de perdu, un seul petit pas proposé', async ({ page }) => {
  await onboard(page)
  // Trois jours plus tard, sans ouvrir l'appli
  await page.clock.setSystemTime(new Date('2026-10-23T12:00:00+02:00'))
  await page.reload()
  await expect(page.getByRole('heading', { name: "Une seule petite action aujourd'hui" })).toBeVisible()
  await page.getByRole('button', { name: 'Choisir mon petit pas' }).click()
  await expect(page.getByRole('heading', { name: "Rien n'est perdu" })).toBeVisible()
  await shot(page, '12-reprise')
  await page.getByRole('button', { name: "Boire un verre d'eau" }).click()
  await expect(page.getByTestId('eau-total')).toHaveText('0,25 L sur 2,0 L')
})

test('points et boutique : 300 points pour la séance, achat, objet porté, solde conservé', async ({ page }) => {
  await onboard(page)
  await expect(page.getByTestId('solde-points')).toHaveText('0 pts')
  // Pas assez de points : l'achat est impossible et l'écart est expliqué
  await page.getByRole('button', { name: /Mes points : 0/ }).click()
  await expect(page.getByTestId('solde-boutique')).toHaveText('0 pts')
  await page.getByRole('tab', { name: 'Coiffures' }).click()
  await page.getByRole('button', { name: /^Petite frange/ }).click()
  await expect(page.getByText('Il te manque')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Acheter/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Fermer' }).click()

  // Séance réelle de 10 minutes (version minimale) => +300 points, une seule fois
  await page.goto('./#/seance?min=10&focus=mobilite&version=min&source=rituel')
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await page.clock.fastForward(10 * 60_000 + 2_000)
  await expect(page.getByRole('heading', { name: '10 min pour toi' })).toBeVisible()
  await expect(page.getByText('+300 points pour la boutique')).toBeVisible()
  await page.reload()
  await page.goto('./#/univers?onglet=boutique')
  await expect(page.getByTestId('solde-boutique')).toHaveText('300 pts')
  await expect(page.getByTestId('points-seance')).toHaveText('+300')
  await shot(page, '13-boutique')
  await noHorizontalScroll(page)

  // Achat d'un objet commun : le prix est déduit et l'objet est porté
  await page.getByRole('tab', { name: 'Coiffures' }).click()
  await page.getByRole('button', { name: /^Petite frange/ }).click()
  await expect(page.getByText('Solde après achat : 0 pts')).toBeVisible()
  await page.getByRole('button', { name: 'Acheter · 300 pts' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Petite frange : acheté/ })).toBeVisible()
  await expect(page.getByTestId('solde-boutique')).toHaveText('0 pts')
  await expect(page.getByRole('button', { name: /Petite frange, Commun, porté/ })).toBeVisible()
  // Persistance : rechargement
  await page.reload()
  await expect(page.getByTestId('solde-boutique')).toHaveText('0 pts')
  await page.getByRole('tab', { name: /Ma garde-robe \(1\)/ }).click()
  await page.getByRole('button', { name: /Petite frange/ }).click()
  await page.getByRole('button', { name: 'Retirer' }).click()
  await expect(page.getByRole('button', { name: /Petite frange, Commun, acheté/ })).toBeVisible()
  await expect(page.getByTestId('solde-boutique')).toHaveText('0 pts')
})

test('chaque écran principal tient sur un petit écran', async ({ page }) => {
  await onboard(page)
  for (const [path, name] of [['#/', 'accueil'], ['#/activite', 'activite'], ['#/repas', 'journal'], ['#/repas/ajouter?repas=dejeuner', 'ajouter'], ['#/repas?onglet=recettes', 'recettes'], ['#/repas/recette/tajine-poulet', 'recette'],
    ['#/progres', 'calendrier'], ['#/progres?onglet=regularite', 'regularite'], ['#/progres?onglet=badges', 'badges'], ['#/progres/bilan', 'bilan'],
    ['#/univers?onglet=compagnon', 'compagnon'], ['#/univers?onglet=boutique', 'boutique'], ['#/profil', 'profil'], ['#/profil/compte', 'compte'], ['#/profil/engagements', 'engagements'], ['#/reprise', 'reprise']] as const) {
    await page.goto('./' + path)
    await expect(page.locator('main').first()).toBeVisible()
    await noHorizontalScroll(page)
    await shot(page, 'ecran-' + name)
  }
})
