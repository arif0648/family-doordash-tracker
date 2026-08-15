-- Hard-delete a card without deleting the expense it originally paid.

alter table public.expenses
  add column if not exists credit_card_name_snapshot text;

update public.expenses e
set credit_card_name_snapshot = cc.card_name
from public.credit_cards cc
where e.credit_card_id = cc.id
  and e.payment_method = 'credit_card'
  and e.credit_card_name_snapshot is null;

alter table public.expenses drop constraint if exists expenses_credit_card_payment_rule;
alter table public.expenses add constraint expenses_credit_card_payment_rule check (
  (payment_method = 'cash_bank' and credit_card_id is null)
  or (
    payment_method = 'credit_card'
    and (credit_card_id is not null or nullif(btrim(credit_card_name_snapshot), '') is not null)
  )
);

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
  v_card_name text := null;
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
    select cc.card_name into v_card_name
    from public.credit_cards cc
    where cc.id = p_credit_card_id and cc.family_id = p_family_id and cc.is_active
    for update;
    if not found then raise exception 'CREDIT_CARD_NOT_FOUND'; end if;
  elsif p_credit_card_id is not null then
    raise exception 'CREDIT_CARD_NOT_ALLOWED';
  end if;

  insert into public.expenses (
    family_id, category, vehicle_id, user_id, amount, record_date, note,
    payment_method, credit_card_id, credit_card_name_snapshot
  ) values (
    p_family_id, p_category, p_vehicle_id, v_user_id, p_amount, p_record_date, p_note,
    p_payment_method, p_credit_card_id, v_card_name
  ) returning id into v_expense_id;

  if p_payment_method = 'credit_card' then
    update public.credit_cards
    set current_balance = current_balance + p_amount, updated_at = now()
    where id = p_credit_card_id
    returning current_balance into v_card_balance;
  end if;

  return query select v_expense_id, v_card_balance;
end;
$$;

create or replace function public.delete_credit_card(p_card_id uuid)
returns table (deleted_card_id uuid, detached_purchase_count bigint, deleted_payment_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_card_name text;
  v_purchase_count bigint;
  v_payment_count bigint;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select cc.family_id, cc.card_name into v_family_id, v_card_name
  from public.credit_cards cc
  where cc.id = p_card_id
  for update;
  if not found then raise exception 'CREDIT_CARD_NOT_FOUND'; end if;
  if not public.is_family_member(v_family_id, v_user_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;

  select count(*) into v_payment_count
  from public.credit_card_payments p
  where p.credit_card_id = p_card_id;

  update public.expenses e
  set credit_card_name_snapshot = coalesce(e.credit_card_name_snapshot, v_card_name),
      credit_card_id = null
  where e.credit_card_id = p_card_id;
  get diagnostics v_purchase_count = row_count;

  delete from public.credit_cards where id = p_card_id;
  if not found then raise exception 'CREDIT_CARD_DELETE_FAILED'; end if;

  return query select p_card_id, v_purchase_count, v_payment_count;
end;
$$;

grant execute on function public.delete_credit_card(uuid) to authenticated;
revoke execute on function public.delete_credit_card(uuid) from public;

comment on function public.delete_credit_card(uuid) is
'Deletes one family card atomically, retains purchases as expenses with a card-name snapshot, and cascades payment history.';
