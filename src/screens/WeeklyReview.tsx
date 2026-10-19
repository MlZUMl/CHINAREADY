import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Segmented, TopBar } from '../ui/components'
import { addDays, formatDayLong, weekStart, isoWeekday } from '../lib/dates'
import { summarizeWeek, INTENTIONS } from '../domain/weekly'
import { navigate } from '../lib/router'

export function WeeklyReviewScreen() {
  const { today } = useApp()
  // Le week-end, on fait le bilan de la semaine en cours ; sinon, celui de la semaine écoulée.
  const [which, setWhich] = useState<'courante' | 'ecoulee'>(isoWeekday(today) >= 6 ? 'courante' : 'ecoulee')
  const ws = which === 'courante' ? weekStart(today) : addDays(weekStart(today), -7)
  return (
    <>
      <TopBar onBack title="Bilan de la semaine" kicker={`Semaine du ${formatDayLong(ws)}`} />
      <main className="content no-tabs">
        <Segmented label="Semaine" value={which} onChange={setWhich} options={[{ id: 'ecoulee', label: 'Semaine écoulée' }, { id: 'courante', label: 'Semaine en cours' }]} />
        <ReviewForm key={ws} ws={ws} />
      </main>
    </>
  )
}

/** Un formulaire par semaine (la clé le réinitialise quand on change de semaine). */
function ReviewForm({ ws }: { ws: string }) {
  const { snap, today, actions, toast } = useApp()
  const sum = summarizeWeek(snap, ws, today)
  const existing = snap.weekly_reviews.find(r => r.week_start === ws)
  const [helped, setHelped] = useState(existing?.helped ?? '')
  const [blocked, setBlocked] = useState(existing?.blocked ?? '')
  const [intention, setIntention] = useState<string | null>(existing?.intention ?? null)
  const [reflection, setReflection] = useState(existing?.reflection ?? '')
  const previous = snap.weekly_reviews.find(r => r.week_start === addDays(ws, -7))

  return (
    <>
      {previous?.intention && (
        <div className="banner" style={{ background: 'var(--poudre)', color: 'var(--prune-fonce)' }}>
          <span>Ton intention pour cette semaine était : <strong>{previous.intention}</strong>.</span>
        </div>
      )}
      <section className="card tint">
        <h2>Ce que tu as fait</h2>
        {sum.highlights.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{sum.highlights.map(h => <li key={h}>{h}</li>)}</ul> : <p className="muted">Une semaine calme. Ce n'est pas un échec : la suivante commence maintenant.</p>}
        <div className="grid2 small">
          <div><strong>{sum.sessions}</strong> séance{sum.sessions > 1 ? 's' : ''} · {sum.minutes} min</div>
          <div><strong>{sum.mealDays}</strong> jour{sum.mealDays > 1 ? 's' : ''} avec repas notés</div>
          <div><strong>{sum.waterGoalDays}</strong> jour{sum.waterGoalDays > 1 ? 's' : ''} objectif d'eau</div>
          <div>Énergie moyenne : <strong>{sum.avgEnergy ?? '—'}</strong></div>
          <div><strong>{sum.missionsDone}</strong> mission{sum.missionsDone > 1 ? 's' : ''}</div>
          <div><strong>{sum.newRewards.badges + sum.newRewards.items}</strong> récompense{sum.newRewards.badges + sum.newRewards.items > 1 ? 's' : ''}</div>
        </div>
        {sum.rdv.restsNoDesire > 0 && <p className="muted small">Rendez-vous laissés « par manque d'envie » : {sum.rdv.restsNoDesire}. Pas de jugement : on cherche juste ce qui rendrait le démarrage plus facile.</p>}
      </section>
      <section className="card">
        <label className="field">Qu'est-ce qui t'a aidée cette semaine ?<textarea className="input" value={helped} onChange={e => setHelped(e.target.value)} /></label>
        <label className="field">Qu'est-ce qui a compliqué les choses ?<textarea className="input" value={blocked} onChange={e => setBlocked(e.target.value)} /></label>
        <strong>Une seule intention pour la semaine prochaine</strong>
        <Chips label="Intention" soft value={intention} onChange={setIntention} options={INTENTIONS.map(i => ({ id: i, label: i }))} />
        <label className="field">Un mot pour toi <span className="hint">Facultatif</span><textarea className="input" value={reflection} onChange={e => setReflection(e.target.value)} /></label>
      </section>
      <button className="btn primary block" onClick={async () => {
        await actions.saveWeeklyReview(ws, { helped: helped.trim() || null, blocked: blocked.trim() || null, intention, reflection: reflection.trim() || null })
        toast('🔎', 'Bilan enregistré')
        navigate('/progres?onglet=regularite', true)
      }}>Enregistrer mon bilan</button>
    </>
  )
}
