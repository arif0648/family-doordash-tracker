-- ============================================================================
-- 0016: Fix is_family_member() ambiguity
-- Keep both function signatures for backwards compatibility.
-- Policies must explicitly call the 2-argument version.
-- ============================================================================

drop policy if exists fixed_expenses_insert_family
  on public.fixed_expenses;

create policy fixed_expenses_insert_family
  on public.fixed_expenses
  for insert
  to authenticated
  with check (
    public.is_family_member(family_id, auth.uid())
    and created_by = auth.uid()
  );


drop policy if exists fixed_expenses_select_family
  on public.fixed_expenses;

create policy fixed_expenses_select_family
  on public.fixed_expenses
  for select
  to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
  );


drop policy if exists fixed_expenses_update_family
  on public.fixed_expenses;

create policy fixed_expenses_update_family
  on public.fixed_expenses
  for update
  to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
  )
  with check (
    public.is_family_member(family_id, auth.uid())
  );


drop policy if exists fixed_expenses_delete_family
  on public.fixed_expenses;

create policy fixed_expenses_delete_family
  on public.fixed_expenses
  for delete
  to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
  );