-- Élan — schéma principal
-- Chaque table synchronisée suit le même contrat :
--   user_id (propriétaire, isolé par RLS) + id texte stable  => clé primaire (user_id, id)
--   created_at / updated_at pour la synchronisation « dernier écrit gagne »
-- Les identifiants « naturels » (un check-in par jour, un profil par compte…) sont déterministes
-- côté appli, ce qui empêche les doublons même si deux appareils écrivent la même chose.

-- ---------------------------------------------------------------- profils & préférences
create table if not exists public.profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'profile' check (id = 'profile'),
  display_name text,
  timezone text not null default 'Europe/Paris',
  onboarded boolean not null default false,
  water_goal_glasses smallint not null default 8 check (water_goal_glasses between 1 and 20),
  weigh_day smallint not null default 1 check (weigh_day between 1 and 7),
  portions smallint not null default 1 check (portions between 1 and 8),
  halal boolean not null default true,
  analysis_consent boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.energy_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'energy' check (id = 'energy'),
  enabled boolean not null default true,
  rest_days smallint[] not null default '{6,7}',
  quiet_when_low boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.notification_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'notif' check (id = 'notif'),
  enabled boolean not null default false,
  ritual boolean not null default true,
  hydration boolean not null default false,
  hydration_times text[] not null default '{10:30,14:30,16:30}',
  capsules boolean not null default true,
  monthly_capsule boolean not null default false,
  weekly_review boolean not null default true,
  tone text not null default 'auto' check (tone in ('auto','direct','doux')),
  timezone text not null default 'Europe/Paris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- engagements & habitudes
