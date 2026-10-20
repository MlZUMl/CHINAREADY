# Élan

Application web installable (Android, Chrome) pour construire une routine sport, eau et repas
qui tient **même les jours sans motivation** : rendez-vous concrets, version minimale, reprise
après une pause, et un univers qui grandit avec les habitudes réelles.

- Appli en ligne : https://mlzuml.github.io/EMMAMIAM/elan/
- Données : sur le téléphone (IndexedDB) + sauvegarde privée Supabase (projet `elan`, Paris).
- Rappels : notifications push envoyées par Supabase chaque minute, appli fermée.

## Lancer en local

```bash
npm install
npm run dev          # développement
npm run build        # vérifie les types puis construit dist/
npm test             # tests unitaires + base de données (PGlite)
npm run test:e2e     # parcours réels dans Chromium, écran 360 px (après npm run build)
npm run recettes     # recalcule le catalogue de recettes (voir plus bas)
npm run ciqual       # régénère la table des aliments depuis scripts/data/ciqual-2020.xls
```

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/data` | Stockage local (une seule transaction par action), file d'envoi, synchronisation Supabase |
| `src/domain` | Règles métier pures et testées : rituel, énergie, récompenses, missions, capsules, analyse, compagnon, recettes, nutrition, aliments, contrôle « sans porc » |
| `src/screens` | Écrans (journal alimentaire : `Food.tsx`, `FoodAdd.tsx`, `food-parts.tsx`) |
| `src/art` | Illustrations vectorielles (remplaçables, voir ci-dessous) |
| `public/data` | `ciqual.json` (aliments) et `recettes.json` (catalogue) — lus à l'exécution |
| `scripts` | Conversion Ciqual, source et construction du catalogue de recettes |
| `supabase/migrations` | Schéma, RLS, stockage des photos, règles des rappels, tâche planifiée, journal alimentaire (0005), points (0006), cycle (0007), v1.4 : favoris, rappels de repas, mensurations, sommeil (0008) |
| `supabase/functions/rappels` | Envoi des notifications push |
| `tests` | Tests unitaires, base de données, navigateur |

## Journal alimentaire

- Objectif calorique automatique (Mifflin-St Jeor × activité, rythme modéré par défaut), modifiable
  à la main. Plancher : 1 200 kcal (femme) / 1 500 kcal (homme), et jamais sous le métabolisme de base.
  L'objectif ne baisse jamais les jours de faible énergie ; les calories du sport ne sont pas déduites.
- 4 repas (25 / 35 / 10 / 30 %), protéines, glucides, lipides, fibres.
- Sources : table **Ciqual 2020** (embarquée), **Open Food Facts** (recherche de marques sur demande,
  code-barres), aliments personnels, recettes, ajout rapide. Quantités en g, ml ou portions.
- Les valeurs sont figées au moment de l'ajout : aucune double comptabilité, l'historique ne bouge pas.
- Profil nutrition (année de naissance, taille, poids, activité, rythme) proposé dès l'accueil (étape facultative) :
  l'objectif est prêt dans le journal et le poids saisi devient la première pesée.

### Journal plus rapide (v1.4)

- **Comme hier** : un repas vide propose en un geste le même repas du dernier jour noté (7 jours).
  « Favori · reprendre » permet aussi de recopier ce repas depuis n'importe quel jour des deux dernières semaines.
- **Repas favoris** (table `favorite_meals`) : enregistrer un repas noté, puis le rajouter en un geste depuis le
  journal ou l'écran « Ajouter » (ligne « Mes repas favoris »). Le contrôle sans porc s'applique aussi.
- Les lignes recopiées gardent leurs valeurs ; une recette garde son identifiant stable (pas de doublon).
- **Rappels de repas** (Profil > Rappels, désactivables) : à l'heure choisie (13 h 30 et 20 h 30 par défaut),
  seulement si le déjeuner ou le dîner n'est pas encore noté ce jour-là.

### Menu de la semaine adapté à l'objectif (v1.4)

`src/domain/menu.ts` : petit-déjeuner, déjeuner et dîner pour 7 jours, choisis parmi les recettes (sans porc)
pour approcher l'objectif calorique en gardant ~10 % pour une collation libre. Le dîner compense ce qui est déjà
prévu dans la journée ; variété (pas deux fois le même plat le même jour, peu de répétitions) ; allergènes à éviter ;
recettes déjà choisies conservées ; bouton ↻ « autre idée » par créneau. Aucun hasard : même objectif, même menu.
La liste de courses se remplit automatiquement (portions à cuisiner comprises). Limite connue : au-delà d'environ
1 900 kcal, les plats du catalogue plafonnent ; le manque est alors affiché (« ajoute un féculent… »).

## Contrôle « sans porc » (permanent)

`src/domain/pork.ts` est appliqué partout : construction du catalogue (le script refuse de produire
le fichier), chargement du fichier en ligne (une recette suspecte est écartée), résultats Open Food Facts
(retirés), code-barres (refusé), aliments et recettes personnels (enregistrement bloqué). Les aliments
Ciqual au statut incertain sont exclus de la recherche. Si la composition d'un produit n'est pas
renseignée, l'appli demande de confirmer avoir vérifié l'étiquette. Ce contrôle n'a pas de réglage.

## Modifier ou ajouter des recettes

Le catalogue (52 recettes originales, quantités pour une portion) est dans
`scripts/recettes-source.mjs` : chaque ingrédient a un libellé, une quantité, un poids en grammes
et un code Ciqual. `npm run recettes` calcule calories, macros, coût estimé, allergènes indicatifs,
vérifie l'absence de porc et l'unicité des photos, puis écrit `public/data/recettes.json`
(et sa copie embarquée `src/content/recettes.json`).

Sans rien reconstruire, on peut aussi modifier directement `elan/data/recettes.json` sur GitHub :
l'appli charge cette version au démarrage si elle est valide (sinon elle garde sa copie embarquée).
Si tu changes des ingrédients à la main, pense à mettre à jour le bloc `nutrition`.

Photos : Pexels (licence Pexels, usage libre), une photo différente par recette, crédit affiché.
Le bouton « Voir sur HelloFresh » ouvre une simple recherche sur leur site ; aucun contenu n'en est repris.

## Eau

Objectif en litres (2,0 L par défaut), boutons 0,15 / 0,25 / 0,33 / 0,5 L et quantité libre,
entrées modifiables et supprimables, 5 rappels par jour (9 h 30, 11 h 30, 13 h 30, 15 h 30, 18 h 30).

## Points et boutique

Règles dans `src/domain/shop.ts` (testées), attribuées par le moteur de récompenses existant :

| Objectif du jour (une fois par jour) | Points |
| --- | --- |
| Séance du jour (rendez-vous honoré, version minimale comprise) | 300 |
| Calories notées (au moins 2 repas du journal avec des calories) | 50 |
| Objectif d'eau atteint | 50 |
| Bonus de régularité : 3 journées complètes dans la semaine (une fois par semaine) | 200 |

- Clés déterministes (`points:seance:2026-10-20`) : impossible d'obtenir deux fois le même gain, même
  sur deux téléphones. Les points d'un jour ne sont attribués que ce jour-là ou le lendemain.
- Rien n'expire, rien ne se perd, pas de série à protéger.
- Boutique (onglet Univers > Boutique) : 22 objets en 3 rayons (tenues, coiffures, accessoires) et
  3 raretés — Commun 300–500 pts (1 à 2 jours), Rare 1 200–1 800 pts (≈ 1 semaine), Premium
  3 500–8 000 pts (2 à 5 semaines). Collection complète ≈ 45 000 pts. Un objet rare ou premium
  est en sélection à −20 % chaque semaine.
- Les objets sont des calques vectoriels posés sur le compagnon : sa forme et son visage ne changent pas.
- **Avatar (v1.4)** : 28 objets pour son propre personnage (12 tenues, 10 coiffures, 6 accessoires : lunettes,
  boucles d'oreilles, foulard, casque audio, sac, couronne), mêmes raretés et prix. Choix « Pour qui ? » dans la
  boutique (Mon avatar / Mon compagnon) ; un objet acheté est porté tout de suite et peut être retiré ou remis
  depuis Univers. Dessins vectoriels dans le style de l'avatar existant.
- Achats : table `shop_purchases` (un objet = une ligne), solde = points gagnés − prix payés.

## Suivi du cycle

Règles dans `src/domain/cycle.ts` (testées), écran `src/screens/Cycle.tsx` (Progrès > Cycle) et carte sur l'accueil.

- Dates réelles = jours notés ; tout le reste est une prévision affichée comme telle, avec son degré de
  certitude (faible tant qu'il y a moins de deux cycles complets ; fourchette si les cycles varient).
- Prochaines règles = dernier début + cycle moyen (6 derniers cycles valides ; 28 jours par défaut).
  Ovulation estimée ≈ 14 jours avant, fenêtre fertile de 7 jours. Une ovulation confirmée (test, suivi
  médical) est notée à part. Jamais présenté comme une méthode de contraception ; affichage désactivable.
- Statistiques façon Flo : cycle et règles précédents, variations, régularité (repères FIGO : 24–38 jours,
  règles ≤ 8 jours, écart ≤ 7 jours), historique prévu / réel, tendance.
- Retard : message nuancé, aucune conclusion (jamais de grossesse déduite).
- Rapports : facultatifs, table `intimate_logs` séparée, privée (RLS), visibles uniquement dans le calendrier du cycle.
- Rappels (désactivables) : règles dans 2 jours, retard de 5 jours, fin des règles à noter — programmés par
  l'appli dans `scheduled_pushes` et recalés à chaque changement.

## Programmes sportifs (v1.4)

`src/domain/programs.ts` : 5 programmes de 4 à 8 semaines, 3 séances par semaine (Reprise en douceur, Tonifier tout
le corps, Cardio doux et endurance, Renfo et souplesse, Objectif 30 minutes). La durée et le niveau (doux, modéré,
tonique) augmentent semaine après semaine ; une énergie basse ramène toujours la séance au niveau doux.
L'avancement se déduit des séances enregistrées (titre stable « Reprise · semaine 1 · séance 1 »), rien d'autre
n'est stocké que le programme choisi et sa date de début (`profiles.settings.program`). Le rituel propose la séance
du programme. Pendant la séance : illustration animée de chaque exercice (`src/art/ExerciseArt.tsx`, silhouettes
vectorielles, sans animation si « réduire les animations » est activé), bip et vibration à chaque changement et
3-2-1 avant la fin d'un exercice (son coupable dans la séance).

## Progrès hors balance (v1.4)

Progrès > Corps (`src/screens/Body.tsx`, règles dans `src/domain/wellbeing.ts`) :
- **Mensurations** (table `body_measurements`) : taille, hanches, poitrine, cuisse, bras, chacune facultative ;
  évolution depuis la première mesure et courbe du tour de taille.
- **Sommeil** (colonnes `sleep_hours`, `sleep_quality` du check-in) et **énergie** sur 14 jours.
- **Bilan du mois** : séances, jours de repas notés, eau, sommeil, énergie, mensurations, tendance du poids ; et
  « ce que montrent tes données » : sommeil ↔ énergie, séance ↔ énergie du lendemain, séance ↔ sommeil, affichés
  seulement avec au moins 3 jours de chaque côté et un écart net, formulés comme des observations.

## Remplacer les illustrations

Dépose tes images dans `public/art/` puis déclare-les dans `public/config.js` (clé `art`) :
`compagnon-chat`, `avatar`, `zone-chambre`, `objet-pothos`… Aucune reconstruction n'est
nécessaire si tu modifies directement `elan/config.js` et `elan/art/` sur GitHub.

## Sources et licences des données

- Table de composition nutritionnelle **Ciqual 2020**, Anses — Licence Ouverte / Open Licence Etalab 2.0.
- **Open Food Facts** — base ouverte (ODbL), interrogée depuis le téléphone uniquement à la demande.
- Photos **Pexels**.
- Coûts : estimation à partir de prix moyens en grande surface (2026), à titre indicatif.

## Choix faits avec l'utilisatrice

- Palette G : fond blanc, vert profond `#0A3323` (texte, boutons), bleu nuit `#105666` (repères, eau),
  mousse `#839958`, rose `#D3968C` (règles et surfaces, jamais pour du texte).
- Journal alimentaire avec calories, façon Foodvisor ; recettes sans porc façon box repas.
- Pesée hebdomadaire, courbe lissée ; aucune récompense ne dépend du poids.
- Rituel du lundi au vendredi à 17 h 15, ton selon l'énergie du jour.
