// Bibliothèque d'exercices et génération de séances guidées.
// Consignes volontairement simples et prudentes ; aucune promesse de résultat.
import { hash } from '../lib/ids'
import type { Equipment } from '../data/types'

export type { Equipment }
export type Category = 'echauffement' | 'renfo' | 'elastique' | 'halteres' | 'cardio' | 'mobilite' | 'calme'

/** Matériel proposé : les trois derniers servent aux activités libres (Ring Fit, vélo). */
export const EQUIPMENT: { id: Equipment; label: string; emoji: string; hint: string }[] = [
  { id: 'tapis', label: 'Tapis', emoji: '🧘‍♀️', hint: 'exercices au sol' },
  { id: 'elastique', label: 'Élastiques', emoji: '🪢', hint: 'renforcement' },
  { id: 'halteres', label: 'Haltères', emoji: '🏋️‍♀️', hint: 'renforcement' },
  { id: 'corde', label: 'Corde à sauter', emoji: '➰', hint: 'cardio' },
  { id: 'velo_appart', label: 'Vélo d\'appartement', emoji: '🚴‍♀️', hint: 'cardio doux' },
  { id: 'ring_fit', label: 'Ring Fit', emoji: '🎮', hint: 'activité libre' },
  { id: 'velo', label: 'Vélo', emoji: '🚲', hint: 'sortie dehors' },
]
export const equipmentLabel = (id: Equipment) => EQUIPMENT.find(e => e.id === id)?.label ?? id

export interface Exercise {
  id: string
  name: string
  category: Category
  instruction: string
  intensity: 1 | 2 | 3
  equipment?: Equipment
  /** Exercice à faire de chaque côté : la durée est partagée en deux */
  sides?: boolean
}

