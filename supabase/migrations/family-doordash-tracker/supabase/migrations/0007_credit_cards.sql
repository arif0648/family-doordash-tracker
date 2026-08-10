-- ============================================================================
-- 0007_credit_cards.sql
-- Kredi Kartları — kişisel finans verisi. Aile üyeleri birbirinin kart
-- verisini GÖREMEZ (household finans paylaşımından farklı olarak, kredi
-- kartı bakiye/limit bilgisi kişisel kabul edilir).
-- ============================================================================

create table credit_cards (
  id              uuid primary key default uuid_generate_v4(),
  family_id       uuid not null references families(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  card_name       text not null,           -- e.g. "Chase Sapphire"
  last_four       text check (last_four ~ '^[0-9]{4}$'),
  credit_limit    numeric(10,2) check (credit_limit >= 0),
  current_balance numeric(10,2) not null default 0 check (current_balance >= 0),
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_credit_cards_user on credit_cards(user_id);
create index idx_credit_cards_family on credit_cards(family_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_credit_cards_touch
  before update on credit_cards
  for each row execute function public.touch_updated_at();

alter table credit_cards enable row level security;

-- PRIVACY RULE: only the owning user can SELECT their own credit card rows.
-- Family membership does NOT grant read access here — this is the opposite
-- of income/expenses, and is intentional (Bölüm: kendi kredi kartı
-- verilerinin gizliliği).
create policy credit_cards_select_own
  on credit_cards for select
  using (user_id = auth.uid());

create policy credit_cards_insert_own
  on credit_cards for insert
  with check (user_id = auth.uid() and public.is_family_member(family_id));

create policy credit_cards_update_own
  on credit_cards for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy credit_cards_delete_own
  on credit_cards for delete
  using (user_id = auth.uid());

comment on table credit_cards is
  'Kişisel kredi kartı verisi. RLS: sadece sahibi görebilir/değiştirebilir. Aile üyeliği bu tabloda okuma yetkisi VERMEZ (income/expenses tablolarının aksine).';
