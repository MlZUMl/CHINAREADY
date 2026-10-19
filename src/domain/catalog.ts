// Catalogues : zones et objets de l'univers, accessoires du compagnon, badges.
// Les conditions de déblocage sont vérifiées dans rewards.ts à partir des données enregistrées.

export interface ZoneDef { id: string; name: string; description: string; slots: string[]; weeksNeeded: number }

export const ZONES: ZoneDef[] = [
  { id: 'chambre', name: 'La chambre', description: 'Un petit nid douillet pour commencer.', slots: ['mur', 'fenetre', 'etagere', 'sol', 'lit', 'table'], weeksNeeded: 0 },
  { id: 'jardin', name: 'Le jardin', description: 'Il pousse au rythme de tes semaines actives.', slots: ['massif', 'arbre', 'allee', 'banc', 'eau'], weeksNeeded: 2 },
  { id: 'bibliotheque', name: 'La bibliothèque', description: 'Un coin calme pour tes souvenirs et tes recettes.', slots: ['rayon', 'fauteuil', 'lampe', 'tapis'], weeksNeeded: 4 },
  { id: 'atelier', name: "L'atelier", description: 'Là où tes habitudes deviennent des créations.', slots: ['plan', 'mur', 'panier', 'plante'], weeksNeeded: 6 },
  { id: 'balcon', name: 'Le balcon étoilé', description: 'Pour regarder le chemin parcouru.', slots: ['ciel', 'rambarde', 'coussin'], weeksNeeded: 8 },
]

export const UNIVERSE_STARTS = [
  { id: 'chambre', label: 'Chambre cosy' },
  { id: 'jardin', label: 'Petit jardin' },
  { id: 'bibliotheque', label: 'Bibliothèque' },
] as const

/** Ordre des zones pour une univers de départ donné : la zone choisie d'abord, puis les autres. */
export function zoneOrder(start: string): ZoneDef[] {
  const first = ZONES.find(z => z.id === start) ?? ZONES[0]
  const rest = ZONES.filter(z => z.id !== first.id)
  return [{ ...first, weeksNeeded: 0 }, ...rest.map((z, i) => ({ ...z, weeksNeeded: (i + 1) * 2 }))]
}

export interface ItemDef { id: string; name: string; zone: string; slot: string; how: string; emoji: string; mystery?: boolean }

