// Suivi du cycle menstruel, inspiré de Flo — estimations transparentes, jamais de diagnostic.
//
// Principes :
//  - Les dates RÉELLES viennent uniquement des jours notés (cycle_days.period). Tout le reste est une
//    PRÉVISION, toujours présentée comme telle, avec son degré de certitude.
//  - Prévision des règles : dernier début + durée moyenne des cycles (6 derniers cycles valides),
//    28 jours par défaut tant qu'il n'y a pas d'historique (certitude faible, affichée).
//  - Ovulation estimée ≈ 14 jours avant les règles suivantes ; fenêtre fertile = 5 jours avant + le jour suivant.
//    Une ovulation « confirmée » (test, suivi médical) est notée par l'utilisatrice et affichée à part.
//    Le calendrier n'est JAMAIS présenté comme une méthode de contraception.
//  - Repères de normalité (FIGO 2018) : cycle de 24 à 38 jours, règles de 8 jours au plus,
//    écart de 7 jours au plus entre le cycle le plus court et le plus long = régulier.
//  - Un retard est une information, jamais une conclusion : aucune grossesse n'est déduite.
import type { CycleDay, Snapshot } from '../data/types'
import { addDays, daysBetween, type Day } from '../lib/dates'

export const DEFAULT_CYCLE = 28
export const LUTEAL = 14
export const NORMAL_CYCLE = { min: 24, max: 38 }
export const NORMAL_PERIOD_MAX = 8
export const REGULAR_SPREAD = 7
const VALID_CYCLE = { min: 18, max: 60 }

export interface PeriodRun {
  start: Day
  /** dernier jour noté */
  last: Day
  length: number
  /** fin indiquée explicitement, ou déduite (plus aucun jour noté depuis 2 jours) */
  ended: boolean
  endConfirmed: boolean
}

export interface CycleRecord {
  start: Day
  periodLength: number
  /** null pour le cycle en cours */
  length: number | null
  /** prévision qui aurait été faite avec les cycles précédents (null s'il n'y en avait pas) */
  predictedStart: Day | null
  /** écart réel − prévu, en jours (positif = arrivé plus tard) */
  diff: number | null
  /** ovulation estimée après coup (14 jours avant le cycle suivant) */
  ovulationEstimate: Day | null
  ovulationConfirmed: Day | null
  valid: boolean
}

export type Status = 'normal' | 'attention' | 'inconnu'
export type Confidence = 'aucune' | 'faible' | 'moyenne' | 'bonne'

export interface CycleStats {
  cyclesCount: number
  lastCycle: number | null
  lastCycleStatus: Status
  lastPeriod: number | null
  lastPeriodStatus: Status
  avgCycle: number | null
  avgPeriod: number | null
  minCycle: number | null
  maxCycle: number | null
  regularity: 'regulier' | 'irregulier' | 'inconnu'
}

export interface Forecast {
  confidence: Confidence
  /** durée de cycle utilisée pour la prévision */
  cycleLength: number
  usesDefault: boolean
  lastStart: Day | null
  nextStart: Day | null
  /** fourchette d'arrivée (cycles irréguliers ou peu de données) */
  nextRange: [Day, Day] | null
  predictedPeriod: Day[]
  ovulation: Day | null
  ovulationConfirmed: Day | null
  fertile: Day[]
  delayDays: number
  cycleDay: number | null
  ongoing: PeriodRun | null
}

const sortedDays = (cycle: CycleDay[]) => cycle.filter(c => c.period).map(c => c.day).sort()

