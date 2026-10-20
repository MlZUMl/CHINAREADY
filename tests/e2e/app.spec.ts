// Parcours réels dans le navigateur (Chromium), écran de 360 × 740 px.
import { test, expect, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) }

// Mardi 20 octobre 2026, 17 h 20 (heure de Paris) : jour de rendez-vous, juste après l'heure prévue.
const TUESDAY_1720 = new Date('2026-10-20T17:20:00+02:00')

async function noHorizontalScroll(page: Page) {
  // largeur réelle de l'écran (visualViewport) : un contenu trop large agrandit la page sur mobile, innerWidth le masquerait
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - (window.visualViewport?.width ?? window.innerWidth))
  expect(overflow, 'aucun défilement horizontal').toBeLessThanOrEqual(0)
}

async function onboard(page: Page, name = 'Lina', nutrition = false) {
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
  // Profil nutrition (facultatif)
  await expect(page.getByRole('heading', { name: 'Ton objectif calorique' })).toBeVisible()
  if (nutrition) {
    await page.getByLabel('Année de naissance').fill('1996')
    await page.getByLabel('Taille en centimètres').fill('165')
    await page.getByLabel('Poids en kilos').fill('70')
    await expect(page.getByTestId('objectif-accueil')).toContainText(/1\s450 kcal par jour/)
    await page.getByRole('button', { name: 'Continuer' }).click()
  } else {
    await page.getByRole('button', { name: 'Plus tard' }).click()
  }
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

test('recettes sans porc, menu adapté à l\'objectif et liste de courses pour Claude', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await onboard(page, 'Lina', true)
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
  await expect(page.getByText(/approcher 1\s450 kcal par jour/)).toBeVisible()
  await page.getByRole('button', { name: 'Créer mon menu' }).click()
  await expect(page.getByRole('dialog')).toContainText(/petit-déjeuner 365 kcal, déjeuner 505 kcal/)
  await page.getByRole('group', { name: 'Allergènes à éviter' }).getByRole('button', { name: 'Crustacés' }).click()
  await page.getByRole('button', { name: 'Composer le menu' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Menu de la semaine prêt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retirer du menu' })).toHaveCount(21)
  // chaque jour : total prévu proche de l'objectif moins la collation (1 305 kcal)
  for (const d of ['2026-10-19', '2026-10-22', '2026-10-25']) {
    const t = await page.getByTestId(`menu-kcal-${d}`).innerText()
    const kcal = Number(t.match(/≈\s*([\d\s ]+)\s*kcal/)![1].replace(/\s/g, ''))
    expect(Math.abs(kcal - 1305)).toBeLessThan(160)
  }
  // « Autre idée » remplace la recette d'un créneau
  const mardi = page.getByRole('region', { name: 'mardi 20' })
  const before = await mardi.locator('.menu-row').nth(2).innerText()
  await page.getByRole('button', { name: 'Autre idée · Soir 20' }).click()
  await expect(mardi.locator('.menu-row').nth(2)).not.toHaveText(before)
  await shot(page, '08b-menu')
  await noHorizontalScroll(page)
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
  await page.getByRole('tab', { name: 'Mon compagnon' }).click()
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
  await page.getByRole('tab', { name: 'Mon compagnon' }).click()
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
  await page.getByRole('tab', { name: 'Mon compagnon' }).click()
  await page.getByRole('tab', { name: /Ma garde-robe \(1\)/ }).click()
  await page.getByRole('button', { name: /Petite frange/ }).click()
  await page.getByRole('button', { name: 'Retirer' }).click()
  await expect(page.getByRole('button', { name: /Petite frange, Commun, acheté/ })).toBeVisible()
  await expect(page.getByTestId('solde-boutique')).toHaveText('0 pts')

  // Lendemain : nouvelle séance => +300, achat d'une coiffure pour l'avatar, visible dans l'univers
  await page.goto('./#/univers')
  await page.getByRole('button', { name: 'Entrer dans mon univers' }).click()
  await expect(page.getByRole('button', { name: 'Entrer dans mon univers' })).toHaveCount(0) // personnage enregistré
  await page.clock.setSystemTime(new Date('2026-10-21T17:20:00+02:00'))
  await page.goto('./#/seance?min=10&focus=mobilite&version=min&source=rituel')
  await page.reload()
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await page.clock.fastForward(10 * 60_000 + 2_000)
  await expect(page.getByText('+300 points pour la boutique')).toBeVisible()
  await page.goto('./#/univers?onglet=boutique')
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Mon avatar' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Coiffures' }).click()
  await page.getByRole('button', { name: /^Queue de cheval/ }).click()
  await page.getByRole('button', { name: 'Acheter · 300 pts' }).click()
  await expect(page.getByRole('button', { name: /Queue de cheval, Commun, porté/ })).toBeVisible()
  await expect(page.getByTestId('solde-boutique')).toHaveText('0 pts')
  await page.getByRole('tab', { name: 'Tenues' }).click()
  await expect(page.getByRole('button', { name: /T-shirt blanc, Commun, 300 pts/ })).toBeVisible()
  await shot(page, '13b-boutique-avatar')
  await noHorizontalScroll(page)
  await page.reload()
  await page.getByRole('tab', { name: 'Coiffures' }).click()
  await expect(page.getByRole('button', { name: /Queue de cheval, Commun, porté/ })).toBeVisible()
})

