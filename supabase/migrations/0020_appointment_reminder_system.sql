-- ============================================================================
-- 0020_appointment_reminder_system.sql
-- Family appointment/reminder system with notification support
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CREATE APPOINTMENTS TABLE
-- ---------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id)
    on delete cascade,
  title text not null,
  description text,
  type text not null check (type in (
    'vehicle_maintenance',
    'oil_change',
    'registration',
    'insurance_renewal',
    'school_event',
    'child_activity',
    'doctor',
    'dentist',
    'family_appointment',
    'personal_reminder',
    'other'
  )),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean default false,
  created_by uuid not null
    references auth.users(id)
    on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  reminder_days integer[] default array[7,3,1], -- Default: 7, 3, 1 days before
  status text default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_end_after_start check (
    end_at is null or end_at >= start_at
  )
);

create index idx_appointments_family on public.appointments(family_id);
create index idx_appointments_start on public.appointments(start_at);
create index idx_appointments_status on public.appointments(status);
create index idx_appointments_created_by on public.appointments(created_by);
create index idx_appointments_assigned_to on public.appointments(assigned_to);

-- Updated_at trigger
create trigger trg_appointments_touch
  before update on public.appointments
  for each row
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS POLICIES FOR APPOINTMENTS
-- Family-wide access for all family members
-- ---------------------------------------------------------------------------

alter table public.appointments enable row level security;

create policy appointments_select_family
on public.appointments
for select
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
);

create policy appointments_insert_family
on public.appointments
for insert
to authenticated
with check (
  public.is_family_member(family_id, auth.uid())
  and created_by = auth.uid()
);

create policy appointments_update_family
on public.appointments
for update
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
)
with check (
  public.is_family_member(family_id, auth.uid())
);

create policy appointments_delete_family
on public.appointments
for delete
to authenticated
using (
  public.is_family_member(family_id, auth.uid())
  or created_by = auth.uid()
);

-- ---------------------------------------------------------------------------
-- 3. CREATE APPOINTMENT RPC
-- ---------------------------------------------------------------------------

