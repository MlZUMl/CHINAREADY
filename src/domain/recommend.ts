// Mode « journée sans énergie » : adapte la séance proposée à l'énergie et au temps du jour.
// Ce module ne touche JAMAIS à l'alimentation : il ne lit ni n'écrit aucun repas et
// ne contient aucune donnée nutritionnelle. Il propose, il n'impose rien.
import type { Commitment, DailyCheckin, EnergyPreferences } from '../data/types'
import type { Focus } from './exercises'

export type Tone = 'doux' | 'neutre' | 'direct'

export interface SessionOption {
  id: 'mini' | 'habituelle' | 'plus' | 'douce' | 'petit-pas'
  label: string
  minutes: number
  focus: Focus
  version: 'min' | 'usual' | 'plus'
  hint: string
}

export interface Recommendation {
  tone: Tone
  headline: string
  message: string
  options: SessionOption[]
  /** index de l'option mise en avant */
  primary: number
  extras: { water: boolean; quickRecipe: boolean; minimumHabits: boolean }
  /** limiter les notifications non essentielles aujourd'hui */
  quiet: boolean
  restDay: boolean
}

export interface RecommendInput {
  checkin: DailyCheckin | undefined
  sport: Commitment | undefined
  prefs: EnergyPreferences | undefined
  isRendezvousDay: boolean
  tonePref?: 'auto' | 'direct' | 'doux'
  /** mettre la version minimale en avant (choix fait dans l'analyse des habitudes) */
  preferMinimum?: boolean
}

export function toneFor(energy: number | null | undefined, pref: 'auto' | 'direct' | 'doux' = 'auto'): Tone {
  if (pref === 'direct') return 'direct'
  if (pref === 'doux') return 'doux'
  if (!energy) return 'neutre'
  return energy <= 2 ? 'doux' : energy >= 4 ? 'direct' : 'neutre'
}

