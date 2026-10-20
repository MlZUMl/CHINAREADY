// Programmes sportifs progressifs : choix, avancement semaine par semaine, prochaine séance.
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { Confirm, Progress, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { IconCheck, IconPlay } from '../ui/icons'
import { LEVEL_LABELS, PROGRAMS, programProgress, programSessions, sessionUrl, type Program, type ProgramSession } from '../domain/programs'
import { buildSession, FOCUS_LABELS } from '../domain/exercises'
import { ExerciseArt } from '../art/ExerciseArt'

/** Carte « programme » de l'onglet Activité (et du rituel). */
export function ProgramCard({ source = 'libre' }: { source?: 'libre' | 'rituel' }) {
  const { snap, today } = useApp()
  const prog = programProgress(snap, today)
  if (!prog) return (
    <section className="card">
      <div className="card-head"><span className="emoji-bubble" aria-hidden="true">🗓️</span><div><h2>Suivre un programme</h2><p className="muted small">4 à 8 semaines, 3 séances par semaine, qui progressent avec toi.</p></div></div>
      <button className="btn secondary" onClick={() => navigate('/activite/programmes')}>Choisir un programme</button>
    </section>
  )
  const { program, next, doneCount, sessions, finished } = prog
  return (
    <section className="card tint" aria-label="Mon programme">
      <div className="card-head"><span className="emoji-bubble" aria-hidden="true">{program.emoji}</span>
        <div><div className="kicker">Mon programme</div><h2>{program.name}</h2></div></div>
      <Progress value={doneCount / sessions.length} label="Avancement du programme" />
      <p className="small muted">{doneCount} séance{doneCount > 1 ? 's' : ''} sur {sessions.length}{next ? ` · semaine ${next.week} sur ${program.weeks}` : ''}</p>
      {finished ? <p><strong>Programme terminé, bravo !</strong> Tu peux en choisir un autre ou le recommencer à un niveau au-dessus.</p> : next && (
        <>
          <p className="small">Prochaine séance : <strong>{FOCUS_LABELS[next.focus]} · {next.minutes} min</strong> ({LEVEL_LABELS[next.level]})</p>
          <div className="row wrap">
            <button className="btn primary sm" onClick={() => navigate(sessionUrl(next, source))}><IconPlay /> Séance {next.n} de la semaine {next.week}</button>
            <button className="btn ghost sm" onClick={() => navigate('/activite/programmes')}>Voir le programme</button>
          </div>
        </>
      )}
      {finished && <button className="btn secondary sm" onClick={() => navigate('/activite/programmes')}>Voir les programmes</button>}
    </section>
  )
}

export function Programs() {
  const { snap, today, actions, toast } = useApp()
  const prog = programProgress(snap, today)
  const [view, setView] = useState<Program | null>(null)
  const [stop, setStop] = useState(false)
  const [browse, setBrowse] = useState(false)
  const shown = view ?? (browse ? null : prog?.program ?? null)
  return (
    <>
      <TopBar onBack={() => (view ? setView(null) : browse ? setBrowse(false) : history.back())} title={shown ? shown.name : 'Programmes'} kicker={shown ? `${shown.weeks} semaines · ${shown.perWeek} séances par semaine` : 'Progresser semaine après semaine'} />
      <main className="content no-tabs">
        {!shown && (
          <>
            <p className="muted">Chaque programme augmente doucement la durée et l'intensité. Les jours de faible énergie, la séance s'adapte toute seule : rien n'est « raté ».</p>
            {PROGRAMS.map(p => (
              <button key={p.id} className="card" style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => setView(p)} aria-label={p.name}>
                <div className="card-head"><span className="emoji-bubble" aria-hidden="true">{p.emoji}</span>
                  <div><h2>{p.name}</h2><div className="muted small">{p.weeks} semaines · {p.plan[0].minutes} à {p.plan[p.weeks - 1].minutes} min</div></div></div>
                <p className="small">{p.pitch}</p>
              </button>
            ))}
          </>
        )}
        {shown && <ProgramDetail program={shown} active={prog?.program.id === shown.id ? prog.done : null} next={prog?.program.id === shown.id ? prog.next : null}
          onStart={async () => {
            await actions.startProgram(shown.id)
            setView(null)
            setBrowse(false)
            toast(shown.emoji, `Programme « ${shown.name} » lancé`)
          }}
          onStop={() => setStop(true)} replacing={Boolean(prog && prog.program.id !== shown.id)} />}
        {prog && !view && !browse && <button className="link-btn" onClick={() => setBrowse(true)}>Voir les autres programmes</button>}
      </main>
      {stop && <Confirm title="Arrêter le programme ?" confirmLabel="Arrêter" text="Tes séances restent dans ton historique. Tu pourras le reprendre depuis le début ou en choisir un autre."
        onClose={() => setStop(false)} onConfirm={async () => { setStop(false); await actions.stopProgram(); setView(null) }} />}
    </>
  )
}

