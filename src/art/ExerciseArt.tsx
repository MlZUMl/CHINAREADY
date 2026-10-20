// Illustrations simples des exercices : une silhouette au trait (vectoriel, dans la palette de l'appli)
// qui passe doucement de la position de départ à la position d'arrivée. Pas d'image générée.
// Sans animation si l'utilisatrice a demandé de réduire les animations.
import { useMemo } from 'react'
import type { Exercise } from '../domain/exercises'

type Pt = [number, number]
/** Articulations : tête, épaules, bassin, genou/pied (jambe 1 = devant), coude/main (bras 1 = devant). */
interface Pose { H: Pt; N: Pt; P: Pt; K1: Pt; F1: Pt; K2: Pt; F2: Pt; E1: Pt; W1: Pt; E2: Pt; W2: Pt }
type Prop = 'tapis' | 'chaise' | 'mur' | 'elastique-mains' | 'elastique-genoux' | 'elastique-ancre' | 'halteres' | 'corde' | 'velo' | 'souffle'
interface Art { a: Pose; b: Pose; props?: Prop[] }

const p = (base: Pose, o: Partial<Pose> = {}): Pose => ({ ...base, ...o })
const shift = (base: Pose, dx: number, dy: number, keep: (keyof Pose)[] = []): Pose =>
  Object.fromEntries(Object.entries(base).map(([k, v]) => [k, keep.includes(k as keyof Pose) ? v : [v[0] + dx, v[1] + dy]])) as unknown as Pose

// --------------------------------------------------------------- positions de base
/** Debout, de face */
const FRONT: Pose = { H: [60, 16], N: [60, 28], P: [60, 55], K1: [55, 73], F1: [54, 91], K2: [65, 73], F2: [66, 91], E1: [51, 40], W1: [49, 53], E2: [69, 40], W2: [71, 53] }
/** Debout, de profil (regard vers la droite) */
const SIDE: Pose = { H: [61, 16], N: [60, 28], P: [60, 55], K1: [62, 73], F1: [61, 91], K2: [58, 73], F2: [57, 91], E1: [62, 41], W1: [65, 53], E2: [58, 41], W2: [56, 53] }
const SQUAT: Pose = { H: [67, 31], N: [61, 40], P: [44, 62], K1: [64, 66], F1: [60, 91], K2: [62, 67], F2: [57, 91], E1: [72, 43], W1: [84, 42], E2: [71, 45], W2: [83, 45] }
const FOURS: Pose = { H: [82, 64], N: [74, 66], P: [44, 66], K1: [44, 90], F1: [24, 90], K2: [46, 90], F2: [26, 90], E1: [74, 78], W1: [74, 90], E2: [76, 78], W2: [76, 90] }
const BACK: Pose = { H: [20, 83], N: [30, 86], P: [57, 86], K1: [71, 70], F1: [80, 90], K2: [73, 70], F2: [82, 90], E1: [42, 89], W1: [53, 90], E2: [41, 89], W2: [52, 90] }
const BELLY: Pose = { H: [20, 82], N: [31, 86], P: [59, 88], K1: [77, 88], F1: [96, 88], K2: [77, 89], F2: [96, 89], E1: [20, 89], W1: [8, 89], E2: [21, 90], W2: [9, 90] }
const SIDE_LYING: Pose = { H: [16, 79], N: [27, 83], P: [56, 85], K1: [75, 85], F1: [94, 87], K2: [75, 86], F2: [94, 88], E1: [20, 91], W1: [12, 84], E2: [40, 88], W2: [50, 90] }
const SEATED: Pose = { H: [60, 44], N: [60, 56], P: [60, 82], K1: [44, 84], F1: [68, 90], K2: [76, 84], F2: [52, 90], E1: [51, 66], W1: [50, 78], E2: [69, 66], W2: [70, 78] }

