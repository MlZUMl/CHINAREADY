import { describe, it, expect, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, asUser, USER_A, USER_B } from './supabase-stub'

let db: PGlite
beforeAll(async () => { db = await createDb() }, 60000)

describe('isolation des données entre deux utilisatrices (RLS)', () => {
  it('chacune ne voit que ses propres séances', async () => {
    await asUser(db, USER_A, `insert into workouts (id, day, started_at, kind, activity, actual_minutes)
      values ('w-a', '2026-10-20', now(), 'guidee', 'renfo', 12)`)
    await asUser(db, USER_B, `insert into workouts (id, day, started_at, kind, activity, actual_minutes)
      values ('w-b', '2026-10-20', now(), 'externe', 'velo', 30)`)
    const a = await asUser<{ id: string }>(db, USER_A, 'select id from workouts')
    const b = await asUser<{ id: string }>(db, USER_B, 'select id from workouts')
    expect(a.rows.map(r => r.id)).toEqual(['w-a'])
    expect(b.rows.map(r => r.id)).toEqual(['w-b'])
  })

  it("impossible d'écrire au nom d'une autre utilisatrice", async () => {
    await expect(asUser(db, USER_A, `insert into meals (user_id, id, day, moment, title)
      values ('${USER_B}', 'm-x', '2026-10-20', 'midi', 'test')`)).rejects.toThrow()
  })

  it("impossible de modifier ou supprimer les lignes d'une autre", async () => {
    const upd = await asUser(db, USER_B, `update workouts set actual_minutes = 1 where id = 'w-a'`)
    expect(upd.affectedRows ?? 0).toBe(0)
    const del = await asUser(db, USER_B, `delete from workouts where id = 'w-a'`)
    expect(del.affectedRows ?? 0).toBe(0)
    const still = await asUser<{ actual_minutes: number }>(db, USER_A, `select actual_minutes from workouts where id = 'w-a'`)
    expect(still.rows[0].actual_minutes).toBe(12)
  })

  it('un visiteur non connecté ne lit rien et ne peut rien écrire', async () => {
    const r = await asUser(db, null, 'select * from workouts')
    expect(r.rows).toHaveLength(0)
    await expect(asUser(db, null, `insert into workouts (user_id, id, day, started_at, kind, activity, actual_minutes)
      values ('${USER_A}', 'w-anon', '2026-10-20', now(), 'guidee', 'renfo', 5)`)).rejects.toThrow()
  })

  it('les deux utilisatrices peuvent utiliser les mêmes identifiants sans collision', async () => {
    await asUser(db, USER_A, `insert into profiles (id, display_name) values ('profile', 'A')`)
    await asUser(db, USER_B, `insert into profiles (id, display_name) values ('profile', 'B')`)
    const a = await asUser<{ display_name: string }>(db, USER_A, 'select display_name from profiles')
    expect(a.rows).toEqual([{ display_name: 'A' }])
  })

  it('upsert idempotent : la même récompense ne peut exister deux fois', async () => {
    const q = `insert into reward_grants (id, kind, ref, xp, reason) values ('xp:seance:w-a', 'xp', 'seance', 20, 'Séance')
      on conflict (user_id, id) do update set updated_at = now()`
    await asUser(db, USER_A, q)
    await asUser(db, USER_A, q)
    const r = await asUser<{ n: number; total: number }>(db, USER_A, `select count(*)::int as n, sum(xp)::int as total from reward_grants`)
    expect(r.rows[0]).toEqual({ n: 1, total: 20 })
    const v = await asUser<{ xp_total: number }>(db, USER_A, 'select xp_total from user_experience')
    expect(v.rows[0].xp_total).toBe(20)
  })

  it('le journal des notifications est en lecture seule pour les utilisatrices', async () => {
    await expect(asUser(db, USER_A, `insert into notification_log (user_id, key) values ('${USER_A}', 'x')`)).rejects.toThrow()
  })

  it('les contraintes protègent les valeurs (énergie 1 à 5, capsule verrouillée datée)', async () => {
    await expect(asUser(db, USER_A, `insert into daily_checkins (id, day, energy) values ('2026-10-20', '2026-10-20', 9)`)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into progress_capsules (id, created_day, locked) values ('c1', '2026-10-20', true)`)).rejects.toThrow()
  })

  it('supprimer un engagement supprime ses coches (pas de données orphelines)', async () => {
    await asUser(db, USER_A, `insert into commitments (id, kind, title, min_label, usual_label) values ('sport', 'sport', 'Sport', '10 min', '20 min')`)
    await asUser(db, USER_A, `insert into habit_checks (id, commitment_id, day, version) values ('sport:2026-10-20', 'sport', '2026-10-20', 'min')`)
    await asUser(db, USER_A, `delete from commitments where id = 'sport'`)
    const r = await asUser<{ n: number }>(db, USER_A, 'select count(*)::int as n from habit_checks')
    expect(r.rows[0].n).toBe(0)
  })
})
