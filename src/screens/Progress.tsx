import { useMemo, useState } from 'react'
import { useApp } from '../app/state'
import { Chips, Segmented, Sheet, Toggle, TopBar } from '../ui/components'
import { navigate } from '../lib/router'
import { addDays, formatDayLong, monthGrid, MONTHS, parseDay, weekStart, WEEKDAYS_SHORT, type Day, toDay } from '../lib/dates'
import { dayRitual, rendezvousStats, sportCommitment } from '../domain/ritual'
import { automaticity, BUCKET_LABELS, commitmentRate, completionByDuration, bestSlots, reprises, SLOT_LABELS, waterMl, waterGoalMl, waterReached, hasFoodOn, formatLitres } from '../domain/discipline'
import { dayTotals, fmtKcal } from '../domain/nutrition'
import { analyze, type Insight } from '../domain/analysis'
import { BADGES } from '../domain/catalog'
import { SYMPTOMS, trendSummary, weightTrend } from '../domain/body'
import { forecast } from '../domain/cycle'
import { CyclePanel } from './Cycle'
import { BodyPanel } from './Body'
import { ChartsPanel } from './Charts'
import { capsuleAccess } from '../domain/capsules'
import { ENERGY_LABELS } from '../domain/recommend'
import { EXTERNAL_ACTIVITIES, FOCUS_LABELS, type Focus } from '../domain/exercises'
import { IconBack, IconChevron, IconLock, IconPlus, IconUser } from '../ui/icons'
import type { Obstacle } from '../data/types'
import { Stepper } from '../ui/components'

type Tab = 'calendrier' | 'courbes' | 'corps' | 'cycle' | 'regularite' | 'badges' | 'capsules'

export function Progress({ query }: { query: URLSearchParams }) {
  const tab = (query.get('onglet') as Tab) || 'calendrier'
  const day = query.get('jour')
  return (
    <>
      <TopBar title="Progrès" right={<button className="icon-btn" aria-label="Profil et réglages" onClick={() => navigate('/profil')}><IconUser /></button>} />
      <main className="content">
        <Segmented label="Sections progrès" value={tab} onChange={t => navigate('/progres?onglet=' + t, true)} options={[
          { id: 'calendrier', label: 'Calendrier' }, { id: 'courbes', label: 'Courbes' }, { id: 'corps', label: 'Corps' }, { id: 'cycle', label: 'Cycle' }, { id: 'regularite', label: 'Régularité' }, { id: 'badges', label: 'Badges' }, { id: 'capsules', label: 'Capsules' },
        ]} />
        {tab === 'calendrier' && <Calendar initialDay={day} />}
        {tab === 'courbes' && <ChartsPanel />}
        {tab === 'corps' && <BodyPanel />}
        {tab === 'cycle' && <CyclePanel />}
        {tab === 'regularite' && <Regularity />}
        {tab === 'badges' && <Badges />}
        {tab === 'capsules' && <CapsuleList />}
      </main>
    </>
  )
}

