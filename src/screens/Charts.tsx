// Courbes : poids, eau et activité, avec jauges et graphiques lisibles. Onglet « Courbes » de Progrès.
import { useState, type ReactNode } from 'react'
import { useApp } from '../app/state'
import { Ring, Segmented } from '../ui/components'
import { DayBars, DeltaBars, Legend, TrendLine } from '../ui/charts'
import { weekStart } from '../lib/dates'
import { weightTrend } from '../domain/body'
import { formatLitres } from '../domain/discipline'
import { rendezvousStats, sportCommitment } from '../domain/ritual'
import { fmtDiff } from '../domain/wellbeing'
import {
  RANGES, activitySeries, activitySummary, waterSeries, waterSummary, weeklyDeltas, weightStats, weightWindow,
  type DaysRange, type WeightRange,
} from '../domain/series'

const fr = (n: number, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',')

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return <div className="kpi"><span className="small muted">{label}</span><strong>{value}</strong>{sub && <span className="small muted">{sub}</span>}</div>
}

export function ChartsPanel() {
  return (
    <>
      <WeightCurveCard />
      <WaterChartCard />
      <ActivityChartCard />
    </>
  )
}

// ------------------------------------------------------------------ poids
/** Courbe du poids (tendance lissée + pesées), avec choix de la période. Sans carte : utilisable dans une autre carte. */
export function WeightChart() {
  const { snap, today } = useApp()
  const [range, setRange] = useState<WeightRange>('8s')
  const [view, setView] = useState<'poids' | 'semaine'>('poids')
  const all = weightTrend(snap.weights)
  if (all.length < 2) return <p className="muted small">Deux pesées suffisent pour dessiner ta courbe.</p>
  const pts = weightWindow(all, range, today)
  const st = weightStats(pts)!
  const weeks = weeklyDeltas(all, today, 8)
  const filled = weeks.filter(w => w.delta !== null)
  return (
    <>
      <Segmented label="Type de courbe" value={view} onChange={setView} options={[{ id: 'poids', label: 'Poids' }, { id: 'semaine', label: 'Par semaine' }]} />
      {view === 'semaine' ? (
        filled.length >= 2 ? (
          <>
            <DeltaBars items={weeks} unit="kg"
              label={`Variation du poids par semaine sur ${weeks.length} semaines : ${filled.map(w => fmtDiff(w.delta!, 'kg')).join(', ')}`} />
            <Legend items={[{ color: 'var(--mousse)', text: 'Baisse' }, { color: '#F0D18A', text: 'Hausse' }]} />
            <p className="muted small">Chaque barre compare ta tendance à celle de la semaine d'avant. Les petites hausses sont normales (eau, sel, cycle).</p>
          </>
        ) : <p className="muted small">Il faut des pesées sur deux semaines différentes pour voir la variation semaine après semaine.</p>
      ) : (
      <>
      <Segmented label="Période du poids" value={range} onChange={setRange} options={[{ id: '8s', label: '8 semaines' }, { id: 'tout', label: 'Tout' }]} />
      <TrendLine days={pts.map(p => p.day)} line={pts.map(p => p.trend)} dots={pts.map(p => p.kg)} unit="kg"
        label={`Courbe de poids : tendance de ${fr(st.first.trend)} à ${fr(st.last.trend)} kg sur ${st.count} pesées`} />
      <Legend items={[{ color: 'var(--btn)', text: 'Tendance lissée' }, { color: 'var(--mousse)', text: 'Pesées' }]} />
      <div className="kpis">
        <Kpi label="Écart" value={fmtDiff(st.delta, 'kg')} sub="sur la période" />
        <Kpi label="Plus bas" value={`${fr(st.min)} kg`} />
        <Kpi label="Plus haut" value={`${fr(st.max)} kg`} />
      </div>
      </>
      )}
    </>
  )
}

function WeightCurveCard() {
  const { snap } = useApp()
  const trend = weightTrend(snap.weights)
  const last = trend[trend.length - 1]
  return (
    <section className="card" aria-label="Courbe de poids">
      <div className="card-head"><span className="emoji-bubble" aria-hidden="true">⚖️</span>
        <div><div className="kicker">Poids</div><h2>{last ? `Tendance : ${fr(last.trend)} kg` : 'Pas encore de pesée'}</h2></div></div>
      {last ? <WeightChart /> : <p className="muted small">Ta première pesée se note dans l'onglet Corps. La courbe lisse les variations d'eau, normales d'un jour à l'autre.</p>}
    </section>
  )
}

