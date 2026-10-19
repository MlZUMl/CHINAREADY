// Bilan hebdomadaire : les faits de la semaine écoulée, puis une intention pour la suivante.
import type { Snapshot } from '../data/types'
import { addDays, type Day } from '../lib/dates'
import { rendezvousStats } from './ritual'
import { reprises, waterGlasses, waterGoal } from './discipline'

export interface WeekSummary {
  weekStart: Day
  rdv: ReturnType<typeof rendezvousStats>
  sessions: number
  minutes: number
  waterGoalDays: number
  mealDays: number
  avgEnergy: number | null
  reprises: number
  newRewards: { badges: number; items: number }
  missionsDone: number
  highlights: string[]
}

export function summarizeWeek(s: Snapshot, ws: Day, today: Day): WeekSummary {
  const we = addDays(ws, 6)
  const end = we < today ? we : today
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter(d => d <= end)
  const sessions = s.workouts.filter(w => w.completed && w.day >= ws && w.day <= end)
  const energies = s.daily_checkins.filter(c => c.day >= ws && c.day <= end && c.energy).map(c => c.energy as number)
  const inWeek = (iso: string) => iso.slice(0, 10) >= ws && iso.slice(0, 10) <= end
  const rdv = rendezvousStats(s, ws, end, today)
  const sum: WeekSummary = {
    weekStart: ws,
    rdv,
    sessions: sessions.length,
    minutes: sessions.reduce((n, w) => n + w.actual_minutes, 0),
    waterGoalDays: days.filter(d => waterGlasses(s, d) >= waterGoal(s)).length,
    mealDays: days.filter(d => s.meals.some(m => m.day === d)).length,
    avgEnergy: energies.length ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10 : null,
    reprises: reprises(s, today).filter(d => d >= ws && d <= end).length,
    newRewards: {
      badges: s.reward_grants.filter(g => g.kind === 'badge' && inWeek(g.granted_at)).length,
      items: s.reward_grants.filter(g => g.kind === 'item' && inWeek(g.granted_at)).length,
    },
    missionsDone: s.user_missions.filter(m => m.status === 'terminee' && m.day >= ws && m.day <= end).length,
    highlights: [],
  }
  if (rdv.honored) sum.highlights.push(`${rdv.honored} rendez-vous honoré${rdv.honored > 1 ? 's' : ''}`)
  if (rdv.smallSteps) sum.highlights.push(`${rdv.smallSteps} petit${rdv.smallSteps > 1 ? 's' : ''} pas plutôt que rien`)
  if (sum.reprises) sum.highlights.push('Tu as repris après une pause')
  if (sum.waterGoalDays) sum.highlights.push(`Objectif d'eau atteint ${sum.waterGoalDays} jour${sum.waterGoalDays > 1 ? 's' : ''}`)
  if (rdv.bonus) sum.highlights.push(`${rdv.bonus} séance${rdv.bonus > 1 ? 's' : ''} en bonus`)
  return sum
}

export const INTENTIONS = [
  'Honorer mes rendez-vous, même en version minimale',
  'Préparer ma tenue la veille',
  'Boire un verre d\'eau au réveil',
  'Planifier mes repas de la semaine',
  'Reprendre dès le lendemain si je rate un jour',
  'Essayer une nouvelle activité',
]
