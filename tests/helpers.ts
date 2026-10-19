import { TABLES, type Snapshot, type Workout, type Commitment } from '../src/data/types'
import { defaultCommitments, defaultEnergyPrefs, defaultNotificationPrefs, defaultProfile } from '../src/domain/defaults'

export function emptySnap(): Snapshot {
  const s = {} as any
  for (const t of TABLES) s[t] = []
  return s
}

/** Données de départ comme après l'accueil, créées le `createdDay`. */
export function baseSnap(createdDay = '2026-09-01'): Snapshot {
  const s = emptySnap()
  const at = createdDay + 'T08:00:00.000Z'
  s.profiles = [{ ...defaultProfile('Test', 'Europe/Paris'), created_at: at, updated_at: at }]
  s.energy_preferences = [{ ...defaultEnergyPrefs(), created_at: at, updated_at: at }]
  s.notification_preferences = [{ ...defaultNotificationPrefs('Europe/Paris'), created_at: at, updated_at: at }]
  s.commitments = defaultCommitments().map(c => ({ ...c, created_at: at, updated_at: at })) as Commitment[]
  return s
}

let n = 0
export function workout(day: string, minutes: number, extra: Partial<Workout> = {}): Workout {
  n++
  return {
    id: 'w' + n + '-' + day, day, started_at: day + 'T15:15:00.000Z', ended_at: day + 'T15:35:00.000Z', kind: 'guidee',
    activity: 'mixte', program: null, planned_minutes: minutes, actual_minutes: minutes, version: minutes >= 20 ? 'usual' : 'min',
    completed: true, source: 'rituel', energy: null, note: null, created_at: day + 'T15:35:00.000Z', updated_at: day + 'T15:35:00.000Z', ...extra,
  }
}

export const T = (iso: string) => ({ created_at: iso, updated_at: iso })
