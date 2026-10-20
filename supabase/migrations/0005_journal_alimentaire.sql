-- Élan — lot 1 : journal alimentaire avec calories, aliments personnels, eau en millilitres,
-- recettes personnelles enrichies, 5 rappels d'eau par jour.
-- Migration non destructive : aucune colonne ni donnée existante n'est supprimée.

-- ---------------------------------------------------------------- journal alimentaire
-- Une ligne = un aliment (ou une recette, ou un ajout rapide) dans un repas d'un jour.
-- Les valeurs nutritionnelles sont figées au moment de l'ajout (kcal, macros) : modifier
-- la table Ciqual ou le catalogue plus tard ne change pas l'historique.
create table if not exists public.food_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  meal text not null check (meal in ('petit-dejeuner','dejeuner','collation','diner')),
  source text not null check (source in ('ciqual','off','perso','recette','rapide')),
  ref text,
  name text not null check (length(name) between 1 and 200),
  brand text,
  quantity numeric(8,2) not null check (quantity > 0 and quantity <= 10000),
  unit text not null check (unit in ('g','ml','portion')),
  grams numeric(8,1) not null default 0 check (grams >= 0 and grams <= 20000),
  portion_label text,
  per100 jsonb,
  kcal numeric(7,1) not null default 0 check (kcal >= 0 and kcal <= 20000),
  protein numeric(6,1) not null default 0 check (protein >= 0),
  carbs numeric(6,1) not null default 0 check (carbs >= 0),
  fat numeric(6,1) not null default 0 check (fat >= 0),
  fiber numeric(6,1) not null default 0 check (fiber >= 0),
  details jsonb not null default '{}'::jsonb,
  category text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists food_entries_user_day on public.food_entries (user_id, day);

-- Aliments créés par l'utilisatrice (produit absent des bases, recette de famille…)
create table if not exists public.custom_foods (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (length(name) between 1 and 200),
  brand text,
  per100 jsonb not null,
  unit text not null default 'g' check (unit in ('g','ml')),
  portions jsonb not null default '[]'::jsonb,
  barcode text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['food_entries','custom_foods'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- eau en millilitres
alter table public.water_logs add column if not exists ml integer;
update public.water_logs set ml = glasses * 250 where ml is null;
alter table public.water_logs alter column ml set default 250;
alter table public.water_logs alter column ml set not null;
do $$ begin
  alter table public.water_logs add constraint water_logs_ml_range check (ml between 10 and 3000);
exception when duplicate_object then null; end $$;

alter table public.profiles add column if not exists water_goal_ml integer not null default 2000;
do $$ begin
  alter table public.profiles add constraint profiles_water_goal_ml_range check (water_goal_ml between 500 and 6000);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- recettes personnelles
alter table public.user_recipes add column if not exists source_url text;
alter table public.user_recipes add column if not exists photo_url text;
alter table public.user_recipes add column if not exists nutrition jsonb;

-- ---------------------------------------------------------------- 5 rappels d'eau par jour
alter table public.notification_preferences alter column hydration set default true;
alter table public.notification_preferences alter column hydration_times set default '{09:30,11:30,13:30,15:30,18:30}';
update public.notification_preferences
  set hydration = true, hydration_times = '{09:30,11:30,13:30,15:30,18:30}', updated_at = now()
  where hydration_times = '{10:30,14:30,16:30}';

-- ---------------------------------------------------------------- règles des rappels (eau en litres)
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
    and (
      sp.kind = 'test'
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
$$;

revoke all on function elan_private.due_notifications(timestamptz) from public, anon, authenticated;
