-- Élan — v1.4 : journal plus rapide (repas favoris, rappels de repas), progrès hors balance
-- (mensurations, sommeil). Migration non destructive : uniquement des ajouts.

-- ---------------------------------------------------------------- repas favoris
create table if not exists public.favorite_meals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (length(name) between 1 and 60),
  meal text not null check (meal in ('petit-dejeuner','dejeuner','collation','diner')),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- mensurations
create table if not exists public.body_measurements (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  hips_cm numeric(5,1) check (hips_cm between 30 and 250),
  chest_cm numeric(5,1) check (chest_cm between 30 and 250),
  thigh_cm numeric(5,1) check (thigh_cm between 15 and 150),
  arm_cm numeric(5,1) check (arm_cm between 10 and 100),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, day)
);

do $$
declare t text;
begin
  foreach t in array array['favorite_meals','body_measurements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- sommeil (check-in du jour)
alter table public.daily_checkins add column if not exists sleep_hours numeric(3,1);
alter table public.daily_checkins add column if not exists sleep_quality smallint;
do $$ begin
  alter table public.daily_checkins add constraint daily_checkins_sleep_hours_range check (sleep_hours is null or sleep_hours between 0 and 16);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.daily_checkins add constraint daily_checkins_sleep_quality_range check (sleep_quality is null or sleep_quality between 1 and 5);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- rappels de repas
alter table public.notification_preferences add column if not exists meal_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists lunch_time text not null default '13:30';
alter table public.notification_preferences add column if not exists dinner_time text not null default '20:30';

-- Un rappel « repas » ne part que si rien n'est encore noté pour ce repas aujourd'hui.
create or replace function elan_private.due_notifications(p_now timestamptz default now())
returns table (user_id uuid, key text, title text, body text, url text, tag text, actions jsonb)
language sql
stable
set search_path = ''
as $$
  with ctx as (
    select
      np.user_id, np.ritual, np.hydration, np.hydration_times, np.capsules, np.monthly_capsule, np.weekly_review, np.tone,
      np.meal_reminders, np.lunch_time, np.dinner_time,
      (p_now at time zone np.timezone) as lnow,
      (p_now at time zone np.timezone)::date as lday,
      (p_now at time zone np.timezone)::time as ltime,
      extract(isodow from (p_now at time zone np.timezone))::int as dow,
      (select c.energy from public.daily_checkins c where c.user_id = np.user_id and c.day = (p_now at time zone np.timezone)::date) as energy,
      coalesce((select e.enabled and e.quiet_when_low from public.energy_preferences e where e.user_id = np.user_id), false) as quiet_pref,
      coalesce((select p.water_goal_ml from public.profiles p where p.user_id = np.user_id), 2000) as water_goal_ml
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
      coalesce((select sum(coalesce(wl.ml, wl.glasses * 250)) from public.water_logs wl where wl.user_id = x.user_id and wl.day = x.lday), 0) as ml_today
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
    and (sp.kind <> 'cycle' or coalesce(np.cycle, true))
    and (
      sp.kind in ('test', 'cycle')
      or coalesce((select sum(w.actual_minutes) from public.workouts w
                   where w.user_id = sp.user_id and w.completed
                     and w.day = (p_now at time zone coalesce(np.timezone, 'Europe/Paris'))::date), 0)
         < coalesce((select c.min_minutes from public.commitments c where c.user_id = sp.user_id and c.kind = 'sport' and c.active limit 1), 10)
    )

  union all
  -- 3. Rappels d'eau (jamais les jours d'épuisement déclaré si « moins de notifications » est choisi)
  select x.user_id,
    'eau:' || x.lday || ':' || h.t,
    'Un verre d''eau ?',
    'Tu en es à ' || replace(to_char(x.ml_today / 1000.0, case when x.ml_today % 100 = 0 then 'FM990.0' else 'FM990.00' end), '.', ',') || ' L sur '
      || replace(to_char(x.water_goal_ml / 1000.0, 'FM990.0'), '.', ',') || ' L. Un verre maintenant, c''est la plus petite victoire de la journée.',
    '#/',
    'eau',
    jsonb_build_array(jsonb_build_object('action', 'eau', 'title', 'J''ai bu 25 cl', 'url', '#/?eau=1'))
  from ctx2 x
  cross join lateral unnest(x.hydration_times) as h(t)
  where x.hydration
    and not x.quiet_day
    and h.t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and x.ltime >= h.t::time
    and x.ltime < h.t::time + interval '30 minutes'
    and x.ml_today < x.water_goal_ml

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
  union all
  -- 7. Repas pas encore noté (déjeuner, dîner), à l'heure choisie, une seule fois
  select x.user_id,
    'repas:' || x.lday || ':' || m.slot,
    case m.slot when 'dejeuner' then 'Ton déjeuner est noté ?' else 'Ton dîner est noté ?' end,
    'Dix secondes suffisent : un favori, « comme hier » ou un ajout rapide.',
    '#/repas/ajouter?repas=' || m.slot,
    'repas',
    jsonb_build_array(jsonb_build_object('action', 'noter', 'title', 'Noter maintenant', 'url', '#/repas/ajouter?repas=' || m.slot))
  from ctx2 x
  cross join lateral (values ('dejeuner', x.lunch_time), ('diner', x.dinner_time)) as m(slot, t)
  where x.meal_reminders
    and not x.quiet_day
    and m.t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and x.ltime >= m.t::time
    and x.ltime < m.t::time + interval '30 minutes'
    and not exists (select 1 from public.food_entries f where f.user_id = x.user_id and f.day = x.lday and f.meal = m.slot)
$$;

revoke all on function elan_private.due_notifications(timestamptz) from public, anon, authenticated;
