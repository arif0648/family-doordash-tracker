-- Cross-device consistency and credit-card purchase accounting.
-- This migration is forward-only and does not delete or rewrite financial data.

-- A user can have more than one membership because signup provisioning creates
-- a personal family before the user is invited to the shared family. Resolve
-- the family with the largest membership, then use stable tie-breakers.
create or replace function public.resolve_current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = auth.uid()
  order by
    (select count(*) from public.family_members peers where peers.family_id = fm.family_id) desc,
    fm.joined_at asc,
    fm.family_id asc
  limit 1;
$$;

grant execute on function public.resolve_current_family_id() to authenticated;
revoke execute on function public.resolve_current_family_id() from public;

comment on function public.resolve_current_family_id() is
'Deterministically resolves the authenticated user to their largest shared family.';

alter table public.expenses
  add column if not exists payment_method text not null default 'cash_bank',
  add column if not exists credit_card_id uuid references public.credit_cards(id) on delete restrict;

alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check
  check (payment_method in ('cash_bank', 'credit_card'));

alter table public.expenses drop constraint if exists expenses_credit_card_payment_rule;
alter table public.expenses add constraint expenses_credit_card_payment_rule check (
  (payment_method = 'cash_bank' and credit_card_id is null)
  or
  (payment_method = 'credit_card' and credit_card_id is not null)
);

create index if not exists idx_expenses_credit_card
  on public.expenses(credit_card_id)
  where credit_card_id is not null;

create or replace function public.create_expense_with_payment(
  p_family_id uuid,
  p_category text,
  p_vehicle_id uuid,
  p_amount numeric,
  p_record_date date,
  p_note text default null,
  p_payment_method text default 'cash_bank',
  p_credit_card_id uuid default null
)
returns table (expense_id uuid, card_balance numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_card_balance numeric := null;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_family_member(p_family_id, v_user_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_record_date is null then raise exception 'INVALID_RECORD_DATE'; end if;
  if p_payment_method not in ('cash_bank', 'credit_card') then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles v where v.id = p_vehicle_id and v.family_id = p_family_id
  ) then
    raise exception 'VEHICLE_FAMILY_MISMATCH';
  end if;

  if p_payment_method = 'credit_card' then
    if p_credit_card_id is null then raise exception 'CREDIT_CARD_REQUIRED'; end if;

    perform 1
    from public.credit_cards cc
    where cc.id = p_credit_card_id and cc.family_id = p_family_id and cc.is_active
    for update;
    if not found then raise exception 'CREDIT_CARD_NOT_FOUND'; end if;
  elsif p_credit_card_id is not null then
    raise exception 'CREDIT_CARD_NOT_ALLOWED';
  end if;

  insert into public.expenses (
    family_id, category, vehicle_id, user_id, amount, record_date, note,
    payment_method, credit_card_id
  ) values (
    p_family_id, p_category, p_vehicle_id, v_user_id, p_amount, p_record_date, p_note,
    p_payment_method, p_credit_card_id
  ) returning id into v_expense_id;

  if p_payment_method = 'credit_card' then
    update public.credit_cards
    set current_balance = current_balance + p_amount,
        updated_at = now()
    where id = p_credit_card_id
    returning current_balance into v_card_balance;
  end if;

  return query select v_expense_id, v_card_balance;
end;
$$;

grant execute on function public.create_expense_with_payment(uuid,text,uuid,numeric,date,text,text,uuid)
to authenticated;
revoke execute on function public.create_expense_with_payment(uuid,text,uuid,numeric,date,text,text,uuid)
from public;

comment on function public.create_expense_with_payment(uuid,text,uuid,numeric,date,text,text,uuid) is
'Atomically records one expense and, for card purchases, increases only the selected card liability.';

-- Filtered DELETE events need family_id in the old row. FULL replica identity
-- also makes update/delete reconciliation deterministic across devices.
do $$
declare t text;
begin
  foreach t in array array[
    'income','expenses','mileage_log','fixed_expenses','vehicles','credit_cards',
    'credit_card_payments','appointments','notifications','monthly_financial_summaries',
    'work_sessions','family_member_goals'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
