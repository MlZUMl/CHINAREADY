// Migration 0008 : repas favoris, rappels de repas, mensurations, sommeil.
import { describe, it, expect, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, asUser, USER_A, USER_B } from './supabase-stub'

let db: PGlite
beforeAll(async () => { db = await createDb() }, 60000)

describe('v1.4', () => {
  it('repas favoris : privés, repas valide, au moins un aliment', async () => {
    const items = JSON.stringify([{ source: 'ciqual', ref: '1', name: 'Pomme', kcal: 52 }])
    await asUser(db, USER_A, `insert into favorite_meals (id, name, meal, items) values ('f1', 'Petit-déj', 'petit-dejeuner', '${items}')`)
    expect((await asUser(db, USER_A, 'select * from favorite_meals')).rows).toHaveLength(1)
    expect((await asUser(db, USER_B, 'select * from favorite_meals')).rows).toHaveLength(0)
    expect((await asUser(db, null, 'select * from favorite_meals')).rows).toHaveLength(0)
    await expect(asUser(db, USER_A, `insert into favorite_meals (id, name, meal, items) values ('f2', 'X', 'brunch', '${items}')`)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into favorite_meals (id, name, meal, items) values ('f3', 'X', 'diner', '[]')`)).rejects.toThrow()
  })

  it('mensurations : une ligne par jour, valeurs plausibles, privées', async () => {
    await asUser(db, USER_A, `insert into body_measurements (id, day, waist_cm, hips_cm) values ('2026-10-20', '2026-10-20', 82.5, 104)`)
    expect((await asUser(db, USER_B, 'select * from body_measurements')).rows).toHaveLength(0)
    await expect(asUser(db, USER_A, `insert into body_measurements (id, day, waist_cm) values ('x', '2026-10-21', 900)`)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into body_measurements (id, day, waist_cm) values ('y', '2026-10-20', 80)`)).rejects.toThrow() // même jour
  })

  it('sommeil dans le check-in du jour', async () => {
    await asUser(db, USER_A, `insert into daily_checkins (id, day, energy, sleep_hours, sleep_quality) values ('2026-10-20', '2026-10-20', 3, 7.5, 4)`)
    const r = await asUser<{ sleep_hours: string; sleep_quality: number }>(db, USER_A, 'select sleep_hours, sleep_quality from daily_checkins')
    expect(Number(r.rows[0].sleep_hours)).toBe(7.5)
    await expect(asUser(db, USER_A, `insert into daily_checkins (id, day, sleep_quality) values ('2026-10-21', '2026-10-21', 9)`)).rejects.toThrow()
  })

  it('rappel de repas : à l\'heure choisie, seulement si le repas n\'est pas noté, désactivable', async () => {
    await db.exec(`
      insert into notification_preferences (user_id, id, enabled, timezone, hydration) values ('${USER_B}', 'notif', true, 'Europe/Paris', false);
      insert into push_subscriptions (user_id, id, endpoint, p256dh, auth) values ('${USER_B}', 's', 'https://push.example/b', 'k', 'a');
    `)
    // 13 h 35 à Paris (heure d'été) = 11 h 35 UTC
    const due = async (at = '2026-10-20T11:35:00Z') => (await db.query<{ key: string; url: string }>(`select key, url from elan_private.due_notifications('${at}') where user_id = '${USER_B}' and tag = 'repas'`)).rows
    expect(await due()).toEqual([{ key: 'repas:2026-10-20:dejeuner', url: '#/repas/ajouter?repas=dejeuner' }])
    expect(await due('2026-10-20T11:25:00Z')).toEqual([]) // avant l'heure
    expect(await due('2026-10-20T12:05:00Z')).toEqual([]) // fenêtre de 30 minutes passée
    expect((await due('2026-10-20T18:31:00Z')).map(r => r.key)).toEqual(['repas:2026-10-20:diner'])
    await db.exec(`insert into food_entries (user_id, id, day, meal, source, name, quantity, unit) values ('${USER_B}', 'e', '2026-10-20', 'dejeuner', 'rapide', 'Salade', 1, 'portion')`)
    expect(await due()).toEqual([])
    await db.exec(`update notification_preferences set meal_reminders = false, dinner_time = '19:00' where user_id = '${USER_B}'`)
    expect(await due('2026-10-20T17:05:00Z')).toEqual([])
    await db.exec(`update notification_preferences set meal_reminders = true where user_id = '${USER_B}'`)
    expect((await due('2026-10-20T17:05:00Z')).map(r => r.key)).toEqual(['repas:2026-10-20:diner'])
  })
})
