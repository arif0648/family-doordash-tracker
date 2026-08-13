-- 0015_vehicle_ui_and_rls.sql
-- Allow family members to add vehicles from the app, while preserving
-- the existing database hard limit of 3 vehicles per family.

alter table public.vehicles
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists year integer,
  add column if not exists fuel_type text;

alter table public.vehicles
  drop constraint if exists vehicles_year_check;
alter table public.vehicles
  add constraint vehicles_year_check
  check (year is null or year between 1990 and 2100);

alter table public.vehicles
  drop constraint if exists vehicles_fuel_type_check;
alter table public.vehicles
  add constraint vehicles_fuel_type_check
  check (fuel_type is null or fuel_type in ('gasoline','hybrid','plug_in_hybrid','electric','diesel','other'));

drop policy if exists vehicles_insert_family on public.vehicles;
create policy vehicles_insert_family
on public.vehicles
for insert
to authenticated
with check (public.is_family_member(family_id, auth.uid()));

drop policy if exists vehicles_update_family on public.vehicles;
create policy vehicles_update_family
on public.vehicles
for update
to authenticated
using (public.is_family_member(family_id, auth.uid()))
with check (public.is_family_member(family_id, auth.uid()));

grant insert, update on public.vehicles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'vehicles'
  ) then
    alter publication supabase_realtime add table public.vehicles;
  end if;
end
$$;



