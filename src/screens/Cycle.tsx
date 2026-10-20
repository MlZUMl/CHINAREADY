// Suivi du cycle façon Flo : état du jour, calendrier réel / prévu, statistiques, prévisions, historique.
// Les dates réelles et les estimations sont toujours distinguées ; rien n'est présenté comme un diagnostic
// ni comme une méthode de contraception.
import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Sheet, Toggle } from '../ui/components'
import { IconBack, IconChevron, IconHeart, IconPlus, IconCheck } from '../ui/icons'
import { addDays, formatDayLong, monthGrid, MONTHS, parseDay, WEEKDAYS_SHORT, type Day } from '../lib/dates'
import { navigate } from '../lib/router'
import {
  CONFIDENCE_TEXT, NORMAL_CYCLE, NORMAL_PERIOD_MAX, REGULAR_SPREAD, SEX_PRIVACY, cycleHistory, cycleStats, delayMessage, forecast, futureFertility,
  type Forecast, type Status,
} from '../domain/cycle'
import { SYMPTOMS } from '../domain/body'
import type { CycleDay } from '../data/types'

const short = (d: Day) => `${parseDay(d).getDate()} ${MONTHS[parseDay(d).getMonth()]}`
const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`
const FLOWS: { id: NonNullable<CycleDay['flow']>; label: string }[] = [
  { id: 'spotting', label: 'Spotting' }, { id: 'leger', label: 'Léger' }, { id: 'moyen', label: 'Moyen' }, { id: 'abondant', label: 'Abondant' },
]

function useCycle() {
  const { snap, today } = useApp()
  return useMemo(() => ({
    f: forecast(snap.cycle_days, today),
    st: cycleStats(snap.cycle_days, today),
    hist: cycleHistory(snap.cycle_days, today),
    fertility: snap.profiles[0]?.settings.show_fertility !== false,
  }), [snap.cycle_days, snap.profiles, today])
}

/** Phrase principale de l'état du jour. */
function headline(f: Forecast, today: Day): { big: string; small: string } {
  if (!f.lastStart) return { big: 'Mon cycle', small: 'Note le premier jour de tes règles pour commencer le suivi.' }
  if (f.ongoing) return { big: `Règles · jour ${f.cycleDay}`, small: f.ongoing.endConfirmed ? 'Fin notée' : 'Pense à noter le dernier jour quand elles se terminent.' }
  if (f.delayDays > 0) return { big: `Jour ${f.cycleDay}`, small: delayMessage(f.delayDays)!.title }
  const left = Math.round((parseDay(f.nextStart!).getTime() - parseDay(today).getTime()) / 86400000)
  return { big: `Jour ${f.cycleDay}`, small: left === 0 ? 'Règles prévues aujourd\'hui (estimation)' : `Règles prévues dans ${jours(left)} (estimation)` }
}

// ------------------------------------------------------------------ carte de l'accueil
export function CycleCard() {
  const { today } = useApp()
  const { f } = useCycle()
  const [sheet, setSheet] = useState<'debut' | 'fin' | null>(null)
  const h = headline(f, today)
  return (
    <section className="card" aria-label="Mon cycle">
      <div className="card-head">
        <span className="emoji-bubble" style={{ background: 'var(--rose-clair)' }} aria-hidden="true">🌸</span>
        <div><div className="kicker">Cycle</div><strong data-testid="cycle-titre">{h.big}</strong><div className="muted small" data-testid="cycle-sous-titre">{h.small}</div></div>
      </div>
      <div className="row">
        {f.ongoing ? <button className="btn secondary sm" onClick={() => setSheet('fin')}>Fin des règles</button>
          : <button className="btn secondary sm" onClick={() => setSheet('debut')}>Mes règles ont commencé</button>}
        <button className="btn ghost sm" onClick={() => navigate('/progres?onglet=cycle')}>Mon cycle</button>
      </div>
      {sheet === 'debut' && <PeriodSheet onClose={() => setSheet(null)} />}
      {sheet === 'fin' && <EndSheet onClose={() => setSheet(null)} />}
    </section>
  )
}

// ------------------------------------------------------------------ onglet Progrès > Cycle
export function CyclePanel() {
  const { snap, today } = useApp()
  const { f, st, hist, fertility } = useCycle()
  const [sheet, setSheet] = useState<'debut' | 'fin' | 'rapport' | null>(null)
  const [day, setDay] = useState<Day | null>(null)
  const h = headline(f, today)
  const delay = delayMessage(f.delayDays)
  const ratio = f.cycleDay ? Math.min(1, f.cycleDay / f.cycleLength) : 0
  const sexToday = snap.intimate_logs.some(l => l.day === today)
  return (
    <>
      <section className="card cycle-hero" aria-label="État du cycle">
        <div className="cycle-ring" style={{ ['--p' as string]: ratio }}>
          <div>
            <b data-testid="cycle-jour">{h.big}</b>
            <span>{h.small}</span>
            {f.lastStart && <em className="pill">{f.ongoing ? 'données réelles' : 'estimation'}</em>}
          </div>
        </div>
        <div className="cycle-actions">
          <button onClick={() => setSheet(f.ongoing ? 'fin' : 'debut')}><span className="round rose">💧</span>{f.ongoing ? 'Fin des règles' : 'Noter les règles'}</button>
          <button onClick={() => setDay(today)}><span className="round"><IconPlus /></span>Ressentis</button>
          <button onClick={() => setSheet('rapport')} aria-label="Rapport (privé)"><span className={`round ${sexToday ? 'on' : ''}`}><IconHeart /></span>Rapport</button>
        </div>
      </section>

      {delay && (
        <section className="card flat" role="status" aria-label="Retard">
          <strong>{delay.title}</strong>
          <p className="muted small">{delay.text}</p>
          <button className="btn secondary sm" onClick={() => setSheet('debut')}>Mes règles sont arrivées</button>
        </section>
      )}

      <CycleCalendar f={f} fertility={fertility} onDay={setDay} />

      <section className="card" aria-label="Mes cycles">
        <h2>Mes cycles</h2>
        <StatRow label="Durée du cycle précédent" value={st.lastCycle ? jours(st.lastCycle) : '—'} status={st.lastCycleStatus}
          info={`Du premier jour des règles au premier jour des suivantes. Repère habituel : ${NORMAL_CYCLE.min} à ${NORMAL_CYCLE.max} jours.`} testid="stat-cycle" />
        <StatRow label="Durée des règles précédentes" value={st.lastPeriod ? jours(st.lastPeriod) : '—'} status={st.lastPeriodStatus}
          info={`Repère habituel : ${NORMAL_PERIOD_MAX} jours au plus.`} testid="stat-regles" />
        <StatRow label="Variations de la durée du cycle" value={st.minCycle && st.maxCycle && st.cyclesCount >= 2 ? (st.minCycle === st.maxCycle ? jours(st.minCycle) : `${st.minCycle}-${st.maxCycle} jours`) : '—'}
          status={st.regularity === 'inconnu' ? 'inconnu' : st.regularity === 'regulier' ? 'normal' : 'attention'} labels={['RÉGULIER', 'IRRÉGULIER']}
          info={`Écart entre ton cycle le plus court et le plus long (6 derniers). Jusqu'à ${REGULAR_SPREAD} jours d'écart, on parle de cycles réguliers.`} testid="stat-variation" />
        <div className="grid2 small">
          <div><span className="muted">Cycle moyen</span><br /><strong data-testid="stat-moyenne">{st.avgCycle ? jours(st.avgCycle) : '—'}</strong></div>
          <div><span className="muted">Règles en moyenne</span><br /><strong>{st.avgPeriod ? jours(st.avgPeriod) : '—'}</strong></div>
        </div>
        <p className="muted small">{st.cyclesCount ? `Calculé sur ${st.cyclesCount} cycle${st.cyclesCount > 1 ? 's' : ''} complet${st.cyclesCount > 1 ? 's' : ''} noté${st.cyclesCount > 1 ? 's' : ''}.` : 'Les statistiques apparaissent dès le premier cycle complet noté.'} Élan n'est pas un outil de diagnostic : en cas de doute ou de changement inhabituel, parles-en à un professionnel de santé.</p>
      </section>

      <Forecasts f={f} fertility={fertility} />
      <History hist={hist} today={today} />
      <Trends hist={hist} />

      {sheet === 'debut' && <PeriodSheet onClose={() => setSheet(null)} />}
      {sheet === 'fin' && <EndSheet onClose={() => setSheet(null)} />}
      {sheet === 'rapport' && <IntimateSheet day={today} onClose={() => setSheet(null)} />}
      {day && <CycleDaySheet day={day} onClose={() => setDay(null)} />}
    </>
  )
}

function StatRow({ label, value, status, info, labels = ['NORMAL', 'À SURVEILLER'], testid }: { label: string; value: string; status: Status; info: string; labels?: [string, string]; testid: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="stat-row">
      <div className="row between">
        <span className="muted small">{label}</span>
        <button className="info-btn" aria-label={`Explication : ${label}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>i</button>
      </div>
      <div className="row between">
        <strong style={{ fontSize: '1.2rem' }} data-testid={testid}>{value}</strong>
        {status !== 'inconnu' && <span className={`stat-badge ${status}`}>{status === 'normal' ? <IconCheck style={{ width: 14 }} /> : '!'} {status === 'normal' ? labels[0] : labels[1]}</span>}
      </div>
      {open && <p className="muted small">{info}</p>}
    </div>
  )
}

