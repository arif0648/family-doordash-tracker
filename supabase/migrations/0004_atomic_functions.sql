-- ============================================================================
-- 0004_atomic_functions.sql
-- IMPLEMENTATION LOCK #3 — income + mileage created/edited/deleted atomically,
-- chain recalculation happens entirely inside the database, never in
-- fragmented frontend calls.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_income_with_mileage
-- Creates one income row + one mileage_log row in a single transaction.
-- Computes miles_driven from the previous chain entry for this vehicle.
-- ---------------------------------------------------------------------------
create or replace function public.create_income_with_mileage(
  p_family_id     uuid,
  p_vehicle_id    uuid,
  p_amount        numeric,
  p_record_date   date,
  p_closing_mileage numeric,
  p_note          text default null
)
returns table (income_id uuid, mileage_log_id uuid, miles_driven numeric)
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

  -- Find the most recent chain entry for this vehicle strictly before
  -- this (date, created_at) point — chain order is vehicle_id, record_date, created_at.
  select ml.closing_mileage into v_prev_mileage
  from mileage_log ml
  where ml.vehicle_id = p_vehicle_id
  order by ml.record_date desc, ml.created_at desc
  limit 1;

  if v_prev_mileage is null then
    v_miles_driven := 0; -- first-ever reading for this vehicle: no prior baseline
  else
    if p_closing_mileage < v_prev_mileage then
      raise exception 'MILEAGE_LOWER_THAN_PREVIOUS: new closing mileage (%) is lower than previous (%)',
        p_closing_mileage, v_prev_mileage;
    end if;
    v_miles_driven := p_closing_mileage - v_prev_mileage;
  end if;

  insert into mileage_log (family_id, vehicle_id, user_id, record_date, closing_mileage, miles_driven)
  values (p_family_id, p_vehicle_id, v_user_id, p_record_date, p_closing_mileage, v_miles_driven)
  returning id into v_mileage_id;

  insert into income (family_id, vehicle_id, user_id, amount, record_date, note, mileage_log_id)
  values (p_family_id, p_vehicle_id, v_user_id, p_amount, p_record_date, p_note, v_mileage_id)
  returning id into v_income_id;

  update mileage_log set income_id = v_income_id where id = v_mileage_id;

  return query select v_income_id, v_mileage_id, v_miles_driven;
end;
$$;

-- ---------------------------------------------------------------------------
-- recalculate_mileage_chain_from(vehicle_id)
-- Recomputes miles_driven for the ENTIRE chain of a vehicle, in chronological
-- order. Called after any edit/delete inside the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_mileage_chain(p_vehicle_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  rec record;
  v_prev numeric := null;
begin
  for rec in
    select id, closing_mileage
    from mileage_log
    where vehicle_id = p_vehicle_id
    order by record_date asc, created_at asc
  loop
    if v_prev is null then
      update mileage_log set miles_driven = 0 where id = rec.id;
    else
      if rec.closing_mileage < v_prev then
        raise exception 'CHAIN_INTEGRITY_VIOLATION: closing_mileage % is lower than previous % after recalculation', rec.closing_mileage, v_prev;
      end if;
      update mileage_log set miles_driven = rec.closing_mileage - v_prev where id = rec.id;
    end if;
    v_prev := rec.closing_mileage;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- edit_mileage_entry
-- Edits a single mileage_log row's closing_mileage, then recalculates the
-- whole chain for that vehicle, atomically (TEST H scenario).
-- ---------------------------------------------------------------------------
create or replace function public.edit_mileage_entry(
  p_mileage_log_id uuid,
  p_new_closing_mileage numeric
)
returns void
language plpgsql
security invoker
as $$
declare
  v_vehicle_id uuid;
  v_owner uuid;
begin
  select vehicle_id, user_id into v_vehicle_id, v_owner
  from mileage_log where id = p_mileage_log_id;

  if v_vehicle_id is null then
    raise exception 'MILEAGE_LOG_NOT_FOUND';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'NOT_OWNER: only the creating user may edit this record';
  end if;

  update mileage_log
  set closing_mileage = p_new_closing_mileage
  where id = p_mileage_log_id;

  perform public.recalculate_mileage_chain(v_vehicle_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_income_with_mileage
-- Deletes an income row + its mileage_log row, then recalculates the chain
-- for that vehicle, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.delete_income_with_mileage(p_income_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_vehicle_id uuid;
  v_owner uuid;
begin
  select vehicle_id, user_id into v_vehicle_id, v_owner
  from income where id = p_income_id;

  if v_vehicle_id is null then
    raise exception 'INCOME_NOT_FOUND';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'NOT_OWNER: only the creating user may delete this record';
  end if;

  -- income_id FK on mileage_log is ON DELETE CASCADE, so deleting income
  -- removes the linked mileage_log row too, in the same statement/transaction.
  delete from income where id = p_income_id;

  perform public.recalculate_mileage_chain(v_vehicle_id);
end;
$$;