export function periodRuns(cycle: CycleDay[], today: Day): PeriodRun[] {
  const days = sortedDays(cycle)
  const endFlags = new Set(cycle.filter(c => c.period && c.period_end).map(c => c.day))
  const runs: PeriodRun[] = []
  let cur: { start: Day; last: Day; confirmed: boolean } | null = null
  const close = () => {
    if (!cur) return
    const ended = cur.confirmed || cur.last < addDays(today, -1)
    runs.push({ start: cur.start, last: cur.last, length: daysBetween(cur.start, cur.last) + 1, ended, endConfirmed: cur.confirmed })
  }
  for (const d of days) {
    // un jour oublié au milieu des règles ne coupe pas la période ; une fin indiquée, si.
    if (!cur || cur.confirmed || daysBetween(cur.last, d) > 2) { close(); cur = { start: d, last: d, confirmed: false } }
    else cur.last = d
    if (endFlags.has(d)) cur.confirmed = true
  }
  close()
  return runs
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
const validLen = (n: number) => n >= VALID_CYCLE.min && n <= VALID_CYCLE.max

export function cycleHistory(cycle: CycleDay[], today: Day): CycleRecord[] {
  const runs = periodRuns(cycle, today)
  const confirmed = cycle.filter(c => c.ovulation_confirmed).map(c => c.day).sort()
  const out: CycleRecord[] = []
  const lengths = runs.map((r, i) => (runs[i + 1] ? daysBetween(r.start, runs[i + 1].start) : null))
  runs.forEach((r, i) => {
    const next = runs[i + 1]
    const length = lengths[i]
    // prévision « de l'époque » : uniquement les cycles terminés avant le début du précédent
    const known = lengths.slice(0, Math.max(0, i - 1)).filter((n): n is number => n !== null && validLen(n))
    const prevAvg = avg(known.slice(-6))
    const prev = runs[i - 1]
    const predictedStart = prev && prevAvg ? addDays(prev.start, prevAvg) : null
    const end = next ? next.start : addDays(today, 1)
    out.push({
      start: r.start, periodLength: r.length, length,
      predictedStart, diff: predictedStart ? daysBetween(predictedStart, r.start) : null,
      ovulationEstimate: next && length && validLen(length) ? addDays(next.start, -LUTEAL) : null,
      ovulationConfirmed: confirmed.find(d => d >= r.start && d < end) ?? null,
      valid: length === null || validLen(length),
    })
  })
  return out
}

export function cycleStats(cycle: CycleDay[], today: Day): CycleStats {
  const runs = periodRuns(cycle, today)
  const hist = cycleHistory(cycle, today)
  const lengths = hist.filter(h => h.length !== null && h.valid).map(h => h.length!) // chronologique
  const recent = lengths.slice(-6)
  const lastCycle = hist.filter(h => h.length !== null).slice(-1)[0]?.length ?? null
  const ended = runs.filter(r => r.ended)
  const lastPeriod = ended.slice(-1)[0]?.length ?? null
  const minCycle = recent.length ? Math.min(...recent) : null
  const maxCycle = recent.length ? Math.max(...recent) : null
  return {
    cyclesCount: lengths.length,
    lastCycle,
    lastCycleStatus: lastCycle === null ? 'inconnu' : lastCycle >= NORMAL_CYCLE.min && lastCycle <= NORMAL_CYCLE.max ? 'normal' : 'attention',
    lastPeriod,
    lastPeriodStatus: lastPeriod === null ? 'inconnu' : lastPeriod <= NORMAL_PERIOD_MAX ? 'normal' : 'attention',
    avgCycle: avg(recent),
    avgPeriod: avg(ended.slice(-6).map(r => r.length)),
    minCycle, maxCycle,
    regularity: recent.length < 2 ? 'inconnu' : maxCycle! - minCycle! <= REGULAR_SPREAD ? 'regulier' : 'irregulier',
  }
}

export function forecast(cycle: CycleDay[], today: Day): Forecast {
  const runs = periodRuns(cycle, today)
  const st = cycleStats(cycle, today)
  const last = runs[runs.length - 1]
  const empty: Forecast = { confidence: 'aucune', cycleLength: DEFAULT_CYCLE, usesDefault: true, lastStart: null, nextStart: null, nextRange: null, predictedPeriod: [], ovulation: null, ovulationConfirmed: null, fertile: [], delayDays: 0, cycleDay: null, ongoing: null }
  if (!last) return empty
  const usesDefault = st.avgCycle === null
  const L = st.avgCycle ?? DEFAULT_CYCLE
  const confidence: Confidence = usesDefault || st.cyclesCount < 2 ? 'faible' : st.regularity === 'irregulier' || st.cyclesCount < 3 ? 'moyenne' : 'bonne'
  const nextStart = addDays(last.start, L)
  const spreadLo = st.cyclesCount >= 2 ? st.minCycle! : L - 3
  const spreadHi = st.cyclesCount >= 2 ? st.maxCycle! : L + 3
  const nextRange: [Day, Day] | null = confidence === 'bonne' ? null : [addDays(last.start, spreadLo), addDays(last.start, spreadHi)]
  const ongoing = !last.ended ? last : null
  const delayDays = !ongoing && today > nextStart ? daysBetween(nextStart, today) : 0
  // Règles prévues : jamais dans le passé (un retard ne « remplit » pas le calendrier après coup)
  const periodLen = st.avgPeriod ?? 5
  const predictedPeriod: Day[] = []
  if (!ongoing) {
    let s = delayDays > 0 ? addDays(today, 1) : nextStart
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < periodLen; i++) { const d = addDays(s, i); if (d > today) predictedPeriod.push(d) }
      s = addDays(s, L)
    }
  }
  const confirmed = cycle.filter(c => c.ovulation_confirmed && c.day >= last.start && c.day <= today).map(c => c.day).sort().pop() ?? null
  const ovulation = delayDays > 0 ? null : addDays(nextStart, -LUTEAL)
  const center = confirmed ?? ovulation
  const fertile = center ? Array.from({ length: 7 }, (_, i) => addDays(center, i - 5)) : []
  return {
    confidence, cycleLength: L, usesDefault, lastStart: last.start, nextStart, nextRange, predictedPeriod,
    ovulation: confirmed ? null : ovulation, ovulationConfirmed: confirmed, fertile, delayDays,
    cycleDay: daysBetween(last.start, today) + 1, ongoing,
  }
}

