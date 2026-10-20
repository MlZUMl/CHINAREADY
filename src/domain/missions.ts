// Missions du jour (dont missions mystères). Une mission n'est réussie que si sa condition
// est vérifiée dans les données enregistrées : il n'existe aucun bouton « valider » qui la contourne.
import type { Snapshot, UserMission } from '../data/types'
import { addDays, weekStart, type Day } from '../lib/dates'
import { hash } from '../lib/ids'
import { dayRitual, isRendezvousDay, sportCommitment, restEvent } from './ritual'
import { resumeState, waterReached, waterMl, hasFoodOn, recipeLogs, fruitOrVegOn } from './discipline'

export type MissionCategory = 'sport' | 'eau' | 'alimentation' | 'organisation' | 'bien-etre' | 'reprise'

export interface MissionDef {
  key: string
  name: string
  /** Objectif réel, toujours affiché dès que la mission est lancée */
  goal: string
  category: MissionCategory
  difficulty: 1 | 2 | 3
  xp: number
  /** La mission demande de bouger : jamais proposée un jour de repos */
  movement?: boolean
  eligible?: (ctx: MissionContext) => boolean
  success: (s: Snapshot, day: Day) => boolean
}

export interface MissionContext { s: Snapshot; day: Day; energy: number | null; restDay: boolean; resume: boolean; hour: number }

const hourOf = (iso: string) => new Date(iso).getHours()
const workoutsToday = (s: Snapshot, day: Day) => s.workouts.filter(w => w.day === day && w.completed)

export const MISSIONS: MissionDef[] = [
  { key: 'nouvelle-recette', name: 'Découverte en cuisine', goal: 'Cuisiner et noter une recette que tu n\'as encore jamais faite.', category: 'alimentation', difficulty: 2, xp: 25,
    success: (s, d) => { const logs = recipeLogs(s); return logs.some(m => m.day === d && !logs.some(o => o.recipe_id === m.recipe_id && o.day < d)) } },
  { key: 'eau-reveil', name: 'Le verre du réveil', goal: 'Boire un verre d\'eau avant 10 h et le noter.', category: 'eau', difficulty: 1, xp: 10,
    eligible: ({ hour }) => hour < 10,
    success: (s, d) => s.water_logs.some(w => w.day === d && hourOf(w.at) < 10) },
  { key: 'marche-10', name: 'Dix minutes dehors', goal: 'Faire une marche d\'au moins 10 minutes et l\'enregistrer.', category: 'sport', difficulty: 1, xp: 15, movement: true,
    success: (s, d) => workoutsToday(s, d).some(w => w.activity === 'marche' && w.actual_minutes >= 10) },
  { key: 'mobilite-courte', name: 'Corps délié', goal: 'Faire une séance guidée de mobilité, même courte.', category: 'sport', difficulty: 1, xp: 15, movement: true,
    success: (s, d) => workoutsToday(s, d).some(w => w.kind === 'guidee' && w.activity === 'mobilite') },
  { key: 'fruit-legume', name: 'Une touche de couleur', goal: 'Noter un repas qui contient un fruit ou des légumes.', category: 'alimentation', difficulty: 1, xp: 10,
    success: (s, d) => fruitOrVegOn(s, d) },
  { key: 'tenue-demain', name: 'Prête pour demain', goal: 'Préparer ta tenue de sport pour demain et cocher l\'habitude.', category: 'organisation', difficulty: 1, xp: 10,
    eligible: ({ s }) => s.commitments.some(c => c.kind === 'preparation' && c.active),
    success: (s, d) => s.habit_checks.some(h => h.day === d && s.commitments.find(c => c.id === h.commitment_id)?.kind === 'preparation') },
  { key: 'activite-plaisir', name: 'Pour le plaisir', goal: 'Faire une activité que tu aimes (Ring Fit, danse ou vélo) et l\'enregistrer.', category: 'sport', difficulty: 2, xp: 20, movement: true,
    success: (s, d) => workoutsToday(s, d).some(w => ['ring_fit', 'danse', 'velo'].includes(w.activity)) },
  { key: 'journal-ressenti', name: 'Deux lignes pour toi', goal: 'Écrire ton ressenti du jour dans ton journal.', category: 'bien-etre', difficulty: 1, xp: 10,
    success: (s, d) => s.journal_entries.some(j => j.day === d && j.text.trim().length >= 3) },
  { key: 'objectif-eau', name: 'Gourde vide', goal: 'Atteindre ton objectif d\'eau aujourd\'hui.', category: 'eau', difficulty: 2, xp: 15,
    success: (s, d) => waterReached(s, d) },
  { key: 'rdv-honore', name: 'Parole tenue', goal: 'Honorer ton rendez-vous sportif du jour (version minimale comprise).', category: 'sport', difficulty: 2, xp: 20, movement: true,
    eligible: ({ s, day }) => isRendezvousDay(sportCommitment(s), day),
    success: (s, d) => dayRitual(s, d, d).status === 'honore' },
  { key: 'recette-menu', name: 'Au menu ce soir', goal: 'Cuisiner une recette prévue dans ton menu de la semaine.', category: 'alimentation', difficulty: 2, xp: 20,
    eligible: ({ s, day }) => s.meal_plans.some(p => p.week_start === weekStart(day) && p.slots.length > 0),
    success: (s, d) => {
      const plan = s.meal_plans.find(p => p.week_start === weekStart(d))
      return Boolean(plan && recipeLogs(s).some(m => m.day === d && plan.slots.some(sl => sl.recipe_id === m.recipe_id)))
    } },
  { key: 'planifier-menu', name: 'Semaine sereine', goal: 'Planifier au moins 3 repas dans ton menu de la semaine.', category: 'organisation', difficulty: 2, xp: 20,
    success: (s, d) => (s.meal_plans.find(p => p.week_start === weekStart(d))?.slots.length ?? 0) >= 3 },
  { key: 'etirements-soir', name: 'Douceur du soir', goal: 'Faire une séance guidée de mobilité après 19 h.', category: 'bien-etre', difficulty: 1, xp: 15, movement: true,
    success: (s, d) => workoutsToday(s, d).some(w => w.kind === 'guidee' && w.activity === 'mobilite' && hourOf(w.started_at) >= 19) },
  { key: 'check-in', name: 'Météo intérieure', goal: 'Faire ton check-in d\'énergie du jour.', category: 'bien-etre', difficulty: 1, xp: 5,
    success: (s, d) => s.daily_checkins.some(c => c.day === d && c.energy) },
  { key: 'reprise', name: 'Le fil retrouvé', goal: 'Reprendre une habitude aujourd\'hui : la version minimale suffit.', category: 'reprise', difficulty: 1, xp: 25,
    eligible: ({ resume }) => resume,
    success: (s, d) => dayRitual(s, d, d).status === 'honore' || waterMl(s, d) > 0 || hasFoodOn(s, d) },
]

