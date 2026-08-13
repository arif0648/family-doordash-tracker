-- ============================================================================
-- 0029_income_mileage_log_id.sql
-- Add income.mileage_log_id column and keep it in sync in RPCs.
-- Fixes: "column mileage_log_id of relation income does not exist" when editing income.
-- ============================================================================

-- 1. Add column
alter table public.income
  add column if not exists mileage_log_id uuid
  references public.mileage_log(id)
  on delete set null;

-- 2. Backfill existing rows from the one-way mileage_log.income_id link
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'income' and column_name = 'mileage_log_id'
  ) then
    update public.income i
    set mileage_log_id = ml.id
    from public.mileage_log ml
    where ml.income_id = i.id
      and i.mileage_log_id is null;
  end if;
end $$;

-- 3. Recreate create_income_with_mileage so it sets income.mileage_log_id
--    (mirrors 0013 implementation with the extra column)
create or replace function public.create_income_with_mileage(
  p_family_id uuid,
  p_vehicle_id uuid,
  p_amount numeric,
  p_record_date date,
  p_closing_mileage numeric,
  p_note text default null
)
returns table (income_id uuid, mileage_log_id uuid, miles_driven numeric)
language plpgsql
security invoker
set search_path = public, pg_temp
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

  if not public.is_family_member(p_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  select closing_mileage into v_prev_mileage
  from public.mileage_log
  where vehicle_id = p_vehicle_id
  order by record_date desc, created_at desc
  limit 1;

  if v_prev_mileage is not null and p_closing_mileage < v_prev_mileage then
    raise exception 'MILEAGE_LOWER_THAN_PREVIOUS';
  end if;

  v_miles_driven := round((p_closing_mileage - coalesce(v_prev_mileage, 0))::numeric, 1);

  insert into public.mileage_log (
    family_id,
    vehicle_id,
    record_date,
    closing_mileage,
    miles_driven
  )
  values (
    p_family_id,
    p_vehicle_id,
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
    note,
    mileage_log_id
  )
  values (
    p_family_id,
    p_vehicle_id,
    v_user_id,
    p_amount,
    p_record_date,
    p_note,
    v_mileage_id
  )
  returning id into v_income_id;

  update public.mileage_log
  set income_id = v_income_id
  where id = v_mileage_id;

  return query
  select v_income_id, v_mileage_id, v_miles_driven;
end;
$$;

-- 4. Recreate update_income_with_mileage so it also sets income.mileage_log_id
--    (mirrors 0017 implementation with the extra column)
create or replace function public.update_income_with_mileage(
  p_income_id uuid,
  p_vehicle_id uuid,
  p_amount numeric,
  p_record_date date,
  p_closing_mileage numeric,
  p_note text default null
)
returns table (income_id uuid, mileage_log_id uuid, miles_driven numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_old_vehicle_id uuid;
  v_old_mileage_log_id uuid;
  v_new_mileage_id uuid;
  v_prev_mileage numeric;
  v_miles_driven numeric;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select family_id, vehicle_id, mileage_log_id
    into v_family_id, v_old_vehicle_id, v_old_mileage_log_id
  from public.income
  where id = p_income_id
  for update;

  if not found then
    raise exception 'INCOME_NOT_FOUND';
  end if;

  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  if v_old_mileage_log_id is not null then
    delete from public.mileage_log where id = v_old_mileage_log_id;
  end if;

  select closing_mileage into v_prev_mileage
  from public.mileage_log
  where vehicle_id = p_vehicle_id
    and id <> coalesce(v_old_mileage_log_id, '00000000-0000-0000-0000-000000000000'::uuid)
  order by record_date desc, created_at desc
  limit 1;

  if v_prev_mileage is not null and p_closing_mileage < v_prev_mileage then
    raise exception 'MILEAGE_LOWER_THAN_PREVIOUS';
  end if;

  v_miles_driven := round((p_closing_mileage - coalesce(v_prev_mileage, 0))::numeric, 1);

  insert into public.mileage_log (
    family_id,
    vehicle_id,
    record_date,
    closing_mileage,
    miles_driven,
    income_id
  )
  values (
    v_family_id,
    p_vehicle_id,
    p_record_date,
    p_closing_mileage,
    v_miles_driven,
    p_income_id
  )
  returning id into v_new_mileage_id;

  update public.income
  set
    vehicle_id = p_vehicle_id,
    amount = p_amount,
    record_date = p_record_date,
    note = p_note,
    mileage_log_id = v_new_mileage_id
  where id = p_income_id;

  update public.mileage_log
  set income_id = p_income_id
  where id = v_new_mileage_id;

  perform public.recalculate_mileage_chain(p_vehicle_id);
  perform public.validate_mileage_chain(p_vehicle_id);

  return query select p_income_id, v_new_mileage_id, v_miles_driven;
end;
$$;

-- 5. Permissions
grant execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
  to authenticated;
revoke execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
  from public;

grant execute on function public.update_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
  to authenticated;
revoke execute on function public.update_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
  from public;
