-- ============================================================================
-- 0025_family_weekly_goals.sql
-- Per-family-member weekly income goals + aggregated family goal.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------------
create table if not exists public.family_member_goals (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_goal numeric not null default 1400,
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------
create index if not exists idx_family_member_goals_family
  on public.family_member_goals (family_id);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.family_member_goals enable row level security;

drop policy if exists family_member_goals_select_family on public.family_member_goals;
create policy family_member_goals_select_family
  on public.family_member_goals
  for select
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists family_member_goals_insert_family on public.family_member_goals;
create policy family_member_goals_insert_family
  on public.family_member_goals
  for insert
  to authenticated
  with check (
    public.is_family_member(family_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists family_member_goals_update_family on public.family_member_goals;
create policy family_member_goals_update_family
  on public.family_member_goals
  for update
  to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and user_id = auth.uid()
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and user_id = auth.uid()
  );

drop policy if exists family_member_goals_delete_family on public.family_member_goals;
create policy family_member_goals_delete_family
  on public.family_member_goals
  for delete
  to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. AUTO-CREATE A GOAL ROW FOR NEW FAMILY MEMBERS (or ensure default)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_member_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_member_goals (family_id, user_id, weekly_goal)
  values (new.family_id, new.user_id, 1400)
  on conflict (family_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_member_goal on public.family_members;
create trigger trg_ensure_member_goal
  after insert on public.family_members
  for each row
  execute function public.ensure_member_goal();

-- ---------------------------------------------------------------------------
-- 5. RPC: GET FAMILY WEEKLY GOALS
-- Returns each member's goal plus this week's earnings and remaining.
-- ---------------------------------------------------------------------------
create or replace function public.get_family_weekly_goals(
  p_family_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  weekly_goal numeric,
  week_income numeric,
  remaining numeric,
  percent numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date;
  v_end date;
  v_now timestamptz := now() at time zone 'America/Los_Angeles';
  v_weekday int;
  v_today date;
begin
  if not public.is_family_member(p_family_id, auth.uid()) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  v_today := v_now::date;
  v_weekday := extract(dow from v_now);
  -- Monday is start of week (dow=1). PostgreSQL extract dow: 0=Sun..6=Sat
  v_start := v_today - (case when v_weekday = 0 then 6 else v_weekday - 1 end);
  v_end := v_start + 6;

  return query
  select
    fm.user_id,
    p.display_name,
    coalesce(g.weekly_goal, 1400) as weekly_goal,
    coalesce(i.week_income, 0) as week_income,
    greatest(coalesce(g.weekly_goal, 1400) - coalesce(i.week_income, 0), 0) as remaining,
    case
      when coalesce(g.weekly_goal, 1400) > 0
      then round((coalesce(i.week_income, 0) / coalesce(g.weekly_goal, 1400)) * 100, 2)
      else 0
    end as percent
  from public.family_members fm
  join public.profiles p on p.user_id = fm.user_id
  left join public.family_member_goals g
    on g.family_id = fm.family_id and g.user_id = fm.user_id
  left join lateral (
    select coalesce(sum(amount), 0) as week_income
    from public.income
    where family_id = p_family_id
      and user_id = fm.user_id
      and record_date between v_start and v_end
  ) i on true
  where fm.family_id = p_family_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: SET MY WEEKLY GOAL
-- ---------------------------------------------------------------------------
create or replace function public.set_weekly_goal(
  p_family_id uuid,
  p_weekly_goal numeric
)
returns void
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

  if p_weekly_goal is null or p_weekly_goal <= 0 then
    raise exception 'INVALID_GOAL';
  end if;

  insert into public.family_member_goals (family_id, user_id, weekly_goal, updated_at)
  values (p_family_id, v_user_id, p_weekly_goal, now())
  on conflict (family_id, user_id)
  do update set weekly_goal = p_weekly_goal, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. PERMISSIONS
-- ---------------------------------------------------------------------------
grant execute on function public.get_family_weekly_goals(uuid) to authenticated;
grant execute on function public.set_weekly_goal(uuid, numeric) to authenticated;

revoke execute on function public.get_family_weekly_goals(uuid) from public;
revoke execute on function public.set_weekly_goal(uuid, numeric) from public;
