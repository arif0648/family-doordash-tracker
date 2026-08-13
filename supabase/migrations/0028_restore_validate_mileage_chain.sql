-- ============================================================================
-- 0028_restore_validate_mileage_chain.sql
-- Defensive re-creation of the validate_mileage_chain helper. It is called
-- by update_income_with_mileage and delete_income_with_mileage, and a missing
-- or incompatible function would break income editing / deletion.
-- ============================================================================

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
    from public.mileage_log
    where vehicle_id = p_vehicle_id
    order by record_date asc, created_at asc
  loop
    if v_prev is null then
      update public.mileage_log
      set miles_driven = 0
      where id = rec.id;
    else
      if rec.closing_mileage < v_prev then
        raise exception
          'CHAIN_INTEGRITY_VIOLATION: closing_mileage % is lower than previous % after recalculation',
          rec.closing_mileage, v_prev;
      end if;
      update public.mileage_log
      set miles_driven = rec.closing_mileage - v_prev
      where id = rec.id;
    end if;
    v_prev := rec.closing_mileage;
  end loop;
end;
$$;

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

grant execute on function public.recalculate_mileage_chain(uuid) to authenticated;
grant execute on function public.validate_mileage_chain(uuid) to authenticated;
revoke execute on function public.recalculate_mileage_chain(uuid) from public;
revoke execute on function public.validate_mileage_chain(uuid) from public;
