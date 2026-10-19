// Phrases d'élan originales, tournées vers l'action plutôt que vers la motivation.
import { pick } from '../lib/ids'
import type { Day } from '../lib/dates'

export const QUOTES = [
  'Tu n\'as pas besoin d\'avoir envie. Tu as juste besoin de commencer.',
  'La version minimale, faite, vaut mieux que la version parfaite, rêvée.',
  'Rater un jour, c\'est normal. En rater deux, c\'est le moment de revenir.',
  'Ce n\'est pas la motivation qui te porte, c\'est le rendez-vous que tu as fixé.',
  'Cinq minutes, puis tu décides. C\'est tout.',
  'Les habitudes ne demandent pas de l\'enthousiasme, seulement de la répétition.',
  'Ton corps se souvient de chaque petite fois où tu es venue.',
  'Prépare ce soir ce qui sera facile demain.',
  'Le repos est une partie du plan, pas une sortie de route.',
  'Reprendre est une compétence. Elle se travaille comme le reste.',
  'Quand l\'envie manque, réduis la marche, ne supprime pas l\'escalier.',
  'Un verre d\'eau maintenant : la plus petite victoire de la journée.',
  'La régularité se construit les jours ordinaires.',
  'Tu ne recommences pas à zéro : tu reprends là où tu en étais.',
  'Ce que tu fais souvent compte plus que ce que tu fais parfois.',
  'Décide une fois, ensuite contente-toi de suivre le plan.',
  'Pas besoin d\'une grande journée, juste d\'une journée où tu viens.',
  'Le progrès ne se voit pas toujours sur la balance. Il se voit dans ce que tu fais.',
  'Tes engagements sont des promesses à toi-même : petites, mais tenues.',
  'Fais simple. Fais aujourd\'hui. Fais-le encore demain.',
  'La discipline, c\'est rendre la bonne action plus facile que l\'excuse.',
  'Mets tes baskets. La suite vient souvent toute seule.',
  'Un mauvais jour ne définit pas ta semaine.',
  'Avance au rythme qui te permettra de continuer.',
]

export function quoteOfDay(day: Day): string {
  return pick(QUOTES, 'citation:' + day)
}
