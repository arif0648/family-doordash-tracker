-- ============================================================================
-- 0011_family_messaging.sql
-- FINAL / PRODUCTION / CLEAN
--
-- AİLE MESAJLAŞMA + SESLİ MESAJ + REALTIME + PRIVATE STORAGE
--
-- Amaç:
--   1. Aile üyeleri arasında normal metin mesajlaşması
--   2. Aile üyeleri arasında sesli mesajlaşma
--   3. Bas-konuş tarzı sesli mesaj desteği
--   4. Supabase Realtime ile anlık mesaj senkronizasyonu
--   5. Private Storage üzerinden güvenli ses dosyaları
--   6. Sadece aynı aile üyelerinin mesajları okuyabilmesi
--   7. Kullanıcının kendi mesajını silebilmesi
--   8. Aile owner'ının aile mesajlarını silebilmesi
--   9. Soft-delete ile mesaj geçmişinin korunması
--  10. Audio path'in family/user seviyesinde izole edilmesi
--
-- ÖNEMLİ:
--   Bu migration finansal hesaplama sistemini değiştirmez.
--   Aile mesajlaşması finans modülünden bağımsızdır.
--
-- ============================================================================


-- ============================================================================
-- 1. FAMILY CHATS
-- ============================================================================

create table if not exists public.family_chats (
  id uuid primary key default gen_random_uuid(),

  family_id uuid not null
    references public.families(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


create unique index if not exists uq_family_chats_family
on public.family_chats(family_id);


create index if not exists idx_family_chats_family
on public.family_chats(family_id);


-- ============================================================================
-- 2. FAMILY MESSAGES
-- ============================================================================

create table if not exists public.family_messages (
  id uuid primary key default gen_random_uuid(),

  family_id uuid not null
    references public.families(id)
    on delete cascade,

  sender_id uuid not null
    references auth.users(id)
    on delete restrict,

  message_type text not null default 'text',

  content text,

  audio_path text,

  duration_seconds integer,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  deleted_at timestamptz
);


-- ============================================================================
-- 3. MESSAGE TYPE CHECK
-- ============================================================================

alter table public.family_messages
drop constraint if exists family_messages_type_check;

alter table public.family_messages
add constraint family_messages_type_check
check (
  message_type in ('text', 'audio')
);


-- ============================================================================
-- 4. MESSAGE CONTENT CHECK
--
-- Normal mesaj:
--   text  -> content dolu, audio_path boş
--   audio -> audio_path dolu, content boş
--
-- Soft-deleted mesaj:
--   content ve audio_path NULL olabilir.
-- ============================================================================

alter table public.family_messages
drop constraint if exists family_messages_content_check;

alter table public.family_messages
add constraint family_messages_content_check
check (
  (
    deleted_at is not null
    and content is null
    and audio_path is null
  )
  or
  (
    message_type = 'text'
    and content is not null
    and length(trim(content)) > 0
    and audio_path is null
  )
  or
  (
    message_type = 'audio'
    and audio_path is not null
    and length(trim(audio_path)) > 0
    and content is null
  )
);


-- ============================================================================
-- 5. AUDIO DURATION CHECK
--
-- Maksimum sesli mesaj: 10 dakika
-- ============================================================================

alter table public.family_messages
drop constraint if exists family_messages_duration_check;

alter table public.family_messages
add constraint family_messages_duration_check
check (
  duration_seconds is null
  or (
    duration_seconds >= 0
    and duration_seconds <= 600
  )
);


-- ============================================================================
-- 6. MESSAGE INDEXES
-- ============================================================================

create index if not exists idx_family_messages_family_created
on public.family_messages(
  family_id,
  created_at desc
);


create index if not exists idx_family_messages_sender
on public.family_messages(sender_id);


create index if not exists idx_family_messages_active
on public.family_messages(
  family_id,
  created_at desc
)
where deleted_at is null;


-- ============================================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================================

drop trigger if exists trigger_set_timestamp_family_chats
on public.family_chats;

create trigger trigger_set_timestamp_family_chats
before update on public.family_chats
for each row
execute function public.handle_update_timestamp();


drop trigger if exists trigger_set_timestamp_family_messages
on public.family_messages;

create trigger trigger_set_timestamp_family_messages
before update on public.family_messages
for each row
execute function public.handle_update_timestamp();


-- ============================================================================
-- 8. FAMILY MEMBERSHIP HELPER
-- ============================================================================

create or replace function public.is_family_member(
  p_family_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
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


revoke execute
on function public.is_family_member(uuid, uuid)
from public;

grant execute
on function public.is_family_member(uuid, uuid)
to authenticated;


-- ============================================================================
-- 9. GET OR CREATE FAMILY CHAT
-- ============================================================================

create or replace function public.get_or_create_family_chat(
  p_family_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_chat_id uuid;
begin

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(
    p_family_id,
    v_user_id
  ) then
    raise exception 'NOT_FAMILY_MEMBER';
  end if;

  select id
  into v_chat_id
  from public.family_chats
  where family_id = p_family_id
  limit 1;

  if v_chat_id is not null then
    return v_chat_id;
  end if;

  insert into public.family_chats (
    family_id
  )
  values (
    p_family_id
  )
  on conflict (family_id)
  do update
  set updated_at = now()
  returning id
  into v_chat_id;

  return v_chat_id;

end;
$$;


revoke execute
on function public.get_or_create_family_chat(uuid)
from public;

grant execute
on function public.get_or_create_family_chat(uuid)
to authenticated;


-- ============================================================================
-- 10. SEND TEXT MESSAGE
-- ============================================================================

create or replace function public.send_family_text_message(
  p_family_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid;
begin

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(
    p_family_id,
    v_user_id
  ) then
    raise exception 'NOT_FAMILY_MEMBER';
  end if;

  if p_content is null
     or length(trim(p_content)) = 0 then
    raise exception 'EMPTY_MESSAGE';
  end if;

  if length(trim(p_content)) > 5000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  perform public.get_or_create_family_chat(
    p_family_id
  );

  insert into public.family_messages (
    family_id,
    sender_id,
    message_type,
    content
  )
  values (
    p_family_id,
    v_user_id,
    'text',
    trim(p_content)
  )
  returning id
  into v_message_id;

  return v_message_id;

end;
$$;


revoke execute
on function public.send_family_text_message(uuid, text)
from public;

grant execute
on function public.send_family_text_message(uuid, text)
to authenticated;


-- ============================================================================
-- 11. SEND AUDIO MESSAGE
--
-- Zorunlu path formatı:
--
--   family_id/user_id/filename
--
-- Örnek:
--
--   550e8400-e29b-41d4-a716-446655440000/
--   11111111-1111-1111-1111-111111111111/
--   audio-123.webm
--
-- ============================================================================

create or replace function public.send_family_audio_message(
  p_family_id uuid,
  p_audio_path text,
  p_duration_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid;
  v_expected_prefix text;
begin

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_family_member(
    p_family_id,
    v_user_id
  ) then
    raise exception 'NOT_FAMILY_MEMBER';
  end if;

  if p_audio_path is null
     or length(trim(p_audio_path)) = 0 then
    raise exception 'AUDIO_PATH_REQUIRED';
  end if;

  -- ================================================================
  -- FAMILY + USER PATH ISOLATION
  -- ================================================================

  v_expected_prefix :=
    p_family_id::text
    || '/'
    || v_user_id::text
    || '/';

  if left(
    p_audio_path,
    length(v_expected_prefix)
  ) <> v_expected_prefix then
    raise exception 'INVALID_AUDIO_PATH_FORMAT';
  end if;


  -- ================================================================
  -- PATH TRAVERSAL / INVALID PATH CHECKS
  -- ================================================================

  if position('..' in p_audio_path) > 0 then
    raise exception 'INVALID_AUDIO_PATH';
  end if;

  if position('//' in p_audio_path) > 0 then
    raise exception 'INVALID_AUDIO_PATH';
  end if;

  if position('\\' in p_audio_path) > 0 then
    raise exception 'INVALID_AUDIO_PATH';
  end if;


  -- ================================================================
  -- AUDIO DURATION
  -- ================================================================

  if p_duration_seconds is not null
     and (
       p_duration_seconds < 0
       or p_duration_seconds > 600
     ) then
    raise exception 'INVALID_AUDIO_DURATION';
  end if;


  perform public.get_or_create_family_chat(
    p_family_id
  );


  insert into public.family_messages (
    family_id,
    sender_id,
    message_type,
    audio_path,
    duration_seconds
  )
  values (
    p_family_id,
    v_user_id,
    'audio',
    p_audio_path,
    p_duration_seconds
  )
  returning id
  into v_message_id;

  return v_message_id;

end;
$$;


revoke execute
on function public.send_family_audio_message(uuid, text, integer)
from public;

grant execute
on function public.send_family_audio_message(uuid, text, integer)
to authenticated;


-- ============================================================================
-- 12. DELETE FAMILY MESSAGE
--
-- Yetki:
--   - Mesaj sahibi kendi mesajını silebilir.
--   - Family owner herhangi bir aile mesajını silebilir.
--
-- Soft delete uygulanır.
-- ============================================================================

create or replace function public.delete_family_message(
  p_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_sender_id uuid;
  v_role text;
begin

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;


  -- ================================================================
  -- MESAJI KİLİTLE
  -- ================================================================

  select
    family_id,
    sender_id
  into
    v_family_id,
    v_sender_id
  from public.family_messages
  where id = p_message_id
    and deleted_at is null
  for update;


  if not found then
    raise exception 'MESSAGE_NOT_FOUND';
  end if;


  -- ================================================================
  -- FAMILY MEMBERSHIP
  -- ================================================================

  if not public.is_family_member(
    v_family_id,
    v_user_id
  ) then
    raise exception 'NOT_FAMILY_MEMBER';
  end if;


  -- ================================================================
  -- USER ROLE
  -- ================================================================

  select role
  into v_role
  from public.family_members
  where family_id = v_family_id
    and user_id = v_user_id
  limit 1;


  -- ================================================================
  -- AUTHORIZATION
  -- ================================================================

  if v_sender_id <> v_user_id
     and coalesce(v_role, '') <> 'owner' then
    raise exception 'NOT_AUTHORIZED';
  end if;


  -- ================================================================
  -- IDEMPOTENT SOFT DELETE
  -- ================================================================

  update public.family_messages
  set
    content = null,
    audio_path = null,
    deleted_at = now(),
    updated_at = now()
  where id = p_message_id
    and deleted_at is null;

end;
$$;


revoke execute
on function public.delete_family_message(uuid)
from public;

grant execute
on function public.delete_family_message(uuid)
to authenticated;


-- ============================================================================
-- 13. FAMILY CHATS RLS
-- ============================================================================

alter table public.family_chats
enable row level security;


drop policy if exists family_members_can_read_chat
on public.family_chats;

create policy family_members_can_read_chat
on public.family_chats
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_chats.family_id
      and fm.user_id = auth.uid()
  )
);


-- ============================================================================
-- 14. FAMILY MESSAGES RLS
-- ============================================================================

alter table public.family_messages
enable row level security;


drop policy if exists family_members_can_read_messages
on public.family_messages;

create policy family_members_can_read_messages
on public.family_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_messages.family_id
      and fm.user_id = auth.uid()
  )
);


-- Client doğrudan INSERT / UPDATE / DELETE yapamaz.
-- Mesaj gönderme ve silme RPC üzerinden gerçekleştirilir.

revoke insert, update, delete
on public.family_messages
from authenticated;


grant select
on public.family_messages
to authenticated;


-- ============================================================================
-- 15. PRIVATE FAMILY AUDIO BUCKET
-- ============================================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'family-audio',
  'family-audio',
  false
)
on conflict (id)
do update
set public = false;


-- ============================================================================
-- 16. STORAGE UPLOAD POLICY
--
-- Zorunlu:
--
-- family_id/user_id/file
--
-- ============================================================================

drop policy if exists family_members_can_upload_family_audio
on storage.objects;


create policy family_members_can_upload_family_audio
on storage.objects
for insert
to authenticated
with check (

  bucket_id = 'family-audio'

  and split_part(name, '/', 1) <> ''

  and split_part(name, '/', 2) <> ''

  and split_part(name, '/', 3) <> ''

  and split_part(name, '/', 2)
      = auth.uid()::text

  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text
          = split_part(name, '/', 1)
      and fm.user_id = auth.uid()
  )

  and position('..' in name) = 0

  and position('//' in name) = 0

  and position('\\' in name) = 0
);


-- ============================================================================
-- 17. STORAGE READ POLICY
--
-- Aynı ailedeki üyeler birbirlerinin sesli mesajlarını okuyabilir.
-- ============================================================================

drop policy if exists family_members_can_read_family_audio
on storage.objects;


create policy family_members_can_read_family_audio
on storage.objects
for select
to authenticated
using (

  bucket_id = 'family-audio'

  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text
          = split_part(name, '/', 1)
      and fm.user_id = auth.uid()
  )
);


