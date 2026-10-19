import { describe, it, expect } from 'vitest'
import { baseSnap, workout } from '../helpers'
import { capsuleAccess, canEdit, canReadContent, compareCapsule, buildCapsuleSnapshot } from '../../src/domain/capsules'
import { analyze } from '../../src/domain/analysis'
import { moodFor, messageFor, SPECIES } from '../../src/domain/companion'
import { weightTrend, cycleInfo } from '../../src/domain/body'
import { shoppingList, claudeCartPrompt, RECIPES } from '../../src/domain/recipes'
import type { ProgressCapsule } from '../../src/data/types'
import { addDays } from '../../src/lib/dates'

const capsule = (extra: Partial<ProgressCapsule> = {}): ProgressCapsule => ({
  id: 'c1', created_day: '2026-10-20', open_on: '2026-11-19', locked: true, has_photo: false, photo_path: null, weight_kg: null,
  energy: 3, habits: 'eau', difficulties: null, workouts_count: 3, success: 'tenir', note: null, future_message: 'Courage',
  snapshot: { workouts_last_30: 3 }, opened_at: null, reopen_note: null, unlock_requested_at: null, created_at: '', updated_at: '', ...extra,
})

describe('capsules temporelles', () => {
  it("reste inaccessible avant la date choisie, s'ouvre à la date prévue", () => {
    const c = capsule()
    expect(capsuleAccess(c, '2026-11-18')).toBe('verrouillee')
    expect(canReadContent(c, '2026-11-18')).toBe(false)
    expect(capsuleAccess(c, '2026-11-19')).toBe('prete')
    expect(capsuleAccess({ ...c, opened_at: '2026-11-19T10:00:00Z' }, '2026-11-19')).toBe('ouverte')
  })
  it('solution de récupération : ouverture anticipée possible après un délai de 24 h', () => {
    const c = capsule({ unlock_requested_at: '2026-10-25T10:00:00Z' })
    expect(capsuleAccess(c, '2026-10-25', new Date('2026-10-25T20:00:00Z'))).toBe('deblocage-en-cours')
    expect(capsuleAccess(c, '2026-10-26', new Date('2026-10-26T10:00:01Z'))).toBe('prete')
  })
  it('modifiable si non verrouillée ; verrouillée = lecture et modification impossibles', () => {
    expect(canEdit(capsule({ locked: false, open_on: null }), '2026-10-21')).toBe(true)
    expect(canEdit(capsule(), '2026-10-21')).toBe(false)
  })
  it("compare uniquement ce qui a été mesuré aux deux moments, sans inventer", () => {
    const s = baseSnap()
    s.workouts = [workout('2026-11-10', 20), workout('2026-11-12', 20)]
    const cmp = compareCapsule(capsule(), s, '2026-11-19', false)
    expect(cmp.find(x => x.label.startsWith('Séances'))).toEqual({ label: 'Séances sur 30 jours', then: '3', now: '2' })
    expect(cmp.some(x => x.label.startsWith('Poids'))).toBe(false)
    expect(cmp.some(x => x.label.startsWith('Énergie'))).toBe(false) // pas mesurée au départ
  })
  it("l'instantané ne contient que des données réelles", () => {
    const snap = buildCapsuleSnapshot(baseSnap(), '2026-10-20')
    expect(snap.workouts_last_30).toBe(0)
    expect(snap.avg_energy_30).toBeNull()
    expect(snap.weight_trend).toBeNull()
  })
})

describe('analyse des habitudes', () => {
  it("n'affiche aucune tendance sans données suffisantes, et le dit", () => {
    const r = analyze(baseSnap(), '2026-10-20')
    expect(r.insights).toHaveLength(0)
    expect(r.notEnough.length).toBeGreaterThan(2)
  })
  it('détecte que les séances courtes sont plus souvent terminées, avec le format complet', () => {
    const s = baseSnap()
    for (let i = 0; i < 4; i++) s.workouts.push(workout(addDays('2026-10-01', i), 15, { planned_minutes: 15 }))
    for (let i = 0; i < 4; i++) s.workouts.push(workout(addDays('2026-10-06', i), 10, { planned_minutes: 30, completed: true }))
    const r = analyze(s, '2026-10-20')
    const ins = r.insights.find(i => i.key === 'duree-courte')!
    expect(ins.observation).toMatch(/100 %.*0 %/)
    expect(ins.explanation).toMatch(/tendance/)
    expect(ins.action).toEqual({ type: 'set-usual-minutes', minutes: 15 })
  })
  it("une suggestion déjà acceptée ou ignorée n'est pas reproposée dans la même période", () => {
    const s = baseSnap()
    for (let i = 0; i < 4; i++) s.workouts.push(workout(addDays('2026-10-01', i), 15, { planned_minutes: 15 }))
    for (let i = 0; i < 4; i++) s.workouts.push(workout(addDays('2026-10-06', i), 10, { planned_minutes: 30 }))
    s.habit_insights = [{ id: 'x', insight_key: 'duree-courte', period: '2026-10-19', status: 'ignoree', observed: {}, decided_at: '', created_at: '', updated_at: '' }]
    expect(analyze(s, '2026-10-20').insights.some(i => i.key === 'duree-courte')).toBe(false)
  })
})

