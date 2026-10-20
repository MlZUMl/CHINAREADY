import { useEffect, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Confirm, Stepper, Toggle, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { currentSubscription, disablePush, enablePush, pushSupport } from '../lib/push'
import { IconBell, IconChevron, IconCloud } from '../ui/icons'
import { WEEKDAYS, toDay } from '../lib/dates'
import { EquipmentPicker } from './widgets'
import { GoalSheet } from './food-parts'
import { calorieGoal, fmtKcal } from '../domain/nutrition'
import { HYDRATION_TIMES } from '../domain/defaults'

export function Profile() {
  const { snap, actions, cloud, store, toast } = useApp()
  const p = snap.profiles[0]
  const energy = snap.energy_preferences[0]
  const notif = snap.notification_preferences[0]
  const sport = snap.commitments.find(c => c.kind === 'sport')
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wipe, setWipe] = useState(false)
  const [goal, setGoal] = useState(false)
  const goalInfo = calorieGoal(snap, toDay())
  useEffect(() => { currentSubscription().then(s => setSubscribed(Boolean(s))).catch(() => setSubscribed(false)) }, [])

  const togglePush = async (on: boolean) => {
    setPushError(null)
    if (!cloud.user) { navigate('/profil/compte'); return }
    setBusy(true)
    if (on) {
      const err = await enablePush(cloud.user.id)
      if (err) setPushError(err)
      else { await actions.updateNotifPrefs({ enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); setSubscribed(true); toast('🔔', 'Rappels activés sur ce téléphone') }
    } else {
      await disablePush(cloud.user.id)
      await actions.updateNotifPrefs({ enabled: false })
      setSubscribed(false)
    }
    setBusy(false)
  }

  const exportData = () => {
    const blob = new Blob([actions.exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `elan-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  if (!p || !energy || !notif) return null
  const support = pushSupport()
  return (
    <>
      <TopBar onBack title="Profil et réglages" />
      <main className="content no-tabs">
        <section className="card">
          <label className="field">Prénom<input className="input" defaultValue={p.display_name ?? ''} onBlur={e => actions.updateProfile({ display_name: e.target.value.trim() || null })} /></label>
        </section>

        <button className="card" style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/profil/compte')}>
          <div className="card-head"><span className="emoji-bubble" aria-hidden="true"><IconCloud style={{ width: 22, color: 'var(--prune)' }} /></span>
            <div><div className="kicker">Compte et sauvegarde</div><strong>{cloud.user ? cloud.user.email : cloud.configured ? 'Non connectée : données sur ce téléphone uniquement' : 'Sauvegarde en ligne non configurée'}</strong>
              {cloud.user && <div className="muted small">{cloud.status === 'pret' ? 'Synchronisé' : cloud.status === 'en-cours' ? 'Synchronisation…' : cloud.status === 'hors-ligne' ? 'Hors ligne : envoi dès le retour du réseau' : cloud.status === 'erreur' ? 'Erreur de synchronisation' : ''}{cloud.pending ? ` · ${cloud.pending} modification${cloud.pending > 1 ? 's' : ''} en attente` : ''}</div>}</div>
            <IconChevron style={{ width: 18 }} /></div>
        </button>

        <button className="card" style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/profil/engagements')}>
          <div className="card-head"><span className="emoji-bubble" aria-hidden="true">🤝</span>
            <div><div className="kicker">Mes engagements</div><strong>{sport ? `Rendez-vous à ${sport.cue_time?.replace(':', ' h ')} · ${sport.min_minutes} à ${sport.usual_minutes} min` : 'Définir mes engagements'}</strong>
              <div className="muted small">Moment, lieu, version minimale, habituelle et plan B</div></div>
            <IconChevron style={{ width: 18 }} /></div>
        </button>

        <section className="card">
          <div className="card-head"><span className="emoji-bubble" aria-hidden="true"><IconBell style={{ width: 22, color: 'var(--prune)' }} /></span><div><h2>Rappels</h2></div></div>
          {support === 'non-supporte' && <div className="banner">Ce navigateur ne gère pas les notifications. Ouvre Élan dans Chrome sur Android, puis « Ajouter à l'écran d'accueil ».</div>}
          {support === 'refuse' && <div className="banner">Les notifications sont bloquées pour ce site. Dans Chrome : cadenas à gauche de l'adresse → Autorisations → Notifications → Autoriser.</div>}
          <Toggle label="Recevoir des notifications sur ce téléphone" hint={cloud.user ? 'Elles arrivent même quand l\'appli est fermée.' : 'Nécessite un compte (gratuit) : touche pour le créer.'}
            checked={Boolean(notif.enabled && subscribed)} onChange={v => !busy && togglePush(v)} />
          {pushError && <div className="banner">{pushError}</div>}
          <div className="divider" />
          <Toggle label="Rappel de mon rendez-vous sportif" hint={sport ? `${sport.days.map(d => WEEKDAYS[d - 1].slice(0, 3)).join(', ')} à ${sport.cue_time}` : undefined} checked={notif.ritual} onChange={v => actions.updateNotifPrefs({ ritual: v })} />
          <Toggle label="Rappels d'eau (5 par jour)" hint={notif.hydration_times.map(t => t.replace(':', ' h ')).join(' · ')} checked={notif.hydration} onChange={v => actions.updateNotifPrefs({ hydration: v, hydration_times: v && notif.hydration_times.length < 5 ? [...HYDRATION_TIMES] : notif.hydration_times })} />
          <Toggle label="Ouverture de mes capsules" checked={notif.capsules} onChange={v => actions.updateNotifPrefs({ capsules: v })} />
          <Toggle label="Rappel mensuel de capsule" hint="Le 1er de chaque mois" checked={notif.monthly_capsule} onChange={v => actions.updateNotifPrefs({ monthly_capsule: v })} />
          <Toggle label="Bilan de la semaine" hint="Le dimanche à 18 h" checked={notif.weekly_review} onChange={v => actions.updateNotifPrefs({ weekly_review: v })} />
          <strong className="small">Ton des messages</strong>
          <Chips label="Ton des messages" value={notif.tone} onChange={v => v && actions.updateNotifPrefs({ tone: v })} options={[
            { id: 'auto', label: 'Selon mon énergie' }, { id: 'direct', label: 'Direct' }, { id: 'doux', label: 'Doux' },
          ]} />
          <p className="muted small">« Selon mon énergie » : direct les jours en forme, doux les jours fatigués. Le rituel reste utilisable sans aucune notification.</p>
          {cloud.user && notif.enabled && subscribed && <button className="btn ghost sm" onClick={async () => { await actions.testPush(); toast('📨', 'Notification de test envoyée : elle arrive dans la minute') }}>Envoyer une notification de test</button>}
        </section>

        <section className="card">
          <h2>Journée sans énergie</h2>
          <Toggle label="Adapter mes séances à mon énergie" hint="Le check-in du jour ajuste la durée et l'intensité proposées. Il ne touche jamais à l'alimentation." checked={energy.enabled} onChange={v => actions.updateEnergyPrefs({ enabled: v })} />
          <Toggle label="Moins de notifications les jours d'épuisement" checked={energy.quiet_when_low} onChange={v => actions.updateEnergyPrefs({ quiet_when_low: v })} />
          <Toggle label="Version douce mise en avant pendant mes règles" checked={Boolean(p.settings.gentle_on_period)} onChange={v => actions.updateProfile({ settings: { ...p.settings, gentle_on_period: v } })} />
          {(p.settings.minimum_weekdays?.length ?? 0) > 0 && (
            <div className="row between"><span className="small">Version minimale d'office le {p.settings.minimum_weekdays!.map(d => WEEKDAYS[d - 1]).join(', ')}</span>
              <button className="link-btn" onClick={() => actions.updateProfile({ settings: { ...p.settings, minimum_weekdays: [] } })}>Retirer</button></div>
          )}
        </section>

        <section className="card">
          <h2>Objectifs</h2>
          <div className="row between"><span>Eau par jour</span><Stepper label="Objectif d'eau" value={p.water_goal_ml ?? 2000} min={1000} max={4000} step={100} onChange={v => actions.updateProfile({ water_goal_ml: v, water_goal_glasses: Math.max(1, Math.min(20, Math.round(v / 250))) })} format={v => (v / 1000).toFixed(1).replace('.', ',') + ' L'} /></div>
          <div className="row between"><span>Calories par jour</span><button className="link-btn" onClick={() => setGoal(true)}>{goalInfo.goal ? fmtKcal(goalInfo.goal) : 'À définir'}</button></div>
          <div className="row between wrap"><span>Jour de pesée</span>
            <select className="input" style={{ width: 'auto' }} value={p.weigh_day} onChange={e => actions.updateProfile({ weigh_day: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select></div>
          <div className="row between"><span>Portions par défaut</span><Stepper label="Portions" value={p.portions} min={1} max={8} onChange={v => actions.updateProfile({ portions: v })} /></div>
          <strong className="small">Mon matériel</strong>
          <EquipmentPicker value={p.settings.equipment ?? []} onChange={v => actions.updateProfile({ settings: { ...p.settings, equipment: v } })} />
        </section>

        <section className="card">
          <h2>Confidentialité</h2>
          <p className="muted small">Tes données sont privées : sur ce téléphone et, si tu es connectée, dans ton espace Supabase protégé (personne d'autre ne peut les lire). Rien n'est partagé, aucune IA externe n'est utilisée.</p>
          <Toggle label="Analyse de mes habitudes" hint="Calculée sur ton téléphone, à partir de tes propres données" checked={p.analysis_consent} onChange={v => actions.updateProfile({ analysis_consent: v })} />
          <button className="btn secondary" onClick={exportData}>Télécharger mes données</button>
          <button className="btn danger" onClick={() => setWipe(true)}>Effacer les données de ce téléphone</button>
        </section>
        <p className="muted small" style={{ textAlign: 'center' }}>Élan · version 1.2</p>
      </main>
      {goal && <GoalSheet onClose={() => setGoal(false)} />}
      {wipe && <Confirm danger title="Effacer ce téléphone ?" confirmLabel="Tout effacer ici"
        text={cloud.user ? 'Les données de ce téléphone seront effacées et tu seras déconnectée. Ta sauvegarde en ligne reste intacte : reconnecte-toi pour tout récupérer.' : 'Sans compte, rien n\'est sauvegardé ailleurs : tout sera définitivement perdu.'}
        onClose={() => setWipe(false)} onConfirm={async () => { if (cloud.user) { await cloud.syncNow(); await cloud.signOut() } await store.wipe(); location.hash = '#/'; location.reload() }} />}
    </>
  )
}
