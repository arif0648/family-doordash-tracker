-- ============================================================================
-- 0022_monthly_financial_summaries.sql
-- Monthly financial summaries for trend analysis and comparison
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CREATE MONTHLY_FINANCIAL_SUMMARIES TABLE
-- ---------------------------------------------------------------------------

create table public.monthly_financial_summaries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id)
    on delete cascade,
  year integer not null check (year >= 2020 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  total_income numeric(14,2) not null default 0,
  total_expenses numeric(14,2) not null default 0,
  total_card_debt numeric(14,2) not null default 0,
  card_payments numeric(14,2) not null default 0,
  total_miles numeric(14,1) not null default 0,
  net_balance numeric(14,2) not null default 0,
  income_per_mile numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_summaries_unique
    unique (family_id, year, month)
);

create index idx_monthly_summaries_family on public.monthly_financial_summaries(family_id);
create index idx_monthly_summaries_date on public.monthly_financial_summaries(year, month desc);

-- Updated_at trigger
create trigger trg_monthly_summaries_touch
  before update on public.monthly_financial_summaries
  for each row
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. CALCULATE MONTHLY SUMMARY FUNCTION
-- ---------------------------------------------------------------------------

create or replace function public.calculate_monthly_summary(
  p_family_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_start date;
  v_period_end date;
  v_total_income numeric(14,2);
  v_total_expenses numeric(14,2);
  v_total_card_debt numeric(14,2);
  v_card_payments numeric(14,2);
  v_total_miles numeric(14,1);
  v_net_balance numeric(14,2);
  v_income_per_mile numeric(14,2);
begin
  -- Calculate period boundaries
  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (make_date(p_year, p_month + 1, 1) - interval '1 day')::date;

  -- Calculate total income for the month
  select coalesce(sum(amount), 0)
    into v_total_income
  from public.income
  where family_id = p_family_id
    and record_date >= v_period_start
    and record_date <= v_period_end;

  -- Calculate total expenses for the month
  select coalesce(sum(amount), 0)
    into v_total_expenses
  from public.expenses
  where family_id = p_family_id
    and record_date >= v_period_start
    and record_date <= v_period_end;

  -- Calculate total card debt at end of month
  select coalesce(sum(current_balance), 0)
    into v_total_card_debt
  from public.credit_cards
  where family_id = p_family_id;

  -- Calculate card payments for the month
  select coalesce(sum(amount), 0)
    into v_card_payments
  from public.credit_card_payments
  where family_id = p_family_id
    and payment_date >= v_period_start
    and payment_date <= v_period_end;

  -- Calculate total miles for the month
  select coalesce(sum(miles_driven), 0)
    into v_total_miles
  from public.mileage_log ml
  join public.income i on ml.income_id = i.id
  where i.family_id = p_family_id
    and ml.record_date >= v_period_start
    and ml.record_date <= v_period_end;

  -- Calculate net balance
  v_net_balance := v_total_income - v_total_expenses;

  -- Calculate income per mile
  if v_total_miles > 0 then
    v_income_per_mile := v_total_income / v_total_miles;
  else
    v_income_per_mile := 0;
  end if;

  -- Insert or update monthly summary
  insert into public.monthly_financial_summaries (
    family_id,
    year,
    month,
    total_income,
    total_expenses,
    total_card_debt,
    card_payments,
    total_miles,
    net_balance,
    income_per_mile
  )
  values (
    p_family_id,
    p_year,
    p_month,
    v_total_income,
    v_total_expenses,
    v_total_card_debt,
    v_card_payments,
    v_total_miles,
    v_net_balance,
    v_income_per_mile
  )
  on conflict (family_id, year, month)
  do update set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    total_card_debt = excluded.total_card_debt,
    card_payments = excluded.card_payments,
    total_miles = excluded.total_miles,
    net_balance = excluded.net_balance,
    income_per_mile = excluded.income_per_mile,
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. AUTO-CALCULATE TRIGGER
-- Automatically calculate monthly summary when income/expenses change
-- ---------------------------------------------------------------------------

create or replace function public.trigger_calculate_monthly_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record_date date;
  v_year integer;
  v_month integer;
  v_family_id uuid;
begin
  if tg_op = 'DELETE' then
    v_record_date := old.record_date;
    v_family_id := old.family_id;
  else
    v_record_date := new.record_date;
    v_family_id := new.family_id;
  end if;

  if v_record_date is null then
    return new;
  end if;

  v_year := extract(year from v_record_date)::integer;
  v_month := extract(month from v_record_date)::integer;

  perform public.calculate_monthly_summary(v_family_id, v_year, v_month);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Create triggers on income and expenses
drop trigger if exists trigger_monthly_summary_income on public.income;
create trigger trigger_monthly_summary_income
after insert or update or delete
on public.income
for each row
execute function public.trigger_calculate_monthly_summary();

drop trigger if exists trigger_monthly_summary_expenses on public.expenses;
create trigger trigger_monthly_summary_expenses
after insert or update or delete
on public.expenses
for each row
execute function public.trigger_calculate_monthly_summary();

-- Also trigger on credit card payments
drop trigger if exists trigger_monthly_summary_card_payments on public.credit_card_payments;
create trigger trigger_monthly_summary_card_payments
after insert
on public.credit_card_payments
for each row
execute function public.trigger_calculate_monthly_summary();

-- ---------------------------------------------------------------------------
-- 4. GET FINANCIAL TREND FUNCTION
-- Returns comparison between current month and previous month
-- ---------------------------------------------------------------------------

create or replace function public.get_financial_trend(p_family_id uuid)
returns table (
  current_month_income numeric,
  current_month_expenses numeric,
  current_month_net numeric,
  current_month_card_debt numeric,
  previous_month_income numeric,
  previous_month_expenses numeric,
  previous_month_net numeric,
  previous_month_card_debt numeric,
  income_change numeric,
  expense_change numeric,
  net_change numeric,
  card_debt_change numeric,
  trend_status text -- 'IMPROVING', 'STABLE', 'DECLINING'
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_year integer;
  v_current_month integer;
  v_prev_year integer;
  v_prev_month integer;
  v_current_income numeric;
  v_current_expenses numeric;
  v_current_net numeric;
  v_current_card_debt numeric;
  v_prev_income numeric;
  v_prev_expenses numeric;
  v_prev_net numeric;
  v_prev_card_debt numeric;
  v_income_change numeric;
  v_expense_change numeric;
  v_net_change numeric;
  v_card_debt_change numeric;
  v_trend_status text;
begin
  -- Get current year/month
  v_current_year := extract(year from current_date)::integer;
  v_current_month := extract(month from current_date)::integer;

  -- Calculate previous month
  if v_current_month = 1 then
    v_prev_year := v_current_year - 1;
    v_prev_month := 12;
  else
    v_prev_year := v_current_year;
    v_prev_month := v_current_month - 1;
  end if;

  -- Get current month data
  select total_income, total_expenses, net_balance, total_card_debt
    into v_current_income, v_current_expenses, v_current_net, v_current_card_debt
  from public.monthly_financial_summaries
  where family_id = p_family_id
    and year = v_current_year
    and month = v_current_month;

  -- Get previous month data
  select total_income, total_expenses, net_balance, total_card_debt
    into v_prev_income, v_prev_expenses, v_prev_net, v_prev_card_debt
  from public.monthly_financial_summaries
  where family_id = p_family_id
    and year = v_prev_year
    and month = v_prev_month;

  -- Calculate changes
  v_income_change := coalesce(v_current_income, 0) - coalesce(v_prev_income, 0);
  v_expense_change := coalesce(v_current_expenses, 0) - coalesce(v_prev_expenses, 0);
  v_net_change := coalesce(v_current_net, 0) - coalesce(v_prev_net, 0);
  v_card_debt_change := coalesce(v_current_card_debt, 0) - coalesce(v_prev_card_debt, 0);

  -- Determine trend status
  -- Income ↑ and expenses ↓ = strong improvement
  -- Income ↑ and expenses ↑ but net ↑ = improvement
  -- Net approximately unchanged = stable
  -- Net ↓ = declining
  if abs(v_net_change) < 50 then -- Small threshold for "stable"
    v_trend_status := 'STABLE';
  elsif v_net_change > 0 then
    if v_income_change > 0 and v_expense_change < 0 then
      v_trend_status := 'IMPROVING';
    elsif v_income_change > 0 then
      v_trend_status := 'IMPROVING';
    else
      v_trend_status := 'STABLE';
    end if;
  else
    v_trend_status := 'DECLINING';
  end if;

  return query
  select
    coalesce(v_current_income, 0),
    coalesce(v_current_expenses, 0),
    coalesce(v_current_net, 0),
    coalesce(v_current_card_debt, 0),
    coalesce(v_prev_income, 0),
    coalesce(v_prev_expenses, 0),
    coalesce(v_prev_net, 0),
    coalesce(v_prev_card_debt, 0),
    v_income_change,
    v_expense_change,
    v_net_change,
    v_card_debt_change,
    v_trend_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS POLICIES FOR MONTHLY_SUMMARIES
-- ---------------------------------------------------------------------------

alter table public.monthly_financial_summaries enable row level security;

create policy monthly_summaries_select_family
on public.monthly_financial_summaries
for select
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
);

-- No insert/update/delete from client (managed by triggers)

-- ---------------------------------------------------------------------------
-- 6. BACKFILL EXISTING DATA
-- Calculate monthly summaries for existing data
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_start_date date;
  v_end_date date;
  v_year integer;
  v_month integer;
begin
  -- Find the earliest income/expense date
  select min(least(
    (select min(record_date) from public.income),
    (select min(record_date) from public.expenses)
  ))
  into v_start_date;

  if v_start_date is null then
    return; -- No data to backfill
  end if;

  v_end_date := current_date;

  -- Iterate through each month from start to end
  for r in
    select
      extract(year from generate_series)::integer as year,
      extract(month from generate_series)::integer as month
    from generate_series(v_start_date, v_end_date, interval '1 month')
  loop
    v_year := r.year;
    v_month := r.month;

    -- Calculate summary for each family that has data
    for r in
      select distinct family_id from public.income
        union
      select distinct family_id from public.expenses
    loop
      perform public.calculate_monthly_summary(r.family_id, v_year, v_month);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. GRANT PERMISSIONS
-- ---------------------------------------------------------------------------

grant select on public.monthly_financial_summaries to authenticated;

grant execute on function public.calculate_monthly_summary(uuid,integer,integer)
to authenticated;

grant execute on function public.get_financial_trend(uuid)
to authenticated;

revoke execute on function public.calculate_monthly_summary(uuid,integer,integer)
from public;

revoke execute on function public.get_financial_trend(uuid)
from public;

-- ---------------------------------------------------------------------------
-- 8. DOCUMENTATION
-- ---------------------------------------------------------------------------

comment on table public.monthly_financial_summaries is
'Aylık finansal özetler. Trend analizi ve aylık karşılaştırma için kullanılır. Otomatik hesaplanır (trigger).';

comment on function public.calculate_monthly_summary(uuid,integer,integer) is
'Belirtilen aylık finansal özeti hesaplar ve günceller.';

comment on function public.get_financial_trend(uuid) is
'Geçerli ay ve önceki ay arasındaki finansal trendi döndürür. Durum: IMPROVING, STABLE, DECLINING.';
