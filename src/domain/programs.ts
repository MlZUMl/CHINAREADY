// Programmes sportifs progressifs (4 à 8 semaines, 3 séances par semaine).
// La progression porte sur la durée et le niveau (exercices plus toniques, repos plus courts).
// L'avancement se déduit des séances enregistrées (titre de séance stable) : rien d'autre à stocker.
// Les jours de faible énergie, la séance s'adoucit d'elle-même (buildSession) : aucun retard ne « bloque ».
import type { Snapshot, Workout } from '../data/types'
import type { Day } from '../lib/dates'
import type { Focus } from './exercises'

export type Level = 1 | 2 | 3
export interface ProgramSession { week: number; n: number; focus: Focus; minutes: number; level: Level; title: string }
export interface Program {
  id: string
  name: string
  short: string
  emoji: string
  weeks: number
  perWeek: number
  pitch: string
  forWhom: string
  /** minutes et niveau, semaine par semaine */
  plan: { minutes: number; level: Level }[]
  /** type de chaque séance de la semaine */
  rotation: Focus[]
}

export const PROGRAMS: Program[] = [
  {
    id: 'reprise', name: 'Reprise en douceur', short: 'Reprise', emoji: '🌱', weeks: 4, perWeek: 3,
    pitch: 'Retrouver le plaisir de bouger, sans courbatures qui découragent.',
    forWhom: 'Si tu reprends après une longue pause ou si tu débutes.',
    plan: [{ minutes: 10, level: 1 }, { minutes: 12, level: 1 }, { minutes: 15, level: 1 }, { minutes: 15, level: 2 }],
    rotation: ['mixte', 'mobilite', 'renfo'],
  },
  {
    id: 'tonifier', name: 'Tonifier tout le corps', short: 'Tonifier', emoji: '💪', weeks: 6, perWeek: 3,
    pitch: 'Du renforcement progressif pour les jambes, les fessiers, le dos et les bras.',
    forWhom: 'Si tu bouges déjà un peu et veux te sentir plus forte.',
    plan: [{ minutes: 15, level: 1 }, { minutes: 15, level: 2 }, { minutes: 20, level: 2 }, { minutes: 20, level: 2 }, { minutes: 25, level: 3 }, { minutes: 25, level: 3 }],
    rotation: ['renfo', 'cardio', 'renfo'],
  },
  {
    id: 'cardio', name: 'Cardio doux et endurance', short: 'Cardio doux', emoji: '💃', weeks: 6, perWeek: 3,
    pitch: 'Du cardio sans sauts au début, pour gagner en souffle semaine après semaine.',
    forWhom: 'Si tu veux transpirer un peu, sans impact pour les genoux au départ.',
    plan: [{ minutes: 15, level: 1 }, { minutes: 20, level: 1 }, { minutes: 20, level: 2 }, { minutes: 25, level: 2 }, { minutes: 25, level: 3 }, { minutes: 30, level: 3 }],
    rotation: ['cardio', 'mixte', 'cardio'],
  },
  {
    id: 'souplesse', name: 'Renfo et souplesse', short: 'Renfo + souplesse', emoji: '🧘‍♀️', weeks: 4, perWeek: 3,
    pitch: 'Gainage, posture et étirements : un corps plus solide et plus délié.',
    forWhom: 'Si tu as le dos raide après le travail ou tu préfères le calme.',
    plan: [{ minutes: 10, level: 1 }, { minutes: 15, level: 1 }, { minutes: 15, level: 2 }, { minutes: 20, level: 2 }],
    rotation: ['renfo', 'mobilite', 'mixte'],
  },
  {
    id: 'trente', name: 'Objectif 30 minutes', short: 'Objectif 30 min', emoji: '🎯', weeks: 8, perWeek: 3,
    pitch: 'De 10 à 30 minutes en 8 semaines, en alternant renfo et cardio.',
    forWhom: 'Si tu veux une vraie progression sur deux mois.',
    plan: [{ minutes: 10, level: 1 }, { minutes: 12, level: 1 }, { minutes: 15, level: 2 }, { minutes: 18, level: 2 }, { minutes: 20, level: 2 }, { minutes: 24, level: 2 }, { minutes: 27, level: 3 }, { minutes: 30, level: 3 }],
    rotation: ['mixte', 'cardio', 'renfo'],
  },
]

export const programById = (id: string | null | undefined) => PROGRAMS.find(p => p.id === id)

export const sessionTitle = (p: Program, week: number, n: number) => `${p.short} · semaine ${week} · séance ${n}`

/** Toutes les séances du programme, dans l'ordre. */
export function programSessions(p: Program): ProgramSession[] {
  const out: ProgramSession[] = []
  for (let w = 1; w <= p.weeks; w++) {
    const { minutes, level } = p.plan[w - 1]
    for (let n = 1; n <= p.perWeek; n++) out.push({ week: w, n, focus: p.rotation[(n - 1) % p.rotation.length], minutes, level, title: sessionTitle(p, w, n) })
  }
  return out
}

export interface ProgramProgress {
  program: Program
  start: Day
  sessions: ProgramSession[]
  done: Set<string>
  next: ProgramSession | null
  doneCount: number
  /** semaine en cours (celle de la prochaine séance) */
  week: number
  finished: boolean
}

/** Séances du programme faites depuis son démarrage (même partielles : chaque séance commencée compte). */
export function programProgress(s: Snapshot, today: Day): ProgramProgress | null {
  const cur = s.profiles[0]?.settings.program
  const program = programById(cur?.id)
  if (!cur || !program) return null
  const sessions = programSessions(program)
  const titles = new Set(sessions.map(x => x.title))
  const done = new Set(s.workouts.filter((w: Workout) => w.day >= cur.start && w.day <= today && w.program && titles.has(w.program)).map(w => w.program!))
  const next = sessions.find(x => !done.has(x.title)) ?? null
  return { program, start: cur.start, sessions, done, next, doneCount: done.size, week: next?.week ?? program.weeks, finished: !next }
}

/** Adresse de la séance guidée correspondante. */
export function sessionUrl(x: ProgramSession, source: 'rituel' | 'libre' = 'libre') {
  return `/seance?min=${x.minutes}&focus=${x.focus}&niveau=${x.level}&version=usual&source=${source}&programme=${encodeURIComponent(x.title)}`
}

export const LEVEL_LABELS: Record<Level, string> = { 1: 'doux', 2: 'modéré', 3: 'tonique' }
