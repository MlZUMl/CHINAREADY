// Compagnon : humeur et message déterminés par des règles lisibles et des événements réels.
// Jamais de culpabilisation, de tristesse fabriquée, de reproche d'absence ou de menace de partir.
import type { CompanionInteraction, Snapshot, Species } from '../data/types'
import { toDay, minutesOfDay, type Day } from '../lib/dates'
import { hash } from '../lib/ids'
import { dayRitual, isRendezvousDay, restEvent, sportCommitment } from './ritual'
import { resumeState, waterGlasses, waterGoal } from './discipline'
import { badgeDef, itemDef } from './catalog'

export type Expression = 'content' | 'curieux' | 'endormi' | 'pensif' | 'fier' | 'enthousiaste' | 'detendu' | 'surpris'

export type Context =
  | 'retour' | 'seance-faite' | 'mission-reussie' | 'eau-objectif' | 'nouvelle-recette' | 'capsule'
  | 'repos' | 'journee-difficile' | 'reprise' | 'rituel-maintenant' | 'rituel-bientot'
  | 'nuit' | 'bonjour' | 'apres-midi' | 'soir'

export const SPECIES: { id: Species; label: string; defaultName: string; trait: string }[] = [
  { id: 'chat', label: 'Petit chat', defaultName: 'Praline', trait: 'calme et un brin taquin' },
  { id: 'lapin', label: 'Lapin', defaultName: 'Pompon', trait: 'plein d\'élan, toujours prêt à bondir' },
  { id: 'nuage', label: 'Nuage', defaultName: 'Nimbus', trait: 'doux et rêveur' },
  { id: 'creature', label: 'Créature fantastique', defaultName: 'Lumi', trait: 'malicieuse et pleine d\'étincelles' },
  { id: 'pousse', label: 'Petite pousse', defaultName: 'Basilic', trait: 'patiente, elle croit aux petits pas' },
]

/** Tic de langage propre à chaque espèce : la personnalité reste reconnaissable. */
const VOICE: Record<Species, { hello: string; cheer: string; end: string }> = {
  chat: { hello: 'Mrrr…', cheer: 'Ronron de fierté !', end: ' 🐾' },
  lapin: { hello: 'Hop !', cheer: 'Hop hop hop !', end: ' 🐰' },
  nuage: { hello: 'Tout doux…', cheer: 'Je flotte de joie !', end: ' ☁️' },
  creature: { hello: 'Pssst !', cheer: 'Pluie d\'étincelles !', end: ' ✨' },
  pousse: { hello: 'Bonjour, jardinière !', cheer: 'Une nouvelle feuille a poussé !', end: ' 🌱' },
}