-- ============================================================================
-- 18. STORAGE DELETE POLICY
--
-- Kullanıcı:
--   kendi audio dosyasını silebilir.
--
-- Owner:
--   aile içerisindeki audio dosyalarını silebilir.
-- ============================================================================

drop policy if exists family_members_can_delete_family_audio
on storage.objects;


create policy family_members_can_delete_family_audio
on storage.objects
for delete
to authenticated
using (

  bucket_id = 'family-audio'

  and (
    split_part(name, '/', 2)
      = auth.uid()::text

    or exists (
      select 1
      from public.family_members fm
      where fm.family_id::text
            = split_part(name, '/', 1)
        and fm.user_id = auth.uid()
        and fm.role = 'owner'
    )
  )
);


-- ============================================================================
-- 19. REALTIME
-- ============================================================================

alter table public.family_messages
replica identity full;


do $$
begin

  if not exists (
    select 1
    from pg_publication_rel pr

    join pg_class c
      on c.oid = pr.prrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where pr.prpubid = (
      select oid
      from pg_publication
      where pubname = 'supabase_realtime'
    )

    and n.nspname = 'public'

    and c.relname = 'family_messages'
  ) then

    alter publication supabase_realtime
    add table public.family_messages;

  end if;

end
$$;


-- ============================================================================
-- 20. PERMISSIONS
-- ============================================================================

