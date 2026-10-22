import { useEffect, useRef } from 'react'
import { useApp } from '../app/state'
import { TopBar } from '../ui/components'
import { IconCheck, IconChevron, IconCloud, IconUser } from '../ui/icons'
import { navigate } from '../lib/router'
import { formatDayLong, minutesOfDay } from '../lib/dates'
import { dayRitual, isRendezvousDay, sportCommitment } from '../domain/ritual'
import { habitState, isHabitDay, resumeState } from '../domain/discipline'
import { quoteOfDay } from '../domain/quotes'
import { CheckinCard, CompanionCard, MissionCard, WaterWidget, WeekStrip } from './widgets'
import { CalorieSummary } from './food-parts'
import { CycleCard } from './Cycle'
import { defaultMealSlot } from '../domain/nutrition'

export function Home({ query }: { query?: URLSearchParams }) {
  const { snap, today, actions, cloud, toast } = useApp()
  const profile = snap.profiles[0]
  useEffect(() => { actions.ensureMission(today) }, [today, actions])
  // Raccourci de l'icône (appui long) : « Boire un verre »
  const quickWater = query?.get('eau') === '1'
  const waterDone = useRef(false)
  useEffect(() => {
    if (!quickWater || waterDone.current) return
    waterDone.current = true
    navigate('/', true)
    actions.addWater(today, 250).then(() => toast('💧', '25 cl d\'eau de plus'))
  }, [quickWater]) // eslint-disable-line react-hooks/exhaustive-deps

  const sport = sportCommitment(snap)
  const ritual = dayRitual(snap, today, today)
  const resume = resumeState(snap, today)
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir'

  return (
    <>
      <TopBar kicker={formatDayLong(today)} title={`${hello}${profile?.display_name ? ' ' + profile.display_name : ''}`}
        right={<button className="icon-btn" aria-label="Profil et réglages" onClick={() => navigate('/profil')}><IconUser /></button>} />
      <main className="content">
        <CompanionCard />

        {resume.needed && (
          <section className="card prune" aria-label="Reprise">
            <div className="card-head"><div><div className="kicker">On reprend simplement</div><h2>Une seule petite action aujourd'hui</h2></div></div>
            <p className="muted">Rien n'est perdu : tes badges, ton univers et ton historique t'attendent. Pas de rattrapage, juste le prochain pas.</p>
            <button className="btn white" onClick={() => navigate('/reprise')}>Choisir mon petit pas</button>
          </section>
        )}

        {ritualCard()}
        <CheckinCard compact />
        <MissionCard />

        <section className="card" aria-label="Mes engagements du jour">
          <div className="card-head"><div><div className="kicker">Aujourd'hui</div><h2>Mes engagements</h2></div>
            <button className="link-btn" onClick={() => navigate('/profil/engagements')}>Gérer</button></div>
          <div className="list">
            {snap.commitments.filter(c => c.active && isHabitDay(c, today)).sort((a, b) => a.sort - b.sort).map(c => {
              const st = habitState(snap, c, today)
              const manual = c.kind === 'preparation' || c.kind === 'perso'
              return (
                <div className="list-item" key={c.id}>
                  <span className="emoji-bubble" aria-hidden="true">{{ sport: '🧘‍♀️', eau: '💧', repas: '🍽️', preparation: '👟', perso: '⭐' }[c.kind]}</span>
                  <div className="grow">
                    <div className="title">{c.title}</div>
                    <div className="muted small">{st === 'usual' ? 'Version habituelle faite ✓' : st === 'min' ? 'Version minimale faite ✓ — c\'est tenu' : `Minimum : ${c.min_label}`}</div>
                  </div>
                  {manual ? (
                    <button className={`chip ${st !== 'none' ? 'on' : ''}`} aria-pressed={st !== 'none'} onClick={() => actions.checkHabit(c.id, today, st === 'none' ? 'min' : st === 'min' ? 'usual' : null)}>
                      {st === 'none' ? 'Fait' : st === 'min' ? 'Minimum ✓' : 'Complet ✓'}
                    </button>
                  ) : c.kind === 'eau' ? (
                    <button className="chip" onClick={() => actions.addWater(today, 250)}>+ 25 cl</button>
                  ) : c.kind === 'repas' ? (
                    <button className="chip" onClick={() => navigate(`/repas/ajouter?repas=${defaultMealSlot()}`)}>Noter</button>
                  ) : st !== 'none' ? <span className="pill ok"><IconCheck style={{ width: 16 }} /> Tenu</span> : null}
                </div>
              )
            })}
          </div>
        </section>

        <button style={{ all: 'unset', cursor: 'pointer', display: 'block' }} onClick={() => navigate('/repas')} aria-label="Ouvrir mon journal alimentaire"><CalorieSummary day={today} compact /></button>
        <button className="btn secondary" onClick={() => navigate(`/repas/ajouter?repas=${defaultMealSlot()}`)}>Ajouter un aliment</button>

        <WaterWidget day={today} compact />

        <CycleCard />

        <section className="card" aria-label="Ma semaine">
          <div className="card-head"><div><div className="kicker">Ma semaine</div></div>
            <button className="link-btn" onClick={() => navigate('/progres')}>Calendrier</button></div>
          <WeekStrip />
        </section>

        <section className="card flat" aria-label="Phrase du jour">
          <p style={{ fontFamily: 'var(--titre)', fontSize: '1.08rem', color: 'var(--prune)' }}>« {quoteOfDay(today)} »</p>
        </section>

        {cloud.configured && !cloud.user && (
          <button className="banner" style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/profil/compte')}>
            <IconCloud /><span><strong>Tes données sont seulement sur ce téléphone.</strong> Crée ton compte pour les sauvegarder et recevoir les rappels appli fermée.</span>
          </button>
        )}
      </main>
    </>
  )

  function ritualCard() {
    if (!sport) return null
    const scheduled = isRendezvousDay(sport, today)
    const cue = sport.cue_time ?? '17:15'
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    const isTime = now >= minutesOfDay(cue)
    if (ritual.status === 'honore') return (
      <section className="card tint fleurs" aria-label="Rendez-vous sportif">
        <div className="card-head"><span className="emoji-bubble" aria-hidden="true">🌸</span>
          <div><div className="kicker">Rendez-vous honoré</div><h2>{ritual.minutes} min pour toi aujourd'hui</h2></div></div>
        <p className="muted">{ritual.version === 'min' ? 'Version minimale tenue : le fil est gardé, et c\'est exactement le but.' : 'Séance faite. Ton toi de demain te remercie.'}</p>
        <button className="btn ghost sm" onClick={() => navigate('/activite')}>Voir mon activité</button>
      </section>
    )
    if (ritual.status === 'repos') return (
      <section className="card flat" aria-label="Rendez-vous sportif">
        <div className="card-head"><span className="emoji-bubble" style={{ background: 'var(--eau-clair)' }} aria-hidden="true">🌙</span>
          <div><div className="kicker">Repos noté</div><h3>Le repos fait partie du plan.</h3></div></div>
        <p className="muted small">Demain, ton rendez-vous sera là, comme d'habitude.</p>
        <button className="link-btn" onClick={() => actions.cancelRest(today)}>Finalement, je bouge un peu</button>
      </section>
    )
    if (!scheduled) return (
      <section className="card flat" aria-label="Rendez-vous sportif">
        <div className="card-head"><span className="emoji-bubble" aria-hidden="true">☁️</span>
          <div><div className="kicker">Pas de rendez-vous aujourd'hui</div><h3>Jour libre</h3></div></div>
        <p className="muted small">Si l'envie est là, une séance ou une activité compte en bonus. Sinon, profite.</p>
        <div className="row"><button className="btn secondary sm" onClick={() => navigate('/rituel')}>Bouger un peu</button></div>
      </section>
    )
    return (
      <section className={`card ${isTime ? 'prune' : 'tint fleurs'}`} aria-label="Rendez-vous sportif">
        <div className="card-head"><span className="emoji-bubble" aria-hidden="true">⏰</span>
          <div><div className="kicker">Mon rendez-vous · {cue.replace(':', ' h ')}</div>
            <h2>{isTime ? 'C\'est l\'heure. On y va ?' : `Séance de ${sport.usual_minutes} min, ou ${sport.min_minutes} min en version mini`}</h2></div></div>
        {ritual.status === 'petit-pas' && <p className={isTime ? '' : 'muted'}>{ritual.minutes} min déjà faites : encore {Math.max(0, (sport.min_minutes ?? 10) - ritual.minutes)} min pour honorer ton rendez-vous.</p>}
        {sport.place && <p className={isTime ? '' : 'muted'} style={{ fontSize: '.9rem' }}>Lieu : {sport.place}{sport.fallback ? ` · Plan B : ${sport.fallback}` : ''}</p>}
        <button className={`btn ${isTime ? 'white' : 'primary'}`} onClick={() => navigate('/rituel')}>Préparer ma séance <IconChevron /></button>
      </section>
    )
  }
}
