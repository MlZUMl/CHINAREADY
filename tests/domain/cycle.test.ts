// Suivi du cycle : dates réelles vs prévisions, statistiques, ovulation estimée / confirmée, retard, rappels.
import { describe, it, expect } from 'vitest'
import { baseSnap } from '../helpers'
import { periodRuns, cycleHistory, cycleStats, forecast, futureFertility, delayMessage, desiredCyclePushes, CONFIDENCE_TEXT } from '../../src/domain/cycle'
import { addDays } from '../../src/lib/dates'
import type { CycleDay } from '../../src/data/types'
import { DataStore } from '../../src/data/store'
import { createActions } from '../../src/app/actions'

const cd = (day: string, extra: Partial<CycleDay> = {}): CycleDay => ({ id: day, day, period: true, flow: 'moyen', symptoms: [], note: null, created_at: '', updated_at: '', ...extra })
/** Règles de `n` jours à partir de `start` (dernier jour marqué « fin » si end). */
const period = (start: string, n: number, end = true) => Array.from({ length: n }, (_, i) => cd(addDays(start, i), { period_end: end && i === n - 1 }))

// Débuts : 27 juil., 26 août (30 j), 27 sept. (32 j) — aujourd'hui 20 oct.
const HIST = [...period('2026-07-27', 4), ...period('2026-08-26', 5), ...period('2026-09-27', 4)]
const TODAY = '2026-10-20'

describe('dates réelles', () => {
  it('regroupe les jours en périodes ; un jour oublié ne coupe pas les règles ; une fin indiquée, si', () => {
    const days = [cd('2026-10-01'), cd('2026-10-02'), cd('2026-10-04', { period_end: true }), cd('2026-10-05')]
    const runs = periodRuns(days, '2026-10-20')
    expect(runs.map(r => [r.start, r.length, r.endConfirmed])).toEqual([['2026-10-01', 4, true], ['2026-10-05', 1, false]])
  })
  it('règles en cours tant que la fin n\'est pas notée et que le dernier jour est récent', () => {
    const runs = periodRuns([cd('2026-10-19'), cd('2026-10-20')], '2026-10-20')
    expect(runs[0].ended).toBe(false)
    expect(periodRuns([cd('2026-10-10'), cd('2026-10-11')], '2026-10-20')[0].ended).toBe(true)
  })
})

describe('statistiques (calculées uniquement sur les données notées)', () => {
  it('durées, moyennes, variations et régularité', () => {
    const st = cycleStats(HIST, TODAY)
    expect(st).toMatchObject({ cyclesCount: 2, lastCycle: 32, lastCycleStatus: 'normal', lastPeriod: 4, lastPeriodStatus: 'normal', avgCycle: 31, minCycle: 30, maxCycle: 32, regularity: 'regulier' })
    expect(st.avgPeriod).toBe(4) // (4 + 5 + 4) / 3 arrondi
  })
  it('cycles irréguliers et durée hors repères signalés sans diagnostic', () => {
    const irr = [...period('2026-05-01', 4), ...period('2026-05-28', 4), ...period('2026-07-10', 4), ...period('2026-08-06', 10)]
    const st = cycleStats(irr, TODAY)
    expect([st.minCycle, st.maxCycle, st.regularity]).toEqual([27, 43, 'irregulier'])
    expect(st.lastCycleStatus).toBe('normal') // 27 jours
    expect(st.lastPeriodStatus).toBe('attention') // 10 jours
    expect(forecast(irr, TODAY).confidence).toBe('moyenne')
  })
  it('un cycle anormalement long (oubli probable) est montré mais exclu des moyennes', () => {
    const days = [...period('2026-03-01', 4), ...period('2026-03-29', 4), ...period('2026-06-20', 4), ...period('2026-07-18', 4)]
    const hist = cycleHistory(days, TODAY)
    expect(hist.map(h => [h.length, h.valid])).toEqual([[28, true], [83, false], [28, true], [null, true]])
    expect(cycleStats(days, TODAY).avgCycle).toBe(28)
  })
  it('aucune donnée : rien d\'inventé', () => {
    expect(cycleStats([], TODAY)).toMatchObject({ cyclesCount: 0, lastCycle: null, avgCycle: null, regularity: 'inconnu' })
    expect(forecast([], TODAY)).toMatchObject({ confidence: 'aucune', nextStart: null, predictedPeriod: [] })
  })
})

