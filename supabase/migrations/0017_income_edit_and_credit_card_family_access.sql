-- ============================================================================
-- 0017_income_edit_and_credit_card_family_access.sql
-- 1. Add update_income_with_mileage RPC for safe income editing
-- 2. Update credit card RLS to family-shared access
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. UPDATE_INCOME_WITH_MILEAGE RPC
-- Safe income editing with mileage chain recalculation
-- ---------------------------------------------------------------------------

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
  v_mileage_record_exists boolean;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Lock and fetch existing income record
  select family_id, vehicle_id, mileage_log_id
    into v_family_id, v_old_vehicle_id, v_old_mileage_log_id
  from public.income
  where id = p_income_id
  for update;

  if not found then
    raise exception 'INCOME_NOT_FOUND';
  end if;

  -- Verify family membership
  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = v_family_id
      and fm.user_id = v_user_id
  ) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Verify new vehicle belongs to same family
  if not exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and v.family_id = v_family_id
  ) then
    raise exception 'VEHICLE_FAMILY_MISMATCH';
  end if;

  -- Validate amount
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Validate mileage
  if p_closing_mileage is null or p_closing_mileage < 0 then
    raise exception 'INVALID_MILEAGE';
  end if;

  -- Lock vehicle for chain integrity
  perform pg_advisory_xact_lock(hashtextextended(p_vehicle_id::text, 0));

  -- If vehicle changed, also lock old vehicle
  if p_vehicle_id <> v_old_vehicle_id then
    perform pg_advisory_xact_lock(hashtextextended(v_old_vehicle_id::text, 0));
  end if;

  -- Delete old mileage log record
  delete from public.mileage_log where id = v_old_mileage_log_id;

  -- Recalculate old vehicle chain if vehicle changed
  if p_vehicle_id <> v_old_vehicle_id then
    perform public.recalculate_mileage_chain(v_old_vehicle_id);
    perform public.validate_mileage_chain(v_old_vehicle_id);
  end if;

  -- Find previous mileage for new vehicle
  select ml.closing_mileage
    into v_prev_mileage
  from public.mileage_log ml
  where ml.vehicle_id = p_vehicle_id
    and ml.family_id = v_family_id
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

  -- Create new mileage log
  insert into public.mileage_log (
    family_id,
    vehicle_id,
    user_id,
    record_date,
    closing_mileage,
    miles_driven
  )
  values (
    v_family_id,
    p_vehicle_id,
    v_user_id,
    p_record_date,
    p_closing_mileage,
    v_miles_driven
  )
  returning id into v_new_mileage_id;

  -- Update income record
  update public.income
  set
    vehicle_id = p_vehicle_id,
    amount = p_amount,
    record_date = p_record_date,
    note = p_note,
    mileage_log_id = v_new_mileage_id
  where id = p_income_id;

  -- Link mileage log to income
  update public.mileage_log
  set income_id = p_income_id
  where id = v_new_mileage_id;

  -- Recalculate new vehicle chain
  perform public.recalculate_mileage_chain(p_vehicle_id);
  perform public.validate_mileage_chain(p_vehicle_id);

  return query select p_income_id, v_new_mileage_id, v_miles_driven;
end;
$$;

-- Grant execute permission
grant execute on function public.update_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
to authenticated;

-- Revoke public execute
revoke execute on function public.update_income_with_mileage(uuid,uuid,numeric,date,numeric,text)
from public;

-- ---------------------------------------------------------------------------
-- 2. CREDIT CARD RLS UPDATE - Family Shared Access
-- Change from owner-only to family-wide access
-- ---------------------------------------------------------------------------

-- Drop existing owner-only policies
drop policy if exists credit_cards_select_own on public.credit_cards;
drop policy if exists credit_cards_insert_own on public.credit_cards;
drop policy if exists credit_cards_update_own on public.credit_cards;
drop policy if exists credit_cards_delete_own on public.credit_cards;

-- Drop existing family policies if re-running
drop policy if exists credit_cards_select_family on public.credit_cards;
drop policy if exists credit_cards_insert_family on public.credit_cards;
drop policy if exists credit_cards_update_family on public.credit_cards;
drop policy if exists credit_cards_delete_family on public.credit_cards;

-- Create family-wide policies
create policy credit_cards_select_family
on public.credit_cards
for select
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
);

create policy credit_cards_insert_family
on public.credit_cards
for insert
to authenticated
with check (
  public.is_family_member(family_id, auth.uid())
  and user_id = auth.uid()
);

create policy credit_cards_update_family
on public.credit_cards
for update
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
)
with check (
  public.is_family_member(family_id, auth.uid())
);

create policy credit_cards_delete_family
on public.credit_cards
for delete
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
);

-- Update table comment
comment on table public.credit_cards is
'Aile kredi kartları. RLS: aile üyeleri okuyabilir/değiştirebilir (family-shared access).';

-- ---------------------------------------------------------------------------
-- DOCUMENTATION
-- ---------------------------------------------------------------------------

comment on function public.update_income_with_mileage(uuid,uuid,numeric,date,numeric,text) is
'Safe income editing with automatic mileage chain recalculation. Validates family membership, vehicle ownership, and mileage chain integrity.';