export function recommend({ checkin, sport, prefs, isRendezvousDay, tonePref = 'auto', preferMinimum = false }: RecommendInput): Recommendation {
  const min = sport?.min_minutes ?? 10
  const usual = sport?.usual_minutes ?? 20
  const enabled = prefs?.enabled ?? true
  const energy = enabled ? checkin?.energy ?? null : null
  const available = enabled ? checkin?.minutes ?? null : null
  const need = enabled ? checkin?.need ?? null : null
  const tone = toneFor(energy, tonePref)
  const cap = (m: number) => (available ? Math.min(m, available) : m)
  const restDay = !isRendezvousDay

  let focus: Focus = need === 'detente' ? 'mobilite' : need === 'bouger' ? 'cardio' : 'mixte'
  const options: SessionOption[] = []
  let primary = 0
  let headline: string
  let message: string

  if (energy !== null && energy <= 1) {
    focus = need === 'bouger' ? 'cardio' : 'mobilite'
    options.push({ id: 'douce', label: 'Mobilité douce', minutes: cap(Math.min(min, 10)), focus: 'mobilite', version: 'min', hint: 'Allongée ou assise, rien de difficile.' })
    options.push({ id: 'mini', label: 'Marche tranquille', minutes: cap(Math.min(min, 10)), focus: 'cardio', version: 'min', hint: 'Dehors ou dans l\'appartement, à ton rythme.' })
    headline = 'Journée à petite énergie'
    message = 'Pas besoin de tout réussir aujourd\'hui. Une seule petite chose suffit à garder le lien avec ton rendez-vous.'
  } else if (energy === 2) {
    options.push({ id: 'mini', label: 'Version minimale', minutes: cap(min), focus: focus === 'cardio' ? 'cardio' : 'mobilite', version: 'min', hint: 'Ton engagement minimum, en douceur.' })
    if (!available || available >= min + 5) options.push({ id: 'habituelle', label: 'Un peu plus, si ça va', minutes: cap(Math.max(min + 5, 15)), focus, version: 'usual', hint: 'À choisir seulement si tu te sens bien après 5 minutes.' })
    headline = 'Version légère aujourd\'hui'
    message = 'Fatiguée, mais là. On garde la structure, on baisse juste l\'intensité.'
  } else if (energy !== null && energy >= 4) {
    options.push({ id: 'habituelle', label: 'Ta séance prévue', minutes: cap(usual), focus, version: 'usual', hint: 'Celle que tu t\'es promise.' })
    const plus = usual + 10
    if (!available || available >= plus) options.push({ id: 'plus', label: 'Un cran au-dessus', minutes: cap(plus), focus, version: 'plus', hint: 'Un peu plus longue et tonique, si l\'envie est là.' })
    options.push({ id: 'mini', label: 'Version courte', minutes: cap(min), focus, version: 'min', hint: 'Toujours là si le temps file.' })
    headline = energy === 5 ? 'Pleine d\'énergie !' : 'En forme aujourd\'hui'
    message = 'C\'est le bon jour pour ta séance prévue. Tu choisis : la séance habituelle ou un petit défi.'
  } else {
    options.push({ id: 'habituelle', label: 'Ta séance prévue', minutes: cap(usual), focus, version: 'usual', hint: 'Le rendez-vous habituel.' })
    options.push({ id: 'mini', label: 'Version courte', minutes: cap(min), focus, version: 'min', hint: 'Si la journée a été longue.' })
    headline = energy === 3 ? 'Moyennement en forme' : 'Ton rendez-vous du jour'
    message = energy === 3
      ? 'Commence par les cinq premières minutes, puis décide si tu continues.'
      : 'Tu sais quoi faire et quand le faire : il reste juste à commencer.'
  }

  // Si le temps disponible est plus court que la version minimale : garder le lien avec 5 minutes.
  if (available && available < min) {
    options.unshift({ id: 'petit-pas', label: 'Petit pas de 5 minutes', minutes: 5, focus: energy !== null && energy <= 2 ? 'mobilite' : focus, version: 'min', hint: 'Juste pour ne pas casser le fil.' })
    primary = 0
  }

  if (preferMinimum && !(available && available < min)) {
    primary = Math.max(0, options.findIndex(o => o.version === 'min'))
  }

  if (need === 'reprendre') {
    primary = Math.max(0, options.findIndex(o => o.version === 'min'))
    headline = 'On reprend simplement'
    message = 'Pas de rattrapage, pas de double séance : la version minimale aujourd\'hui, et le rythme revient.'
  }

  if (restDay) {
    headline = 'Jour sans rendez-vous prévu'
    message = 'Le repos fait partie du programme. Si l\'envie de bouger est là, voici une option douce, sans obligation.'
  }

  // Dédoublonnage (même durée et même version), en gardant l'option recommandée.
  const chosen = options[primary]
  const keyOf = (o: SessionOption) => o.version + ':' + o.minutes + ':' + o.focus
  const byKey = new Map<string, SessionOption>()
  for (const o of options) if (!byKey.has(keyOf(o)) || o === chosen) byKey.set(keyOf(o), o)
  const unique = [...byKey.values()]
  const primaryIndex = Math.max(0, unique.indexOf(chosen))

  return {
    tone, headline, message, options: unique, primary: primaryIndex,
    extras: { water: need === 'eau', quickRecipe: need === 'cuisine', minimumHabits: need === 'reprendre' },
    quiet: Boolean(enabled && prefs?.quiet_when_low && energy !== null && energy <= 1),
    restDay,
  }
}

export const ENERGY_LABELS: Record<number, string> = {
  1: 'Épuisée', 2: 'Fatiguée', 3: 'Moyennement en forme', 4: 'En forme', 5: 'Pleine d\'énergie',
}
export const NEED_LABELS: Record<string, string> = {
  bouger: 'Bouger', detente: 'Me détendre', cuisine: 'Cuisiner simplement', eau: 'Boire davantage', reprendre: 'Reprendre mes habitudes',
}
