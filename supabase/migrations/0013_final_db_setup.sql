-- ============================================================================
-- 0013_final_db_setup.sql
-- FINAL PRODUCTION DB SETUP
-- ============================================================================

-- ============================================================================
-- 1. VEHICLES
-- 0001 source-of-truth schema:
-- id, family_id, full_name, short_name, created_at
-- ============================================================================

create unique index if not exists uq_vehicles_id_family
on public.vehicles (id, family_id);

create index if not exists idx_vehicles_family
on public.vehicles (family_id);

-- ============================================================================
-- 2. DOORDASH PERFORMANCE
-- ============================================================================

create table if not exists public.doordash_performance (
  id uuid primary key default gen_random_uuid(),

  family_id uuid not null
    references public.families(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  vehicle_id uuid,

  shift_date date not null default current_date,

  earnings numeric(12,2) not null default 0
    check (earnings >= 0),

  mileage_start numeric(10,1) not null,

  mileage_end numeric(10,1) not null,

  hours_worked numeric(6,2) not null
    check (hours_worked > 0 and hours_worked <= 24),

  gas_expense numeric(10,2) not null default 0
    check (gas_expense >= 0),

  notes text,

  created_at timestamptz not null default now(),

  constraint doordash_performance_vehicle_family_fkey
    foreign key (vehicle_id, family_id)
    references public.vehicles(id, family_id)
    on delete restrict,

  constraint chk_dd_mileage_flow
    check (mileage_end >= mileage_start),

  constraint chk_dd_mileage_nonnegative
    check (mileage_start >= 0 and mileage_end >= 0)
);

create index if not exists idx_dd_performance_user_date
on public.doordash_performance
(user_id, shift_date desc);

create index if not exists idx_dd_performance_family_date
on public.doordash_performance
(family_id, shift_date desc);

create index if not exists idx_dd_performance_vehicle_date
on public.doordash_performance
(vehicle_id, shift_date desc);

create index if not exists idx_dd_performance_family_vehicle_date
on public.doordash_performance
(family_id, vehicle_id, shift_date desc);

-- ============================================================================
-- 3. RLS - VEHICLES
-- ============================================================================

alter table public.vehicles
enable row level security;

drop policy if exists vehicles_select_family
on public.vehicles;

create policy vehicles_select_family
on public.vehicles
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = public.vehicles.family_id
      and fm.user_id = auth.uid()
  )
);

-- ============================================================================
-- 4. RLS - DOORDASH PERFORMANCE
-- ============================================================================

alter table public.doordash_performance
enable row level security;

drop policy if exists dd_perf_select_family
on public.doordash_performance;

create policy dd_perf_select_family
on public.doordash_performance
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = public.doordash_performance.family_id
      and fm.user_id = auth.uid()
  )
);

drop policy if exists dd_perf_insert_own
on public.doordash_performance;

create policy dd_perf_insert_own
on public.doordash_performance
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = public.doordash_performance.family_id
      and fm.user_id = auth.uid()
  )
);

drop policy if exists dd_perf_update_own
on public.doordash_performance;

create policy dd_perf_update_own
on public.doordash_performance
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = public.doordash_performance.family_id
      and fm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = public.doordash_performance.family_id
      and fm.user_id = auth.uid()
  )
);

drop policy if exists dd_perf_delete_own
on public.doordash_performance;

create policy dd_perf_delete_own
on public.doordash_performance
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id = public.doordash_performance.family_id
      and fm.user_id = auth.uid()
  )
);

grant select
on public.vehicles
to authenticated;

grant select, insert, update, delete
on public.doordash_performance
to authenticated;

-- ============================================================================
-- 5. DASHBOARD SUMMARY
-- ============================================================================

create or replace view public.family_doordash_summary
with (security_invoker = true)
as
select
  family_id,

  count(*)::integer as total_shifts,

  coalesce(sum(earnings), 0)::numeric(14,2)
    as total_earnings,

  coalesce(sum(mileage_end - mileage_start), 0)::numeric(14,1)
    as total_mileage,

  coalesce(sum(hours_worked), 0)::numeric(14,2)
    as total_hours,

  coalesce(sum(gas_expense), 0)::numeric(14,2)
    as total_gas_expense,

  case
    when coalesce(sum(hours_worked), 0) > 0
    then (sum(earnings) / sum(hours_worked))::numeric(14,2)
    else 0
  end as average_hourly_earnings,

  case
    when coalesce(sum(mileage_end - mileage_start), 0) > 0
    then (
      sum(earnings) /
      sum(mileage_end - mileage_start)
    )::numeric(14,2)
    else 0
  end as earnings_per_mile,

  (
    sum(earnings) - sum(gas_expense)
  )::numeric(14,2) as earnings_after_gas