const ARTS: Record<string, Art> = {
  // échauffement
  'marche-place': { a: p(FRONT, { K1: [54, 64], F1: [56, 81], E1: [52, 39], W1: [55, 30] }), b: p(FRONT, { K2: [66, 64], F2: [64, 81], E2: [68, 39], W2: [65, 30] }) },
  'cercles-bras': { a: p(FRONT, { E1: [47, 30], W1: [34, 28], E2: [73, 30], W2: [86, 28] }), b: p(FRONT, { E1: [47, 26], W1: [35, 18], E2: [73, 26], W2: [85, 18] }) },
  'rotations-bassin': { a: p(FRONT, { P: [55, 55], E1: [52, 44], W1: [56, 54], E2: [64, 44], W2: [60, 54] }), b: p(FRONT, { P: [65, 55], E1: [56, 44], W1: [60, 54], E2: [68, 44], W2: [64, 54] }) },
  'pas-chasses-doux': { a: p(FRONT), b: p(FRONT, { K1: [48, 73], F1: [42, 91], K2: [70, 73], F2: [76, 91] }) },
  // renforcement
  squat: { a: p(SIDE, { E1: [66, 40], W1: [78, 40], E2: [65, 42], W2: [77, 42] }), b: SQUAT },
  'squat-chaise': { a: p(SIDE, { E1: [66, 40], W1: [78, 40] }), b: p(SQUAT, { P: [42, 66], K1: [62, 67] }), props: ['chaise'] },
  'fentes-arriere': {
    a: p(SIDE, { E1: [65, 46], W1: [60, 56], E2: [56, 46], W2: [60, 56] }),
    b: p(SIDE, { H: [59, 27], N: [58, 39], P: [56, 66], K1: [72, 72], F1: [72, 91], K2: [50, 87], F2: [34, 89], E1: [64, 52], W1: [58, 62], E2: [53, 52], W2: [57, 62] }),
  },
  'pont-fessier': { a: BACK, b: p(BACK, { P: [56, 70], K1: [72, 64], K2: [74, 64] }), props: ['tapis'] },
  'pompes-mur': {
    a: p(SIDE, { H: [69, 18], N: [65, 29], P: [52, 55], K1: [49, 73], F1: [46, 91], K2: [47, 73], F2: [44, 91], E1: [78, 30], W1: [90, 31], E2: [77, 32], W2: [90, 33] }),
    b: p(SIDE, { H: [77, 22], N: [73, 32], P: [56, 57], K1: [51, 74], F1: [46, 91], K2: [49, 74], F2: [44, 91], E1: [78, 44], W1: [90, 31], E2: [77, 45], W2: [90, 33] }),
    props: ['mur'],
  },
  'pompes-genoux': {
    a: { H: [86, 57], N: [77, 62], P: [50, 74], K1: [36, 90], F1: [21, 82], K2: [37, 90], F2: [22, 83], E1: [77, 76], W1: [77, 90], E2: [79, 76], W2: [79, 90] },
    b: { H: [88, 74], N: [78, 78], P: [50, 82], K1: [36, 90], F1: [21, 82], K2: [37, 90], F2: [22, 83], E1: [67, 74], W1: [77, 90], E2: [69, 74], W2: [79, 90] },
    props: ['tapis'],
  },
  'gainage-genoux': {
    a: { H: [84, 69], N: [75, 74], P: [49, 79], K1: [35, 90], F1: [20, 84], K2: [36, 90], F2: [21, 85], E1: [75, 90], W1: [87, 90], E2: [76, 90], W2: [88, 90] },
    b: { H: [84, 68], N: [75, 73], P: [49, 77], K1: [35, 90], F1: [20, 84], K2: [36, 90], F2: [21, 85], E1: [75, 90], W1: [87, 90], E2: [76, 90], W2: [88, 90] },
    props: ['tapis'],
  },
  gainage: {
    a: { H: [88, 67], N: [79, 72], P: [52, 77], K1: [37, 84], F1: [21, 90], K2: [38, 85], F2: [22, 90], E1: [79, 90], W1: [91, 90], E2: [80, 90], W2: [92, 90] },
    b: { H: [88, 66], N: [79, 71], P: [52, 75], K1: [37, 83], F1: [21, 90], K2: [38, 84], F2: [22, 90], E1: [79, 90], W1: [91, 90], E2: [80, 90], W2: [92, 90] },
    props: ['tapis'],
  },
  'abducteurs-allonge': { a: SIDE_LYING, b: p(SIDE_LYING, { K2: [74, 76], F2: [91, 67] }), props: ['tapis'] },
  superman: { a: BELLY, b: p(BELLY, { H: [21, 77], E1: [19, 83], W1: [7, 79], K2: [77, 86], F2: [95, 80] }), props: ['tapis'] },
  mollets: { a: p(SIDE, { E1: [66, 40], W1: [76, 34] }), b: p(shift(SIDE, 0, -5, ['F1', 'F2']), { E1: [66, 35], W1: [76, 30], F1: [63, 91], F2: [59, 91] }), props: ['mur'] },
  // élastique
  'elastique-tirage': {
    a: p(SIDE, { E1: [72, 40], W1: [85, 40], E2: [71, 42], W2: [84, 42] }),
    b: p(SIDE, { E1: [51, 44], W1: [64, 42], E2: [50, 45], W2: [63, 44] }), props: ['elastique-ancre'],
  },
  'elastique-marche': {
    a: p(FRONT, { P: [60, 58], K1: [52, 74], F1: [50, 91], K2: [68, 74], F2: [70, 91], E1: [52, 44], W1: [56, 55], E2: [68, 44], W2: [64, 55] }),
    b: p(FRONT, { P: [60, 58], K1: [47, 74], F1: [42, 91], K2: [68, 74], F2: [70, 91], E1: [52, 44], W1: [56, 55], E2: [68, 44], W2: [64, 55] }), props: ['elastique-genoux'],
  },
  'elastique-ecarte': {
    a: p(FRONT, { E1: [53, 38], W1: [55, 38], E2: [67, 38], W2: [65, 38] }),
    b: p(FRONT, { E1: [46, 36], W1: [33, 36], E2: [74, 36], W2: [87, 36] }), props: ['elastique-mains'],
  },
  'elastique-kickback': {
    a: p(SIDE, { H: [69, 22], N: [65, 32], E1: [74, 42], W1: [84, 48], E2: [73, 43], W2: [83, 49] }),
    b: p(SIDE, { H: [70, 24], N: [66, 34], E1: [75, 44], W1: [84, 48], E2: [74, 45], W2: [83, 49], K2: [47, 71], F2: [33, 82] }), props: ['chaise'],
  },
  // haltères
  'halteres-souleve': {
    a: SIDE,
    b: { H: [80, 41], N: [71, 46], P: [50, 57], K1: [60, 73], F1: [60, 91], K2: [58, 73], F2: [57, 91], E1: [72, 58], W1: [72, 71], E2: [70, 58], W2: [70, 71] }, props: ['halteres'],
  },
  'halteres-developpe': {
    a: p(FRONT, { E1: [47, 39], W1: [48, 28], E2: [73, 39], W2: [72, 28] }),
    b: p(FRONT, { E1: [50, 20], W1: [52, 8], E2: [70, 20], W2: [68, 8] }), props: ['halteres'],
  },
  'halteres-rowing': {
    a: { H: [83, 40], N: [74, 45], P: [48, 52], K1: [50, 72], F1: [50, 91], K2: [64, 64], F2: [44, 64], E1: [78, 56], W1: [80, 64], E2: [71, 58], W2: [70, 72] },
    b: { H: [83, 40], N: [74, 45], P: [48, 52], K1: [50, 72], F1: [50, 91], K2: [64, 64], F2: [44, 64], E1: [78, 56], W1: [80, 64], E2: [59, 42], W2: [63, 55] }, props: ['chaise', 'halteres'],
  },
  'halteres-squat': {
    a: p(SIDE, { E1: [60, 42], W1: [68, 34], E2: [59, 43], W2: [67, 35] }),
    b: p(SQUAT, { E1: [62, 50], W1: [70, 42], E2: [61, 51], W2: [69, 43] }), props: ['halteres'],
  },
  'halteres-biceps': {
    a: p(SIDE, { E1: [61, 42], W1: [63, 56], E2: [59, 42], W2: [60, 56] }),
    b: p(SIDE, { E1: [61, 42], W1: [70, 32], E2: [59, 42], W2: [68, 32] }), props: ['halteres'],
  },
  // cardio
  'genoux-hauts': { a: p(SIDE, { E1: [56, 40], W1: [52, 50], E2: [66, 38], W2: [72, 30] }), b: p(SIDE, { K1: [73, 58], F1: [72, 76], E1: [67, 38], W1: [73, 30], E2: [55, 40], W2: [51, 50] }) },
  'step-touch': { a: p(FRONT, { K1: [50, 73], F1: [44, 91], E1: [47, 36], W1: [40, 30] }), b: p(FRONT, { K2: [70, 73], F2: [76, 91], E2: [73, 36], W2: [80, 30] }) },
  'talons-fesses': { a: SIDE, b: p(SIDE, { K1: [61, 73], F1: [47, 63], E1: [66, 40], W1: [70, 31] }) },
  'boxe-air': {
    a: p(SIDE, { E1: [66, 40], W1: [70, 30], E2: [64, 42], W2: [68, 33] }),
    b: p(SIDE, { E1: [74, 31], W1: [89, 29], E2: [64, 42], W2: [68, 33] }),
  },
  'jumping-sans-saut': { a: FRONT, b: p(FRONT, { E1: [48, 22], W1: [42, 9], E2: [72, 22], W2: [78, 9], K2: [70, 73], F2: [79, 91] }) },
  // mobilité
  'chat-vache': { a: p(FOURS, { P: [44, 62], N: [74, 62], H: [83, 70] }), b: p(FOURS, { P: [44, 68], N: [74, 68], H: [82, 58] }), props: ['tapis'] },
  'posture-enfant': {
    a: { H: [80, 85], N: [70, 80], P: [44, 80], K1: [56, 90], F1: [34, 90], K2: [57, 90], F2: [35, 90], E1: [86, 88], W1: [98, 90], E2: [87, 89], W2: [99, 91] },
    b: { H: [81, 86], N: [71, 81], P: [44, 82], K1: [56, 90], F1: [34, 90], K2: [57, 90], F2: [35, 90], E1: [87, 88], W1: [100, 90], E2: [88, 89], W2: [101, 91] }, props: ['tapis'],
  },
  'fente-basse': {
    a: { H: [63, 30], N: [61, 42], P: [56, 68], K1: [74, 72], F1: [78, 91], K2: [42, 90], F2: [26, 90], E1: [70, 52], W1: [75, 64], E2: [68, 52], W2: [73, 64] },
    b: { H: [67, 31], N: [65, 43], P: [61, 71], K1: [78, 72], F1: [78, 91], K2: [44, 90], F2: [27, 90], E1: [74, 54], W1: [77, 66], E2: [72, 54], W2: [76, 66] }, props: ['tapis'],
  },
  'torsion-assise': { a: SEATED, b: p(SEATED, { H: [63, 44], E1: [64, 66], W1: [74, 78], E2: [74, 64], W2: [82, 74] }), props: ['tapis'] },
  'chien-tete-bas': {
    a: { H: [86, 76], N: [80, 70], P: [58, 46], K1: [54, 68], F1: [46, 91], K2: [55, 68], F2: [47, 91], E1: [86, 80], W1: [92, 90], E2: [87, 80], W2: [93, 90] },
    b: { H: [86, 77], N: [80, 71], P: [58, 44], K1: [56, 64], F1: [46, 90], K2: [52, 67], F2: [44, 91], E1: [86, 80], W1: [92, 90], E2: [87, 80], W2: [93, 90] }, props: ['tapis'],
  },
  'etirement-ischios': {
    a: p(SIDE, { K1: [70, 74], F1: [80, 91], E1: [64, 45], W1: [66, 58] }),
    b: { H: [77, 30], N: [70, 37], P: [55, 57], K1: [70, 74], F1: [80, 91], K2: [55, 74], F2: [55, 91], E1: [72, 50], W1: [72, 62], E2: [70, 50], W2: [70, 62] },
  },
  'ouverture-epaules': {
    a: p(SIDE, { E1: [53, 44], W1: [47, 55], E2: [52, 44], W2: [46, 55] }),
    b: p(SIDE, { H: [62, 15], E1: [50, 42], W1: [40, 50], E2: [49, 42], W2: [39, 50] }),
  },
  // corde et vélo
  'corde-douce': { a: p(FRONT, { K1: [55, 71], F1: [56, 87], E1: [48, 46], W1: [42, 56], E2: [72, 46], W2: [78, 56] }), b: p(FRONT, { K2: [65, 71], F2: [64, 87], E1: [48, 46], W1: [42, 56], E2: [72, 46], W2: [78, 56] }), props: ['corde'] },
  'corde-sauts': { a: p(FRONT, { E1: [48, 46], W1: [42, 56], E2: [72, 46], W2: [78, 56] }), b: shift(p(FRONT, { E1: [48, 46], W1: [42, 56], E2: [72, 46], W2: [78, 56] }), 0, -6), props: ['corde'] },
  'corde-sans': { a: p(FRONT, { K1: [54, 66], F1: [56, 83], E1: [48, 46], W1: [42, 56], E2: [72, 46], W2: [78, 56] }), b: p(FRONT, { K2: [66, 66], F2: [64, 83], E1: [48, 46], W1: [42, 52], E2: [72, 46], W2: [78, 52] }) },
  'velo-tranquille': { a: bikeA(), b: bikeB(), props: ['velo'] },
  'velo-rythme': { a: bikeA(), b: bikeB(), props: ['velo'] },
  'velo-sprint': { a: bikeA(2), b: bikeB(2), props: ['velo'] },
  // retour au calme
  respiration: { a: p(FRONT, { E1: [52, 44], W1: [58, 52], E2: [68, 44], W2: [62, 52] }), b: p(FRONT, { N: [60, 27], H: [60, 15], E1: [51, 43], W1: [58, 50], E2: [69, 43], W2: [62, 50] }), props: ['souffle'] },
  'etirement-cote': {
    a: p(FRONT, { E1: [53, 18], W1: [57, 6] }),
    b: p(FRONT, { H: [53, 18], N: [56, 29], E1: [56, 16], W1: [68, 8], E2: [66, 42], W2: [68, 55] }),
  },
  'cou-epaules': { a: p(FRONT, { H: [56, 17] }), b: p(FRONT, { H: [64, 17] }) },
}

