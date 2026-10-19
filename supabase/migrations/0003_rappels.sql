-- Élan — rappels push envoyés par le serveur (appli fermée).
-- Une tâche planifiée (pg_cron) appelle chaque minute la fonction « rappels », qui :
--   1. lit les notifications dues via elan_private.due_notifications() ;
--   2. réserve chaque notification dans notification_log (une clé = un envoi, jamais deux) ;
--   3. l'envoie à tous les appareils abonnés de l'utilisatrice.
-- Les secrets (clés VAPID, secret d'appel) sont dans Supabase Vault, jamais dans ce fichier.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Schéma non exposé par l'API : ni anon ni authenticated n'y ont accès.
create schema if not exists elan_private;
revoke all on schema elan_private from public;
revoke all on schema elan_private from anon, authenticated;

-- Toutes les règles d'envoi, en un seul endroit, testables directement en SQL.
-- Fenêtre de 30 minutes après l'heure prévue : un appel retardé ne fait pas perdre le rappel,
-- et notification_log garantit qu'il ne part qu'une fois.
create or replace function elan_private.due_notifications(p_now timestamptz default now())
returns table (user_id uuid, key text, title text, body text, url text, tag text, actions jsonb)
language sql
stable
set search_path = ''
as $$
  with ctx as (
    select
      np.user_id, np.ritual, np.hydration, np.hydration_times, np.capsules, np.monthly_capsule, np.weekly_review, np.tone,
      (p_now at time zone np.timezone) as lnow,
      (p_now at time zone np.timezone)::date as lday,
      (p_now at time zone np.timezone)::time as ltime,
      extract(isodow from (p_now at time zone np.timezone))::int as dow,
      (select c.energy from public.daily_checkins c where c.user_id = np.user_id and c.day = (p_now at time zone np.timezone)::date) as energy,
      coalesce((select e.enabled and e.quiet_when_low from public.energy_preferences e where e.user_id = np.user_id), false) as quiet_pref,
      coalesce((select p.water_goal_glasses from public.profiles p where p.user_id = np.user_id), 8) as water_goal
    from public.notification_preferences np
    where np.enabled
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = np.user_id)
  ),
  ctx2 as (
    select x.*,
      (x.quiet_pref and coalesce(x.energy = 1, false)) as quiet_day,
      case
        when x.tone = 'direct' then 'direct'
        when x.tone = 'doux' then 'doux'
        when x.energy is null then 'neutre'
        when x.energy <= 2 then 'doux'
        when x.energy >= 4 then 'direct'
        else 'neutre'
      end as voice,
      coalesce((select sum(w.actual_minutes) from public.workouts w where w.user_id = x.user_id and w.day = x.lday and w.completed), 0) as minutes_today,
      exists (select 1 from public.ritual_events r where r.user_id = x.user_id and r.day = x.lday and r.action = 'repos') as rest_today,
      coalesce((select sum(wl.glasses) from public.water_logs wl where wl.user_id = x.user_id and wl.day = x.lday), 0) as glasses_today
    from ctx x
  )
  -- 1. Rendez-vous sportif, à l'heure choisie, les jours choisis, s'il n'est pas déjà honoré ni remplacé par un repos
  select x.user_id,
    'rituel:' || x.lday,
    case x.voice
      when 'direct' then 'C''est l''heure de ton rendez-vous'
      when 'doux' then 'Ta journée de travail est terminée'
      else 'Ton rendez-vous de ' || to_char(s.cue_time::time, 'HH24 "h" MI')
    end,
    case x.voice
      when 'direct' then 'Il est ' || to_char(s.cue_time::time, 'HH24 "h" MI') || '. Enfile ta tenue et lance ta séance de ' || coalesce(s.min_minutes, 10) || ' minutes.'
      when 'doux' then 'On prend ' || coalesce(s.min_minutes, 10) || ' minutes pour toi ? La version douce suffit aujourd''hui.'
      else 'Tu n''as pas besoin d''avoir envie. Commence par les cinq premières minutes, puis décide si tu continues.'
    end,
    '#/rituel',
    'rituel',
    jsonb_build_array(
      jsonb_build_object('action', 'start', 'title', 'Je commence', 'url', '#/rituel'),
      jsonb_build_object('action', 'report', 'title', 'Reporter de 15 min', 'url', '#/rituel?action=report')
    )
  from ctx2 x
  join public.commitments s on s.user_id = x.user_id and s.kind = 'sport' and s.active and s.cue_time is not null
  where x.ritual
    and x.dow = any (s.days)
    and x.ltime >= s.cue_time::time
    and x.ltime < s.cue_time::time + interval '30 minutes'
    and x.minutes_today < coalesce(s.min_minutes, 10)
    and not x.rest_today

  union all
  -- 2. Rappels demandés depuis l'appli (report de 15 min, notification de test)
  select sp.user_id,
    'push:' || sp.id,
    sp.title, sp.body, sp.url, 'elan-' || sp.kind,
    case when sp.kind = 'report' then jsonb_build_array(
      jsonb_build_object('action', 'start', 'title', 'Je commence', 'url', '#/rituel')
    ) else '[]'::jsonb end
  from public.scheduled_pushes sp
  left join public.notification_preferences np on np.user_id = sp.user_id
  where sp.sent_at is null
    and sp.send_at <= p_now
    and sp.send_at > p_now - interval '2 hours'
    and exists (select 1 from public.push_subscriptions ps where ps.user_id = sp.user_id)
    and (
      sp.kind = 'test'
      -- un report devient inutile si le rendez-vous a été honoré entre-temps
      or coalesce((select sum(w.actual_minutes) from public.workouts w
                   where w.user_id = sp.user_id and w.completed
                     and w.day = (p_now at time zone coalesce(np.timezone, 'Europe/Paris'))::date), 0)
         < coalesce((select c.min_minutes from public.commitments c where c.user_id = sp.user_id and c.kind = 'sport' and c.active limit 1), 10)
    )

  union all
  -- 3. Petits rappels d'eau (jamais les jours d'épuisement déclaré si « moins de notifications » est choisi)
  select x.user_id,
    'eau:' || x.lday || ':' || h.t,
    'Un verre d''eau ?',
    'Tu en es à ' || x.glasses_today || ' sur ' || x.water_goal || '. Un verre maintenant, c''est la plus petite victoire de la journée.',
    '#/',
    'eau',
    jsonb_build_array(jsonb_build_object('action', 'eau', 'title', 'J''ai bu un verre', 'url', '#/?eau=1'))
  from ctx2 x
  cross join lateral unnest(x.hydration_times) as h(t)
  where x.hydration
    and not x.quiet_day
    and h.t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and x.ltime >= h.t::time
    and x.ltime < h.t::time + interval '30 minutes'
    and x.glasses_today < x.water_goal

  union all
  -- 4. Capsule temporelle arrivée à sa date d'ouverture (à partir de 10 h)
  select x.user_id,
    'capsule:' || c.id,
    'Une capsule t''attend',
    'Ton toi du ' || to_char(c.created_day, 'DD/MM') || ' t''a laissé un message. Tu l''ouvres ?',
    '#/progres/capsule/' || c.id,
    'capsule',
    '[]'::jsonb
  from ctx2 x
  join public.progress_capsules c on c.user_id = x.user_id
  where x.capsules and c.locked and c.opened_at is null and c.open_on <= x.lday and x.ltime >= time '10:00'

  union all
  -- 5. Rappel mensuel de capsule (le 1er du mois, 10 h)
  select x.user_id,
    'capsule-mois:' || to_char(x.lday, 'YYYY-MM'),
    'Une nouvelle capsule ?',
    'Un mois de plus : garde une trace de ce que tu vis, même si la balance ne bouge pas.',
    '#/progres/capsule/nouvelle',
    'capsule-mois',
    '[]'::jsonb
  from ctx2 x
  where x.monthly_capsule and extract(day from x.lday) = 1 and x.ltime >= time '10:00' and x.ltime < time '10:30'

  union all
  -- 6. Bilan de la semaine (dimanche, 18 h)
  select x.user_id,
    'bilan:' || x.lday,
    'Ton bilan de la semaine',
    'Deux minutes pour regarder ta semaine avec bienveillance, et choisir une seule intention.',
    '#/progres/bilan',
    'bilan',
    '[]'::jsonb
  from ctx2 x
  where x.weekly_review and not x.quiet_day and x.dow = 7 and x.ltime >= time '18:00' and x.ltime < time '18:30'
$$;

revoke all on function elan_private.due_notifications(timestamptz) from public, anon, authenticated;
