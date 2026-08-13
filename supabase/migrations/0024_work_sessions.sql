-- ============================================================================
-- 0024_work_sessions.sql
-- Real work-session tracking for hourly-rate calculations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------------
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------
create index if not exists idx_work_sessions_family_user
  on public.work_sessions (family_id, user_id);

create index if not exists idx_work_sessions_started_at
  on public.work_sessions (started_at);

create index if not exists idx_work_sessions_open
  on public.work_sessions (user_id)
  where ended_at is null;

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.work_sessions enable row level security;

drop policy if exists work_sessions_select_family on public.work_sessions;
create policy work_sessions_select_family
  on public.work_sessions
  for select
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists work_sessions_insert_family on public.work_sessions;
create policy work_sessions_insert_family
  on public.work_sessions
  for insert
  to authenticated
  with check (
    public.is_family_member(family_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists work_sessions_update_family on public.work_sessions;
create policy work_sessions_update_family
  on public.work_sessions
  for update
  to authenticated
  using (public.is_family_member(family_id, auth.uid()))
  with check (public.is_family_member(family_id, auth.uid()));

drop policy if exists work_sessions_delete_family on public.work_sessions;
create policy work_sessions_delete_family
  on public.work_sessions
  for delete
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. AUTO UPDATE updated_at
-- ---------------------------------------------------------------------------
create or replace function public.update_work_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_work_sessions_updated_at on public.work_sessions;
create trigger trg_work_sessions_updated_at
  before update on public.work_sessions
  for each row
  execute function public.update_work_sessions_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RPC: START A WORK SESSION
-- Only one open session per user at a time.
-- ---------------------------------------------------------------------------
create or replace function public.start_work_session(
  p_family_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(p_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Prevent multiple open sessions for the same user
  select id into v_existing
  from public.work_sessions
  where user_id = v_user_id
    and ended_at is null;

  if v_existing is not null then
    raise exception 'OPEN_SESSION_EXISTS';
  end if;

  insert into public.work_sessions (family_id, user_id, started_at)
  values (p_family_id, v_user_id, now())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: END THE CURRENT OPEN WORK SESSION
-- ---------------------------------------------------------------------------
create or replace function public.end_work_session(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.work_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_session
  from public.work_sessions
  where id = p_session_id;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if not public.is_family_member(v_session.family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  if v_session.user_id <> v_user_id then
    raise exception 'NOT_OWNER';
  end if;

  if v_session.ended_at is not null then
    raise exception 'ALREADY_ENDED';
  end if;

  update public.work_sessions
  set ended_at = now()
  where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: WORK SUMMARY FOR A DATE RANGE
-- Returns seconds worked, income earned, and hourly rate.
-- ---------------------------------------------------------------------------
create or replace function public.get_work_summary(
  p_family_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  total_seconds numeric,
  total_income numeric,
  hourly_rate numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_total_seconds numeric;
  v_total_income numeric;
  v_hourly numeric;
  v_session record;
  v_start timestamptz;
  v_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(p_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  v_total_seconds := 0;

  for v_session in
    select started_at, ended_at
    from public.work_sessions
    where family_id = p_family_id
      and user_id = v_user_id
      and (started_at at time zone 'America/Los_Angeles')::date between p_start_date and p_end_date
  loop
    v_start := v_session.started_at;
    -- If still running, count only up to now; but for a historical query
    -- range we usually expect ended sessions. Still open sessions count.
    v_end := coalesce(v_session.ended_at, now());
    v_total_seconds := v_total_seconds + extract(epoch from (v_end - v_start));
  end loop;

  select coalesce(sum(amount), 0)
    into v_total_income
  from public.income
  where family_id = p_family_id
    and user_id = v_user_id
    and record_date between p_start_date and p_end_date;

  if v_total_seconds > 0 then
    v_hourly := v_total_income / (v_total_seconds / 3600.0);
  else
    v_hourly := null;
  end if;

  return query select v_total_seconds, v_total_income, v_hourly;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC: GET CURRENT OPEN SESSION
-- ---------------------------------------------------------------------------
create or replace function public.get_open_work_session(
  p_family_id uuid
)
returns table (
  id uuid,
  started_at timestamptz,
  elapsed_seconds numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(p_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  return query
  select ws.id, ws.started_at, extract(epoch from (now() - ws.started_at))
  from public.work_sessions ws
  where ws.family_id = p_family_id
    and ws.user_id = v_user_id
    and ws.ended_at is null
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. PERMISSIONS
-- ---------------------------------------------------------------------------
grant execute on function public.start_work_session(uuid) to authenticated;
grant execute on function public.end_work_session(uuid) to authenticated;
grant execute on function public.get_work_summary(uuid, date, date) to authenticated;
grant execute on function public.get_open_work_session(uuid) to authenticated;

revoke execute on function public.start_work_session(uuid) from public;
revoke execute on function public.end_work_session(uuid) from public;
revoke execute on function public.get_work_summary(uuid, date, date) from public;
revoke execute on function public.get_open_work_session(uuid) from public;

revoke execute on function public.update_work_sessions_updated_at() from public;