create or replace function public.create_appointment(
  p_title text,
  p_description text default null,
  p_type text default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_all_day boolean default false,
  p_assigned_to uuid default null,
  p_reminder_days integer[] default array[7,3,1]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_appointment_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'TITLE_REQUIRED';
  end if;

  if p_type is null then
    raise exception 'TYPE_REQUIRED';
  end if;

  if p_start_at is null then
    raise exception 'START_TIME_REQUIRED';
  end if;

  -- Get family_id
  select family_id
    into v_family_id
  from public.family_members
  where user_id = v_user_id
    limit 1;

  if v_family_id is null then
    raise exception 'FAMILY_NOT_FOUND';
  end if;

  -- Validate assigned_to is family member if provided
  if p_assigned_to is not null then
    if not public.is_family_member(v_family_id, p_assigned_to) then
      raise exception 'ASSIGNED_TO_NOT_FAMILY_MEMBER';
    end if;
  end if;

  -- Create appointment
  insert into public.appointments (
    family_id,
    title,
    description,
    type,
    start_at,
    end_at,
    all_day,
    created_by,
    assigned_to,
    reminder_days,
    status
  )
  values (
    v_family_id,
    trim(p_title),
    p_description,
    p_type,
    p_start_at,
    p_end_at,
    p_all_day,
    v_user_id,
    p_assigned_to,
    p_reminder_days,
    'upcoming'
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. UPDATE APPOINTMENT RPC
-- ---------------------------------------------------------------------------

create or replace function public.update_appointment(
  p_appointment_id uuid,
  p_title text default null,
  p_description text default null,
  p_type text default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_all_day boolean default null,
  p_assigned_to uuid default null,
  p_reminder_days integer[] default null,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_assigned_to uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get appointment info and lock it
  select family_id, assigned_to
    into v_family_id, v_assigned_to
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  -- Verify family membership
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Validate assigned_to if changing
  if p_assigned_to is not null and p_assigned_to <> v_assigned_to then
    if not public.is_family_member(v_family_id, p_assigned_to) then
      raise exception 'ASSIGNED_TO_NOT_FAMILY_MEMBER';
    end if;
  end if;

  -- Update appointment
  update public.appointments
  set
    title = coalesce(p_title, title),
    description = coalesce(p_description, description),
    type = coalesce(p_type, type),
    start_at = coalesce(p_start_at, start_at),
    end_at = coalesce(p_end_at, end_at),
    all_day = coalesce(p_all_day, all_day),
    assigned_to = coalesce(p_assigned_to, assigned_to),
    reminder_days = coalesce(p_reminder_days, reminder_days),
    status = coalesce(p_status, status),
    updated_at = now()
  where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. DELETE/CANCEL APPOINTMENT RPC
-- ---------------------------------------------------------------------------

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_created_by uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get appointment info and lock it
  select family_id, created_by
    into v_family_id, v_created_by
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  -- Verify family membership
  if not public.is_family_member(v_family_id, v_user_id) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  -- Only creator or family members can cancel
  if v_created_by <> v_user_id then
    -- Check if user is family member (already verified above)
    -- Allow family members to cancel
  end if;

  -- Soft cancel by updating status
  update public.appointments
  set status = 'cancelled',
      updated_at = now()
  where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. GET UPCOMING APPOINTMENTS FUNCTION
-- Returns appointments within the next N days
-- ---------------------------------------------------------------------------

create or replace function public.get_upcoming_appointments(
  p_family_id uuid,
  p_days_ahead integer default 30
)
returns table (
  id uuid,
  title text,
  description text,
  type text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean,
  created_by uuid,
  assigned_to uuid,
  status text,
  reminder_days integer[]
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    a.title,
    a.description,
    a.type,
    a.start_at,
    a.end_at,
    a.all_day,
    a.created_by,
    a.assigned_to,
    a.status,
    a.reminder_days
  from public.appointments a
  where a.family_id = p_family_id
    and a.status = 'upcoming'
    and a.start_at >= now()
    and a.start_at <= now() + (p_days_ahead || ' days')::interval
  order by a.start_at asc;
$$;

-- ---------------------------------------------------------------------------
-- 7. REALTIME SUPPORT FOR APPOINTMENTS
-- ---------------------------------------------------------------------------

alter table public.appointments
replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 8. GRANT PERMISSIONS
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.appointments to authenticated;

grant execute on function public.create_appointment(text,text,text,timestamptz,timestamptz,boolean,uuid,integer[])
to authenticated;

grant execute on function public.update_appointment(uuid,text,text,text,timestamptz,timestamptz,boolean,uuid,integer[],text)
to authenticated;

grant execute on function public.cancel_appointment(uuid)
to authenticated;

grant execute on function public.get_upcoming_appointments(uuid,integer)
to authenticated;

revoke execute on function public.create_appointment(text,text,text,timestamptz,timestamptz,boolean,uuid,integer[])
from public;

revoke execute on function public.update_appointment(uuid,text,text,text,timestamptz,timestamptz,boolean,uuid,integer[],text)
from public;

revoke execute on function public.cancel_appointment(uuid)
from public;

revoke execute on function public.get_upcoming_appointments(uuid,integer)
from public;

-- ---------------------------------------------------------------------------
-- 9. DOCUMENTATION
-- ---------------------------------------------------------------------------

comment on table public.appointments is
'Aile randevuları ve hatırlatıcıları. Aile üyeleri oluşturabilir/düzenleyebilir/silebilir.';

comment on column public.appointments.reminder_days is
'Hatırlatma günleri (örn: array[7,3,1] = 7 gün, 3 gün, 1 gün önce)';

comment on function public.create_appointment(text,text,text,timestamptz,timestamptz,boolean,uuid,integer[]) is
'Yeni aile randevusu oluşturur.';

comment on function public.update_appointment(uuid,text,text,text,timestamptz,timestamptz,boolean,uuid,integer[],text) is
'Mevcut randevuyu günceller.';

comment on function public.cancel_appointment(uuid) is
'Randevuyu iptal eder (status = cancelled).';

comment on function public.get_upcoming_appointments(uuid,integer) is
'Gelecek N gün içindeki yaklaşan randevuları döndürür.';