const POOLS: Record<Context, { expression: Expression; lines: string[] }> = {
  retour: { expression: 'content', lines: [
    'Te revoilà ! On reprend tranquillement ?',
    'Quel plaisir de te revoir. Une seule petite action aujourd\'hui, et le fil est renoué.',
    'Rien n\'est perdu : tes progrès t\'attendaient bien au chaud.',
  ] },
  'seance-faite': { expression: 'fier', lines: [
    'Tu as pris du temps pour toi aujourd\'hui. Quelle fierté !',
    'Séance faite. Ton toi de demain te dit merci.',
    'Et un rendez-vous de plus avec toi-même. Ça compte vraiment.',
  ] },
  'mission-reussie': { expression: 'surpris', lines: [
    'Oh ! Mission réussie ! Va voir ce qui est apparu dans ton univers.',
    'Surprise débloquée ! Tu me montres ?',
  ] },
  'eau-objectif': { expression: 'enthousiaste', lines: [
    'Objectif d\'eau atteint ! Une nouvelle plante a soif de compliments.',
    'Hydratée jusqu\'au bout des feuilles. Petite victoire du jour !',
  ] },
  'nouvelle-recette': { expression: 'curieux', lines: [
    'Oh, ça a l\'air intéressant ! Tu me racontes comment c\'était ?',
    'Une nouvelle recette ! Tu l\'ajouterais à ton menu de la semaine ?',
  ] },
  capsule: { expression: 'pensif', lines: [
    'Une capsule ouverte… Le chemin parcouru se voit mieux avec un peu de recul.',
    'Ton toi d\'avant t\'a laissé un message. C\'est précieux.',
  ] },
  repos: { expression: 'detendu', lines: [
    'Jour de repos noté. Le repos fait partie du plan, pas d\'un échec.',
    'On souffle aujourd\'hui. Demain, le rendez-vous sera là, comme d\'habitude.',
  ] },
  'journee-difficile': { expression: 'detendu', lines: [
    'Tu m\'as dit que l\'énergie était basse. Pas besoin de tout réussir aujourd\'hui : choisissons une petite chose qui te ferait du bien.',
    'Journée à petite énergie : la version minimale compte pleinement.',
    'On fait doux aujourd\'hui. Un verre d\'eau, cinq minutes de mobilité, et c\'est déjà beaucoup.',
  ] },
  reprise: { expression: 'curieux', lines: [
    'On reprend simplement ? Pas de rattrapage, juste la version minimale.',
    'Le plus important n\'est pas d\'avoir arrêté, c\'est de revenir. Cinq minutes ?',
  ] },
  'rituel-maintenant': { expression: 'enthousiaste', lines: [
    'C\'est l\'heure de ton rendez-vous. Tu n\'as pas besoin d\'avoir envie : commence par cinq minutes.',
    'Ta tenue, ton tapis, et c\'est parti. Je compte avec toi ?',
    'Ton rendez-vous t\'attend. La version courte est là si la journée a été longue.',
  ] },
  'rituel-bientot': { expression: 'curieux', lines: [
    'Ton rendez-vous approche. Ta tenue est prête ?',
    'Bientôt l\'heure de ton rituel. On garde le cap, tout en douceur.',
  ] },
  nuit: { expression: 'endormi', lines: [
    'Il se fait tard… Bonne nuit, on se retrouve demain.',
    'Zzz… Le sommeil aussi fait partie de tes progrès.',
  ] },
  bonjour: { expression: 'content', lines: [
    'Belle journée qui commence. Un verre d\'eau pour démarrer ?',
    'Bonjour ! Qu\'est-ce qui te ferait du bien aujourd\'hui ?',
    'Nouvelle journée, même plan simple : on avance d\'un petit pas.',
  ] },
  'apres-midi': { expression: 'pensif', lines: [
    'Petit point de l\'après-midi : un verre d\'eau, peut-être ?',
    'Je rêvassais à ton prochain objet dans l\'univers…',
  ] },
  soir: { expression: 'detendu', lines: [
    'Fin de journée tranquille. Tu veux noter ton repas du soir ?',
    'La journée se termine. Ce que tu as fait aujourd\'hui compte.',
  ] },
}

export interface CompanionMood { context: Context; expression: Expression; reason: string }

/** Choisit l'humeur à partir des événements réels du jour. L'ordre des règles est volontairement simple. */
export function moodFor(s: Snapshot, now: Date = new Date()): CompanionMood {
  const today = toDay(now)
  const recent = (iso: string) => now.getTime() - Date.parse(iso) < 3 * 3600_000
  const resume = resumeState(s, today)
  const anyActionToday = s.workouts.some(w => w.day === today) || s.water_logs.some(w => w.day === today) || s.meals.some(m => m.day === today)

  if (resume.daysAway >= 3 && !anyActionToday) return { context: 'retour', expression: 'content', reason: `Retour après ${resume.daysAway} jours` }

  const events: { at: string; ctx: Context; reason: string }[] = []
  for (const w of s.workouts) if (w.day === today && w.completed && w.ended_at && recent(w.ended_at)) events.push({ at: w.ended_at, ctx: 'seance-faite', reason: 'Séance terminée' })
  for (const m of s.user_missions) if (m.status === 'terminee' && m.completed_at && recent(m.completed_at)) events.push({ at: m.completed_at, ctx: 'mission-reussie', reason: 'Mission réussie' })
  const goal = waterGoal(s)
  const todayWater = s.water_logs.filter(w => w.day === today).sort((a, b) => a.at.localeCompare(b.at))
  let acc = 0
  for (const w of todayWater) { const before = acc; acc += w.glasses; if (before < goal && acc >= goal && recent(w.at)) events.push({ at: w.at, ctx: 'eau-objectif', reason: 'Objectif d\'eau atteint' }) }
  for (const m of s.meals) if (m.day === today && m.recipe_id && recent(m.at) && !s.meals.some(o => o.recipe_id === m.recipe_id && o.day < today)) events.push({ at: m.at, ctx: 'nouvelle-recette', reason: 'Nouvelle recette' })
  for (const c of s.progress_capsules) if (c.opened_at && recent(c.opened_at)) events.push({ at: c.opened_at, ctx: 'capsule', reason: 'Capsule ouverte' })
  events.sort((a, b) => b.at.localeCompare(a.at))
  if (events[0]) return { context: events[0].ctx, expression: POOLS[events[0].ctx].expression, reason: events[0].reason }

  const rest = restEvent(s, today)
  if (rest && rest.reason !== 'pas_envie') return { context: 'repos', expression: 'detendu', reason: 'Repos choisi' }
  const checkin = s.daily_checkins.find(c => c.day === today)
  if (checkin?.energy && checkin.energy <= 2) return { context: 'journee-difficile', expression: 'detendu', reason: 'Énergie basse déclarée' }
  if (resume.needed) return { context: 'reprise', expression: 'curieux', reason: 'Reprise possible' }

  const sport = sportCommitment(s)
  const ritual = dayRitual(s, today, today)
  const mins = now.getHours() * 60 + now.getMinutes()
  if (ritual.status === 'honore') return { context: 'seance-faite', expression: 'fier', reason: 'Rendez-vous honoré aujourd\'hui' }
  if (sport?.cue_time && isRendezvousDay(sport, today) && ritual.status === 'a-venir') {
    const cue = minutesOfDay(sport.cue_time)
    if (mins >= cue && mins < cue + 240) return { context: 'rituel-maintenant', expression: 'enthousiaste', reason: 'Heure du rendez-vous' }
    if (mins >= cue - 180 && mins < cue) return { context: 'rituel-bientot', expression: 'curieux', reason: 'Rendez-vous bientôt' }
  }
  const h = now.getHours()
  if (h >= 22 || h < 6) return { context: 'nuit', expression: 'endormi', reason: 'Il est tard' }
  if (h < 12) return { context: 'bonjour', expression: 'content', reason: 'Matin' }
  if (h < 18) return { context: 'apres-midi', expression: 'pensif', reason: 'Après-midi' }
  return { context: 'soir', expression: 'detendu', reason: 'Soir' }
}