from public.doordash_performance
group by family_id;

-- ============================================================================
-- 6. VEHICLE SUMMARY
-- ============================================================================

create or replace view public.vehicle_doordash_summary
with (security_invoker = true)
as
select
  dp.family_id,
  dp.vehicle_id,

  v.full_name,
  v.short_name,

  count(dp.id)::integer as total_shifts,

  coalesce(sum(dp.earnings), 0)::numeric(14,2)
    as total_earnings,

  coalesce(
    sum(dp.mileage_end - dp.mileage_start),
    0
  )::numeric(14,1) as total_mileage,

  coalesce(sum(dp.hours_worked), 0)::numeric(14,2)
    as total_hours,

  coalesce(sum(dp.gas_expense), 0)::numeric(14,2)
    as total_gas_expense,

  case
    when sum(dp.hours_worked) > 0
    then (
      sum(dp.earnings) /
      sum(dp.hours_worked)
    )::numeric(14,2)
    else 0
  end as hourly_earnings,

  case
    when sum(dp.mileage_end - dp.mileage_start) > 0
    then (
      sum(dp.earnings) /
      sum(dp.mileage_end - dp.mileage_start)
    )::numeric(14,2)
    else 0
  end as earnings_per_mile

from public.doordash_performance dp

left join public.vehicles v
  on v.id = dp.vehicle_id
  and v.family_id = dp.family_id

group by
  dp.family_id,
  dp.vehicle_id,
  v.full_name,
  v.short_name;

-- ============================================================================
-- 7. DAILY SUMMARY
-- ============================================================================

create or replace view public.family_daily_doordash_summary
with (security_invoker = true)
as
select
  family_id,
  shift_date,

  count(*)::integer as shifts,

  coalesce(sum(earnings), 0)::numeric(14,2)
    as earnings,

  coalesce(
    sum(mileage_end - mileage_start),
    0
  )::numeric(14,1) as mileage,

  coalesce(sum(hours_worked), 0)::numeric(14,2)
    as hours,

  coalesce(sum(gas_expense), 0)::numeric(14,2)
    as gas_expense,

  case
    when sum(hours_worked) > 0
    then (
      sum(earnings) /
      sum(hours_worked)
    )::numeric(14,2)
    else 0
  end as hourly_earnings

from public.doordash_performance
group by
  family_id,
  shift_date;

grant select
on public.family_doordash_summary
to authenticated;

grant select
on public.vehicle_doordash_summary
to authenticated;

grant select
on public.family_daily_doordash_summary
to authenticated;

-- ============================================================================
-- 8. REALTIME
-- ============================================================================

alter table public.doordash_performance
replica identity default;

alter table public.vehicles
replica identity default;

do $$
begin

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c
        on c.oid = pr.prrelid
      join pg_namespace n
        on n.oid = c.relnamespace
      where pr.prpubid = (
        select oid
        from pg_publication
        where pubname = 'supabase_realtime'
      )
      and n.nspname = 'public'
      and c.relname = 'doordash_performance'
    ) then

      alter publication supabase_realtime
        add table public.doordash_performance;

    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c
        on c.oid = pr.prrelid
      join pg_namespace n
        on n.oid = c.relnamespace
      where pr.prpubid = (
        select oid
        from pg_publication
        where pubname = 'supabase_realtime'
      )
      and n.nspname = 'public'
      and c.relname = 'vehicles'
    ) then

      alter publication supabase_realtime
        add table public.vehicles;

    end if;

  end if;

end;
$$;

-- ============================================================================
-- 9. DOCUMENTATION
-- ============================================================================

comment on table public.vehicles is
'Aile araçları.';

comment on table public.doordash_performance is
'DoorDash günlük performans verileri.';

-- ============================================================================
-- 10. RUNTIME REPAIR OF ATOMIC INCOME/MILEAGE RPCs
--
-- 0009 was already applied remotely and removed income.mileage_log_id.
-- The original 0004 RPCs therefore cannot be used unchanged.  These
-- replacements preserve the existing RPC signatures and use the surviving
-- mileage_log.income_id model.
-- ============================================================================