describe('compagnon', () => {
  const allLines = () => {
    const out: string[] = []
    for (const sp of SPECIES) for (const ctx of ['retour', 'seance-faite', 'journee-difficile', 'reprise', 'repos', 'rituel-maintenant', 'bonjour', 'nuit'] as const)
      for (let k = 0; k < 4; k++) out.push(messageFor(sp.id, { context: ctx, expression: 'content', reason: '' }, [], '2026-10-20', k).text)
    return out
  }
  it('réagit à une séance réellement terminée', () => {
    const s = baseSnap()
    s.workouts = [workout('2026-10-20', 20, { ended_at: new Date('2026-10-20T17:40:00').toISOString() })]
    expect(moodFor(s, new Date('2026-10-20T18:00:00')).context).toBe('seance-faite')
  })
  it('accueille sans reproche après plusieurs jours sans ouvrir l\'appli', () => {
    const s = baseSnap()
    s.day_presence = [{ id: '2026-10-15', day: '2026-10-15', first_at: '', created_at: '', updated_at: '' }]
    expect(moodFor(s, new Date('2026-10-20T09:00:00')).context).toBe('retour')
  })
  it("ne prétend pas connaître une fatigue qui n'a pas été déclarée", () => {
    const s = baseSnap()
    expect(moodFor(s, new Date('2026-10-20T10:00:00')).context).not.toBe('journee-difficile')
    s.daily_checkins = [{ id: '2026-10-20', day: '2026-10-20', energy: 2, minutes: null, need: null, created_at: '', updated_at: '' }]
    expect(moodFor(s, new Date('2026-10-20T10:00:00')).context).toBe('journee-difficile')
  })
  it('aucun message culpabilisant, triste ou menaçant', () => {
    for (const line of allLines()) expect(line).not.toMatch(/déçu|triste|abandonn|reproche|partir|tu m'as manqué|honte|dommage|pourquoi tu/i)
  })
  it('évite de répéter les messages récents', () => {
    const mood = { context: 'bonjour' as const, expression: 'content' as const, reason: '' }
    const first = messageFor('chat', mood, [], '2026-10-20')
    const second = messageFor('chat', mood, [{ id: 'i', at: '2026-10-20T08:00:00Z', context: 'bonjour', message_key: first.key, expression: 'content', created_at: '', updated_at: '' }], '2026-10-20')
    expect(second.key).not.toBe(first.key)
  })
})

describe('corps, cycle et courses', () => {
  it('tendance de poids lissée', () => {
    const t = weightTrend([{ id: 'a', day: '2026-10-01', kg: 70, note: null, created_at: '', updated_at: '' }, { id: 'b', day: '2026-10-08', kg: 69, note: null, created_at: '', updated_at: '' }])
    expect(t[1].trend).toBe(69.5)
  })
  it('cycle : durée moyenne et prochaine date estimée', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-29', '2026-08-30', '2026-09-26', '2026-09-27']
    const info = cycleInfo(days.map(d => ({ id: d, day: d, period: true, flow: null, symptoms: [], note: null, created_at: '', updated_at: '' })))
    expect(info.starts).toEqual(['2026-08-01', '2026-08-29', '2026-09-26'])
    expect(info.avgCycle).toBe(28)
    expect(info.nextStart).toBe('2026-10-24')
  })
  it('liste de courses : quantités additionnées selon les portions, placard à part', () => {
    const plan = { id: 'w', week_start: '2026-10-19', checked: [], created_at: '', updated_at: '', slots: [
      { day: '2026-10-19', moment: 'soir' as const, recipe_id: 'salade-grecque-poulet', portions: 2 },
      { day: '2026-10-20', moment: 'midi' as const, recipe_id: 'bowl-teriyaki', portions: 1 },
    ] }
    const list = shoppingList(plan)
    expect(list.find(i => i.name === 'Blanc de poulet halal')?.qty).toBe(370)
    expect(list.filter(i => i.pantry).every(i => i.aisle.startsWith('Placard'))).toBe(true)
    const prompt = claudeCartPrompt(list)
    expect(prompt).toMatch(/halal/)
    expect(prompt).toMatch(/ne valide pas la commande/)
  })
  it('recettes : halal, sans porc ni alcool, et aucune valeur calorique', () => {
    const text = JSON.stringify(RECIPES).toLowerCase()
    expect(text).not.toMatch(/porc|lardon|jambon|vin blanc|vin rouge|bière|rhum|kcal|calorie/)
    expect(RECIPES.length).toBeGreaterThanOrEqual(25)
  })
})
