-- 0014_restore_financial_contract.sql
-- Fixes the production mismatch introduced by 0009 and enables the current UI.

-- 1) Restore the mileage_log_id field expected by the atomic income RPC.
-- It is intentionally nullable for legacy income rows. The RPC always supplies it.
alter table public.income
  add column if not exists mileage_log_id uuid;

create unique index if not exists uq_income_mileage_log
  on public.income(mileage_log_id)
  where mileage_log_id is not null;

-- 2) Rebuild the atomic income + mileage function after 0009 removed the column.
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
as $$
declare
  v_user_id uuid := auth.uid();
  v_prev_mileage numeric;
  v_miles_driven numeric;
  v_mileage_id uuid;
  v_income_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_family_member(p_family_id, v_user_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;

  select ml.closing_mileage into v_prev_mileage
  from public.mileage_log ml
  where ml.vehicle_id = p_vehicle_id and ml.family_id = p_family_id
  order by ml.record_date desc, ml.created_at desc
  limit 1;

  if v_prev_mileage is null then
    v_miles_driven := 0;
  elsif p_closing_mileage < v_prev_mileage then
    raise exception 'MILEAGE_LOWER_THAN_PREVIOUS: new closing mileage (%) is lower than previous (%)', p_closing_mileage, v_prev_mileage;
  else
    v_miles_driven := p_closing_mileage - v_prev_mileage;
  end if;

  insert into public.mileage_log (family_id, vehicle_id, user_id, record_date, closing_mileage, miles_driven)
  values (p_family_id, p_vehicle_id, v_user_id, p_record_date, p_closing_mileage, v_miles_driven)
  returning id into v_mileage_id;

  insert into public.income (family_id, vehicle_id, user_id, amount, record_date, note, mileage_log_id)
  values (p_family_id, p_vehicle_id, v_user_id, p_amount, p_record_date, p_note, v_mileage_id)
  returning id into v_income_id;

  update public.mileage_log set income_id = v_income_id where id = v_mileage_id;
  return query select v_income_id, v_mileage_id, v_miles_driven;
end;
$$;

grant execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text) to authenticated;

-- 3) The new product intentionally does not require a note for "DiÄŸer".
alter table public.expenses drop constraint if exists diger_requires_note;

-- 4) Fixed expenses are family-managed from the app.
drop policy if exists fixed_expenses_insert_owner on public.fixed_expenses;
drop policy if exists fixed_expenses_update_family on public.fixed_expenses;
drop policy if exists fixed_expenses_delete_family on public.fixed_expenses;

create policy fixed_expenses_insert_family
  on public.fixed_expenses for insert to authenticated
  with check (public.is_family_member(family_id, auth.uid()) and created_by = auth.uid());

create policy fixed_expenses_update_family
  on public.fixed_expenses for update to authenticated
  using (public.is_family_member(family_id, auth.uid()))
  with check (public.is_family_member(family_id, auth.uid()));

create policy fixed_expenses_delete_family
  on public.fixed_expenses for delete to authenticated
  using (public.is_family_member(family_id, auth.uid()));

-- 5) Credit-card balances/due dates are family-visible so the shared net position
-- and upcoming payments can be seen on all five phones.
drop policy if exists credit_cards_select_own on public.credit_cards;
drop policy if exists credit_cards_insert_own on public.credit_cards;
drop policy if exists credit_cards_update_own on public.credit_cards;
drop policy if exists credit_cards_delete_own on public.credit_cards;

create policy credit_cards_select_family
  on public.credit_cards for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy credit_cards_insert_family
  on public.credit_cards for insert to authenticated
  with check (public.is_family_member(family_id, auth.uid()) and user_id = auth.uid());

create policy credit_cards_update_family
  on public.credit_cards for update to authenticated
  using (public.is_family_member(family_id, auth.uid()))
  with check (public.is_family_member(family_id, auth.uid()));

create policy credit_cards_delete_family
  on public.credit_cards for delete to authenticated
  using (public.is_family_member(family_id, auth.uid()));

-- Realtime for shared card alerts.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_rel pr
      join pg_class c on c.oid=pr.prrelid
      join pg_namespace n on n.oid=c.relnamespace
      where pr.prpubid=(select oid from pg_publication where pubname='supabase_realtime')
        and n.nspname='public' and c.relname='credit_cards'
    ) then
      alter publication supabase_realtime add table public.credit_cards;
    end if;
  end if;
end $$;

-- 0015 additions: financial summary + five-phone realtime hardening.
create or replace function public.recalculate_family_financial_summary(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_total_income numeric := 0; v_total_expenses numeric := 0; v_total_card_debt numeric := 0;
begin
 select coalesce(sum(amount),0) into v_total_income from public.income where family_id=p_family_id;
 select coalesce(sum(amount),0) into v_total_expenses from public.expenses where family_id=p_family_id;
 select coalesce(sum(current_balance),0) into v_total_card_debt from public.credit_cards where family_id=p_family_id;
 insert into public.family_financial_summaries(family_id,total_income,total_expenses,total_card_debt,net_balance,updated_at)
 values(p_family_id,v_total_income,v_total_expenses,v_total_card_debt,v_total_income-v_total_expenses-v_total_card_debt,now())
 on conflict(family_id) do update set total_income=excluded.total_income,total_expenses=excluded.total_expenses,total_card_debt=excluded.total_card_debt,net_balance=excluded.net_balance,updated_at=now();
end; $$;
grant execute on function public.recalculate_family_financial_summary(uuid) to authenticated;
do $$ declare r record; begin for r in select id from public.families loop perform public.recalculate_family_financial_summary(r.id); end loop; end $$;

alter table public.income replica identity full;
alter table public.expenses replica identity full;
alter table public.credit_cards replica identity full;
alter table public.fixed_expenses replica identity full;