// ------------------------------------------------------------------ calendrier (inspiré de Flo)
function Calendar({ initialDay }: { initialDay: string | null }) {
  const { snap, today } = useApp()
  const [month, setMonth] = useState(() => { const d = parseDay(initialDay ?? today); return { y: d.getFullYear(), m: d.getMonth() } })
  const [open, setOpen] = useState<Day | null>(initialDay)
  const grid = monthGrid(month.y, month.m)
  const predicted = new Set(forecast(snap.cycle_days, today).predictedPeriod)
  const period = new Set(snap.cycle_days.filter(c => c.period).map(c => c.day))
  const move = (k: number) => setMonth(({ y, m }) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  return (
    <>
      <section className="card">
        <div className="row between">
          <button className="icon-btn" aria-label="Mois précédent" onClick={() => move(-1)}><IconBack /></button>
          <h2>{MONTHS[month.m][0].toUpperCase() + MONTHS[month.m].slice(1)} {month.y}</h2>
          <button className="icon-btn" aria-label="Mois suivant" onClick={() => move(1)}><IconChevron /></button>
        </div>
        <div className="month-grid">
          {WEEKDAYS_SHORT.map((w, i) => <span key={i} className="wd" aria-hidden="true">{w}</span>)}
          {grid.map(d => {
            const r = dayRitual(snap, d, today)
            const out = parseDay(d).getMonth() !== month.m
            const cls = ['day-dot', d === today ? 'today' : '', ['honore', 'petit-pas', 'repos'].includes(r.status) ? r.status : '', period.has(d) ? 'period' : predicted.has(d) ? 'predicted' : ''].join(' ')
            return (
              <button key={d} className={out ? 'out' : ''} onClick={() => setOpen(d)} aria-label={formatDayLong(d)}>
                <span className={cls}>{parseDay(d).getDate()}</span>
                <span className="mini-dots">{waterReached(snap, d) && <i className="eau" />}{hasFoodOn(snap, d) && <i className="repas" />}</span>
              </button>
            )
          })}
        </div>
        <div className="chips small muted" style={{ gap: 12 }}>
          <span className="row" style={{ gap: 6 }}><span className="day-dot honore" style={{ width: 16, height: 16 }} /> Rendez-vous</span>
          <span className="row" style={{ gap: 6 }}><span className="day-dot repos" style={{ width: 16, height: 16 }} /> Repos</span>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 7, border: '2px solid var(--rose)' }} /> Règles</span>
          <span className="row" style={{ gap: 6 }}><span className="mini-dots"><i className="eau" /></span> Eau</span>
          <span className="row" style={{ gap: 6 }}><span className="mini-dots"><i className="repas" /></span> Repas</span>
        </div>
      </section>
      <CycleLink />
      {open && <DaySheet day={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function CycleLink() {
  const { snap, today } = useApp()
  const fc = forecast(snap.cycle_days, today)
  return (
    <button className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/progres?onglet=cycle', true)}>
      <div className="card-head"><div><div className="kicker">Cycle</div>
        <h2>{fc.nextStart && !fc.ongoing ? `Prochaines règles estimées vers le ${parseDay(fc.nextStart).getDate()} ${MONTHS[parseDay(fc.nextStart).getMonth()]}` : fc.ongoing ? 'Règles en cours' : 'Commencer le suivi du cycle'}</h2></div>
        <IconChevron style={{ width: 20 }} /></div>
      <p className="muted small">Calendrier, statistiques, prévisions et historique dans l'onglet Cycle.</p>
    </button>
  )
}

function DaySheet({ day, onClose }: { day: Day; onClose: () => void }) {
  const { snap, today, actions } = useApp()
  const r = dayRitual(snap, day, today)
  const cycle = snap.cycle_days.find(c => c.day === day)
  const checkin = snap.daily_checkins.find(c => c.day === day)
  const journal = snap.journal_entries.find(j => j.day === day)
  const [text, setText] = useState(journal?.text ?? '')
  const workouts = snap.workouts.filter(w => w.day === day)
  const meals = snap.meals.filter(m => m.day === day)
  const foods = snap.food_entries.filter(f => f.day === day)
  const statusText = { honore: `Rendez-vous honoré (${r.minutes} min)`, 'petit-pas': `Petit pas (${r.minutes} min)`, repos: 'Repos choisi', manque: 'Rendez-vous non fait', 'a-venir': 'Rendez-vous prévu', libre: 'Pas de rendez-vous prévu' }[r.status]
  return (
    <Sheet title={formatDayLong(day)} onClose={onClose}>
      <div className="card flat">
        <div className="row between"><strong>Sport</strong><span className={`pill ${r.status === 'honore' ? 'ok' : r.status === 'repos' ? 'rest' : ''}`}>{statusText}</span></div>
        {workouts.map(w => <div key={w.id} className="small muted">• {w.kind === 'externe' ? EXTERNAL_ACTIVITIES.find(a => a.id === w.activity)?.label : (w.program ?? FOCUS_LABELS[w.activity as Focus])} — {w.actual_minutes} min</div>)}
        <div className="row between"><strong>Eau</strong><span className="small">{formatLitres(waterMl(snap, day))} / {formatLitres(waterGoalMl(snap), 1)}</span></div>
        <div className="row between"><strong>Repas</strong><span className="small">{foods.length ? `${fmtKcal(dayTotals(snap, day).kcal)} · ${foods.length} aliment${foods.length > 1 ? 's' : ''}` : meals.length ? meals.map(m => m.title).join(', ') : '—'}</span></div>
        {(foods.length > 0 || day <= today) && <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(`/repas?onglet=journal&jour=${day}`)}>Voir le journal de ce jour</button>}
        <div className="row between"><strong>Énergie</strong><span className="small">{checkin?.energy ? ENERGY_LABELS[checkin.energy] : '—'}</span></div>
      </div>
      <div className="card flat">
        <Toggle label="Règles ce jour-là" checked={Boolean(cycle?.period)} onChange={v => actions.saveCycleDay(day, { period: v, flow: v ? cycle?.flow ?? 'moyen' : null })} />
        {cycle?.period && <Chips label="Flux" soft value={cycle.flow} onChange={v => actions.saveCycleDay(day, { flow: v })}
          options={[{ id: 'spotting', label: 'Spotting' }, { id: 'leger', label: 'Léger' }, { id: 'moyen', label: 'Moyen' }, { id: 'abondant', label: 'Abondant' }]} />}
        <strong className="small">Ressentis <span className="muted">(facultatif)</span></strong>
        <Chips label="Ressentis" multi soft value={cycle?.symptoms ?? []} onChange={v => actions.saveCycleDay(day, { symptoms: v })} options={SYMPTOMS.map(s => ({ id: s, label: s }))} />
      </div>
      <label className="field">Mon journal <span className="hint">Quelques mots sur ta journée, pour toi seule</span>
        <textarea className="input" value={text} onChange={e => setText(e.target.value)} onBlur={() => text.trim() !== (journal?.text ?? '') && actions.saveJournal(day, text.trim(), null)} />
      </label>
      <button className="btn primary block" onClick={async () => { if (text.trim() !== (journal?.text ?? '')) await actions.saveJournal(day, text.trim(), null); onClose() }}>Fermer</button>
    </Sheet>
  )
}

// ------------------------------------------------------------------ régularité & analyse
function Regularity() {
  const { snap, today, actions } = useApp()
  const sport = sportCommitment(snap)
  const consent = snap.profiles[0]?.analysis_consent ?? true
  const from28 = addDays(today, -27)
  const st = rendezvousStats(snap, from28, today, today)
  const rep = reprises(snap, today)
  const engagements = commitmentRate(snap, from28, today, today)
  const startedHabits = snap.commitments.filter(c => c.active).length
  const keptHabits = snap.commitments.filter(c => c.active && ['automatique', 'en-bonne-voie'].includes(automaticity(snap, c, today).level)).length
  const slots = bestSlots(snap, from28, today)
  const dur = completionByDuration(snap, from28, today)
  const analysis = useMemo(() => (consent ? analyze(snap, today) : null), [snap, today, consent])
  const [obstacle, setObstacle] = useState<Insight | null>(null)
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const ws = addDays(weekStart(today), -7 * (5 - i))
    const s = rendezvousStats(snap, ws, addDays(ws, 6) > today ? today : addDays(ws, 6), today)
    return { ws, ...s }
  })
  const obstacles = snap.obstacle_reports.reduce<Record<string, number>>((acc, o) => { acc[o.obstacle] = (acc[o.obstacle] ?? 0) + 1; return acc }, {})
  const OB: Record<string, string> = { horaire: 'L\'horaire', fatigue: 'La fatigue', preparation: 'La préparation', motivation: 'L\'envie', autre: 'Autre chose' }

  return (
    <>
      <section className="card tint">
        <div className="kicker">4 dernières semaines</div>
        <h2>{st.rate === null ? 'Ta régularité se dessine dès les premiers rendez-vous' : `${st.honored} rendez-vous honorés sur ${st.scheduled - (st.rests - st.restsNoDesire)} prévus`}</h2>
        <p className="muted small">Repos choisis pour fatigue ou imprévu : {st.rests - st.restsNoDesire} · Petits pas : {st.smallSteps} · Séances bonus : {st.bonus}</p>
        {engagements.rate !== null && <p className="small"><strong>{Math.round(engagements.rate * 100)} %</strong> de tous tes engagements tenus ({engagements.done} sur {engagements.planned}, version minimale comprise) · {startedHabits} habitude{startedHabits > 1 ? 's' : ''} en cours, dont {keptHabits} qui s'installe{keptHabits > 1 ? 'nt' : ''}.</p>}
        <div className="bars" aria-label="Rendez-vous honorés par semaine">
          {weeks.map(w => {
            const planned = Math.max(1, w.scheduled - (w.rests - w.restsNoDesire))
            return (
              <div className="bar" key={w.ws} title={`${w.honored}/${planned}`}>
                <i style={{ height: `${Math.max(4, (w.honored / planned) * 100)}%` }} />
                <span>{parseDay(w.ws).getDate()}/{parseDay(w.ws).getMonth() + 1}</span>
              </div>
            )
          })}
        </div>
        <p className="muted small">Pas de note globale ici : seulement ce qui t'aide à comprendre ton rythme.</p>
      </section>

      <section className="card">
        <h2>Ce qui te réussit</h2>
        <div className="list">
          <div className="list-item"><span className="emoji-bubble">🔁</span><div className="grow"><div className="title">{rep.length} reprise{rep.length > 1 ? 's' : ''} après une pause</div><div className="muted small">Revenir est une compétence : chacune compte.</div></div></div>
          <div className="list-item"><span className="emoji-bubble">🕔</span><div className="grow"><div className="title">{slots.total >= 3 ? `Tu bouges surtout ${SLOT_LABELS[slots.slots[0].slot]}` : 'Moment favori : pas encore assez de séances'}</div>
            {slots.total >= 3 && <div className="muted small">{slots.slots.map(s => `${SLOT_LABELS[s.slot]} : ${s.n}`).join(' · ')}</div>}</div></div>
          <div className="list-item"><span className="emoji-bubble">⏱️</span><div className="grow"><div className="title">Durées terminées</div>
            <div className="muted small">{(Object.keys(dur) as (keyof typeof dur)[]).filter(k => dur[k].started).map(k => `${BUCKET_LABELS[k]} : ${dur[k].finished}/${dur[k].started}`).join(' · ') || 'Les séances guidées apparaîtront ici.'}</div></div></div>
          {Object.keys(obstacles).length > 0 && <div className="list-item"><span className="emoji-bubble">🧱</span><div className="grow"><div className="title">Obstacles que tu as identifiés</div>
            <div className="muted small">{Object.entries(obstacles).map(([k, n]) => `${OB[k]} (${n})`).join(' · ')}</div></div></div>}
        </div>
      </section>

      <section className="card">
        <h2>Mes habitudes</h2>
        <div className="list">
          {snap.commitments.filter(c => c.active).map(c => {
            const a = automaticity(snap, c, today)
            const label = { automatique: 'Devenue automatique', 'en-bonne-voie': 'En bonne voie', 'a-renforcer': 'À renforcer, tout doucement', 'trop-tot': 'Trop tôt pour le dire' }[a.level]
            return <div className="list-item" key={c.id}><div className="grow"><div className="title">{c.title}</div><div className="muted small">{a.weeksCounted ? `${a.weeksHeld} semaine${a.weeksHeld > 1 ? 's' : ''} tenue${a.weeksHeld > 1 ? 's' : ''} sur ${a.weeksCounted}` : 'Commencée récemment'}</div></div>
              <span className={`pill ${a.level === 'automatique' ? 'ok' : a.level === 'en-bonne-voie' ? 'gold' : ''}`}>{label}</span></div>
          })}
        </div>
      </section>

      <div className="section-title"><h2>Analyse de mes habitudes</h2></div>
      {!consent ? (
        <section className="card flat">
          <p className="muted">L'analyse est désactivée. Elle n'utilise que les données enregistrées dans l'appli, sur ton téléphone, sans intelligence artificielle externe.</p>
          <button className="btn secondary" onClick={() => actions.updateProfile({ analysis_consent: true })}>Activer l'analyse</button>
        </section>
      ) : (
        <>
          {analysis!.insights.map(ins => (
            <section className="card" key={ins.key}>
              <h3>{ins.title}</h3>
              <p><strong>Ce que montrent tes données : </strong>{ins.observation}</p>
              <p className="muted small">{ins.explanation}</p>
              <p><strong>Suggestion : </strong>{ins.suggestion}</p>
              <div className="row wrap">
                {ins.action.type === 'ask-obstacle'
                  ? <button className="btn primary sm" onClick={() => setObstacle(ins)}>Répondre</button>
                  : ins.action.type !== 'none' && <button className="btn primary sm" onClick={() => actions.decideInsight(ins, 'acceptee')}>Accepter</button>}
                {ins.editable && <button className="btn secondary sm" onClick={async () => { await actions.decideInsight(ins, 'modifiee'); navigate('/profil/engagements') }}>Modifier</button>}
                <button className="btn ghost sm" onClick={() => actions.decideInsight(ins, ins.action.type === 'none' ? 'acceptee' : 'ignoree')}>{ins.action.type === 'none' ? 'Noté' : 'Ignorer'}</button>
              </div>
            </section>
          ))}
          {!analysis!.insights.length && <section className="card flat"><p className="muted">Aucune tendance nette pour l'instant. Élan n'affiche une tendance que lorsqu'il y a assez de données pour qu'elle ait du sens.</p></section>}
          {analysis!.notEnough.length > 0 && (
            <details className="card flat"><summary style={{ fontWeight: 800, cursor: 'pointer' }}>Ce qui ne peut pas encore être analysé</summary>
              <ul className="muted small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{analysis!.notEnough.map(n => <li key={n}>{n}</li>)}</ul></details>
          )}
          <button className="btn ghost sm" onClick={() => actions.updateProfile({ analysis_consent: false })}>Désactiver l'analyse</button>
        </>
      )}

      <section className="card prune">
        <h3>Bilan de la semaine</h3>
        <p className="muted">Un regard bienveillant sur la semaine, et une seule intention pour la suivante.</p>
        <button className="btn white" onClick={() => navigate('/progres/bilan')}>Faire mon bilan</button>
      </section>
      {sport && obstacle && <ObstacleSheet onClose={() => setObstacle(null)} insight={obstacle} />}
    </>
  )
}

function ObstacleSheet({ onClose, insight }: { onClose: () => void; insight: Insight }) {
  const { actions } = useApp()
  const [ob, setOb] = useState<Obstacle | null>(null)
  const [note, setNote] = useState('')
  const advice: Record<Obstacle, { text: string; to: string }> = {
    horaire: { text: 'Changer l\'heure ou les jours de ton rendez-vous peut suffire.', to: '/profil/engagements' },
    fatigue: { text: 'Prévoir d\'office la version minimale les jours chargés garde le lien sans t\'épuiser.', to: '/profil/engagements' },
    preparation: { text: 'Préparer ta tenue la veille enlève une décision au moment d\'agir.', to: '/profil/engagements' },
    motivation: { text: 'Pas besoin d\'envie : la version minimale et les cinq premières minutes sont faites pour ça.', to: '/rituel' },
    autre: { text: 'Merci, c\'est noté. Tu peux ajuster ton engagement quand tu veux.', to: '/profil/engagements' },
  }
  return (
    <Sheet title="Qu'est-ce qui bloque le plus ?" onClose={onClose}>
      <Chips label="Obstacle" value={ob} onChange={setOb} options={[
        { id: 'horaire', label: 'L\'horaire' }, { id: 'fatigue', label: 'La fatigue' }, { id: 'preparation', label: 'La préparation' }, { id: 'motivation', label: 'L\'envie' }, { id: 'autre', label: 'Autre' },
      ]} />
      <label className="field">En quelques mots <span className="hint">Facultatif</span><input className="input" value={note} onChange={e => setNote(e.target.value)} /></label>
      {ob && <div className="banner" style={{ background: 'var(--poudre)', color: 'var(--prune-fonce)' }}>{advice[ob].text}</div>}
      <button className="btn primary block" disabled={!ob} onClick={async () => {
        await actions.reportObstacle(ob!, note.trim() || null)
        await actions.decideInsight(insight, 'acceptee')
        onClose(); navigate(advice[ob!].to)
      }}>Enregistrer et ajuster</button>
    </Sheet>
  )
}

// ------------------------------------------------------------------ badges
function Badges() {
  const { snap } = useApp()
  const owned = new Map(snap.reward_grants.filter(g => g.kind === 'badge').map(g => [g.ref, g]))
  const visible = BADGES.filter(b => !b.secret)
  const secrets = BADGES.filter(b => b.secret && owned.has(b.id))
  const [open, setOpen] = useState<string | null>(null)
  const sel = BADGES.find(b => b.id === open)
  return (
    <>
      <section className="card">
        <h2>Mes badges</h2>
        <p className="muted small">{owned.size} obtenu{owned.size > 1 ? 's' : ''}. Ils récompensent la régularité, la reprise et la curiosité, jamais la balance.</p>
        <div className="badge-grid">
          {visible.map(b => (
            <button key={b.id} className={`badge ${owned.has(b.id) ? '' : 'locked'}`} onClick={() => setOpen(b.id)}>
              <span className="medal" aria-hidden="true">{b.emoji}</span><span className="name">{b.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card prune">
        <h2>Badges secrets</h2>
        {secrets.length ? (
          <div className="badge-grid">{secrets.map(b => <button key={b.id} className="badge" onClick={() => setOpen(b.id)}><span className="medal" aria-hidden="true">{b.emoji}</span><span className="name" style={{ color: 'var(--texte)' }}>{b.name}</span></button>)}</div>
        ) : <p className="muted">Certains badges ne se révèlent qu'au moment où tu les obtiens. Continue ton chemin, ils viendront à toi.</p>}
      </section>
      {sel && (
        <Sheet title={sel.name} onClose={() => setOpen(null)}>
          <div className="celebrate"><span className="big" aria-hidden="true">{sel.emoji}</span>
            <p>{sel.description}</p>
            {owned.has(sel.id) ? <span className="pill ok">Obtenu le {new Date(owned.get(sel.id)!.granted_at).toLocaleDateString('fr-FR')}</span> : <span className="pill">À débloquer</span>}
          </div>
        </Sheet>
      )}
    </>
  )
}

// ------------------------------------------------------------------ capsules (liste)
function CapsuleList() {
  const { snap, today } = useApp()
  const caps = [...snap.progress_capsules].sort((a, b) => b.created_day.localeCompare(a.created_day))
  return (
    <>
      <section className="card tint">
        <h2>Capsules temporelles</h2>
        <p className="muted">Garde une trace de ce que tu vis, même quand la balance ne bouge pas, et écris un message à ton toi du futur.</p>
        <button className="btn primary" onClick={() => navigate('/progres/capsule/nouvelle')}><IconPlus /> Créer une capsule</button>
      </section>
      {caps.map(c => {
        const access = capsuleAccess(c, today)
        const left = c.open_on ? Math.max(0, Math.round((parseDay(c.open_on).getTime() - parseDay(today).getTime()) / 86400000)) : 0
        return (
          <button key={c.id} className="card" style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/progres/capsule/' + c.id)}>
            <div className="card-head">
              <span className="emoji-bubble" aria-hidden="true">{access === 'ouverte' ? '💌' : access === 'prete' ? '🎁' : <IconLock style={{ width: 22, color: 'var(--prune)' }} />}</span>
              <div><div className="kicker">Créée le {formatDayLong(c.created_day)}</div>
                <strong>{access === 'ouverte' ? 'Capsule ouverte' : access === 'prete' ? 'Prête à être ouverte !' : access === 'deblocage-en-cours' ? 'Ouverture anticipée demandée' : `S'ouvre dans ${left} jour${left > 1 ? 's' : ''}`}</strong></div>
              <IconChevron style={{ width: 18 }} />
            </div>
          </button>
        )
      })}
    </>
  )
}

export const _today = toDay
