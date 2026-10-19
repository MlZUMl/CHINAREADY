import { useState } from 'react'
import { useApp } from '../app/state'
import { CompanionArt } from '../art/Companion'
import { SPECIES } from '../domain/companion'
import { Chips, Stepper } from '../ui/components'
import { WEEKDAYS_SHORT } from '../lib/dates'
import type { Species } from '../data/types'
import { AuthForm } from './Account'

export function Onboarding() {
  const { actions, cloud } = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [time, setTime] = useState('17:15')
  const [usual, setUsual] = useState(20)
  const [min, setMin] = useState(10)
  const [place, setPlace] = useState('Salon')
  const [species, setSpecies] = useState<Species>('chat')
  const [cname, setCname] = useState('')
  const [water, setWater] = useState(8)
  const [equipment, setEquipment] = useState<('elastique' | 'halteres' | 'tapis')[]>(['elastique', 'halteres', 'tapis'])
  const [saving, setSaving] = useState(false)

  const total = cloud.configured ? 6 : 5
  const finish = async () => {
    setSaving(true)
    await actions.completeOnboarding({
      name: name.trim() || null,
      ritual: { days: days.length ? [...days].sort((a, b) => a - b) : [1, 2, 3, 4, 5], time, usualMinutes: usual, minMinutes: Math.min(min, usual), place: place.trim() || 'Salon' },
      species, companionName: cname.trim() || SPECIES.find(s => s.id === species)!.defaultName, water, equipment,
    })
  }

  const next = () => setStep(s => s + 1)
  const dots = <div className="steps-dots" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>

  if (step === 0) return (
    <main className="onboarding">
      {dots}
      <div style={{ display: 'grid', placeItems: 'center', marginTop: 20 }}>
        <CompanionArt species="chat" expression="content" size={150} className="bob" />
      </div>
      <h1 style={{ fontSize: '2rem', textAlign: 'center' }}>Bienvenue dans Élan</h1>
      <p className="muted" style={{ textAlign: 'center', fontSize: '1.05rem' }}>
        Une appli pour construire une routine qui tient <strong>même les jours sans motivation</strong> : des rendez-vous concrets,
        une version minimale pour les jours difficiles, et un univers qui grandit avec tes habitudes.
      </p>
      <label className="field">Comment veux-tu que je t'appelle ? <span className="hint">Facultatif</span>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ton prénom" autoComplete="given-name" />
      </label>
      <div className="spacer" />
      <button className="btn primary block" onClick={next}>Commencer</button>
    </main>
  )

  if (step === 1) return (
    <main className="onboarding">
      {dots}
      <h1>Ton rendez-vous sportif</h1>
      <p className="muted">On fixe un moment précis, pour ne plus avoir à décider chaque jour. Tu pourras tout changer plus tard.</p>
      <div className="stack">
        <strong>Quels jours ?</strong>
        <Chips label="Jours du rendez-vous" multi value={days} onChange={setDays}
          options={WEEKDAYS_SHORT.map((l, i) => ({ id: i + 1, label: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i] || l }))} />
      </div>
      <label className="field">À quelle heure ?
        <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
      </label>
      <label className="field">Où ? <span className="hint">Le lieu aide à déclencher l'habitude</span>
        <input className="input" value={place} onChange={e => setPlace(e.target.value)} />
      </label>
      <div className="card flat">
        <div className="row between"><div><strong>Version habituelle</strong><div className="muted small">Ta séance normale</div></div>
          <Stepper label="Durée habituelle" value={usual} min={10} max={45} step={5} onChange={setUsual} format={v => v + ' min'} /></div>
        <div className="divider" />
        <div className="row between"><div><strong>Version minimale</strong><div className="muted small">Pour les jours difficiles</div></div>
          <Stepper label="Durée minimale" value={min} min={5} max={usual} step={5} onChange={setMin} format={v => v + ' min'} /></div>
        <p className="muted small">La version minimale n'est pas un échec : c'est elle qui te garde dans le rythme quand la journée est compliquée.</p>
      </div>
      <div className="spacer" />
      <button className="btn primary block" onClick={next} disabled={!days.length}>Continuer</button>
    </main>
  )

  if (step === 2) return (
    <main className="onboarding">
      {dots}
      <h1>Choisis ton compagnon</h1>
      <p className="muted">Il réagit à ce que tu fais vraiment. Jamais de reproche, jamais de pression.</p>
      <div className="species-grid">
        {SPECIES.map(s => (
          <button key={s.id} className={species === s.id ? 'on' : ''} onClick={() => { setSpecies(s.id); setCname('') }} aria-pressed={species === s.id}>
            <CompanionArt species={s.id} expression={species === s.id ? 'enthousiaste' : 'content'} size={72} />
            {s.label}
          </button>
        ))}
      </div>
      <p className="muted small">{SPECIES.find(s => s.id === species)!.label} : {SPECIES.find(s => s.id === species)!.trait}.</p>
      <label className="field">Son prénom
        <input className="input" value={cname} onChange={e => setCname(e.target.value)} placeholder={SPECIES.find(s => s.id === species)!.defaultName} />
      </label>
      <div className="spacer" />
      <button className="btn primary block" onClick={next}>Continuer</button>
    </main>
  )

  if (step === 3) return (
    <main className="onboarding">
      {dots}
      <h1>Eau et matériel</h1>
      <div className="card flat">
        <div className="row between"><div><strong>Objectif d'eau</strong><div className="muted small">En verres par jour</div></div>
          <Stepper label="Verres par jour" value={water} min={3} max={14} onChange={setWater} format={v => v + ' verres'} /></div>
      </div>
      <div className="stack">
        <strong>Ton matériel à la maison</strong>
        <Chips label="Matériel" multi value={equipment} onChange={setEquipment}
          options={[{ id: 'elastique', label: 'Élastiques' }, { id: 'halteres', label: 'Haltères' }, { id: 'tapis', label: 'Tapis de sol' }]} />
        <p className="muted small">Ring Fit, danse, vélo et marche se notent aussi comme séances.</p>
      </div>
      <div className="spacer" />
      <button className="btn primary block" onClick={next}>Continuer</button>
    </main>
  )

  if (step === 4 && cloud.configured) return (
    <main className="onboarding">
      {dots}
      <h1>Sauvegarde et rappels</h1>
      <p className="muted">Avec un compte, tes données sont sauvegardées en ligne (privées, visibles de toi seule) et les rappels de 17 h 15 arrivent même appli fermée.</p>
      {cloud.user ? (
        <div className="banner" style={{ background: '#e6efe3', color: '#4f6b4c' }}>Connectée : {cloud.user.email}</div>
      ) : <AuthForm compact />}
      <div className="spacer" />
      <button className="btn primary block" onClick={next}>{cloud.user ? 'Continuer' : 'Plus tard'}</button>
      {!cloud.user && <p className="muted small" style={{ textAlign: 'center' }}>Sans compte, tout reste sur ce téléphone. Tu pourras créer ton compte dans le profil.</p>}
    </main>
  )

  return (
    <main className="onboarding">
      {dots}
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <CompanionArt species={species} expression="fier" size={150} accessories={['noeud']} className="bob" />
      </div>
      <h1 style={{ textAlign: 'center' }}>C'est prêt{name ? `, ${name}` : ''} !</h1>
      <div className="card tint">
        <p><strong>Ton plan est simple :</strong></p>
        <p>• {days.length === 5 && days.every((d, i) => d === i + 1) ? 'Du lundi au vendredi' : 'Les jours choisis'}, à {time.replace(':', ' h ')} : ta séance de {usual} min, ou {Math.min(min, usual)} min les jours difficiles.</p>
        <p>• Un verre d'eau à la fois, jusqu'à {water}.</p>
        <p>• Tes repas notés sans compter, juste pour garder le fil.</p>
        <p>• Si tu rates un jour : tu reprends simplement le lendemain.</p>
      </div>
      <div className="spacer" />
      <button className="btn primary block" onClick={finish} disabled={saving}>Entrer dans mon univers</button>
    </main>
  )
}
