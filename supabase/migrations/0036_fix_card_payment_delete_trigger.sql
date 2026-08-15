-- A cascading card delete removes credit_card_payments with TG_OP=DELETE.
-- DELETE has OLD only, so select OLD.payment_date before any NEW branch.

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
  if tg_op = 'DELETE' then
    if tg_table_name = 'credit_card_payments' then
      v_record_date := old.payment_date;
    else
      v_record_date := old.record_date;
    end if;
    v_family_id := old.family_id;
  elsif tg_table_name = 'credit_card_payments' then
    v_record_date := new.payment_date;
    v_family_id := new.family_id;
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