function ProgramDetail({ program, active, next, onStart, onStop, replacing }: {
  program: Program; active: Set<string> | null; next: ProgramSession | null; onStart: () => void; onStop: () => void; replacing: boolean
}) {
  const { snap, today } = useApp()
  const sessions = programSessions(program)
  const equipment = snap.profiles[0]?.settings.equipment ?? ['tapis']
  const preview = next ?? sessions[0]
  const energy = snap.daily_checkins.find(c => c.day === today)?.energy ?? null
  const exercises = useMemo(() => {
    const s = buildSession({ minutes: preview.minutes, focus: preview.focus, level: preview.level, energy, equipment, seed: preview.title + preview.minutes + preview.focus })
    const seen = new Set<string>()
    return s.blocks.filter(b => b.phase === 'corps' && !seen.has(b.exercise.id) && seen.add(b.exercise.id)).map(b => b.exercise)
  }, [preview, energy, equipment])
  return (
    <>
      <section className="card">
        <p>{program.pitch}</p>
        <p className="muted small">{program.forWhom}</p>
        {!active && <button className="btn primary block" onClick={onStart}>{replacing ? 'Passer à ce programme' : 'Commencer ce programme'}</button>}
        {active && next && <button className="btn primary block" onClick={() => navigate(sessionUrl(next))}><IconPlay /> Séance {next.n} · semaine {next.week}</button>}
        {replacing && <p className="muted small">Ton programme actuel sera arrêté ; tes séances restent dans l'historique.</p>}
      </section>
      <section className="card" aria-label="Aperçu des exercices">
        <h3>{active ? 'Prochaine séance' : 'Première séance'} : {FOCUS_LABELS[preview.focus]} · {preview.minutes} min</h3>
        <div className="exercise-strip">
          {exercises.map(e => (
            <figure key={e.id}><ExerciseArt exercise={e} size={104} /><figcaption className="small">{e.name}</figcaption></figure>
          ))}
        </div>
      </section>
      {Array.from({ length: program.weeks }, (_, i) => i + 1).map(w => {
        const list = sessions.filter(x => x.week === w)
        return (
          <section className="card flat" key={w} aria-label={`Semaine ${w}`}>
            <div className="row between"><strong>Semaine {w}</strong><span className="small muted">{program.plan[w - 1].minutes} min · {LEVEL_LABELS[program.plan[w - 1].level]}</span></div>
            <div className="week-sessions">
              {list.map(x => {
                const done = active?.has(x.title)
                const isNext = next?.title === x.title
                return (
                  <button key={x.title} className={`chip ${done ? 'on' : ''} ${isNext ? 'soft on' : ''}`} disabled={!active}
                    onClick={() => navigate(sessionUrl(x))} aria-label={`${x.title}${done ? ' (faite)' : ''}`}>
                    {done ? <IconCheck style={{ width: 16 }} /> : null}{FOCUS_LABELS[x.focus].split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      {active && <button className="btn ghost sm" onClick={onStop}>Arrêter ce programme</button>}
    </>
  )
}