function bikeA(lean = 0): Pose { return { H: [64 + lean, 22], N: [60 + lean, 33], P: [52, 58], K1: [70, 54], F1: [68, 74], K2: [64, 66], F2: [58, 84], E1: [70 + lean, 40], W1: [80, 44], E2: [69 + lean, 41], W2: [79, 45] } }
function bikeB(lean = 0): Pose { return { H: [64 + lean, 22], N: [60 + lean, 33], P: [52, 58], K1: [66, 66], F1: [58, 84], K2: [70, 54], F2: [68, 74], E1: [70 + lean, 40], W1: [80, 44], E2: [69 + lean, 41], W2: [79, 45] } }

const BY_CATEGORY: Record<Exercise['category'], string> = {
  echauffement: 'marche-place', renfo: 'squat', elastique: 'elastique-ecarte', halteres: 'halteres-biceps', cardio: 'step-touch', mobilite: 'chat-vache', calme: 'respiration',
}

const artKey = (ex: Pick<Exercise, 'id' | 'category'>) => (ARTS[ex.id] ? ex.id : BY_CATEGORY[ex.category])

export function artFor(ex: Pick<Exercise, 'id' | 'category'>): Art {
  return ARTS[ex.id] ?? ARTS[BY_CATEGORY[ex.category]]
}
export const ILLUSTRATED = Object.keys(ARTS)
/** Exercices dessinés de face : les deux jambes et les deux bras sont alors de la même couleur. */
const FRONT_VIEW = new Set(['marche-place', 'cercles-bras', 'rotations-bassin', 'pas-chasses-doux', 'elastique-marche', 'elastique-ecarte', 'halteres-developpe',
  'step-touch', 'jumping-sans-saut', 'corde-douce', 'corde-sauts', 'corde-sans', 'respiration', 'etirement-cote', 'cou-epaules', 'torsion-assise'])

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Seg({ a, b, from, to, animate, dur }: { a: Pose; b: Pose; from: keyof Pose; to: keyof Pose; animate: boolean; dur: string }) {
  const [x1, y1] = a[from], [x2, y2] = a[to]
  const [bx1, by1] = b[from], [bx2, by2] = b[to]
  const anim = (attr: string, v1: number, v2: number) => v1 === v2 ? null
    : <animate attributeName={attr} values={`${v1};${v2};${v1}`} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}>
      {animate && <>{anim('x1', x1, bx1)}{anim('y1', y1, by1)}{anim('x2', x2, bx2)}{anim('y2', y2, by2)}</>}
    </line>
  )
}