export const EXERCISES: Exercise[] = [
  // Échauffement
  { id: 'marche-place', name: 'Marche sur place', category: 'echauffement', intensity: 1, instruction: 'Lève les genoux tranquillement et balance les bras. Respire calmement.' },
  { id: 'cercles-bras', name: 'Cercles de bras', category: 'echauffement', intensity: 1, instruction: 'Bras tendus sur les côtés, petits cercles vers l\'avant puis vers l\'arrière.' },
  { id: 'rotations-bassin', name: 'Rotations du bassin', category: 'echauffement', intensity: 1, instruction: 'Mains sur les hanches, dessine de grands cercles avec le bassin, dans un sens puis dans l\'autre.' },
  { id: 'pas-chasses-doux', name: 'Pas chassés doux', category: 'echauffement', intensity: 1, instruction: 'Deux pas sur le côté, puis deux pas de l\'autre côté, sans sauter.' },
  // Renforcement sans matériel
  { id: 'squat', name: 'Squats', category: 'renfo', intensity: 2, instruction: 'Pieds largeur de hanches, descends comme pour t\'asseoir, dos droit, puis remonte en poussant dans les talons.' },
  { id: 'squat-chaise', name: 'Squats sur chaise', category: 'renfo', intensity: 1, instruction: 'Assieds-toi au bord d\'une chaise puis relève-toi sans t\'aider des mains. Va à ton rythme.' },
  { id: 'fentes-arriere', name: 'Fentes arrière', category: 'renfo', intensity: 2, sides: true, instruction: 'Recule une jambe et plie les deux genoux, puis reviens. Tiens-toi à un mur si besoin.' },
  { id: 'pont-fessier', name: 'Pont fessier', category: 'renfo', intensity: 1, equipment: 'tapis', instruction: 'Allongée sur le dos, genoux pliés, monte le bassin en serrant les fessiers, puis redescends lentement.' },
  { id: 'pompes-mur', name: 'Pompes contre le mur', category: 'renfo', intensity: 1, instruction: 'Mains sur le mur à hauteur d\'épaules, plie les bras pour approcher la poitrine, puis repousse.' },
  { id: 'pompes-genoux', name: 'Pompes sur les genoux', category: 'renfo', intensity: 2, equipment: 'tapis', instruction: 'Genoux au sol, corps aligné des genoux à la tête, descends la poitrine puis remonte.' },
  { id: 'gainage-genoux', name: 'Gainage sur les genoux', category: 'renfo', intensity: 2, equipment: 'tapis', instruction: 'Avant-bras au sol, genoux posés, garde le dos bien plat et respire.' },
  { id: 'gainage', name: 'Gainage', category: 'renfo', intensity: 3, equipment: 'tapis', instruction: 'Sur les avant-bras et les pointes de pieds, corps gainé. Pose les genoux dès que c\'est nécessaire.' },
  { id: 'abducteurs-allonge', name: 'Ouverture de jambe allongée', category: 'renfo', intensity: 1, sides: true, equipment: 'tapis', instruction: 'Allongée sur le côté, monte la jambe du dessus sans basculer le bassin, puis redescends.' },
  { id: 'superman', name: 'Superman doux', category: 'renfo', intensity: 2, equipment: 'tapis', instruction: 'Allongée sur le ventre, décolle doucement bras et jambes opposés, puis change.' },
  { id: 'mollets', name: 'Montées sur pointes', category: 'renfo', intensity: 1, instruction: 'Monte sur la pointe des pieds puis redescends lentement. Tiens-toi à un appui.' },
  // Élastique
  { id: 'elastique-tirage', name: 'Tirage élastique', category: 'elastique', intensity: 2, equipment: 'elastique', instruction: 'Élastique tendu devant toi, tire les mains vers la poitrine en serrant les omoplates.' },
  { id: 'elastique-marche', name: 'Pas latéraux à l\'élastique', category: 'elastique', intensity: 2, equipment: 'elastique', instruction: 'Élastique au-dessus des genoux, légère flexion, fais des petits pas sur le côté.' },
  { id: 'elastique-ecarte', name: 'Écarté d\'épaules', category: 'elastique', intensity: 1, equipment: 'elastique', instruction: 'Bras tendus devant, écarte l\'élastique en ouvrant la poitrine, puis reviens doucement.' },
  { id: 'elastique-kickback', name: 'Extension de hanche', category: 'elastique', intensity: 2, sides: true, equipment: 'elastique', instruction: 'Élastique aux chevilles, appui sur une chaise, pousse une jambe vers l\'arrière sans cambrer.' },
  // Haltères
  { id: 'halteres-souleve', name: 'Soulevé de terre jambes fléchies', category: 'halteres', intensity: 2, equipment: 'halteres', instruction: 'Haltères devant les cuisses, penche le buste dos plat en reculant les fesses, puis remonte.' },
  { id: 'halteres-developpe', name: 'Développé épaules', category: 'halteres', intensity: 2, equipment: 'halteres', instruction: 'Haltères à hauteur d\'épaules, pousse vers le haut sans cambrer, puis redescends.' },
  { id: 'halteres-rowing', name: 'Rowing', category: 'halteres', intensity: 2, sides: true, equipment: 'halteres', instruction: 'Main et genou en appui sur une chaise, tire l\'haltère vers la hanche, coude près du corps.' },
  { id: 'halteres-squat', name: 'Squat gobelet', category: 'halteres', intensity: 3, equipment: 'halteres', instruction: 'Un haltère tenu contre la poitrine, descends en squat, dos droit, puis remonte.' },
  { id: 'halteres-biceps', name: 'Flexions des bras', category: 'halteres', intensity: 1, equipment: 'halteres', instruction: 'Coudes près du corps, monte les haltères vers les épaules puis redescends lentement.' },
  // Cardio doux
  { id: 'genoux-hauts', name: 'Montées de genoux', category: 'cardio', intensity: 2, instruction: 'Monte un genou puis l\'autre, à ton rythme. Garde un appui au sol, sans sauter.' },
  { id: 'step-touch', name: 'Step touch', category: 'cardio', intensity: 1, instruction: 'Un pas sur le côté, rapproche l\'autre pied, et repars. Ajoute les bras si tu veux.' },
  { id: 'talons-fesses', name: 'Talons-fesses marchés', category: 'cardio', intensity: 2, instruction: 'Ramène un talon vers les fesses puis l\'autre, en marchant sur place.' },
  { id: 'boxe-air', name: 'Coups de poing dans l\'air', category: 'cardio', intensity: 2, instruction: 'Pieds stables, envoie des coups de poing devant toi en alternant, sans verrouiller les coudes.' },
  { id: 'jumping-sans-saut', name: 'Jumping jack sans saut', category: 'cardio', intensity: 2, instruction: 'Écarte une jambe sur le côté en montant les bras, reviens, puis de l\'autre côté.' },
  // Mobilité / yoga
  { id: 'chat-vache', name: 'Chat-vache', category: 'mobilite', intensity: 1, equipment: 'tapis', instruction: 'À quatre pattes, arrondis le dos en expirant, puis creuse doucement en inspirant.' },
  { id: 'posture-enfant', name: 'Posture de l\'enfant', category: 'mobilite', intensity: 1, equipment: 'tapis', instruction: 'Assise sur les talons, allonge les bras devant toi et laisse ton front se poser. Respire.' },
  { id: 'fente-basse', name: 'Fente basse douce', category: 'mobilite', intensity: 1, sides: true, equipment: 'tapis', instruction: 'Un genou au sol, avance doucement le bassin pour étirer l\'avant de la hanche.' },
  { id: 'torsion-assise', name: 'Torsion assise', category: 'mobilite', intensity: 1, sides: true, instruction: 'Assise, dos long, tourne le buste en t\'aidant de la main sur le genou opposé.' },
  { id: 'chien-tete-bas', name: 'Chien tête en bas', category: 'mobilite', intensity: 2, equipment: 'tapis', instruction: 'Mains et pieds au sol, pousse les fesses vers le haut, genoux fléchis si besoin.' },
  { id: 'etirement-ischios', name: 'Étirement arrière des cuisses', category: 'mobilite', intensity: 1, sides: true, instruction: 'Talon posé devant toi, jambe tendue, penche-toi légèrement dos droit.' },
  { id: 'ouverture-epaules', name: 'Ouverture des épaules', category: 'mobilite', intensity: 1, instruction: 'Mains jointes dans le dos, ouvre la poitrine et éloigne doucement les mains.' },
  // Corde à sauter et vélo d'appartement (proposés seulement si ce matériel est coché)
  { id: 'corde-douce', name: 'Corde à sauter, pas alternés', category: 'cardio', intensity: 2, equipment: 'corde', instruction: 'Petits sauts d\'un pied sur l\'autre, comme un trottinement. Fais tourner la corde avec les poignets, coudes près du corps.' },
  { id: 'corde-sauts', name: 'Corde à sauter', category: 'cardio', intensity: 3, equipment: 'corde', instruction: 'Petits sauts pieds joints, réception sur l\'avant du pied. Fais une pause dès que tu t\'emmêles : c\'est normal.' },
  { id: 'corde-sans', name: 'Corde imaginaire', category: 'cardio', intensity: 1, equipment: 'corde', instruction: 'Tiens les poignées sans la corde et fais le geste en marchant sur place : idéal pour s\'échauffer.' },
  { id: 'velo-tranquille', name: 'Vélo d\'appartement tranquille', category: 'cardio', intensity: 1, equipment: 'velo_appart', instruction: 'Pédale à un rythme où tu peux parler facilement. Dos droit, épaules relâchées.' },
  { id: 'velo-rythme', name: 'Vélo d\'appartement, rythme soutenu', category: 'cardio', intensity: 2, equipment: 'velo_appart', instruction: 'Accélère un peu : tu peux encore parler, mais par phrases courtes.' },
  { id: 'velo-sprint', name: 'Vélo d\'appartement, accélération', category: 'cardio', intensity: 3, equipment: 'velo_appart', instruction: 'Pédale vite en augmentant un peu la résistance, puis relâche pendant la pause.' },
  // Retour au calme
  { id: 'respiration', name: 'Respiration lente', category: 'calme', intensity: 1, instruction: 'Inspire 4 secondes par le nez, expire 6 secondes. Relâche les épaules.' },
  { id: 'etirement-cote', name: 'Étirement latéral', category: 'calme', intensity: 1, sides: true, instruction: 'Un bras au-dessus de la tête, penche-toi doucement sur le côté.' },
  { id: 'cou-epaules', name: 'Nuque et épaules', category: 'calme', intensity: 1, instruction: 'Fais rouler les épaules vers l\'arrière, puis incline doucement la tête d\'un côté et de l\'autre.' },
]

