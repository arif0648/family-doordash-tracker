-- ============================================================================
-- 0014_family_dashboard_upgrades.sql
-- Shared debts, fixed-expense management, and realtime for the 5-phone family.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CREDIT CARDS: family members can SEE balances/due dates.
--    Card ownership/edit/delete remains private to the card owner.
-- ---------------------------------------------------------------------------
alter table public.credit_cards enable row level security;

drop policy if exists credit_cards_select_own on public.credit_cards;
drop policy if exists credit_cards_select_family on public.credit_cards;

create policy credit_cards_select_family
on public.credit_cards
for select
to authenticated
using (public.is_family_member(family_id, auth.uid()));

-- Realtime is required so a card balance/due date added on one phone appears
-- immediately on the other family phones.
do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'credit_cards'
  ) then
    alter publication supabase_realtime add table public.credit_cards;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. FIXED EXPENSES: one safe RPC for add/edit/increase/decrease/remove.
--    Same-day edits update today's version instead of creating overlapping
--    versions. Older dates remain immutable.
-- ---------------------------------------------------------------------------
create or replace function public.set_family_fixed_expense(
  p_family_id uuid,
  p_label text,
  p_monthly_amount numeric,
  p_effective_from date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_date date;
  v_result_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(p_family_id, v_user_id) then
    raise exception 'NOT_FAMILY_MEMBER';
  end if;

  if p_label is null or length(trim(p_label)) = 0 then
    raise exception 'FIXED_EXPENSE_LABEL_REQUIRED';
  end if;

  if p_monthly_amount is null or p_monthly_amount < 0 then
    raise exception 'FIXED_EXPENSE_AMOUNT_INVALID';
  end if;

  if p_effective_from is null then
    raise exception 'FIXED_EXPENSE_DATE_REQUIRED';
  end if;

  select id, effective_from
    into v_existing_id, v_existing_date
  from public.fixed_expenses
  where family_id = p_family_id
    and label = trim(p_label)
    and effective_from <= p_effective_from
    and (effective_to is null or effective_to >= p_effective_from)
  order by effective_from desc, created_at desc
  limit 1
  for update;

  if v_existing_id is not null and v_existing_date = p_effective_from then
    update public.fixed_expenses
    set monthly_amount = p_monthly_amount
    where id = v_existing_id
    returning id into v_result_id;
  else
    insert into public.fixed_expenses (
      family_id, label, monthly_amount, effective_from, created_by
    )
    values (
      p_family_id, trim(p_label), p_monthly_amount, p_effective_from, v_user_id
    )
    returning id into v_result_id;
  end if;

  return v_result_id;
end;
$$;

revoke execute on function public.set_family_fixed_expense(uuid, text, numeric, date) from public;
grant execute on function public.set_family_fixed_expense(uuid, text, numeric, date) to authenticated;

comment on function public.set_family_fixed_expense(uuid, text, numeric, date) is
'Family fixed-expense add/edit/delete operation. Amount 0 means removed. Past versions remain immutable.';

-- ---------------------------------------------------------------------------
-- 3. Documentation: family debt visibility is intentional.
-- ---------------------------------------------------------------------------
comment on table public.credit_cards is
'Credit-card balances and due dates are visible to family members for the shared financial dashboard. Card write/delete remains owner-only.';



