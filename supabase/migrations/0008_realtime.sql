-- ============================================================================
-- 0008_realtime.sql
-- Realtime publication: which tables broadcast changes (Bölüm 15 / Master
-- Instruction Bölüm 14). Supabase Realtime uses Postgres logical replication
-- via the `supabase_realtime` publication.
-- ============================================================================

alter publication supabase_realtime add table income;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table mileage_log;
alter publication supabase_realtime add table fixed_expenses;

-- credit_cards is deliberately NOT added: it's private per-user data and
-- realtime broadcast would leak change *metadata* to other family members'
-- subscriptions if they were ever (mis)subscribed to it. Since RLS also
-- restricts SELECT to the owner, Supabase Realtime already filters payloads
-- per-subscriber via RLS — but we exclude it from the publication entirely
-- as defense-in-depth, since this app has no per-card realtime UI need.

-- vehicles and profiles are near-static reference data; no realtime needed.