export const EXTERNAL_ACTIVITIES = [
  { id: 'ring_fit', label: 'Ring Fit', emoji: '🎮' },
  { id: 'danse', label: 'Danse', emoji: '💃' },
  { id: 'velo', label: 'Vélo', emoji: '🚲' },
  { id: 'velo_appart', label: 'Vélo d\'appartement', emoji: '🚴‍♀️' },
  { id: 'corde', label: 'Corde à sauter', emoji: '➰' },
  { id: 'marche', label: 'Marche', emoji: '🚶‍♀️' },
  { id: 'autre', label: 'Autre activité', emoji: '✨' },
] as const

export type Focus = 'renfo' | 'mobilite' | 'cardio' | 'mixte'

export const FOCUS_LABELS: Record<Focus, string> = {
  renfo: 'Renforcement',
  mobilite: 'Mobilité et étirements',
  cardio: 'Cardio doux',
  mixte: 'Mixte',
}

export interface SessionBlock { exercise: Exercise; seconds: number; rest: number; phase: 'echauffement' | 'corps' | 'calme' }
export interface Session {
  title: string
  focus: Focus
  minutes: number
  intensity: 'douce' | 'moderee' | 'tonique'
  blocks: SessionBlock[]
  totalSeconds: number
}

export interface SessionOptions {
  minutes: number
  focus: Focus
  energy?: number | null
  equipment?: Equipment[]
  seed?: string
}

