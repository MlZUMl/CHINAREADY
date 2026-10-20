# Élan

Application web installable (Android, Chrome) pour construire une routine sport, eau et repas
qui tient **même les jours sans motivation** : rendez-vous concrets, version minimale, reprise
après une pause, et un univers qui grandit avec les habitudes réelles.

- Appli en ligne : https://mlzuml.github.io/CHINAREADY/elan/
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
| `supabase/migrations` | Schéma, RLS, stockage des photos, règles des rappels, tâche planifiée, journal alimentaire (0005) |
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