// ------------------------------------------------------------------ eau
function WaterChartCard() {
  const { snap, today } = useApp()
  const [range, setRange] = useState<DaysRange>('7')
  const series = waterSeries(snap, today, RANGES[range])
  const sum = waterSummary(series)
  const goal = series[0].goal
  const todayMl = series[series.length - 1].ml
  const ratio = goal ? todayMl / goal : 0
  return (
    <section className="card" aria-label="Eau sur les derniers jours">
      <div className="card-head">
        <Ring value={ratio} size={72} stroke={9} color={ratio >= 1 ? 'var(--nuit)' : 'var(--eau)'} track="var(--eau-clair)">{Math.round(ratio * 100)} %</Ring>
        <div><div className="kicker-nuit">Eau</div><h2>{formatLitres(todayMl)} aujourd'hui</h2>
          <span className="small muted">{todayMl >= goal ? 'Objectif atteint' : `encore ${formatLitres(goal - todayMl)} pour ${formatLitres(goal, 1)}`}</span></div>
      </div>
      <Segmented label="Période de l'eau" value={range} onChange={setRange} options={[{ id: '7', label: '7 jours' }, { id: '30', label: '30 jours' }]} />
      <DayBars items={series.map(d => ({ day: d.day, value: d.ml }))} goal={goal} goalLabel={`objectif ${formatLitres(goal, 1)}`} today={today} step={500}
        format={v => fr(v / 1000, 1)} yFormat={v => (v === 0 ? '0' : `${fr(v / 1000, 1)} L`)}
        label={`Eau bue par jour sur ${series.length} jours : objectif atteint ${sum.daysReached} jour${sum.daysReached > 1 ? 's' : ''}`} />
      <Legend items={[{ color: 'var(--eau)', text: 'Objectif atteint' }, { color: 'var(--eau-clair)', text: 'En dessous' }, { color: 'var(--vert)', text: 'Objectif', dashed: true }]} />
      <div className="kpis two">
        <Kpi label="Objectif atteint" value={`${sum.daysReached} / ${sum.days} jours`} />
        <Kpi label="Moyenne" value={sum.avgMl !== null ? formatLitres(sum.avgMl) : '—'} sub={sum.avgMl !== null ? 'jours notés' : 'rien de noté'} />
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ activité
function ActivityChartCard() {
  const { snap, today } = useApp()
  const [range, setRange] = useState<DaysRange>('7')
  const sport = sportCommitment(snap)
  const series = activitySeries(snap, today, RANGES[range])
  const sum = activitySummary(series)
  const planned = sport?.days.length ?? 0
  const week = rendezvousStats(snap, weekStart(today), today, today)
  const usual = sport?.usual_minutes ?? undefined
  return (
    <section className="card" aria-label="Activité sur les derniers jours">
      <div className="card-head">
        {planned > 0
          ? <Ring value={Math.min(1, week.honored / planned)} size={72} stroke={9} color={week.honored >= planned ? 'var(--or)' : 'var(--btn)'}>{week.honored}/{planned}</Ring>
          : <span className="emoji-bubble" aria-hidden="true">💪</span>}
        <div><div className="kicker">Activité</div>
          <h2>{planned > 0 ? `${week.honored} rendez-vous honoré${week.honored > 1 ? 's' : ''} sur ${planned}` : `${sum.sessions} séance${sum.sessions > 1 ? 's' : ''}`}</h2>
          <span className="small muted">{planned > 0 ? 'cette semaine (du lundi à aujourd\'hui)' : `sur les ${series.length} derniers jours`}</span></div>
      </div>
      <Segmented label="Période de l'activité" value={range} onChange={setRange} options={[{ id: '7', label: '7 jours' }, { id: '30', label: '30 jours' }]} />
      <DayBars items={series.map(d => ({ day: d.day, value: d.minutes }))} goal={usual} goalLabel={usual ? `habituelle ${usual} min` : undefined} today={today} step={10}
        color="var(--btn)" soft="var(--mousse)" format={v => String(v)} yFormat={v => String(Math.round(v))}
        label={`Minutes d'activité par jour sur ${series.length} jours : ${sum.minutes} minutes en ${sum.sessions} séance${sum.sessions > 1 ? 's' : ''}`} />
      <Legend items={usual
        ? [{ color: 'var(--btn)', text: 'Durée habituelle atteinte' }, { color: 'var(--mousse)', text: 'Version plus courte' }, { color: 'var(--vert)', text: 'Durée habituelle', dashed: true }]
        : [{ color: 'var(--btn)', text: 'Minutes par jour' }]} />
      <div className="kpis">
        <Kpi label="Séances" value={sum.sessions} />
        <Kpi label="Minutes" value={sum.minutes} />
        <Kpi label="Jours actifs" value={`${sum.activeDays} / ${sum.days}`} />
      </div>
    </section>
  )
}
