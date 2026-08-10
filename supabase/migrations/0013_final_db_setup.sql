-- ============================================================================
-- 0013_final_db_setup.sql
-- VERSION: 2.1 (DÜZELTİLMİŞ NİHAİ SÜRÜM)
-- FINAL PRODUCTION CLOSURE
-- ============================================================================

-- ============================================================================
-- 1. VEHICLES
-- ============================================================================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year integer not null,
  trim text,
  fuel_type text not null default 'hybrid',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicles_year_check check (year between 1990 and 2100),
  constraint vehicles_fuel_type_check check (
    fuel_type in ('gasoline', 'hybrid', 'plug_in_hybrid', 'electric', 'diesel', 'other')
  ),
  constraint vehicles_make_check check (length(trim(make)) > 0),
  constraint vehicles_model_check check (length(trim(model)) > 0)
);

-- Composite key index for foreign key mapping
create unique index if not exists uq_vehicles_id_family on public.vehicles (id, family_id);

-- Aynı kullanıcı aynı anda yalnızca bir aktif araç seçebilir.
create unique index if not exists uq_active_vehicle_per_user on public.vehicles (user_id) where is_active = true;

create index if not exists idx_vehicles_family on public.vehicles (family_id);
create index if not exists idx_vehicles_user on public.vehicles (user_id);
create index if not exists idx_vehicles_family_active on public.vehicles (family_id, is_active);

drop trigger if exists trg_vehicles_touch on public.vehicles;
create trigger trg_vehicles_touch
before update on public.vehicles
for each row execute function public.touch_updated_at();

-- ============================================================================
-- 2. DOORDASH PERFORMANCE
-- ============================================================================
create table if not exists public.doordash_performance (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  shift_date date not null default current_date,
  earnings numeric(12,2) not null default 0 check (earnings >= 0),
  mileage_start numeric(10,1) not null,
  mileage_end numeric(10,1) not null,
  hours_worked numeric(6,2) not null check (hours_worked > 0 and hours_worked <= 24),
  gas_expense numeric(10,2) not null default 0 check (gas_expense >= 0),
  notes text,
  created_at timestamptz not null default now(),

  constraint chk_mileage_flow check (mileage_end >= mileage_start),
  constraint chk_mileage_nonnegative check (mileage_start >= 0 and mileage_end >= 0),
  
  -- DÜZELTME: Araç silindiğinde family_id'nin NULL'a düşüp patlamaması için sadece vehicle_id hedeflendi.
  constraint fk_dd_performance_vehicle_family
    foreign key (vehicle_id, family_id)
    references public.vehicles(id, family_id)
    on delete set null (vehicle_id)
);

create index if not exists idx_dd_performance_user_date on public.doordash_performance (user_id, shift_date desc);
create index if not exists idx_dd_performance_family_date on public.doordash_performance (family_id, shift_date desc);
create index if not exists idx_dd_performance_vehicle_date on public.doordash_performance (vehicle_id, shift_date desc);
create index if not exists idx_dd_performance_family_vehicle_date on public.doordash_performance (family_id, vehicle_id, shift_date desc);

-- ============================================================================
-- 3. RLS — POLICIES
-- ============================================================================
alter table public.vehicles enable row level security;

drop policy if exists vehicles_select_family on public.vehicles;
create policy vehicles_select_family on public.vehicles for select to authenticated 
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists vehicles_insert_own on public.vehicles;
create policy vehicles_insert_own on public.vehicles for insert to authenticated 
  with check (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));

drop policy if exists vehicles_update_own on public.vehicles;
create policy vehicles_update_own on public.vehicles for update to authenticated 
  using (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()))
  with check (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));

drop policy if exists vehicles_delete_own on public.vehicles;
create policy vehicles_delete_own on public.vehicles for delete to authenticated 
  using (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));

alter table public.doordash_performance enable row level security;

drop policy if exists dd_perf_select_family on public.doordash_performance;
create policy dd_perf_select_family on public.doordash_performance for select to authenticated 
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists dd_perf_insert_own on public.doordash_performance;
create policy dd_perf_insert_own on public.doordash_performance for insert to authenticated 
  with check (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));

drop policy if exists dd_perf_update_own on public.doordash_performance;
create policy dd_perf_update_own on public.doordash_performance for update to authenticated 
  using (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()))
  with check (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));

