-- ============================================================================
-- 0014_fix_expenses_constraint_and_functions.sql
-- 1. 'diger_requires_note' kısıtlamasını kaldırır.
-- 2. Ambiguous kalan is_family_member fonksiyonunu tek ve net imzaya kavuşturur.
-- 3. expenses tablosunun gerçek şemasına uygun RLS politikalarını tanımlar.
-- ============================================================================

-- 1. 'diger_requires_note' kısıtlamasını kaldır
alter table if exists public.expenses
  drop constraint if exists diger_requires_note;

-- 2. is_family_member fonksiyonunu çakışmayacak şekilde tanımla
create or replace function public.is_family_member(p_family_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = p_user_id
  );
$$;

-- 3. Gider tablosu RLS politikaları (gerçek sütun yapısına uygun: user_id)
alter table public.expenses enable row level security;

drop policy if exists expenses_select_family on public.expenses;
create policy expenses_select_family
  on public.expenses for select
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));

drop policy if exists expenses_insert_family on public.expenses;
create policy expenses_insert_family
  on public.expenses for insert
  to authenticated
  with check (
    public.is_family_member(family_id, auth.uid()) 
    and (user_id = auth.uid() or user_id is null)
  );

drop policy if exists expenses_update_family on public.expenses;
create policy expenses_update_family
  on public.expenses for update
  to authenticated
  using (public.is_family_member(family_id, auth.uid()))
  with check (public.is_family_member(family_id, auth.uid()));

drop policy if exists expenses_delete_family on public.expenses;
create policy expenses_delete_family
  on public.expenses for delete
  to authenticated
  using (public.is_family_member(family_id, auth.uid()));