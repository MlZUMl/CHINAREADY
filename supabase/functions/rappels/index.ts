// Fonction « rappels » : appelée chaque minute par pg_cron, elle envoie les notifications push dues.
// - Les règles (quoi, quand, à qui) sont dans elan_private.due_notifications() (SQL, testé).
// - Chaque notification est réservée dans notification_log : elle ne part jamais deux fois.
// - Les clés VAPID et le secret d'appel sont lus dans Supabase Vault.
import postgres from 'npm:postgres@3.4.5'
import webpush from 'npm:web-push@3.6.7'

const APP_URL = 'https://mlzuml.github.io/CHINAREADY/elan/'
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1, idle_timeout: 20 })

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface Due { user_id: string; key: string; title: string; body: string; url: string; tag: string; actions: unknown }
interface Sub { id: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'POST attendu' }, 405)

  const [secrets] = await sql<{ cron: string | null; pub: string | null; priv: string | null }[]>`
    select
      max(decrypted_secret) filter (where name = 'elan_cron_secret') as cron,
      max(decrypted_secret) filter (where name = 'elan_vapid_public') as pub,
      max(decrypted_secret) filter (where name = 'elan_vapid_private') as priv
    from vault.decrypted_secrets
    where name in ('elan_cron_secret', 'elan_vapid_public', 'elan_vapid_private')`
  const given = req.headers.get('x-elan-secret') ?? ''
  if (!secrets?.cron || !sameSecret(given, secrets.cron)) return json({ error: 'refusé' }, 401)
  if (!secrets.pub || !secrets.priv) return json({ error: 'clés VAPID absentes' }, 500)
  webpush.setVapidDetails(APP_URL, secrets.pub, secrets.priv)

  const body = await req.json().catch(() => ({})) as { verify?: { endpoint: string; keys: { p256dh: string; auth: string } } }

  // Diagnostic : chiffre et envoie une notification de test vers un abonnement donné.
  if (body.verify) {
    try {
      const res = await webpush.sendNotification(body.verify, JSON.stringify({ title: 'Élan', body: 'Test de chiffrement' }), { TTL: 60 })
      return json({ ok: true, status: res.statusCode })
    } catch (e) {
      const err = e as { statusCode?: number; message?: string }
      return json({ ok: false, status: err.statusCode ?? null, error: String(err.message ?? e) }, 200)
    }
  }

  const due = await sql<Due[]>`select * from elan_private.due_notifications(now())`
  let sent = 0, failed = 0, skipped = 0, removed = 0
  for (const n of due) {
    // Réservation : si la clé existe déjà, la notification est déjà partie.
    const claimed = await sql`insert into public.notification_log (user_id, key) values (${n.user_id}, ${n.key}) on conflict do nothing returning key`
    if (!claimed.length) { skipped++; continue }
    const subs = await sql<Sub[]>`select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = ${n.user_id}`
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag, actions: n.actions })
    let delivered = 0, transient = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'high' })
        delivered++; sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        failed++
        if (code === 404 || code === 410) {
          // Abonnement expiré (appli désinstallée, autorisation retirée) : on le retire.
          await sql`delete from public.push_subscriptions where user_id = ${n.user_id} and id = ${s.id}`
          removed++
        } else {
          transient++
          console.error('envoi impossible', n.key, code, String((e as Error).message ?? e))
        }
      }
    }
    // Échec temporaire sur tous les appareils : on libère la clé pour réessayer à la minute suivante.
    if (!delivered && transient) await sql`delete from public.notification_log where user_id = ${n.user_id} and key = ${n.key}`
  }
  // Les rappels demandés (report, test) arrivés à échéance sont marqués comme traités.
  await sql`update public.scheduled_pushes set sent_at = now(), updated_at = now() where sent_at is null and send_at <= now()`

  return json({ due: due.length, sent, failed, skipped, removed })
})
