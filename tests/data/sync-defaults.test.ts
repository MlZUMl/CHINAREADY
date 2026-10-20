// Anciennes lignes locales : les colonnes ajoutées plus tard reçoivent leur valeur par défaut avant l'envoi.
import { describe, it, expect } from 'vitest'
import { fillDefaults } from '../../src/data/sync'
import type { Row } from '../../src/data/types'

const base = { id: 'x', created_at: '', updated_at: '' } as Row

describe('fillDefaults', () => {
  it('récompense ancienne sans points → 0, sans toucher aux points existants', () => {
    expect((fillDefaults('reward_grants', { ...base } as Row) as Row & { points: number }).points).toBe(0)
    expect((fillDefaults('reward_grants', { ...base, points: 5 } as Row) as Row & { points: number }).points).toBe(5)
  })
  it('réglages de rappels anciens → rappels de repas et cycle par défaut', () => {
    const r = fillDefaults('notification_preferences', { ...base, enabled: true } as Row) as unknown as Record<string, unknown>
    expect(r).toMatchObject({ enabled: true, meal_reminders: true, lunch_time: '13:30', dinner_time: '20:30', cycle: true })
  })
  it('valeur choisie (false) conservée ; autres tables inchangées', () => {
    expect((fillDefaults('notification_preferences', { ...base, meal_reminders: false } as Row) as unknown as Record<string, unknown>).meal_reminders).toBe(false)
    const w = { ...base, kg: 70 } as Row
    expect(fillDefaults('weights', w)).toBe(w)
  })
})
