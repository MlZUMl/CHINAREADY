// Migration 0007 : rapports privés, fin des règles / ovulation confirmée, rappels du cycle.
import { describe, it, expect, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, asUser, USER_A, USER_B } from './supabase-stub'

let db: PGlite
beforeAll(async () => { db = await createDb() }, 60000)

describe('suivi du cycle', () => {
  it('rapports : lisibles et modifiables uniquement par leur propriétaire', async () => {
    await asUser(db, USER_A, `insert into intimate_logs (id, day, note) values ('2026-10-20', '2026-10-20', null)`)
    expect((await asUser(db, USER_B, 'select * from intimate_logs')).rows).toHaveLength(0)
    expect((await asUser(db, null, 'select * from intimate_logs')).rows).toHaveLength(0)
    const del = await asUser(db, USER_B, `delete from intimate_logs where id = '2026-10-20'`)
    expect(del.affectedRows ?? 0).toBe(0)
    await expect(asUser(db, USER_A, `insert into intimate_logs (user_id, id, day) values ('${USER_B}', 'x', '2026-10-21')`)).rejects.toThrow()
    await expect(asUser(db, USER_A, `insert into intimate_logs (id, day, note) values ('long', '2026-10-21', repeat('a', 501))`)).rejects.toThrow()
  })
  it('jours du cycle : fin des règles et ovulation confirmée', async () => {
    await asUser(db, USER_A, `insert into cycle_days (id, day, period, period_end) values ('2026-10-04', '2026-10-04', true, true)`)
    await asUser(db, USER_A, `insert into cycle_days (id, day, period, ovulation_confirmed) values ('2026-10-16', '2026-10-16', false, true)`)
    const r = await asUser<{ day: string; period_end: boolean; ovulation_confirmed: boolean }>(db, USER_A, `select to_char(day, 'YYYY-MM-DD') as day, period_end, ovulation_confirmed from cycle_days order by day`)
    expect(r.rows).toEqual([{ day: '2026-10-04', period_end: true, ovulation_confirmed: false }, { day: '2026-10-16', period_end: false, ovulation_confirmed: true }])
  })
  it('rappel du cycle programmé : envoyé à l\'heure, sauf si les rappels du cycle sont désactivés', async () => {
    await db.exec(`
      insert into notification_preferences (user_id, id, enabled, timezone) values ('${USER_A}', 'notif', true, 'Europe/Paris');
      insert into push_subscriptions (user_id, id, endpoint, p256dh, auth) values ('${USER_A}', 's', 'https://push.example/a', 'k', 'a');
      insert into scheduled_pushes (user_id, id, send_at, kind, title, body, url) values ('${USER_A}', 'cycle:avant:2026-10-28', '2026-10-26T07:00:00Z', 'cycle', 'Tes règles approchent', 'Prévues dans 2 jours environ (estimation).', '#/progres?onglet=cycle');
      insert into workouts (user_id, id, day, started_at, kind, activity, actual_minutes) values ('${USER_A}', 'w', '2026-10-26', now(), 'guidee', 'renfo', 20);
    `)
    const due = async () => (await db.query<{ key: string }>(`select key from elan_private.due_notifications('2026-10-26T07:01:00Z') where user_id = '${USER_A}'`)).rows.map(r => r.key)
    expect(await due()).toContain('push:cycle:avant:2026-10-28') // une séance faite ne bloque pas un rappel du cycle
    await db.exec(`update notification_preferences set cycle = false`)
    expect(await due()).not.toContain('push:cycle:avant:2026-10-28')
    await expect(db.exec(`insert into scheduled_pushes (user_id, id, send_at, kind, title, body) values ('${USER_A}', 'x', now(), 'pub', 't', 'b')`)).rejects.toThrow()
  })
})
