// Progrès hors balance : poids (tendance), mensurations, sommeil et énergie, bilan du mois croisé.
import { useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Sheet, Stepper } from '../ui/components'
import { TrendLine } from '../ui/charts'
import { WeightChart } from './Charts'
import { weekStart, formatDayLong, type Day } from '../lib/dates'
import { trendSummary, weightTrend } from '../domain/body'
import { fmtKcal } from '../domain/nutrition'
import { ENERGY_LABELS } from '../domain/recommend'
import { IconBack, IconChevron, IconPlus } from '../ui/icons'
import type { BodyMeasurement } from '../data/types'
import {
  MEASURES, SLEEP_QUALITY, fmtDiff, fmtHours, lastMeasurement, measureChange, measureSeries, monthOf, monthReview, shiftMonth, sleepEnergy, type MeasureKey,
} from '../domain/wellbeing'
import { addDays } from '../lib/dates'

export function BodyPanel() {
  return (
    <>
      <MeasuresCard />
      <WeightCard />
      <SleepCard />
      <MonthCard />
    </>
  )
}

// ------------------------------------------------------------------ mensurations
function MeasuresCard() {
  const { snap } = useApp()
  const [open, setOpen] = useState<BodyMeasurement | 'new' | null>(null)
  const last = lastMeasurement(snap.body_measurements)
  const waist = measureSeries(snap.body_measurements, 'waist_cm')
  return (
    <section className="card" aria-label="Mensurations">
      <div className="card-head"><span className="emoji-bubble" aria-hidden="true">📏</span>
        <div><div className="kicker">Mensurations</div><h2>{last ? `Dernières mesures : ${formatDayLong(last.day)}` : 'Tes premières mesures'}</h2></div></div>
      {!last && <p className="muted small">Le mètre ruban montre souvent ce que la balance ne voit pas. Une fois par mois suffit, le matin, toujours au même endroit.</p>}
      {last && (
        <div className="measure-grid">
          {MEASURES.map(m => {
            const ch = measureChange(snap.body_measurements, m.key)
            if (!ch) return null
            return (
              <div key={m.key} className="measure" data-testid={`mesure-${m.key}`}>
                <span className="small muted">{m.short}</span>
                <strong>{String(ch.last.value).replace('.', ',')} cm</strong>
                {ch.count >= 2 && <span className={`small ${ch.diff < 0 ? 'down' : ''}`}>{fmtDiff(ch.diff, 'cm')} depuis le {formatDayLong(ch.first.day).split(' ').slice(1, 3).join(' ')}</span>}
              </div>
            )
          })}
        </div>
      )}
      {waist.length >= 2 && <TrendLine days={waist.slice(-10).map(p => p.day)} line={waist.slice(-10).map(p => p.value)} unit="cm" color="var(--mousse)" label="Évolution du tour de taille" />}
      <div className="row wrap">
        <button className="btn secondary sm" onClick={() => setOpen('new')}><IconPlus /> Noter mes mesures</button>
        {last && <button className="link-btn small" onClick={() => setOpen(last)}>Modifier les dernières</button>}
      </div>
      {open && <MeasureSheet initial={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function MeasureSheet({ initial, onClose }: { initial: BodyMeasurement | null; onClose: () => void }) {
  const { snap, today, actions, toast } = useApp()
  const day: Day = initial?.day ?? today
  const prev = initial ?? snap.body_measurements.find(x => x.day === today) ?? null
  const last = lastMeasurement(snap.body_measurements)
  const [vals, setVals] = useState<Record<MeasureKey, number | null>>(() => Object.fromEntries(MEASURES.map(m => [m.key, prev?.[m.key] != null ? Number(prev[m.key]) : null])) as Record<MeasureKey, number | null>)
  const save = async () => {
    await actions.saveMeasurements(day, vals)
    toast('📏', 'Mesures enregistrées')
    onClose()
  }
  return (
    <Sheet title={`Mesures du ${formatDayLong(day)}`} onClose={onClose}>
      <p className="muted small">Chaque mesure est facultative. Mesure-toi le matin, sans serrer le mètre ruban.</p>
      {MEASURES.map(m => {
        const v = vals[m.key]
        const ref = last?.[m.key] != null ? Number(last[m.key]) : m.start
        return (
          <div key={m.key} className="stack" style={{ gap: 4 }}>
            <div className="row between wrap">
              <strong>{m.label}</strong>
              {v === null
                ? <button className="chip" onClick={() => setVals({ ...vals, [m.key]: ref })} aria-label={`Ajouter ${m.label}`}><IconPlus style={{ width: 16 }} /> Ajouter</button>
                : <Stepper label={m.label} value={v} min={m.min} max={m.max} step={0.5} onChange={x => setVals({ ...vals, [m.key]: x })} format={x => String(x).replace('.', ',') + ' cm'} />}
            </div>
            <span className="hint small muted">{m.hint}{v !== null ? ' · ' : ''}{v !== null && <button className="link-btn small" onClick={() => setVals({ ...vals, [m.key]: null })}>retirer</button>}</span>
          </div>
        )
      })}
      <button className="btn primary block" onClick={save} disabled={Object.values(vals).every(v => v === null) && !prev}>Enregistrer</button>
    </Sheet>
  )
}


// ------------------------------------------------------------------ poids
export function WeightCard() {
  const { snap, today, actions, toast } = useApp()
  const trend = weightTrend(snap.weights)
  const summary = trendSummary(trend)
  const lastWeight = trend[trend.length - 1]
  const weighDay = snap.profiles[0]?.weigh_day ?? 1
  const thisWeek = snap.weights.find(w => w.day >= weekStart(today) && w.day <= today)
  const [kg, setKg] = useState(lastWeight?.kg ?? 60)
  const [editing, setEditing] = useState(false)
  return (
    <>
      <section className="card">
        <div className="card-head"><div><div className="kicker">Pesée hebdomadaire · le {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][weighDay - 1]}</div>
          <h2>{lastWeight ? `Tendance : ${lastWeight.trend} kg` : 'Pas encore de pesée'}</h2></div></div>
        <p className="muted small">{summary ?? 'Une pesée par semaine suffit. La courbe lisse les variations d\'eau, normales d\'un jour à l\'autre.'}</p>
        <WeightChart />
        {thisWeek && !editing ? (
          <div className="row between"><span className="small">Cette semaine : <strong>{thisWeek.kg} kg</strong></span><button className="link-btn" onClick={() => { setKg(Number(thisWeek.kg)); setEditing(true) }}>Modifier</button></div>
        ) : (
          <div className="row between wrap">
            <Stepper label="Poids" value={kg} min={30} max={250} step={0.1} onChange={setKg} format={v => v.toFixed(1).replace('.', ',') + ' kg'} />
            <button className="btn primary sm" onClick={async () => { await actions.saveWeight(thisWeek?.day ?? today, Math.round(kg * 10) / 10); setEditing(false); toast('⚖️', 'Pesée notée') }}>Enregistrer</button>
          </div>
        )}
        <p className="muted small">Le poids n'est qu'un indicateur parmi d'autres : aucune récompense n'en dépend.</p>
      </section>
    </>
  )
}


// ------------------------------------------------------------------ sommeil & énergie
function SleepCard() {
  const { snap, today } = useApp()
  const [open, setOpen] = useState(false)
  const st = sleepEnergy(snap, addDays(today, -13), today)
  const tonight = snap.daily_checkins.find(c => c.day === today)
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const ck = new Map(snap.daily_checkins.map(c => [c.day, c]))
  return (
    <section className="card" aria-label="Sommeil et énergie">
      <div className="card-head"><span className="emoji-bubble" aria-hidden="true">🌙</span>
        <div><div className="kicker">Sommeil et énergie · 14 jours</div>
          <h2>{st.sleepAvg !== null ? `${fmtHours(st.sleepAvg)} de sommeil en moyenne` : 'Note tes nuits'}</h2></div></div>
      <p className="muted small">{[
        st.energyAvg !== null ? `Énergie moyenne : ${String(st.energyAvg).replace('.', ',')}/5 (${st.energyDays} jour${st.energyDays > 1 ? 's' : ''} noté${st.energyDays > 1 ? 's' : ''})` : null,
        st.qualityAvg !== null ? `Qualité des nuits : ${String(st.qualityAvg).replace('.', ',')}/5` : null,
      ].filter(Boolean).join(' · ') || 'Note ton énergie dans le check-in du jour, sur l\'accueil, et tes nuits ici.'}</p>
      {st.energyAvg === null && st.sleepNights > 0 && <p className="muted small">Ton énergie se note dans le check-in du jour, sur l'accueil.</p>}
      {(st.sleepNights > 0 || st.energyDays > 0) && (
        <div className="sleep-bars" aria-label="Sommeil (barres) et énergie (points) des 14 derniers jours">
          {days.map(d => {
            const c = ck.get(d)
            const h = c?.sleep_hours != null ? Number(c.sleep_hours) : null
            return (
              <div key={d} className="sb" title={`${d} : ${h !== null ? fmtHours(h) : '—'} · énergie ${c?.energy ?? '—'}`}>
                <div className="col">
                  {h !== null && <i style={{ height: `${Math.min(100, (h / 10) * 100)}%` }} />}
                  {c?.energy != null && <b style={{ bottom: `${(c.energy / 5) * 100}%` }} />}
                </div>
                <span>{Number(d.slice(8))}</span>
              </div>
            )
          })}
        </div>
      )}
      <button className="btn secondary sm" onClick={() => setOpen(true)}>{tonight?.sleep_hours != null ? `Nuit dernière : ${fmtHours(Number(tonight.sleep_hours))} · modifier` : 'Noter ma nuit dernière'}</button>
      {open && <SleepSheet onClose={() => setOpen(false)} />}
    </section>
  )
}

export function SleepSheet({ onClose, day }: { onClose: () => void; day?: Day }) {
  const { snap, today, actions, toast } = useApp()
  const d = day ?? today
  const c = snap.daily_checkins.find(x => x.day === d)
  const [hours, setHours] = useState<number>(c?.sleep_hours != null ? Number(c.sleep_hours) : 7)
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5 | null>(c?.sleep_quality ?? null)
  return (
    <Sheet title="Ma nuit dernière" onClose={onClose}>
      <div className="row between"><strong>Durée</strong><Stepper label="Heures de sommeil" value={hours} min={0} max={14} step={0.5} onChange={setHours} format={fmtHours} /></div>
      <strong className="small">Qualité <span className="muted">(facultatif)</span></strong>
      <Chips label="Qualité du sommeil" soft value={quality} onChange={setQuality} options={(Object.entries(SLEEP_QUALITY) as [string, string][]).map(([k, label]) => ({ id: Number(k) as 1 | 2 | 3 | 4 | 5, label }))} />
      <button className="btn primary block" onClick={async () => { await actions.saveCheckin(d, { sleep_hours: hours, sleep_quality: quality }); toast('🌙', 'Nuit notée'); onClose() }}>Enregistrer</button>
    </Sheet>
  )
}

// ------------------------------------------------------------------ bilan du mois
function MonthCard() {
  const { snap, today } = useApp()
  const [month, setMonth] = useState(monthOf(today))
  const r = monthReview(snap, month, today)
  const current = month === monthOf(today)
  const empty = !r.sessions && !r.foodDays && !r.sleepNights && !r.energyAvg && !r.weight && !r.measures.length && !r.waterDays
  return (
    <section className="card tint" aria-label="Bilan du mois">
      <div className="row between">
        <button className="icon-btn" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}><IconBack /></button>
        <div style={{ textAlign: 'center' }}><div className="kicker">Bilan du mois{current ? ' (en cours)' : ''}</div><h2>{r.label[0].toUpperCase() + r.label.slice(1)}</h2></div>
        <button className="icon-btn" aria-label="Mois suivant" disabled={current} onClick={() => setMonth(shiftMonth(month, 1))}><IconChevron /></button>
      </div>
      {empty ? <p className="muted">Rien de noté ce mois-ci. Ce bilan se remplit tout seul avec tes séances, repas, nuits et mesures.</p> : (
        <>
          <div className="list">
            <Line emoji="💪" title={`${r.sessions} séance${r.sessions > 1 ? 's' : ''} · ${r.minutes} min`} sub={r.planned > 0 ? `${r.honored} rendez-vous honoré${r.honored > 1 ? 's' : ''} sur ${r.planned}` : r.sessions ? 'Toutes les séances du mois comptent' : 'Aucune séance notée pour l\'instant'} />
            <Line emoji="🍽️" title={`${r.foodDays} jour${r.foodDays > 1 ? 's' : ''} de repas notés sur ${r.days}`} sub={r.avgKcal !== null ? `En moyenne ${fmtKcal(r.avgKcal)} ces jours-là${r.goal ? ` (objectif ${fmtKcal(r.goal)})` : ''}` : 'Au moins deux repas notés comptent pour une journée'} />
            <Line emoji="💧" title={`Objectif d'eau atteint ${r.waterDays} jour${r.waterDays > 1 ? 's' : ''}`} sub={`sur ${r.days} jours`} />
            <Line emoji="🌙" title={r.sleepAvg !== null ? `${fmtHours(r.sleepAvg)} de sommeil en moyenne` : 'Sommeil non noté'} sub={r.sleepAvg !== null ? `${r.sleepNights} nuit${r.sleepNights > 1 ? 's' : ''} notée${r.sleepNights > 1 ? 's' : ''}${r.energyAvg !== null ? ` · énergie ${String(r.energyAvg).replace('.', ',')}/5 (${ENERGY_LABELS[Math.round(r.energyAvg) as 1 | 2 | 3 | 4 | 5].toLowerCase()})` : ''}` : r.energyAvg !== null ? `Énergie moyenne ${String(r.energyAvg).replace('.', ',')}/5` : 'Note tes nuits pour les voir ici'} />
            {r.measures.map(m => <Line key={m.label} emoji="📏" title={`${m.label} : ${fmtDiff(m.diff, 'cm')}`} sub={`${String(m.last).replace('.', ',')} cm à la dernière mesure`} />)}
            {r.weight && <Line emoji="⚖️" title={`Tendance du poids : ${fmtDiff(r.weight.diff, 'kg')}`} sub={`${String(r.weight.start).replace('.', ',')} → ${String(r.weight.end).replace('.', ',')} kg (courbe lissée)`} />}
          </div>
          <h3>Ce que montrent tes données</h3>
          {r.crossings.length ? (
            <ul className="crossings">{r.crossings.map(c => <li key={c.key}>{c.text}</li>)}</ul>
          ) : <p className="muted small">Pas encore assez de jours notés pour croiser sommeil, énergie et séances (il en faut au moins 3 de chaque côté).</p>}
          <p className="muted small">Ce sont des observations sur tes propres données, pas des preuves ni des conseils médicaux.</p>
        </>
      )}
    </section>
  )
}

function Line({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return <div className="list-item"><span className="emoji-bubble" aria-hidden="true">{emoji}</span><div className="grow"><div className="title">{title}</div><div className="muted small">{sub}</div></div></div>
}
