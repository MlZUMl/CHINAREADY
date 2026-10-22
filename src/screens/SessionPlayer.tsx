import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { buildSession, type Focus } from '../domain/exercises'
import { TopBar, Confirm, Progress } from '../ui/components'
import { navigate } from '../lib/router'
import { IconBell, IconPause, IconPlay, IconSkip } from '../ui/icons'
import { ExerciseArt } from '../art/ExerciseArt'
import { playCue, unlockAudio, VIBRATION, type Cue } from '../lib/beep'
import { CompanionArt } from '../art/Companion'
import { messageFor } from '../domain/companion'
import type { RewardGrant, WorkoutSource } from '../data/types'
import { ACCESSORIES, ZONES, badgeDef, itemDef } from '../domain/catalog'

type Step = { kind: 'work' | 'rest'; block: number; seconds: number }

const PHASE: Record<string, string> = { echauffement: 'Échauffement', corps: 'Corps de séance', calme: 'Retour au calme' }

export function SessionPlayer({ query }: { query: URLSearchParams }) {
  const { snap, today, actions } = useApp()
  const minutes = Math.max(5, Math.min(45, Number(query.get('min')) || 10))
  const focus = (query.get('focus') as Focus) || 'mixte'
  const version = (query.get('version') as 'min' | 'usual' | 'plus') || 'usual'
  const source = (query.get('source') as WorkoutSource) || 'libre'
  const lv = Number(query.get('niveau'))
  const level = lv === 1 || lv === 2 || lv === 3 ? lv : undefined
  const programTitle = query.get('programme')
  const energy = snap.daily_checkins.find(c => c.day === today)?.energy ?? null
  const equipment = snap.profiles[0]?.settings.equipment ?? ['tapis']
  const session = useMemo(() => buildSession({ minutes, focus, energy, equipment, level, seed: (programTitle ?? today) + minutes + focus }), [minutes, focus, energy, today, level, programTitle]) // eslint-disable-line
  const title = programTitle ?? session.title
  // « Reprise · semaine 1 · séance 1 » → titre court « Semaine 1 · séance 1 », programme en sur-titre
  const progParts = programTitle && programTitle.split(' · ').length === 3 ? programTitle.split(' · ') : null
  const sound = snap.profiles[0]?.settings.session_sound !== false
  const cue = (c: Cue) => { navigator.vibrate?.(VIBRATION[c]); if (sound) playCue(c) }

  const steps: Step[] = useMemo(() => session.blocks.flatMap((b, i) => {
    const s: Step[] = [{ kind: 'work', block: i, seconds: b.seconds }]
    if (b.rest > 0) s.push({ kind: 'rest', block: i, seconds: b.rest })
    return s
  }), [session])

  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(steps[0].seconds)
  const [elapsed, setElapsed] = useState(0)
  const [quit, setQuit] = useState(false)
  const [result, setResult] = useState<{ minutes: number; grants: RewardGrant[] } | null>(null)
  const startedAt = useRef<string | null>(null)
  const last = useRef<number>(0)
  const wake = useRef<any>(null)
  const saving = useRef(false)
  const lastTick = useRef(0)

  // Horloge basée sur l'heure réelle : reste juste même si l'écran se met en veille un instant.
  useEffect(() => {
    if (!started || paused || result) return
    last.current = Date.now()
    const t = window.setInterval(() => {
      const now = Date.now()
      const dt = (now - last.current) / 1000
      last.current = now
      setElapsed(e => e + dt)
      setLeft(l => l - dt)
    }, 250)
    return () => window.clearInterval(t)
  }, [started, paused, result])

  useEffect(() => {
    if (!started || result) return
    if (left <= 0) {
      if (idx + 1 >= steps.length) finish(true)
      else { cue(steps[idx + 1].kind === 'work' ? 'work' : 'rest'); setIdx(i => i + 1); setLeft(l => steps[idx + 1].seconds + Math.min(0, l)) }
      return
    }
    // 3, 2, 1 : un petit signal avant chaque changement
    const sec = Math.ceil(left)
    if (sec <= 3 && sec !== lastTick.current && !paused) { lastTick.current = sec; cue('tick') }
    if (sec > 3) lastTick.current = 0
  }, [left]) // eslint-disable-line

  useEffect(() => () => { wake.current?.release?.() }, [])

  const begin = async () => {
    startedAt.current = new Date().toISOString()
    unlockAudio()
    cue('work')
    setStarted(true)
    if (source === 'rituel') actions.ritualEvent('commence')
    try { wake.current = await (navigator as any).wakeLock?.request('screen') } catch { /* facultatif */ }
  }

  async function finish(all: boolean) {
    const mins = all ? session.minutes : Math.max(1, Math.round(elapsed / 60))
    wake.current?.release?.()
    if (all) cue('done')
    if (!all && elapsed < 60) { navigate('/', true); return }
    if (saving.current) return
    saving.current = true
    const { id } = await actions.saveWorkout({
      day: today, started_at: startedAt.current ?? new Date().toISOString(), ended_at: new Date().toISOString(),
      kind: 'guidee', activity: session.focus, program: title, planned_minutes: session.minutes, actual_minutes: mins,
      version: all ? version : mins >= session.minutes ? version : 'min', completed: true, source, energy, note: null,
    })
    setResult({ minutes: mins, grants: [] })
    // Le récapitulatif a sa propre adresse : recharger la page ne relance pas la séance.
    navigate('/seance/termine?w=' + encodeURIComponent(id), true)
  }

  if (result) return null

  const step = steps[Math.min(idx, steps.length - 1)]
  const block = session.blocks[step.block]
  const nextWork = steps.slice(idx + 1).find(s => s.kind === 'work')
  const r = 54, c = 2 * Math.PI * r
  const frac = Math.max(0, left) / step.seconds

  return (
    <>
      <TopBar onBack={() => (started ? setQuit(true) : history.back())} title={progParts ? `${progParts[1][0].toUpperCase()}${progParts[1].slice(1)} · ${progParts[2]}` : title}
        kicker={progParts ? `${progParts[0]} · ${session.minutes} min · ${session.intensity}` : `Séance ${session.intensity}`}
        right={<button className={`icon-btn ${sound ? '' : 'off'}`} aria-label={sound ? 'Couper le son' : 'Activer le son'} aria-pressed={sound}
          onClick={() => { unlockAudio(); const p = snap.profiles[0]; if (p) actions.updateProfile({ settings: { ...p.settings, session_sound: !sound } }) }}><IconBell /></button>} />
      <main className="content no-tabs">
        <Progress value={elapsed / session.totalSeconds} label="Progression de la séance" />
        <div className="player">
          <span className="phase">{step.kind === 'rest' ? 'Repos' : PHASE[block.phase]} · {step.block + 1}/{session.blocks.length}</span>
          <h2>{step.kind === 'rest' ? 'Respire, bois une gorgée' : block.exercise.name}</h2>
          <div className="player-visual">
          <ExerciseArt exercise={step.kind === 'rest' && nextWork ? session.blocks[nextWork.block].exercise : block.exercise} size={150} still={!started || paused || step.kind === 'rest'} className={step.kind === 'rest' ? 'dim' : ''} />
          <div className="timer-ring" aria-live="off">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r={r} stroke="var(--mousse-clair)" strokeWidth="8" fill="none" />
              <circle cx="60" cy="60" r={r} stroke={step.kind === 'rest' ? 'var(--eau-clair)' : 'var(--btn)'} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
            </svg>
            <div className="t"><div>{Math.ceil(Math.max(0, left))}<small>{started ? (paused ? 'en pause' : 'secondes') : 'prête ?'}</small></div></div>
          </div>
          </div>
          <p className="muted" style={{ maxWidth: 420 }}>{step.kind === 'rest' ? (nextWork ? `Ensuite : ${session.blocks[nextWork.block].exercise.name}` : 'Dernière ligne droite') : block.exercise.instruction}</p>
          {block.exercise.sides && step.kind === 'work' && <span className="pill">Change de côté à mi-temps</span>}
          {!started ? (
            <button className="btn primary block" onClick={begin}><IconPlay /> Démarrer</button>
          ) : (
            <div className="player-controls">
              <button className="btn secondary" onClick={() => setPaused(p => !p)} aria-label={paused ? 'Reprendre' : 'Pause'}>{paused ? <IconPlay /> : <IconPause />}</button>
              <button className="btn secondary" onClick={() => setLeft(0)} aria-label="Passer"><IconSkip /></button>
              <button className="btn ghost" onClick={() => setQuit(true)}>Terminer</button>
            </div>
          )}
          {nextWork && step.kind === 'work' && <p className="muted small">Ensuite : {session.blocks[nextWork.block].exercise.name}</p>}
        </div>
      </main>
      {quit && (
        <Confirm title="Terminer la séance ?" confirmLabel={elapsed >= 60 ? `Enregistrer ${Math.max(1, Math.round(elapsed / 60))} min` : 'Quitter'}
          text={elapsed >= 60 ? 'Chaque minute compte. Ta séance sera enregistrée telle quelle — plus courte que prévu, c\'est mieux que rien.' : 'Moins d\'une minute : rien ne sera enregistré.'}
          onClose={() => setQuit(false)} onConfirm={() => { setQuit(false); finish(false) }} />
      )}
    </>
  )
}

