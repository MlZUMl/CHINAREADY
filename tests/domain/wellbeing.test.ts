// Progrès hors balance : mensurations, sommeil, énergie, bilan du mois et croisements.
import { describe, it, expect } from 'vitest'
import { baseSnap, workout } from '../helpers'
import type { BodyMeasurement, DailyCheckin } from '../../src/data/types'
import { crossings, fmtDiff, fmtHours, measureChange, monthReview, shiftMonth, sleepEnergy } from '../../src/domain/wellbeing'
import { addDays } from '../../src/lib/dates'
import { DataStore } from '../../src/data/store'
import { createActions } from '../../src/app/actions'

const m = (day: string, extra: Partial<BodyMeasurement>): BodyMeasurement => ({ id: day, day, waist_cm: null, hips_cm: null, chest_cm: null, thigh_cm: null, arm_cm: null, note: null, created_at: '', updated_at: '', ...extra })
const ck = (day: string, energy: number | null, sleep: number | null): DailyCheckin => ({ id: day, day, energy: energy as DailyCheckin['energy'], minutes: null, need: null, sleep_hours: sleep, sleep_quality: null, created_at: '', updated_at: '' })

describe('formats', () => {
  it('heures et écarts en français', () => {
    expect(fmtHours(7.5)).toBe('7 h 30')
    expect(fmtHours(8)).toBe('8 h')
    expect(fmtDiff(-2.5, 'cm')).toBe('−2,5 cm')
    expect(fmtDiff(1, 'kg')).toBe('+1 kg')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('mensurations', () => {
  it('évolution entre la première et la dernière mesure (les mesures absentes sont ignorées)', () => {
    const rows = [m('2026-09-01', { waist_cm: 84, hips_cm: 104 }), m('2026-09-20', { hips_cm: 103 }), m('2026-10-01', { waist_cm: 81.5 })]
    expect(measureChange(rows, 'waist_cm')).toMatchObject({ diff: -2.5, count: 2, first: { day: '2026-09-01' }, last: { value: 81.5 } })
    expect(measureChange(rows, 'hips_cm')!.diff).toBe(-1)
    expect(measureChange(rows, 'arm_cm')).toBeNull()
    expect(measureChange(rows, 'waist_cm', '2026-09-15')!.count).toBe(1)
  })
})

describe('sommeil et énergie', () => {
  it('moyennes calculées seulement sur les jours notés', () => {
    const s = baseSnap()
    s.daily_checkins = [ck('2026-10-18', 4, 8), ck('2026-10-19', 2, 6), ck('2026-10-20', null, 7)]
    expect(sleepEnergy(s, '2026-10-14', '2026-10-20')).toMatchObject({ sleepAvg: 7, sleepNights: 3, energyAvg: 3, energyDays: 2 })
  })

  it('croisements : affichés avec au moins 3 jours de chaque côté et un écart net, formulés comme des observations', () => {
    const s = baseSnap()
    const from = '2026-10-01'
    // nuits longues → énergie 4 ; nuits courtes → énergie 2 ; séance un jour sur deux, énergie du lendemain plus haute
    s.daily_checkins = Array.from({ length: 12 }, (_, i) => ck(addDays(from, i), i % 2 ? 4 : 2, i % 2 ? 8 : 6))
    s.workouts = Array.from({ length: 6 }, (_, i) => workout(addDays(from, i * 2), 20))
    const c = crossings(s, from, addDays(from, 11))
    expect(c.map(x => x.key)).toEqual(['sommeil-energie', 'seance-energie', 'seance-sommeil'])
    expect(c[0].text).toBe('Après une nuit de 7 h ou plus, ton énergie était en moyenne de 4/5, contre 2/5 après une nuit plus courte.')
    expect(c.map(x => x.text).join(' ')).not.toMatch(/parce que|grâce|prouve/)
    // pas assez de données : rien
    s.daily_checkins = s.daily_checkins.slice(0, 4)
    expect(crossings(s, from, addDays(from, 11))).toEqual([])
  })
})

describe('bilan du mois', () => {
  it('séances, repas, eau, sommeil, mesures et poids du mois ; arrêté à aujourd\'hui', () => {
    const s = baseSnap('2026-09-01')
    s.workouts = [workout('2026-10-05', 20), workout('2026-10-12', 15), workout('2026-09-28', 30)]
    s.daily_checkins = [ck('2026-10-02', 3, 7), ck('2026-10-03', 4, 8)]
    s.body_measurements = [m('2026-10-01', { waist_cm: 84 }), m('2026-10-15', { waist_cm: 82 })]
    s.weights = [{ id: '2026-10-01', day: '2026-10-01', kg: 70, note: null, created_at: '', updated_at: '' }, { id: '2026-10-15', day: '2026-10-15', kg: 69, note: null, created_at: '', updated_at: '' }]
    const r = monthReview(s, '2026-10', '2026-10-20')
    expect(r).toMatchObject({ label: 'octobre 2026', from: '2026-10-01', to: '2026-10-20', days: 20, sessions: 2, minutes: 35, sleepAvg: 7.5, energyAvg: 3.5 })
    expect(r.measures).toEqual([{ label: 'Tour de taille', diff: -2, last: 82 }])
    expect(r.weight).toEqual({ start: 70, end: 69.5, diff: -0.5 })
    expect(monthReview(s, '2026-09', '2026-10-20')).toMatchObject({ to: '2026-09-30', days: 30, sessions: 1 })
  })
})

describe('actions (stockage réel)', () => {
  it('mensurations facultatives, ligne vide supprimée ; sommeil dans le check-in', async () => {
    const store = await DataStore.open('corps-' + Math.random())
    const actions = createActions(store)
    await actions.completeOnboarding({ name: null, ritual: { days: [1], time: '17:15', usualMinutes: 20, minMinutes: 10, place: 'Salon' }, species: 'chat', companionName: 'M', waterMl: 2000, equipment: [] })
    await actions.saveMeasurements('2026-10-20', { waist_cm: 80, hips_cm: null })
    expect(store.snapshot().body_measurements).toEqual([expect.objectContaining({ id: '2026-10-20', waist_cm: 80, hips_cm: null })])
    await actions.saveMeasurements('2026-10-20', { hips_cm: 101 })
    expect(store.snapshot().body_measurements[0]).toMatchObject({ waist_cm: 80, hips_cm: 101 })
    await actions.saveMeasurements('2026-10-20', { waist_cm: null, hips_cm: null })
    expect(store.snapshot().body_measurements).toHaveLength(0)
    await actions.saveCheckin('2026-10-20', { energy: 4 })
    await actions.saveCheckin('2026-10-20', { sleep_hours: 7.5, sleep_quality: 4 })
    expect(store.snapshot().daily_checkins[0]).toMatchObject({ energy: 4, sleep_hours: 7.5, sleep_quality: 4 })
    store.close()
  })
})
