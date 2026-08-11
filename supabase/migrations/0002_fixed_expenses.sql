-- ============================================================================
-- 0002_fixed_expenses.sql
-- Fixed expenses, versioned by effective_from / effective_to (Bölüm 7)
-- ============================================================================

create table fixed_expenses (
  id              uuid primary key default uuid_generate_v4(),
  family_id       uuid not null references families(id) on delete cascade,
  label           text not null,          -- e.g. 'Ev Kirası'
  monthly_amount  numeric(10,2) not null check (monthly_amount >= 0),
  effective_from  date not null,
  effective_to    date,                    -- NULL = currently active
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),

  constraint valid_range check (effective_to is null or effective_to >= effective_from)
);

create index idx_fixed_expenses_family_range
  on fixed_expenses(family_id, effective_from, effective_to);

-- Prevent two *active* (effective_to IS NULL) rows for the same label
-- within the same family — closing the old version is required before
-- opening a new one, which is exactly how the versioning trigger below
-- enforces "geçmiş hesaplamalar değişmemeli".
create or replace function public.close_previous_fixed_expense_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update fixed_expenses
  set effective_to = new.effective_from - interval '1 day'
  where family_id = new.family_id
    and label = new.label
    and effective_to is null
    and id <> new.id;
  return new;
end;
$$;

create trigger trg_close_previous_fixed_expense_version
  after insert on fixed_expenses
  for each row execute function public.close_previous_fixed_expense_version();

-- Helper: total monthly fixed expense for a family, as of a given date
-- (defaults to CURRENT_DATE). Used by the financial engine RPC below.
create or replace function public.family_fixed_expense_total(
  p_family_id uuid,
  p_as_of date default current_date
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(monthly_amount), 0)
  from fixed_expenses
  where family_id = p_family_id
    and effective_from <= p_as_of
    and (effective_to is null or effective_to >= p_as_of);
$$;
