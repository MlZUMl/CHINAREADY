// Capsules temporelles : verrouillage choisi, solution de récupération, comparaisons honnêtes.
import type { CapsuleSnapshot, ProgressCapsule, Snapshot } from '../data/types'
import { addDays, type Day } from '../lib/dates'
import { rendezvousStats } from './ritual'
import { reprises, waterReached, hasFoodOn } from './discipline'
import { levelFor, totalXp } from './rewards'
import { weightTrend } from './body'

export type CapsuleAccess = 'ouverte' | 'prete' | 'verrouillee' | 'deblocage-en-cours'

/** Délai de réflexion avant une ouverture anticipée : la capsule reste récupérable, sans perdre son sens. */
export const EARLY_UNLOCK_HOURS = 24

export function capsuleAccess(c: ProgressCapsule, today: Day, now: Date = new Date()): CapsuleAccess {
  if (c.opened_at || !c.locked) return 'ouverte'
  if (c.open_on && today >= c.open_on) return 'prete'
  if (c.unlock_requested_at) {
    const ready = Date.parse(c.unlock_requested_at) + EARLY_UNLOCK_HOURS * 3600_000
    return now.getTime() >= ready ? 'prete' : 'deblocage-en-cours'
  }
  return 'verrouillee'
}

/** Le contenu ne peut être lu que si la capsule n'est pas (ou plus) verrouillée. */
export function canReadContent(c: ProgressCapsule, today: Day, now?: Date) {
  return capsuleAccess(c, today, now) === 'ouverte'
}

/** Une capsule ouverte ou non verrouillée se modifie ; une capsule verrouillée ne peut que se supprimer. */
export function canEdit(c: ProgressCapsule, today: Day, now?: Date) {
  return capsuleAccess(c, today, now) === 'ouverte'
}

export function buildCapsuleSnapshot(s: Snapshot, today: Day): CapsuleSnapshot {
  const from = addDays(today, -29)
  const rdv = rendezvousStats(s, from, today, today)
  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i))
  const energies = s.daily_checkins.filter(c => c.day >= from && c.day <= today && c.energy).map(c => c.energy as number)
  const trend = weightTrend(s.weights)
  return {
    workouts_last_30: s.workouts.filter(w => w.completed && w.day >= from && w.day <= today).length,
    rendezvous_rate_30: rdv.rate,
    water_goal_days_30: days.filter(d => waterReached(s, d)).length,
    meals_logged_days_30: days.filter(d => hasFoodOn(s, d)).length,
    avg_energy_30: energies.length ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10 : null,
    weight_trend: trend.length ? trend[trend.length - 1].trend : null,
    level: levelFor(totalXp(s)).level,
    badges: s.reward_grants.filter(g => g.kind === 'badge').length,
    reprises: reprises(s, today).length,
  }
}

export interface Comparison { label: string; then: string; now: string }

/** Compare uniquement ce qui a été réellement mesuré aux deux moments. */
export function compareCapsule(c: ProgressCapsule, s: Snapshot, today: Day, includeWeight: boolean): Comparison[] {
  const now = buildCapsuleSnapshot(s, today)
  const then = c.snapshot ?? {}
  const out: Comparison[] = []
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100) + ' %')
  const push = (label: string, a: string | number | null | undefined, b: string | number | null | undefined) => {
    if (a === null || a === undefined || b === null || b === undefined) return
    out.push({ label, then: String(a), now: String(b) })
  }
  push('Séances sur 30 jours', then.workouts_last_30, now.workouts_last_30)
  push('Rendez-vous honorés (30 jours)', pct(then.rendezvous_rate_30), pct(now.rendezvous_rate_30))
  push('Jours objectif d\'eau (30 jours)', then.water_goal_days_30, now.water_goal_days_30)
  push('Jours avec repas notés (30 jours)', then.meals_logged_days_30, now.meals_logged_days_30)
  push('Énergie moyenne déclarée', then.avg_energy_30, now.avg_energy_30)
  push('Niveau de ton univers', then.level, now.level)
  push('Badges', then.badges, now.badges)
  push('Reprises après une pause', then.reprises, now.reprises)
  if (includeWeight) {
    const w0 = c.weight_kg ?? then.weight_trend
    push('Poids (tendance)', w0 !== null && w0 !== undefined ? `${w0} kg` : null, now.weight_trend !== null && now.weight_trend !== undefined ? `${now.weight_trend} kg` : null)
  }
  return out
}

export const OPEN_DELAYS = [30, 60, 90] as const
