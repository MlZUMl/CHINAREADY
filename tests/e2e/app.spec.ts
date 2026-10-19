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
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByRole('heading', { name: 'Sauvegarde et rappels' })).toBeVisible()
  await page.getByRole('button', { name: 'Plus tard' }).click()
  await page.getByRole('button', { name: 'Entrer dans mon univers' }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`(Bonjour|Bonsoir) ${name}`) })).toBeVisible()
  // Nouveau compte : aucune « reprise » proposée, rien n'est compté avant le premier jour
  await expect(page.getByText("Une seule petite action aujourd'hui")).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: TUESDAY_1720 })
})

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

test('eau, mission, repas sans chiffres, menu halal et liste de courses pour Claude', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await onboard(page)
  // 8 verres => objectif atteint, une plante apparaît dans l'univers
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Ajouter un verre' }).click()
  await expect(page.getByText('8 verres sur 8')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /Pothos|Objectif|Nouvel objet/ }).first()).toBeVisible()

  // Mission du jour : facultative, objectif affiché
  await expect(page.getByLabel('Mission du jour')).toBeVisible()

  // Repas : noté sans aucun chiffre
  await page.getByRole('link', { name: 'Repas' }).click()
  await page.getByRole('button', { name: 'Noter un repas' }).click()
  await page.getByLabel("Qu'as-tu mangé ?").fill('Poulet, riz et haricots verts')
  await page.getByRole('group', { name: 'Repères' }).getByRole('button', { name: 'Légumes' }).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Poulet, riz et haricots verts')).toBeVisible()
  expect(await page.locator('main').innerText()).not.toMatch(/kcal|calorie/i)
  await shot(page, '05-repas')
  await noHorizontalScroll(page)

  // Menu de la semaine : compléter les dîners, puis la liste de courses
  await page.getByRole('tab', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Compléter les dîners' }).click()
  await expect(page.getByRole('button', { name: 'Retirer du menu' }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Courses' }).click()
  await expect(page.getByRole('heading', { name: 'Faire remplir le panier par Claude' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Boucherie halal' }).or(page.getByRole('heading', { name: 'Poissonnerie' })).first()).toBeVisible()
  await page.getByRole('button', { name: /Copier la liste pour Claude/ }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/halal/)
  expect(text).toMatch(/ne valide pas la commande/)
  await shot(page, '06-courses')
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
  await expect(page.getByText('1 verre sur 8')).toBeVisible()
})

test('chaque écran principal tient sur un petit écran', async ({ page }) => {
  await onboard(page)
  for (const [path, name] of [['#/', 'accueil'], ['#/activite', 'activite'], ['#/repas?onglet=recettes', 'recettes'], ['#/repas/recette/tajine-poulet', 'recette'],
    ['#/progres', 'calendrier'], ['#/progres?onglet=regularite', 'regularite'], ['#/progres?onglet=badges', 'badges'], ['#/progres/bilan', 'bilan'],
    ['#/univers?onglet=compagnon', 'compagnon'], ['#/profil', 'profil'], ['#/profil/compte', 'compte'], ['#/profil/engagements', 'engagements'], ['#/reprise', 'reprise']] as const) {
    await page.goto('./' + path)
    await expect(page.locator('main').first()).toBeVisible()
    await noHorizontalScroll(page)
    await shot(page, 'ecran-' + name)
  }
})
