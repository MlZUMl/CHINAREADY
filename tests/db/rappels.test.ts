// Règles d'envoi des rappels, testées sur un vrai moteur Postgres (même SQL que sur Supabase).
import { describe, it, expect, beforeEach } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createDb, USER_A, USER_B } from './supabase-stub'

let db: PGlite

async function setup(uid: string, opts: { enabled?: boolean; sub?: boolean; tone?: string; hydration?: boolean } = {}) {
  await db.exec(`
    insert into profiles (user_id, id, water_goal_glasses) values ('${uid}', 'profile', 8);
    insert into energy_preferences (user_id, id) values ('${uid}', 'energy');
    insert into notification_preferences (user_id, id, enabled, tone, hydration, timezone)
      values ('${uid}', 'notif', ${opts.enabled ?? true}, '${opts.tone ?? 'auto'}', ${opts.hydration ?? true}, 'Europe/Paris');
    insert into commitments (user_id, id, kind, title, cue_time, days, min_label, min_minutes, usual_label, usual_minutes)
      values ('${uid}', 'sport', 'sport', 'Sport', '17:15', '{1,2,3,4,5}', '10 min', 10, '20 min', 20);
  `)
  if (opts.sub ?? true) await db.exec(`insert into push_subscriptions (user_id, id, endpoint, p256dh, auth) values ('${uid}', 'sub-1', 'https://push.example/${uid}', 'k', 'a')`)
}

const due = async (iso: string, uid = USER_A) =>
  (await db.query<{ key: string; title: string; body: string; actions: any }>(`select key, title, body, actions from elan_private.due_notifications('${iso}'::timestamptz) where user_id = '${uid}' order by key`)).rows

beforeEach(async () => { db = await createDb() }, 60000)

// Mardi 20 octobre 2026 : Paris est en UTC+2 (heure d'été jusqu'au 25 octobre).
const T1716 = '2026-10-20T15:16:00Z'