test('cycle : règles réelles vs prévues, statistiques, fertilité estimée, rapport privé, retard nuancé', async ({ page }) => {
  await onboard(page)
  await expect(page.getByTestId('cycle-sous-titre')).toHaveText('Note le premier jour de tes règles pour commencer le suivi.')
  await page.goto('./#/progres?onglet=cycle')
  // Trois règles passées : 27 juil. (4 j), 26 août (5 j), 27 sept. (4 j)
  for (const [start, end] of [['2026-07-27', '2026-07-30'], ['2026-08-26', '2026-08-30'], ['2026-09-27', '2026-09-30']]) {
    await page.getByRole('button', { name: /Noter les règles/ }).click()
    await page.getByLabel('Premier jour des règles').fill(start)
    await page.getByRole('switch', { name: 'Toujours en cours' }).uncheck()
    await page.getByLabel('Dernier jour des règles').fill(end)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Règles notées' }).last()).toBeVisible()
  }
  // Statistiques calculées sur les données notées
  await expect(page.getByTestId('stat-cycle')).toHaveText('32 jours')
  await expect(page.getByTestId('stat-regles')).toHaveText('4 jours')
  await expect(page.getByTestId('stat-variation')).toHaveText('30-32 jours')
  await expect(page.getByText('RÉGULIER', { exact: false }).first()).toBeVisible()
  await expect(page.getByTestId('stat-moyenne')).toHaveText('31 jours')
  // Prévisions présentées comme telles, avec leur incertitude
  await expect(page.getByTestId('cycle-jour')).toHaveText('Jour 24')
  await expect(page.getByTestId('prevision-regles')).toHaveText('entre le 27 octobre et le 29 octobre')
  await expect(page.getByTestId('prevision-ovulation')).toHaveText('vers le 14 octobre')
  await expect(page.getByTestId('certitude')).toContainText('Estimation indicative')
  await expect(page.getByText(/pas une méthode de contraception/)).toBeVisible()
  // Calendrier : réel ≠ prévu
  const cal = page.getByLabel('Calendrier du cycle')
  await expect(cal.getByRole('button', { name: /mercredi 28 octobre, règles prévues \(estimation\)/ })).toHaveAttribute('data-cycle', 'prevu')
  await expect(cal.getByRole('button', { name: /mercredi 14 octobre, ovulation estimée/ })).toHaveAttribute('data-cycle', 'ovu')
  await cal.getByRole('button', { name: 'Mois précédent' }).click()
  await expect(cal.getByRole('button', { name: /dimanche 27 septembre, règles notées/ })).toHaveAttribute('data-cycle', 'reel')
  await cal.getByRole('button', { name: 'Mois suivant' }).click()
  await expect(page.getByText('Prévues le 25 septembre, arrivées le 27 septembre (+2 j)')).toBeVisible()
  await shot(page, '14-cycle')
  await noHorizontalScroll(page)

  // Rapport : facultatif, privé, visible seulement dans le calendrier du cycle
  await page.getByRole('button', { name: 'Rapport (privé)' }).click()
  await expect(page.getByText(/Privé : visible uniquement par toi/)).toBeVisible()
  await page.getByRole('button', { name: 'Noter un rapport' }).click()
  await expect(cal.getByRole('button', { name: /mardi 20 octobre.*rapport noté/ })).toBeVisible()
  await page.goto('./#/progres?onglet=calendrier')
  expect(await page.locator('main').innerText()).not.toMatch(/rapport/i)

  // Retard : 6 jours après la date estimée, message nuancé, jamais de conclusion
  await page.clock.setSystemTime(new Date('2026-11-03T10:00:00+01:00'))
  await page.goto('./#/progres?onglet=cycle')
  await page.reload()
  await expect(page.getByLabel('Retard').getByText('Retard estimé de 6 jours')).toBeVisible()
  expect(await page.locator('main').innerText()).not.toMatch(/enceinte|grossesse/i)
  await page.getByRole('button', { name: 'Mes règles sont arrivées' }).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('cycle-jour')).toHaveText('Règles · jour 1')
  // Persistance et accueil
  await page.reload()
  await expect(page.getByTestId('cycle-jour')).toHaveText('Règles · jour 1')
  await page.goto('./#/')
  await expect(page.getByTestId('cycle-titre')).toHaveText('Règles · jour 1')
  await expect(page.getByRole('button', { name: 'Fin des règles' })).toBeVisible()
})

