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
```

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/data` | Stockage local (une seule transaction par action), file d'envoi, synchronisation Supabase |
| `src/domain` | Règles métier pures et testées : rituel, énergie, récompenses, missions, capsules, analyse, compagnon, recettes |
| `src/screens` | Écrans |
| `src/art` | Illustrations vectorielles (remplaçables, voir ci-dessous) |
| `supabase/migrations` | Schéma, RLS, stockage des photos, règles des rappels, tâche planifiée |
| `supabase/functions/rappels` | Envoi des notifications push |
| `tests` | Tests unitaires, base de données, navigateur |

## Remplacer les illustrations

Dépose tes images dans `public/art/` puis déclare-les dans `public/config.js` (clé `art`) :
`compagnon-chat`, `avatar`, `zone-chambre`, `objet-pothos`… Aucune reconstruction n'est
nécessaire si tu modifies directement `elan/config.js` et `elan/art/` sur GitHub.

## Choix faits avec l'utilisatrice

- Alimentation **sans aucun chiffre** : pas de calories, repères qualitatifs, recettes halal
  façon box repas, liste de courses à donner à Claude dans Chrome (il ne valide jamais la commande).
- Pesée hebdomadaire, courbe lissée ; aucune récompense ne dépend du poids.
- Rituel du lundi au vendredi à 17 h 15, ton selon l'énergie du jour.
