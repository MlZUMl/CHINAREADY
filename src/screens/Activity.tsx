import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Confirm, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { FOCUS_LABELS, EXTERNAL_ACTIVITIES, type Focus } from '../domain/exercises'
import { sportCommitment, rendezvousStats } from '../domain/ritual'
import { addDays, formatDayLong, WEEKDAYS } from '../lib/dates'
import { ExternalActivitySheet } from './widgets'
import { ProgramCard } from './Programs'
import { IconPlay, IconTrash, IconUser } from '../ui/icons'
import type { Workout } from '../data/types'

export function Activity() {
  const { snap, today, actions } = useApp()
  const sport = sportCommitment(snap)
  const [minutes, setMinutes] = useState<number>(sport?.usual_minutes ?? 20)
  const [focus, setFocus] = useState<Focus>('mixte')
  const [ext, setExt] = useState(false)
  const [del, setDel] = useState<Workout | null>(null)
  const week = rendezvousStats(snap, addDays(today, -6), today, today)
  const history = [...snap.workouts].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 30)
  const label = (w: Workout) => w.kind === 'externe' ? (EXTERNAL_ACTIVITIES.find(a => a.id === w.activity)?.label ?? 'Activité') : (w.program ?? FOCUS_LABELS[w.activity as Focus] ?? 'Séance')
  const emoji = (w: Workout) => w.kind === 'externe' ? (EXTERNAL_ACTIVITIES.find(a => a.id === w.activity)?.emoji ?? '✨') : ({ renfo: '💪', mobilite: '🧘‍♀️', cardio: '💃', mixte: '🌸' } as Record<string, string>)[w.activity] ?? '🌸'

  return (
    <>
      <TopBar title="Activité" right={<button className="icon-btn" aria-label="Profil et réglages" onClick={() => navigate('/profil')}><IconUser /></button>} />
      <main className="content">
        {sport && (
          <section className="card tint">
            <div className="card-head"><div><div className="kicker">Mon rendez-vous</div>
              <h2>{sport.days.length === 5 && [1, 2, 3, 4, 5].every(d => sport.days.includes(d)) ? 'Du lundi au vendredi' : sport.days.map(d => WEEKDAYS[d - 1]).join(', ')} à {sport.cue_time?.replace(':', ' h ')}</h2></div></div>
            <p className="muted">Habituelle : {sport.usual_minutes} min · Minimale : {sport.min_minutes} min{sport.place ? ` · ${sport.place}` : ''}</p>
            <p className="small">7 derniers jours : <strong>{week.honored}</strong> rendez-vous honoré{week.honored > 1 ? 's' : ''}{week.smallSteps ? `, ${week.smallSteps} petit${week.smallSteps > 1 ? 's' : ''} pas` : ''}{week.rests ? `, ${week.rests} repos` : ''}{week.bonus ? `, ${week.bonus} en bonus` : ''}.</p>
            <div className="row"><button className="btn primary sm" onClick={() => navigate('/rituel')}>Préparer ma séance</button>
              <button className="btn ghost sm" onClick={() => navigate('/profil/engagements')}>Modifier</button></div>
          </section>
        )}

        <ProgramCard />

        <section className="card">
          <h2>Lancer une séance guidée</h2>
          <strong className="small">Durée</strong>
          <Chips label="Durée" value={minutes} onChange={v => v && setMinutes(v)} options={[5, 10, 15, 20, 30, 45].map(m => ({ id: m, label: m + ' min' }))} />
          <strong className="small">Type</strong>
          <Chips label="Type de séance" value={focus} onChange={v => v && setFocus(v)} options={(Object.keys(FOCUS_LABELS) as Focus[]).map(f => ({ id: f, label: FOCUS_LABELS[f] }))} />
          <button className="btn primary" onClick={() => navigate(`/seance?min=${minutes}&focus=${focus}&version=${minutes >= (sport?.usual_minutes ?? 20) ? 'usual' : 'min'}&source=libre`)}><IconPlay /> C'est parti</button>
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Une activité faite ailleurs ?</h2><p className="muted small">Ring Fit, danse, vélo, marche : tout compte pour ton rendez-vous.</p></div></div>
          <button className="btn secondary" onClick={() => setExt(true)}>Noter une activité</button>
        </section>

        <div className="section-title"><h2>Historique</h2></div>
        <section className="card">
          {!history.length && <p className="empty">Ta première séance apparaîtra ici.</p>}
          <div className="list">
            {history.map(w => (
              <div className="list-item" key={w.id}>
                <span className="emoji-bubble" aria-hidden="true">{emoji(w)}</span>
                <div className="grow">
                  <div className="title">{label(w)}</div>
                  <div className="muted small">{w.day === today ? 'Aujourd\'hui' : formatDayLong(w.day)} · {w.actual_minutes} min{w.planned_minutes && w.actual_minutes < w.planned_minutes ? ` sur ${w.planned_minutes}` : ''}{w.note ? ` · ${w.note}` : ''}</div>
                </div>
                <button className="icon-btn" aria-label="Supprimer cette séance" onClick={() => setDel(w)}><IconTrash /></button>
              </div>
            ))}
          </div>
        </section>
      </main>
      {ext && <ExternalActivitySheet onClose={() => setExt(false)} />}
      {del && <Confirm title="Supprimer la séance ?" danger confirmLabel="Supprimer" text="Elle disparaîtra de ton historique. Les récompenses déjà obtenues restent acquises." onClose={() => setDel(null)} onConfirm={async () => { await actions.deleteWorkout(del.id); setDel(null) }} />}
    </>
  )
}
