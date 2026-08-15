-- One canonical family, approval-gated membership, personal work sessions,
-- and fixed-expense label correction without changing amount history.
insert into public.families (id, name)
values ('00000000-0000-0000-0000-000000000001', 'BARBIN AİLESİ')
on conflict (id) do update set name = excluded.name;

alter table public.family_members
  add column if not exists approval_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.family_members drop constraint if exists family_members_approval_status_check;
alter table public.family_members add constraint family_members_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));
create index if not exists idx_family_members_pending
  on public.family_members (family_id, approval_status, joined_at);

-- Canonical members were explicitly admitted before approval statuses existed.
update public.family_members
set approval_status = 'approved', reviewed_at = coalesce(reviewed_at, now())
where family_id = '00000000-0000-0000-0000-000000000001';
update public.family_members fm
set role = 'owner', approval_status = 'approved', reviewed_at = coalesce(reviewed_at, now())
from auth.users u
where fm.family_id = '00000000-0000-0000-0000-000000000001'
  and fm.user_id = u.id and lower(u.email) = 'arifbarbin@hotmail.com';
update public.family_members fm set role = 'member'
where fm.family_id = '00000000-0000-0000-0000-000000000001' and fm.role = 'owner'
  and not exists (select 1 from auth.users u where u.id = fm.user_id and lower(u.email) = 'arifbarbin@hotmail.com');

-- Existing non-canonical accounts become pending requests, never auto-approved.
insert into public.family_members (family_id, user_id, role, approval_status)
select '00000000-0000-0000-0000-000000000001', u.id, 'member', 'pending'
from auth.users u
where not exists (
  select 1 from public.family_members fm
  where fm.family_id = '00000000-0000-0000-0000-000000000001' and fm.user_id = u.id
)
on conflict (family_id, user_id) do nothing;

create or replace function public.is_family_member(p_family_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_family_id = '00000000-0000-0000-0000-000000000001'::uuid and exists (
    select 1 from public.family_members fm where fm.family_id = p_family_id
      and fm.user_id = p_user_id and fm.approval_status = 'approved'
  );
$$;
revoke execute on function public.is_family_member(uuid, uuid) from public;
grant execute on function public.is_family_member(uuid, uuid) to authenticated;
create or replace function public.is_family_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_family_member(p_family_id, auth.uid());
$$;
revoke execute on function public.is_family_member(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;

create or replace function public.resolve_current_family_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select '00000000-0000-0000-0000-000000000001'::uuid
  where public.is_family_member('00000000-0000-0000-0000-000000000001'::uuid, auth.uid());
$$;
create or replace function public.get_my_membership_status()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select fm.approval_status from public.family_members fm
    where fm.family_id = '00000000-0000-0000-0000-000000000001' and fm.user_id = auth.uid()), 'none');
$$;

create or replace function public.handle_new_user_family_provisioning()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.family_members (family_id, user_id, role, approval_status)
  values ('00000000-0000-0000-0000-000000000001', new.id, 'member', 'pending')
  on conflict (family_id, user_id) do update
    set role = 'member', approval_status = 'pending', reviewed_at = null, reviewed_by = null;
  insert into public.notifications (family_id, recipient_id, type, title, body, reference_id, reference_type)
  select '00000000-0000-0000-0000-000000000001', owner.user_id, 'SYSTEM', 'Yeni üyelik isteği',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), new.email, 'Yeni kullanıcı') || ' aileye katılmak istiyor.',
    new.id, 'membership_request'
  from public.family_members owner
  where owner.family_id = '00000000-0000-0000-0000-000000000001'
    and owner.role = 'owner' and owner.approval_status = 'approved';
  return new;
end;
$$;

create or replace function public.list_membership_requests()
returns table (user_id uuid, display_name text, email text, approval_status text, requested_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.family_members fm
    where fm.family_id = '00000000-0000-0000-0000-000000000001' and fm.user_id = auth.uid()
      and fm.role = 'owner' and fm.approval_status = 'approved') then raise exception 'OWNER_REQUIRED'; end if;
  return query select fm.user_id, p.display_name, p.email, fm.approval_status, fm.joined_at
  from public.family_members fm join public.profiles p on p.user_id = fm.user_id
  where fm.family_id = '00000000-0000-0000-0000-000000000001'
    and fm.approval_status in ('pending', 'rejected') order by fm.joined_at;
end;
$$;

create or replace function public.review_membership_request(p_user_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text := case when p_approve then 'approved' else 'rejected' end;
begin
  if not exists (select 1 from public.family_members fm
    where fm.family_id = '00000000-0000-0000-0000-000000000001' and fm.user_id = auth.uid()
      and fm.role = 'owner' and fm.approval_status = 'approved') then raise exception 'OWNER_REQUIRED'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_REVIEW_SELF'; end if;
  update public.family_members set approval_status = v_status, role = 'member', reviewed_at = now(), reviewed_by = auth.uid()
  where family_id = '00000000-0000-0000-0000-000000000001' and user_id = p_user_id;
  if not found then raise exception 'MEMBERSHIP_REQUEST_NOT_FOUND'; end if;
  return v_status;
end;
$$;
grant execute on function public.resolve_current_family_id() to authenticated;
grant execute on function public.get_my_membership_status() to authenticated;
grant execute on function public.list_membership_requests() to authenticated;
grant execute on function public.review_membership_request(uuid, boolean) to authenticated;
revoke execute on function public.get_my_membership_status() from public;
revoke execute on function public.list_membership_requests() from public;
revoke execute on function public.review_membership_request(uuid, boolean) from public;

drop policy if exists family_members_select_own_family on public.family_members;
drop policy if exists family_members_select_status on public.family_members;
create policy family_members_select_status on public.family_members for select to authenticated
using (user_id = auth.uid() or public.is_family_member(family_id, auth.uid()));

drop policy if exists work_sessions_update_family on public.work_sessions;
drop policy if exists work_sessions_update_own on public.work_sessions;
create policy work_sessions_update_own on public.work_sessions for update to authenticated
using (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()))
with check (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));
drop policy if exists work_sessions_delete_family on public.work_sessions;
drop policy if exists work_sessions_delete_own on public.work_sessions;
create policy work_sessions_delete_own on public.work_sessions for delete to authenticated
using (user_id = auth.uid() and public.is_family_member(family_id, auth.uid()));
create unique index if not exists idx_work_sessions_one_open_per_user
  on public.work_sessions (user_id) where ended_at is null;

create or replace function public.rename_fixed_expense(p_expense_id uuid, p_label text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_family_id uuid; v_label text := nullif(trim(p_label), '');
begin
  if v_label is null then raise exception 'FIXED_EXPENSE_LABEL_REQUIRED'; end if;
  select family_id into v_family_id from public.fixed_expenses where id = p_expense_id;
  if not found then raise exception 'FIXED_EXPENSE_NOT_FOUND'; end if;
  if not public.is_family_member(v_family_id, auth.uid()) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  update public.fixed_expenses set label = v_label where id = p_expense_id;
end;
$$;
grant execute on function public.rename_fixed_expense(uuid, text) to authenticated;
revoke execute on function public.rename_fixed_expense(uuid, text) from public;

do $$ begin alter publication supabase_realtime add table public.family_members;
exception when duplicate_object then null; end $$;
alter table public.family_members replica identity full;
