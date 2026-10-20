// Moteur de récompenses. À partir des données enregistrées, il calcule l'ensemble des
// récompenses méritées. Chaque récompense a une clé déterministe : la recalculer mille fois
// ne la donne qu'une fois, et une récompense acquise n'est jamais retirée.
// Aucune récompense n'est liée à la perte de poids, à une restriction ou à un sport « compensatoire ».
import type { Op } from '../data/store'
import type { GrantKind, RewardGrant, Snapshot, UserMission } from '../data/types'
import { addDays, isoWeekday, weekStart, type Day, toDay } from '../lib/dates'
import { dayRitual, sportCommitment } from './ritual'
import { activeWeeks, reprises, waterReached, entryMl, foodDays, recipeLogs } from './discipline'
import { LEVEL_ITEMS, MYSTERY_ITEMS, zoneOrder } from './catalog'
import { missionDef, missionOps } from './missions'
import { expectedPoints } from './shop'

export interface GrantSpec { id: string; kind: GrantKind; ref: string; xp: number; points?: number; reason: string }

// ------------------------------------------------------------------ niveaux
/** XP cumulée nécessaire pour atteindre un niveau : 0, 60, 160, 300, 480, 700… */
export function xpForLevel(level: number): number {
  let need = 0
  for (let l = 2; l <= level; l++) need += 60 + 40 * (l - 2)
  return need
}

export function levelFor(xp: number): { level: number; current: number; next: number; progress: number } {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  const current = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, current, next, progress: (xp - current) / (next - current) }
}

// ------------------------------------------------------------------ statistiques
export interface RewardStats {
  firstDay: Day | null
  honoredDays: Day[]
  smallStepDays: Day[]
  realRests: number
  waterGoalDays: Day[]
  totalMl: number
  earlyWaterDays: number
  mealDays: Day[]
  distinctRecipes: number
  checkins: Day[]
  capsules: number
  capsulesOpened: number
  reprises: Day[]
  missionsDone: UserMission[]
  mysteryDone: UserMission[]
  reviews: number
  activityKinds: Set<string>
  ringFit: number
  fridaysHonored: number
  maxMinPerWeek: number
  completeWeeks: number
  cycleLogged: boolean
  activeWeeks: number
  firstHabit: boolean
}

export function computeStats(s: Snapshot, today: Day): RewardStats {
  const dates = [
    ...s.workouts.map(w => w.day), ...s.water_logs.map(w => w.day), ...foodDays(s),
    ...s.daily_checkins.map(c => c.day), ...s.habit_checks.map(h => h.day), ...s.ritual_events.map(e => e.day),
  ].filter(d => d <= today).sort()
  const firstDay = dates[0] ?? null

  const honoredDays: Day[] = []
  const smallStepDays: Day[] = []
  let realRests = 0
  let fridaysHonored = 0
  const minByWeek = new Map<Day, number>()
  const scheduledByWeek = new Map<Day, { planned: number; honored: number }>()
  if (firstDay) {
    for (let d = firstDay; d <= today; d = addDays(d, 1)) {
      const r = dayRitual(s, d, today)
      if (r.status === 'honore') {
        honoredDays.push(d)
        if (isoWeekday(d) === 5 && r.scheduled) fridaysHonored++
        if (r.version === 'min') minByWeek.set(weekStart(d), (minByWeek.get(weekStart(d)) ?? 0) + 1)
      }
      if (r.status === 'petit-pas') smallStepDays.push(d)
      if (r.status === 'repos' && r.restReason && r.restReason !== 'pas_envie') realRests++
      if (r.scheduled && d < weekStart(today)) {
        const w = scheduledByWeek.get(weekStart(d)) ?? { planned: 0, honored: 0 }
        if (!(r.status === 'repos' && r.restReason !== 'pas_envie')) w.planned++
        if (r.status === 'honore') w.honored++
        scheduledByWeek.set(weekStart(d), w)
      }
    }
  }
  const completeWeeks = [...scheduledByWeek.values()].filter(w => w.planned >= 3 && w.honored >= w.planned).length

  const waterDays = [...new Set(s.water_logs.map(w => w.day))].sort()
  const waterGoalDays = waterDays.filter(d => waterReached(s, d))
  const earlyWaterDays = new Set(s.water_logs.filter(w => new Date(w.at).getHours() < 9).map(w => w.day)).size
  const mealDays = [...foodDays(s)].sort()
  const distinctRecipes = new Set(recipeLogs(s).map(r => r.recipe_id)).size

  const completed = s.workouts.filter(w => w.completed)
  const activityKinds = new Set(completed.map(w => w.activity))

  return {
    firstDay, honoredDays, smallStepDays, realRests,
    waterGoalDays, totalMl: s.water_logs.reduce((n, w) => n + entryMl(w), 0), earlyWaterDays,
    mealDays, distinctRecipes,
    checkins: s.daily_checkins.filter(c => c.energy).map(c => c.day),
    capsules: s.progress_capsules.length,
    capsulesOpened: s.progress_capsules.filter(c => c.opened_at).length,
    reprises: reprises(s, today),
    missionsDone: s.user_missions.filter(m => m.status === 'terminee'),
    mysteryDone: s.user_missions.filter(m => m.status === 'terminee' && m.mystery),
    reviews: s.weekly_reviews.length,
    activityKinds,
    ringFit: completed.filter(w => w.activity === 'ring_fit').length,
    fridaysHonored,
    maxMinPerWeek: Math.max(0, ...minByWeek.values()),
    completeWeeks,
    cycleLogged: s.cycle_days.length > 0,
    activeWeeks: activeWeeks(s),
    firstHabit: s.habit_checks.length > 0 || completed.length > 0 || s.water_logs.length > 0 || s.meals.length > 0 || s.food_entries.length > 0,
  }
}

