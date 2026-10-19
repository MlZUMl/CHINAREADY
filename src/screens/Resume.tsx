// Reprise après une interruption : rien n'est perdu, une seule petite action suffit.
// Pas de rattrapage, pas de double séance, pas de reproche.
import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { resumeState } from '../domain/discipline'
import { levelFor, totalXp } from '../domain/rewards'
import { sportCommitment } from '../domain/ritual'
import { MealSheet } from './widgets'
import type { Obstacle } from '../data/types'

const OBSTACLES: { id: Obstacle; label: string }[] = [
  { id: 'fatigue', label: 'La fatigue' }, { id: 'horaire', label: 'L\'horaire' }, { id: 'preparation', label: 'La préparation' },
  { id: 'motivation', label: 'L\'envie' }, { id: 'autre', label: 'Autre chose' },
]

export function Resume() {
  const { snap, today, actions, toast } = useApp()
  const st = resumeState(snap, today)
  const sport = sportCommitment(snap)
  const badges = snap.reward_grants.filter(g => g.kind === 'badge').length
  const level = levelFor(totalXp(snap)).level
  const sessions = snap.workouts.filter(w => w.completed).length
  const tenue = snap.commitments.find(c => c.kind === 'preparation' && c.active)
  const [obstacle, setObstacle] = useState<Obstacle | null>(null)
  const [meal, setMeal] = useState(false)

  const markResume = () => actions.saveCheckin(today, { need: 'reprendre' })

  const reportIfAny = async () => { if (obstacle) await actions.reportObstacle(obstacle, 'Reprise') }

  return (
    <>
      <TopBar onBack title="On reprend simplement" />
      <main className="content no-tabs">
        <section className="card tint">
          <h2>Rien n'est perdu</h2>
          <p className="muted">
            {st.daysAway >= 3 ? `Tu reviens après ${st.daysAway} jours. ` : st.missedRendezvous >= 2 ? `${st.missedRendezvous} rendez-vous sont passés sans séance. ` : ''}
            Tes {badges} badge{badges > 1 ? 's' : ''}, ton niveau {level} et tes {sessions} séance{sessions > 1 ? 's' : ''} sont toujours là. Reprendre est une compétence : chaque reprise compte.
          </p>
        </section>

        <section className="card">
          <h2>Choisis un seul petit pas, maintenant</h2>
          <p className="muted small">Pas de rattrapage : on ne double pas la séance, on reprend juste le fil.</p>
          <div className="stack">
            <button className="btn primary block" onClick={async () => { await markResume(); await reportIfAny(); navigate(`/seance?min=5&focus=mobilite&version=min&source=reprise`) }}>
              5 minutes de mobilité douce
            </button>
            {sport && (sport.min_minutes ?? 10) > 5 && (
              <button className="btn secondary block" onClick={async () => { await markResume(); await reportIfAny(); navigate(`/seance?min=${sport.min_minutes}&focus=mixte&version=min&source=reprise`) }}>
                Ma version minimale ({sport.min_minutes} min)
              </button>
            )}
            <button className="btn secondary block" onClick={async () => { await markResume(); await reportIfAny(); await actions.addWater(today); toast('💧', 'Un verre de plus. Le fil est renoué.'); navigate('/', true) }}>
              Boire un verre d'eau
            </button>
            <button className="btn secondary block" onClick={async () => { await markResume(); await reportIfAny(); setMeal(true) }}>
              Noter mon prochain repas
            </button>
            {tenue && (
              <button className="btn ghost block" onClick={async () => { await markResume(); await reportIfAny(); await actions.checkHabit(tenue.id, today, 'min'); toast('👟', 'Tenue prête : demain sera plus simple.'); navigate('/', true) }}>
                Préparer ma tenue pour demain
              </button>
            )}
          </div>
        </section>

        <section className="card flat">
          <strong>Qu'est-ce qui t'a éloignée ? <span className="muted">(facultatif)</span></strong>
          <p className="muted small">Pour t'aider à ajuster l'horaire, la durée ou la préparation. Personne ne juge, et tu peux ne rien répondre.</p>
          <Chips label="Obstacle" soft value={obstacle} onChange={setObstacle} options={OBSTACLES} />
          {obstacle === 'horaire' && <button className="link-btn" onClick={async () => { await reportIfAny(); navigate('/profil/engagements') }}>Revoir l'heure de mon rendez-vous</button>}
          {obstacle === 'fatigue' && <p className="muted small">Les jours chargés, la version minimale compte pleinement. Tu peux aussi la prévoir d'office certains jours dans l'analyse de tes habitudes.</p>}
          {obstacle === 'preparation' && <p className="muted small">Préparer ta tenue la veille enlève une décision au moment d'agir.</p>}
          {obstacle === 'motivation' && <p className="muted small">Pas besoin d'envie : cinq minutes, puis tu décides si tu continues.</p>}
        </section>
      </main>
      {meal && <MealSheet day={today} onClose={() => { setMeal(false); navigate('/', true) }} />}
    </>
  )
}
