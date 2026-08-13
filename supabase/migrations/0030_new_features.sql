-- ============================================================================
-- 0030_new_features.sql
-- M35: credit card due reminders (manual/scheduled)
-- M36: category-based budgets
-- M37: recurring transaction templates
-- M38: weekly family summary
-- ============================================================================

-- ---------------------------------------------------------------------------
-- M35: Generate credit card due notifications for all families
-- Run daily (via pg_cron or manually) to create 3-day and 1-day reminders.
-- ---------------------------------------------------------------------------
create or replace function public.generate_credit_card_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  v_days integer;
  v_count integer := 0;
begin
  for rec in
    select cc.id as card_id, cc.family_id, cc.due_date, cc.card_name
    from public.credit_cards cc
    where cc.due_date is not null
      and cc.is_active = true
  loop
    v_days := (rec.due_date - current_date);
    if v_days in (3, 1) then
      perform public.create_family_notification(
        'CREDIT_CARD',
        case when v_days = 1 then 'Kredi kartı ödemesi yarın' else 'Kredi kartı ödemesi yaklaşıyor' end,
        rec.card_name || ' kredi kartı ödemesine ' || v_days || ' gün var.',
        rec.card_id,
        'credit_card'
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.generate_credit_card_due_notifications()
  to authenticated;
revoke execute on function public.generate_credit_card_due_notifications()
  from public;

-- Optional: schedule daily at 09:00 if pg_cron is enabled
-- do $$
-- begin
--   perform cron.schedule('credit-card-due-notifications', '0 9 * * *', 'select public.generate_credit_card_due_notifications();');
-- end
-- $$;

-- ---------------------------------------------------------------------------
-- M36: Budgets table (category-based monthly limit)
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category text not null,
  monthly_limit numeric not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, category)
);

alter table public.budgets enable row level security;

drop policy if exists budgets_select_family on public.budgets;
create policy budgets_select_family
  on public.budgets for select
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists budgets_insert_family on public.budgets;
create policy budgets_insert_family
  on public.budgets for insert
  to authenticated
  with check (public.is_family_member(family_id, auth.uid()));

drop policy if exists budgets_update_family on public.budgets;
create policy budgets_update_family
  on public.budgets for update
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists budgets_delete_family on public.budgets;
create policy budgets_delete_family
  on public.budgets for delete
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

grant select, insert, update, delete on public.budgets to authenticated;

-- ---------------------------------------------------------------------------
-- M37: Recurring transaction templates
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text,
  label text not null,
  amount numeric not null default 0,
  day_of_month integer not null check (day_of_month between 1 and 31),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.recurring_templates enable row level security;

drop policy if exists recurring_select_family on public.recurring_templates;
create policy recurring_select_family
  on public.recurring_templates for select
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists recurring_insert_family on public.recurring_templates;
create policy recurring_insert_family
  on public.recurring_templates for insert
  to authenticated
  with check (public.is_family_member(family_id, auth.uid()));

drop policy if exists recurring_update_family on public.recurring_templates;
create policy recurring_update_family
  on public.recurring_templates for update
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists recurring_delete_family on public.recurring_templates;
create policy recurring_delete_family
  on public.recurring_templates for delete
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

grant select, insert, update, delete on public.recurring_templates to authenticated;

-- Helper to create records from active templates for a given month
create or replace function public.generate_recurring_transactions(p_month date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  v_record_date text;
  v_count integer := 0;
begin
  for rec in
    select rt.*
    from public.recurring_templates rt
    where rt.is_active = true
  loop
    v_record_date := to_char(make_date(extract(year from p_month)::int, extract(month from p_month)::int, least(rt.day_of_month, extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::int)), 'YYYY-MM-DD');
    if rt.type = 'expense' then
      insert into public.expenses (family_id, user_id, category, vehicle_id, amount, record_date, note)
      values (rec.family_id, auth.uid(), rec.category, rec.vehicle_id, rec.amount, v_record_date, rec.label)
      on conflict do nothing;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.generate_recurring_transactions(date)
  to authenticated;
revoke execute on function public.generate_recurring_transactions(date)
  from public;

-- ---------------------------------------------------------------------------
-- M38: Weekly family summary notification
-- ---------------------------------------------------------------------------
create or replace function public.generate_weekly_summary()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  v_week_start date := current_date - (extract(dow from current_date)::int);
  v_income numeric;
  v_expenses numeric;
  v_goal numeric;
  v_achieved numeric;
  v_percent numeric;
  v_title text;
  v_body text;
  v_count integer := 0;
begin
  for rec in
    select distinct fm.family_id
    from public.family_members fm
  loop
    select coalesce(sum(amount), 0)
      into v_income
    from public.income
    where family_id = rec.family_id
      and record_date >= v_week_start
      and record_date < v_week_start + interval '7 days';

    select coalesce(sum(amount), 0)
      into v_expenses
    from public.expenses
    where family_id = rec.family_id
      and record_date >= v_week_start
      and record_date < v_week_start + interval '7 days';

    select coalesce(sum(weekly_goal), 0), coalesce(sum(week_income), 0)
      into v_goal, v_achieved
    from public.family_weekly_goals
    where family_id = rec.family_id;

    v_percent := case when v_goal > 0 then round((v_achieved / v_goal) * 100) else 0 end;

    v_title := 'Haftalık aile özeti';
    v_body := 'Bu hafta $' || v_income::text || ' kazandınız. Hedefin %' || v_percent::text || ' ini tamamladınız. Geçen haftaya göre değişimi görmek için raporlara bakın.';

    perform public.create_family_notification(
      'FINANCIAL',
      v_title,
      v_body,
      rec.family_id,
      'weekly_summary'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.generate_weekly_summary()
  to authenticated;
revoke execute on function public.generate_weekly_summary()
  from public;
