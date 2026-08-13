-- ============================================================================
-- 0018_credit_card_payment_history.sql
-- Credit card payment history system with status tracking
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ADD PAYMENT STATUS FIELDS TO CREDIT_CARDS
-- ---------------------------------------------------------------------------

alter table public.credit_cards
  add column if not exists minimum_payment numeric(10,2) check (minimum_payment >= 0),
  add column if not exists statement_balance numeric(10,2) check (statement_balance >= 0),
  add column if not exists next_payment_date date,
  add column if not exists payment_status text check (payment_status in ('PAID', 'DUE_SOON', 'URGENT', 'OVERDUE')),
  add column if not exists is_active boolean default true;

-- ---------------------------------------------------------------------------
-- 2. CREATE CREDIT_CARD_PAYMENTS TABLE
-- ---------------------------------------------------------------------------

create table public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id)
    on delete cascade,
  credit_card_id uuid not null
    references public.credit_cards(id)
    on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  payment_date date not null,
  created_by uuid
    references auth.users(id)
    on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index idx_credit_card_payments_card on public.credit_card_payments(credit_card_id);
create index idx_credit_card_payments_family on public.credit_card_payments(family_id);
create index idx_credit_card_payments_date on public.credit_card_payments(payment_date desc);

-- ---------------------------------------------------------------------------
-- 3. PAYMENT STATUS CLASSIFICATION FUNCTION
-- ---------------------------------------------------------------------------

create or replace function public.classify_credit_card_payment_status(
  p_due_date date,
  p_current_balance numeric,
  p_statement_balance numeric,
  p_minimum_payment numeric default null
)
returns text
language plpgsql
stable
as $$
declare
  v_days_until integer;
  v_required_payment numeric;
begin
  if p_due_date is null then
    return 'PAID';
  end if;

  v_days_until := p_due_date - current_date;

  -- Calculate required payment (statement balance or minimum payment)
  v_required_payment := coalesce(p_statement_balance, 0);
  if v_required_payment = 0 then
    v_required_payment := coalesce(p_minimum_payment, 0);
  end if;

  -- If balance is paid, status is PAID
  if p_current_balance <= 0 or (v_required_payment > 0 and p_current_balance < v_required_payment) then
    return 'PAID';
  end if;

  -- Classify based on days until due
  if v_days_until < 0 then
    return 'OVERDUE';
  elsif v_days_until <= 3 then
    return 'URGENT';
  elsif v_days_until <= 7 then
    return 'DUE_SOON';
  else
    return 'PAID';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RECORD CREDIT CARD PAYMENT RPC
-- ---------------------------------------------------------------------------

create or replace function public.record_credit_card_payment(
  p_credit_card_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_current_balance numeric;
  v_minimum_payment numeric;
  v_statement_balance numeric;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Get card info and lock it
  select family_id, current_balance, minimum_payment, statement_balance
    into v_family_id, v_current_balance, v_minimum_payment, v_statement_balance
  from public.credit_cards
  where id = p_credit_card_id
  for update;

  if not found then
    raise exception 'CREDIT_CARD_NOT_FOUND';
  end if;

  -- Verify family membership
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Create payment record
  insert into public.credit_card_payments (
    family_id,
    credit_card_id,
    amount,
    payment_date,
    created_by,
    note
  )
  values (
    v_family_id,
    p_credit_card_id,
    p_amount,
    p_payment_date,
    v_user_id,
    p_note
  )
  returning id into v_payment_id;

  -- Update card balance
  update public.credit_cards
  set
    current_balance = greatest(0, current_balance - p_amount),
    updated_at = now()
  where id = p_credit_card_id;

  -- Recalculate payment status
  update public.credit_cards
  set payment_status = public.classify_credit_card_payment_status(
    due_date,
    current_balance - p_amount,
    statement_balance,
    minimum_payment
  )
  where id = p_credit_card_id;

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. UPDATE PAYMENT STATUS TRIGGER
-- Automatically update payment status when card details change
-- ---------------------------------------------------------------------------

create or replace function public.update_credit_card_payment_status()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    new.payment_status := public.classify_credit_card_payment_status(
      new.due_date,
      new.current_balance,
      new.statement_balance,
      new.minimum_payment
    );
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_update_credit_card_payment_status on public.credit_cards;

create trigger trg_update_credit_card_payment_status
  before insert or update on public.credit_cards
  for each row
  execute function public.update_credit_card_payment_status();

-- ---------------------------------------------------------------------------
-- 6. RLS POLICIES FOR CREDIT_CARD_PAYMENTS
-- ---------------------------------------------------------------------------

alter table public.credit_card_payments enable row level security;

create policy credit_card_payments_select_family
on public.credit_card_payments
for select
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
);

create policy credit_card_payments_insert_family
on public.credit_card_payments
for insert
to authenticated
with check (
  public.is_family_member(family_id, auth.uid())
  and created_by = auth.uid()
);

-- No update/delete for payments (immutable history)

-- ---------------------------------------------------------------------------
-- 7. UPDATE CREDIT CARD RLS FOR NEW FIELDS
-- ---------------------------------------------------------------------------

drop policy if exists credit_cards_update_family on public.credit_cards;

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

-- ---------------------------------------------------------------------------
-- 8. GRANT PERMISSIONS
-- ---------------------------------------------------------------------------

grant select on public.credit_card_payments to authenticated;
grant insert on public.credit_card_payments to authenticated;

grant execute on function public.record_credit_card_payment(uuid,numeric,date,text)
to authenticated;

revoke execute on function public.record_credit_card_payment(uuid,numeric,date,text)
from public;

revoke execute on function public.classify_credit_card_payment_status(date,numeric,numeric,numeric)
from public;

-- ---------------------------------------------------------------------------
-- 9. DOCUMENTATION
-- ---------------------------------------------------------------------------

comment on table public.credit_card_payments is
'Kredi kartı ödeme geçmişi. Ödemeler değiştirilemez/silinemez (immutable history).';

comment on function public.classify_credit_card_payment_status(date,numeric,numeric,numeric) is
'Kredi kartı ödeme durumunu sınıflandırır: PAID, DUE_SOON, URGENT, OVERDUE.';

comment on function public.record_credit_card_payment(uuid,numeric,date,text) is
'Kredi kartı ödemesi kaydeder, bakiyeyi günceller ve ödeme durumunu yeniden hesaplar.';
