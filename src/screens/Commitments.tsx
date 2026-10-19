// Engagements : moment, lieu, version minimale, version habituelle et plan B.
// But : décider une fois, pour ne plus avoir à décider au moment d'agir.
import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Confirm, Sheet, Stepper, Toggle, TopBar } from '../ui/components'
import { addDays, WEEKDAYS } from '../lib/dates'
import { postponements } from '../domain/ritual'
import { IconPlus } from '../ui/icons'
import type { Commitment, CommitmentKind } from '../data/types'

const KIND_EMOJI: Record<CommitmentKind, string> = { sport: '🧘‍♀️', eau: '💧', repas: '🍽️', preparation: '👟', perso: '⭐' }
const DAY_OPTIONS = WEEKDAYS.map((d, i) => ({ id: i + 1, label: d.slice(0, 3).replace(/^./, c => c.toUpperCase()) }))

export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 7) return 'Tous les jours'
  if (sorted.join() === '1,2,3,4,5') return 'Du lundi au vendredi'
  if (sorted.join() === '6,7') return 'Le week-end'
  return 'Le ' + sorted.map(d => WEEKDAYS[d - 1]).join(', ')
}

/** La phrase d'engagement complète, telle qu'on se la dirait à soi-même. */
export function commitmentSentence(c: Pick<Commitment, 'days' | 'cue_time' | 'place' | 'min_label' | 'usual_label' | 'fallback'>): string {
  const when = `${daysLabel(c.days)}${c.cue_time ? `, à ${c.cue_time.replace(':', ' h ')}` : ''}${c.place ? `, ${c.place.toLowerCase().startsWith('au ') || c.place.toLowerCase().startsWith('à ') ? c.place : 'lieu : ' + c.place}` : ''}`
  return `${when} : au minimum ${lowerFirst(c.min_label)} ; d'habitude, ${lowerFirst(c.usual_label)}.${c.fallback ? ` En cas d'imprévu : ${lowerFirst(c.fallback)}.` : ''}`
}
const lowerFirst = (t: string) => t ? t[0].toLowerCase() + t.slice(1) : t

