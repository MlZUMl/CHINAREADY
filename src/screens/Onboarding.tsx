import { useState } from 'react'
import { useApp } from '../app/state'
import { CompanionArt } from '../art/Companion'
import { SPECIES } from '../domain/companion'
import { Chips, Stepper } from '../ui/components'
import { WEEKDAYS_SHORT } from '../lib/dates'
import type { Species, Equipment } from '../data/types'
import { EquipmentPicker } from './widgets'
import { ACTIVITY, PACE, calorieGoal, fmtKcal } from '../domain/nutrition'
import { emptySnapshot } from '../data/empty'
import type { NutritionSettings } from '../data/types'
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
  const [water, setWater] = useState(2000)
  const [equipment, setEquipment] = useState<Equipment[]>(['tapis'])
  const [saving, setSaving] = useState(false)

  const total = cloud.configured ? 7 : 6
  const [nut, setNut] = useState<NutritionDraft>({ sex: 'F', birth: '', height: '', weight: '', activity: 'leger', pace: 'modere' })
  const finish = async () => {
    setSaving(true)
    await actions.completeOnboarding({
      name: name.trim() || null,
      ritual: { days: days.length ? [...days].sort((a, b) => a - b) : [1, 2, 3, 4, 5], time, usualMinutes: usual, minMinutes: Math.min(min, usual), place: place.trim() || 'Salon' },
      species, companionName: cname.trim() || SPECIES.find(s => s.id === species)!.defaultName, waterMl: water, equipment,
      nutrition: draftToSettings(nut),
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
        <div className="row between"><div><strong>Objectif d'eau</strong><div className="muted small">En litres par jour</div></div>
          <Stepper label="Litres par jour" value={water} min={1000} max={4000} step={100} onChange={setWater} format={v => (v / 1000).toFixed(1).replace('.', ',') + ' L'} /></div>
      </div>
      <div className="stack">
        <strong>Ton matériel à la maison</strong>
        <p className="muted small">Touche ce que tu as : une coche verte apparaît. Vérifie le récapitulatif avant de continuer.</p>
        <EquipmentPicker value={equipment} onChange={setEquipment} />
      </div>
      <div className="spacer" />
      <button className="btn primary block" onClick={next}>Valider ce matériel et continuer</button>
    </main>
  )

  if (step === 4) return (
    <main className="onboarding">
      {dots}
      <h1>Ton objectif calorique</h1>
      <p className="muted">Pour que ton journal des repas soit prêt tout de suite. Ces informations restent privées et tu pourras les changer à tout moment.</p>
      <NutritionStep value={nut} onChange={setNut} />
      <div className="spacer" />
      <button className="btn primary block" onClick={next}>{draftToSettings(nut) ? 'Continuer' : 'Plus tard'}</button>
    </main>
  )

  if (step === 5 && cloud.configured) return (
    <main className="onboarding">
      {dots}
      <h1>Sauvegarde et rappels</h1>
      <p className="muted">Avec un compte, tes données sont sauvegardées en ligne (privées, visibles de toi seule) et les rappels de 17 h 15 arrivent même appli fermée.</p>
      {cloud.user ? (
        <div className="banner" style={{ background: 'var(--mousse-clair)', color: 'var(--vert)' }}>Connectée : {cloud.user.email}</div>
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
        <p>• De l'eau tout au long de la journée, jusqu'à {(water / 1000).toFixed(1).replace('.', ',')} L.</p>
        <p>• Un journal des repas avec les calories, sans jamais d'objectif trop bas.</p>
        <p>• Si tu rates un jour : tu reprends simplement le lendemain.</p>
      </div>
      <div className="spacer" />
      <button className="btn primary block" onClick={finish} disabled={saving}>Entrer dans mon univers</button>
    </main>
  )
}

// ------------------------------------------------------------------ profil nutrition (facultatif)
export interface NutritionDraft { sex: 'F' | 'H'; birth: string; height: string; weight: string; activity: NonNullable<NutritionSettings['activity']>; pace: NonNullable<NutritionSettings['pace']> }

const num = (x: string) => { const n = Number(x.replace(',', '.')); return x.trim() && Number.isFinite(n) && n > 0 ? n : undefined }

export function draftToSettings(d: NutritionDraft): NutritionSettings | undefined {
  const birthYear = num(d.birth), heightCm = num(d.height), weightKg = num(d.weight)
  const year = new Date().getFullYear()
  if (!birthYear || birthYear < year - 100 || birthYear > year - 14 || !heightCm || heightCm < 120 || heightCm > 220 || !weightKg || weightKg < 30 || weightKg > 300) return undefined
  return { sex: d.sex, birthYear, heightCm, weightKg, activity: d.activity, pace: d.pace }
}

function NutritionStep({ value: v, onChange }: { value: NutritionDraft; onChange: (d: NutritionDraft) => void }) {
  const set = (patch: Partial<NutritionDraft>) => onChange({ ...v, ...patch })
  const settings = draftToSettings(v)
  const today = new Date().toISOString().slice(0, 10)
  const snap = emptySnapshot()
  const preview = settings ? calorieGoal({ ...snap, profiles: [{ id: 'profile', settings: { nutrition: settings } } as never] }, today) : null
  return (
    <div className="stack">
      <Chips label="Sexe" value={v.sex} onChange={x => x && set({ sex: x })} options={[{ id: 'F', label: 'Femme' }, { id: 'H', label: 'Homme' }]} />
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <label className="field small">Année de naissance<input className="input" inputMode="numeric" value={v.birth} onChange={e => set({ birth: e.target.value })} aria-label="Année de naissance" /></label>
        <label className="field small">Taille (cm)<input className="input" inputMode="numeric" value={v.height} onChange={e => set({ height: e.target.value })} aria-label="Taille en centimètres" /></label>
        <label className="field small">Poids (kg)<input className="input" inputMode="decimal" value={v.weight} onChange={e => set({ weight: e.target.value })} aria-label="Poids en kilos" /></label>
      </div>
      <strong className="small">Activité au quotidien</strong>
      <Chips label="Activité" value={v.activity} onChange={x => x && set({ activity: x })} options={Object.entries(ACTIVITY).map(([id, a]) => ({ id: id as NutritionDraft['activity'], label: a.label }))} />
      <p className="muted small">{ACTIVITY[v.activity].hint}</p>
      <strong className="small">Rythme</strong>
      <Chips label="Rythme" value={v.pace} onChange={x => x && set({ pace: x })} options={Object.entries(PACE).map(([id, p]) => ({ id: id as NutritionDraft['pace'], label: p.label }))} />
      <div className="equip-summary" aria-live="polite" data-testid="objectif-accueil">
        {preview?.goal ? <><strong>{fmtKcal(preview.goal)} par jour</strong><br /><span className="muted small">{preview.floored ? 'Relevé au plancher de sécurité. ' : ''}Il ne baisse jamais les jours de fatigue, et le sport n'est pas déduit.</span></>
          : <span className="muted small">Renseigne ton année de naissance, ta taille et ton poids pour voir ton objectif. Tu peux aussi passer cette étape.</span>}
      </div>
    </div>
  )
}
