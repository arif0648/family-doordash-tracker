-- ============================================================================
-- 0021_unified_notification_center.sql
-- Unified notification center for all family notifications
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CREATE NOTIFICATIONS TABLE
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id)
    on delete cascade,
  recipient_id uuid not null
    references auth.users(id)
    on delete cascade,
  type text not null check (type in (
    'CREDIT_CARD',
    'PAYMENT',
    'APPOINTMENT',
    'VEHICLE',
    'FINANCIAL',
    'SYSTEM'
  )),
  title text not null,
  body text,
  reference_id uuid, -- Reference to related entity (e.g., credit_card_id, appointment_id)
  reference_type text, -- Type of reference (e.g., 'credit_card', 'appointment')
  read_at timestamptz,
  created_at timestamptz not null default now(),
  created_at_day date not null default current_date,

  -- Idempotency constraint to prevent duplicate notifications
  constraint notifications_unique_daily
    unique (recipient_id, type, reference_id, created_at_day)
);

create index idx_notifications_recipient on public.notifications(recipient_id, created_at desc);
create index idx_notifications_family on public.notifications(family_id);
create index idx_notifications_unread on public.notifications(recipient_id) where read_at is null;
create index idx_notifications_reference on public.notifications(reference_id, reference_type);

-- ---------------------------------------------------------------------------
-- 2. CREATE NOTIFICATION RPC
-- ---------------------------------------------------------------------------

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_reference_id uuid default null,
  p_reference_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_notification_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_recipient_id is null then
    raise exception 'RECIPIENT_REQUIRED';
  end if;

  if p_type is null then
    raise exception 'TYPE_REQUIRED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'TITLE_REQUIRED';
  end if;

  -- Get family_id from sender
  select family_id
    into v_family_id
  from public.family_members
  where user_id = v_user_id
    limit 1;

  if v_family_id is null then
    raise exception 'FAMILY_NOT_FOUND';
  end if;

  -- Verify recipient is family member
  if not public.is_family_member(v_family_id, p_recipient_id) then
    raise exception 'RECIPIENT_NOT_FAMILY_MEMBER';
  end if;

  -- Create notification (idempotency constraint handles duplicates)
  insert into public.notifications (
    family_id,
    recipient_id,
    type,
    title,
    body,
    reference_id,
    reference_type
  )
  values (
    v_family_id,
    p_recipient_id,
    p_type,
    trim(p_title),
    p_body,
    p_reference_id,
    p_reference_type
  )
  on conflict (recipient_id, type, reference_id, created_at_day)
  do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. CREATE BULK NOTIFICATION RPC (for family-wide notifications)
-- ---------------------------------------------------------------------------

create or replace function public.create_family_notification(
  p_type text,
  p_title text,
  p_body text default null,
  p_reference_id uuid default null,
  p_reference_type text default null
)
returns integer -- number of notifications created
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_type is null then
    raise exception 'TYPE_REQUIRED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'TITLE_REQUIRED';
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

  -- Create notification for all family members
  insert into public.notifications (
    family_id,
    recipient_id,
    type,
    title,
    body,
    reference_id,
    reference_type
  )
  select
    v_family_id,
    fm.user_id,
    p_type,
    trim(p_title),
    p_body,
    p_reference_id,
    p_reference_type
  from public.family_members fm
  where fm.family_id = v_family_id
  on conflict (recipient_id, type, reference_id, created_at_day)
  do nothing;

  get diagnostics v_count = ROW_COUNT;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. MARK NOTIFICATION AS READ RPC
-- ---------------------------------------------------------------------------

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipient_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get recipient_id and lock
  select recipient_id
    into v_recipient_id
  from public.notifications
  where id = p_notification_id
  for update;

  if not found then
    raise exception 'NOTIFICATION_NOT_FOUND';
  end if;

  -- Only recipient can mark as read
  if v_recipient_id <> v_user_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.notifications
  set read_at = now()
  where id = p_notification_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. MARK ALL NOTIFICATIONS AS READ RPC
-- ---------------------------------------------------------------------------

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.notifications
  set read_at = now()
  where recipient_id = v_user_id
    and read_at is null;

  get diagnostics v_count = ROW_COUNT;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. GET UNREAD COUNT FUNCTION
-- ---------------------------------------------------------------------------