// ------------------------------------------------------------------ calendrier
function CycleCalendar({ f, fertility, onDay }: { f: Forecast; fertility: boolean; onDay: (d: Day) => void }) {
  const { snap, today } = useApp()
  const [month, setMonth] = useState(() => { const d = parseDay(today); return { y: d.getFullYear(), m: d.getMonth() } })
  const grid = monthGrid(month.y, month.m)
  const real = new Set(snap.cycle_days.filter(c => c.period).map(c => c.day))
  const predicted = new Set(f.predictedPeriod)
  const future = futureFertility(f)
  const fert = new Set(fertility ? [...f.fertile, ...future.fertile] : [])
  const ovuEst = new Set(fertility ? [f.ovulation, ...future.ovulation].filter(Boolean) as Day[] : [])
  const ovuOk = new Set(snap.cycle_days.filter(c => c.ovulation_confirmed).map(c => c.day))
  const sex = new Set(snap.intimate_logs.map(l => l.day))
  const move = (k: number) => setMonth(({ y, m }) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  return (
    <section className="card" aria-label="Calendrier du cycle">
      <div className="row between">
        <button className="icon-btn" aria-label="Mois précédent" onClick={() => move(-1)}><IconBack /></button>
        <h2>{MONTHS[month.m][0].toUpperCase() + MONTHS[month.m].slice(1)} {month.y}</h2>
        <button className="icon-btn" aria-label="Mois suivant" onClick={() => move(1)}><IconChevron /></button>
      </div>
      <div className="month-grid">
        {WEEKDAYS_SHORT.map((w, i) => <span key={i} className="wd" aria-hidden="true">{w}</span>)}
        {grid.map(d => {
          const kind = real.has(d) ? 'reel' : predicted.has(d) ? 'prevu' : ovuOk.has(d) ? 'ovu-ok' : ovuEst.has(d) ? 'ovu' : fert.has(d) ? 'fertile' : ''
          const out = parseDay(d).getMonth() !== month.m
          const label = [formatDayLong(d), real.has(d) ? 'règles notées' : predicted.has(d) ? 'règles prévues (estimation)' : '', ovuOk.has(d) ? 'ovulation confirmée' : ovuEst.has(d) ? 'ovulation estimée' : fert.has(d) ? 'fenêtre fertile estimée' : '', sex.has(d) ? 'rapport noté' : ''].filter(Boolean).join(', ')
          return (
            <button key={d} className={out ? 'out' : ''} onClick={() => onDay(d)} aria-label={label} data-cycle={kind || undefined}>
              <span className={`day-dot c-${kind || 'rien'} ${d === today ? 'today' : ''}`}>{parseDay(d).getDate()}</span>
              <span className="mini-dots">{sex.has(d) && <i className="intime" />}</span>
            </button>
          )
        })}
      </div>
      <div className="cycle-legend small muted">
        <span><i className="c-reel" /> Règles notées</span>
        <span><i className="c-prevu" /> Règles prévues</span>
        {fertility && <><span><i className="c-fertile" /> Fenêtre fertile estimée</span><span><i className="c-ovu" /> Ovulation estimée</span><span><i className="c-ovu-ok" /> Ovulation confirmée</span></>}
      </div>
      <p className="muted small">Touche un jour pour noter tes règles, leur fin, tes ressentis ou un rapport.</p>
    </section>
  )
}

// ------------------------------------------------------------------ prévisions
function Forecasts({ f, fertility }: { f: Forecast; fertility: boolean }) {
  if (!f.lastStart) return null
  return (
    <section className="card" aria-label="Prévisions">
      <div className="kicker">Prévisions · estimations</div>
      {!f.ongoing && f.nextStart && (
        <div className="row between"><span>Prochaines règles</span>
          <strong data-testid="prevision-regles">{f.delayDays > 0 ? `attendues depuis le ${short(f.nextStart)}` : f.nextRange ? `entre le ${short(f.nextRange[0])} et le ${short(f.nextRange[1])}` : `vers le ${short(f.nextStart)}`}</strong></div>
      )}
      {fertility && f.ovulationConfirmed && <div className="row between"><span>Ovulation</span><strong>confirmée le {short(f.ovulationConfirmed)}</strong></div>}
      {fertility && !f.ovulationConfirmed && f.ovulation && <div className="row between"><span>Ovulation estimée</span><strong data-testid="prevision-ovulation">vers le {short(f.ovulation)}</strong></div>}
      {fertility && f.fertile.length > 0 && f.delayDays === 0 && <div className="row between"><span>Fenêtre fertile estimée</span><strong>du {short(f.fertile[0])} au {short(f.fertile[f.fertile.length - 1])}</strong></div>}
      <p className="muted small" data-testid="certitude">{CONFIDENCE_TEXT[f.confidence]}{f.usesDefault ? ' En attendant, Élan utilise un cycle de 28 jours.' : ` Basé sur un cycle moyen de ${f.cycleLength} jours.`}</p>
      {fertility && <p className="small warn" style={{ margin: 0 }}>Ces estimations ne sont pas une méthode de contraception et ne permettent pas de savoir avec certitude quand l'ovulation a lieu.</p>}
    </section>
  )
}

// ------------------------------------------------------------------ historique et tendances
function History({ hist, today }: { hist: ReturnType<typeof cycleHistory>; today: Day }) {
  const { actions, toast } = useApp()
  const [all, setAll] = useState(false)
  const [del, setDel] = useState<Day | null>(null)
  if (!hist.length) return null
  const list = [...hist].reverse()
  const shown = all ? list : list.slice(0, 4)
  const maxLen = Math.max(35, ...hist.map(h => h.length ?? 0))
  return (
    <section className="card" aria-label="Historique des cycles">
      <div className="row between"><h2>Historique des cycles</h2>{list.length > 4 && <button className="link-btn" onClick={() => setAll(a => !a)}>{all ? 'Réduire' : 'Tout voir'}</button>}</div>
      {shown.map(h => {
        const len = h.length ?? Math.round((parseDay(today).getTime() - parseDay(h.start).getTime()) / 86400000) + 1
        return (
          <div className="history-row" key={h.start}>
            <div className="row between">
              <strong>{h.length === null ? 'Cycle en cours' : jours(h.length)}</strong>
              <span className="muted small">débuté le {short(h.start)}</span>
            </div>
            <div className="cycle-bar" aria-hidden="true">
              <span style={{ width: `${(Math.min(len, maxLen) / maxLen) * 100}%` }}><i style={{ width: `${(h.periodLength / Math.max(len, h.periodLength)) * 100}%` }} /></span>
            </div>
            <div className="row between small">
              <span className="muted">{jours(h.periodLength)} de règles{h.ovulationConfirmed ? ` · ovulation confirmée le ${short(h.ovulationConfirmed)}` : h.ovulationEstimate ? ` · ovulation estimée vers le ${short(h.ovulationEstimate)}` : ''}</span>
              <button className="link-btn small" onClick={() => setDel(h.start)}>Corriger</button>
            </div>
            {h.predictedStart && h.diff !== null && <span className="muted small">Prévues le {short(h.predictedStart)}, arrivées le {short(h.start)} ({h.diff === 0 ? 'pile à la date' : `${h.diff > 0 ? '+' : ''}${h.diff} j`})</span>}
            {!h.valid && <span className="muted small">Cycle inhabituellement {h.length! < 18 ? 'court' : 'long'} : peut-être un jour de règles oublié. Il n'est pas pris en compte dans les moyennes.</span>}
          </div>
        )
      })}
      {del && (
        <Sheet title={`Règles du ${short(del)}`} onClose={() => setDel(null)}>
          <p className="muted">Pour modifier les dates, touche les jours concernés dans le calendrier. Tu peux aussi supprimer ces règles si elles ont été notées par erreur.</p>
          <button className="btn danger" onClick={async () => { await actions.deletePeriod(del); toast('🗑️', 'Règles supprimées, prévisions mises à jour'); setDel(null) }}>Supprimer ces règles</button>
        </Sheet>
      )}
    </section>
  )
}

function Trends({ hist }: { hist: ReturnType<typeof cycleHistory> }) {
  const done = hist.filter(h => h.length !== null && h.valid).slice(-8)
  if (done.length < 2) return null
  const max = Math.max(...done.map(h => h.length!), NORMAL_CYCLE.max)
  return (
    <section className="card" aria-label="Tendances">
      <h2>Tendance</h2>
      <div className="bars" style={{ height: 110 }}>
        {done.map(h => (
          <div className="bar" key={h.start} title={`${h.length} jours`}>
            <span>{h.length}</span>
            <i className={h.length! >= NORMAL_CYCLE.min && h.length! <= NORMAL_CYCLE.max ? '' : 'rest'} style={{ height: `${(h.length! / max) * 100}%`, background: 'var(--rose)' }} />
            <span>{MONTHS[parseDay(h.start).getMonth()].slice(0, 4)}</span>
          </div>
        ))}
      </div>
      <p className="muted small">Durée de chaque cycle complet. Une variation de quelques jours d'un mois à l'autre est fréquente.</p>
    </section>
  )
}

// ------------------------------------------------------------------ feuilles
export function PeriodSheet({ onClose }: { onClose: () => void }) {
  const { actions, toast, today } = useApp()
  const [start, setStart] = useState<Day>(today)
  const [ongoing, setOngoing] = useState(true)
  const [end, setEnd] = useState<Day>(today)
  const [flow, setFlow] = useState<CycleDay['flow']>('moyen')
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    try {
      await actions.logPeriod(start, ongoing ? null : end, flow)
      toast('🌸', 'Règles notées : prévisions mises à jour')
      onClose()
    } catch { setError('Vérifie les dates : le début doit précéder la fin, sans dépasser aujourd\'hui ni 15 jours.') }
  }
  return (
    <Sheet title="Noter mes règles" onClose={onClose}>
      <label className="field">Premier jour<input className="input" type="date" max={today} value={start} onChange={e => { setStart(e.target.value || today); if (end < e.target.value) setEnd(e.target.value) }} aria-label="Premier jour des règles" /></label>
      <Toggle label="Toujours en cours" hint="Tu noteras le dernier jour quand elles se terminent" checked={ongoing} onChange={setOngoing} />
      {!ongoing && <label className="field">Dernier jour<input className="input" type="date" min={start} max={today} value={end} onChange={e => setEnd(e.target.value || start)} aria-label="Dernier jour des règles" /></label>}
      <strong className="small">Flux <span className="muted">(facultatif)</span></strong>
      <Chips label="Flux" soft value={flow} onChange={setFlow} options={FLOWS} />
      {error && <div className="warn" role="alert">{error}</div>}
      <button className="btn primary block" onClick={save}>Enregistrer</button>
    </Sheet>
  )
}

export function EndSheet({ onClose }: { onClose: () => void }) {
  const { actions, toast, today } = useApp()
  const { f } = useCycle()
  const [day, setDay] = useState<Day>(today)
  const start = f.ongoing?.start ?? today
  return (
    <Sheet title="Fin des règles" onClose={onClose}>
      <p className="muted">Quel a été le dernier jour de tes règles ?</p>
      <Chips label="Dernier jour" value={day} onChange={v => v && setDay(v)} options={[{ id: today, label: 'Aujourd\'hui' }, ...(addDays(today, -1) >= start ? [{ id: addDays(today, -1), label: 'Hier' }] : [])]} />
      <label className="field">Ou une autre date<input className="input" type="date" min={start} max={today} value={day} onChange={e => setDay(e.target.value || today)} aria-label="Dernier jour des règles" /></label>
      <button className="btn primary block" onClick={async () => { await actions.endPeriod(day); toast('✅', 'Fin des règles notée'); onClose() }}>Enregistrer</button>
    </Sheet>
  )
}

export function IntimateSheet({ day, onClose }: { day: Day; onClose: () => void }) {
  const { snap, actions, toast } = useApp()
  const cur = snap.intimate_logs.find(l => l.day === day)
  const [note, setNote] = useState(cur?.note ?? '')
  return (
    <Sheet title="Rapport" onClose={onClose}>
      <p className="muted small">{SEX_PRIVACY} Rien d'autre n'est demandé.</p>
      <p><strong>{formatDayLong(day)}</strong></p>
      <label className="field">Note <span className="hint">Facultatif</span><input className="input" value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
      <div className="grid2">
        {cur ? <button className="btn danger" onClick={async () => { await actions.setIntimate(day, false); toast('🗑️', 'Retiré'); onClose() }}>Retirer</button> : <button className="btn ghost" onClick={onClose}>Annuler</button>}
        <button className="btn primary" onClick={async () => { await actions.setIntimate(day, true, note); toast('🤍', 'Noté, en privé'); onClose() }}>{cur ? 'Enregistrer' : 'Noter un rapport'}</button>
      </div>
    </Sheet>
  )
}

export function CycleDaySheet({ day, onClose }: { day: Day; onClose: () => void }) {
  const { snap, actions, today } = useApp()
  const cycle = snap.cycle_days.find(c => c.day === day)
  const sex = snap.intimate_logs.find(l => l.day === day)
  const fertility = snap.profiles[0]?.settings.show_fertility !== false
  const future = day > today
  const [intime, setIntime] = useState(false)
  return (
    <Sheet title={formatDayLong(day)} onClose={onClose}>
      {future ? <p className="muted">Ce jour n'est pas encore passé : tu pourras y noter tes règles le moment venu.</p> : (
        <>
          <Toggle label="Règles ce jour-là" checked={Boolean(cycle?.period)} onChange={v => actions.saveCycleDay(day, { period: v, flow: v ? cycle?.flow ?? 'moyen' : null })} />
          {cycle?.period && <>
            <Chips label="Flux" soft value={cycle.flow} onChange={v => actions.saveCycleDay(day, { flow: v })} options={FLOWS} />
            <Toggle label="Dernier jour des règles" checked={Boolean(cycle.period_end)} onChange={v => v ? actions.endPeriod(day) : actions.saveCycleDay(day, { period_end: false })} />
          </>}
          <strong className="small">Ressentis <span className="muted">(facultatif)</span></strong>
          <Chips label="Ressentis" multi soft value={cycle?.symptoms ?? []} onChange={v => actions.saveCycleDay(day, { symptoms: v })} options={SYMPTOMS.map(s => ({ id: s, label: s }))} />
          {fertility && <Toggle label="Ovulation confirmée" hint="Seulement si un test d'ovulation ou un suivi médical l'a indiquée" checked={Boolean(cycle?.ovulation_confirmed)} onChange={v => actions.saveCycleDay(day, { ovulation_confirmed: v })} />}
          <div className="divider" />
          <button className="row between" style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setIntime(true)}>
            <span><strong>Rapport</strong> <span className="muted small">· privé</span></span>
            <span className="pill">{sex ? 'Noté' : 'Noter'}</span>
          </button>
        </>
      )}
      <button className="btn primary block" onClick={onClose}>Fermer</button>
      {intime && <IntimateSheet day={day} onClose={() => setIntime(false)} />}
    </Sheet>
  )
}
