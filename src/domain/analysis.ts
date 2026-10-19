// Analyse des habitudes : moteur de règles transparent et déterministe (aucune IA externe).
// Chaque tendance n'apparaît que si l'historique est suffisant, et chaque recommandation
// suit le même format : observation factuelle, explication prudente, suggestion concrète.
// Une corrélation n'est jamais présentée comme une cause, et rien n'est diagnostiqué.
import type { Snapshot } from '../data/types'
import { addDays, isoWeekday, weekStart, WEEKDAYS, type Day } from '../lib/dates'
import { dayRitual, isRendezvousDay, postponements, sportCommitment } from './ritual'
import { BUCKET_LABELS, completionByDuration, SLOT_LABELS, bestSlots, waterGlasses, waterGoal } from './discipline'
import { cycleInfo, periodDays } from './body'

export type InsightAction =
  | { type: 'set-usual-minutes'; minutes: number }
  | { type: 'set-cue-time'; time: string }
  | { type: 'ask-obstacle' }
  | { type: 'enable-hydration-reminders' }
  | { type: 'plan-minimum-days'; weekday: number }
  | { type: 'gentle-on-period' }
  | { type: 'none' }

export interface Insight {
  key: string
  period: string
  title: string
  observation: string
  explanation: string
  suggestion: string
  action: InsightAction
  /** pour modifier plutôt qu'accepter tel quel */
  editable: boolean
}

export interface AnalysisResult {
  insights: Insight[]
  /** Explications sur ce qui ne peut pas encore être analysé */
  notEnough: string[]
}

const pct = (x: number) => Math.round(x * 100) + ' %'