create or replace function public.get_unread_notification_count(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select count(*)
  from public.notifications
  where recipient_id = p_user_id
    and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS POLICIES FOR NOTIFICATIONS
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

create policy notifications_insert_family
on public.notifications
for insert
to authenticated
with check (
  public.is_family_member(family_id, auth.uid())
);

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy notifications_delete_own
on public.notifications
for delete
to authenticated
using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. REALTIME SUPPORT FOR NOTIFICATIONS
-- ---------------------------------------------------------------------------

alter table public.notifications
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
      and c.relname = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 9. HELPER FUNCTION TO CREATE CREDIT CARD REMINDER
-- ---------------------------------------------------------------------------

create or replace function public.create_credit_card_reminder(
  p_credit_card_id uuid,
  p_days_until_due integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_card_name text;
  v_due_date date;
  v_notification_id uuid;
  v_title text;
  v_body text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get card info
  select cc.family_id, cc.card_name, cc.due_date
    into v_family_id, v_card_name, v_due_date
  from public.credit_cards cc
  where cc.id = p_credit_card_id;

  if not found then
    raise exception 'CREDIT_CARD_NOT_FOUND';
  end if;

  -- Build notification message
  if p_days_until_due < 0 then
    v_title := 'Kredi kartı ödemesi gecikmiş';
    v_body := v_card_name || ' kredi kartı ödemesi ' || abs(p_days_until_due) || ' gün gecikmiş.';
  elsif p_days_until_due = 0 then
    v_title := 'Kredi kartı ödemesi bugün';
    v_body := v_card_name || ' kredi kartı ödemesi bugün son.';
  elsif p_days_until_due = 1 then
    v_title := 'Kredi kartı ödemesi yarın';
    v_body := v_card_name || ' kredi kartı ödemesi yarın.';
  else
    v_title := 'Kredi kartı ödemesi yaklaşıyor';
    v_body := v_card_name || ' kredi kartı ödemesine ' || p_days_until_due || ' gün var.';
  end if;

  -- Create family-wide notification
  select public.create_family_notification(
    'CREDIT_CARD',
    v_title,
    v_body,
    p_credit_card_id,
    'credit_card'
  ) into v_notification_id;

  return v_notification_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. HELPER FUNCTION TO CREATE APPOINTMENT REMINDER
-- ---------------------------------------------------------------------------

create or replace function public.create_appointment_reminder(
  p_appointment_id uuid,
  p_days_until integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_title text;
  v_body text;
  v_notification_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Get appointment info
  select a.family_id, a.title
    into v_family_id, v_title
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  -- Build notification message
  if p_days_until = 0 then
    v_body := v_title || ' bugün.';
  elsif p_days_until = 1 then
    v_body := v_title || ' yarın.';
  else
    v_body := v_title || ' ' || p_days_until || ' gün içinde.';
  end if;

  -- Create family-wide notification
  select public.create_family_notification(
    'APPOINTMENT',
    'Randevu hatırlatması',
    v_body,
    p_appointment_id,
    'appointment'
  ) into v_notification_id;

  return v_notification_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. GRANT PERMISSIONS
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.notifications to authenticated;

grant execute on function public.create_notification(uuid,text,text,text,uuid,text)
to authenticated;

grant execute on function public.create_family_notification(text,text,text,uuid,text)
to authenticated;

grant execute on function public.mark_notification_read(uuid)
to authenticated;

grant execute on function public.mark_all_notifications_read()
to authenticated;

grant execute on function public.get_unread_notification_count(uuid)
to authenticated;

grant execute on function public.create_credit_card_reminder(uuid,integer)
to authenticated;

grant execute on function public.create_appointment_reminder(uuid,integer)
to authenticated;

revoke execute on function public.create_notification(uuid,text,text,text,uuid,text)
from public;

revoke execute on function public.create_family_notification(text,text,text,uuid,text)
from public;

revoke execute on function public.mark_notification_read(uuid)
from public;

revoke execute on function public.mark_all_notifications_read()
from public;

revoke execute on function public.get_unread_notification_count(uuid)
from public;

revoke execute on function public.create_credit_card_reminder(uuid,integer)
from public;

revoke execute on function public.create_appointment_reminder(uuid,integer)
from public;

-- ---------------------------------------------------------------------------
-- 12. DOCUMENTATION
-- ---------------------------------------------------------------------------

comment on table public.notifications is
'Birleşik bildirim merkezi. Tüm bildirim türleri (kredi kartı, randevu, finansal, sistem) tek tabloda toplanır.';

comment on column public.notifications.reference_id is
'İlgili varlığın ID''si (örn: credit_card_id, appointment_id).';

comment on column public.notifications.reference_type is
'Referans türü (örn: ''credit_card'', ''appointment'').';

comment on function public.create_notification(uuid,text,text,text,uuid,text) is
'Tek kullanıcıya bildirim oluşturur. Günlük idempotent (aynı bildirim tekrar oluşturulmaz).';

comment on function public.create_family_notification(text,text,text,uuid,text) is
'Ailedeki tüm kullanıcılara bildirim oluşturur.';

comment on function public.mark_notification_read(uuid) is
'Bildirimi okundu olarak işaretler.';

comment on function public.mark_all_notifications_read() is
'Tüm bildirimleri okundu olarak işaretler.';

comment on function public.get_unread_notification_count(uuid) is
'Okunmamış bildirim sayısını döndürür.';