create or replace function public.validate_mileage_chain(
  p_vehicle_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  rec record;
  v_prev numeric := null;
begin
  if p_vehicle_id is null then
    raise exception 'VEHICLE_REQUIRED';
  end if;

  for rec in
    select id, closing_mileage, miles_driven
    from public.mileage_log
    where vehicle_id = p_vehicle_id
    order by record_date asc, created_at asc
  loop
    if v_prev is null then
      if rec.miles_driven <> 0 then
        raise exception 'CHAIN_INTEGRITY_VIOLATION';
      end if;
    else
      if rec.closing_mileage < v_prev then
        raise exception
          'CHAIN_INTEGRITY_VIOLATION: closing_mileage % is lower than previous %',
          rec.closing_mileage, v_prev;
      end if;

      if rec.miles_driven <> rec.closing_mileage - v_prev then
        raise exception 'CHAIN_INTEGRITY_VIOLATION';
      end if;
    end if;

    v_prev := rec.closing_mileage;
  end loop;
end;
$$;

create or replace function public.create_income_with_mileage(
  p_family_id uuid,
  p_vehicle_id uuid,
  p_amount numeric,
  p_record_date date,
  p_closing_mileage numeric,
  p_note text default null
)
returns table (
  income_id uuid,
  mileage_log_id uuid,
  miles_driven numeric
)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_prev_mileage numeric;
  v_miles_driven numeric;
  v_mileage_id uuid;
  v_income_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = v_user_id
  ) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  if not exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and v.family_id = p_family_id
  ) then
    raise exception 'VEHICLE_FAMILY_MISMATCH';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_closing_mileage is null or p_closing_mileage < 0 then
    raise exception 'INVALID_MILEAGE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_vehicle_id::text, 0)
  );

  select ml.closing_mileage
    into v_prev_mileage
  from public.mileage_log ml
  where ml.vehicle_id = p_vehicle_id
    and ml.family_id = p_family_id
  order by ml.record_date desc, ml.created_at desc
  limit 1;

  if v_prev_mileage is null then
    v_miles_driven := 0;
  elsif p_closing_mileage < v_prev_mileage then
    raise exception
      'MILEAGE_LOWER_THAN_PREVIOUS: new closing mileage (%) is lower than previous (%)',
      p_closing_mileage, v_prev_mileage;
  else
    v_miles_driven := p_closing_mileage - v_prev_mileage;
  end if;

  insert into public.mileage_log (
    family_id,
    vehicle_id,
    user_id,
    record_date,
    closing_mileage,
    miles_driven
  )
  values (
    p_family_id,
    p_vehicle_id,
    v_user_id,
    p_record_date,
    p_closing_mileage,
    v_miles_driven
  )
  returning id into v_mileage_id;

  insert into public.income (
    family_id,
    vehicle_id,
    user_id,
    amount,
    record_date,
    note
  )
  values (
    p_family_id,
    p_vehicle_id,
    v_user_id,
    p_amount,
    p_record_date,
    p_note
  )
  returning id into v_income_id;

  update public.mileage_log
  set income_id = v_income_id
  where id = v_mileage_id;

  return query
  select v_income_id, v_mileage_id, v_miles_driven;
end;
$$;

create or replace function public.delete_income_with_mileage(
  p_income_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_vehicle_id uuid;
  v_family_id uuid;
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select vehicle_id, family_id, user_id
    into v_vehicle_id, v_family_id, v_owner_id
  from public.income
  where id = p_income_id
  for update;

  if not found then
    raise exception 'INCOME_NOT_FOUND';
  end if;

  if v_owner_id <> v_user_id then
    raise exception 'NOT_OWNER';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = v_family_id
      and fm.user_id = v_user_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_vehicle_id::text, 0)
  );

  delete from public.income
  where id = p_income_id;

  perform public.recalculate_mileage_chain(v_vehicle_id);
  perform public.validate_mileage_chain(v_vehicle_id);
end;
$$;

grant execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
to authenticated;

grant execute on function public.delete_income_with_mileage(uuid)
to authenticated;

revoke execute on function public.validate_mileage_chain(uuid)
from public;

revoke execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
from public;

revoke execute on function public.delete_income_with_mileage(uuid)
from public;

grant execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
to authenticated;

grant execute on function public.delete_income_with_mileage(uuid)
to authenticated;

-- ============================================================================
-- 11. DOCUMENTATION
-- ============================================================================

comment on function public.validate_mileage_chain(uuid) is
'Validates the mileage chain using mileage_log.income_id and the current schema.';

comment on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text) is
'Creates income and its mileage_log atomically using the current one-way mileage_log.income_id model.';

comment on function public.delete_income_with_mileage(uuid) is
'Deletes an income row, cascades its linked mileage_log row, recalculates and validates the vehicle mileage chain.';
