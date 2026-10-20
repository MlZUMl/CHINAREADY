// Migration 0006 : points (reward_grants) et achats de la boutique, sur un vrai Postgres.
import { describe, it, expect, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, asUser, USER_A, USER_B } from './supabase-stub'

let db: PGlite
beforeAll(async () => { db = await createDb() }, 60000)

describe('points et boutique', () => {
  it('une récompense en points par jour et par objectif : la clé empêche tout doublon', async () => {
    const sql = `insert into reward_grants (id, kind, ref, xp, points, reason) values ('points:seance:2026-10-20', 'points', 'seance', 0, 300, 'Séance du jour')`
    await asUser(db, USER_A, sql)
    await expect(asUser(db, USER_A, sql)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into reward_grants (id, kind, ref, points, reason) values ('triche', 'points', 'x', 5000, 'x')`)).rejects.toThrow()
    const old = await asUser<{ points: number }>(db, USER_A, `insert into reward_grants (id, kind, ref, xp, reason) values ('xp:rdv:2026-10-20', 'xp', 'rdv', 10, 'RDV') returning points`)
    expect(old.rows[0].points).toBe(0)
  })
  it('un objet ne s\'achète qu\'une fois, achats privés', async () => {
    await asUser(db, USER_A, `insert into shop_purchases (id, item_id, price) values ('frange', 'frange', 300)`)
    await expect(asUser(db, USER_A, `insert into shop_purchases (id, item_id, price) values ('frange', 'frange', 300)`)).rejects.toThrow()
    expect((await asUser(db, USER_B, 'select * from shop_purchases')).rows).toHaveLength(0)
    await expect(asUser(db, USER_A, `insert into shop_purchases (user_id, id, item_id, price) values ('${USER_B}', 'x', 'x', 1)`)).rejects.toThrow()
    const solde = await asUser<{ solde: number }>(db, USER_A, `select (select coalesce(sum(points), 0) from reward_grants) - (select coalesce(sum(price), 0) from shop_purchases) as solde`)
    expect(Number(solde.rows[0].solde)).toBe(0)
  })
})
