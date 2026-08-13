-- ============================================================================
-- 0019_vehicle_archive_system.sql
-- Vehicle archive/restore system - preserve historical data
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ADD IS_ACTIVE FIELD TO VEHICLES
-- ---------------------------------------------------------------------------

alter table public.vehicles
  add column if not exists is_active boolean default true;

-- Update existing vehicles to be active
update public.vehicles
set is_active = true
where is_active is null;

-- ---------------------------------------------------------------------------
-- 2. UPDATE VEHICLE INSERT POLICY TO SET DEFAULT IS_ACTIVE
-- ---------------------------------------------------------------------------

drop policy if exists vehicles_insert_family on public.vehicles;

create policy vehicles_insert_family
on public.vehicles
for insert
to authenticated
with check (
  public.is_family_member(family_id, auth.uid())
  and is_active = true
);

-- ---------------------------------------------------------------------------
-- 3. ARCHIVE VEHICLE RPC
-- ---------------------------------------------------------------------------

create or replace function public.archive_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_income_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get vehicle info and lock it
  select family_id
    into v_family_id
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  -- Verify family membership
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Check if vehicle has any income records
  select count(*)
    into v_income_count
  from public.income
  where vehicle_id = p_vehicle_id;

  if v_income_count > 0 then
    -- Vehicle has historical data - soft archive
    update public.vehicles
    set is_active = false
    where id = p_vehicle_id;
  else
    -- Vehicle has no historical data - can be deleted
    delete from public.vehicles where id = p_vehicle_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RESTORE VEHICLE RPC
-- ---------------------------------------------------------------------------

create or replace function public.restore_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_active_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get vehicle info and lock it
  select family_id
    into v_family_id
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  -- Verify family membership
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Check active vehicle count (max 3)
  select count(*)
    into v_active_count
  from public.vehicles
  where family_id = v_family_id
    and is_active = true;

  if v_active_count >= 3 then
    raise exception 'FAMILY_VEHICLE_LIMIT_EXCEEDED: a family may have at most 3 active vehicles';
  end if;

  -- Restore vehicle
  update public.vehicles
  set is_active = true
  where id = p_vehicle_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. UPDATE VEHICLE SELECT POLICY TO INCLUDE ARCHIVED VEHICLES
-- Family members can see both active and archived vehicles
-- ---------------------------------------------------------------------------

drop policy if exists vehicles_select_family on public.vehicles;

create policy vehicles_select_family
on public.vehicles
for select
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
);

-- ---------------------------------------------------------------------------
-- 6. UPDATE VEHICLE UPDATE POLICY
-- Allow updating basic fields but prevent changing is_active directly
-- Use archive/restore RPCs instead
-- ---------------------------------------------------------------------------

drop policy if exists vehicles_update_family on public.vehicles;

create policy vehicles_update_family
on public.vehicles
for update
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
)
with check (
  public.is_family_member(family_id, auth.uid())
);

-- ---------------------------------------------------------------------------
-- 7. CREATE HELPER FUNCTION TO GET ACTIVE VEHICLES ONLY
-- ---------------------------------------------------------------------------

create or replace function public.get_active_vehicles(p_family_id uuid)
returns table (
  id uuid,
  family_id uuid,
  full_name text,
  short_name text,
  make text,
  model text,
  year integer,
  fuel_type text,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    v.id,
    v.family_id,
    v.full_name,
    v.short_name,
    v.make,
    v.model,
    v.year,
    v.fuel_type,
    v.is_active,
    v.created_at
  from public.vehicles v
  where v.family_id = p_family_id
    and v.is_active = true
  order by v.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 8. GRANT PERMISSIONS
-- ---------------------------------------------------------------------------

grant execute on function public.archive_vehicle(uuid)
to authenticated;

grant execute on function public.restore_vehicle(uuid)
to authenticated;

grant execute on function public.get_active_vehicles(uuid)
to authenticated;

revoke execute on function public.archive_vehicle(uuid)
from public;

revoke execute on function public.restore_vehicle(uuid)
from public;

revoke execute on function public.get_active_vehicles(uuid)
from public;

-- ---------------------------------------------------------------------------
-- 9. DOCUMENTATION
-- ---------------------------------------------------------------------------

comment on column public.vehicles.is_active is
'Araç aktif mi (true) veya arşivlenmiş mi (false). Arşivlenmiş araçlar geçmiş verilerini korur ama normal seçimlerde görünmez.';

comment on function public.archive_vehicle(uuid) is
'Aracı arşivler. Geçmiş verisi varsa soft archive (is_active=false), yoksa fiziksel silme.';

comment on function public.restore_vehicle(uuid) is
'Arşivlenmiş aracı geri yükler. Aktif araç sayısı 3 ile sınırlıdır.';

comment on function public.get_active_vehicles(uuid) is
'Sadece aktif araçları döndürür (is_active=true).';