grant select
on public.family_chats
to authenticated;


grant select
on public.family_messages
to authenticated;


-- ============================================================================
-- 21. DOCUMENTATION
-- ============================================================================

comment on table public.family_chats is
'Aile üyelerinin finansal işlemlerden bağımsız kullandığı ortak aile sohbet alanı.';


comment on table public.family_messages is
'Aile içi metin ve sesli mesaj kayıtları. Finansal kayıt sisteminden bağımsızdır.';


comment on column public.family_messages.message_type is
'Mesaj türü: text veya audio.';


comment on column public.family_messages.audio_path is
'Private family-audio bucket içerisindeki family_id/user_id/file path.';


comment on column public.family_messages.deleted_at is
'Mesajın soft-delete edildiği zaman.';


comment on function public.send_family_text_message(uuid, text) is
'Aile üyesinin güvenli şekilde metin mesajı göndermesini sağlar.';


comment on function public.send_family_audio_message(uuid, text, integer) is
'Aile üyesinin güvenli family_id/user_id audio path ile sesli mesaj göndermesini sağlar.';


comment on function public.delete_family_message(uuid) is
'Mesaj sahibinin veya aile ownerının mesajı soft-delete etmesini sağlar.';


-- ============================================================================
-- END OF 0011
-- ============================================================================