describe('prévisions', () => {
  it('prochaines règles = dernier début + cycle moyen ; jamais confondues avec les dates notées', () => {
    const f = forecast(HIST, TODAY)
    expect(f).toMatchObject({ lastStart: '2026-09-27', cycleLength: 31, nextStart: '2026-10-28', cycleDay: 24, delayDays: 0, confidence: 'moyenne' })
    expect(f.nextRange).toEqual(['2026-10-27', '2026-10-29']) // fourchette tant qu'il y a peu de cycles
    expect(f.predictedPeriod.slice(0, 4)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'])
    const real = new Set(HIST.map(c => c.day))
    expect(f.predictedPeriod.some(d => real.has(d) || d <= TODAY)).toBe(false)
  })
  it('ovulation estimée 14 jours avant les règles, fenêtre fertile de 7 jours ; ovulation confirmée prioritaire', () => {
    const f = forecast(HIST, TODAY)
    expect(f.ovulation).toBe('2026-10-14')
    expect(f.fertile).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'])
    const withTest = [...HIST, cd('2026-10-16', { period: false, flow: null, ovulation_confirmed: true })]
    const g = forecast(withTest, TODAY)
    expect(g.ovulation).toBeNull()
    expect(g.ovulationConfirmed).toBe('2026-10-16')
    expect(g.fertile[5]).toBe('2026-10-16')
    expect(futureFertility(f).ovulation).toEqual(['2026-11-14', '2026-12-15'])
  })
  it('un seul début noté : cycle de 28 jours par défaut, certitude faible affichée', () => {
    const f = forecast(period('2026-10-05', 5), TODAY)
    expect(f).toMatchObject({ usesDefault: true, confidence: 'faible', nextStart: '2026-11-02' })
    expect(CONFIDENCE_TEXT.faible).toMatch(/approximative/)
  })
  it('l\'historique compare la prévision faite à l\'époque et la date réelle', () => {
    const hist = cycleHistory(HIST, TODAY)
    expect(hist[2]).toMatchObject({ start: '2026-09-27', predictedStart: '2026-09-25', diff: 2, ovulationEstimate: null })
    expect(hist[1].ovulationEstimate).toBe('2026-09-13')
  })
})

describe('retard', () => {
  it('retard mesuré par rapport à la prévision, sans prévision dans le passé ni conclusion', () => {
    const f = forecast(HIST, '2026-11-03')
    expect(f.delayDays).toBe(6)
    expect(f.predictedPeriod[0]).toBe('2026-11-04')
    expect(f.ovulation).toBeNull()
    const m = delayMessage(6)!
    expect(m.title).toBe('Retard estimé de 6 jours')
    expect(`${m.title} ${m.text} ${delayMessage(2)!.text}`).not.toMatch(/enceinte|grossesse/i)
    expect(delayMessage(0)).toBeNull()
  })
  it('les règles notées font disparaître le retard', () => {
    expect(forecast([...HIST, cd('2026-11-03')], '2026-11-03')).toMatchObject({ delayDays: 0, lastStart: '2026-11-03' })
  })
})

describe('rappels du cycle', () => {
  it('règles dans 2 jours et retard (+5 j) ; fin des règles à noter pendant des règles en cours', () => {
    const s = baseSnap()
    s.cycle_days = HIST
    const now = new Date('2026-10-20T12:00:00')
    expect(desiredCyclePushes(s, TODAY, now).map(p => p.id)).toEqual(['cycle:avant:2026-10-28', 'cycle:retard:2026-10-28'])
    s.cycle_days = [...HIST, cd('2026-10-27'), cd('2026-10-28')]
    expect(desiredCyclePushes(s, '2026-10-28', new Date('2026-10-28T12:00:00')).map(p => p.id)).toEqual(['cycle:fin:2026-10-27'])
    s.notification_preferences = [{ ...s.notification_preferences[0], cycle: false }]
    expect(desiredCyclePushes(s, '2026-10-28', new Date('2026-10-28T12:00:00'))).toEqual([])
  })
})

describe('actions (stockage réel)', () => {
  it('noter des règles, la fin, les supprimer ; rapports privés ; rappels recalés', async () => {
    const store = await DataStore.open('cycle-' + Math.random())
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'M', waterMl: 2000, equipment: [] })
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    const start = addDays(today, -40)
    await actions.logPeriod(start, addDays(start, 3), 'leger')
    let s = store.snapshot()
    expect(s.cycle_days.filter(c => c.period)).toHaveLength(4)
    expect(s.cycle_days.find(c => c.day === addDays(start, 3))?.period_end).toBe(true)
    // règles en cours depuis hier : un rappel « fin » est programmé, les rappels « avant / retard » non
    await actions.logPeriod(addDays(today, -1), null)
    s = store.snapshot()
    expect(s.scheduled_pushes.filter(p => p.kind === 'cycle').map(p => p.id)).toEqual([`cycle:fin:${addDays(today, -1)}`])
    await actions.endPeriod(today)
    s = store.snapshot()
    expect(forecast(s.cycle_days, today).ongoing).toBeNull()
    expect(s.scheduled_pushes.some(p => p.id.startsWith('cycle:fin'))).toBe(false)
    expect(s.scheduled_pushes.some(p => p.id.startsWith('cycle:avant'))).toBe(true)
    await expect(actions.logPeriod(addDays(today, 1), null)).rejects.toThrow('DATES')
    await actions.deletePeriod(start)
    expect(store.snapshot().cycle_days.some(c => c.day === start)).toBe(false)
    await actions.setIntimate(today, true, '  ')
    expect(store.snapshot().intimate_logs).toEqual([expect.objectContaining({ id: today, note: null })])
    await actions.setIntimate(today, false)
    expect(store.snapshot().intimate_logs).toHaveLength(0)
    store.close()
  })
})
