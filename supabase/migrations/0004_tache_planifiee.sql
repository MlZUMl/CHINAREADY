-- Élan — tâche planifiée : chaque minute, la base appelle la fonction « rappels ».
-- Le secret d'appel est lu dans Supabase Vault au moment de l'appel (rien en clair ici).
-- Prérequis : les secrets elan_cron_secret, elan_vapid_public et elan_vapid_private dans Vault
--   select vault.create_secret('<secret aléatoire>', 'elan_cron_secret');
--   select vault.create_secret('<clé publique VAPID>', 'elan_vapid_public');
--   select vault.create_secret('<clé privée VAPID>', 'elan_vapid_private');

select cron.unschedule(jobid) from cron.job where jobname = 'elan-rappels';

select cron.schedule(
  'elan-rappels',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://rfuotoxmitsuxmdvovso.supabase.co/functions/v1/rappels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-elan-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'elan_cron_secret')
    ),
    body := jsonb_build_object('at', now()),
    timeout_milliseconds := 25000
  );
  $$
);

-- Le journal d'envoi ne garde que 60 jours ; les réponses HTTP de pg_net sont purgées par l'extension.
select cron.unschedule(jobid) from cron.job where jobname = 'elan-menage';
select cron.schedule(
  'elan-menage',
  '17 3 * * *',
  $$ delete from public.notification_log where sent_at < now() - interval '60 days'; $$
);