/** Récapitulatif d'une séance enregistrée (route /seance/termine?w=<id>). */
export function SessionDone({ query }: { query: URLSearchParams }) {
  const { snap, today } = useApp()
  const w = snap.workouts.find(x => x.id === query.get('w'))
  const comp = snap.companion_profiles[0]
  if (!w) return <><TopBar title="Séance" /><main className="content no-tabs"><p className="empty">Cette séance n'existe plus.</p><button className="btn primary block" onClick={() => navigate('/', true)}>Retour à l'accueil</button></main></>
  // Récompenses obtenues avec cette séance : écrites dans la même transaction, au même instant.
  const t0 = Date.parse(w.created_at)
  const grants = snap.reward_grants.filter(g => Math.abs(Date.parse(g.granted_at) - t0) < 5000)
  const xp = grants.reduce((n, g) => n + g.xp, 0)
  const notable = grants.filter(g => g.kind !== 'xp' && g.kind !== 'points')
  const points = grants.reduce((n, g) => n + (g.kind === 'points' ? g.points ?? 0 : 0), 0)
  const minutes = w.actual_minutes
  const planned = w.planned_minutes ?? minutes
  const msg = comp ? messageFor(comp.species, { context: 'seance-faite', expression: 'fier', reason: '' }, snap.companion_interactions, today) : null
  return (
    <>
      <TopBar title="Séance terminée" />
      <main className="content no-tabs">
        <section className="card tint celebrate">
          {comp && <CompanionArt species={comp.species} expression="fier" color={comp.color} accessories={comp.accessories} size={130} className="bob" />}
          <h1>{minutes} min pour toi</h1>
          <p className="muted">{minutes < planned ? 'Plus court que prévu, et pourtant fait : c\'est exactement comme ça qu\'on construit une habitude.' : 'Séance complète. Bravo pour ce rendez-vous tenu.'}</p>
          {msg && <div className="bubble" style={{ textAlign: 'left' }}><span className="who">{comp!.name}</span>{msg.text}</div>}
        </section>
        <section className="card">
          <h2>Récapitulatif</h2>
          <div className="list">
            <div className="list-item"><span className="emoji-bubble">⏱️</span><div className="grow"><div className="title">{minutes} minutes</div><div className="muted small">{w.program ?? 'Séance'} · enregistrée dans ton historique</div></div></div>
            {xp > 0 && <div className="list-item"><span className="emoji-bubble">✨</span><div className="grow"><div className="title">+{xp} points d'expérience</div><div className="muted small">Ton univers grandit</div></div></div>}
            {points > 0 && <button className="list-item" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/univers?onglet=boutique')}><span className="emoji-bubble">🪙</span><div className="grow"><div className="title">+{points} points pour la boutique</div><div className="muted small">De quoi habiller ton compagnon · voir la boutique</div></div></button>}
            {notable.map(g => {
              const label = g.kind === 'badge' ? badgeDef(g.ref)?.name : g.kind === 'item' ? itemDef(g.ref.split('~')[0])?.name : g.kind === 'zone' ? `Nouvelle zone : ${ZONES.find(z => z.id === g.ref)?.name ?? ''}` : `Accessoire pour ton compagnon : ${ACCESSORIES.find(a => a.id === g.ref)?.name ?? ''}`
              const emoji = g.kind === 'badge' ? badgeDef(g.ref)?.emoji : g.kind === 'item' ? itemDef(g.ref.split('~')[0])?.emoji : '🎁'
              return <div className="list-item" key={g.id}><span className="emoji-bubble">{emoji}</span><div className="grow"><div className="title">{label}</div><div className="muted small">{g.reason}</div></div></div>
            })}
          </div>
        </section>
        <button className="btn primary block" onClick={() => navigate('/', true)}>Retour à l'accueil</button>
        {notable.some(g => g.kind === 'item') && <button className="btn ghost block" onClick={() => navigate('/univers', true)}>Voir mon univers</button>}
      </main>
    </>
  )
}
