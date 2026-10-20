-- Élan — points et boutique de personnalisation des compagnons.
-- Les points sont des récompenses comme les autres (reward_grants, clé déterministe :
-- « points:seance:2026-10-20 » ne peut exister qu'une fois). Les achats sont une table à part :
-- solde = somme des points gagnés − somme des prix payés. Un objet ne s'achète qu'une fois (id = objet).
-- Migration non destructive.

alter table public.reward_grants add column if not exists points integer not null default 0;
do $$ begin
  alter table public.reward_grants add constraint reward_grants_points_range check (points between 0 and 1000);
exception when duplicate_object then null; end $$;
alter table public.reward_grants drop constraint if exists reward_grants_kind_check;
alter table public.reward_grants add constraint reward_grants_kind_check check (kind in ('xp','badge','item','zone','accessory','points'));

create table if not exists public.shop_purchases (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  item_id text not null,
  price integer not null check (price between 0 and 100000),
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.shop_purchases enable row level security;
create policy shop_purchases_select_own on public.shop_purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy shop_purchases_insert_own on public.shop_purchases for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shop_purchases_update_own on public.shop_purchases for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shop_purchases_delete_own on public.shop_purchases for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.shop_purchases to authenticated;
