// Composants partagés entre écrans.
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { CompanionArt } from '../art/Companion'
import { messageFor, moodFor, nextActionHint, memoryOf } from '../domain/companion'
import { Chips, EnergyScale, Sheet, Stepper } from '../ui/components'
import { NEED_LABELS } from '../domain/recommend'
import { addDays, isoWeekday, toDay, weekStart, type Day, parseDay, nowIso } from '../lib/dates'
import { dayRitual } from '../domain/ritual'
import { waterMl, waterGoalMl, waterReached, hasFoodOn, entryMl, formatLitres } from '../domain/discipline'
import { cycleInfo, predictedPeriod } from '../domain/body'
import { missionDef } from '../domain/missions'
import { navigate } from '../lib/router'
import { EXTERNAL_ACTIVITIES, EQUIPMENT } from '../domain/exercises'
import type { Need, WaterLog, Equipment } from '../data/types'
import { IconDrop, IconSparkle } from '../ui/icons'

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
        const water = waterReached(snap, d)
        const meals = hasFoodOn(snap, d)
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

// ------------------------------------------------------------------ eau (litres)
export const WATER_QUICK = [150, 250, 330, 500]
const cl = (ml: number) => `${Math.round(ml / 10)} cl`

export function WaterWidget({ day, compact = false }: { day: Day; compact?: boolean }) {
  const { snap, actions, toast } = useApp()
  const ml = waterMl(snap, day)
  const goal = waterGoalMl(snap)
  const [custom, setCustom] = useState(false)
  const [edit, setEdit] = useState<WaterLog | null>(null)
  const entries = snap.water_logs.filter(w => w.day === day).sort((a, b) => a.at.localeCompare(b.at))
  const add = async (amount: number) => {
    const before = ml
    await actions.addWater(day, amount)
    if (before < goal && before + amount >= goal) toast('💧', 'Objectif d\'eau atteint, bravo !')
  }
  return (
    <section className="card" aria-label="Hydratation">
      <div className="card-head">
        <span className="emoji-bubble" style={{ background: '#e3eff1' }} aria-hidden="true"><IconDrop style={{ width: 22, color: 'var(--nuit)' }} /></span>
        <div><div className="kicker">Eau</div><strong data-testid="eau-total">{formatLitres(ml)} sur {formatLitres(goal, 1)}</strong></div>
        <span className="small muted">{goal > ml ? `encore ${formatLitres(goal - ml)}` : 'objectif atteint'}</span>
      </div>
      <div className="water-bar" role="progressbar" aria-label="Eau bue" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={ml}><div style={{ width: Math.min(100, (ml / goal) * 100) + '%' }} /></div>
      <div className="water-quick" role="group" aria-label="Ajouter de l'eau">
        {WATER_QUICK.map(q => <button key={q} onClick={() => add(q)} aria-label={`Ajouter ${formatLitres(q)}`}>{formatLitres(q)}</button>)}
        <button onClick={() => setCustom(true)} aria-label="Autre quantité">Autre</button>
      </div>
      {!compact && entries.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Touche une entrée pour la modifier ou la supprimer.</span>
          <div className="water-list">
            {entries.map(w => (
              <button key={w.id} onClick={() => setEdit(w)} aria-label={`Modifier ${cl(entryMl(w))} de ${hhmm(w.at)}`}>{hhmm(w.at)} · {cl(entryMl(w))}</button>
            ))}
          </div>
        </div>
      )}
      {custom && <WaterAmountSheet title="Autre quantité" initial={200} onClose={() => setCustom(false)} onSave={async v => { await add(v); setCustom(false) }} />}
      {edit && <WaterAmountSheet title={`Eau de ${hhmm(edit.at)}`} initial={entryMl(edit)} onClose={() => setEdit(null)}
        onSave={async v => { await actions.updateWater(edit.id, v); setEdit(null) }} onDelete={async () => { await actions.deleteWater(edit.id); setEdit(null) }} />}
    </section>
  )
}

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}` }

function WaterAmountSheet({ title, initial, onSave, onClose, onDelete }: { title: string; initial: number; onSave: (ml: number) => void; onClose: () => void; onDelete?: () => void }) {
  const [v, setV] = useState(String(Math.round(initial / 10)))
  const n = Number(v.replace(',', '.'))
  const ok = Number.isFinite(n) && n >= 1 && n <= 300
  return (
    <Sheet title={title} onClose={onClose}>
      <label className="field">Quantité en centilitres <span className="hint">25 cl = un verre, 50 cl = une petite bouteille</span>
        <input className="input big-input" inputMode="decimal" value={v} onChange={e => setV(e.target.value)} aria-label="Quantité en centilitres" />
      </label>
      <div className="chips">{[15, 20, 25, 33, 50, 75, 100].map(c => <button key={c} type="button" className={`chip soft ${n === c ? 'on' : ''}`} onClick={() => setV(String(c))}>{c} cl</button>)}</div>
      <div className="grid2">
        {onDelete ? <button className="btn danger" onClick={onDelete}>Supprimer</button> : <button className="btn ghost" onClick={onClose}>Annuler</button>}
        <button className="btn primary" disabled={!ok} onClick={() => onSave(Math.round(n * 10))}>Enregistrer</button>
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
        {sortedActivities(snap.profiles[0]?.settings.equipment ?? []).map(a => (
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

/** Activités libres : celles dont le matériel est coché passent en premier. */
function sortedActivities(eq: Equipment[]) {
  const owned = (id: string) => (id === 'ring_fit' || id === 'velo' || id === 'velo_appart' || id === 'corde') ? eq.includes(id as Equipment) : null
  return [...EXTERNAL_ACTIVITIES].sort((a, b) => Number(owned(b.id) === true) - Number(owned(a.id) === true))
}

// ------------------------------------------------------------------ matériel
/** Choix du matériel : tuiles bien visibles (coche + bordure) et récapitulatif avant validation. */
export function EquipmentPicker({ value, onChange }: { value: Equipment[]; onChange: (v: Equipment[]) => void }) {
  const toggle = (id: Equipment) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  return (
    <div className="stack">
      <div className="species-grid" role="group" aria-label="Mon matériel">
        {EQUIPMENT.map(e => (
          <button key={e.id} type="button" className={value.includes(e.id) ? 'on' : ''} aria-pressed={value.includes(e.id)} onClick={() => toggle(e.id)}>
            <span style={{ fontSize: '1.9rem' }} aria-hidden="true">{e.emoji}</span>
            <span>{e.label}</span>
            <span className="muted" style={{ fontSize: '.7rem', fontWeight: 700 }}>{e.hint}</span>
          </button>
        ))}
      </div>
      <div className="equip-summary" aria-live="polite" data-testid="recap-materiel">
        {value.length ? <><strong>Ton matériel :</strong> {EQUIPMENT.filter(e => value.includes(e.id)).map(e => e.label).join(', ')}.<br /><span className="muted small">{equipmentEffect(value)}</span></>
          : <><strong>Aucun matériel :</strong> <span className="muted small">les séances utiliseront seulement le poids du corps.</span></>}
      </div>
    </div>
  )
}

export function equipmentEffect(eq: Equipment[]): string {
  const parts: string[] = []
  if (eq.includes('tapis')) parts.push('exercices au sol')
  if (eq.includes('elastique') || eq.includes('halteres')) parts.push('renforcement avec ' + [eq.includes('elastique') ? 'élastiques' : '', eq.includes('halteres') ? 'haltères' : ''].filter(Boolean).join(' et '))
  if (eq.includes('corde')) parts.push('cardio à la corde')
  if (eq.includes('velo_appart')) parts.push('cardio sur le vélo d\'appartement')
  const libres = [eq.includes('ring_fit') ? 'Ring Fit' : '', eq.includes('velo') ? 'vélo' : ''].filter(Boolean)
  const s = parts.length ? `Les séances guidées incluront : ${parts.join(', ')}.` : 'Séances guidées au poids du corps.'
  return libres.length ? `${s} ${libres.join(' et ')} : proposé${libres.length > 1 ? 's' : ''} en premier dans les activités libres.` : s
}