export interface CompanionMessage { key: string; text: string; expression: Expression }

/** Message choisi sans hasard, en évitant ceux montrés récemment. `nudge` fait défiler à chaque toucher. */
export function messageFor(species: Species, mood: CompanionMood, recent: CompanionInteraction[], day: Day, nudge = 0): CompanionMessage {
  const pool = POOLS[mood.context]
  const keys = pool.lines.map((_, i) => `${mood.context}-${i}`)
  const recentKeys = new Set([...recent].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4).map(r => r.message_key))
  const fresh = keys.filter(k => !recentKeys.has(k))
  const list = fresh.length ? fresh : keys
  const key = list[(hash(day + mood.context) + nudge) % list.length]
  const line = pool.lines[Number(key.split('-').pop())]
  const v = VOICE[species]
  const cheerful = mood.expression === 'fier' || mood.expression === 'enthousiaste' || mood.expression === 'surpris'
  const prefix = cheerful ? v.cheer + ' ' : mood.context === 'bonjour' || mood.context === 'retour' ? v.hello + ' ' : ''
  return { key, text: prefix + line + v.end, expression: mood.expression }
}

/** Petite conversation : prochaine action concrète, ou un souvenir réel. */
export function nextActionHint(s: Snapshot, now: Date = new Date()): string {
  const today = toDay(now)
  const sport = sportCommitment(s)
  const ritual = dayRitual(s, today, today)
  if (sport && isRendezvousDay(sport, today) && ritual.status === 'a-venir') {
    return `Ton rendez-vous de ${sport.cue_time?.replace(':', ' h ')} : ${sport.min_label.toLowerCase()} suffit pour l'honorer.`
  }
  const glasses = waterGlasses(s, today)
  if (glasses < waterGoal(s)) return `Un verre d'eau ? Tu en es à ${glasses} sur ${waterGoal(s)}.`
  if (!s.meals.some(m => m.day === today)) return 'Noter ton prochain repas, même juste son nom.'
  if (!s.daily_checkins.some(c => c.day === today)) return 'Me dire comment tu te sens aujourd\'hui ?'
  return 'L\'essentiel est fait aujourd\'hui. Le reste est en bonus.'
}

export function memoryOf(s: Snapshot, seed: string): string | null {
  const notable = s.reward_grants.filter(g => g.kind === 'badge' || g.kind === 'item').sort((a, b) => a.granted_at.localeCompare(b.granted_at))
  if (!notable.length) return null
  const g = notable[hash(seed) % notable.length]
  const name = g.kind === 'badge' ? badgeDef(g.ref)?.name : itemDef(g.ref.split('~')[0])?.name
  const d = new Date(g.granted_at)
  return `Je me souviens du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : tu as obtenu « ${name} » (${g.reason.toLowerCase()}).`
}
