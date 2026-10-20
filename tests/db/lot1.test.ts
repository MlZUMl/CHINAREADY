// Migration 0005 : journal alimentaire, aliments personnels, eau en millilitres — sur un vrai Postgres.
import { describe, it, expect, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, asUser, USER_A, USER_B } from './supabase-stub'

let db: PGlite
beforeAll(async () => { db = await createDb() }, 60000)

const entry = (id: string, extra = '') => `insert into food_entries (id, day, meal, source, ref, name, quantity, unit, grams, per100, kcal, protein, carbs, fat, fiber${extra ? ', ' + extra.split('=')[0] : ''})
  values ('${id}', '2026-10-20', 'dejeuner', 'ciqual', '13039', 'Pomme', 150, 'g', 150, '{"kcal":52,"protein":0.3,"carbs":11.6,"fat":0.2,"fiber":2}', 78, 0.5, 17.4, 0.3, 3${extra ? ', ' + extra.split('=')[1] : ''})`

describe('journal alimentaire (food_entries)', () => {
  it('chacune ne voit et ne modifie que ses propres lignes', async () => {
    await asUser(db, USER_A, entry('f-a'))
    await asUser(db, USER_B, entry('f-b'))
    expect((await asUser<{ id: string }>(db, USER_A, 'select id from food_entries')).rows.map(r => r.id)).toEqual(['f-a'])
    const upd = await asUser(db, USER_B, `update food_entries set kcal = 1 where id = 'f-a'`)
    expect(upd.affectedRows ?? 0).toBe(0)
    await expect(asUser(db, USER_A, `insert into food_entries (user_id, id, day, meal, source, name, quantity, unit) values ('${USER_B}', 'x', '2026-10-20', 'diner', 'rapide', 'Test', 1, 'portion')`)).rejects.toThrow()
    expect((await asUser(db, null, 'select * from food_entries')).rows).toHaveLength(0)
  })

  it('refuse les valeurs incohérentes (repas inconnu, quantité nulle, unité inconnue)', async () => {
    await expect(asUser(db, USER_A, `insert into food_entries (id, day, meal, source, name, quantity, unit) values ('bad1', '2026-10-20', 'brunch', 'rapide', 'X', 1, 'portion')`)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into food_entries (id, day, meal, source, name, quantity, unit) values ('bad2', '2026-10-20', 'diner', 'rapide', 'X', 0, 'portion')`)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into food_entries (id, day, meal, source, name, quantity, unit) values ('bad3', '2026-10-20', 'diner', 'rapide', 'X', 1, 'tasse')`)).rejects.toThrow()
  })

  it('même identifiant = même ligne : une recette ajoutée deux fois ne fait pas de doublon', async () => {
    const sql = `insert into food_entries (id, day, meal, source, ref, name, quantity, unit, kcal) values ('recette:2026-10-20:diner:shakshuka', '2026-10-20', 'diner', 'recette', 'shakshuka', 'Shakshuka', 1, 'portion', 398)
      on conflict (user_id, id) do update set quantity = excluded.quantity, kcal = excluded.kcal`
    await asUser(db, USER_A, sql)
    await asUser(db, USER_A, sql)
    expect((await asUser(db, USER_A, `select * from food_entries where source = 'recette'`)).rows).toHaveLength(1)
  })
})

describe('aliments personnels (custom_foods)', () => {
  it('privés et avec un code-barres valide', async () => {
    await asUser(db, USER_A, `insert into custom_foods (id, name, per100, barcode) values ('c1', 'Galette', '{"kcal":380,"protein":8,"carbs":80,"fat":3,"fiber":4}', '3017620422003')`)
    expect((await asUser(db, USER_B, 'select * from custom_foods')).rows).toHaveLength(0)
    await expect(asUser(db, USER_A, `insert into custom_foods (id, name, per100, barcode) values ('c2', 'X', '{}', 'abc')`)).rejects.toThrow()
  })
})

describe('eau en millilitres et 5 rappels par défaut', () => {
  it('nouvelles colonnes avec des valeurs par défaut sûres', async () => {
    await asUser(db, USER_A, `insert into water_logs (id, day, glasses) values ('w-old', '2026-10-20', 1)`)
    await asUser(db, USER_A, `insert into water_logs (id, day, glasses, ml) values ('w-new', '2026-10-20', 1, 330)`)
    const r = await asUser<{ id: string; ml: number }>(db, USER_A, `select id, ml from water_logs order by id`)
    expect(r.rows).toEqual([{ id: 'w-new', ml: 330 }, { id: 'w-old', ml: 250 }])
    await expect(asUser(db, USER_A, `insert into water_logs (id, day, glasses, ml) values ('w-bad', '2026-10-20', 1, 5)`)).rejects.toThrow()
    await asUser(db, USER_A, `insert into profiles (id) values ('profile')`)
    expect((await asUser<{ water_goal_ml: number }>(db, USER_A, 'select water_goal_ml from profiles')).rows[0].water_goal_ml).toBe(2000)
    await asUser(db, USER_A, `insert into notification_preferences (id) values ('notif')`)
    const np = (await asUser<{ hydration: boolean; hydration_times: string[] }>(db, USER_A, 'select hydration, hydration_times from notification_preferences')).rows[0]
    expect(np.hydration).toBe(true)
    expect(np.hydration_times).toEqual(['09:30', '11:30', '13:30', '15:30', '18:30'])
  })
  it('recettes personnelles : lien source, photo et valeurs nutritionnelles', async () => {
    await asUser(db, USER_A, `insert into user_recipes (id, title, source_url, photo_url, nutrition) values ('r1', 'Ma soupe', 'https://exemple.fr/soupe', null, '{"kcal":320}')`)
    expect((await asUser<{ source_url: string }>(db, USER_A, 'select source_url from user_recipes')).rows[0].source_url).toBe('https://exemple.fr/soupe')
  })
})