// ------------------------------------------------------------------ règles
export function expectedGrants(s: Snapshot, today: Day, missions: UserMission[] = s.user_missions): GrantSpec[] {
  const st = computeStats({ ...s, user_missions: missions }, today)
  const g: GrantSpec[] = []
  const xp = (id: string, amount: number, reason: string, ref = id.split(':')[1]) => g.push({ id: 'xp:' + id, kind: 'xp', ref, xp: amount, reason })
  const has = new Set<string>()
  const add = (kind: Exclude<GrantKind, 'xp' | 'points'>, ref: string, reason: string, cond: boolean) => {
    const id = `${kind}:${ref}`
    if (cond && !has.has(id)) { has.add(id); g.push({ id, kind, ref, xp: 0, reason }) }
  }

  // XP — séances (au plus 2 séances récompensées par jour : pas de surenchère)
  const perDay = new Map<Day, number>()
  for (const w of [...s.workouts].filter(w => w.completed && w.actual_minutes >= 5).sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const n = (perDay.get(w.day) ?? 0) + 1
    perDay.set(w.day, n)
    if (n > 2) continue
    xp('seance:' + w.id, w.version === 'usual' || w.version === 'plus' ? 25 : 15, 'Séance terminée', 'seance')
  }
  for (const d of st.honoredDays) xp('rdv:' + d, 10, 'Rendez-vous honoré', 'rdv')
  for (const d of st.smallStepDays) xp('petit-pas:' + d, 5, 'Petit pas', 'petit-pas')
  for (const h of s.habit_checks) {
    xp(`habitude:${h.commitment_id}:${h.day}:min`, 5, 'Habitude tenue', 'habitude')
    if (h.version === 'usual') xp(`habitude:${h.commitment_id}:${h.day}:usual`, 3, 'Version habituelle', 'habitude')
  }
  for (const d of st.waterGoalDays) xp('eau:' + d, 10, 'Objectif d\'eau atteint', 'eau')
  for (const d of st.mealDays) xp('repas:' + d, 5, 'Repas notés', 'repas')
  for (const d of st.checkins) xp('checkin:' + d, 3, 'Check-in', 'checkin')
  for (const c of s.progress_capsules) {
    xp('capsule:' + c.id, 20, 'Capsule créée', 'capsule')
    if (c.opened_at) xp('capsule-ouverte:' + c.id, 15, 'Capsule ouverte', 'capsule')
  }
  for (const d of st.reprises) xp('reprise:' + d, 25, 'Reprise après une pause', 'reprise')
  for (const r of s.weekly_reviews) xp('bilan:' + r.week_start, 15, 'Bilan de la semaine', 'bilan')
  for (const m of st.missionsDone) xp('mission:' + m.id, missionDef(m.mission_key)?.xp ?? 10, 'Mission réussie', 'mission')

  const totalXp = g.reduce((n, x) => n + x.xp, 0)
  const { level } = levelFor(totalXp)

  // Objets de l'univers
  add('item', 'lampe-douce', 'Bienvenue', s.avatar_profiles.length > 0)
  add('item', 'tapis-rond', 'Bienvenue', s.avatar_profiles.length > 0)
  const completedCount = s.workouts.filter(w => w.completed && w.actual_minutes >= 5).length
  add('item', 'tapis-yoga', 'Ta première séance', completedCount >= 1)
  add('item', 'radio', '5 séances terminées', completedCount >= 5)
  add('item', 'horloge', '10 rendez-vous honorés', st.honoredDays.length >= 10)
  add('item', 'pothos', 'Premier objectif d\'eau', st.waterGoalDays.length >= 1)
  add('item', 'monstera', 'Objectif d\'eau 7 jours', st.waterGoalDays.length >= 7)
  add('item', 'fontaine', 'Objectif d\'eau 21 jours', st.waterGoalDays.length >= 21)
  add('item', 'panier-fruits', 'Repas notés 3 jours', st.mealDays.length >= 3)
  add('item', 'livre-recettes', 'Repas notés 14 jours', st.mealDays.length >= 14)
  add('item', 'epices', '5 recettes différentes', st.distinctRecipes >= 5)
  add('item', 'carnet', 'Premier check-in', st.checkins.length >= 1)
  add('item', 'tasse', '10 check-ins', st.checkins.length >= 10)
  add('item', 'boite-souvenirs', 'Première capsule', st.capsules >= 1)
  add('item', 'cadre-photo', 'Capsule ouverte', st.capsulesOpened >= 1)
  add('item', 'lanterne', 'Reprise après une pause', st.reprises.length >= 1)
  add('item', 'etoile', 'Première mission', st.missionsDone.length >= 1)
  add('item', 'tableau-liege', 'Premier bilan', st.reviews >= 1)
  add('item', 'calendrier', '4 bilans', st.reviews >= 4)
  add('item', 'bouillotte', 'Cycle suivi', st.cycleLogged)
  add('item', 'bougie', 'Un vrai jour de repos', st.realRests >= 1)
  add('item', 'anneau', 'Ring Fit', st.activityKinds.has('ring_fit'))
  add('item', 'boule-facettes', 'Danse', st.activityKinds.has('danse'))
  add('item', 'velo-mini', 'Vélo', st.activityKinds.has('velo'))
  add('item', 'baskets', 'Marche', st.activityKinds.has('marche'))
  for (const [lvl, item] of Object.entries(LEVEL_ITEMS)) add('item', item, `Niveau ${lvl}`, level >= Number(lvl))
  // Un objet exclusif par mission mystère réussie, dans l'ordre du catalogue
  st.mysteryDone.sort((a, b) => a.day.localeCompare(b.day)).forEach((m, i) => {
    const item = MYSTERY_ITEMS[i % MYSTERY_ITEMS.length]
    add('item', i < MYSTERY_ITEMS.length ? item : `${item}~${Math.floor(i / MYSTERY_ITEMS.length)}`, 'Mission mystère', true)
  })

  // Zones : débloquées par les semaines actives (au moins 3 jours avec une action)
  const avatar = s.avatar_profiles[0]
  if (avatar) for (const z of zoneOrder(avatar.universe)) add('zone', z.id, z.weeksNeeded ? `${z.weeksNeeded} semaines actives` : 'Ton univers de départ', st.activeWeeks >= z.weeksNeeded)

  // Accessoires du compagnon
  const companion = s.companion_profiles[0]
  add('accessory', 'noeud', 'Bienvenue', Boolean(companion))
  add('accessory', 'echarpe', '5 rendez-vous honorés', st.honoredDays.length >= 5)
  add('accessory', 'chapeau', 'Objectif d\'eau 7 jours', st.waterGoalDays.length >= 7)
  add('accessory', 'lunettes', 'Repas notés 10 jours', st.mealDays.length >= 10)
  add('accessory', 'couronne', 'Niveau 5', level >= 5)

  // Badges visibles
  add('badge', 'premier-pas', 'Une première habitude', st.firstHabit)
  add('badge', 'rdv-5', '5 rendez-vous honorés', st.honoredDays.length >= 5)
  add('badge', 'rdv-20', '20 rendez-vous honorés', st.honoredDays.length >= 20)
  add('badge', 'rdv-50', '50 rendez-vous honorés', st.honoredDays.length >= 50)
  add('badge', 'semaine-complete', 'Une semaine complète', st.completeWeeks >= 1)
  add('badge', 'hydratation-7', 'Objectif d\'eau 7 jours', st.waterGoalDays.length >= 7)
  add('badge', 'curiosite-culinaire', '5 recettes différentes', st.distinctRecipes >= 5)
  add('badge', 'journal-14', 'Repas notés 14 jours', st.mealDays.length >= 14)
  add('badge', 'ecoute-de-soi', '10 check-ins', st.checkins.length >= 10)
  add('badge', 'capsule-1', 'Première capsule', st.capsules >= 1)
  add('badge', 'capsule-ouverte', 'Capsule ouverte', st.capsulesOpened >= 1)
  add('badge', 'bilan-4', '4 bilans', st.reviews >= 4)
  add('badge', 'explorateur', '4 activités différentes', st.activityKinds.size >= 4)
  add('badge', 'missions-10', '10 missions', st.missionsDone.length >= 10)
  add('badge', 'niveau-5', 'Niveau 5', level >= 5)
  add('badge', 'repos-assume', '3 vrais jours de repos', st.realRests >= 3)
  // Badges secrets
  add('badge', 'retour-gagnant', 'Reprise après une interruption', st.reprises.length >= 1)
  const sport = sportCommitment(s)
  const smallerThanPlanned = s.workouts.some(w => w.completed && w.actual_minutes >= 5 && (
    w.actual_minutes < (sport?.min_minutes ?? 10) || (w.planned_minutes !== null && w.version === 'min' && w.source === 'rituel' && (sport?.usual_minutes ?? 20) > w.actual_minutes)))
  add('badge', 'petite-victoire', 'Plus court plutôt que rien', smallerThanPlanned)
  const exhaustedHonored = st.honoredDays.some(d => s.daily_checkins.find(c => c.day === d)?.energy === 1)
  add('badge', 'pluie-ou-soleil', 'Honoré malgré l\'épuisement', exhaustedHonored)
  add('badge', 'deuxieme-souffle', '3 reprises', st.reprises.length >= 3)
  add('badge', 'fidele-vendredi', '4 vendredis honorés', st.fridaysHonored >= 4)
  add('badge', 'chasseuse-mysteres', '3 missions mystères', st.mysteryDone.length >= 3)
  add('badge', 'lever-soleil', 'Eau avant 9 h, 5 jours', st.earlyWaterDays >= 5)
  add('badge', 'constance-douce', '4 versions minimales en une semaine', st.maxMinPerWeek >= 4)
  add('badge', 'joueuse', '5 séances de Ring Fit', st.ringFit >= 5)
  add('badge', 'cent-verres', '25 litres d\'eau', st.totalMl >= 25000)
  const secretBadges = ['retour-gagnant', 'petite-victoire', 'pluie-ou-soleil', 'deuxieme-souffle', 'fidele-vendredi', 'chasseuse-mysteres', 'lever-soleil', 'constance-douce', 'joueuse', 'cent-verres']
  add('accessory', 'cape', 'Un badge secret', secretBadges.some(b => has.has('badge:' + b)))

  // Points de la boutique (voir shop.ts) : une fois par objectif et par jour
  for (const p of expectedPoints(s, today)) g.push({ id: p.id, kind: 'points', ref: p.ref, xp: 0, points: p.points, reason: p.reason })

  return g
}

/**
 * Le « dérivateur » branché sur le stockage : après chaque action, il ajoute les
 * récompenses manquantes et met à jour les missions. Jamais de suppression.
 */
export function deriveOps(s: Snapshot, now: Date = new Date()): Op[] {
  const today = toDay(now)
  const iso = now.toISOString()
  const missionUpdates = missionOps(s, today, iso)
  const missions = s.user_missions.map(m => missionUpdates.find(u => u.id === m.id) ?? m)
  const existing = new Set(s.reward_grants.map(g => g.id))
  const ops: Op[] = missionUpdates.map(row => ({ type: 'put', table: 'user_missions', row }))
  for (const spec of expectedGrants(s, today, missions)) {
    if (existing.has(spec.id)) continue
    const row: RewardGrant = { ...spec, granted_at: iso, created_at: '', updated_at: '' }
    ops.push({ type: 'put', table: 'reward_grants', row })
  }
  return ops
}

export function totalXp(s: Snapshot): number {
  return s.reward_grants.reduce((n, g) => n + g.xp, 0)
}

export function owned(s: Snapshot, kind: GrantKind): Set<string> {
  return new Set(s.reward_grants.filter(g => g.kind === kind).map(g => g.ref.split('~')[0]))
}
