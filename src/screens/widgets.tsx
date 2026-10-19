// Composants partagés entre écrans.
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { CompanionArt } from '../art/Companion'
import { messageFor, moodFor, nextActionHint, memoryOf } from '../domain/companion'
import { Chips, EnergyScale, Sheet, Stepper } from '../ui/components'
import { NEED_LABELS } from '../domain/recommend'
import { addDays, isoWeekday, toDay, weekStart, type Day, parseDay, nowIso } from '../lib/dates'
import { dayRitual } from '../domain/ritual'
import { waterGlasses, waterGoal } from '../domain/discipline'
import { cycleInfo, predictedPeriod } from '../domain/body'
import { missionDef } from '../domain/missions'
import { navigate } from '../lib/router'
import { EXTERNAL_ACTIVITIES } from '../domain/exercises'
import type { Meal, MealMarker, MealMoment, Need } from '../data/types'
import { RECIPES } from '../domain/recipes'
import { IconDrop, IconMinus, IconPlus, IconSparkle } from '../ui/icons'

// ------------------------------------------------------------------ compagnon
export function CompanionCard() {
  const { snap, actions, today } = useApp()
  const comp = snap.companion_profiles[0]
  const [nudge, setNudge] = useState(0)
  const [extra, setExtra] = useState<string | null>(null)
  const mood = useMemo(() => moodFor(snap), [snap])
  if (!comp) return null
  const msg = messageFor(comp.species, mood, snap.companion_interactions, today, nudge)
  const discreet = comp.frequency === 'discret'

  const tap = () => {
    setExtra(null)
    setNudge(n => n + 1)
    actions.recordInteraction(mood.context, msg.key, msg.expression)
  }
  return (
    <section className="stack" aria-label="Ton compagnon">
      <div className="companion">
        <button className="avatar-wrap" onClick={tap} aria-label={`Toucher ${comp.name}`}>
          <CompanionArt species={comp.species} expression={msg.expression} color={comp.color} accessories={comp.accessories} size={96} className="bob" />
        </button>
        <div className="bubble" aria-live="polite">
          <span className="who">{comp.name}</span>
          {extra ?? (discreet && nudge === 0 ? 'Je suis là si besoin.' : msg.text)}
        </div>
      </div>
      <div className="chips" style={{ paddingLeft: 4 }}>
        <button className="chip soft" onClick={() => setExtra(nextActionHint(snap))}>Je fais quoi maintenant ?</button>
        <button className="chip soft" onClick={() => setExtra(memoryOf(snap, today + nudge) ?? 'Nos premiers souvenirs arrivent bientôt : chaque petit pas en crée un.')}>Un souvenir</button>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ check-in
export function CheckinCard({ compact = false }: { compact?: boolean }) {
  const { snap, actions, today } = useApp()
  const checkin = snap.daily_checkins.find(c => c.day === today)
  const enabled = snap.energy_preferences[0]?.enabled ?? true
  const [open, setOpen] = useState(false)
  if (!enabled) return null
  if (checkin?.energy && !open) {
    return (
      <button className="card flat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <div className="card-head"><div><div className="kicker">Check-in du jour</div>
          <strong>{['', 'Épuisée', 'Fatiguée', 'Moyennement en forme', 'En forme', 'Pleine d\'énergie'][checkin.energy]}</strong>
          {(checkin.minutes || checkin.need) && <span className="muted"> · {checkin.minutes ? `${checkin.minutes} min dispo` : ''}{checkin.minutes && checkin.need ? ' · ' : ''}{checkin.need ? NEED_LABELS[checkin.need] : ''}</span>}
        </div><span className="link-btn">Modifier</span></div>
      </button>
    )
  }
  return (
    <section className="card" aria-label="Check-in d'énergie">
      <div className="card-head"><div><div className="kicker">Facultatif</div><h2>Comment te sens-tu aujourd'hui ?</h2></div></div>
      <EnergyScale value={checkin?.energy ?? null} onChange={e => { setOpen(true); actions.saveCheckin(today, { energy: e as any }) }} />
      {(checkin?.energy || !compact) && (
        <>
          <strong className="small">Combien de temps as-tu aujourd'hui ?</strong>
          <Chips label="Temps disponible" soft value={checkin?.minutes ?? null} onChange={v => actions.saveCheckin(today, { minutes: v })}
            options={[5, 10, 15, 20, 30, 45].map(m => ({ id: m, label: m + ' min' }))} />
          <strong className="small">De quoi as-tu le plus besoin ?</strong>
          <Chips label="Besoin du jour" soft value={checkin?.need ?? null} onChange={(v: Need | null) => actions.saveCheckin(today, { need: v })}
            options={Object.entries(NEED_LABELS).map(([id, label]) => ({ id: id as Need, label }))} />
        </>
      )}
      {open && <button className="btn secondary sm" onClick={() => setOpen(false)}>C'est noté</button>}
    </section>
  )
}

// ------------------------------------------------------------------ mission du jour
export function MissionCard() {
  const { snap, actions, today } = useApp()
  const um = snap.user_missions.find(m => m.day === today)
  if (!um) return null
  const def = missionDef(um.mission_key)
  if (!def) return null
  if (um.status === 'ignoree') return null
  const done = um.status === 'terminee'
  const hidden = um.mystery && um.status === 'disponible'
  return (
    <section className={`card ${um.mystery ? 'prune' : 'tint'}`} aria-label="Mission du jour">
      <div className="card-head">
        <span className="emoji-bubble" aria-hidden="true" style={um.mystery ? { background: 'rgba(255,255,255,.18)' } : undefined}>{done ? '🎉' : um.mystery ? '🔮' : '🎯'}</span>
        <div>
          <div className="kicker">{um.mystery ? 'Mission mystère' : 'Mission du jour'} · facultative</div>
          <h3>{hidden ? 'Aujourd\'hui, une petite action peut débloquer une surprise.' : def.name}</h3>
        </div>
      </div>
      {!hidden && <p className={um.mystery ? '' : 'muted'}>{done ? 'Réussie ! La récompense t\'attend dans ton univers.' : def.goal}</p>}
      {hidden && <p className="muted">L'objectif s'affiche dès que tu lances la mission. Rien de caché : seule la récompense est une surprise.</p>}
      {!done && (
        <div className="row">
          {um.status === 'disponible' && <button className={`btn sm ${um.mystery ? 'white' : 'primary'}`} onClick={() => actions.acceptMission(um.id)}>{um.mystery ? 'Découvrir la mission' : 'Je relève le défi'}</button>}
          {um.status === 'active' && <span className="pill">En cours · se valide toute seule quand c'est fait</span>}
          <button className={`btn sm ${um.mystery ? 'light' : 'ghost'}`} onClick={() => actions.ignoreMission(um.id)}>Pas aujourd'hui</button>
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ semaine (type Flo)
export function WeekStrip({ onDay }: { onDay?: (d: Day) => void }) {
  const { snap, today } = useApp()
  const ws = weekStart(today)
  const info = cycleInfo(snap.cycle_days)
  const predicted = new Set(predictedPeriod(info))
  const period = new Set(snap.cycle_days.filter(c => c.period).map(c => c.day))
  return (
    <div className="week-strip" role="list" aria-label="Ta semaine">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i)
        const r = dayRitual(snap, d, today)
        const water = waterGlasses(snap, d) >= waterGoal(snap)
        const meals = snap.meals.some(m => m.day === d)
        const cls = ['day-dot', d === today ? 'today' : '', r.status === 'honore' || r.status === 'petit-pas' || r.status === 'repos' ? r.status : '', period.has(d) ? 'period' : predicted.has(d) ? 'predicted' : ''].join(' ')
        return (
          <button key={d} role="listitem" onClick={() => (onDay ? onDay(d) : navigate('/progres?jour=' + d))}
            aria-label={`${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]} ${parseDay(d).getDate()} : ${r.status === 'honore' ? 'rendez-vous honoré' : r.status === 'repos' ? 'repos' : r.scheduled ? 'rendez-vous prévu' : 'pas de rendez-vous'}`}>
            <span className="wd">{['L', 'M', 'M', 'J', 'V', 'S', 'D'][isoWeekday(d) - 1]}</span>
            <span className={cls}>{parseDay(d).getDate()}</span>
            <span className="mini-dots">{water && <i className="eau" />}{meals && <i className="repas" />}</span>
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ eau
export function WaterWidget({ day }: { day: Day }) {
  const { snap, actions } = useApp()
  const n = waterGlasses(snap, day)
  const goal = waterGoal(snap)
  return (
    <section className="card" aria-label="Hydratation">
      <div className="card-head">
        <span className="emoji-bubble" style={{ background: '#e3f0f8' }} aria-hidden="true"><IconDrop style={{ width: 22, color: '#5a95c3' }} /></span>
        <div><div className="kicker">Eau</div><strong>{n} verre{n > 1 ? 's' : ''} sur {goal}</strong></div>
        <button className="icon-btn" aria-label="Retirer un verre" onClick={() => actions.removeWater(day)} disabled={!n}><IconMinus /></button>
        <button className="icon-btn" style={{ background: 'var(--prune)', color: '#fff' }} aria-label="Ajouter un verre" onClick={() => actions.addWater(day)}><IconPlus /></button>
      </div>
      <div className="glasses" aria-hidden="true">
        {Array.from({ length: Math.max(goal, n) }, (_, i) => <span key={i} className={`glass ${i < n ? 'full' : ''}`} />)}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ repas (sans chiffres)
export const MARKERS: { id: MealMarker; label: string }[] = [
  { id: 'proteines', label: 'Protéines' }, { id: 'legumes', label: 'Légumes' }, { id: 'feculents', label: 'Féculents' },
  { id: 'fruit', label: 'Fruit' }, { id: 'fait_maison', label: 'Fait maison' }, { id: 'plaisir', label: 'Plaisir' },
]
export const MOMENTS: { id: MealMoment; label: string }[] = [
  { id: 'matin', label: 'Matin' }, { id: 'midi', label: 'Midi' }, { id: 'gouter', label: 'Goûter' }, { id: 'soir', label: 'Soir' }, { id: 'autre', label: 'Autre' },
]

export function defaultMoment(): MealMoment {
  const h = new Date().getHours()
  return h < 11 ? 'matin' : h < 15 ? 'midi' : h < 18 ? 'gouter' : 'soir'
}

export function MealSheet({ day, meal, onClose, preset }: { day: Day; meal?: Meal; onClose: () => void; preset?: { title: string; recipe_id: string | null; markers: MealMarker[] } }) {
  const { snap, actions } = useApp()
  const [title, setTitle] = useState(meal?.title ?? preset?.title ?? '')
  const [moment, setMoment] = useState<MealMoment>(meal?.moment ?? defaultMoment())
  const [markers, setMarkers] = useState<MealMarker[]>(meal?.markers ?? preset?.markers ?? [])
  const [feeling, setFeeling] = useState<Meal['feeling']>(meal?.feeling ?? null)
  const [note, setNote] = useState(meal?.note ?? '')
  const [recipeId, setRecipeId] = useState<string | null>(meal?.recipe_id ?? preset?.recipe_id ?? null)
  const plan = snap.meal_plans.find(p => p.week_start === weekStart(day))
  const planned = (plan?.slots ?? []).filter(s => s.day === day).map(s => RECIPES.find(r => r.id === s.recipe_id)).filter(Boolean) as typeof RECIPES

  const save = async () => {
    await actions.saveMeal({ id: meal?.id, day, moment, title: title.trim() || 'Repas', recipe_id: recipeId, markers, feeling, note: note.trim() || null })
    onClose()
  }
  return (
    <Sheet title={meal ? 'Modifier le repas' : 'Noter un repas'} onClose={onClose}>
      <p className="muted small">Pas de chiffres, pas de calcul : juste garder le fil. Le nom du plat suffit.</p>
      {!meal && planned.length > 0 && (
        <div className="stack"><strong className="small">Prévu au menu aujourd'hui</strong>
          <div className="chips">{planned.map(r => <button key={r.id} className={`chip soft ${recipeId === r.id ? 'on' : ''}`} onClick={() => { setTitle(r.title); setRecipeId(r.id); setMarkers(r.markers) }}>{r.emoji} {r.title}</button>)}</div>
        </div>
      )}
      <label className="field">Qu'as-tu mangé ?
        <input className="input" value={title} onChange={e => { setTitle(e.target.value); if (recipeId) setRecipeId(null) }} placeholder="Ex. : poulet, riz et légumes" />
      </label>
      <div className="stack"><strong className="small">Moment</strong><Chips label="Moment du repas" value={moment} onChange={v => v && setMoment(v)} options={MOMENTS} /></div>
      <div className="stack"><strong className="small">Repères <span className="muted">(facultatif)</span></strong><Chips label="Repères" multi soft value={markers} onChange={setMarkers} options={MARKERS} /></div>
      <div className="stack"><strong className="small">Ressenti <span className="muted">(facultatif)</span></strong>
        <Chips label="Ressenti" soft value={feeling} onChange={setFeeling}
          options={[{ id: 'agreable', label: 'Agréable' }, { id: 'rassasiee', label: 'Rassasiée' }, { id: 'encore_faim', label: 'Encore faim' }, { id: 'trop', label: 'Trop mangé' }]} />
        {feeling === 'encore_faim' && <p className="muted small">C'est une information utile, pas un échec : un complément (fruit, yaourt, tartine) est tout à fait possible.</p>}
        {feeling === 'trop' && <p className="muted small">Ça arrive. Rien à compenser : le prochain repas se fait normalement.</p>}
      </div>
      <label className="field">Note <span className="hint">Facultatif</span>
        <input className="input" value={note} onChange={e => setNote(e.target.value)} />
      </label>
      <div className="grid2">
        {meal ? <button className="btn danger" onClick={async () => { await actions.deleteMeal(meal.id); onClose() }}>Supprimer</button> : <button className="btn ghost" onClick={onClose}>Annuler</button>}
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ activité faite ailleurs
export function ExternalActivitySheet({ onClose, source = 'libre', defaultMinutes = 20, day }: { onClose: (saved: boolean) => void; source?: 'libre' | 'rituel'; defaultMinutes?: number; day?: Day }) {
  const { actions, snap } = useApp()
  const [activity, setActivity] = useState<string>('ring_fit')
  const [minutes, setMinutes] = useState(defaultMinutes)
  const [date, setDate] = useState(day ?? toDay())
  const [note, setNote] = useState('')
  const sport = snap.commitments.find(c => c.kind === 'sport')
  const save = async () => {
    const end = date === toDay() ? new Date() : new Date(date + 'T18:00:00')
    const start = new Date(end.getTime() - minutes * 60_000)
    const min = sport?.min_minutes ?? 10, usual = sport?.usual_minutes ?? 20
    await actions.saveWorkout({
      day: date, started_at: start.toISOString(), ended_at: end.toISOString(), kind: 'externe', activity, program: null,
      planned_minutes: null, actual_minutes: minutes, version: minutes > usual ? 'plus' : minutes >= usual ? 'usual' : minutes >= min ? 'min' : 'libre',
      completed: true, source, energy: snap.daily_checkins.find(c => c.day === date)?.energy ?? null, note: note.trim() || null,
    })
    onClose(true)
  }
  return (
    <Sheet title="Noter une activité" onClose={() => onClose(false)}>
      <div className="species-grid">
        {EXTERNAL_ACTIVITIES.map(a => (
          <button key={a.id} className={activity === a.id ? 'on' : ''} onClick={() => setActivity(a.id)} aria-pressed={activity === a.id}>
            <span style={{ fontSize: '2rem' }} aria-hidden="true">{a.emoji}</span>{a.label}
          </button>
        ))}
      </div>
      <div className="row between"><strong>Durée</strong><Stepper label="Durée" value={minutes} min={5} max={180} step={5} onChange={setMinutes} format={v => v + ' min'} /></div>
      <label className="field">Jour<input className="input" type="date" value={date} max={toDay()} onChange={e => setDate(e.target.value || toDay())} /></label>
      <label className="field">Note <span className="hint">Facultatif</span><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex. : niveau 12 sur Ring Fit" /></label>
      <button className="btn primary block" onClick={save}><IconSparkle /> Enregistrer l'activité</button>
    </Sheet>
  )
}

export const iso = nowIso
