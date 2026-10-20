// Signal sonore discret pendant les séances guidées (Web Audio : aucun fichier à télécharger).
let ctx: AudioContext | null = null

/** À appeler lors d'un geste de l'utilisatrice (bouton « Démarrer ») : les navigateurs l'exigent. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* son facultatif */ }
}

function tone(freq: number, start: number, dur: number, gain = 0.18) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g).connect(ctx.destination)
  o.start(start)
  o.stop(start + dur + 0.05)
}

export type Cue = 'tick' | 'work' | 'rest' | 'done'

/** tick : 3-2-1 · work : départ d'un exercice · rest : début du repos · done : fin de séance */
export function playCue(cue: Cue) {
  try {
    if (!ctx) return
    const t = ctx.currentTime + 0.01
    if (cue === 'tick') tone(660, t, 0.12, 0.12)
    else if (cue === 'work') { tone(880, t, 0.14); tone(1175, t + 0.16, 0.22) }
    else if (cue === 'rest') tone(523, t, 0.35)
    else { tone(784, t, 0.18); tone(988, t + 0.2, 0.18); tone(1318, t + 0.4, 0.4) }
  } catch { /* son facultatif */ }
}

export const VIBRATION: Record<Cue, number | number[]> = { tick: 40, work: [120, 60, 120], rest: 220, done: [200, 100, 200, 100, 300] }