/** Illustration animée d'un exercice. */
export function ExerciseArt({ exercise, size = 160, still = false, phase = 'a', className }: { exercise: Pick<Exercise, 'id' | 'category' | 'name'>; size?: number; still?: boolean; phase?: 'a' | 'b'; className?: string }) {
  const base = artFor(exercise)
  const art = phase === 'b' ? { ...base, a: base.b, b: base.a } : base
  const animate = !still && !reduceMotion()
  const dur = exercise.category === 'cardio' ? '1.2s' : exercise.category === 'calme' || exercise.category === 'mobilite' ? '4s' : '2.4s'
  const { a, b } = art
  const props = art.props ?? []
  const head = useMemo(() => (animate && (a.H[0] !== b.H[0] || a.H[1] !== b.H[1])) ? (
    <>
      <animate attributeName="cx" values={`${a.H[0]};${b.H[0]};${a.H[0]}`} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
      <animate attributeName="cy" values={`${a.H[1]};${b.H[1]};${a.H[1]}`} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
    </>
  ) : null, [a, b, animate, dur])
  const S = (from: keyof Pose, to: keyof Pose) => <Seg a={a} b={b} from={from} to={to} animate={animate} dur={dur} />
  return (
    <svg className={`exercise-art ${className ?? ''}`} viewBox="0 0 120 100" width={size} height={size * 100 / 120} role="img" aria-label={`Illustration : ${exercise.name}`}>
      <rect x="0" y="0" width="120" height="100" rx="14" fill="var(--mousse-clair)" />
      <line x1="6" y1="93" x2="114" y2="93" stroke="var(--poudre-2)" strokeWidth="2" strokeLinecap="round" />
      {props.includes('tapis') && <rect x="10" y="91" width="100" height="4" rx="2" fill="var(--rose)" opacity=".55" />}
      {props.includes('mur') && <rect x="91" y="6" width="6" height="87" rx="2" fill="var(--poudre-2)" />}
      {props.includes('chaise') && <g stroke="var(--texte-doux)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".7">
        <path d="M30 64 H50 M30 64 V92 M50 64 V92 M30 64 V40" />
      </g>}
      {props.includes('velo') && <g stroke="var(--texte-doux)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".75">
        <path d="M50 60 H58 M54 60 L62 80 L80 46 H86 M62 80 L46 92 M62 80 L84 92" /><circle cx="62" cy="80" r="5" />
      </g>}
      {props.includes('souffle') && <circle cx="60" cy="47" r="14" fill="var(--nuit)" opacity=".12">
        {animate && <animate attributeName="r" values="10;20;10" dur={dur} repeatCount="indefinite" />}
      </circle>}
      <g stroke={FRONT_VIEW.has(artKey(exercise)) ? 'var(--vert)' : 'var(--poudre-2)'} strokeWidth="6" strokeLinecap="round">{S('P', 'K2')}{S('K2', 'F2')}{S('N', 'E2')}{S('E2', 'W2')}</g>
      <g stroke="var(--vert)" strokeWidth="6.5" strokeLinecap="round">{S('N', 'P')}{S('P', 'K1')}{S('K1', 'F1')}{S('N', 'E1')}{S('E1', 'W1')}</g>
      <circle cx={a.H[0]} cy={a.H[1]} r="7.5" fill="var(--vert)">{head}</circle>
      {props.includes('halteres') && <g fill="var(--nuit)">
        <circle cx={a.W1[0]} cy={a.W1[1]} r="3.6">{animate && <><animate attributeName="cx" values={`${a.W1[0]};${b.W1[0]};${a.W1[0]}`} dur={dur} repeatCount="indefinite" /><animate attributeName="cy" values={`${a.W1[1]};${b.W1[1]};${a.W1[1]}`} dur={dur} repeatCount="indefinite" /></>}</circle>
      </g>}
      {props.includes('elastique-mains') && <path d={`M${a.W1[0]} ${a.W1[1]} L${a.W2[0]} ${a.W2[1]}`} stroke="var(--rose)" strokeWidth="2.5" strokeLinecap="round">
        {animate && <animate attributeName="d" values={`M${a.W1[0]} ${a.W1[1]} L${a.W2[0]} ${a.W2[1]};M${b.W1[0]} ${b.W1[1]} L${b.W2[0]} ${b.W2[1]};M${a.W1[0]} ${a.W1[1]} L${a.W2[0]} ${a.W2[1]}`} dur={dur} repeatCount="indefinite" />}
      </path>}
      {props.includes('elastique-genoux') && <path d={`M${a.K1[0]} ${a.K1[1] - 4} L${a.K2[0]} ${a.K2[1] - 4}`} stroke="var(--rose)" strokeWidth="2.5" strokeLinecap="round">
        {animate && <animate attributeName="d" values={`M${a.K1[0]} ${a.K1[1] - 4} L${a.K2[0]} ${a.K2[1] - 4};M${b.K1[0]} ${b.K1[1] - 4} L${b.K2[0]} ${b.K2[1] - 4};M${a.K1[0]} ${a.K1[1] - 4} L${a.K2[0]} ${a.K2[1] - 4}`} dur={dur} repeatCount="indefinite" />}
      </path>}
      {props.includes('elastique-ancre') && <path d={`M${a.W1[0]} ${a.W1[1]} L108 40`} stroke="var(--rose)" strokeWidth="2.5" strokeLinecap="round">
        {animate && <animate attributeName="d" values={`M${a.W1[0]} ${a.W1[1]} L108 40;M${b.W1[0]} ${b.W1[1]} L108 40;M${a.W1[0]} ${a.W1[1]} L108 40`} dur={dur} repeatCount="indefinite" />}
      </path>}
      {props.includes('corde') && <path d={`M${a.W1[0]} ${a.W1[1]} Q60 104 ${a.W2[0]} ${a.W2[1]}`} stroke="var(--nuit)" strokeWidth="2" fill="none" strokeLinecap="round">
        {animate && <animate attributeName="d" values={`M${a.W1[0]} ${a.W1[1]} Q60 104 ${a.W2[0]} ${a.W2[1]};M${a.W1[0]} ${a.W1[1]} Q60 -4 ${a.W2[0]} ${a.W2[1]};M${a.W1[0]} ${a.W1[1]} Q60 104 ${a.W2[0]} ${a.W2[1]}`} dur={dur} repeatCount="indefinite" />}
      </path>}
    </svg>
  )
}
