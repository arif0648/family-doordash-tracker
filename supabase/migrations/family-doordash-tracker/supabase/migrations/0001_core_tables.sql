-- ============================================================================
-- 0001_core_tables.sql
-- families, family_members, profiles, vehicles (with hard 3-vehicle lock)
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- FAMILIES / FAMILY MEMBERS  (Bölüm 4.1 — Aile İzolasyonu)
-- ---------------------------------------------------------------------------
create table families (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table family_members (
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index idx_family_members_user on family_members(user_id);

-- ---------------------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- VEHICLES — exactly 3, hard-locked at database level
-- ---------------------------------------------------------------------------
create table vehicles (
  id          uuid primary key default uuid_generate_v4(),
  family_id   uuid not null references families(id) on delete cascade,
  full_name   text not null,
  short_name  text not null,
  created_at  timestamptz not null default now()
);

-- Hard lock: a family can never have more than 3 vehicles.
create or replace function public.enforce_max_three_vehicles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_count int;
begin
  select count(*) into vehicle_count
  from vehicles
  where family_id = new.family_id;

  if vehicle_count >= 3 then
    raise exception 'FAMILY_VEHICLE_LIMIT_EXCEEDED: a family may have at most 3 vehicles';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_max_three_vehicles
  before insert on vehicles
  for each row execute function public.enforce_max_three_vehicles();

-- No UPDATE/DELETE/INSERT of vehicles from the client at all (Bölüm 3):
-- vehicles are seeded once via migration/service-role, never via the app.
-- RLS below only ever grants SELECT to authenticated family members.

comment on table vehicles is
  'Exactly 3 rows per family, seeded by migration. Frontend never creates vehicles. enforce_max_three_vehicles trigger is the hard DB-level guarantee required by spec Bölüm 3.';