/** Prévisions pour les cycles suivants (calendrier) : ovulations et fenêtres fertiles estimées. */
export function futureFertility(f: Forecast, count = 2): { ovulation: Day[]; fertile: Day[] } {
  if (!f.nextStart || f.delayDays > 0) return { ovulation: [], fertile: [] }
  const ov: Day[] = [], fe: Day[] = []
  for (let k = 1; k <= count; k++) {
    const o = addDays(f.nextStart, k * f.cycleLength - LUTEAL)
    ov.push(o)
    for (let i = -5; i <= 1; i++) fe.push(addDays(o, i))
  }
  return { ovulation: ov, fertile: fe }
}

export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  aucune: 'Note le premier jour de tes prochaines règles pour commencer.',
  faible: 'Estimation approximative : il faut au moins deux cycles complets notés pour qu\'elle s\'affine.',
  moyenne: 'Estimation indicative : tes cycles varient, la date réelle peut s\'en écarter de plusieurs jours.',
  bonne: 'Estimation fondée sur tes cycles réguliers. Elle reste une estimation.',
}

/** Message de retard : informatif, nuancé, jamais de conclusion. */
export function delayMessage(days: number): { title: string; text: string } | null {
  if (days <= 0) return null
  if (days <= 4) return { title: `Règles attendues depuis ${days} jour${days > 1 ? 's' : ''}`, text: 'Un décalage de quelques jours est courant : stress, fatigue, voyage, changement de rythme ou d\'alimentation peuvent le provoquer. Dès qu\'elles arrivent, note-les : les prévisions se mettront à jour.' }
  return { title: `Retard estimé de ${days} jours`, text: 'Les cycles peuvent varier, et cette date n\'était qu\'une estimation. Si tes règles tardent encore ou si tu as un doute, un professionnel de santé (médecin, sage-femme, pharmacien) peut t\'aider à y voir clair.' }
}

// ------------------------------------------------------------------ rappels (notifications programmées)
export interface CyclePush { id: string; send_at: string; title: string; body: string; url: string }

const at = (day: Day, hhmm: string) => new Date(`${day}T${hhmm}:00`).toISOString()

/** Rappels souhaités d'après les données actuelles (règles dans 2 jours, retard, fin des règles à noter). */
export function desiredCyclePushes(s: Snapshot, today: Day, now: Date = new Date()): CyclePush[] {
  if (s.notification_preferences[0]?.cycle === false) return []
  const f = forecast(s.cycle_days, today)
  if (!f.lastStart) return []
  const out: CyclePush[] = []
  const url = '#/progres?onglet=cycle'
  if (f.ongoing && !f.ongoing.endConfirmed) {
    const d = addDays(f.ongoing.start, 7)
    out.push({ id: `cycle:fin:${f.ongoing.start}`, send_at: at(d, '19:00'), title: 'Tes règles sont-elles terminées ?', body: 'Note le dernier jour de tes règles : tes statistiques et tes prévisions seront plus justes.', url })
  }
  if (!f.ongoing && f.nextStart) {
    out.push({ id: `cycle:avant:${f.nextStart}`, send_at: at(addDays(f.nextStart, -2), '09:00'), title: 'Tes règles approchent', body: 'Elles sont prévues dans 2 jours environ (estimation). Prévois de quoi être à l\'aise.', url })
    out.push({ id: `cycle:retard:${f.nextStart}`, send_at: at(addDays(f.nextStart, 5), '10:00'), title: 'Des nouvelles de ton cycle ?', body: 'Tes règles étaient estimées il y a 5 jours. Un décalage arrive souvent ; note-les dès qu\'elles commencent pour mettre à jour les prévisions.', url })
  }
  return out.filter(p => Date.parse(p.send_at) > now.getTime())
}

export const SEX_PRIVACY = 'Privé : visible uniquement par toi, sur ce téléphone et dans ta sauvegarde protégée.'