export function analyze(s: Snapshot, today: Day): AnalysisResult {
  const insights: Insight[] = []
  const notEnough: string[] = []
  const period = weekStart(today)
  const from14 = addDays(today, -14)
  const from28 = addDays(today, -28)
  const sport = sportCommitment(s)

  // 1. Durée des séances terminées
  const dur = completionByDuration(s, from28, today)
  const buckets = (Object.keys(dur) as (keyof typeof dur)[]).filter(k => dur[k].started >= 3)
  if (buckets.length >= 2) {
    const rates = buckets.map(k => ({ k, r: dur[k].finished / dur[k].started }))
    rates.sort((a, b) => b.r - a.r)
    const best = rates[0], worst = rates[rates.length - 1]
    if (best.r - worst.r >= 0.25 && best.k === 'court' && (sport?.usual_minutes ?? 20) > 15) {
      insights.push({
        key: 'duree-courte', period, title: 'Les séances courtes te réussissent',
        observation: `Sur les 4 dernières semaines, tu as terminé ${pct(best.r)} des séances de ${BUCKET_LABELS[best.k]}, contre ${pct(worst.r)} pour celles de ${BUCKET_LABELS[worst.k]}.`,
        explanation: 'Ce n\'est qu\'une tendance sur tes propres données : une séance plus courte est peut-être plus facile à caser après le travail.',
        suggestion: 'Essayer une séance habituelle de 15 minutes pendant une ou deux semaines ?',
        action: { type: 'set-usual-minutes', minutes: 15 }, editable: true,
      })
    }
  } else {
    notEnough.push('Durée des séances : il faut au moins 3 séances guidées dans deux durées différentes.')
  }

  // 2. Jour de la semaine le plus fragile
  if (sport) {
    const perWd = new Map<number, { planned: number; honored: number }>()
    for (let d = from28; d < today; d = addDays(d, 1)) {
      const r = dayRitual(s, d, today)
      if (!r.scheduled) continue
      if (r.status === 'repos' && r.restReason !== 'pas_envie') continue
      const wd = isoWeekday(d)
      const v = perWd.get(wd) ?? { planned: 0, honored: 0 }
      v.planned++
      if (r.status === 'honore') v.honored++
      perWd.set(wd, v)
    }
    const eligible = [...perWd.entries()].filter(([, v]) => v.planned >= 3)
    if (eligible.length >= 3) {
      const rated = eligible.map(([wd, v]) => ({ wd, r: v.honored / v.planned })).sort((a, b) => a.r - b.r)
      const low = rated[0], high = rated[rated.length - 1]
      if (high.r - low.r >= 0.4) {
        insights.push({
          key: 'jour-fragile-' + low.wd, period, title: `Le ${WEEKDAYS[low.wd - 1]} est plus difficile`,
          observation: `Ces 4 dernières semaines, tu as honoré ${pct(low.r)} de tes rendez-vous du ${WEEKDAYS[low.wd - 1]}, contre ${pct(high.r)} le ${WEEKDAYS[high.wd - 1]}.`,
          explanation: 'Peut-être que la fatigue de la semaine s\'accumule ce jour-là, mais seule toi peux le dire.',
          suggestion: `Prévoir d'office la version minimale le ${WEEKDAYS[low.wd - 1]}, plutôt que de viser la séance complète ?`,
          action: { type: 'plan-minimum-days', weekday: low.wd }, editable: false,
        })
      }
    } else {
      notEnough.push('Jours de la semaine : il faut environ 3 semaines de rendez-vous.')
    }
  }

  // 3. Reports fréquents => demander l'obstacle, sans le supposer
  const post = postponements(s, from14, today)
  if (post.reports + post.noDesire >= 3) {
    insights.push({
      key: 'reports', period, title: 'Ton rendez-vous glisse souvent',
      observation: `Sur 14 jours, tu as reporté ou laissé passer ton rendez-vous ${post.reports + post.noDesire} fois.`,
      explanation: 'Les données ne disent pas pourquoi. L\'horaire, la fatigue ou la préparation peuvent jouer : c\'est toi qui sais.',
      suggestion: 'Me dire ce qui bloque le plus, pour ajuster l\'horaire, la durée ou la préparation ?',
      action: { type: 'ask-obstacle' }, editable: false,
    })
  }

  // 4. Moment de la journée
  const slots = bestSlots(s, from28, today)
  if (slots.total >= 8 && sport?.cue_time) {
    const top = slots.slots[0]
    const cueSlot = (() => { const h = Number(sport.cue_time!.slice(0, 2)); return h < 11 ? 'matin' : h < 14 ? 'midi' : h < 17 ? 'apres-midi' : h < 19 ? 'fin-de-journee' : 'soir' })()
    if (top.slot !== cueSlot && top.share >= 0.6) {
      const time = { matin: '08:00', midi: '12:30', 'apres-midi': '15:30', 'fin-de-journee': '17:15', soir: '19:30' }[top.slot]
      insights.push({
        key: 'moment-' + top.slot, period, title: 'Un autre moment te convient peut-être mieux',
        observation: `${pct(top.share)} de tes séances des 4 dernières semaines ont eu lieu ${SLOT_LABELS[top.slot]}, alors que ton rappel est à ${sport.cue_time}.`,
        explanation: 'Tu sembles bouger plus facilement à ce moment-là. Cela ne veut pas dire que l\'autre horaire est mauvais.',
        suggestion: `Déplacer ton rendez-vous vers ${time.replace(':', ' h ')} ?`,
        action: { type: 'set-cue-time', time }, editable: true,
      })
    }
  } else if (slots.total < 8) {
    notEnough.push('Moments favorables : il faut au moins 8 séances enregistrées.')
  }

  // 5. Hydratation
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(from14, i))
  const waterDays = days14.filter(d => s.water_logs.some(w => w.day === d))
  if (waterDays.length >= 10) {
    const reached = days14.filter(d => waterGlasses(s, d) >= waterGoal(s)).length
    const remindersOn = s.notification_preferences[0]?.hydration
    if (reached / 14 < 0.4 && !remindersOn) {
      insights.push({
        key: 'eau-rappels', period, title: 'L\'objectif d\'eau est rarement atteint',
        observation: `Ton objectif d'eau a été atteint ${reached} jours sur les 14 derniers.`,
        explanation: 'Boire en une fois est difficile ; répartir sur la journée aide souvent, mais à toi de voir si ça te correspond.',
        suggestion: 'Activer trois petits rappels d\'eau répartis dans la journée ?',
        action: { type: 'enable-hydration-reminders' }, editable: true,
      })
    }
  } else {
    notEnough.push('Hydratation : il faut au moins 10 jours d\'eau notée sur les deux dernières semaines.')
  }

  // 6. Repas notés : semaine vs week-end
  const days28 = Array.from({ length: 28 }, (_, i) => addDays(from28, i))
  const mealDays = days28.filter(d => s.meals.some(m => m.day === d))
  if (mealDays.length >= 10) {
    const wk = days28.filter(d => isoWeekday(d) <= 5)
    const we = days28.filter(d => isoWeekday(d) > 5)
    const rWk = wk.filter(d => mealDays.includes(d)).length / wk.length
    const rWe = we.filter(d => mealDays.includes(d)).length / we.length
    if (Math.abs(rWk - rWe) >= 0.35) {
      const weekendLower = rWe < rWk
      insights.push({
        key: 'repas-' + (weekendLower ? 'weekend' : 'semaine'), period, title: weekendLower ? 'Le week-end, le carnet se repose' : 'En semaine, le carnet est plus calme',
        observation: `Tu notes tes repas ${pct(rWk)} des jours de semaine et ${pct(rWe)} des jours de week-end.`,
        explanation: 'Les rythmes changent selon les jours ; ce n\'est pas un problème en soi.',
        suggestion: weekendLower ? 'Le week-end, garder la version minimale : juste le nom du plat principal ?' : 'Les jours chargés, noter seulement le repas du soir ?',
        action: { type: 'none' }, editable: false,
      })
    }
  }

  // 7. Énergie et séances
  const checkins = s.daily_checkins.filter(c => c.energy && c.day >= from28 && c.day < today)
  if (checkins.length >= 10) {
    const low = checkins.filter(c => (c.energy as number) <= 2)
    const lowDone = low.filter(c => s.workouts.some(w => w.day === c.day && w.completed))
    if (low.length >= 3 && lowDone.length / low.length >= 0.5) {
      insights.push({
        key: 'energie-basse-actif', period, title: 'Même fatiguée, tu bouges',
        observation: `Sur ${low.length} journées à énergie basse, tu as quand même fait une séance ${lowDone.length} fois.`,
        explanation: 'La version minimale semble t\'aider à garder le lien les jours difficiles.',
        suggestion: 'Garder la version minimale comme filet de sécurité, sans pression.',
        action: { type: 'none' }, editable: false,
      })
    }
  } else {
    notEnough.push('Énergie et séances : il faut au moins 10 check-ins sur 4 semaines.')
  }

  // 8. Énergie selon le cycle (uniquement jours de règles réellement notés)
  const info = cycleInfo(s.cycle_days)
  if (info.starts.length >= 2) {
    const pd = new Set(periodDays(s.cycle_days))
    const all = s.daily_checkins.filter(c => c.energy)
    const during = all.filter(c => pd.has(c.day)).map(c => c.energy as number)
    const outside = all.filter(c => !pd.has(c.day)).map(c => c.energy as number)
    if (during.length >= 4 && outside.length >= 8) {
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      const diff = avg(outside) - avg(during)
      if (diff >= 0.7) {
        insights.push({
          key: 'cycle-energie', period, title: 'Ton énergie pendant les règles',
          observation: `Ton énergie déclarée est en moyenne de ${avg(during).toFixed(1)}/5 pendant tes règles, contre ${avg(outside).toFixed(1)}/5 le reste du temps.`,
          explanation: 'C\'est une observation sur tes données, pas un avis médical.',
          suggestion: 'Mettre automatiquement la version douce en avant les jours de règles notés ?',
          action: { type: 'gentle-on-period' }, editable: false,
        })
      }
    }
  } else if (s.cycle_days.length) {
    notEnough.push('Cycle : il faut au moins deux débuts de règles notés.')
  }

  // Les décisions déjà prises (acceptée, modifiée, ignorée) ne sont pas reproposées dans la même période.
  const decided = new Set(s.habit_insights.filter(h => h.status !== 'nouvelle').map(h => h.insight_key + ':' + h.period))
  return { insights: insights.filter(i => !decided.has(i.key + ':' + i.period)), notEnough }
}