test('profil nutrition dès l\'accueil : objectif prêt dans le journal, première pesée enregistrée', async ({ page }) => {
  await onboard(page, 'Lina', true)
  await page.getByRole('link', { name: 'Repas' }).click()
  await expect(page.getByRole('button', { name: 'Définir mon objectif' })).toHaveCount(0)
  await expect(page.getByTestId('kcal-restantes')).toContainText(/1\s450/)
  await page.getByRole('link', { name: 'Progrès' }).click()
  await page.getByRole('tab', { name: 'Corps' }).click()
  await expect(page.getByText(/Tendance : 70 kg/)).toBeVisible()
})

test('chaque écran principal tient sur un petit écran', async ({ page }) => {
  await onboard(page)
  for (const [path, name] of [['#/', 'accueil'], ['#/activite', 'activite'], ['#/repas', 'journal'], ['#/repas/ajouter?repas=dejeuner', 'ajouter'], ['#/repas?onglet=recettes', 'recettes'], ['#/repas/recette/tajine-poulet', 'recette'],
    ['#/progres', 'calendrier'], ['#/progres?onglet=courbes', 'courbes'], ['#/progres?onglet=corps', 'corps'], ['#/progres?onglet=regularite', 'regularite'], ['#/repas?onglet=menu', 'menu'], ['#/activite/programmes', 'programmes'], ['#/progres?onglet=badges', 'badges'], ['#/progres/bilan', 'bilan'],
    ['#/univers?onglet=compagnon', 'compagnon'], ['#/univers?onglet=boutique', 'boutique'], ['#/progres?onglet=cycle', 'cycle'], ['#/profil', 'profil'], ['#/profil/compte', 'compte'], ['#/profil/engagements', 'engagements'], ['#/reprise', 'reprise']] as const) {
    await page.goto('./' + path)
    await expect(page.locator('main').first()).toBeVisible()
    await noHorizontalScroll(page)
    await shot(page, 'ecran-' + name)
  }
})

