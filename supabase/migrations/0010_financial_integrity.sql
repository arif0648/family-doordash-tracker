-- 0010_financial_integrity.sql
-- Financial integrity based only on existing schema.

create table if not exists public.family_financial_summaries (
  family_id uuid primary key
    references public.families(id)
    on delete cascade,

  total_income numeric(14,2) not null default 0,
  total_expenses numeric(14,2) not null default 0,
  total_card_debt numeric(14,2) not null default 0,
  net_balance numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_financial_summaries_updated
on public.family_financial_summaries(updated_at);

create or replace function public.recalculate_family_financial_summary(
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_income numeric(14,2);
  v_total_expenses numeric(14,2);
  v_total_card_debt numeric(14,2);
begin
  if p_family_id is null then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into v_total_income
  from public.income
  where family_id = p_family_id;

  select coalesce(sum(amount), 0)
    into v_total_expenses
  from public.expenses
  where family_id = p_family_id;

  select coalesce(sum(current_balance), 0)
    into v_total_card_debt
  from public.credit_cards
  where family_id = p_family_id;

  insert into public.family_financial_summaries (
    family_id,
    total_income,
    total_expenses,
    total_card_debt,
    net_balance,
    updated_at
  )
  values (
    p_family_id,
    v_total_income,
    v_total_expenses,
    v_total_card_debt,
    v_total_income - v_total_expenses,
    now()
  )
  on conflict (family_id)
  do update set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    total_card_debt = excluded.total_card_debt,
    net_balance = excluded.net_balance,
    updated_at = now();
end;
$$;

create or replace function public.trigger_recalculate_family_financial_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_family_financial_summary(old.family_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.family_id is distinct from new.family_id then
      perform public.recalculate_family_financial_summary(old.family_id);
    end if;

    perform public.recalculate_family_financial_summary(new.family_id);
    return new;
  end if;

  perform public.recalculate_family_financial_summary(new.family_id);
  return new;
end;
$$;

drop trigger if exists trigger_recalculate_family_summary_income
on public.income;

drop trigger if exists trigger_recalculate_family_summary_expenses
on public.expenses;

drop trigger if exists trigger_recalculate_family_summary_credit_cards
on public.credit_cards;

create trigger trigger_recalculate_family_summary_income
after insert or update or delete
on public.income
for each row
execute function public.trigger_recalculate_family_financial_summary();

create trigger trigger_recalculate_family_summary_expenses
after insert or update or delete
on public.expenses
for each row
execute function public.trigger_recalculate_family_financial_summary();

create trigger trigger_recalculate_family_summary_credit_cards
after insert or update or delete
on public.credit_cards
for each row
execute function public.trigger_recalculate_family_financial_summary();

alter table public.family_financial_summaries
enable row level security;

drop policy if exists family_members_can_view_financial_summary
on public.family_financial_summaries;

create policy family_members_can_view_financial_summary
on public.family_financial_summaries
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_financial_summaries.family_id
      and fm.user_id = auth.uid()
  )
);

revoke all on public.family_financial_summaries from anon;

grant select on public.family_financial_summaries to authenticated;

revoke insert, update, delete
on public.family_financial_summaries
from authenticated;

revoke execute
on function public.recalculate_family_financial_summary(uuid)
from public;

revoke execute
on function public.trigger_recalculate_family_financial_summary()
from public;

-- Backfill summaries for existing families.
do $$
declare
  r record;
begin
  for r in select id from public.families loop
    perform public.recalculate_family_financial_summary(r.id);
  end loop;
end;
$$;
