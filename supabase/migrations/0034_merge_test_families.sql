-- Merge the two field-test accounts into the canonical family and remove only
-- their confirmed test financial history. The canonical vehicle set and goal
-- configuration are intentionally preserved.

do $$
declare
  v_canonical_family constant uuid := '00000000-0000-0000-0000-000000000001';
  v_personal_family constant uuid := '1972a3ea-c0b9-4991-981c-b81bb78af535';
  v_arif constant uuid := 'aeb3b1c7-66ef-4663-adeb-e5925e234426';
  v_kamuran constant uuid := 'f7f575e9-eda7-4033-a36e-3a0e49c25dba';
begin
  if not exists (
    select 1 from auth.users
    where id = v_arif and lower(email) = 'arifbarbin@hotmail.com'
  ) then
    raise exception 'EXPECTED_ARIF_AUTH_USER_NOT_FOUND';
  end if;

  if not exists (
    select 1 from auth.users
    where id = v_kamuran and lower(email) = 'barbinkamuran@gmail.com'
  ) then
    raise exception 'EXPECTED_KAMURAN_AUTH_USER_NOT_FOUND';
  end if;

  if not exists (select 1 from public.families where id = v_canonical_family) then
    raise exception 'CANONICAL_FAMILY_NOT_FOUND';
  end if;

  if not exists (select 1 from public.families where id = v_personal_family) then
    raise exception 'PERSONAL_TEST_FAMILY_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.family_members
    where family_id = v_personal_family
      and user_id <> v_kamuran
  ) then
    raise exception 'PERSONAL_FAMILY_HAS_UNEXPECTED_MEMBER';
  end if;

  if (select count(*) from public.vehicles where family_id = v_canonical_family) <> 3 then
    raise exception 'CANONICAL_VEHICLE_SET_IS_NOT_THREE';
  end if;

  insert into public.profiles (user_id, display_name, email)
  values (v_arif, 'Arif', 'arifbarbin@hotmail.com')
  on conflict (user_id) do nothing;

  insert into public.family_members (family_id, user_id, role)
  values (v_canonical_family, v_kamuran, 'member')
  on conflict (family_id, user_id) do nothing;

  -- Remove confirmed test-only financial/runtime records from both families
  -- while both parent family rows still exist. This explicit order prevents
  -- financial-summary triggers from trying to recreate a summary after its
  -- parent family has entered a cascading delete.
  delete from public.credit_card_payments
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.credit_cards
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.expenses
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.income
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.mileage_log
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.fixed_expenses
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.work_sessions
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.monthly_financial_summaries
  where family_id in (v_canonical_family, v_personal_family);
  delete from public.family_financial_summaries
  where family_id in (v_canonical_family, v_personal_family);

  -- The personal family contains only confirmed test data and one expected
  -- member. Cascading FKs remove its duplicate vehicles and dependent rows.
  delete from public.families where id = v_personal_family;
end;
$$;
