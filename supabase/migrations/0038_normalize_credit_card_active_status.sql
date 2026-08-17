-- Legacy cards can have NULL is_active because the column was introduced as
-- nullable. Card management displayed those rows, while the expense picker's
-- active-only filter excluded them. Normalize once and prevent recurrence.
update public.credit_cards
set is_active = true
where is_active is null;

alter table public.credit_cards
  alter column is_active set default true,
  alter column is_active set not null;
