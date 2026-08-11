-- ============================================================================
-- 0003_income_expenses_mileage.sql
-- income, mileage_log, expenses — with the corrected vehicle_id CHECK rule
-- (IMPLEMENTATION LOCK #1) and income<->mileage FK (IMPLEMENTATION LOCK #3)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MILEAGE LOG — one row per closing-odometer entry, chained per vehicle
-- ---------------------------------------------------------------------------
create table mileage_log (
  id                uuid primary key default uuid_generate_v4(),
  family_id         uuid not null references families(id) on delete cascade,
  vehicle_id        uuid not null references vehicles(id) on delete cascade,
  user_id           uuid not null references auth.users(id),
  record_date       date not null,
  closing_mileage   numeric(10,1) not null check (closing_mileage >= 0),
  miles_driven      numeric(10,1) not null check (miles_driven >= 0), -- computed by RPC, stored for fast reads
  created_at        timestamptz not null default now()
);

create index idx_mileage_chain
  on mileage_log(vehicle_id, record_date, created_at);

-- ---------------------------------------------------------------------------
-- INCOME — one row per earnings entry; each income row owns exactly one
-- mileage_log row (Bölüm 11.0 — atomicity)
-- ---------------------------------------------------------------------------
create table income (
  id                uuid primary key default uuid_generate_v4(),
  family_id         uuid not null references families(id) on delete cascade,
  vehicle_id        uuid not null references vehicles(id),
  user_id           uuid not null references auth.users(id),
  amount            numeric(10,2) not null check (amount >= 0),
  record_date       date not null,
  note              text,
  mileage_log_id    uuid not null references mileage_log(id) on delete restrict,
  created_at        timestamptz not null default now()
);

create index idx_income_family_date on income(family_id, record_date);
create index idx_income_vehicle on income(vehicle_id);
create index idx_income_user on income(user_id);

-- mileage_log rows are owned 1:1 by the income row that created them.
alter table mileage_log
  add column income_id uuid references income(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- EXPENSES — benzin / arac_gideri / market / diger_aile / diger_arac
-- IMPLEMENTATION LOCK #1: correct vehicle_id nullability per category
-- ---------------------------------------------------------------------------
create table expenses (
  id            uuid primary key default uuid_generate_v4(),
  family_id     uuid not null references families(id) on delete cascade,
  category      text not null check (category in ('benzin', 'arac_gideri', 'market', 'diger_aile', 'diger_arac')),
  vehicle_id    uuid references vehicles(id),
  user_id       uuid not null references auth.users(id),
  amount        numeric(10,2) not null check (amount >= 0),
  record_date   date not null,
  note          text,
  created_at    timestamptz not null default now(),

  -- IMPLEMENTATION LOCK #1 — enforced as a DB-level CHECK constraint,
  -- not left to application logic:
  --   benzin, arac_gideri, diger_arac  -> vehicle_id IS NOT NULL
  --   market, diger_aile               -> vehicle_id IS NULL
  constraint expense_vehicle_rule check (
    (category in ('benzin', 'arac_gideri', 'diger_arac') and vehicle_id is not null)
    or
    (category in ('market', 'diger_aile') and vehicle_id is null)
  ),

  -- "diger_aile"/"diger_arac" require a note since "Diğer" alone is meaningless
  -- (Bölüm 12 — DÜZELTİLDİ)
  constraint diger_requires_note check (
    category not in ('diger_aile', 'diger_arac') or (note is not null and length(trim(note)) > 0)
  )
);

create index idx_expenses_family_date on expenses(family_id, record_date);
create index idx_expenses_vehicle on expenses(vehicle_id);
create index idx_expenses_category on expenses(category);
create index idx_expenses_user on expenses(user_id);

-- ---------------------------------------------------------------------------
-- USER SETTINGS — sound / speech / push toggles (Bölüm 11 of master instr.)
-- ---------------------------------------------------------------------------
create table user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  sound_enabled       boolean not null default true,
  speech_enabled      boolean not null default true,
  push_enabled        boolean not null default false,
  push_subscription   jsonb,              -- Web Push subscription object (endpoint + keys)
  updated_at          timestamptz not null default now()
);
