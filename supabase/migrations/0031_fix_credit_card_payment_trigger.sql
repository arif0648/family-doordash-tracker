-- Fix the live credit-card payment failure caused by the shared monthly-summary
-- trigger reading NEW.record_date from credit_card_payments (which has payment_date).

create or replace function public.trigger_calculate_monthly_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record_date date;
  v_family_id uuid;
begin
  if tg_table_name = 'credit_card_payments' then
    v_record_date := new.payment_date;
    v_family_id := new.family_id;
  elsif tg_op = 'DELETE' then
    v_record_date := old.record_date;
    v_family_id := old.family_id;
  else
    v_record_date := new.record_date;
    v_family_id := new.family_id;
  end if;

  if v_record_date is not null then
    perform public.calculate_monthly_summary(
      v_family_id,
      extract(year from v_record_date)::integer,
      extract(month from v_record_date)::integer
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  v_payment_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select family_id, current_balance
    into v_family_id, v_current_balance
  from public.credit_cards
  where id = p_credit_card_id
  for update;

  if not found then raise exception 'CREDIT_CARD_NOT_FOUND'; end if;
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- One balance update. The existing BEFORE trigger derives payment_status from
  -- the final NEW.current_balance, avoiding the previous double subtraction.
  -- This happens before the payment insert so its summary trigger observes the
  -- new debt balance; the whole RPC remains one atomic database transaction.
  update public.credit_cards
  set current_balance = greatest(0, v_current_balance - p_amount),
      updated_at = now()
  where id = p_credit_card_id;

  insert into public.credit_card_payments
    (family_id, credit_card_id, amount, payment_date, created_by, note)
  values
    (v_family_id, p_credit_card_id, p_amount, coalesce(p_payment_date, current_date), v_user_id, p_note)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

grant execute on function public.record_credit_card_payment(uuid,numeric,date,text) to authenticated;
revoke execute on function public.record_credit_card_payment(uuid,numeric,date,text) from public;