export function CommitmentsScreen() {
  const { snap, today } = useApp()
  const [edit, setEdit] = useState<Commitment | 'new' | null>(null)
  const list = [...snap.commitments].sort((a, b) => a.sort - b.sort)
  const post = postponements(snap, addDays(today, -13), today)
  const slipping = post.reports + post.noDesire >= 3

  return (
    <>
      <TopBar onBack title="Mes engagements" />
      <main className="content no-tabs">
        <p className="muted">Un engagement précis enlève une décision au moment d'agir : quand, où, la version minimale pour les jours difficiles, la version habituelle, et un plan B.</p>
        {slipping && (
          <div className="banner">
            <span>Ces deux dernières semaines, ton rendez-vous a été reporté ou laissé {post.reports + post.noDesire} fois. Plutôt que de baisser l'objectif, l'horaire ou la préparation sont peut-être à revoir : à toi de juger.</span>
          </div>
        )}
        {list.map(c => (
          <button key={c.id} className="card" style={{ border: 0, textAlign: 'left', cursor: 'pointer', opacity: c.active ? 1 : 0.6 }} onClick={() => setEdit(c)}>
            <div className="card-head">
              <span className="emoji-bubble" aria-hidden="true">{KIND_EMOJI[c.kind]}</span>
              <div><div className="kicker">{c.active ? 'Actif' : 'En pause'}</div><strong>{c.title}</strong></div>
              <span className="link-btn">Modifier</span>
            </div>
            <p className="muted small">{commitmentSentence(c)}</p>
          </button>
        ))}
        <button className="btn secondary" onClick={() => setEdit('new')}><IconPlus /> Ajouter un engagement</button>
      </main>
      {edit && <CommitmentSheet commitment={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function CommitmentSheet({ commitment, onClose }: { commitment: Commitment | null; onClose: () => void }) {
  const { snap, actions, toast } = useApp()
  const c = commitment
  const kind: CommitmentKind = c?.kind ?? 'perso'
  const isSport = kind === 'sport'
  const builtIn = c ? ['sport', 'eau', 'repas'].includes(c.kind) : false
  const [title, setTitle] = useState(c?.title ?? '')
  const [days, setDays] = useState<number[]>(c?.days ?? [1, 2, 3, 4, 5])
  const [hasTime, setHasTime] = useState(c ? Boolean(c.cue_time) || c.kind === 'sport' : true)
  const [time, setTime] = useState(c?.cue_time ?? '18:00')
  const [place, setPlace] = useState(c?.place ?? '')
  const [minMinutes, setMinMinutes] = useState(c?.min_minutes ?? 10)
  const [usualMinutes, setUsualMinutes] = useState(c?.usual_minutes ?? 20)
  const [minLabel, setMinLabel] = useState(c?.min_label ?? '')
  const [usualLabel, setUsualLabel] = useState(c?.usual_label ?? '')
  const [fallback, setFallback] = useState(c?.fallback ?? '')
  const [active, setActive] = useState(c?.active ?? true)
  const [del, setDel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const t = title.trim()
    if (!t) { setError('Donne un nom à ton engagement.'); return }
    if (!days.length) { setError('Choisis au moins un jour.'); return }
    if (!minLabel.trim() && !isSport) { setError('Décris ta version minimale : c\'est elle qui te garde dans le rythme.'); return }
    const min = isSport ? Math.min(minMinutes, usualMinutes) : null
    const usual = isSport ? usualMinutes : null
    const row: Omit<Commitment, 'created_at' | 'updated_at'> = {
      id: c?.id ?? 'perso-' + Date.now().toString(36),
      kind, title: t, cue_time: hasTime ? time : null, days: [...days].sort((a, b) => a - b), place: place.trim() || null,
      min_label: isSport ? (minLabel.trim() || `${min} minutes de marche ou de mouvement doux`) : minLabel.trim(),
      min_minutes: min,
      usual_label: isSport ? (usualLabel.trim() || `Ma séance de ${usual} minutes`) : (usualLabel.trim() || minLabel.trim()),
      usual_minutes: usual,
      fallback: fallback.trim() || null, active, sort: c?.sort ?? snap.commitments.length,
    }
    await actions.saveCommitment(row)
    toast('🤝', 'Engagement enregistré')
    onClose()
  }

  const preview = commitmentSentence({
    days, cue_time: hasTime ? time : null, place: place.trim() || null,
    min_label: isSport ? (minLabel.trim() || `${Math.min(minMinutes, usualMinutes)} minutes de mouvement doux`) : (minLabel.trim() || '…'),
    usual_label: isSport ? (usualLabel.trim() || `ma séance de ${usualMinutes} minutes`) : (usualLabel.trim() || minLabel.trim() || '…'),
    fallback: fallback.trim() || null,
  })

  return (
    <Sheet title={c ? 'Modifier l\'engagement' : 'Nouvel engagement'} onClose={onClose}>
      <label className="field">Nom
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. : Étirements du soir" />
      </label>
      <div className="stack"><strong className="small">Quels jours ?</strong>
        <Chips label="Jours" multi value={days} onChange={setDays} options={DAY_OPTIONS} /></div>
      {!isSport && <Toggle label="À une heure précise" hint="Facultatif" checked={hasTime} onChange={setHasTime} />}
      {hasTime && <label className="field">{isSport ? 'Heure du rendez-vous (et du rappel)' : 'Heure'}<input className="input" type="time" value={time} onChange={e => setTime(e.target.value || time)} /></label>}
      <label className="field">Où, ou après quoi ? <span className="hint">Le contexte déclenche l'habitude : « au salon », « après le travail »…</span>
        <input className="input" value={place} onChange={e => setPlace(e.target.value)} />
      </label>
      {isSport ? (
        <div className="card flat">
          <div className="row between"><div><strong>Version habituelle</strong><div className="muted small">Ta séance normale</div></div>
            <Stepper label="Durée habituelle" value={usualMinutes} min={10} max={60} step={5} onChange={v => { setUsualMinutes(v); if (minMinutes > v) setMinMinutes(v) }} format={v => v + ' min'} /></div>
          <div className="divider" />
          <div className="row between"><div><strong>Version minimale</strong><div className="muted small">Pour les jours difficiles</div></div>
            <Stepper label="Durée minimale" value={minMinutes} min={5} max={usualMinutes} step={5} onChange={setMinMinutes} format={v => v + ' min'} /></div>
          <label className="field">Ma version minimale, en mots <span className="hint">Facultatif</span>
            <input className="input" value={minLabel} onChange={e => setMinLabel(e.target.value)} placeholder={`${minMinutes} minutes de marche ou de mouvement doux`} /></label>
          <p className="muted small">La version minimale garde le lien les jours difficiles ; la version habituelle reste ton objectif.</p>
        </div>
      ) : (
        <>
          <label className="field">Version minimale <span className="hint">Le plus petit geste qui compte</span>
            <input className="input" value={minLabel} onChange={e => setMinLabel(e.target.value)} placeholder="Ex. : 2 minutes d'étirements" /></label>
          <label className="field">Version habituelle <span className="hint">Facultatif</span>
            <input className="input" value={usualLabel} onChange={e => setUsualLabel(e.target.value)} placeholder="Ex. : 10 minutes d'étirements" /></label>
        </>
      )}
      <label className="field">Plan B en cas d'imprévu <span className="hint">Facultatif</span>
        <input className="input" value={fallback} onChange={e => setFallback(e.target.value)} placeholder={isSport ? 'Ex. : Ring Fit ou une marche de 10 minutes' : 'Ex. : le faire juste avant de dormir'} /></label>
      <div className="banner" style={{ background: 'var(--poudre)', color: 'var(--prune-fonce)' }}><span><strong>Mon engagement : </strong>{preview}</span></div>
      <Toggle label="Engagement actif" hint="En pause, il n'apparaît plus dans ta journée ; son historique est conservé." checked={active} onChange={setActive} />
      {error && <div className="banner">{error}</div>}
      <div className="grid2">
        {c && !builtIn ? <button className="btn danger" onClick={() => setDel(true)}>Supprimer</button> : <button className="btn ghost" onClick={onClose}>Annuler</button>}
        <button className="btn primary" onClick={save}>Enregistrer</button>
      </div>
      {del && c && <Confirm danger title="Supprimer cet engagement ?" confirmLabel="Supprimer" text="Ses coches disparaissent avec lui. Tes badges et tes points restent acquis. Tu peux aussi simplement le mettre en pause."
        onClose={() => setDel(false)} onConfirm={async () => { await actions.deleteCommitment(c.id); setDel(false); onClose() }} />}
    </Sheet>
  )
}
