-- ============================================================================
-- 0005_rls_policies.sql
-- IMPLEMENTATION LOCK #2: family membership isolation + own-record-only
-- writes, enforced entirely at the database level. Client-supplied user_id
-- is never trusted — every policy uses auth.uid().
-- ============================================================================

alter table families         enable row level security;
alter table family_members   enable row level security;
alter table profiles         enable row level security;
alter table vehicles         enable row level security;
alter table fixed_expenses   enable row level security;
alter table income           enable row level security;
alter table expenses         enable row level security;
alter table mileage_log      enable row level security;
alter table user_settings    enable row level security;

-- Helper: is auth.uid() a member of the given family?
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from family_members
    where family_id = p_family_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- FAMILIES
-- ---------------------------------------------------------------------------
create policy families_select_member
  on families for select
  using (public.is_family_member(id));

-- No client INSERT/UPDATE/DELETE on families; provisioning is done via
-- service-role during onboarding/deployment, not by the app.

-- ---------------------------------------------------------------------------
-- FAMILY_MEMBERS
-- ---------------------------------------------------------------------------
create policy family_members_select_own_family
  on family_members for select
  using (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
-- A user can read their own profile...
create policy profiles_select_self
  on profiles for select
  using (user_id = auth.uid());

-- ...and can read profiles of people who share at least one family with them
-- (needed to show "kim ekledi" in transaction history).
create policy profiles_select_family_members
  on profiles for select
  using (
    exists (
      select 1 from family_members fm1
      join family_members fm2 on fm1.family_id = fm2.family_id
      where fm1.user_id = auth.uid() and fm2.user_id = profiles.user_id
    )
  );

create policy profiles_update_self
  on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- VEHICLES — read-only to family members, never writable from client
-- ---------------------------------------------------------------------------
create policy vehicles_select_family
  on vehicles for select
  using (public.is_family_member(family_id));

-- Deliberately: NO insert/update/delete policy for vehicles at all.
-- Combined with RLS being enabled, this means the anon/authenticated role
-- can never write to vehicles under any circumstance (Bölüm 3).

-- ---------------------------------------------------------------------------
-- FIXED_EXPENSES — family members can read; write left to admin/service-role
-- by default (family-level financial config, not a daily user action).
-- If the product later wants a family "owner" role to edit these from the
-- app, add an INSERT/UPDATE policy scoped to role = 'owner' in family_members.
-- ---------------------------------------------------------------------------
create policy fixed_expenses_select_family
  on fixed_expenses for select
  using (public.is_family_member(family_id));

create policy fixed_expenses_insert_owner
  on fixed_expenses for insert
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1 from family_members
      where family_id = fixed_expenses.family_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- No UPDATE policy on fixed_expenses: rows are immutable once created —
-- changes happen by inserting a new version (trigger closes the old one).
-- No DELETE policy: history must never be erased.

-- ---------------------------------------------------------------------------
-- MILEAGE_LOG
-- ---------------------------------------------------------------------------
-- Read: any family member.
create policy mileage_select_family
  on mileage_log for select
  using (public.is_family_member(family_id));

-- Write: ONLY through the atomic RPC functions (which run as the calling
-- user via `security invoker` and are themselves gated by auth.uid() checks
-- inside the function body). We still add INSERT/UPDATE/DELETE policies as
-- defense-in-depth, restricted to the row's own user_id and own family.
create policy mileage_insert_own
  on mileage_log for insert
  with check (user_id = auth.uid() and public.is_family_member(family_id));

create policy mileage_update_own
  on mileage_log for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy mileage_delete_own
  on mileage_log for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- INCOME
-- ---------------------------------------------------------------------------
create policy income_select_family
  on income for select
  using (public.is_family_member(family_id));

create policy income_insert_own
  on income for insert
  with check (user_id = auth.uid() and public.is_family_member(family_id));

-- Critical rule under test: a user may update/delete ONLY their own income.
create policy income_update_own
  on income for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy income_delete_own
  on income for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- EXPENSES
-- ---------------------------------------------------------------------------
create policy expenses_select_family
  on expenses for select
  using (public.is_family_member(family_id));

create policy expenses_insert_own
  on expenses for insert
  with check (user_id = auth.uid() and public.is_family_member(family_id));

create policy expenses_update_own
  on expenses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy expenses_delete_own
  on expenses for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- USER_SETTINGS
-- ---------------------------------------------------------------------------
create policy user_settings_select_self
  on user_settings for select
  using (user_id = auth.uid());

create policy user_settings_upsert_self
  on user_settings for insert
  with check (user_id = auth.uid());

create policy user_settings_update_self
  on user_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
