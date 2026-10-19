// Rendez-vous sportif (rituel) et état des habitudes, calculés uniquement
// à partir des données réellement enregistrées.
import type { Commitment, Snapshot, Workout, RitualEvent, RestReason } from '../data/types'
import { isoWeekday, type Day, addDays, dayOfIso } from '../lib/dates'

export function sportCommitment(s: Snapshot): Commitment | undefined {
  return s.commitments.find(c => c.kind === 'sport' && c.active)
}

export function isRendezvousDay(c: Commitment | undefined, day: Day): boolean {
  return Boolean(c && c.active && c.days.includes(isoWeekday(day)))
}

export function workoutsOn(s: Snapshot, day: Day): Workout[] {
  return s.workouts.filter(w => w.day === day && w.completed)
}

export function minutesOn(s: Snapshot, day: Day): number {
  return workoutsOn(s, day).reduce((sum, w) => sum + w.actual_minutes, 0)
}

export type RdvStatus = 'honore' | 'petit-pas' | 'repos' | 'manque' | 'a-venir' | 'libre'

export interface DayRitual {
  day: Day
  scheduled: boolean
  status: RdvStatus
  minutes: number
  version: 'min' | 'usual' | 'plus' | null
  restReason: RestReason | null
}

export function restEvent(s: Snapshot, day: Day): RitualEvent | undefined {
  return s.ritual_events.filter(e => e.day === day && e.action === 'repos').sort((a, b) => b.at.localeCompare(a.at))[0]
}

/**
 * - honoré : au moins la version minimale (en minutes cumulées sur la journée)
 * - petit pas : une séance plus courte que le minimum (elle compte comme un effort, pas comme le rendez-vous)
 * - repos : repos choisi et noté
 * - manqué : jour passé sans rien
 */
/** Premier jour où le rendez-vous existait : avant, aucun jour ne peut être « manqué ». */
export function rendezvousSince(c: Commitment | undefined): Day | null {
  return c?.created_at ? dayOfIso(c.created_at) : null
}

export function dayRitual(s: Snapshot, day: Day, today: Day): DayRitual {
  const c = sportCommitment(s)
  const since = rendezvousSince(c)
  const scheduled = isRendezvousDay(c, day) && (!since || day >= since)
  const minutes = minutesOn(s, day)
  const min = c?.min_minutes ?? 10
  const usual = c?.usual_minutes ?? 20
  let version: DayRitual['version'] = null
  if (minutes >= min) version = minutes > usual ? 'plus' : minutes >= usual ? 'usual' : 'min'
  const rest = restEvent(s, day)
  let status: RdvStatus
  if (version) status = 'honore'
  else if (minutes > 0) status = 'petit-pas'
  else if (rest) status = 'repos'
  else if (!scheduled) status = 'libre'
  else if (day < today) status = 'manque'
  else status = 'a-venir'
  return { day, scheduled, status, minutes, version, restReason: rest?.reason ?? null }
}

export interface RdvStats {
  scheduled: number
  honored: number
  smallSteps: number
  rests: number
  restsNoDesire: number
  /** séances faites un jour sans rendez-vous prévu */
  bonus: number
  missed: number
  /** honorés / (prévus passés - repos justifiés), null s'il n'y a encore rien à mesurer */
  rate: number | null
}

export function rendezvousStats(s: Snapshot, from: Day, to: Day, today: Day): RdvStats {
  const st: RdvStats = { scheduled: 0, honored: 0, smallSteps: 0, rests: 0, restsNoDesire: 0, bonus: 0, missed: 0, rate: null }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = dayRitual(s, d, today)
    if (!r.scheduled) { if (r.minutes > 0 && d <= today) st.bonus++; continue }
    if (d > today) continue
    if (d === today && r.status === 'a-venir') continue
    st.scheduled++
    if (r.status === 'honore') st.honored++
    else if (r.status === 'petit-pas') st.smallSteps++
    else if (r.status === 'repos') { st.rests++; if (r.restReason === 'pas_envie') st.restsNoDesire++ }
    else if (r.status === 'manque') st.missed++
  }
  // Un repos pour fatigue réelle ou imprévu sort du calcul ; un repos « pas envie » reste un rendez-vous non honoré
  // (sans jugement : l'appli s'en sert seulement pour proposer d'ajuster l'horaire ou la durée).
  const denom = st.scheduled - (st.rests - st.restsNoDesire)
  st.rate = denom > 0 ? st.honored / denom : null
  return st
}

/** Nombre de reports (« plus tard ») et de repos « pas envie » sur les derniers rendez-vous. */
export function postponements(s: Snapshot, from: Day, to: Day) {
  const ev = s.ritual_events.filter(e => e.day >= from && e.day <= to)
  return {
    reports: ev.filter(e => e.action === 'report').length,
    noDesire: ev.filter(e => e.action === 'repos' && e.reason === 'pas_envie').length,
  }
}