function rotate<T>(list: T[], seed: string): T[] {
  if (!list.length) return list
  const k = hash(seed) % list.length
  return [...list.slice(k), ...list.slice(0, k)]
}

/**
 * Construit une séance qui tient exactement dans la durée demandée.
 * Énergie basse : exercices doux et repos plus longs. Énergie haute : un cran plus tonique.
 */
export function buildSession(opts: SessionOptions): Session {
  const minutes = Math.max(5, Math.min(45, opts.minutes))
  const energy = opts.energy ?? 3
  const equipment = new Set(opts.equipment ?? ['tapis'])
  const seed = opts.seed ?? 'elan'
  const low = energy <= 2
  const high = energy >= 4
  const focus: Focus = low && opts.focus === 'cardio' ? 'mobilite' : opts.focus
  const maxIntensity = low ? 1 : high ? 3 : 2
  const work = low ? 30 : high ? 45 : 40
  const rest = low ? 30 : high ? 15 : 20

  const usable = (e: Exercise) => (!e.equipment || equipment.has(e.equipment)) && e.intensity <= maxIntensity
  const byCat = (cats: Category[]) => EXERCISES.filter(e => cats.includes(e.category) && usable(e))

  const mainCats: Record<Focus, Category[]> = {
    renfo: ['renfo', 'elastique', 'halteres'],
    mobilite: ['mobilite'],
    cardio: ['cardio'],
    mixte: ['renfo', 'cardio', 'elastique', 'halteres', 'mobilite'],
  }
  const total = minutes * 60
  const warmupSec = minutes >= 10 ? 120 : 60
  const cooldownSec = minutes >= 15 ? 120 : 60
  const blocks: SessionBlock[] = []

  for (const ex of rotate(byCat(['echauffement']), seed + 'w').slice(0, warmupSec / 30)) {
    blocks.push({ exercise: ex, seconds: 30, rest: 0, phase: 'echauffement' })
  }

  let mainBudget = total - warmupSec - cooldownSec
  let pool = rotate(byCat(mainCats[focus]), seed + 'm')
  // Vélo d'appartement : en séance cardio, on reste en selle (pas d'aller-retour vélo / sol toutes les 40 s).
  const bike = pool.filter(e => e.equipment === 'velo_appart')
  if (focus === 'cardio' && bike.length) pool = bike
  else pool = pool.filter(e => e.equipment !== 'velo_appart')
  if (!pool.length) pool = rotate(byCat(['renfo', 'mobilite']), seed + 'm').filter(e => e.equipment !== 'velo_appart')
  let i = 0
  while (mainBudget >= work) {
    const ex = pool[i % pool.length]
    const r = mainBudget - work >= rest + work ? rest : Math.min(rest, mainBudget - work)
    blocks.push({ exercise: ex, seconds: work, rest: r, phase: 'corps' })
    mainBudget -= work + r
    i++
  }
  if (mainBudget > 0 && blocks.length) blocks[blocks.length - 1].rest += mainBudget

  for (const ex of rotate(byCat(['calme']), seed + 'c').slice(0, cooldownSec / 30 >= 3 ? 3 : cooldownSec / 30)) {
    blocks.push({ exercise: ex, seconds: 30, rest: 0, phase: 'calme' })
  }
  // Ajuste le retour au calme pour tomber pile sur la durée prévue
  const sum = blocks.reduce((s, b) => s + b.seconds + b.rest, 0)
  if (sum !== total && blocks.length) blocks[blocks.length - 1].seconds += total - sum

  const intensity = low ? 'douce' : high ? 'tonique' : 'moderee'
  const title = `${FOCUS_LABELS[focus]} · ${minutes} min`
  return { title, focus, minutes, intensity, blocks, totalSeconds: blocks.reduce((s, b) => s + b.seconds + b.rest, 0) }
}
