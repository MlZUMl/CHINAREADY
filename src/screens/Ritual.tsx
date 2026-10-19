import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, EnergyScale, Sheet, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { isoWeekday, hhmm } from '../lib/dates'
import { isRendezvousDay, sportCommitment, dayRitual } from '../domain/ritual'
import { recommend, ENERGY_LABELS, type SessionOption } from '../domain/recommend'
import { FOCUS_LABELS } from '../domain/exercises'
import { ExternalActivitySheet } from './widgets'
import { localNotification, currentSubscription } from '../lib/push'
import type { RestReason } from '../data/types'
import { IconClock, IconMoon, IconPlay } from '../ui/icons'

export function Ritual({ query }: { query: URLSearchParams }) {
  const { snap, today, actions, cloud, toast } = useApp()
  const sport = sportCommitment(snap)
  const checkin = snap.daily_checkins.find(c => c.day === today)
  const profile = snap.profiles[0]
  const [restOpen, setRestOpen] = useState(false)
  const [externalOpen, setExternalOpen] = useState(false)
  const [snoozeInfo, setSnoozeInfo] = useState<string | null>(null)

  useEffect(() => { actions.ritualEvent('ouvert') }, [actions])

  const periodToday = snap.cycle_days.some(c => c.day === today && c.period)
  const preferMinimum = Boolean(profile?.settings.minimum_weekdays?.includes(isoWeekday(today)) || (profile?.settings.gentle_on_period && periodToday))
  const rec = useMemo(() => recommend({
    checkin, sport, prefs: snap.energy_preferences[0], isRendezvousDay: isRendezvousDay(sport, today),
    tonePref: snap.notification_preferences[0]?.tone ?? 'auto', preferMinimum,
  }), [checkin, sport, snap.energy_preferences, snap.notification_preferences, today, preferMinimum])

  const start = (o: SessionOption, source = 'rituel') => {
    navigate(`/seance?min=${o.minutes}&focus=${o.focus}&version=${o.version}&source=${source}`)
  }
  const primary = rec.options[rec.primary]
  const short = rec.options.find(o => o.version === 'min') ?? rec.options[rec.options.length - 1]
  const done = dayRitual(snap, today, today).status === 'honore'

  // Bouton « Reporter de 15 min » de la notification : on reporte une fois, puis on nettoie l'adresse
  // (sinon un rechargement de la page reporterait à nouveau).
  const reportHandled = useRef(false)
  useEffect(() => {
    if (query.get('action') !== 'report' || reportHandled.current) return
    reportHandled.current = true
    navigate('/rituel', true)
    doSnooze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doSnooze() {
    const at = new Date(Date.now() + 15 * 60_000)
    const sub = cloud.user && snap.notification_preferences[0]?.enabled ? await currentSubscription() : null
    await actions.snooze(15, Boolean(sub))
    if (sub) {
      setSnoozeInfo(`C'est noté. Je te rappelle à ${hhmm(at).replace(':', ' h ')}, même si l'appli est fermée.`)
    } else {
      window.setTimeout(() => localNotification('C\'est reparti ?', 'Ton rendez-vous t\'attend. La version courte suffit.', '#/rituel'), 15 * 60_000)
      setSnoozeInfo(`C'est noté pour ${hhmm(at).replace(':', ' h ')}. Sans rappels activés, l'alerte ne s'affichera que si l'appli reste ouverte : active les notifications dans le profil pour la recevoir appli fermée.`)
    }
    toast('⏳', 'Rendez-vous reporté de 15 minutes')
  }

  return (
    <>
      <TopBar onBack title="Ma séance du jour" kicker={sport ? `Rendez-vous de ${sport.cue_time?.replace(':', ' h ')}` : undefined} />
      <main className="content no-tabs">
        {done && <div className="banner" style={{ background: '#e6efe3', color: '#4f6b4c' }}>Rendez-vous déjà honoré aujourd'hui. Une séance de plus compte en bonus.</div>}

        <section className="card">
          <div className="card-head"><div><div className="kicker">Ton énergie</div>
            <strong>{checkin?.energy ? ENERGY_LABELS[checkin.energy] : 'Pas encore indiquée'}</strong></div></div>
          {!checkin?.energy && <EnergyScale value={null} onChange={e => actions.saveCheckin(today, { energy: e as any })} />}
          <strong className="small">Temps disponible</strong>
          <Chips label="Temps disponible" soft value={checkin?.minutes ?? null} onChange={v => actions.saveCheckin(today, { minutes: v })}
            options={[5, 10, 15, 20, 30, 45].map(m => ({ id: m, label: m + ' min' }))} />
        </section>

        <section className="card tint">
          <h2>{rec.headline}</h2>
          <p className="muted">{rec.message}</p>
          <div className="list">
            {rec.options.map((o, i) => (
              <button key={o.id + o.minutes} className="list-item" style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => start(o)}>
                <span className="emoji-bubble" aria-hidden="true" style={i === rec.primary ? { background: 'var(--prune)', color: '#fff' } : undefined}>{o.minutes}′</span>
                <span className="grow">
                  <span className="title" style={{ display: 'block' }}>{o.label} {i === rec.primary && <span className="pill">Recommandée</span>}</span>
                  <span className="muted small">{FOCUS_LABELS[o.focus]} · {o.hint}</span>
                </span>
                <IconPlay style={{ width: 22, color: 'var(--prune)' }} />
              </button>
            ))}
          </div>
        </section>

        {snoozeInfo && <div className="banner"><IconClock /><span>{snoozeInfo}</span></div>}

        <div className="stack">
          <button className="btn primary block" onClick={() => primary && start(primary)}>Je commence ({primary?.minutes} min)</button>
          <div className="grid2">
            <button className="btn secondary" onClick={() => short && start(short)}>Séance courte</button>
            <button className="btn secondary" onClick={doSnooze}>Reporter de 15 min</button>
          </div>
          <div className="grid2">
            <button className="btn ghost" onClick={() => setExternalOpen(true)}>Autre activité</button>
            <button className="btn ghost" onClick={() => setRestOpen(true)}><IconMoon /> Repos aujourd'hui</button>
          </div>
        </div>
        <p className="muted small" style={{ textAlign: 'center' }}>Rien n'est imposé : tu choisis, et chaque option compte.</p>
      </main>
      {restOpen && <RestSheet onClose={() => setRestOpen(false)} onFive={() => start({ id: 'petit-pas', label: '5 minutes', minutes: 5, focus: 'mobilite', version: 'min', hint: '' })} />}
      {externalOpen && <ExternalActivitySheet source="rituel" defaultMinutes={sport?.usual_minutes ?? 20} onClose={saved => { setExternalOpen(false); if (saved) navigate('/', true) }} />}
    </>
  )
}

function RestSheet({ onClose, onFive }: { onClose: () => void; onFive: () => void }) {
  const { actions, toast } = useApp()
  const [step, setStep] = useState<'raison' | 'pas-envie'>('raison')
  const rest = async (reason: RestReason) => {
    await actions.ritualEvent('repos', reason)
    toast('🌙', 'Repos noté. Ton rendez-vous sera là demain.')
    onClose()
    navigate('/', true)
  }
  if (step === 'pas-envie') return (
    <Sheet title="Juste pas envie ?" onClose={onClose}>
      <p style={{ fontSize: '1.05rem' }}>Tu n'as pas besoin d'avoir envie. <strong>Commence par cinq minutes, puis décide</strong> si tu continues.</p>
      <p className="muted small">Si tu t'arrêtes après 5 minutes, c'est enregistré comme un petit pas : tu auras gardé le lien.</p>
      <button className="btn primary block" onClick={onFive}>Lancer 5 minutes</button>
      <button className="btn ghost block" onClick={() => rest('pas_envie')}>Repos quand même</button>
    </Sheet>
  )
  return (
    <Sheet title="Repos aujourd'hui" onClose={onClose}>
      <p className="muted">Le repos fait partie du plan. Qu'est-ce qui se passe aujourd'hui ?</p>
      <button className="btn secondary block" onClick={() => rest('epuisee')}>Je suis épuisée ou pas bien</button>
      <button className="btn secondary block" onClick={() => rest('imprevu')}>Un imprévu</button>
      <button className="btn ghost block" onClick={() => setStep('pas-envie')}>Je n'ai juste pas envie</button>
    </Sheet>
  )
}