export const ITEMS: ItemDef[] = [
  { id: 'lampe-douce', name: 'Lampe douce', zone: 'chambre', slot: 'table', how: 'Offerte à l\'arrivée', emoji: '🪔' },
  { id: 'tapis-rond', name: 'Tapis rond', zone: 'chambre', slot: 'sol', how: 'Offert à l\'arrivée', emoji: '🟣' },
  { id: 'tapis-yoga', name: 'Tapis de yoga', zone: 'chambre', slot: 'sol', how: 'Ta première séance', emoji: '🧘‍♀️' },
  { id: 'radio', name: 'Radio rétro', zone: 'chambre', slot: 'etagere', how: '5 séances terminées', emoji: '📻' },
  { id: 'horloge', name: 'Horloge de 17 h 15', zone: 'chambre', slot: 'mur', how: '10 rendez-vous honorés', emoji: '🕰️' },
  { id: 'pothos', name: 'Pothos', zone: 'chambre', slot: 'fenetre', how: 'Ton premier objectif d\'eau atteint', emoji: '🪴' },
  { id: 'monstera', name: 'Monstera', zone: 'atelier', slot: 'plante', how: 'Objectif d\'eau atteint 7 jours', emoji: '🌿' },
  { id: 'fontaine', name: 'Petite fontaine', zone: 'jardin', slot: 'eau', how: 'Objectif d\'eau atteint 21 jours', emoji: '⛲' },
  { id: 'panier-fruits', name: 'Panier de fruits', zone: 'atelier', slot: 'panier', how: 'Repas notés 3 jours', emoji: '🧺' },
  { id: 'livre-recettes', name: 'Livre de recettes', zone: 'bibliotheque', slot: 'rayon', how: 'Repas notés 14 jours', emoji: '📖' },
  { id: 'epices', name: 'Étagère à épices', zone: 'atelier', slot: 'mur', how: '5 recettes différentes cuisinées', emoji: '🫙' },
  { id: 'carnet', name: 'Carnet fleuri', zone: 'chambre', slot: 'lit', how: 'Ton premier check-in', emoji: '📔' },
  { id: 'tasse', name: 'Tasse fumante', zone: 'bibliotheque', slot: 'lampe', how: '10 check-ins', emoji: '☕' },
  { id: 'boite-souvenirs', name: 'Boîte à souvenirs', zone: 'bibliotheque', slot: 'tapis', how: 'Ta première capsule temporelle', emoji: '🎁' },
  { id: 'cadre-photo', name: 'Cadre souvenir', zone: 'chambre', slot: 'mur', how: 'Ouvrir une capsule', emoji: '🖼️' },
  { id: 'lanterne', name: 'Lanterne du retour', zone: 'jardin', slot: 'allee', how: 'Reprendre après une pause', emoji: '🏮' },
  { id: 'etoile', name: 'Étoile filante', zone: 'balcon', slot: 'ciel', how: 'Ta première mission', emoji: '🌠' },
  { id: 'tableau-liege', name: 'Tableau en liège', zone: 'atelier', slot: 'plan', how: 'Ton premier bilan de semaine', emoji: '📌' },
  { id: 'calendrier', name: 'Calendrier mural', zone: 'bibliotheque', slot: 'rayon', how: '4 bilans de semaine', emoji: '🗓️' },
  { id: 'bouillotte', name: 'Bouillotte', zone: 'chambre', slot: 'lit', how: 'Suivre ton cycle une première fois', emoji: '🫖' },
  { id: 'bougie', name: 'Bougie apaisante', zone: 'chambre', slot: 'etagere', how: 'Prendre un vrai jour de repos', emoji: '🕯️' },
  { id: 'anneau', name: 'Anneau d\'aventure', zone: 'atelier', slot: 'mur', how: 'Une séance de Ring Fit', emoji: '⭕' },
  { id: 'boule-facettes', name: 'Boule à facettes', zone: 'balcon', slot: 'ciel', how: 'Une séance de danse', emoji: '🪩' },
  { id: 'velo-mini', name: 'Vélo miniature', zone: 'jardin', slot: 'banc', how: 'Une sortie à vélo', emoji: '🚲' },
  { id: 'baskets', name: 'Baskets', zone: 'chambre', slot: 'sol', how: 'Une marche enregistrée', emoji: '👟' },
  // Débloqués en montant de niveau
  { id: 'coussin', name: 'Coussin moelleux', zone: 'chambre', slot: 'lit', how: 'Niveau 2', emoji: '🛋️' },
  { id: 'rideaux', name: 'Rideaux poudrés', zone: 'chambre', slot: 'fenetre', how: 'Niveau 3', emoji: '🪟' },
  { id: 'banc-bois', name: 'Banc en bois', zone: 'jardin', slot: 'banc', how: 'Niveau 4', emoji: '🪑' },
  { id: 'fauteuil', name: 'Fauteuil prune', zone: 'bibliotheque', slot: 'fauteuil', how: 'Niveau 5', emoji: '💺' },
  { id: 'cerisier', name: 'Cerisier', zone: 'jardin', slot: 'arbre', how: 'Niveau 6', emoji: '🌸' },
  { id: 'guirlande', name: 'Guirlande lumineuse', zone: 'balcon', slot: 'rambarde', how: 'Niveau 7', emoji: '✨' },
  { id: 'coussins-sol', name: 'Coussins de sol', zone: 'balcon', slot: 'coussin', how: 'Niveau 8', emoji: '🟪' },
  { id: 'massif-roses', name: 'Massif de roses', zone: 'jardin', slot: 'massif', how: 'Niveau 9', emoji: '🌹' },
  { id: 'telescope', name: 'Télescope', zone: 'balcon', slot: 'rambarde', how: 'Niveau 10', emoji: '🔭' },
  // Exclusifs des missions mystères (dans cet ordre)
  { id: 'cristal-rose', name: 'Cristal rose', zone: 'chambre', slot: 'etagere', how: 'Mission mystère', emoji: '💎', mystery: true },
  { id: 'lune-papier', name: 'Lune en papier', zone: 'balcon', slot: 'ciel', how: 'Mission mystère', emoji: '🌙', mystery: true },
  { id: 'theiere', name: 'Théière fleurie', zone: 'bibliotheque', slot: 'lampe', how: 'Mission mystère', emoji: '🫖', mystery: true },
  { id: 'bonsai', name: 'Bonsaï', zone: 'atelier', slot: 'plante', how: 'Mission mystère', emoji: '🌳', mystery: true },
  { id: 'coquillage', name: 'Coquillage nacré', zone: 'jardin', slot: 'allee', how: 'Mission mystère', emoji: '🐚', mystery: true },
  { id: 'arc-en-ciel', name: 'Arc-en-ciel de verre', zone: 'balcon', slot: 'ciel', how: 'Mission mystère', emoji: '🌈', mystery: true },
]

export const LEVEL_ITEMS: Record<number, string> = {
  2: 'coussin', 3: 'rideaux', 4: 'banc-bois', 5: 'fauteuil', 6: 'cerisier', 7: 'guirlande', 8: 'coussins-sol', 9: 'massif-roses', 10: 'telescope',
}

export const MYSTERY_ITEMS = ITEMS.filter(i => i.mystery).map(i => i.id)