drop policy if exists dd_perf_delete_own on public.doordash_performance;
create policy dd_perf_delete_own on public.doordash_performance for delete to authenticated 
  using (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));

grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.doordash_performance to authenticated;

-- ============================================================================
-- 4. DASHBOARD OPTIMIZED VIEWS (SECURITY INVOKER)
-- ============================================================================
create or replace view public.family_doordash_summary with (security_invoker = true) as
select
  family_id,
  count(*)::integer as total_shifts,
  coalesce(sum(earnings), 0)::numeric(14,2) as total_earnings,
  coalesce(sum(mileage_end - mileage_start), 0)::numeric(14,1) as total_mileage,
  coalesce(sum(hours_worked), 0)::numeric(14,2) as total_hours,
  coalesce(sum(gas_expense), 0)::numeric(14,2) as total_gas_expense,
  case when coalesce(sum(hours_worked), 0) > 0 then (sum(earnings) / sum(hours_worked))::numeric(14,2) else 0 end as average_hourly_earnings,
  case when coalesce(sum(mileage_end - mileage_start), 0) > 0 then (sum(earnings) / sum(mileage_end - mileage_start))::numeric(14,2) else 0 end as earnings_per_mile,
  (sum(earnings) - sum(gas_expense))::numeric(14,2) as earnings_after_gas
from public.doordash_performance
group by family_id;

create or replace view public.vehicle_doordash_summary with (security_invoker = true) as
select
  dp.family_id,
  dp.vehicle_id,
  v.make, v.model, v.year, v.trim,
  count(dp.id)::integer as total_shifts,
  coalesce(sum(dp.earnings), 0)::numeric(14,2) as total_earnings,
  coalesce(sum(dp.mileage_end - dp.mileage_start), 0)::numeric(14,1) as total_mileage,
  coalesce(sum(dp.hours_worked), 0)::numeric(14,2) as total_hours,
  coalesce(sum(dp.gas_expense), 0)::numeric(14,2) as total_gas_expense,
  case when sum(dp.hours_worked) > 0 then (sum(dp.earnings) / sum(dp.hours_worked))::numeric(14,2) else 0 end as hourly_earnings,
  case when sum(dp.mileage_end - dp.mileage_start) > 0 then (sum(dp.earnings) / sum(dp.mileage_end - dp.mileage_start))::numeric(14,2) else 0 end as earnings_per_mile
from public.doordash_performance dp
left join public.vehicles v on v.id = dp.vehicle_id and v.family_id = dp.family_id
group by dp.family_id, dp.vehicle_id, v.make, v.model, v.year, v.trim;

create or replace view public.family_daily_doordash_summary with (security_invoker = true) as
select
  family_id,
  shift_date,
  count(*)::integer as shifts,
  coalesce(sum(earnings), 0)::numeric(14,2) as earnings,
  coalesce(sum(mileage_end - mileage_start), 0)::numeric(14,1) as mileage,
  coalesce(sum(hours_worked), 0)::numeric(14,2) as hours,
  coalesce(sum(gas_expense), 0)::numeric(14,2) as gas_expense,
  case when sum(hours_worked) > 0 then (sum(earnings) / sum(hours_worked))::numeric(14,2) else 0 end as hourly_earnings
from public.doordash_performance
group by family_id, shift_date;

grant select on public.family_doordash_summary to authenticated;
grant select on public.vehicle_doordash_summary to authenticated;
grant select on public.family_daily_doordash_summary to authenticated;

-- ============================================================================
-- 5. REALTIME PUBLICATION
-- ============================================================================
alter table public.doordash_performance replica identity default;
alter table public.vehicles replica identity default;

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr join pg_class c on c.oid = pr.prrelid join pg_namespace n on n.oid = c.relnamespace
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime') and n.nspname = 'public' and c.relname = 'doordash_performance'
  ) then
    alter publication supabase_realtime add table public.doordash_performance;
  end if;
  
  if not exists (
    select 1 from pg_publication_rel pr join pg_class c on c.oid = pr.prrelid join pg_namespace n on n.oid = c.relnamespace
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime') and n.nspname = 'public' and c.relname = 'vehicles'
  ) then
    alter publication supabase_realtime add table public.vehicles;
  end if;
end;
$$;

-- ============================================================================
-- 6. DOCUMENTATION
-- ============================================================================
comment on table public.vehicles is 'Aile filosundaki araçlar.';
comment on table public.doordash_performance is 'DoorDash günlük performans verileri.';