export function missionDef(key: string) { return MISSIONS.find(m => m.key === key) }

/** Une mission mystère environ un jour sur trois (déterministe). */
export function isMysteryDay(day: Day) { return hash('mystere:' + day) % 3 === 0 }

/** Choisit la mission du jour, sans hasard : mêmes données et même heure => même mission. */
export function chooseMission(s: Snapshot, day: Day, now: Date = new Date()): MissionDef | null {
  const checkin = s.daily_checkins.find(c => c.day === day)
  const energy = checkin?.energy ?? null
  const sport = sportCommitment(s)
  const restDay = !isRendezvousDay(sport, day) || Boolean(restEvent(s, day))
  const resume = resumeState(s, day).needed
  const ctx: MissionContext = { s, day, energy, restDay, resume, hour: now.getHours() }

  const recent = s.user_missions.filter(m => m.day >= addDays(day, -5) && m.day < day)
  const recentKeys = new Set(recent.map(m => m.mission_key))
  const lastWeek = s.user_missions.filter(m => m.day >= addDays(day, -7) && m.day < day)
  const ignored = lastWeek.filter(m => m.status === 'ignoree' || m.status === 'expiree')
  // Lassitude : si la plupart des missions récentes ont été laissées de côté, on change de catégories.
  const tiredCats = ignored.length >= 4 ? new Set(ignored.map(m => missionDef(m.mission_key)?.category)) : new Set()

  const candidates = MISSIONS.filter(m => {
    if (m.eligible && !m.eligible(ctx)) return false
    if (m.movement && restDay) return false
    if (energy !== null && energy <= 2 && m.difficulty >= 3) return false
    if (energy !== null && energy <= 1 && m.difficulty >= 2) return false
    return true
  })
  if (resume) {
    const r = candidates.find(m => m.key === 'reprise')
    if (r) return r
  }
  const ranked = candidates
    .filter(m => !recentKeys.has(m.key))
    .sort((a, b) => {
      const ta = tiredCats.has(a.category) ? 1 : 0
      const tb = tiredCats.has(b.category) ? 1 : 0
      return ta - tb || hash(day + a.key) - hash(day + b.key)
    })
  return ranked[0] ?? candidates.sort((a, b) => hash(day + a.key) - hash(day + b.key))[0] ?? null
}

export function missionId(day: Day, key: string) { return `${day}:${key}` }

/**
 * Opérations automatiques sur les missions : expiration des missions des jours passés,
 * réussite d'une mission active dont la condition est remplie. Idempotent.
 */
export function missionOps(s: Snapshot, today: Day, now: string): UserMission[] {
  const out: UserMission[] = []
  for (const um of s.user_missions) {
    if (um.status === 'active' || um.status === 'disponible') {
      const def = missionDef(um.mission_key)
      // Une mission classique (objectif visible) se réussit dès que la condition est remplie ;
      // une mission mystère doit d'abord être lancée, pour que l'objectif soit connu.
      const launched = um.status === 'active' || !um.mystery
      if (launched && def && def.success(s, um.day)) {
        out.push({ ...um, status: 'terminee', completed_at: now, reward_key: `mission:${um.id}` })
      } else if (um.day < today) {
        out.push({ ...um, status: 'expiree' })
      }
    }
  }
  return out
}