export interface AccessoryDef { id: string; name: string; how: string }
export const ACCESSORIES: AccessoryDef[] = [
  { id: 'noeud', name: 'Petit nœud', how: 'Offert à l\'arrivée' },
  { id: 'echarpe', name: 'Écharpe tricotée', how: '5 rendez-vous honorés' },
  { id: 'chapeau', name: 'Chapeau de paille', how: 'Objectif d\'eau atteint 7 jours' },
  { id: 'lunettes', name: 'Lunettes rondes', how: 'Repas notés 10 jours' },
  { id: 'couronne', name: 'Couronne de fleurs', how: 'Niveau 5' },
  { id: 'cape', name: 'Cape étoilée', how: 'Un badge secret' },
]

export interface BadgeDef { id: string; name: string; description: string; secret: boolean; emoji: string }

export const BADGES: BadgeDef[] = [
  { id: 'premier-pas', name: 'Le premier pas', description: 'Commencer une nouvelle habitude.', secret: false, emoji: '👣' },
  { id: 'rdv-5', name: 'Le rendez-vous avec soi-même', description: 'Honorer 5 rendez-vous sportifs.', secret: false, emoji: '💗' },
  { id: 'rdv-20', name: 'Fidèle à soi', description: 'Honorer 20 rendez-vous sportifs.', secret: false, emoji: '🌷' },
  { id: 'rdv-50', name: 'Ancrée', description: 'Honorer 50 rendez-vous sportifs.', secret: false, emoji: '🌳' },
  { id: 'semaine-complete', name: 'Semaine complète', description: 'Honorer tous les rendez-vous prévus d\'une semaine.', secret: false, emoji: '🗓️' },
  { id: 'hydratation-7', name: 'Bien hydratée', description: 'Atteindre ton objectif d\'eau 7 jours.', secret: false, emoji: '💧' },
  { id: 'curiosite-culinaire', name: 'La curiosité culinaire', description: 'Cuisiner 5 recettes différentes.', secret: false, emoji: '🍲' },
  { id: 'journal-14', name: 'Carnet fidèle', description: 'Noter tes repas 14 jours.', secret: false, emoji: '📒' },
  { id: 'ecoute-de-soi', name: 'À l\'écoute de soi', description: 'Faire 10 check-ins d\'énergie.', secret: false, emoji: '🫶' },
  { id: 'capsule-1', name: 'Gardienne du temps', description: 'Créer ta première capsule temporelle.', secret: false, emoji: '⏳' },
  { id: 'capsule-ouverte', name: 'Lettre reçue', description: 'Ouvrir une capsule temporelle.', secret: false, emoji: '💌' },
  { id: 'bilan-4', name: 'Regard bienveillant', description: 'Faire 4 bilans de semaine.', secret: false, emoji: '🔎' },
  { id: 'explorateur', name: 'Exploratrice', description: 'Essayer 4 types d\'activité différents.', secret: false, emoji: '🧭' },
  { id: 'missions-10', name: 'Missionnaire', description: 'Réussir 10 missions du jour.', secret: false, emoji: '🎯' },
  { id: 'niveau-5', name: 'Univers en fleur', description: 'Atteindre le niveau 5.', secret: false, emoji: '🌼' },
  { id: 'repos-assume', name: 'Le repos fait partie du plan', description: 'Prendre 3 vrais jours de repos quand ton corps le demande.', secret: false, emoji: '🌙' },
  // Badges secrets : leur existence se découvre au déblocage
  { id: 'retour-gagnant', name: 'Le retour gagnant', description: 'Reprendre ton rendez-vous après une interruption.', secret: true, emoji: '🔁' },
  { id: 'petite-victoire', name: 'La petite victoire', description: 'Faire une séance plus courte plutôt que renoncer.', secret: true, emoji: '🌱' },
  { id: 'pluie-ou-soleil', name: 'Pluie ou soleil', description: 'Honorer ton rendez-vous un jour où tu te sentais épuisée.', secret: true, emoji: '🌦️' },
  { id: 'deuxieme-souffle', name: 'Le deuxième souffle', description: 'Reprendre 3 fois après une pause.', secret: true, emoji: '🌬️' },
  { id: 'fidele-vendredi', name: 'Fidèle du vendredi', description: 'Honorer ton rendez-vous 4 vendredis.', secret: true, emoji: '🎈' },
  { id: 'chasseuse-mysteres', name: 'Chasseuse de mystères', description: 'Réussir 3 missions mystères.', secret: true, emoji: '🔮' },
  { id: 'lever-soleil', name: 'Lever de soleil', description: 'Boire un verre d\'eau avant 9 h, 5 jours différents.', secret: true, emoji: '🌅' },
  { id: 'constance-douce', name: 'La constance douce', description: 'Tenir la version minimale 4 fois dans la même semaine.', secret: true, emoji: '🫧' },
  { id: 'joueuse', name: 'Joueuse', description: '5 séances de Ring Fit.', secret: true, emoji: '🕹️' },
  { id: 'cent-verres', name: 'Cent verres', description: '100 verres d\'eau au total.', secret: true, emoji: '🥛' },
]

export function itemDef(id: string) { return ITEMS.find(i => i.id === id) }
export function badgeDef(id: string) { return BADGES.find(b => b.id === id) }