test('journal plus rapide : « comme hier », repas favori enregistré puis rajouté en un geste', async ({ page }) => {
  await onboard(page, 'Lina', true)
  // Lundi : un petit-déjeuner noté (ajout rapide)
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00+02:00'))
  await page.goto('./#/repas/ajouter?repas=petit-dejeuner&jour=2026-10-19&onglet=rapide')
  await page.getByLabel('Nom').fill('Bol avoine et fruits')
  await page.getByLabel('Calories').fill('380')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page).not.toHaveURL(/ajouter/) // enregistré, retour à l'écran précédent
  // Mardi : le petit-déjeuner vide propose « comme hier »
  await page.clock.setFixedTime(TUESDAY_1720)
  await page.goto('./#/repas?onglet=journal')
  await page.reload()
  await page.getByRole('button', { name: 'Comme hier · Petit-déjeuner' }).click()
  await expect(page.getByTestId('total-petit-dejeuner')).toHaveText(/^380 kcal/)
  await expect(page.getByLabel('Petit-déjeuner', { exact: true }).getByText('Bol avoine et fruits')).toBeVisible()
  // Enregistrer en favori
  await page.getByRole('button', { name: 'Favoris et reprise · Petit-déjeuner' }).click()
  await expect(page.getByLabel('Nom du favori')).toHaveValue('Bol avoine et fruits')
  await page.getByLabel('Nom du favori').fill('Mon petit-déj habituel')
  await page.getByRole('button', { name: 'Enregistrer en favori' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'favoris' })).toBeVisible()
  // Le favori se rajoute en un geste depuis l'écran d'ajout (ici en collation)
  await page.getByRole('button', { name: 'Ajouter à la collation' }).click()
  await page.getByRole('region', { name: 'Mes repas favoris' }).getByRole('button', { name: /Mon petit-déj habituel/ }).click()
  await expect(page.getByTestId('total-collation')).toHaveText(/^380 kcal/)
  await expect(page.getByTestId('kcal-mangees')).toHaveText('760 kcal')
  await shot(page, '15-journal-rapide')
  await noHorizontalScroll(page)
})