create table if not exists public.commitments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('sport','eau','repas','preparation','perso')),
  title text not null,
  cue_time text check (cue_time is null or cue_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days smallint[] not null default '{1,2,3,4,5}',
  place text,
  min_label text not null,
  min_minutes smallint check (min_minutes is null or min_minutes between 1 and 180),
  usual_label text not null,
  usual_minutes smallint check (usual_minutes is null or usual_minutes between 1 and 180),
  fallback text,
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.habit_checks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  commitment_id text not null,
  day date not null,
  version text not null check (version in ('min','usual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, commitment_id, day),
  foreign key (user_id, commitment_id) references public.commitments(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- énergie & rituel
create table if not exists public.daily_checkins (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  energy smallint check (energy between 1 and 5),
  minutes smallint check (minutes in (5,10,15,20,30,45)),
  need text check (need in ('bouger','detente','cuisine','eau','reprendre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, day)
);

create table if not exists public.workouts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  kind text not null check (kind in ('guidee','externe')),
  activity text not null,
  program text,
  planned_minutes smallint check (planned_minutes between 1 and 240),
  actual_minutes smallint not null check (actual_minutes between 0 and 240),
  version text not null default 'libre' check (version in ('min','usual','plus','libre')),
  completed boolean not null default true,
  source text not null default 'libre' check (source in ('rituel','libre','mission','reprise')),
  energy smallint check (energy between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists workouts_user_day on public.workouts (user_id, day);

create table if not exists public.ritual_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  action text not null check (action in ('ouvert','commence','courte','report','repos')),
  reason text check (reason in ('epuisee','imprevu','pas_envie')),
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists ritual_events_user_day on public.ritual_events (user_id, day);

create table if not exists public.obstacle_reports (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  obstacle text not null check (obstacle in ('horaire','fatigue','preparation','motivation','autre')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- alimentation & eau (sans chiffres)
create table if not exists public.water_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  at timestamptz not null default now(),
  glasses smallint not null default 1 check (glasses between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists water_logs_user_day on public.water_logs (user_id, day);

create table if not exists public.meals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  moment text not null check (moment in ('matin','midi','gouter','soir','autre')),
  title text not null,
  recipe_id text,
  markers text[] not null default '{}',
  feeling text check (feeling in ('rassasiee','agreable','encore_faim','trop')),
  note text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists meals_user_day on public.meals (user_id, day);

create table if not exists public.user_recipes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  minutes smallint check (minutes between 1 and 600),
  servings smallint not null default 2 check (servings between 1 and 12),
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.meal_plans (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  week_start date not null,
  slots jsonb not null default '[]'::jsonb,
  checked text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------- corps & calendrier
create table if not exists public.weights (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  kg numeric(5,2) not null check (kg between 25 and 300),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, day)
);

create table if not exists public.cycle_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  period boolean not null default false,
  flow text check (flow in ('spotting','leger','moyen','abondant')),
  symptoms text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, day)
);

create table if not exists public.journal_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  mood text,
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.day_presence (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  day date not null,
  first_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, day)
);

create table if not exists public.weekly_reviews (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  week_start date not null,
  helped text,
  blocked text,
  intention text,
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------- univers, compagnon, récompenses
create table if not exists public.avatar_profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'avatar' check (id = 'avatar'),
  character text not null,
  style text not null,
  outfit text not null,
  universe text not null,
  name text,
  equipped jsonb not null default '{}'::jsonb,
  zones jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.companion_profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default 'companion' check (id = 'companion'),
  species text not null check (species in ('chat','lapin','nuage','creature','pousse')),
  name text not null,
  color text not null default 'rose',
  accessories text[] not null default '{}',
  frequency text not null default 'normal' check (frequency in ('normal','discret')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.companion_interactions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  at timestamptz not null default now(),
  context text not null,
  message_key text not null,
  expression text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Une ligne par récompense acquise. L'id est la clé déterministe de la récompense
-- (ex. « badge:premier-pas », « xp:seance:<id> ») : une même action ne peut donc
-- jamais être récompensée deux fois, et rien n'est jamais retiré.
create table if not exists public.reward_grants (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('xp','badge','item','zone','accessory')),
  ref text not null,
  xp integer not null default 0 check (xp between 0 and 500),
  reason text not null,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_missions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  mission_key text not null,
  day date not null,
  status text not null check (status in ('disponible','active','terminee','expiree','ignoree')),
  mystery boolean not null default false,
  accepted_at timestamptz,
  completed_at timestamptz,
  expires_on date,
  reward_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, mission_key, day)
);

create table if not exists public.progress_capsules (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  created_day date not null,
  open_on date,
  locked boolean not null default false,
  has_photo boolean not null default false,
  photo_path text,
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 25 and 300),
  energy smallint check (energy between 1 and 5),
  habits text,
  difficulties text,
  workouts_count integer,
  success text,
  note text,
  future_message text,
  snapshot jsonb not null default '{}'::jsonb,
  opened_at timestamptz,
  reopen_note text,
  unlock_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (not locked or open_on is not null)
);

create table if not exists public.habit_insights (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  insight_key text not null,
  period text not null,
  status text not null check (status in ('nouvelle','acceptee','modifiee','ignoree')),
  observed jsonb not null default '{}'::jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- notifications push
create table if not exists public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.scheduled_pushes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  send_at timestamptz not null,
  kind text not null check (kind in ('report','test')),
  title text not null,
  body text not null,
  url text not null default '#/',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists scheduled_pushes_pending on public.scheduled_pushes (send_at) where sent_at is null;

-- Journal d'envoi tenu par le serveur : une notification (clé) n'est envoyée qu'une fois.
create table if not exists public.notification_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------- sécurité : RLS par utilisateur
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','energy_preferences','notification_preferences','commitments','habit_checks',
    'daily_checkins','workouts','ritual_events','obstacle_reports','water_logs','meals',
    'user_recipes','meal_plans','weights','cycle_days','journal_entries','day_presence',
    'weekly_reviews','avatar_profiles','companion_profiles','companion_interactions',
    'reward_grants','user_missions','progress_capsules','habit_insights','push_subscriptions',
    'scheduled_pushes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Le journal d'envoi est lisible par sa propriétaire ; aucune politique d'écriture : seul le serveur (service_role) y écrit.
alter table public.notification_log enable row level security;
create policy notification_log_select_own on public.notification_log
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.notification_log to authenticated;

-- ---------------------------------------------------------------- vues de lecture (noms du cahier des charges)
create or replace view public.user_badges with (security_invoker = true) as
  select user_id, ref as badge_id, reason, granted_at from public.reward_grants where kind = 'badge';
create or replace view public.avatar_unlocks with (security_invoker = true) as
  select user_id, kind, ref as item_id, reason, granted_at from public.reward_grants where kind in ('item','zone','accessory');
create or replace view public.user_experience with (security_invoker = true) as
  select user_id, coalesce(sum(xp), 0)::integer as xp_total, count(*) filter (where xp > 0) as xp_events
  from public.reward_grants group by user_id;
grant select on public.user_badges, public.avatar_unlocks, public.user_experience to authenticated;