describe('rappel du rendez-vous sportif', () => {
  it("part à l'heure configurée, un jour prévu, avec les boutons « Je commence » et « Reporter »", async () => {
    await setup(USER_A)
    const r = await due(T1716)
    expect(r.map(x => x.key)).toContain('rituel:2026-10-20')
    const n = r.find(x => x.key.startsWith('rituel'))!
    expect(n.actions.map((a: any) => a.action)).toEqual(['start', 'report'])
    expect(n.body).toMatch(/Commence par les cinq premières minutes/)
  })
  it("pas avant l'heure, plus après 30 minutes, jamais le week-end", async () => {
    await setup(USER_A)
    expect((await due('2026-10-20T15:14:00Z')).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
    expect((await due('2026-10-20T15:46:00Z')).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
    expect((await due('2026-10-24T15:16:00Z')).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
  })
  it('suit une heure et des jours modifiés dans l\'appli', async () => {
    await setup(USER_A)
    await db.exec(`update commitments set cue_time = '18:30', days = '{2,4}' where user_id = '${USER_A}' and id = 'sport'`)
    expect((await due(T1716)).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
    expect((await due('2026-10-20T16:31:00Z')).map(x => x.key)).toContain('rituel:2026-10-20')
    expect((await due('2026-10-19T16:31:00Z')).filter(x => x.key.startsWith('rituel'))).toHaveLength(0) // lundi
  })
  it('ne part pas si le rendez-vous est déjà honoré ou si un repos est choisi', async () => {
    await setup(USER_A)
    await db.exec(`insert into workouts (user_id, id, day, started_at, kind, activity, actual_minutes) values ('${USER_A}', 'w', '2026-10-20', now(), 'externe', 'velo', 12)`)
    expect((await due(T1716)).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
    await db.exec(`delete from workouts; insert into ritual_events (user_id, id, day, action, reason) values ('${USER_A}', 'r', '2026-10-20', 'repos', 'epuisee')`)
    expect((await due(T1716)).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
  })
  it("le ton suit l'énergie du jour (« selon mon énergie ») ou le choix fait dans le profil", async () => {
    await setup(USER_A)
    await db.exec(`insert into daily_checkins (user_id, id, day, energy) values ('${USER_A}', '2026-10-20', '2026-10-20', 1)`)
    expect((await due(T1716)).find(x => x.key.startsWith('rituel'))!.body).toMatch(/version douce/)
    await db.exec(`update daily_checkins set energy = 5`)
    expect((await due(T1716)).find(x => x.key.startsWith('rituel'))!.body).toMatch(/Il est 17 h 15\. Enfile ta tenue/)
    await db.exec(`update notification_preferences set tone = 'doux'`)
    expect((await due(T1716)).find(x => x.key.startsWith('rituel'))!.title).toMatch(/journée de travail est terminée/)
  })
  it('rien sans notifications activées ni appareil abonné', async () => {
    await setup(USER_A, { enabled: false })
    await setup(USER_B, { sub: false })
    expect(await due(T1716, USER_A)).toHaveLength(0)
    expect(await due(T1716, USER_B)).toHaveLength(0)
  })
  it("les données d'une utilisatrice n'influencent jamais les rappels de l'autre", async () => {
    await setup(USER_A)
    await setup(USER_B)
    await db.exec(`insert into workouts (user_id, id, day, started_at, kind, activity, actual_minutes) values ('${USER_B}', 'w', '2026-10-20', now(), 'externe', 'velo', 30)`)
    expect((await due(T1716, USER_A)).map(x => x.key)).toContain('rituel:2026-10-20')
    expect((await due(T1716, USER_B)).filter(x => x.key.startsWith('rituel'))).toHaveLength(0)
  })
})

describe('autres rappels', () => {
  it("eau aux heures choisies tant que l'objectif n'est pas atteint, sauf jour d'épuisement", async () => {
    await setup(USER_A)
    // 5 rappels par défaut : 9 h 30, 11 h 30, 13 h 30, 15 h 30, 18 h 30 (heure de Paris = UTC+2 ce jour-là)
    const at1131 = '2026-10-20T09:31:00Z'
    expect((await due(at1131)).map(x => x.key)).toContain('eau:2026-10-20:11:30')
    expect((await due('2026-10-20T16:31:00Z')).map(x => x.key)).toContain('eau:2026-10-20:18:30')
    // Message en litres : 0,75 L bus sur 2,0 L
    await db.exec(`insert into water_logs (user_id, id, day, glasses, ml) values ('${USER_A}', 'a', '2026-10-20', 1, 500), ('${USER_A}', 'b', '2026-10-20', 1, 250)`)
    expect((await due(at1131)).find(x => x.key.startsWith('eau'))!.body).toMatch(/^Tu en es à 0,75 L sur 2,0 L\./)
    // Objectif atteint (anciennes entrées en verres comprises : 1 verre = 25 cl) : plus de rappel
    await db.exec(`insert into water_logs (user_id, id, day, glasses) select '${USER_A}', 'e' || g, '2026-10-20', 1 from generate_series(1, 5) g`)
    expect((await due(at1131)).filter(x => x.key.startsWith('eau'))).toHaveLength(0)
    await db.exec(`delete from water_logs; insert into daily_checkins (user_id, id, day, energy) values ('${USER_A}', '2026-10-20', '2026-10-20', 1)`)
    expect((await due(at1131)).filter(x => x.key.startsWith('eau'))).toHaveLength(0)
  })
  it("capsule : à sa date d'ouverture, une seule fois tant qu'elle n'est pas ouverte", async () => {
    await setup(USER_A)
    await db.exec(`insert into progress_capsules (user_id, id, created_day, open_on, locked) values ('${USER_A}', 'c1', '2026-09-20', '2026-10-20', true)`)
    expect((await due('2026-10-20T07:59:00Z')).filter(x => x.key.startsWith('capsule:'))).toHaveLength(0) // 9 h 59
    expect((await due('2026-10-20T08:05:00Z')).map(x => x.key)).toContain('capsule:c1')
    await db.exec(`update progress_capsules set opened_at = now()`)
    expect((await due('2026-10-20T08:05:00Z')).filter(x => x.key.startsWith('capsule:'))).toHaveLength(0)
  })
  it('report de 15 minutes : envoyé à l\'heure demandée, sauf si la séance a été faite entre-temps', async () => {
    await setup(USER_A)
    await db.exec(`insert into scheduled_pushes (user_id, id, send_at, kind, title, body, url) values ('${USER_A}', 'report:1', '2026-10-20T15:31:00Z', 'report', 'C''est reparti ?', 'Ton rendez-vous t''attend', '#/rituel')`)
    expect((await due('2026-10-20T15:30:00Z')).filter(x => x.key.startsWith('push:'))).toHaveLength(0)
    expect((await due('2026-10-20T15:31:30Z')).map(x => x.key)).toContain('push:report:1')
    await db.exec(`insert into workouts (user_id, id, day, started_at, kind, activity, actual_minutes) values ('${USER_A}', 'w', '2026-10-20', now(), 'guidee', 'renfo', 10)`)
    expect((await due('2026-10-20T15:31:30Z')).filter(x => x.key.startsWith('push:'))).toHaveLength(0)
  })
  it('bilan le dimanche à 18 h et rappel mensuel de capsule le 1er à 10 h', async () => {
    await setup(USER_A)
    await db.exec(`update notification_preferences set monthly_capsule = true`)
    expect((await due('2026-10-25T17:05:00Z')).map(x => x.key)).toContain('bilan:2026-10-25') // 18 h 05, heure d'hiver
    expect((await due('2026-11-01T09:10:00Z')).map(x => x.key)).toContain('capsule-mois:2026-11')
  })
  it('anon et authenticated ne peuvent pas appeler la fonction interne', async () => {
    await db.exec(`set role authenticated`)
    await expect(db.query(`select * from elan_private.due_notifications(now())`)).rejects.toThrow()
    await db.exec(`reset role`)
  })
})