test('programme sportif : choix, séance illustrée avec signaux, avancement enregistré', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Activité' }).click()
  await page.getByRole('button', { name: 'Choisir un programme' }).click()
  await page.getByRole('button', { name: 'Reprise en douceur' }).click()
  await expect(page.getByRole('region', { name: 'Aperçu des exercices' }).getByRole('img').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Semaine 4' })).toContainText('15 min · modéré')
  await page.getByRole('button', { name: 'Commencer ce programme' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Reprise en douceur' })).toBeVisible()
  await shot(page, '16-programme')
  await noHorizontalScroll(page)
  await page.getByRole('button', { name: /Séance 1 · semaine 1/ }).click()
  await expect(page.getByText('Semaine 1 · séance 1', { exact: true })).toBeVisible()
  await expect(page.getByText(/^Reprise · 10 min/)).toBeVisible()
  await expect(page.getByRole('img', { name: /^Illustration :/ })).toBeVisible()
  // le son se coupe et se rallume (réglage conservé)
  await page.getByRole('button', { name: 'Couper le son' }).click()
  await expect(page.getByRole('button', { name: 'Activer le son' })).toBeVisible()
  await page.getByRole('button', { name: 'Activer le son' }).click()
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await shot(page, '17-seance-illustree')
  await noHorizontalScroll(page)
  await page.clock.fastForward(10 * 60_000 + 2_000)
  await expect(page.getByRole('heading', { name: '10 min pour toi' })).toBeVisible()
  await expect(page.locator('main').getByText('Reprise · semaine 1 · séance 1')).toBeVisible()
  await page.getByRole('button', { name: "Retour à l'accueil" }).click()
  await page.getByRole('link', { name: 'Activité' }).click()
  await expect(page.getByRole('region', { name: 'Mon programme' })).toContainText('1 séance sur 12')
  await expect(page.getByRole('button', { name: /Séance 2 de la semaine 1/ })).toBeVisible()
  // le rituel propose aussi la séance du programme
  await page.goto('./#/rituel')
  await expect(page.getByRole('button', { name: /Mon programme · 10 min/ })).toBeVisible()
})

test('progrès hors balance : mensurations, sommeil, bilan du mois croisé', async ({ page }) => {
  await onboard(page)
  await page.clock.setFixedTime(new Date('2026-10-01T08:00:00+02:00'))
  await page.goto('./#/progres?onglet=corps')
  await page.reload()
  await page.getByRole('button', { name: 'Noter mes mesures' }).click()
  await page.getByRole('button', { name: 'Ajouter Tour de taille' }).click()
  await page.getByRole('group', { name: 'Tour de taille' }).getByRole('button', { name: 'Moins' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('mesure-waist_cm')).toContainText('79,5 cm')
  await page.clock.setFixedTime(TUESDAY_1720)
  await page.reload()
  await page.getByRole('button', { name: 'Noter mes mesures' }).click()
  await page.getByRole('button', { name: 'Ajouter Tour de taille' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('group', { name: 'Tour de taille' }).getByRole('button', { name: 'Moins' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('mesure-waist_cm')).toContainText('78 cm')
  await expect(page.getByTestId('mesure-waist_cm')).toContainText('−1,5 cm depuis le 1 octobre')
  // Sommeil
  await page.getByRole('button', { name: 'Noter ma nuit dernière' }).click()
  await page.getByRole('group', { name: 'Heures de sommeil' }).getByRole('button', { name: 'Plus' }).click()
  await page.getByRole('group', { name: 'Qualité du sommeil' }).getByRole('button', { name: 'Bonne' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('region', { name: 'Sommeil et énergie' })).toContainText('7 h 30 de sommeil en moyenne')
  // Bilan du mois
  const bilan = page.getByRole('region', { name: 'Bilan du mois' })
  await expect(bilan).toContainText('Octobre 2026')
  await expect(bilan).toContainText('Tour de taille : −1,5 cm')
  await expect(bilan).toContainText('1 nuit notée')
  await expect(bilan).toContainText('Pas encore assez de jours notés')
  await shot(page, '18-corps')
  await noHorizontalScroll(page)
})

test('courbes : jauge d\'eau en pourcentage, courbe de poids, barres d\'eau et d\'activité', async ({ page }) => {
  await onboard(page, 'Lina', true)
  // Jauge d'eau : pourcentage et repères
  const water = page.getByLabel('Hydratation')
  await water.getByRole('button', { name: 'Ajouter 0,5 L' }).click()
  await expect(water).toContainText('25 %')
  await expect(water.getByRole('progressbar', { name: 'Eau bue' })).toHaveAttribute('aria-valuenow', '500')
  // Deuxième pesée la semaine suivante : la courbe apparaît
  await page.clock.setFixedTime(new Date('2026-10-27T08:00:00+01:00'))
  await page.goto('./#/progres?onglet=corps')
  await page.reload()
  const poids = page.getByRole('group', { name: 'Poids' })
  for (let i = 0; i < 5; i++) await poids.getByRole('button', { name: 'Moins' }).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId('graph-courbe').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Courbes' }).click()
  const courbe = page.getByRole('region', { name: 'Courbe de poids' })
  await expect(courbe).toContainText('Tendance : 69,8 kg')
  await expect(courbe).toContainText('−0,2 kg')
  await expect(courbe.getByTestId('graph-courbe')).toBeVisible()
  await courbe.getByRole('tab', { name: 'Tout' }).click()
  await expect(courbe.getByTestId('graph-courbe')).toBeVisible()
  // Eau : sur 7 jours le 20 n'est plus visible (le 27 est la fin), sur 30 jours oui
  const eau = page.getByRole('region', { name: 'Eau sur les derniers jours' })
  await expect(eau.getByTestId('graph-barres')).toBeVisible()
  await expect(eau).toContainText('0 / 7 jours')
  await eau.getByRole('tab', { name: '30 jours' }).click()
  await expect(eau).toContainText('0 / 30 jours')
  await expect(eau).toContainText('0,5 L')
  const act = page.getByRole('region', { name: 'Activité sur les derniers jours' })
  await expect(act.getByTestId('graph-barres')).toBeVisible()
  await expect(act).toContainText('Jours actifs')
  await shot(page, '19-courbes')
  await noHorizontalScroll(page)
})

test('intro d\'ouverture : logo et nom, touche pour passer, une seule fois par lancement', async ({ page }) => {
  await page.goto('./?intro=1#/')
  await expect(page.locator('#intro img')).toBeVisible()
  await expect(page.locator('#intro h1')).toHaveText('Élan')
  await page.locator('#intro').click()
  await expect(page.locator('#intro')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Élan' })).toBeVisible()
  await page.goto('./#/')
  await expect(page.locator('#intro')).toHaveCount(0)
})
