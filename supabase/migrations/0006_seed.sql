-- ============================================================================
-- 0006_seed.sql
-- Seed data: 1 family, 3 vehicles, initial fixed expenses.
--
-- NOTE: Real user accounts (emails/passwords) are NOT fabricated here — per
-- explicit instruction, those three family members must be created during
-- real deployment (Supabase Auth signup or dashboard), not invented by AI.
-- This script seeds the family + vehicles + fixed expenses only, and shows
-- the exact follow-up step needed once the 3 real auth users exist.
-- ============================================================================

-- 1. Create the family.
insert into families (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Aile')
on conflict (id) do nothing;

-- 2. Seed exactly 3 vehicles for that family (trigger enforces the max-3 rule
--    even here, so a 4th INSERT below or later will fail loudly).
insert into vehicles (family_id, full_name, short_name) values
  ('00000000-0000-0000-0000-000000000001', '2026 Kia Sportage Hybrid', 'Kia Sportage'),
  ('00000000-0000-0000-0000-000000000001', '2026 Toyota Corolla XLE Hybrid', 'Toyota Corolla'),
  ('00000000-0000-0000-0000-000000000001', '2024 Honda Accord Sport Hybrid', 'Honda Accord')
on conflict do nothing;

-- 3. Seed initial fixed expenses (v1, effective from today).
--    created_by is set to a placeholder; replace with a real owner user_id
--    once the first real family member account exists (see step 4 below).
do $$
declare
  v_family_id uuid := '00000000-0000-0000-0000-000000000001';
  v_today date := current_date;
begin
  -- created_by is nullable-safe only if you temporarily relax the FK for
  -- seeding; in production, run this AFTER at least one real auth user
  -- exists and pass their real user_id here instead of a placeholder.
  null; -- placeholder: see README-DEPLOYMENT.md for the real seeding order
end $$;

-- ============================================================================
-- STEP 4 — MANUAL, POST-DEPLOYMENT (not fabricated by this script):
--
-- 1) Create the 3 real Supabase Auth users (real emails/passwords), e.g. via
--    `supabase.auth.signUp()` from the app's Kayıt Ol screen, or the
--    Supabase Dashboard.
-- 2) For each of the 3 users, insert a family_members row:
--
--    insert into family_members (family_id, user_id, role)
--    values ('00000000-0000-0000-0000-000000000001', '<real-auth-user-id>', 'owner');
--
-- 3) Insert the real fixed_expenses rows (amounts per Bölüm 7) with
--    created_by = one of the real owner user_ids:
--
--    insert into fixed_expenses (family_id, label, monthly_amount, effective_from, created_by) values
--      ('00000000-0000-0000-0000-000000000001', 'Ev Kirası',               2900, current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Toplam Araç Kredileri',   1852, current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Araç Sigortası',          880,  current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Avukat Ödemesi',         200,  current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Diğer Kredi',             280,  current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Telefon Faturası',        250,  current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Su ve Çöp Faturası',      160,  current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Elektrik Faturası',       110,  current_date, '<owner-user-id>'),
--      ('00000000-0000-0000-0000-000000000001', 'Araç Yıkama Aboneliği',   28,   current_date, '<owner-user-id>');
--
--    Total should equal exactly 6660.00 — verify with:
--    select family_fixed_expense_total('00000000-0000-0000-0000-000000000001');
